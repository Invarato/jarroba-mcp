export type Gravedad = "critico" | "alto" | "aviso" | "info";
export type ReglaCorreo = "spf-fallo" | "spf-blando" | "spf-permerror" | "spf-temperror" | "dkim-fallo" | "dkim-sin-from" | "dkim-algoritmo-debil" | "dkim-cuerpo-truncado" | "dmarc-fallo" | "reply-to-distinto" | "return-path-distinto" | "spf-multiple" | "spf-todo-permite" | "spf-todo-neutral" | "spf-sin-all" | "spf-demasiadas-consultas" | "spf-ptr-obsoleto" | "dmarc-formato-invalido" | "dmarc-sin-p" | "dmarc-p-none" | "dmarc-sin-rua" | "dmarc-pct-obsoleto" | "dmarc-etiqueta-obsoleta" | "dmarc-modo-pruebas" | "dmarc-sp-debil" | "dmarc-np-debil" | "dkim-clave-invalida" | "dkim-clave-debil" | "dkim-clave-revocada" | "dkim-modo-pruebas" | "dns-error" | "dns-sin-spf" | "dns-sin-dmarc" | "dns-sin-dkim" | "dns-sin-mta-sts" | "dns-sin-tls-rpt" | "spf-consultas-recursivas" | "spf-vacias" | "spf-include-roto" | "spf-bucle";
export interface HallazgoCorreo {
    regla: ReglaCorreo;
    gravedad: Gravedad;
    fragmento: string;
    datos?: Record<string, string>;
}
export interface ResultadoAutenticacion {
    spf?: string;
    dkim?: string;
    dmarc?: string;
}
export interface InfoCabeceras {
    from?: string;
    fromDominio?: string;
    replyTo?: string;
    replyToDominio?: string;
    returnPath?: string;
    returnPathDominio?: string;
    autenticacion: ResultadoAutenticacion[];
}
export interface AnalisisCorreo {
    cabeceras: InfoCabeceras | null;
    registrosDns: {
        tipo: "spf" | "dmarc" | "dkim";
        texto: string;
    }[];
    hallazgos: HallazgoCorreo[];
    porGravedad: Record<Gravedad, number>;
}
const ORDEN: Record<Gravedad, number> = { critico: 0, alto: 1, aviso: 2, info: 3 };
function desplegarCabeceras(texto: string): string[] {
    const crudas = (typeof texto === "string" ? texto : "").split(/\r\n|\r|\n/);
    const lineas: string[] = [];
    for (const l of crudas) {
        if (/^[ \t]/.test(l) && lineas.length)
            lineas[lineas.length - 1] += " " + l.trim();
        else
            lineas.push(l);
    }
    return lineas;
}
function todasLasCabeceras(lineas: string[], nombre: string): string[] {
    const re = new RegExp("^" + nombre.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*:\\s*(.*)$", "i");
    const out: string[] = [];
    for (const l of lineas) {
        const m = re.exec(l);
        if (m)
            out.push(m[1].trim());
    }
    return out;
}
function unaCabecera(lineas: string[], nombre: string): string | undefined {
    return todasLasCabeceras(lineas, nombre)[0];
}
function dominioDe(valor: string | undefined): string | undefined {
    if (!valor)
        return undefined;
    const m = /@([a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+)/i.exec(valor);
    return m ? m[1].toLowerCase() : undefined;
}
const SUFIJOS_DOS_NIVELES = new Set([
    "co.uk",
    "org.uk",
    "gov.uk",
    "ac.uk",
    "me.uk",
    "ltd.uk",
    "plc.uk",
    "com.au",
    "net.au",
    "org.au",
    "com.br",
    "com.mx",
    "co.in",
    "co.jp",
    "co.nz",
    "co.za",
    "com.cn",
    "com.hk",
    "com.sg",
    "com.tw",
]);
function dominioOrganizativo(dominio: string): string {
    const etiquetas = dominio.toLowerCase().split(".");
    if (etiquetas.length <= 2)
        return dominio.toLowerCase();
    const ultimasDos = etiquetas.slice(-2).join(".");
    const n = SUFIJOS_DOS_NIVELES.has(ultimasDos) ? 3 : 2;
    return etiquetas.slice(-n).join(".");
}
function tagValores(texto: string): Record<string, string> {
    const out: Record<string, string> = {};
    for (const trozo of texto.split(";")) {
        const i = trozo.indexOf("=");
        if (i < 0)
            continue;
        const clave = trozo.slice(0, i).trim().toLowerCase();
        if (clave)
            out[clave] = trozo.slice(i + 1).trim();
    }
    return out;
}
function resultadosAuth(valor: string): ResultadoAutenticacion {
    const de = (metodo: string) => new RegExp("\\b" + metodo + "\\s*=\\s*(\\w+)", "i").exec(valor)?.[1]?.toLowerCase();
    return { spf: de("spf"), dkim: de("dkim"), dmarc: de("dmarc") };
}
function pareceCabeceras(lineas: string[]): boolean {
    return lineas.some(l => /^(from|authentication-results|dkim-signature|received-spf|return-path|reply-to)\s*:/i.test(l));
}
function leerCabeceras(lineas: string[]): InfoCabeceras {
    const from = unaCabecera(lineas, "From");
    const replyTo = unaCabecera(lineas, "Reply-To");
    const returnPath = unaCabecera(lineas, "Return-Path");
    return {
        from,
        fromDominio: dominioDe(from),
        replyTo,
        replyToDominio: dominioDe(replyTo),
        returnPath,
        returnPathDominio: dominioDe(returnPath),
        autenticacion: todasLasCabeceras(lineas, "Authentication-Results").map(resultadosAuth),
    };
}
function auditarCabeceras(lineas: string[], info: InfoCabeceras, emitir: (h: HallazgoCorreo) => void): void {
    for (const a of info.autenticacion) {
        if (a.spf === "fail")
            emitir({ regla: "spf-fallo", gravedad: "alto", fragmento: "spf=fail", datos: { spf: a.spf } });
        else if (a.spf === "softfail")
            emitir({ regla: "spf-blando", gravedad: "aviso", fragmento: "spf=softfail", datos: { spf: a.spf } });
        else if (a.spf === "permerror")
            emitir({ regla: "spf-permerror", gravedad: "alto", fragmento: "spf=permerror", datos: { spf: a.spf } });
        else if (a.spf === "temperror")
            emitir({ regla: "spf-temperror", gravedad: "aviso", fragmento: "spf=temperror", datos: { spf: a.spf } });
        if (a.dkim === "fail")
            emitir({ regla: "dkim-fallo", gravedad: "alto", fragmento: "dkim=fail", datos: { dkim: a.dkim } });
        if (a.dmarc === "fail")
            emitir({ regla: "dmarc-fallo", gravedad: "critico", fragmento: "dmarc=fail", datos: { dmarc: a.dmarc } });
    }
    for (const firma of todasLasCabeceras(lineas, "DKIM-Signature")) {
        const t = tagValores(firma);
        const h = (t["h"] ?? "").toLowerCase().split(":").map(s => s.trim());
        if (t["h"] !== undefined && !h.includes("from")) {
            emitir({ regla: "dkim-sin-from", gravedad: "critico", fragmento: `h=${t["h"]}`, datos: { h: t["h"] } });
        }
        if (t["a"] && /sha1$/i.test(t["a"])) {
            emitir({ regla: "dkim-algoritmo-debil", gravedad: "alto", fragmento: `a=${t["a"]}`, datos: { algoritmo: t["a"] } });
        }
        if (t["l"] !== undefined) {
            emitir({ regla: "dkim-cuerpo-truncado", gravedad: "alto", fragmento: `l=${t["l"]}`, datos: { l: t["l"] } });
        }
    }
    if (info.fromDominio && info.replyToDominio && dominioOrganizativo(info.fromDominio) !== dominioOrganizativo(info.replyToDominio)) {
        emitir({
            regla: "reply-to-distinto",
            gravedad: "aviso",
            fragmento: `De: ${info.fromDominio} · Responder a: ${info.replyToDominio}`,
            datos: { from: info.fromDominio, replyTo: info.replyToDominio },
        });
    }
    if (info.fromDominio && info.returnPathDominio && dominioOrganizativo(info.fromDominio) !== dominioOrganizativo(info.returnPathDominio)) {
        emitir({
            regla: "return-path-distinto",
            gravedad: "info",
            fragmento: `De: ${info.fromDominio} · Return-Path: ${info.returnPathDominio}`,
            datos: { from: info.fromDominio, returnPath: info.returnPathDominio },
        });
    }
}
function valorTxt(linea: string): string {
    const trozos = [...linea.matchAll(/"([^"]*)"/g)].map(m => m[1]);
    return trozos.length ? trozos.join("") : linea.trim();
}
function extraerRegistrosSpfDmarc(lineas: string[]): {
    tipo: "spf" | "dmarc";
    texto: string;
}[] {
    const out: {
        tipo: "spf" | "dmarc";
        texto: string;
    }[] = [];
    for (const l of lineas) {
        const v = valorTxt(l).trim();
        if (/^v=spf1\b/i.test(v))
            out.push({ tipo: "spf", texto: v });
        else if (/\bv\s*=\s*DMARC1\b/i.test(v))
            out.push({ tipo: "dmarc", texto: v });
    }
    return out;
}
function extraerRegistroDkim(textoOriginal: string): string | null {
    const sinComillas = textoOriginal.replace(/"/g, "");
    const m = /v=DKIM1[\s\S]*?(?=\n[ \t]*\n|$)/i.exec(sinComillas);
    if (!m)
        return null;
    return m[0].split(/\r\n|\r|\n/).map(l => l.trim()).join("");
}
function auditarSpf(texto: string, emitir: (h: HallazgoCorreo) => void): void {
    const mecanismos = texto.trim().split(/\s+/).slice(1);
    const CUENTAN = /^[+\-~?]?(?:(?:include|exists):|(?:a|mx|ptr)(?::|\/|$))/i;
    const consultas = mecanismos.filter(m => CUENTAN.test(m) || /^redirect=/i.test(m)).length;
    if (consultas >= 10) {
        emitir({ regla: "spf-demasiadas-consultas", gravedad: "alto", fragmento: texto.trim(), datos: { consultas: String(consultas) } });
    }
    if (mecanismos.some(m => /^ptr(:|$)/i.test(m.replace(/^[+\-~?]/, "")))) {
        emitir({ regla: "spf-ptr-obsoleto", gravedad: "aviso", fragmento: mecanismos.find(m => /^ptr(:|$)/i.test(m.replace(/^[+\-~?]/, ""))) ?? "ptr" });
    }
    const ultimo = mecanismos[mecanismos.length - 1] ?? "";
    if (/^all$/i.test(ultimo) || /^\+all$/i.test(ultimo)) {
        emitir({ regla: "spf-todo-permite", gravedad: "critico", fragmento: ultimo });
    }
    else if (/^\?all$/i.test(ultimo)) {
        emitir({ regla: "spf-todo-neutral", gravedad: "aviso", fragmento: ultimo });
    }
    else if (!/all$/i.test(ultimo)) {
        emitir({ regla: "spf-sin-all", gravedad: "aviso", fragmento: texto });
    }
}
const FUERZA_DMARC: Record<string, number> = { none: 0, quarantine: 1, reject: 2 };
function auditarDmarc(texto: string, emitir: (h: HallazgoCorreo) => void): void {
    const t = tagValores(texto);
    if (!/^\s*v\s*=\s*DMARC1\b/i.test(texto)) {
        emitir({ regla: "dmarc-formato-invalido", gravedad: "alto", fragmento: texto, datos: { motivo: "v-not-first" } });
        return;
    }
    const p = (t["p"] ?? "").toLowerCase();
    if (!t["p"])
        emitir({ regla: "dmarc-sin-p", gravedad: "aviso", fragmento: "" });
    else if (p === "none")
        emitir({ regla: "dmarc-p-none", gravedad: "aviso", fragmento: "p=none" });
    const fuerza = FUERZA_DMARC[p] ?? 0;
    if (!t["rua"])
        emitir({ regla: "dmarc-sin-rua", gravedad: "aviso", fragmento: "" });
    if (t["pct"] !== undefined) {
        const pct = Number(t["pct"]);
        if (Number.isFinite(pct) && pct < 100 && fuerza > 0) {
            emitir({ regla: "dmarc-pct-obsoleto", gravedad: "aviso", fragmento: `pct=${t["pct"]}`, datos: { pct: t["pct"] } });
        }
        else {
            emitir({ regla: "dmarc-etiqueta-obsoleta", gravedad: "info", fragmento: `pct=${t["pct"]}`, datos: { etiqueta: "pct" } });
        }
    }
    for (const e of ["rf", "ri"]) {
        if (t[e] !== undefined)
            emitir({ regla: "dmarc-etiqueta-obsoleta", gravedad: "info", fragmento: `${e}=${t[e]}`, datos: { etiqueta: e } });
    }
    if (/^y$/i.test(t["t"] ?? "") && fuerza > 0) {
        emitir({ regla: "dmarc-modo-pruebas", gravedad: "aviso", fragmento: `t=${t["t"]}`, datos: { p } });
    }
    const sp = (t["sp"] ?? "").toLowerCase();
    if (sp in FUERZA_DMARC && FUERZA_DMARC[sp] < fuerza) {
        emitir({ regla: "dmarc-sp-debil", gravedad: "aviso", fragmento: `sp=${t["sp"]}`, datos: { p } });
    }
    const np = (t["np"] ?? "").toLowerCase();
    if (np in FUERZA_DMARC && FUERZA_DMARC[np] < fuerza) {
        emitir({ regla: "dmarc-np-debil", gravedad: "aviso", fragmento: `np=${t["np"]}`, datos: { p } });
    }
}
async function auditarDkim(texto: string, emitir: (h: HallazgoCorreo) => void): Promise<void> {
    const t = tagValores(texto);
    if (t["t"] && /\by\b/i.test(t["t"])) {
        emitir({ regla: "dkim-modo-pruebas", gravedad: "aviso", fragmento: "t=" + t["t"] });
    }
    if (t["p"] !== undefined && t["p"].trim() === "") {
        emitir({ regla: "dkim-clave-revocada", gravedad: "critico", fragmento: "p=" });
        return;
    }
    const tipoClave = (t["k"] ?? "rsa").toLowerCase();
    if (tipoClave !== "rsa" || !t["p"])
        return;
    let bytes: Uint8Array;
    try {
        bytes = Uint8Array.from(atob(t["p"].replace(/\s+/g, "")), c => c.charCodeAt(0));
    }
    catch {
        return;
    }
    try {
        const clave = await crypto.subtle.importKey("spki", bytes as BufferSource, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, true, ["verify"]);
        const bits = (clave.algorithm as RsaKeyAlgorithm).modulusLength;
        if (bits < 1024) {
            emitir({ regla: "dkim-clave-invalida", gravedad: "critico", fragmento: `${bits} bits`, datos: { bits: String(bits) } });
        }
        else if (bits < 2048) {
            emitir({ regla: "dkim-clave-debil", gravedad: "alto", fragmento: `${bits} bits`, datos: { bits: String(bits) } });
        }
    }
    catch { }
}
export async function analizarCorreo(entrada: string, extra: readonly HallazgoCorreo[] = []): Promise<AnalisisCorreo | null> {
    const texto = typeof entrada === "string" ? entrada : "";
    if (!texto.trim() && !extra.length)
        return null;
    const lineas = desplegarCabeceras(texto);
    const hayCabeceras = pareceCabeceras(lineas);
    const registrosSpfDmarc = extraerRegistrosSpfDmarc(lineas);
    const registroDkimTexto = extraerRegistroDkim(texto);
    if (!hayCabeceras && !registrosSpfDmarc.length && !registroDkimTexto && !extra.length)
        return null;
    const hallazgos: HallazgoCorreo[] = [...extra];
    const emitir = (h: HallazgoCorreo) => hallazgos.push(h);
    const cabeceras = hayCabeceras ? leerCabeceras(lineas) : null;
    if (cabeceras)
        auditarCabeceras(lineas, cabeceras, emitir);
    for (const r of registrosSpfDmarc) {
        if (r.tipo === "spf")
            auditarSpf(r.texto, emitir);
        else
            auditarDmarc(r.texto, emitir);
    }
    const registrosSpf = registrosSpfDmarc.filter(r => r.tipo === "spf");
    if (registrosSpf.length > 1) {
        emitir({ regla: "spf-multiple", gravedad: "alto", fragmento: registrosSpf.map(r => r.texto.trim()).join("\n"), datos: { n: String(registrosSpf.length) } });
    }
    if (registroDkimTexto)
        await auditarDkim(registroDkimTexto, emitir);
    hallazgos.sort((a, b) => ORDEN[a.gravedad] - ORDEN[b.gravedad]);
    const porGravedad: Record<Gravedad, number> = { critico: 0, alto: 0, aviso: 0, info: 0 };
    for (const h of hallazgos)
        porGravedad[h.gravedad]++;
    const registrosDns: AnalisisCorreo["registrosDns"] = [
        ...registrosSpfDmarc,
        ...(registroDkimTexto ? [{ tipo: "dkim" as const, texto: registroDkimTexto }] : []),
    ];
    return { cabeceras, registrosDns, hallazgos, porGravedad };
}
