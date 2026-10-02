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
export interface Diagnostico {
    titulo: string;
    detalle: string;
    arreglo?: string;
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
                diagnostico: {
                    titulo: "Sin respuesta a tiempo",
                    detalle: `Se esperó ${Math.round(plazo / 1000)} s y el servidor no contestó.`,
                    arreglo: "Comprueba que la direcci\u00F3n es correcta y que el servicio responde.",
                    medido: true,
                },
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
    const detalle = expuestas.length
        ? `El servidor expuso ${expuestas.length} cabecera(s) además de las que el navegador deja leer siempre.`
        : "Solo se ven las cabeceras que el navegador deja leer siempre. Si esperabas otras, al servidor le falta \u00ABAccess-Control-Expose-Headers\u00BB.";
    return {
        titulo: `Respondió ${estado}`,
        detalle,
        medido: true,
        arreglo: expuestas.length ? undefined
            : "A\u00F1ade \u00ABAccess-Control-Expose-Headers: <las tuyas>\u00BB en el servidor para poder leerlas desde el navegador.",
    };
}
function diagnosticoCors(op: OpcionesEnvio): Diagnostico {
    const pre = necesitaPreflight(op.metodo, op.cabeceras);
    const porQue = pre?.metodo ? `el método ${pre.metodo}`
        : pre?.cabecera ? `la cabecera «${pre.cabecera}»`
            : pre?.contentType ? `el Content-Type «${pre.contentType}»`
                : "";
    return {
        titulo: "El servidor contest\u00F3, pero el navegador te tap\u00F3 la respuesta",
        detalle: "La petici\u00F3n LLEG\u00D3 y hubo respuesta: se ha comprobado con una segunda petici\u00F3n opaca, que s\u00ED " +
            "se complet\u00F3. Lo que fall\u00F3 es la pol\u00EDtica del mismo origen: sin las cabeceras CORS correctas, " +
            "el navegador no te deja leer lo que vino."
            + (pre ? ` Además, esta petición obliga a un preflight OPTIONS por ${porQue}: el servidor tiene que contestar también a ese OPTIONS.` : ""),
        arreglo: "En el servidor: \u00ABAccess-Control-Allow-Origin\u00BB con tu origen (o \u00AB*\u00BB)"
            + (pre ? ", y que el OPTIONS responda con \u00ABAccess-Control-Allow-Methods\u00BB y \u00ABAccess-Control-Allow-Headers\u00BB" : "")
            + ". Esto es una restricci\u00F3n del navegador, no un fallo de tu API: desde curl la misma petici\u00F3n funciona.",
        medido: true,
    };
}
function diagnosticoInalcanzable(op: OpcionesEnvio, e: unknown): Diagnostico {
    const host = hostDe(op.url);
    const local = !!host && /^(localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0)(:|$)/.test(host);
    return {
        titulo: "No se lleg\u00F3 al servidor",
        detalle: "Ni siquiera una petici\u00F3n opaca se complet\u00F3, as\u00ED que el problema es anterior a CORS: "
            + "el nombre no resuelve, el puerto no responde, el certificado no vale o no hay red."
            + (local
                ? " Y va a \u00AB" + host + "\u00BB: desde una p\u00E1gina web, el navegador restringe las peticiones a la red local "
                    + "y puede pedir permiso o bloquearlas directamente. Para probar tu API local, un cliente de escritorio o curl."
                : ""),
        arreglo: local
            ? undefined
            : `Comprueba el nombre y el puerto, y que «${host ?? "ese destino"}» responde desde fuera.`,
        medido: true,
    };
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
