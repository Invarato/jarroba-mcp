export type ExchangeType = "direct" | "topic" | "fanout" | "headers";
export type HeaderValue = string | number | boolean | null;
export interface RabbitBinding {
    queue: string;
    bindingKey?: string;
    arguments?: Record<string, HeaderValue>;
}
export interface RabbitRouteInput {
    type: ExchangeType;
    bindings: RabbitBinding[];
    routingKey?: string;
    headers?: Record<string, HeaderValue>;
}
export type RazonBinding = {
    tipo: "fanout";
} | {
    tipo: "direct";
    casa: boolean;
} | {
    tipo: "topic";
    casa: boolean;
    palabrasClave: string[];
    palabrasPatron: string[];
} | {
    tipo: "headers";
    casa: boolean;
    xMatch: XMatch;
    condiciones: CondicionHeader[];
};
export type XMatch = "all" | "any" | "all-with-x" | "any-with-x";
export interface CondicionHeader {
    clave: string;
    modo: "presencia" | "igual";
    resultado: "casa" | "falla" | "ignorada";
}
export interface VeredictoBinding {
    indice: number;
    queue: string;
    casa: boolean;
    razon: RazonBinding;
}
export type RabbitRouteResult = {
    ok: true;
    queues: string[];
    matched: number[];
    unroutable: boolean;
    bindings: VeredictoBinding[];
} | {
    ok: false;
    error: RabbitRouteError;
};
export type RabbitRouteError = {
    codigo: "tipo-desconocido";
    valor: string;
} | {
    codigo: "x-match-invalido";
    binding: number;
    valor: unknown;
} | {
    codigo: "clave-larga";
    donde: "routingKey" | "bindingKey";
    binding?: number;
    bytes: number;
} | {
    codigo: "demasiados-bindings";
    maximo: number;
} | {
    codigo: "cola-vacia";
    binding: number;
};
export const MAX_BYTES_CLAVE = 255;
export const MAX_BINDINGS = 10000;
const X_MATCH_VALIDOS: readonly XMatch[] = ["all", "any", "all-with-x", "any-with-x"];
const TIPOS: readonly ExchangeType[] = ["direct", "topic", "fanout", "headers"];
const utf8 = new TextEncoder();
export function palabrasTopic(clave: string): string[] {
    return clave === "" ? [] : clave.split(".");
}
export function casaTopic(patron: string[], palabras: string[]): boolean {
    const n = patron.length, m = palabras.length;
    let siguiente = new Array<boolean>(m + 1).fill(false);
    siguiente[m] = true;
    for (let i = n - 1; i >= 0; i--) {
        const actual = new Array<boolean>(m + 1).fill(false);
        const p = patron[i];
        for (let j = m; j >= 0; j--) {
            if (p === "#") {
                actual[j] = siguiente[j] || (j < m && actual[j + 1]);
            }
            else if (j < m && (p === "*" || p === palabras[j])) {
                actual[j] = siguiente[j + 1];
            }
        }
        siguiente = actual;
    }
    return siguiente[0];
}
function evaluaHeaders(args: Record<string, HeaderValue>, headers: Record<string, HeaderValue>, xMatch: XMatch): {
    casa: boolean;
    condiciones: CondicionHeader[];
} {
    const conX = xMatch === "all-with-x" || xMatch === "any-with-x";
    const condiciones: CondicionHeader[] = [];
    for (const clave of Object.keys(args)) {
        const valor = args[clave];
        const modo = valor === null ? "presencia" : "igual";
        const ignorada = clave === "x-match" || (!conX && clave.startsWith("x-"));
        let resultado: CondicionHeader["resultado"];
        if (ignorada)
            resultado = "ignorada";
        else if (modo === "presencia")
            resultado = Object.prototype.hasOwnProperty.call(headers, clave) ? "casa" : "falla";
        else
            resultado = Object.prototype.hasOwnProperty.call(headers, clave) && headers[clave] === valor ? "casa" : "falla";
        condiciones.push({ clave, modo, resultado });
    }
    const cuentan = condiciones.filter(c => c.resultado !== "ignorada");
    const casa = xMatch.startsWith("all")
        ? cuentan.every(c => c.resultado === "casa")
        : cuentan.some(c => c.resultado === "casa");
    return { casa, condiciones };
}
function porCodigo(a: string, b: string): number {
    return a < b ? -1 : a > b ? 1 : 0;
}
export function rabbitRoute(input: RabbitRouteInput): RabbitRouteResult {
    if (!TIPOS.includes(input.type))
        return { ok: false, error: { codigo: "tipo-desconocido", valor: String(input.type) } };
    const bindings = input.bindings ?? [];
    if (bindings.length > MAX_BINDINGS)
        return { ok: false, error: { codigo: "demasiados-bindings", maximo: MAX_BINDINGS } };
    const routingKey = input.routingKey ?? "";
    const bytesRk = utf8.encode(routingKey).length;
    if (bytesRk > MAX_BYTES_CLAVE)
        return { ok: false, error: { codigo: "clave-larga", donde: "routingKey", bytes: bytesRk } };
    const headers = input.headers ?? {};
    const palabras = palabrasTopic(routingKey);
    const veredictos: VeredictoBinding[] = [];
    for (let i = 0; i < bindings.length; i++) {
        const b = bindings[i];
        if (!b.queue)
            return { ok: false, error: { codigo: "cola-vacia", binding: i } };
        const bindingKey = b.bindingKey ?? "";
        const bytesBk = utf8.encode(bindingKey).length;
        if (bytesBk > MAX_BYTES_CLAVE)
            return { ok: false, error: { codigo: "clave-larga", donde: "bindingKey", binding: i, bytes: bytesBk } };
        let razon: RazonBinding;
        switch (input.type) {
            case "fanout":
                razon = { tipo: "fanout" };
                break;
            case "direct":
                razon = { tipo: "direct", casa: bindingKey === routingKey };
                break;
            case "topic": {
                const patron = palabrasTopic(bindingKey);
                razon = { tipo: "topic", casa: casaTopic(patron, palabras), palabrasClave: palabras, palabrasPatron: patron };
                break;
            }
            case "headers": {
                const args = b.arguments ?? {};
                const xm = Object.prototype.hasOwnProperty.call(args, "x-match") ? args["x-match"] : undefined;
                if (xm !== undefined && !X_MATCH_VALIDOS.includes(xm as XMatch)) {
                    return { ok: false, error: { codigo: "x-match-invalido", binding: i, valor: xm } };
                }
                const xMatch = (xm as XMatch | undefined) ?? "all";
                const r = evaluaHeaders(args, headers, xMatch);
                razon = { tipo: "headers", casa: r.casa, xMatch, condiciones: r.condiciones };
                break;
            }
        }
        const casa = razon.tipo === "fanout" ? true : razon.casa;
        veredictos.push({ indice: i, queue: b.queue, casa, razon });
    }
    const matched = veredictos.filter(v => v.casa).map(v => v.indice);
    const queues = [...new Set(matched.map(i => bindings[i].queue))].sort(porCodigo);
    return { ok: true, queues, matched, unroutable: queues.length === 0, bindings: veredictos };
}
