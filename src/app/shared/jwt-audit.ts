import { FormatoSecreto, JwtAlg, bytesDeSecreto, isSymmetric } from "./jwt-crypto";
export type AvisoJwt = "confusion-clave-publica" | "secreto-corto" | "alg-distinto" | "familia-distinta" | "sin-exp" | "exp-no-numerico" | "nbf-no-numerico" | "alg-mayusculas" | "typ-no-at-jwt" | "kid-inyeccion" | "clave-remota" | "formato-ilegal";
export type EstadoTemporal = "ok" | "caducado" | "aun-no" | "no-numerico" | null;
export function bytesMinimosHmac(alg: JwtAlg): number {
    return Number(alg.slice(2)) / 8;
}
const esJwkAsimetrico = (x: unknown): boolean => {
    const k = (x as Record<string, unknown> | null)?.["kty"];
    return k === "RSA" || k === "EC" || k === "OKP";
};
const OIDS = [
    [42, 134, 72, 134, 247, 13, 1, 1, 1],
    [42, 134, 72, 206, 61, 2, 1],
    [43, 101, 112],
];
function pareceDer(bytes: Uint8Array): boolean {
    if (bytes.length < 16 || bytes[0] !== 48 || bytes[1] !== 130)
        return false;
    return OIDS.some(oid => {
        for (let i = 0; i + oid.length <= bytes.length; i++) {
            let casan = true;
            for (let j = 0; j < oid.length; j++)
                if (bytes[i + j] !== oid[j]) {
                    casan = false;
                    break;
                }
            if (casan)
                return true;
        }
        return false;
    });
}
export function pareceClaveAsimetrica(texto: string): boolean {
    const t = texto.trim();
    if (/-----BEGIN [A-Z ]*(PUBLIC KEY|CERTIFICATE|PRIVATE KEY)-----/.test(t))
        return true;
    if (/^(ssh-rsa|ssh-ed25519|ssh-dss|ecdsa-sha2-)\S*\s/.test(t))
        return true;
    if (t.startsWith("{") || t.startsWith("[")) {
        try {
            const j = JSON.parse(t) as Record<string, unknown> | unknown[];
            if (Array.isArray(j))
                return j.some(esJwkAsimetrico);
            if (typeof j !== "object" || j === null)
                return false;
            return esJwkAsimetrico(j) || Array.isArray(j["keys"]);
        }
        catch {
            return false;
        }
    }
    if (/^[A-Za-z0-9+/=\s]+$/.test(t) && t.replace(/\s/g, "").length >= 40) {
        try {
            const bin = atob(t.replace(/\s/g, ""));
            const bytes = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++)
                bytes[i] = bin.charCodeAt(i);
            if (pareceDer(bytes))
                return true;
        }
        catch { }
    }
    return false;
}
export function estadoTemporal(clave: string, valor: unknown, ahoraSeg: number): EstadoTemporal {
    if (clave !== "exp" && clave !== "nbf")
        return null;
    if (typeof valor !== "number" || !Number.isFinite(valor))
        return "no-numerico";
    if (clave === "exp")
        return ahoraSeg < valor ? "ok" : "caducado";
    return ahoraSeg >= valor ? "ok" : "aun-no";
}
export interface EntradaAuditoria {
    headerAlg: string;
    algElegido: JwtAlg;
    claveTexto: string;
    formatoSecreto: FormatoSecreto;
    payload: Record<string, unknown>;
    header?: Record<string, unknown>;
    token?: string;
}
const KID_INYECCION = /\.\.[\/\\]|['"`;]|--|\|\||\$\(|\u0000/;
export function avisosJwt(e: EntradaAuditoria): AvisoJwt[] {
    const out: AvisoJwt[] = [];
    const hsElegido = isSymmetric(e.algElegido);
    if (e.headerAlg && e.headerAlg !== e.algElegido) {
        out.push(e.headerAlg.toUpperCase() === e.algElegido.toUpperCase() ? "alg-mayusculas" : "alg-distinto");
    }
    if (e.headerAlg && /^(HS|RS|PS|ES)/.test(e.headerAlg) && e.headerAlg.startsWith("HS") !== hsElegido) {
        out.push("familia-distinta");
    }
    if (hsElegido) {
        if (pareceClaveAsimetrica(e.claveTexto))
            out.push("confusion-clave-publica");
        else {
            const b = bytesDeSecreto(e.claveTexto, e.formatoSecreto);
            if (b && b.length < bytesMinimosHmac(e.algElegido))
                out.push("secreto-corto");
        }
    }
    if (!("exp" in e.payload))
        out.push("sin-exp");
    else if (estadoTemporal("exp", e.payload["exp"], 0) === "no-numerico")
        out.push("exp-no-numerico");
    if ("nbf" in e.payload && estadoTemporal("nbf", e.payload["nbf"], 0) === "no-numerico")
        out.push("nbf-no-numerico");
    const h = e.header;
    if (h) {
        const pareceAccessToken = "client_id" in e.payload || "scope" in e.payload || "scp" in e.payload;
        const typ = String(h["typ"] ?? "").toLowerCase().replace(/^application\//, "");
        if (pareceAccessToken && typ !== "at+jwt")
            out.push("typ-no-at-jwt");
        if (typeof h["kid"] === "string" && KID_INYECCION.test(h["kid"]))
            out.push("kid-inyeccion");
        if (["jku", "x5u", "jwk"].some(k => k in h))
            out.push("clave-remota");
    }
    if (e.token !== undefined && !/^[A-Za-z0-9_\-.]*$/.test(e.token))
        out.push("formato-ilegal");
    return out;
}
export type Veredicto = "valido" | "firma-valida-con-problemas" | "invalido";
export function veredictoJwt(firmaValida: boolean, avisos: AvisoJwt[], temporales: EstadoTemporal[]): Veredicto {
    if (!firmaValida)
        return "invalido";
    const temporalMal = temporales.some(t => t === "caducado" || t === "aun-no" || t === "no-numerico");
    return temporalMal || avisos.length > 0 ? "firma-valida-con-problemas" : "valido";
}
export function esAvisoGrave(a: AvisoJwt): boolean {
    return a === "confusion-clave-publica" || a === "familia-distinta" || a === "secreto-corto"
        || a === "alg-mayusculas" || a === "kid-inyeccion";
}
