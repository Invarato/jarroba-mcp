import type { Categoria, Hallazgo as HallazgoTexto, Analisis as AnalisisTexto } from "../../src/app/services/texto-oculto.service";
import type { AnalisisPegado, ParteHar } from "../../src/app/services/pegar-seguro.service";
import type { ReglaAccion, AuditoriaAcciones, Confianza as ConfianzaAccion } from "../../src/app/services/github-actions-audit.service";
import type { ReglaCabecera, AnalisisCabeceras } from "../../src/app/services/headers-audit.service";
import type { ReglaCorreo, AnalisisCorreo } from "../../src/app/services/email-audit.service";
import type { ReglaSaml, AnalisisSaml } from "../../src/app/services/saml-audit.service";
import type { ReglaId as ReglaAgente, Auditoria as AuditoriaAgente, TipoFichero } from "../../src/app/services/agente-audit.service";
import type { CambioCatalogo, TipoCambio } from "../../src/app/services/mcp-tool-poisoning.service";
import type { AuditResult } from "../../src/app/services/oauth-checklist";
import type { OidcAudit } from "../../src/app/services/oidc-metadata";
import type { AvisoJwt } from "../../src/app/shared/jwt-audit";
import type { ReglaK8s, HallazgoK8s, Conexiones, Matriz, Explicacion, Modelo as ModeloK8s } from "../../src/app/services/k8s-network";
import type { ErrorEsquema, TipoError } from "../../src/app/services/k8s-esquema";
import type { RiesgoRbac } from "../../src/app/services/k8s-riesgos";
import type { AnalisisRbac } from "../../src/app/services/k8s-rbac";
import type { ResultadoPss, NivelPss } from "../../src/app/services/k8s-pss";
type Gravedad4 = "critico" | "alto" | "aviso" | "info";
export const SEVERIDAD: Record<Gravedad4, string> = { critico: "critical", alto: "high", aviso: "warning", info: "info" };
export const CONFIANZA: Record<ConfianzaAccion, string> = { estructural: "structural", indicio: "heuristic" };
export const CATEGORIA_TEXTO: Record<Categoria, string> = {
    etiquetas: "tag-characters",
    selectores: "variation-selectors",
    bits: "invisible-bits",
    "ancho-cero": "zero-width",
    bidi: "bidi-control",
    control: "control-characters",
    espacios: "unusual-spaces",
    homoglifos: "homoglyphs",
};
const GRAVEDAD_TEXTO: Record<HallazgoTexto["gravedad"], string> = { grave: "severe", aviso: "warning", legitimo: "legitimate" };
const MOTIVO_TEXTO: Record<NonNullable<HallazgoTexto["motivo"]>, string> = {
    emoji: "emoji",
    bandera: "flag",
    escritura: "script",
    "bom-inicial": "leading-bom",
    "selector-simple": "single-selector",
    "texto-rtl": "rtl-text",
};
const PARTE_HAR: Record<ParteHar, string> = {
    "cabecera-peticion": "request-header",
    "cabecera-respuesta": "response-header",
    "cookie-peticion": "request-cookie",
    "cookie-respuesta": "response-cookie",
    query: "query",
    "cuerpo-peticion": "request-body",
    "cuerpo-respuesta": "response-body",
};
export const REGLA_ACCION: Record<ReglaAccion, string> = {
    "inyeccion-comando": "command-injection",
    "inyeccion-script": "script-injection",
    "pwn-request": "pwn-request",
    "accion-sin-pin": "unpinned-action",
    "secreto-literal": "hardcoded-secret",
    "permisos-totales": "write-all-permissions",
    "pipe-a-shell": "pipe-to-shell",
    "host-sospechoso": "suspicious-host",
    "yaml-invalido": "invalid-yaml",
    "checkout-credenciales": "checkout-persisted-credentials",
    "workflow-run-inseguro": "unsafe-workflow-run",
    "github-env-inseguro": "unsafe-github-env",
    "secretos-heredados": "secrets-inherit",
    "secretos-volcados": "secrets-dumped",
    "sin-permisos": "no-permissions",
};
export const REGLA_CABECERA: Record<ReglaCabecera, string> = {
    "csp-ausente": "csp-missing",
    "csp-unsafe-inline": "csp-unsafe-inline",
    "csp-unsafe-eval": "csp-unsafe-eval",
    "csp-wildcard": "csp-wildcard",
    "csp-sin-object-src": "csp-no-object-src",
    "csp-sin-base-uri": "csp-no-base-uri",
    "csp-sin-frame-ancestors": "csp-no-frame-ancestors",
    "sin-nosniff": "no-nosniff",
    "sin-hsts": "no-hsts",
    "hsts-corto": "hsts-too-short",
    "hsts-preload-invalido": "hsts-preload-invalid",
    "sin-frame-options": "no-frame-options",
    "xss-protection-obsoleto": "x-xss-protection-obsolete",
    "sin-referrer-policy": "no-referrer-policy",
    "cookie-sin-secure": "cookie-no-secure",
    "cookie-sin-httponly": "cookie-no-httponly",
    "cookie-samesite-none-sin-secure": "cookie-samesite-none-without-secure",
    "cookie-sin-samesite": "cookie-no-samesite",
    "servidor-expuesto": "server-version-exposed",
    "csp-solo-informe": "csp-report-only",
    "csp-lista-hosts": "csp-host-allowlist",
    "csp-sin-form-action": "csp-no-form-action",
    "cors-origen-null": "cors-null-origin",
    "cors-comodin-credenciales": "cors-wildcard-with-credentials",
    "cookie-prefijo-invalido": "cookie-invalid-prefix",
    "sin-coop": "no-coop",
    "sin-permissions-policy": "no-permissions-policy",
};
export const REGLA_CORREO: Record<ReglaCorreo, string> = {
    "spf-fallo": "spf-fail",
    "spf-blando": "spf-softfail",
    "spf-permerror": "spf-permerror",
    "spf-temperror": "spf-temperror",
    "dkim-fallo": "dkim-fail",
    "dkim-sin-from": "dkim-from-not-signed",
    "dkim-algoritmo-debil": "dkim-weak-algorithm",
    "dkim-cuerpo-truncado": "dkim-partial-body",
    "dmarc-fallo": "dmarc-fail",
    "reply-to-distinto": "reply-to-mismatch",
    "return-path-distinto": "return-path-mismatch",
    "spf-multiple": "spf-multiple-records",
    "spf-todo-permite": "spf-plus-all",
    "spf-todo-neutral": "spf-neutral-all",
    "spf-sin-all": "spf-no-all",
    "spf-demasiadas-consultas": "spf-too-many-lookups",
    "spf-ptr-obsoleto": "spf-ptr-deprecated",
    "dmarc-formato-invalido": "dmarc-invalid-format",
    "dmarc-p-none": "dmarc-policy-none",
    "dmarc-sin-rua": "dmarc-no-rua",
    "dmarc-sin-p": "dmarc-no-policy",
    "dmarc-pct-obsoleto": "dmarc-pct-obsolete",
    "dmarc-etiqueta-obsoleta": "dmarc-obsolete-tag",
    "dmarc-modo-pruebas": "dmarc-test-mode",
    "dmarc-sp-debil": "dmarc-weak-subdomain-policy",
    "dmarc-np-debil": "dmarc-weak-nonexistent-policy",
    "dkim-clave-invalida": "dkim-key-invalid",
    "dkim-clave-debil": "dkim-key-weak",
    "dkim-clave-revocada": "dkim-key-revoked",
    "dkim-modo-pruebas": "dkim-test-mode",
};
export const REGLA_SAML: Record<ReglaSaml, string> = {
    "sin-firma": "unsigned",
    "algoritmo-firma-debil": "weak-signature-algorithm",
    "algoritmo-digest-debil": "weak-digest-algorithm",
    "ids-duplicados": "duplicate-ids",
    "referencia-no-coincide": "signature-reference-mismatch",
    "sin-notonorafter": "no-notonorafter",
    expirado: "expired",
    "sin-audience": "no-audience-restriction",
    "sin-inresponseto": "no-inresponseto",
    "sin-cifrar": "unencrypted-assertion",
    "estado-no-exito": "status-not-success",
    "secreto-en-atributo": "secret-in-attribute",
    "xml-invalido": "invalid-xml",
    "doctype-presente": "doctype-present",
    "comentario-en-identidad": "comment-in-identity",
    "transformacion-peligrosa": "dangerous-transform",
    "sin-recipient": "no-recipient",
    "sin-destination": "no-destination",
    "recipient-no-coincide": "recipient-mismatch",
    "issuer-no-coincide": "issuer-mismatch",
};
export const REGLA_AGENTE: Record<ReglaAgente, string> = {
    "hook-comando": "hook-command",
    "hook-http": "hook-http",
    "comando-ayudante": "helper-command",
    "mcp-auto-aprobado": "mcp-auto-approved",
    "env-desvia-api": "env-redirects-api",
    "env-node-options": "env-node-options",
    "secreto-literal": "hardcoded-secret",
    "permiso-shell-libre": "unrestricted-shell-permission",
    "permiso-interprete": "interpreter-permission",
    "permiso-red-libre": "unrestricted-network-permission",
    "permiso-lectura-amplia": "broad-read-permission",
    "permiso-escritura-libre": "unrestricted-write-permission",
    "modo-sin-permisos": "permissions-bypass-mode",
    "directorio-amplio": "broad-additional-directory",
    "deny-red-insuficiente": "insufficient-network-deny",
    "mcp-shell": "mcp-runs-shell",
    "mcp-sin-version": "mcp-unpinned-version",
    "mcp-docker-privilegiado": "mcp-privileged-docker",
    "mcp-http-plano": "mcp-plain-http",
    "mcp-confianza-total": "mcp-full-trust",
    "mcp-esquema-equivocado": "mcp-wrong-config-key",
    "mcp-url-interna": "mcp-internal-url",
    "mcp-escucha-todas": "mcp-binds-all-interfaces",
    "mcp-remote-vulnerable": "mcp-remote-vulnerable",
    "vscode-autoaprobar": "vscode-auto-approve",
    "vscode-sin-confianza": "vscode-workspace-trust-disabled",
    "vscode-tarea-al-abrir": "vscode-task-runs-on-open",
    "codex-sin-sandbox": "codex-no-sandbox",
    "codex-sin-aprobacion": "codex-no-approval",
    "codex-red": "codex-network-enabled",
    "gemini-sin-confianza": "gemini-folder-trust-disabled",
    "gemini-shell-libre": "gemini-unrestricted-shell",
    "entorno-desvia-config": "env-redirects-config",
    "unicode-oculto": "hidden-unicode",
    "texto-ocultar-usuario": "text-hide-from-user",
    "texto-anular-instrucciones": "text-override-instructions",
    "texto-autoridad-falsa": "text-false-authority",
    "texto-pipe-shell": "text-pipe-to-shell",
    "texto-host-sospechoso": "text-suspicious-host",
    "texto-exfil-imagen": "text-image-exfiltration",
    "texto-ruta-sensible": "text-sensitive-path",
    "texto-escribe-memoria": "text-modifies-agent-config",
    "texto-comentario-oculto": "text-hidden-comment",
    "import-externo": "external-import",
    "skill-herramientas-libres": "skill-unrestricted-tools",
    "skill-inyeccion-comando": "skill-command-injection",
    "skill-nombre-invalido": "skill-invalid-name",
    "subagente-sin-permisos": "subagent-skips-permissions",
    "script-empaquetado": "skill-bundles-script",
    "json-invalido": "invalid-json",
};
const TIPO_FICHERO: Record<TipoFichero, string> = {
    "claude-settings": "claude-settings",
    mcp: "mcp-config",
    "vscode-settings": "vscode-settings",
    "vscode-tasks": "vscode-tasks",
    "codex-toml": "codex-config",
    "gemini-settings": "gemini-settings",
    entorno: "env-file",
    instrucciones: "instructions",
    skill: "skill",
    subagente: "subagent",
    script: "script",
    desconocido: "unknown",
};
export const PROSA_EN_FRAGMENTO = {
    accion: new Set<ReglaAccion>(),
    cabecera: new Set<ReglaCabecera>(),
    correo: new Set<ReglaCorreo>(),
    saml: new Set<ReglaSaml>(),
};
const CLAVE_DATOS: Record<string, string> = {
    clave: "key",
    servidor: "server",
    algoritmo: "algorithm",
    espera: "expected",
    uriFirmada: "signedUri",
    idLeido: "readId",
    estado: "status",
    enBloque: "inBlock",
    consultas: "lookups",
    comando: "command",
    citado: "quoted",
    carpeta: "folder",
    atributo: "attribute",
    accion: "action",
    contexto: "context",
    paquete: "package",
    motivo: "reason",
    mensaje: "message",
    etiqueta: "tag",
    elemento: "element",
    disparador: "trigger",
    tipo: "kind",
    direccion: "direction",
    regla: "rule",
    puerto: "port",
    nombre: "name",
    nivel: "level",
    sa: "serviceAccount",
    riesgos: "risks",
    montado: "tokenMounted",
};
const datosEn = (d?: Record<string, string>) => d && Object.keys(d).length ? Object.fromEntries(Object.entries(d).map(([k, v]) => [CLAVE_DATOS[k] ?? k, v])) : undefined;
const porGravedadEn = (p: Record<Gravedad4, number>) => Object.fromEntries((Object.keys(p) as Gravedad4[]).map((g) => [SEVERIDAD[g], p[g]]));
function hallazgoEn<R extends string>(h: {
    regla: R;
    gravedad: Gravedad4;
    fragmento: string;
    datos?: Record<string, string>;
}, reglas: Record<R, string>, prosa: Set<R>) {
    return {
        rule: reglas[h.regla],
        severity: SEVERIDAD[h.gravedad],
        excerpt: prosa.has(h.regla) || !h.fragmento ? undefined : h.fragmento,
        data: datosEn(h.datos),
    };
}
export function textoEn(a: AnalisisTexto) {
    return {
        severe: a.graves,
        warnings: a.avisos,
        legitimate: a.legitimos,
        byCategory: Object.fromEntries(Object.entries(a.porCategoria).map(([c, n]) => [CATEGORIA_TEXTO[c as Categoria], n])),
        hiddenMessages: a.mensajes.map((m) => ({ category: CATEGORIA_TEXTO[m.categoria], text: m.texto })),
        findings: a.hallazgos.map((h) => ({
            category: CATEGORIA_TEXTO[h.categoria],
            severity: GRAVEDAD_TEXTO[h.gravedad],
            start: h.inicio,
            end: h.fin,
            codepoints: h.codepoints.map((c) => "U+" + c.toString(16).toUpperCase().padStart(4, "0")),
            decoded: h.decodificado,
            word: h.palabra,
            legitimateBecause: h.motivo && MOTIVO_TEXTO[h.motivo],
        })),
    };
}
export function pegadoEn(a: AnalisisPegado) {
    return {
        source: a.origen === "har" ? "har" : "text",
        harEntries: a.entradasHar,
        truncated: a.truncado || undefined,
        byCategory: a.porCategoria,
        findings: a.hallazgos.map((h) => ({
            entity: h.entidad,
            category: h.categoria,
            preview: h.vistaPrevia,
            line: h.linea,
            location: h.ubicacion && {
                entry: h.ubicacion.entrada,
                method: h.ubicacion.metodo,
                url: h.ubicacion.url,
                part: PARTE_HAR[h.ubicacion.parte],
                name: h.ubicacion.nombre,
            },
        })),
        redacted: a.limpio,
    };
}
export function accionesEn(a: AuditoriaAcciones) {
    return {
        bySeverity: porGravedadEn(a.porGravedad),
        findings: a.hallazgos.map((h) => ({
            ...hallazgoEn(h, REGLA_ACCION, PROSA_EN_FRAGMENTO.accion),
            confidence: CONFIANZA[h.confianza],
            file: h.fichero,
            line: h.linea,
            job: h.job,
        })),
    };
}
export function cabecerasEn(a: AnalisisCabeceras) {
    return {
        https: a.https,
        headers: a.cabeceras,
        cookies: a.cookies,
        bySeverity: porGravedadEn(a.porGravedad),
        findings: a.hallazgos.map((h) => ({ ...hallazgoEn(h, REGLA_CABECERA, PROSA_EN_FRAGMENTO.cabecera), cookie: h.cookie })),
    };
}
export function correoEn(a: AnalisisCorreo) {
    const c = a.cabeceras;
    return {
        headers: c && {
            from: c.from,
            fromDomain: c.fromDominio,
            replyTo: c.replyTo,
            replyToDomain: c.replyToDominio,
            returnPath: c.returnPath,
            returnPathDomain: c.returnPathDominio,
            authenticationResults: c.autenticacion,
        },
        dnsRecords: a.registrosDns.map((r) => ({ type: r.tipo, text: r.texto })),
        bySeverity: porGravedadEn(a.porGravedad),
        findings: a.hallazgos.map((h) => hallazgoEn(h, REGLA_CORREO, PROSA_EN_FRAGMENTO.correo)),
    };
}
export function samlEn(a: AnalisisSaml) {
    return {
        binding: a.binding,
        messageType: a.tipo === "desconocido" ? "unknown" : a.tipo,
        issuer: a.issuer,
        nameId: a.nameId,
        attributes: a.atributos.map((x) => ({ name: x.nombre, value: x.valor })),
        bySeverity: porGravedadEn(a.porGravedad),
        findings: a.hallazgos.map((h) => hallazgoEn(h, REGLA_SAML, PROSA_EN_FRAGMENTO.saml)),
    };
}
export function agenteEn(a: AuditoriaAgente) {
    const uno = (h: AuditoriaAgente["hallazgos"][number]) => ({
        rule: REGLA_AGENTE[h.regla],
        severity: SEVERIDAD[h.gravedad],
        confidence: CONFIANZA[h.confianza],
        file: h.fichero,
        line: h.linea,
        excerpt: h.fragmento || undefined,
        runsWithoutAsking: h.seEjecutaSolo || undefined,
        data: datosEn(h.datos),
    });
    return {
        files: a.ficheros.map((f) => ({ path: f.ruta, recognizedAs: TIPO_FICHERO[f.tipo], findings: f.hallazgos.length })),
        bySeverity: porGravedadEn(a.porGravedad),
        runsWithoutAsking: a.seEjecutaSolo.map(uno),
        findings: a.hallazgos.map(uno),
    };
}
export const TIPO_CAMBIO: Record<TipoCambio, string> = {
    "tool-nueva": "new-tool",
    "tool-quitada": "removed-tool",
    "descripcion-cambiada": "description-changed",
    "envenenamiento-nuevo": "new-poisoning-signals",
    "esquema-cambiado": "input-schema-changed",
    "annotations-debilitadas": "annotations-weakened",
};
export const cambiosCatalogoEn = (cs: CambioCatalogo[]) => cs.map((c) => ({
    change: TIPO_CAMBIO[c.tipo],
    tool: c.tool,
    severity: SEVERIDAD[c.gravedad],
    detail: c.detalle,
}));
const comprobacionEn = (c: {
    id: string;
    severity: string;
    ok: boolean;
    found?: string;
    ref: string;
}) => ({
    check: c.id,
    severity: c.severity,
    passed: c.ok,
    reference: c.ref,
    found: c.found && c.found !== "(ausente)" ? c.found : undefined,
});
type Auditoria = {
    valid: boolean;
    failed: number;
    failedMust: number;
    checks: {
        id: string;
        severity: string;
        ok: boolean;
        found?: string;
        ref: string;
    }[];
};
const auditoriaEn = (a: Auditoria) => ({
    parsed: a.valid,
    failed: a.failed,
    failedMust: a.failedMust,
    failedChecks: a.checks.filter((c) => !c.ok).map(comprobacionEn),
    passedChecks: a.checks.filter((c) => c.ok).map((c) => c.id),
});
export const oauthEn = (a: AuditResult) => auditoriaEn(a);
export const oidcEn = (a: OidcAudit) => ({ ...auditoriaEn(a), documentKind: a.kind });
export const AVISO_JWT: Record<AvisoJwt, string> = {
    "confusion-clave-publica": "hmac-verified-with-public-key",
    "secreto-corto": "hmac-secret-too-short",
    "alg-distinto": "alg-differs-from-verifier",
    "familia-distinta": "alg-family-differs-from-verifier",
    "sin-exp": "no-exp",
    "exp-no-numerico": "exp-not-numericdate",
    "nbf-no-numerico": "nbf-not-numericdate",
    "alg-mayusculas": "alg-case-mismatch",
    "typ-no-at-jwt": "access-token-without-typ-at+jwt",
    "kid-inyeccion": "kid-injection",
    "clave-remota": "key-from-token-header",
    "formato-ilegal": "illegal-characters",
};
export const REGLA_K8S: Record<ReglaK8s, string> = {
    "yaml-invalido": "invalid-yaml",
    "politica-sin-pods": "policy-selects-no-pods",
    "peer-sin-pods": "peer-matches-no-pods",
    "peers-separados": "namespace-and-pod-selectors-split",
    "servicio-sin-pods": "service-selects-no-pods",
    "servicio-puerto-inexistente": "service-targetport-not-exposed",
    "referencia-inexistente": "missing-reference",
    inalcanzable: "unreachable-pod",
    "namespace-sin-politicas": "namespace-without-policies",
    "red-del-nodo": "host-network-pod",
    "pss-rechazado": "pod-security-rejected",
    "pss-privilegiado": "pod-security-privileged",
    "pss-aviso": "pod-security-warning",
    "sa-peligrosa": "dangerous-service-account",
    "sa-token-innecesario": "unneeded-service-account-token",
};
export const EXTERNO_EN = "external";
const nodoEn = (n: string, externo: string) => (n === externo ? EXTERNO_EN : n);
export const conexionesEn = (c: Conexiones) => (c === "todas" ? "all"
    : c.map((r) => `${r.proto}/${r.desde === r.hasta ? r.desde : `${r.desde}-${r.hasta}`}`));
export const RIESGO_RBAC: Record<RiesgoRbac, string> = {
    "leer-secretos": "read-secrets",
    "crear-cargas": "create-workloads",
    "exec-pods": "exec-into-pods",
    "crear-volumenes": "create-volumes",
    "nodes-proxy": "nodes-proxy",
    escalate: "escalate",
    bind: "bind",
    impersonate: "impersonate",
    certificados: "sign-certificates",
    tokens: "create-tokens",
    webhooks: "webhooks",
    namespaces: "namespaces",
    comodin: "wildcard",
};
const datosK8sEn = (d?: Record<string, string>) => datosEn(d && d["riesgos"] !== undefined
    ? { ...d, riesgos: d["riesgos"].split(", ").map((r) => RIESGO_RBAC[r as RiesgoRbac] ?? r).join(", ") } : d);
export const hallazgosK8sEn = (hs: HallazgoK8s[]) => hs.map((h) => ({
    rule: REGLA_K8S[h.regla],
    severity: SEVERIDAD[h.gravedad],
    object: h.fragmento,
    data: datosK8sEn(h.datos),
}));
export function alcanceEn(mx: Matriz, externo: string, limite = 500) {
    const pares: {
        from: string;
        to: string;
        ports: string | string[];
        onlySomeIps?: true;
    }[] = [];
    let bloqueados = 0;
    for (const o of mx.nodos)
        for (const d of mx.nodos) {
            if (o === d)
                continue;
            const c = mx.celdas[o]?.[d];
            if (!c || (c.conexiones !== "todas" && !c.conexiones.length)) {
                bloqueados++;
                continue;
            }
            pares.push({ from: nodoEn(o, externo), to: nodoEn(d, externo), ports: conexionesEn(c.conexiones), ...(c.parcial && { onlySomeIps: true as const }) });
        }
    return { reachable: pares.slice(0, limite), reachableTotal: pares.length, truncated: pares.length > limite || undefined, blockedPairs: bloqueados };
}
const ladoEn = (l: Explicacion["salida"]) => ({
    isolated: l.aislado,
    selectingPolicies: l.politicas,
    allowedBy: l.permiten.map((p) => ({ policy: p.politica, ruleIndex: p.regla, ports: conexionesEn(p.conexiones), onlySomeIps: p.parcial || undefined })),
    ports: conexionesEn(l.conexiones),
});
export const explicacionEn = (e: Explicacion) => ({
    result: conexionesEn(e.conexiones),
    onlySomeIps: e.parcial || undefined,
    egressFromSource: ladoEn(e.salida),
    ingressToDestination: ladoEn(e.entrada),
});
export const resumenK8s = (m: ModeloK8s) => ({
    workloads: m.cargas.length,
    policies: m.politicas.length,
    services: m.servicios.length,
    parseErrors: m.errores.length ? m.errores : undefined,
    hostNetworkPods: m.redDelNodo.length ? m.redDelNodo : undefined,
});
export const TIPO_ERROR_ESQUEMA: Record<TipoError, string> = {
    "campo-desconocido": "unknown-field",
    tipo: "wrong-type",
    requerido: "missing-required",
    "api-retirada": "removed-api",
    "sin-esquema": "no-schema",
    "sin-kind": "missing-kind-or-apiVersion",
};
export const erroresEsquemaEn = (es: ErrorEsquema[]) => es.map((e) => ({
    object: e.objeto,
    problem: TIPO_ERROR_ESQUEMA[e.tipo],
    path: e.ruta || undefined,
    expected: e.esperado,
    didYouMean: e.sugerencia,
    removed: e.retirada && { removedIn: e.retirada.en, use: e.retirada.usar },
}));
export const pssEn = (rs: ResultadoPss[], contra: Exclude<NivelPss, "privileged">) => rs.map((r) => ({
    workload: r.carga,
    highestLevel: r.nivel,
    ...(r[contra].length ? { [`violates_${contra}`]: r[contra] } : {}),
}));
export const rbacEn = (a: AnalisisRbac) => a.identidades.filter((i) => i.riesgos.length || i.tokenMontado).map((i) => ({
    workload: i.carga,
    serviceAccount: i.serviceAccount,
    tokenMounted: i.tokenMontado,
    ifCompromised: i.riesgos.map((r) => ({ risk: RIESGO_RBAC[r.riesgo], scope: r.ambito, grantedBy: r.binding })),
    hasAnyPermission: i.algunPermiso,
}));
import type { RespuestaConsulta, Estado, Certeza, Area, Precision } from "../../src/app/shared/practicas/practicas";
export const ESTADO_PRACTICA: Record<Estado, string> = {
    vigente: "still-valid",
    superada: "superseded",
    antipatron: "anti-pattern",
    innecesaria: "no-longer-needed",
    depende: "depends",
};
export const CERTEZA_PRACTICA: Record<Certeza, string> = { medido: "measured", documentado: "documented", consenso: "consensus", opinion: "opinion" };
const AREA_PRACTICA: Record<Area, string> = { ia: "ai", desarrollo: "development", web: "web", seguridad: "security", datos: "data", infra: "infrastructure" };
const PRECISION: Record<Precision, string> = { dia: "day", mes: "month", año: "year", aprox: "approximate" };
export function practicasEn(r: RespuestaConsulta) {
    if (!r.found)
        return r;
    return { found: true, results: r.results.map((p) => ({
            ...p,
            area: AREA_PRACTICA[p.area],
            verdict: ESTADO_PRACTICA[p.verdict],
            certainty: CERTEZA_PRACTICA[p.certainty],
            cases: p.cases?.map((c) => ({ ...c, verdict: ESTADO_PRACTICA[c.verdict] })),
            changesSince: p.changesSince?.map((h) => ({ ...h, precision: PRECISION[h.precision], verdict: ESTADO_PRACTICA[h.verdict] })),
            sources: p.sources.map(({ measuredIn, ...s }) => (measuredIn !== undefined
                ? { measuredBy: "Jarroba Tools", details: `https://jarroba.com/tools/en/practices?q=${encodeURIComponent(p.practice)}`, date: s.date }
                : s)),
        })) };
}
