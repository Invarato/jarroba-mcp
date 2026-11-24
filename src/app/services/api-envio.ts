import { ApiCampo } from "./api-ir";
export { SEGURAS, necesitaPreflight } from "./api-preflight";
export type { MotivoPreflight } from "./api-preflight";
import { SEGURAS, necesitaPreflight } from "./api-preflight";
export type Veredicto = "ok" | "cors" | "inalcanzable" | "cancelada";
export interface Respuesta {
    veredicto: Veredicto;
    estado?: number;
    textoEstado?: string;
    cabeceras: ApiCampo[];
    cuerpo?: string;
    ms: number;
    diagnostico: Diagnostico;
}
export type CasoDiagnostico = "ok-con-expuestas" | "ok-sin-expuestas" | "plazo" | "cors" | "inalcanzable";
export interface Diagnostico {
    caso: CasoDiagnostico;
    datos: Record<string, string | number>;
    medido: boolean;
}
export interface OpcionesEnvio {
    metodo: string;
    url: string;
    cabeceras: ApiCampo[];
    cuerpo?: string | null;
    plazoMs?: number;
    fetchImpl?: typeof fetch;
}
export async function enviar(op: OpcionesEnvio): Promise<Respuesta> {
    const f: typeof fetch = op.fetchImpl ?? ((entrada, init) => fetch(entrada, init));
    const plazo = op.plazoMs ?? 30000;
    const cabeceras = cabecerasParaFetch(op.cabeceras);
    const t0 = ahora();
    const ctrl = new AbortController();
    const reloj = setTimeout(() => ctrl.abort(), plazo);
    try {
        const res = await f(op.url, {
            method: op.metodo || "GET",
            headers: cabeceras,
            body: cuerpoValido(op.metodo, op.cuerpo),
            signal: ctrl.signal,
            mode: "cors",
            redirect: "follow",
        });
        clearTimeout(reloj);
        const leidas: ApiCampo[] = [];
        res.headers.forEach((v, k) => leidas.push({ nombre: k, valor: v, activo: true }));
        return {
            veredicto: "ok",
            estado: res.status,
            textoEstado: res.statusText,
            cabeceras: leidas.sort((a, b) => a.nombre.localeCompare(b.nombre)),
            cuerpo: await res.text().catch(() => ""),
            ms: Math.round(ahora() - t0),
            diagnostico: diagnosticoOk(res.status, leidas),
        };
    }
    catch (e) {
        clearTimeout(reloj);
        const ms = Math.round(ahora() - t0);
        if (ctrl.signal.aborted) {
            return {
                veredicto: "cancelada",
                cabeceras: [],
                ms,
                diagnostico: { caso: "plazo", datos: { s: Math.round(plazo / 1000) }, medido: true },
            };
        }
        const vivo = await sondaNoCors(f, op.url, plazo);
        return {
            veredicto: vivo ? "cors" : "inalcanzable",
            cabeceras: [],
            ms,
            diagnostico: vivo ? diagnosticoCors(op) : diagnosticoInalcanzable(op, e),
        };
    }
}
async function sondaNoCors(f: typeof fetch, url: string, plazo: number): Promise<boolean> {
    const ctrl = new AbortController();
    const reloj = setTimeout(() => ctrl.abort(), Math.min(plazo, 10000));
    try {
        await f(url, { method: "GET", mode: "no-cors", signal: ctrl.signal, redirect: "follow" });
        return true;
    }
    catch {
        return false;
    }
    finally {
        clearTimeout(reloj);
    }
}
function diagnosticoOk(estado: number, leidas: ApiCampo[]): Diagnostico {
    const expuestas = leidas.filter(h => !SEGURAS.includes(h.nombre.toLowerCase()));
    return { caso: expuestas.length ? "ok-con-expuestas" : "ok-sin-expuestas", datos: { estado, n: expuestas.length }, medido: true };
}
function diagnosticoCors(op: OpcionesEnvio): Diagnostico {
    const pre = necesitaPreflight(op.metodo, op.cabeceras);
    const datos: Diagnostico["datos"] = pre?.metodo ? { motivo: "metodo", valor: pre.metodo }
        : pre?.cabecera ? { motivo: "cabecera", valor: pre.cabecera }
            : pre?.contentType ? { motivo: "content-type", valor: pre.contentType }
                : {};
    return { caso: "cors", datos, medido: true };
}
function diagnosticoInalcanzable(op: OpcionesEnvio, _e: unknown): Diagnostico {
    const host = hostDe(op.url);
    const local = !!host && /^(localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0)(:|$)/.test(host);
    return { caso: "inalcanzable", datos: { host: host ?? "", local: local ? 1 : 0 }, medido: true };
}
export function cabecerasParaFetch(cs: ApiCampo[]): Record<string, string> {
    const prohibidas = new Set([
        "host",
        "connection",
        "content-length",
        "origin",
        "referer",
        "cookie",
        "date",
        "expect",
        "keep-alive",
        "te",
        "trailer",
        "transfer-encoding",
        "upgrade",
        "via",
        "user-agent",
        "accept-encoding",
        "accept-charset",
        "access-control-request-headers",
        "access-control-request-method",
        "dnt",
        "permissions-policy",
    ]);
    const out: Record<string, string> = {};
    for (const h of cs) {
        if (!h.activo || !h.nombre.trim())
            continue;
        if (prohibidas.has(h.nombre.trim().toLowerCase()))
            continue;
        out[h.nombre.trim()] = h.valor;
    }
    return out;
}
export function cabecerasDescartadas(cs: ApiCampo[]): string[] {
    const admitidas = new Set(Object.keys(cabecerasParaFetch(cs)).map(n => n.toLowerCase()));
    return cs
        .filter(h => h.activo && h.nombre.trim() && !admitidas.has(h.nombre.trim().toLowerCase()))
        .map(h => h.nombre.trim());
}
function cuerpoValido(metodo: string, cuerpo: string | null | undefined): string | undefined {
    const m = (metodo || "GET").toUpperCase();
    if (m === "GET" || m === "HEAD")
        return undefined;
    return cuerpo ? cuerpo : undefined;
}
function hostDe(url: string): string | null {
    try {
        return new URL(url).host || null;
    }
    catch {
        return null;
    }
}
function ahora(): number {
    return typeof performance !== "undefined" ? performance.now() : Date.now();
}
