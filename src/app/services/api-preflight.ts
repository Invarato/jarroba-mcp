import { ApiCampo } from "./api-ir";
export const SEGURAS = [
    "cache-control",
    "content-language",
    "content-length",
    "content-type",
    "expires",
    "last-modified",
    "pragma",
];
const METODOS_SIMPLES = ["GET", "HEAD", "POST"];
const CT_SIMPLES = ["application/x-www-form-urlencoded", "multipart/form-data", "text/plain"];
const CABECERAS_SIMPLES = ["accept", "accept-language", "content-language", "content-type", "range"];
export interface MotivoPreflight {
    cabecera?: string;
    metodo?: string;
    contentType?: string;
    porValor?: string;
}
const BYTES_NO_SEGUROS = /[\u0000-\u0008\u000A-\u001F"()<>?@[\\\]{}:\u007F]/;
const SOLO_IDIOMA = /^[0-9A-Za-z *,\-.;=]*$/;
const MAX_VALOR_SIMPLE = 128;
const RANGO_SIMPLE = /^bytes=(?:\d+-\d*|-\d+)$/;
export function valorSacaDeSimple(nombre: string, valor: string): string | null {
    const n = nombre.trim().toLowerCase();
    if (valor.length > MAX_VALOR_SIMPLE) {
        return `su valor mide ${valor.length} bytes y el máximo para seguir siendo simple es ${MAX_VALOR_SIMPLE}`;
    }
    if (n === "accept-language" || n === "content-language") {
        if (!SOLO_IDIOMA.test(valor)) {
            return "lleva caracteres que no admite una cabecera de idioma (solo letras, cifras y \u00AB *,-.;= \u00BB)";
        }
        return null;
    }
    if (n === "range") {
        return RANGO_SIMPLE.test(valor.trim())
            ? null
            : "solo la forma \u00ABbytes=inicio-fin\u00BB es simple; cualquier otra obliga a preflight";
    }
    if (BYTES_NO_SEGUROS.test(valor)) {
        return "su valor lleva alg\u00FAn car\u00E1cter de los que la especificaci\u00F3n proh\u00EDbe en una cabecera simple";
    }
    return null;
}
export function hayQueDeclarar(nombre: string, valor: string): boolean {
    const n = nombre.trim().toLowerCase();
    if (!CABECERAS_SIMPLES.includes(n))
        return true;
    if (n === "content-type") {
        const tipo = valor.split(";")[0].trim().toLowerCase();
        if (!CT_SIMPLES.includes(tipo))
            return true;
    }
    return valorSacaDeSimple(n, valor) !== null;
}
export function necesitaPreflight(metodo: string, cabeceras: ApiCampo[]): MotivoPreflight | null {
    const m = (metodo || "GET").toUpperCase();
    if (!METODOS_SIMPLES.includes(m))
        return { metodo: m };
    for (const h of cabeceras) {
        if (!h.activo)
            continue;
        const n = h.nombre.trim().toLowerCase();
        if (n === "content-type") {
            const tipo = h.valor.split(";")[0].trim().toLowerCase();
            if (!CT_SIMPLES.includes(tipo))
                return { contentType: tipo || "(vac\u00EDo)" };
            const malCT = valorSacaDeSimple(n, h.valor);
            if (malCT)
                return { cabecera: h.nombre, porValor: malCT };
            continue;
        }
        if (!CABECERAS_SIMPLES.includes(n))
            return { cabecera: h.nombre };
        const malValor = valorSacaDeSimple(n, h.valor);
        if (malValor)
            return { cabecera: h.nombre, porValor: malValor };
    }
    return null;
}
