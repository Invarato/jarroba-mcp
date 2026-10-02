export type Gravedad = "critico" | "alto" | "aviso" | "info";
export type ReglaCabecera = "csp-ausente" | "csp-unsafe-inline" | "csp-unsafe-eval" | "csp-wildcard" | "csp-sin-object-src" | "csp-sin-base-uri" | "csp-sin-frame-ancestors" | "sin-nosniff" | "sin-hsts" | "hsts-corto" | "hsts-preload-invalido" | "sin-frame-options" | "xss-protection-obsoleto" | "sin-referrer-policy" | "cookie-sin-secure" | "cookie-sin-httponly" | "cookie-samesite-none-sin-secure" | "cookie-sin-samesite" | "servidor-expuesto" | "csp-solo-informe" | "csp-lista-hosts" | "csp-sin-form-action" | "cors-origen-null" | "cors-comodin-credenciales" | "cookie-prefijo-invalido" | "sin-coop" | "sin-permissions-policy";
export interface HallazgoCabecera {
    regla: ReglaCabecera;
    gravedad: Gravedad;
    fragmento: string;
    cookie?: string;
}
export interface AnalisisCabeceras {
    cabeceras: Record<string, string>;
    cookies: string[];
    https: boolean;
    hallazgos: HallazgoCabecera[];
    porGravedad: Record<Gravedad, number>;
}
const ORDEN: Record<Gravedad, number> = { critico: 0, alto: 1, aviso: 2, info: 3 };
function parsearCabeceras(texto: string, httpsOverride?: boolean): {
    cabeceras: Record<string, string>;
    cookies: string[];
    https: boolean;
} {
    const cabeceras: Record<string, string> = {};
    const cookies: string[] = [];
    let pistaHttps: boolean | null = null;
    for (const lineaCruda of texto.split("\n")) {
        const linea = lineaCruda.replace(/\r$/, "").trim();
        if (!linea)
            continue;
        const status = /^HTTP\/[\d.]+\s+(\d{3})/i.exec(linea);
        if (status)
            continue;
        if (/^curl\b/i.test(linea) || /^https?:\/\/\S+$/i.test(linea)) {
            const esquema = /^https?:/i.exec(linea) ?? /\bhttps?:\/\//i.exec(linea);
            if (esquema)
                pistaHttps = /^https:/i.test(esquema[0]);
        }
        const i = linea.indexOf(":");
        if (i < 0)
            continue;
        const nombre = linea.slice(0, i).trim().toLowerCase();
        const valor = linea.slice(i + 1).trim();
        if (!nombre)
            continue;
        if (nombre === "set-cookie") {
            cookies.push(valor);
            continue;
        }
        cabeceras[nombre] = valor;
        if (nombre === "location" && /^https?:/i.test(valor))
            pistaHttps = /^https:/i.test(valor);
    }
    if (cabeceras["strict-transport-security"])
        pistaHttps = true;
    const https = httpsOverride ?? pistaHttps ?? true;
    return { cabeceras, cookies, https };
}
function parsearCsp(csp: string): Map<string, string[]> {
    const directivas = new Map<string, string[]>();
    for (const parte of csp.split(";")) {
        const trozos = parte.trim().split(/\s+/).filter(Boolean);
        if (!trozos.length)
            continue;
        const [nombre, ...fuentes] = trozos;
        directivas.set(nombre.toLowerCase(), fuentes);
    }
    return directivas;
}
function fuentesEfectivas(directivas: Map<string, string[]>, directiva: string): string[] | null {
    if (directivas.has(directiva))
        return directivas.get(directiva)!;
    if (directiva !== "default-src" && directivas.has("default-src"))
        return directivas.get("default-src")!;
    return null;
}
function revisarCsp(csp: string, emitir: (h: HallazgoCabecera) => void): void {
    const directivas = parsearCsp(csp);
    const script = fuentesEfectivas(directivas, "script-src") ?? [];
    const evidenciaScript = `${directivas.has("script-src") ? "script-src" : "default-src"} ${script.join(" ")}`.trim();
    const conNonceOHash = script.some(f => /^'nonce-/.test(f) || /^'sha(256|384|512)-/.test(f));
    if (script.includes("'unsafe-inline'") && !conNonceOHash) {
        emitir({ regla: "csp-unsafe-inline", gravedad: "alto", fragmento: evidenciaScript });
    }
    if (script.includes("'unsafe-eval'")) {
        emitir({ regla: "csp-unsafe-eval", gravedad: "alto", fragmento: evidenciaScript });
    }
    if (script.includes("*")) {
        emitir({ regla: "csp-wildcard", gravedad: "alto", fragmento: evidenciaScript });
    }
    if (!directivas.has("object-src") && !(directivas.get("default-src") ?? []).includes("'none'")) {
        emitir({ regla: "csp-sin-object-src", gravedad: "aviso", fragmento: "" });
    }
    if (!directivas.has("base-uri")) {
        emitir({ regla: "csp-sin-base-uri", gravedad: "aviso", fragmento: "" });
    }
    if (!directivas.has("frame-ancestors")) {
        emitir({ regla: "csp-sin-frame-ancestors", gravedad: "aviso", fragmento: "" });
    }
    const hosts = script.filter(f => !f.startsWith("'") && f !== "*");
    if (hosts.length && !script.includes("'strict-dynamic'")) {
        emitir({ regla: "csp-lista-hosts", gravedad: "aviso", fragmento: evidenciaScript });
    }
    if (!directivas.has("form-action")) {
        emitir({ regla: "csp-sin-form-action", gravedad: "info", fragmento: "" });
    }
}
function revisarHsts(valor: string, emitir: (h: HallazgoCabecera) => void): void {
    const m = /max-age=(\d+)/i.exec(valor);
    const maxAge = m ? Number(m[1]) : 0;
    const conSubdominios = /includesubdomains/i.test(valor);
    const conPreload = /preload/i.test(valor);
    const SEIS_MESES = 15768000;
    const UN_ANO = 31536000;
    if (conPreload && (maxAge < UN_ANO || !conSubdominios)) {
        emitir({ regla: "hsts-preload-invalido", gravedad: "alto", fragmento: valor });
    }
    else if (maxAge < SEIS_MESES) {
        emitir({ regla: "hsts-corto", gravedad: "aviso", fragmento: valor });
    }
}
function revisarCookie(setCookie: string, https: boolean, emitir: (h: HallazgoCabecera) => void): void {
    const nombre = setCookie.split("=")[0]?.trim() || "(sin nombre)";
    const partes = setCookie.split(";").map(p => p.trim().toLowerCase());
    const conSecure = partes.some(p => p === "secure");
    const conHttpOnly = partes.some(p => p === "httponly");
    const sameSite = partes.find(p => p.startsWith("samesite="))?.split("=")[1];
    const esHost = nombre.startsWith("__Host-");
    if ((esHost || nombre.startsWith("__Secure-")) && (!conSecure
        || (esHost && (partes.some(p => p.startsWith("domain=")) || !partes.includes("path=/"))))) {
        emitir({ regla: "cookie-prefijo-invalido", gravedad: "aviso", fragmento: setCookie, cookie: nombre });
    }
    if (https && !conSecure)
        emitir({ regla: "cookie-sin-secure", gravedad: "alto", fragmento: setCookie, cookie: nombre });
    if (!conHttpOnly)
        emitir({ regla: "cookie-sin-httponly", gravedad: "aviso", fragmento: setCookie, cookie: nombre });
    if (sameSite === "none" && !conSecure)
        emitir({ regla: "cookie-samesite-none-sin-secure", gravedad: "alto", fragmento: setCookie, cookie: nombre });
    else if (!sameSite)
        emitir({ regla: "cookie-sin-samesite", gravedad: "aviso", fragmento: setCookie, cookie: nombre });
}
export function analizarCabeceras(texto: string, httpsOverride?: boolean): AnalisisCabeceras {
    const { cabeceras, cookies, https } = parsearCabeceras(texto, httpsOverride);
    const hallazgos: HallazgoCabecera[] = [];
    const emitir = (h: HallazgoCabecera) => hallazgos.push(h);
    const csp = cabeceras["content-security-policy"];
    const cspInforme = cabeceras["content-security-policy-report-only"];
    if (!csp && cspInforme)
        emitir({ regla: "csp-solo-informe", gravedad: "alto", fragmento: `Content-Security-Policy-Report-Only: ${cspInforme}` });
    else if (!csp)
        emitir({ regla: "csp-ausente", gravedad: "alto", fragmento: "" });
    else
        revisarCsp(csp, emitir);
    if (!cabeceras["x-content-type-options"])
        emitir({ regla: "sin-nosniff", gravedad: "alto", fragmento: "" });
    if (https) {
        const hsts = cabeceras["strict-transport-security"];
        if (!hsts)
            emitir({ regla: "sin-hsts", gravedad: "alto", fragmento: "" });
        else
            revisarHsts(hsts, emitir);
    }
    const conFrameAncestors = csp && parsearCsp(csp).has("frame-ancestors");
    if (!cabeceras["x-frame-options"] && !conFrameAncestors)
        emitir({ regla: "sin-frame-options", gravedad: "aviso", fragmento: "" });
    const xssProt = cabeceras["x-xss-protection"];
    if (xssProt && xssProt.trim() !== "0")
        emitir({ regla: "xss-protection-obsoleto", gravedad: "info", fragmento: `X-XSS-Protection: ${xssProt}` });
    if (!cabeceras["referrer-policy"])
        emitir({ regla: "sin-referrer-policy", gravedad: "info", fragmento: "" });
    if (!cabeceras["cross-origin-opener-policy"])
        emitir({ regla: "sin-coop", gravedad: "info", fragmento: "" });
    if (!cabeceras["permissions-policy"])
        emitir({ regla: "sin-permissions-policy", gravedad: "info", fragmento: "" });
    const acao = cabeceras["access-control-allow-origin"]?.trim();
    const acac = cabeceras["access-control-allow-credentials"]?.trim().toLowerCase() === "true";
    if (acao?.toLowerCase() === "null")
        emitir({ regla: "cors-origen-null", gravedad: "alto", fragmento: `Access-Control-Allow-Origin: ${acao}` });
    else if (acao === "*" && acac)
        emitir({ regla: "cors-comodin-credenciales", gravedad: "aviso", fragmento: "Access-Control-Allow-Origin: * \u00B7 Access-Control-Allow-Credentials: true" });
    for (const c of ["server", "x-powered-by"]) {
        if (cabeceras[c])
            emitir({ regla: "servidor-expuesto", gravedad: "info", fragmento: `${c}: ${cabeceras[c]}` });
    }
    for (const c of cookies)
        revisarCookie(c, https, emitir);
    hallazgos.sort((a, b) => ORDEN[a.gravedad] - ORDEN[b.gravedad]);
    const porGravedad: Record<Gravedad, number> = { critico: 0, alto: 0, aviso: 0, info: 0 };
    for (const h of hallazgos)
        porGravedad[h.gravedad]++;
    return { cabeceras, cookies, https, hallazgos, porGravedad };
}
