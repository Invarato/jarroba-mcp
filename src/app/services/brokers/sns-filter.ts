export type AmbitoFiltro = "MessageAttributes" | "MessageBody";
export interface AtributoSns {
    Type: string;
    Value: string;
}
export type ErrorFiltro = {
    codigo: "politica-no-objeto";
} | {
    codigo: "politica-grande";
    bytes: number;
    maximo: number;
} | {
    codigo: "clave-sin-array";
    clave: string;
} | {
    codigo: "anidada-en-atributos";
    clave: string;
} | {
    codigo: "patron-invalido";
    clave: string;
    patron: string;
} | {
    codigo: "numero-fuera-de-rango";
    clave: string;
    valor: number;
} | {
    codigo: "demasiadas-claves";
    cuantas: number;
    maximo: number;
} | {
    codigo: "demasiadas-combinaciones";
    cuantas: number;
    maximo: number;
} | {
    codigo: "demasiados-comodines";
    clave: string;
    cuantos: number;
    maximo: number;
} | {
    codigo: "comodin-complejo";
    puntos: number;
    maximo: number;
} | {
    codigo: "mensaje-invalido";
    motivo: "cuerpo-no-json" | "atributos";
};
export interface VeredictoClave {
    ruta: string;
    casa: boolean;
    valores: unknown[];
    patron: number;
}
export type ResultadoFiltro = {
    ok: true;
    casa: boolean;
    claves: VeredictoClave[];
    combinaciones: number;
} | {
    ok: false;
    error: ErrorFiltro;
};
export const MAX_CLAVES = 5;
export const MAX_COMBINACIONES = 150;
export const MAX_BYTES_POLITICA = 256 * 1024;
export const MAX_COMODINES = 3;
export const MAX_PUNTOS_COMODIN = 100;
export const LIMITE_NUMERO = 1000000000;
const RESERVADAS = new Set(["prefix", "suffix", "equals-ignore-case", "wildcard", "cidr", "numeric", "anything-but", "exists"]);
const OPERADORES = ["=", "<", "<=", ">", ">="];
type Patron = unknown;
type Valor = string | number | boolean | null;
const esObjeto = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x);
const redondea = (n: number) => Math.round(n * 100000) / 100000;
const cuentaEstrellas = (s: string) => (s.match(/\*/g) ?? []).length;
function esOr(k: string, v: unknown): v is Record<string, unknown>[] {
    return k === "$or" && Array.isArray(v) && v.length >= 2 && v.every(o => esObjeto(o) && Object.keys(o).every(c => !RESERVADAS.has(c)));
}
function patronValido(p: Patron): boolean {
    if (p === null || typeof p === "string" || typeof p === "boolean")
        return true;
    if (typeof p === "number")
        return Number.isFinite(p);
    if (!esObjeto(p))
        return false;
    const ks = Object.keys(p);
    if (ks.length !== 1)
        return false;
    const [k] = ks, v = p[k];
    switch (k) {
        case "prefix":
        case "suffix":
        case "equals-ignore-case":
        case "wildcard": return typeof v === "string";
        case "cidr": return typeof v === "string" && parseCidr(v) !== null;
        case "exists": return typeof v === "boolean";
        case "numeric": {
            if (!Array.isArray(v) || (v.length !== 2 && v.length !== 4))
                return false;
            for (let i = 0; i < v.length; i += 2)
                if (!OPERADORES.includes(v[i] as string) || typeof v[i + 1] !== "number" || !Number.isFinite(v[i + 1]))
                    return false;
            if (v.length === 4)
                return [">", ">="].includes(v[0] as string) && ["<", "<="].includes(v[2] as string) && (v[1] as number) <= (v[3] as number);
            return true;
        }
        case "anything-but": {
            if (typeof v === "string" || typeof v === "number")
                return true;
            if (Array.isArray(v))
                return v.length > 0 && v.every(x => typeof x === "string" || (typeof x === "number" && Number.isFinite(x)));
            if (esObjeto(v)) {
                const [kk, ...resto] = Object.keys(v);
                return resto.length === 0 && ["prefix", "suffix", "wildcard", "equals-ignore-case"].includes(kk) && typeof v[kk] === "string";
            }
            return false;
        }
        default: return false;
    }
}
function numerosDe(p: Patron): number[] {
    if (typeof p === "number")
        return [p];
    if (!esObjeto(p))
        return [];
    if (Array.isArray(p["numeric"]))
        return (p["numeric"] as unknown[]).filter((x): x is number => typeof x === "number");
    const ab = p["anything-but"];
    if (typeof ab === "number")
        return [ab];
    if (Array.isArray(ab))
        return ab.filter((x): x is number => typeof x === "number");
    return [];
}
function puntosComodin(p: Patron): number {
    if (!esObjeto(p))
        return 0;
    if ("anything-but" in p)
        return 1;
    if (typeof p["wildcard"] === "string") {
        const n = cuentaEstrellas(p["wildcard"]);
        return n <= 1 ? 1 : 3 * n;
    }
    return 0;
}
interface Hoja {
    ruta: string;
    nivel: number;
    patrones: Patron[];
}
function ramas(pol: Record<string, unknown>, ambito: AmbitoFiltro, prefijo: string, nivel: number): {
    ok: true;
    ramas: Hoja[][];
} | {
    ok: false;
    error: ErrorFiltro;
} {
    let acum: Hoja[][] = [[]];
    for (const [k, v] of Object.entries(pol)) {
        const ruta = prefijo ? `${prefijo}.${k}` : k;
        let opciones: Hoja[][];
        if (esOr(k, v)) {
            opciones = [];
            for (const sub of v) {
                const r = ramas(sub, ambito, prefijo, nivel);
                if (!r.ok)
                    return r;
                opciones.push(...r.ramas);
            }
        }
        else if (Array.isArray(v)) {
            if (v.length === 0)
                return { ok: false, error: { codigo: "clave-sin-array", clave: ruta } };
            for (const p of v) {
                if (!patronValido(p))
                    return { ok: false, error: { codigo: "patron-invalido", clave: ruta, patron: JSON.stringify(p).slice(0, 200) } };
                for (const n of numerosDe(p))
                    if (Math.abs(n) > LIMITE_NUMERO)
                        return { ok: false, error: { codigo: "numero-fuera-de-rango", clave: ruta, valor: n } };
                if (esObjeto(p) && typeof p["wildcard"] === "string" && cuentaEstrellas(p["wildcard"]) > MAX_COMODINES) {
                    return { ok: false, error: { codigo: "demasiados-comodines", clave: ruta, cuantos: cuentaEstrellas(p["wildcard"]), maximo: MAX_COMODINES } };
                }
            }
            opciones = [[{ ruta, nivel, patrones: v }]];
        }
        else if (esObjeto(v)) {
            if (ambito === "MessageAttributes")
                return { ok: false, error: { codigo: "anidada-en-atributos", clave: ruta } };
            const r = ramas(v, ambito, ruta, nivel + 1);
            if (!r.ok)
                return r;
            opciones = r.ramas;
        }
        else {
            return { ok: false, error: { codigo: "clave-sin-array", clave: ruta } };
        }
        const nuevo: Hoja[][] = [];
        for (const a of acum)
            for (const o of opciones)
                nuevo.push([...a, ...o]);
        acum = nuevo;
        if (acum.length > 10000)
            return { ok: false, error: { codigo: "demasiadas-combinaciones", cuantas: acum.length, maximo: MAX_COMBINACIONES } };
    }
    return { ok: true, ramas: acum };
}
function valoresAtributo(a: AtributoSns | undefined): Valor[] | undefined {
    if (!a || typeof a.Value !== "string")
        return undefined;
    switch (a.Type) {
        case "String": return [a.Value];
        case "Number": {
            const n = Number(a.Value);
            return Number.isFinite(n) ? [n] : undefined;
        }
        case "String.Array":
        case "Number.Array": {
            try {
                const arr = JSON.parse(a.Value);
                if (!Array.isArray(arr))
                    return undefined;
                return arr.filter((x): x is Valor => x === null || ["string", "number", "boolean"].includes(typeof x));
            }
            catch {
                return undefined;
            }
        }
        default: return undefined;
    }
}
function valoresCuerpo(cuerpo: unknown, ruta: string): Valor[] | undefined {
    let x: unknown = cuerpo;
    for (const k of ruta.split(".")) {
        if (!esObjeto(x) || !(k in x))
            return undefined;
        x = x[k];
    }
    if (Array.isArray(x))
        return x.filter((y): y is Valor => y === null || ["string", "number", "boolean"].includes(typeof y));
    if (x === null || ["string", "number", "boolean"].includes(typeof x))
        return [x as Valor];
    return undefined;
}
function comodin(patron: string, s: string): boolean {
    const re = new RegExp("^" + patron.split("*").map(t => t.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join("[\\s\\S]*") + "$");
    return re.test(s);
}
function parseIp(s: string): {
    v: 4 | 6;
    n: bigint;
} | null {
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(s)) {
        const p = s.split(".").map(Number);
        if (p.some(x => x > 255))
            return null;
        return { v: 4, n: p.reduce((a, x) => (a << 8n) + BigInt(x), 0n) };
    }
    if (!/^[0-9a-fA-F:]+$/.test(s) || !s.includes(":"))
        return null;
    const partes = s.split("::");
    if (partes.length > 2)
        return null;
    const izq = partes[0] ? partes[0].split(":") : [], der = partes.length === 2 && partes[1] ? partes[1].split(":") : [];
    const faltan = 8 - izq.length - der.length;
    if ((partes.length === 1 && faltan !== 0) || faltan < 0)
        return null;
    const grupos = [...izq, ...Array(partes.length === 2 ? faltan : 0).fill("0"), ...der];
    if (grupos.length !== 8 || grupos.some(g => !/^[0-9a-fA-F]{1,4}$/.test(g)))
        return null;
    return { v: 6, n: grupos.reduce((a, g) => (a << 16n) + BigInt(parseInt(g, 16)), 0n) };
}
function parseCidr(s: string): {
    v: 4 | 6;
    red: bigint;
    bits: number;
} | null {
    const [ip, b] = s.split("/");
    const p = parseIp(ip ?? "");
    if (!p)
        return null;
    const max = p.v === 4 ? 32 : 128;
    const bits = b === undefined ? max : /^\d+$/.test(b) ? Number(b) : -1;
    if (bits < 0 || bits > max)
        return null;
    return { v: p.v, red: p.n >> BigInt(max - bits), bits };
}
function enCidr(cidr: string, s: string): boolean {
    const c = parseCidr(cidr), ip = parseIp(s);
    if (!c || !ip || c.v !== ip.v)
        return false;
    return (ip.n >> BigInt((ip.v === 4 ? 32 : 128) - c.bits)) === c.red;
}
function casaNumerico(ops: unknown[], n: number): boolean {
    const x = redondea(n);
    for (let i = 0; i < ops.length; i += 2) {
        const v = redondea(ops[i + 1] as number);
        const ok = ops[i] === "=" ? x === v : ops[i] === "<" ? x < v : ops[i] === "<=" ? x <= v : ops[i] === ">" ? x > v : x >= v;
        if (!ok)
            return false;
    }
    return true;
}
function igual(a: Valor, b: unknown): boolean {
    if (typeof a === "number" && typeof b === "number")
        return redondea(a) === redondea(b);
    return a === b;
}
function casaValor(p: Patron, v: Valor): boolean {
    if (!esObjeto(p))
        return igual(v, p);
    const [k] = Object.keys(p), x = p[k];
    switch (k) {
        case "prefix": return typeof v === "string" && v.startsWith(x as string);
        case "suffix": return typeof v === "string" && v.endsWith(x as string);
        case "equals-ignore-case": return typeof v === "string" && v.toLowerCase() === (x as string).toLowerCase();
        case "wildcard": return typeof v === "string" && comodin(x as string, v);
        case "cidr": return typeof v === "string" && enCidr(x as string, v);
        case "numeric": return typeof v === "number" && casaNumerico(x as unknown[], v);
        case "anything-but": {
            if (Array.isArray(x))
                return !x.some(y => igual(v, y));
            if (esObjeto(x))
                return typeof v === "string" && !casaValor(x, v);
            return !igual(v, x);
        }
        default: return false;
    }
}
export function snsFilter(politica: unknown, mensaje: unknown, ambito: AmbitoFiltro = "MessageAttributes"): ResultadoFiltro {
    let pol: unknown = politica;
    if (typeof pol === "string") {
        if (new TextEncoder().encode(pol).length > MAX_BYTES_POLITICA)
            return { ok: false, error: { codigo: "politica-grande", bytes: new TextEncoder().encode(pol).length, maximo: MAX_BYTES_POLITICA } };
        try {
            pol = JSON.parse(pol);
        }
        catch {
            return { ok: false, error: { codigo: "politica-no-objeto" } };
        }
    }
    if (!esObjeto(pol))
        return { ok: false, error: { codigo: "politica-no-objeto" } };
    const bytes = new TextEncoder().encode(JSON.stringify(pol)).length;
    if (bytes > MAX_BYTES_POLITICA)
        return { ok: false, error: { codigo: "politica-grande", bytes, maximo: MAX_BYTES_POLITICA } };
    const r = ramas(pol, ambito, "", 1);
    if (!r.ok)
        return r;
    const hojas = new Map<string, Hoja>();
    for (const rama of r.ramas)
        for (const h of rama)
            hojas.set(h.ruta, h);
    if (hojas.size > MAX_CLAVES)
        return { ok: false, error: { codigo: "demasiadas-claves", cuantas: hojas.size, maximo: MAX_CLAVES } };
    const combinaciones = r.ramas.reduce((s, rama) => s + rama.reduce((p, h) => p * h.patrones.length * h.nivel, 1), 0);
    if (combinaciones > MAX_COMBINACIONES)
        return { ok: false, error: { codigo: "demasiadas-combinaciones", cuantas: combinaciones, maximo: MAX_COMBINACIONES } };
    let puntos = 0;
    for (const h of hojas.values())
        puntos += h.patrones.reduce((s: number, p) => s + puntosComodin(p), 0) * h.patrones.length;
    if (puntos > MAX_PUNTOS_COMODIN)
        return { ok: false, error: { codigo: "comodin-complejo", puntos, maximo: MAX_PUNTOS_COMODIN } };
    let leer: (ruta: string) => Valor[] | undefined;
    let hayAlgo: boolean;
    if (ambito === "MessageAttributes") {
        if (!esObjeto(mensaje) || !Object.values(mensaje).every(a => esObjeto(a) && typeof a["Type"] === "string" && typeof a["Value"] === "string")) {
            return { ok: false, error: { codigo: "mensaje-invalido", motivo: "atributos" } };
        }
        const atr = mensaje as Record<string, AtributoSns>;
        leer = ruta => valoresAtributo(atr[ruta]);
        hayAlgo = Object.keys(atr).some(k => valoresAtributo(atr[k]) !== undefined);
    }
    else {
        let cuerpo: unknown = mensaje;
        if (typeof cuerpo === "string") {
            try {
                cuerpo = JSON.parse(cuerpo);
            }
            catch {
                return { ok: false, error: { codigo: "mensaje-invalido", motivo: "cuerpo-no-json" } };
            }
        }
        if (!esObjeto(cuerpo))
            return { ok: false, error: { codigo: "mensaje-invalido", motivo: "cuerpo-no-json" } };
        leer = ruta => valoresCuerpo(cuerpo, ruta);
        hayAlgo = Object.keys(cuerpo).length > 0;
    }
    const veredicto = (h: Hoja): VeredictoClave => {
        const vs = leer(h.ruta);
        const presente = vs !== undefined && vs.length > 0 && !vs.every(v => v === null || v === "");
        const i = h.patrones.findIndex(p => {
            if (esObjeto(p) && "exists" in p)
                return p["exists"] ? presente : vs === undefined && hayAlgo;
            return (vs ?? []).some(v => casaValor(p, v));
        });
        return { ruta: h.ruta, casa: i >= 0, valores: vs ?? [], patron: i };
    };
    const vistas = new Map<string, VeredictoClave>();
    const de = (h: Hoja) => { let v = vistas.get(h.ruta); if (!v)
        vistas.set(h.ruta, v = veredicto(h)); return v; };
    const casa = r.ramas.some(rama => rama.every(h => de(h).casa));
    for (const h of hojas.values())
        de(h);
    return { ok: true, casa, claves: [...vistas.values()], combinaciones };
}
