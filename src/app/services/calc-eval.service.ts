import { formatear } from "./calc-format.service";
export interface MathMin {
    parse(expr: string): unknown;
    evaluate(expr: string, scope?: Record<string, unknown>): unknown;
    compile(expr: string): {
        evaluate(scope: Record<string, unknown>): unknown;
    };
    format(valor: unknown, opts?: {
        precision?: number;
    }): string;
    isNaN(x: unknown): boolean;
    isUnit(x: unknown): boolean;
}
type Math = MathMin;
interface Nodo {
    type?: string;
    name?: string;
    fn?: {
        name?: string;
    } | string;
    args?: Nodo[];
    value?: unknown;
    start?: Nodo;
    end?: Nodo;
    step?: Nodo | null;
    traverse(cb: (n: Nodo, path: string, parent: Nodo | null) => void): void;
}
export const TOPE_ELEMENTOS = 1000000;
export const TOPE_DIMENSION = 100000;
export const TOPE_FACTORIAL = 10000;
const CREADORAS = new Set(["zeros", "ones", "identity", "eye", "range", "resize", "reshape", "random", "randomInt"]);
export type MotivoCota = "elementos" | "dimension" | "factorial";
export interface Veredicto {
    ok: boolean;
    motivo?: MotivoCota;
    fn?: string;
    pedido?: number;
}
const OK: Veredicto = { ok: true };
export function cribar(math: Math, expr: string, scope: Record<string, unknown> = {}): Veredicto {
    let raiz: Nodo;
    try {
        raiz = math.parse(expr) as unknown as Nodo;
    }
    catch {
        return OK;
    }
    let veredicto: Veredicto = OK;
    raiz.traverse((n) => {
        if (!veredicto.ok)
            return;
        if (n.type === "FunctionNode") {
            const nombre = typeof n.fn === "string" ? n.fn : n.fn?.name;
            if (!nombre)
                return;
            if (nombre === "factorial") {
                const v = resolver(math, n.args?.[0], scope);
                if (v !== null && v > TOPE_FACTORIAL)
                    veredicto = { ok: false, motivo: "factorial", fn: nombre, pedido: v };
                return;
            }
            if (!CREADORAS.has(nombre))
                return;
            const dims: number[] = [];
            for (const a of n.args ?? []) {
                const v = resolver(math, a, scope);
                if (v !== null)
                    dims.push(v);
            }
            veredicto = juzgarDims(dims, nombre);
            return;
        }
        if (n.type === "RangeNode") {
            const ini = resolver(math, n.start, scope);
            const fin = resolver(math, n.end, scope);
            const paso = n.step ? resolver(math, n.step, scope) : 1;
            if (ini === null || fin === null || paso === null || paso === 0)
                return;
            const cuantos = Math.floor(Math.abs((fin - ini) / paso)) + 1;
            if (cuantos > TOPE_ELEMENTOS)
                veredicto = { ok: false, motivo: "elementos", fn: ":", pedido: cuantos };
        }
    });
    return veredicto;
}
function juzgarDims(dims: number[], fn: string): Veredicto {
    if (!dims.length)
        return OK;
    for (const d of dims) {
        if (d > TOPE_DIMENSION)
            return { ok: false, motivo: "dimension", fn, pedido: d };
    }
    const total = dims.reduce((a, b) => a * b, 1);
    if (total > TOPE_ELEMENTOS)
        return { ok: false, motivo: "elementos", fn, pedido: total };
    return OK;
}
function resolver(math: Math, nodo: Nodo | undefined | null, scope: Record<string, unknown>): number | null {
    if (!nodo)
        return null;
    if (nodo.type === "ConstantNode") {
        const v = Number(nodo.value);
        return Number.isFinite(v) ? Math.abs(v) : null;
    }
    let peligroso = false;
    nodo.traverse((n) => {
        if (n.type !== "FunctionNode")
            return;
        const nombre = typeof n.fn === "string" ? n.fn : n.fn?.name;
        if (nombre && (CREADORAS.has(nombre) || nombre === "factorial"))
            peligroso = true;
    });
    if (peligroso)
        return null;
    try {
        const v = Number((nodo as unknown as {
            evaluate(s: Record<string, unknown>): unknown;
        }).evaluate(scope));
        return Number.isFinite(v) ? Math.abs(v) : null;
    }
    catch {
        return null;
    }
}
function candidatos(math: Math, expr: string): string[] {
    const out = new Set<string>();
    let raiz: Nodo;
    try {
        raiz = math.parse(expr) as unknown as Nodo;
    }
    catch {
        return [];
    }
    const ligados = new Set<string>();
    raiz.traverse((n) => {
        if (n.type !== "FunctionAssignmentNode")
            return;
        for (const p of (n as unknown as {
            params?: string[];
        }).params ?? [])
            ligados.add(p);
    });
    raiz.traverse((n, _path, parent) => {
        if (n.type !== "SymbolNode" || !n.name)
            return;
        if (parent?.type === "FunctionNode" && (parent as {
            fn?: unknown;
        }).fn === n)
            return;
        if (ligados.has(n.name))
            return;
        out.add(n.name);
    });
    return [...out].filter(n => !ligados.has(n));
}
type Saber = "nada" | "unidad" | "valor";
function queSabe(math: Math, nombre: string): Saber {
    let v: unknown;
    try {
        v = math.evaluate(nombre);
    }
    catch {
        return "nada";
    }
    try {
        return math.isUnit(v) ? "unidad" : "valor";
    }
    catch {
        return "valor";
    }
}
const ALIAS_FN: Record<string, string> = { ln: "log" };
export function normalizaAlias(math: Math, expr: string): string {
    if (!Object.keys(ALIAS_FN).some((a) => expr.includes(a)))
        return expr;
    try {
        const raiz = math.parse(expr) as unknown as Nodo;
        let toco = false;
        raiz.traverse((n) => {
            if (n.type !== "FunctionNode")
                return;
            const fn = n.fn as {
                name?: string;
            } | string | undefined;
            const nombre = typeof fn === "string" ? fn : fn?.name;
            if (!nombre || !(nombre in ALIAS_FN))
                return;
            if (typeof fn === "object" && fn) {
                fn.name = ALIAS_FN[nombre];
                toco = true;
            }
        });
        return toco ? (raiz as unknown as {
            toString(): string;
        }).toString() : expr;
    }
    catch {
        return expr;
    }
}
interface ConUnidades {
    Unit?: {
        UNITS?: Record<string, {
            base?: unknown;
            value?: number;
            offset?: number;
        }>;
    };
}
function nombreLargoDeUnidad(math: Math, corto: string): string | undefined {
    const UNITS = (math as unknown as ConUnidades).Unit?.UNITS;
    const u = UNITS?.[corto];
    if (!UNITS || !u)
        return undefined;
    const iguales = Object.keys(UNITS).filter((k) => {
        if (k === corto)
            return false;
        const o = UNITS[k];
        if (o.base !== u.base || o.value !== u.value || (o.offset ?? 0) !== (u.offset ?? 0))
            return false;
        return queSabe(math, k) === "unidad";
    });
    const singulares = iguales.filter((k) => !k.endsWith("s"));
    return (singulares.length ? singulares : iguales).sort((a, b) => b.length - a.length)[0];
}
export function funcionTapaUnidad(math: Math, expr: string, scope: Record<string, unknown> = {}): {
    simbolo: string;
    alternativa?: string;
} | null {
    let raiz: Nodo;
    try {
        raiz = math.parse(expr) as unknown as Nodo;
    }
    catch {
        return null;
    }
    let culpable: string | undefined;
    raiz.traverse((n) => {
        if (culpable)
            return;
        const op = n as Nodo & {
            op?: string;
            implicit?: boolean;
        };
        if (n.type !== "OperatorNode" || op.op !== "*" || !op.implicit || op.args?.length !== 2)
            return;
        for (const lado of op.args) {
            if (lado.type !== "SymbolNode" || !lado.name || lado.name in scope)
                continue;
            let v: unknown;
            try {
                v = math.evaluate(lado.name);
            }
            catch {
                continue;
            }
            if (typeof v === "function") {
                culpable = lado.name;
                return;
            }
        }
    });
    if (!culpable)
        return null;
    return { simbolo: culpable, alternativa: nombreLargoDeUnidad(math, culpable) };
}
export type ModoSimbolos = "auto" | "formula" | "unidades";
export interface FreeVarsOpts {
    modo?: ModoSimbolos;
}
export function usoDeSimbolos(math: Math, expr: string): {
    unidad: string[];
    libre: string[];
} {
    let raiz: Nodo;
    try {
        raiz = math.parse(expr) as unknown as Nodo;
    }
    catch {
        return { unidad: [], libre: [] };
    }
    const unidad = new Set<string>();
    const marcaTodo = (n: Nodo | undefined) => {
        if (!n)
            return;
        n.traverse((x) => {
            if (x.type === "SymbolNode" && x.name && queSabe(math, x.name) === "unidad")
                unidad.add(x.name);
        });
    };
    const visita = (n: Nodo | undefined): boolean => {
        if (!n)
            return false;
        const op = n as Nodo & {
            op?: string;
            implicit?: boolean;
        };
        if (n.type === "OperatorNode" && op.args?.length === 2) {
            if (op.op === "*" && op.implicit) {
                const [a, b] = op.args;
                if (a.type === "ConstantNode") {
                    marcaTodo(b);
                    visita(b);
                    return true;
                }
                if (b.type === "ConstantNode") {
                    marcaTodo(a);
                    visita(a);
                    return true;
                }
            }
            if (op.op === "/") {
                const izq = visita(op.args[0]);
                const der = visita(op.args[1]);
                if (izq)
                    marcaTodo(op.args[1]);
                return izq || der;
            }
            if (op.op === "to") {
                marcaTodo(op.args[0]);
                marcaTodo(op.args[1]);
                return false;
            }
        }
        for (const h of (op.args ?? []))
            visita(h);
        return false;
    };
    visita(raiz);
    const todos = candidatos(math, expr);
    return { unidad: todos.filter(n => unidad.has(n)), libre: todos.filter(n => !unidad.has(n)) };
}
export function freeVars(math: Math, expr: string, opts: FreeVarsOpts = {}): string[] {
    if (!expr.trim())
        return [];
    const cand = candidatos(math, expr);
    if (!cand.length)
        return [];
    const modo = opts.modo ?? "auto";
    if (modo === "unidades") {
        if (cribar(math, expr).ok) {
            try {
                math.evaluate(expr);
                return [];
            }
            catch { }
        }
        return cand.filter(n => queSabe(math, n) === "nada");
    }
    const hayIncognitaClara = cand.some(n => queSabe(math, n) === "nada");
    const enPosicionDeUnidad = modo === "auto" && !hayIncognitaClara
        ? new Set(usoDeSimbolos(math, expr).unidad) : new Set<string>();
    const libres = cand.filter(n => !enPosicionDeUnidad.has(n) && queSabe(math, n) !== "valor");
    if (libres.length)
        return libres;
    return [];
}
export function simbolosUnidad(math: Math, expr: string): string[] {
    return candidatos(math, expr).filter(n => queSabe(math, n) === "unidad");
}
export type Rareza = "nan" | "inf" | "-inf";
export function clasificar(math: Math, valor: unknown): Rareza | null {
    try {
        if (math.isNaN(valor as number) === true)
            return "nan";
    }
    catch {
        return null;
    }
    if (typeof valor === "string" || typeof valor === "boolean")
        return null;
    try {
        const n = Number(valor);
        if (n === Infinity)
            return "inf";
        if (n === -Infinity)
            return "-inf";
    }
    catch { }
    return null;
}
export interface Resultado {
    ok: boolean;
    valor?: unknown;
    texto: string;
    fallo?: "sintaxis" | "cota" | "funcion-unidad";
    simbolo?: string;
    alternativa?: string;
    mensaje?: string;
    cota?: Veredicto;
    rareza?: Rareza;
}
export function evaluarSeguro(math: Math, expr: string, scope: Record<string, unknown> = {}, precision = 14): Resultado {
    if (!expr.trim())
        return { ok: false, texto: "", fallo: "sintaxis", mensaje: "empty" };
    expr = normalizaAlias(math, expr);
    const v = cribar(math, expr, scope);
    if (!v.ok)
        return { ok: false, texto: "", fallo: "cota", cota: v };
    try {
        const valor = math.evaluate(expr, { ...scope });
        const rareza = clasificar(math, valor) ?? undefined;
        return { ok: true, valor, texto: formatear(math as never, valor, { digitos: precision }), rareza };
    }
    catch (e: unknown) {
        const tapada = funcionTapaUnidad(math, expr, scope);
        if (tapada)
            return { ok: false, texto: "", fallo: "funcion-unidad", ...tapada };
        return { ok: false, texto: "", fallo: "sintaxis", mensaje: e instanceof Error ? e.message : String(e) };
    }
}
export interface Compilado {
    ok: boolean;
    evaluar?: (s: Record<string, unknown>) => unknown;
    fallo?: "sintaxis" | "cota";
    mensaje?: string;
    cota?: Veredicto;
}
export function compilarSeguro(math: Math, expr: string, scope: Record<string, unknown> = {}): Compilado {
    expr = normalizaAlias(math, expr);
    const v = cribar(math, expr, scope);
    if (!v.ok)
        return { ok: false, fallo: "cota", cota: v };
    try {
        const code = math.compile(expr);
        return { ok: true, evaluar: (s) => code.evaluate(s) };
    }
    catch (e: unknown) {
        return { ok: false, fallo: "sintaxis", mensaje: e instanceof Error ? e.message : String(e) };
    }
}
export class CalcEvalService {
    cribar = cribar;
    clasificar = clasificar;
    evaluarSeguro = evaluarSeguro;
    compilarSeguro = compilarSeguro;
}
