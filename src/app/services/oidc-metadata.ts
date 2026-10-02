import type { CheckSeverity } from "./oauth-checklist";
export type OidcCheckId = "issuer-https" | "required-fields" | "endpoints-https" | "rs256" | "id-token-none" | "endpoint-auth-none" | "pkce-advertised" | "pkce-plain" | "implicit" | "password-grant" | "iss-response" | "sender-constrained" | "par";
export interface OidcCheck {
    id: OidcCheckId;
    severity: CheckSeverity;
    ok: boolean;
    found?: string;
    ref: string;
}
export interface OidcAudit {
    valid: boolean;
    kind: "oidc" | "oauth";
    checks: OidcCheck[];
    failed: number;
    failedMust: number;
}
const VACIO: OidcAudit = { valid: false, kind: "oauth", checks: [], failed: 0, failedMust: 0 };
const lista = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
function issuerValido(v: unknown): boolean {
    if (typeof v !== "string")
        return false;
    try {
        return new URL(v).protocol === "https:" && !v.includes("?") && !v.includes("#");
    }
    catch {
        return false;
    }
}
export function auditOidcMetadata(texto: string): OidcAudit {
    let doc: unknown;
    try {
        doc = JSON.parse(texto);
    }
    catch {
        return VACIO;
    }
    if (!doc || typeof doc !== "object" || Array.isArray(doc))
        return VACIO;
    const m = doc as Record<string, unknown>;
    const oidc = "id_token_signing_alg_values_supported" in m || "subject_types_supported" in m
        || "userinfo_endpoint" in m || lista(m["scopes_supported"]).includes("openid");
    const checks: OidcCheck[] = [];
    const add = (c: OidcCheck) => checks.push(c);
    add({ id: "issuer-https", severity: "must", ok: issuerValido(m["issuer"]), found: typeof m["issuer"] === "string" ? m["issuer"] : undefined, ref: "RFC 8414 \u00A72 \u00B7 OIDC Discovery \u00A73" });
    const responseTypes = lista(m["response_types_supported"]);
    const grants = lista(m["grant_types_supported"]);
    const soloImplicito = responseTypes.length > 0 && responseTypes.every(rt => !rt.split(" ").includes("code"));
    const obligatorios = ["issuer", "authorization_endpoint", "response_types_supported", ...(soloImplicito ? [] : ["token_endpoint"]), ...(oidc ? ["jwks_uri", "subject_types_supported", "id_token_signing_alg_values_supported"] : [])];
    const faltan = obligatorios.filter(k => m[k] === undefined);
    add({ id: "required-fields", severity: "must", ok: faltan.length === 0, found: faltan.join(", ") || undefined, ref: oidc ? "OIDC Discovery \u00A73" : "RFC 8414 \u00A72" });
    const endpoints = Object.entries(m).filter(([k, v]) => (k.endsWith("_endpoint") || k === "jwks_uri") && typeof v === "string");
    const enClaro = endpoints.filter(([, v]) => !/^https:\/\//i.test(v as string)).map(([k]) => k);
    add({ id: "endpoints-https", severity: "must", ok: enClaro.length === 0, found: enClaro.join(", ") || undefined, ref: "RFC 6749 \u00A73.1\u20133.2 \u00B7 RFC 8414 \u00A72" });
    if (oidc) {
        const algs = lista(m["id_token_signing_alg_values_supported"]);
        add({ id: "rs256", severity: "must", ok: algs.includes("RS256"), found: algs.join(" ") || undefined, ref: "OIDC Discovery \u00A73" });
        add({ id: "id-token-none", severity: "should", ok: !algs.includes("none"), found: algs.includes("none") ? "none" : undefined, ref: "OIDC Discovery \u00A73 \u00B7 RFC 8725 \u00A73.2" });
    }
    const authAlgs = ["token_endpoint_auth_signing_alg_values_supported", "revocation_endpoint_auth_signing_alg_values_supported", "introspection_endpoint_auth_signing_alg_values_supported"].filter(k => lista(m[k]).includes("none"));
    add({ id: "endpoint-auth-none", severity: "must", ok: authAlgs.length === 0, found: authAlgs.join(", ") || undefined, ref: "RFC 8414 \u00A72" });
    const pkce = lista(m["code_challenge_methods_supported"]);
    add({ id: "pkce-advertised", severity: "should", ok: pkce.includes("S256"), found: pkce.join(" ") || undefined, ref: "RFC 9700 \u00A72.1.1 \u00B7 RFC 8414 \u00A72" });
    if (pkce.includes("plain"))
        add({ id: "pkce-plain", severity: "should", ok: false, found: "plain", ref: "RFC 9700 \u00A72.1.1 \u00B7 RFC 7636 \u00A74.2" });
    const implicitos = responseTypes.filter(rt => rt.split(" ").includes("token"));
    add({ id: "implicit", severity: "should", ok: implicitos.length === 0 && !grants.includes("implicit"), found: [...implicitos, ...(grants.includes("implicit") ? ["implicit"] : [])].join(", ") || undefined, ref: "RFC 9700 \u00A72.1.2" });
    add({ id: "password-grant", severity: "must", ok: !grants.includes("password"), found: grants.includes("password") ? "password" : undefined, ref: "RFC 9700 \u00A72.4" });
    add({ id: "iss-response", severity: "should", ok: m["authorization_response_iss_parameter_supported"] === true, found: m["authorization_response_iss_parameter_supported"] === undefined ? undefined : String(m["authorization_response_iss_parameter_supported"]), ref: "RFC 9207 \u00A73 \u00B7 RFC 9700 \u00A74.4" });
    const dpop = lista(m["dpop_signing_alg_values_supported"]);
    const mtls = m["tls_client_certificate_bound_access_tokens"] === true;
    add({ id: "sender-constrained", severity: "info", ok: dpop.length > 0 || mtls, found: [dpop.length ? `DPoP (${dpop.join(" ")})` : "", mtls ? "mTLS" : ""].filter(Boolean).join(" \u00B7 ") || undefined, ref: "RFC 9700 \u00A72.2.1 \u00B7 RFC 9449 \u00B7 RFC 8705" });
    add({ id: "par", severity: "info", ok: typeof m["pushed_authorization_request_endpoint"] === "string", found: m["require_pushed_authorization_requests"] === true ? "require_pushed_authorization_requests" : undefined, ref: "RFC 9126 \u00A75" });
    const fallidos = checks.filter(c => !c.ok && c.severity !== "info");
    return {
        valid: true,
        kind: oidc ? "oidc" : "oauth",
        checks,
        failed: fallidos.length,
        failedMust: fallidos.filter(c => c.severity === "must").length,
    };
}
