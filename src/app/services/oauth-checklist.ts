export type CheckSeverity = "must" | "should" | "info";
export type CheckId = "endpoint-tls" | "response-type" | "pkce-present" | "pkce-method" | "state" | "state-entropy" | "par" | "redirect-tls" | "redirect-localhost" | "redirect-wildcard" | "redirect-fragment" | "no-secret-in-url" | "nonce" | "scope-breadth";
export interface CheckResult {
    id: CheckId;
    severity: CheckSeverity;
    ok: boolean;
    found?: string;
    ref: string;
}
export interface AuditResult {
    valid: boolean;
    checks: CheckResult[];
    failed: number;
    failedMust: number;
}
function isLoopback(host: string): boolean {
    return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
}
function esEsquemaPrivadoNativo(protocolo: string): boolean {
    return /^[a-z][a-z0-9+-]*(\.[a-z0-9+-]+)+:$/i.test(protocolo);
}
export function bitsMaximos(v: string): number {
    if (new Set(v).size < 4)
        return 0;
    const alfabeto = (/[a-z]/.test(v) ? 26 : 0) + (/[A-Z]/.test(v) ? 26 : 0) + (/[0-9]/.test(v) ? 10 : 0)
        + (/[^A-Za-z0-9]/.test(v) ? 4 : 0);
    return v.length * Math.log2(Math.max(alfabeto, 2));
}
const BROAD_SCOPES = ["offline_access", "files.read.all", "mail.read", "mail.readwrite", "directory.readwrite.all", "full_access"];
export function auditAuthorizeUrl(raw: string): AuditResult {
    const trimmed = (raw ?? "").trim();
    let url: URL;
    try {
        url = new URL(trimmed);
    }
    catch {
        return { valid: false, checks: [], failed: 0, failedMust: 0 };
    }
    const q = url.searchParams;
    const checks: CheckResult[] = [];
    const add = (id: CheckId, severity: CheckSeverity, ok: boolean, ref: string, found?: string) => checks.push({ id, severity, ok, ref, found });
    add("endpoint-tls", "must", url.protocol === "https:", "RFC 9700 \u00A72.6", url.protocol.replace(":", ""));
    if (q.has("request_uri") || q.has("request")) {
        add("par", "info", true, q.has("request_uri") ? "RFC 9126 \u00A74" : "RFC 9101 \u00A74", q.has("request_uri") ? "request_uri" : "request");
        const fugas = ["client_secret", "password", "access_token", "refresh_token"].filter(k => q.has(k));
        add("no-secret-in-url", "must", fugas.length === 0, "RFC 9700 \u00A74.3", fugas.length ? fugas.join(", ") : undefined);
        const mal = checks.filter(c => !c.ok);
        return { valid: true, checks, failed: mal.length, failedMust: mal.filter(c => c.severity === "must").length };
    }
    const responseType = (q.get("response_type") ?? "").trim();
    const rtParts = responseType.split(/\s+/).filter(Boolean);
    const hasImplicitToken = rtParts.includes("token");
    add("response-type", "should", responseType !== "" && !hasImplicitToken, "RFC 9700 \u00A72.1.2", responseType || undefined);
    const isCodeFlow = rtParts.includes("code");
    const challenge = q.get("code_challenge");
    const method = q.get("code_challenge_method");
    add("pkce-present", isCodeFlow ? "must" : "info", !!challenge, "RFC 9700 \u00A72.1.1", challenge ? `${challenge.slice(0, 12)}…` : undefined);
    if (challenge) {
        add("pkce-method", "must", method === "S256", "RFC 9700 \u00A72.1.1", method ?? undefined);
    }
    const state = q.get("state");
    add("state", "should", !!state, "RFC 9700 \u00A74.7.1", state ? `${state.slice(0, 12)}…` : undefined);
    if (state) {
        add("state-entropy", "should", bitsMaximos(state) >= 128, "RFC 6749 \u00A710.10", `≤ ${Math.floor(bitsMaximos(state))} bits`);
    }
    const redirect = q.get("redirect_uri") ?? "";
    let redirectUrl: URL | null = null;
    try {
        redirectUrl = redirect ? new URL(redirect) : null;
    }
    catch {
        redirectUrl = null;
    }
    add("redirect-tls", "must", !!redirectUrl && (redirectUrl.protocol === "https:" || isLoopback(redirectUrl.hostname)
        || esEsquemaPrivadoNativo(redirectUrl.protocol)), "RFC 9700 \u00A72.6 \u00B7 RFC 8252 \u00A77.1", redirect || undefined);
    if (redirectUrl && redirectUrl.protocol === "http:" && redirectUrl.hostname === "localhost") {
        add("redirect-localhost", "should", false, "RFC 8252 \u00A78.3", redirect);
    }
    add("redirect-wildcard", "must", !redirect.includes("*"), "RFC 9700 \u00A72.1", redirect.includes("*") ? redirect : undefined);
    add("redirect-fragment", "must", !redirectUrl || !redirectUrl.hash, "RFC 6749 \u00A73.1.2", redirectUrl?.hash || undefined);
    const leaked = ["client_secret", "password", "access_token", "refresh_token"].filter(k => q.has(k));
    add("no-secret-in-url", "must", leaked.length === 0, "RFC 9700 \u00A74.3", leaked.length ? leaked.join(", ") : undefined);
    if (rtParts.includes("id_token")) {
        const nonce = q.get("nonce");
        add("nonce", "must", !!nonce, "OpenID Connect Core \u00A73.1.2.1", nonce ? `${nonce.slice(0, 12)}…` : undefined);
    }
    const scope = (q.get("scope") ?? "").toLowerCase();
    const broad = BROAD_SCOPES.filter(s => scope.split(/\s+/).includes(s));
    add("scope-breadth", "info", broad.length === 0, "RFC 9700 \u00A72.3", broad.length ? broad.join(", ") : undefined);
    const failing = checks.filter(c => !c.ok);
    return {
        valid: true,
        checks,
        failed: failing.length,
        failedMust: failing.filter(c => c.severity === "must").length,
    };
}
