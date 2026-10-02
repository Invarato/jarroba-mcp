import { MathMin, freeVars, usoDeSimbolos, normalizaAlias } from "./calc-eval.service";
import { aCero, Solucion } from "./calc-solve.service";
type Math = MathMin & {
    rationalize(expr: string, scope?: unknown, detailed?: boolean): {
        coefficients: number[];
    };
    simplify(expr: string): {
        toString(): string;
        toTex(): string;
    };
    derivative(expr: string, v: string): {
        toString(): string;
        toTex(): string;
    };
};
interface NodoTex {
    toTex(o?: unknown): string;
    toString(): string;
}
function nodo(math: Math, expr: string): NodoTex { return math.parse(expr) as NodoTex; }
export type Objetivo = "resolver" | "derivar" | "gauss";
export interface Paso {
    tex: string;
    regla: string;
    detalle?: Record<string, string | number>;
}
export interface Explicacion {
    cubierto: boolean;
    pasos: Paso[];
    caso?: "lineal" | "cuadratica" | "factorizada" | "sustitucion" | "inversa" | "derivada" | "gauss";
}
const NO_CUBIERTO: Explicacion = { cubierto: false, pasos: [] };
function num(x: number): string {
    const r = Math.round(x);
    if (Math.abs(x - r) < 1e-12)
        return String(r);
    return String(Math.round(x * 10000000000) / 10000000000);
}
function conSigno(x: number): string { return x < 0 ? `- ${num(-x)}` : `+ ${num(x)}`; }
function coef(x: number): string { return x === 1 ? "" : x === -1 ? "-" : num(x); }
export function explicarEcuacion(math: Math, ecuacion: string, sol: Solucion): Explicacion {
    const igualada = aCero(ecuacion);
    if (!igualada)
        return NO_CUBIERTO;
    const expr = normalizaAlias(math, igualada);
    const v = sol.variable ?? freeVars(math, expr)[0];
    if (!v)
        return NO_CUBIERTO;
    if (sol.metodo === "inversa")
        return porInversaExplicada(math, ecuacion, v, sol);
    let c: number[];
    try {
        c = [...math.rationalize(expr, {}, true).coefficients];
    }
    catch {
        return NO_CUBIERTO;
    }
    while (c.length > 1 && Math.abs(c[c.length - 1]) < 1e-14)
        c.pop();
    const grado = c.length - 1;
    if (grado === 1)
        return lineal(math, ecuacion, v, c[1], c[0]);
    if (grado === 2)
        return cuadratica(math, ecuacion, v, c[2], c[1], c[0]);
    const soloPares = c.every((x, i) => i % 2 === 0 || x === 0);
    if (grado === 4 && soloPares) {
        const porY = porSustitucionPar(math, ecuacion, v, c);
        if (porY.cubierto)
            return porY;
    }
    if (sol.ok && !sol.aproximada && sol.raices.length)
        return porFactorizacion(math, ecuacion, v, c, sol.raices);
    return NO_CUBIERTO;
}
function porInversaExplicada(math: Math, ecuacion: string, v: string, sol: Solucion): Explicacion {
    const pasos: Paso[] = [{ tex: texDe(math, ecuacion), regla: "partida" }];
    if (sol.sinSolucionReal) {
        pasos.push({ tex: "", regla: "sin-solucion-real" });
        return { cubierto: true, pasos, caso: "inversa" };
    }
    if (!sol.raices.length)
        return NO_CUBIERTO;
    pasos.push({ tex: "", regla: "aplicar-inversa" });
    pasos.push({ tex: `${v} = ${num(sol.raices[0])}`, regla: "resultado" });
    return { cubierto: true, pasos, caso: "inversa" };
}
function lineal(math: Math, ecuacion: string, v: string, a: number, b: number): Explicacion {
    if (!a)
        return NO_CUBIERTO;
    const pasos: Paso[] = [{ tex: texDe(math, ecuacion), regla: "partida" }];
    if (b !== 0) {
        pasos.push({
            tex: `${coef(a)}${v} = ${num(-b)}`,
            regla: "mover-termino",
            detalle: { termino: conSigno(b), lado: "derecha" },
        });
    }
    if (a !== 1) {
        pasos.push({
            tex: `${v} = \\dfrac{${num(-b)}}{${num(a)}}`,
            regla: "dividir",
            detalle: { por: num(a) },
        });
    }
    pasos.push({ tex: `${v} = ${num(-b / a)}`, regla: "resultado" });
    return { cubierto: true, pasos, caso: "lineal" };
}
function cuadratica(math: Math, ecuacion: string, v: string, a: number, b: number, c: number): Explicacion {
    if (!a)
        return NO_CUBIERTO;
    const pasos = [{ tex: texDe(math, ecuacion), regla: "partida" }, ...pasosCuadratica(v, a, b, c)];
    return { cubierto: true, pasos, caso: "cuadratica" };
}
function pasosCuadratica(v: string, a: number, b: number, c: number): Paso[] {
    const disc = b * b - 4 * a * c;
    const pasos: Paso[] = [
        {
            tex: `${coef(a)}${v}^2 ${conSigno(b)}${v} ${conSigno(c)} = 0`,
            regla: "forma-general",
            detalle: { a: num(a), b: num(b), c: num(c) },
        },
        {
            tex: `\\Delta = b^2 - 4ac = ${num(b)}^2 - 4\\cdot${num(a)}\\cdot${num(c)} = ${num(disc)}`,
            regla: "discriminante",
            detalle: { valor: num(disc) },
        },
    ];
    if (disc < 0) {
        pasos.push({ tex: `\\Delta < 0`, regla: "disc-negativo" });
        return pasos;
    }
    pasos.push({
        tex: `${v} = \\dfrac{-b \\pm \\sqrt{\\Delta}}{2a} = \\dfrac{${num(-b)} \\pm \\sqrt{${num(disc)}}}{${num(2 * a)}}`,
        regla: "formula-general",
    });
    if (disc === 0) {
        pasos.push({ tex: `${v} = ${num(-b / (2 * a))}`, regla: "raiz-doble" });
        return pasos;
    }
    const r = Math.sqrt(disc);
    const x1 = (-b - r) / (2 * a), x2 = (-b + r) / (2 * a);
    pasos.push({
        tex: `${v}_1 = ${num(Math.min(x1, x2))} \\qquad ${v}_2 = ${num(Math.max(x1, x2))}`,
        regla: "resultado",
    });
    return pasos;
}
function ruffini(desc: readonly number[], r: number): {
    cociente: number[];
    resto: number;
} {
    const q: number[] = [desc[0]];
    for (let i = 1; i < desc.length; i++)
        q.push(desc[i] + r * q[i - 1]);
    return { cociente: q.slice(0, -1), resto: q[q.length - 1] };
}
function tablaRuffini(desc: readonly number[], r: number, q: readonly number[], resto: number): string {
    const cols = "c|" + "c".repeat(desc.length);
    const fila1 = ` & ${desc.map(num).join(" & ")}`;
    const fila2 = `${num(r)} & & ${q.slice(1).map((_, i) => num(r * q[i])).join(" & ")} & ${num(r * q[q.length - 1])}`;
    const fila3 = ` & ${[...q, resto].map(num).join(" & ")}`;
    return `\\begin{array}{${cols}} ${fila1} \\\\ ${fila2} \\\\ \\hline ${fila3} \\end{array}`;
}
function polinomioTex(desc: readonly number[], v: string): string {
    const n = desc.length - 1;
    let s = "";
    desc.forEach((a, i) => {
        if (a === 0)
            return;
        const g = n - i;
        const signo = s === "" ? (a < 0 ? "-" : "") : (a < 0 ? " - " : " + ");
        const mag = Math.abs(a);
        const cf = (mag === 1 && g > 0) ? "" : num(mag);
        s += signo + cf + (g === 0 ? "" : g === 1 ? v : `${v}^{${g}}`);
    });
    return s === "" ? "0" : s;
}
function racionalSencilla(r: number): boolean {
    if (Math.abs(r - Math.round(r)) < 1e-12)
        return true;
    for (let q = 2; q <= 12; q++)
        if (Math.abs(r * q - Math.round(r * q)) < 1e-12)
            return true;
    return false;
}
function porFactorizacion(math: Math, ecuacion: string, v: string, coefAsc: readonly number[], raices: readonly number[]): Explicacion {
    if (!raices.every(racionalSencilla))
        return NO_CUBIERTO;
    let desc = [...coefAsc].reverse();
    const pasos: Paso[] = [{ tex: texDe(math, ecuacion), regla: "partida" }];
    const factores: string[] = [];
    const pendientes = [...raices];
    while (desc.length - 1 > 2 && pendientes.length) {
        const r = pendientes.shift()!;
        const { cociente, resto } = ruffini(desc, r);
        if (Math.abs(resto) > 1e-9)
            return NO_CUBIERTO;
        pasos.push({
            tex: `p(${num(r)}) = 0`,
            regla: "raiz-probada",
            detalle: { raiz: num(r), variable: v },
        });
        pasos.push({ tex: tablaRuffini(desc, r, cociente, resto), regla: "ruffini", detalle: { raiz: num(r) } });
        factores.push(`(${v} ${conSigno(-r)})`);
        desc = cociente;
    }
    if (desc.length - 1 > 2)
        return NO_CUBIERTO;
    if (!factores.length)
        return NO_CUBIERTO;
    pasos.push({
        tex: `${factores.join("")}\\left(${polinomioTex(desc, v)}\\right) = 0`,
        regla: "factorizado",
    });
    pasos.push({ tex: "", regla: "producto-cero" });
    const g = desc.length - 1;
    if (g === 2)
        pasos.push(...pasosCuadratica(v, desc[0], desc[1], desc[2]));
    else if (g === 1)
        pasos.push({ tex: `${v} = ${num(-desc[1] / desc[0])}`, regla: "resultado" });
    if (raices.length > 1) {
        pasos.push({
            tex: raices.map((r, i) => `${v}_${i + 1} = ${num(r)}`).join(" \\qquad "),
            regla: "todas-las-raices",
            detalle: { cuantas: raices.length },
        });
    }
    return { cubierto: true, pasos, caso: "factorizada" };
}
function porSustitucionPar(math: Math, ecuacion: string, v: string, coefAsc: readonly number[]): Explicacion {
    const [c0, c1, c2, c3, c4] = coefAsc;
    if (coefAsc.length !== 5 || c1 !== 0 || c3 !== 0 || !c4)
        return NO_CUBIERTO;
    const y = v === "y" ? "u" : "y";
    const pasos: Paso[] = [
        { tex: texDe(math, ecuacion), regla: "partida" },
        { tex: `${y} = ${v}^2`, regla: "sustitucion", detalle: { de: v, a: y } },
        ...pasosCuadratica(y, c4, c2, c0),
    ];
    const disc = c2 * c2 - 4 * c4 * c0;
    if (disc >= 0) {
        const r = Math.sqrt(disc);
        const ys = disc === 0 ? [-c2 / (2 * c4)] : [(-c2 - r) / (2 * c4), (-c2 + r) / (2 * c4)];
        pasos.push({ tex: `${v} = \\pm\\sqrt{${y}}`, regla: "deshacer-sustitucion", detalle: { de: y, a: v } });
        const xs = ys.filter(q => q >= 0).flatMap(q => (q === 0 ? [0] : [-Math.sqrt(q), Math.sqrt(q)])).sort((p, q) => p - q);
        const negativas = ys.filter(q => q < 0).length;
        if (negativas)
            pasos.push({ tex: `${y} < 0 \\Rightarrow ${v} \\notin \\mathbb{R}`, regla: "y-negativa", detalle: { cuantas: negativas } });
        if (xs.length) {
            pasos.push({ tex: xs.map((x, i) => `${v}_${i + 1} = ${num(x)}`).join(" \\qquad "), regla: "resultado" });
        }
    }
    return { cubierto: true, pasos, caso: "sustitucion" };
}
function texDe(math: Math, ecuacion: string): string {
    const partes = ecuacion.split(/(?<![<>=!])=(?!=)/);
    const aTex = (s: string) => {
        try {
            return nodo(math, s.trim()).toTex({ parenthesis: "auto" });
        }
        catch {
            return s.trim();
        }
    };
    if (partes.length === 2)
        return `${aTex(partes[0])} = ${aTex(partes[1])}`;
    return `${aTex(ecuacion)} = 0`;
}
export function explicarDerivada(math: Math, expr: string, variable?: string): Explicacion {
    expr = normalizaAlias(math, expr);
    const v = variable ?? usoDeSimbolos(math, expr).libre[0] ?? freeVars(math, expr)[0] ?? "x";
    let resultado: string;
    let resTex: string;
    try {
        const d = math.derivative(expr, v);
        resultado = d.toString();
        resTex = d.toTex();
    }
    catch {
        return NO_CUBIERTO;
    }
    const pasos: Paso[] = [{
            tex: `\\dfrac{d}{d${v}}\\left(${texDe(math, expr).replace(/ = 0$/, "")}\\right)`,
            regla: "partida",
        }];
    const regla = reglaRaiz(math, expr, v);
    if (regla)
        pasos.push({ tex: regla.tex, regla: regla.regla, detalle: regla.detalle });
    pasos.push({ tex: `= ${resTex}`, regla: "resultado" });
    try {
        const simple = math.simplify(resultado);
        if (simple.toString() !== resultado)
            pasos.push({ tex: `= ${simple.toTex()}`, regla: "simplificar" });
    }
    catch { }
    return { cubierto: !!regla, pasos, caso: "derivada" };
}
function reglaRaiz(math: Math, expr: string, v: string): Paso | null {
    interface N {
        type?: string;
        op?: string;
        fn?: {
            name?: string;
        } | string;
        args?: N[];
    }
    let n: N;
    try {
        n = math.parse(expr) as N;
    }
    catch {
        return null;
    }
    const tex = (x: N | undefined) => {
        try {
            return (x as unknown as {
                toTex(o?: unknown): string;
            }).toTex({ parenthesis: "auto" });
        }
        catch {
            return "?";
        }
    };
    const dependeDe = (x: N | undefined) => {
        try {
            return freeVars(math, (x as unknown as {
                toString(): string;
            }).toString()).includes(v);
        }
        catch {
            return true;
        }
    };
    if (n.type === "OperatorNode" && n.args?.length === 2) {
        const [u, w] = n.args;
        if (n.op === "+" || n.op === "-") {
            return { tex: `\\dfrac{d}{d${v}}(u ${n.op} w) = u' ${n.op} w'`, regla: "suma" };
        }
        if (n.op === "*") {
            if (!dependeDe(u) || !dependeDe(w)) {
                return { tex: `\\dfrac{d}{d${v}}(k\\cdot u) = k\\cdot u'`, regla: "constante-por" };
            }
            return { tex: `(u\\cdot w)' = u'w + uw'`, regla: "producto", detalle: { u: tex(u), w: tex(w) } };
        }
        if (n.op === "/") {
            return { tex: `\\left(\\dfrac{u}{w}\\right)' = \\dfrac{u'w - uw'}{w^2}`, regla: "cociente", detalle: { u: tex(u), w: tex(w) } };
        }
        if (n.op === "^") {
            if (!dependeDe(w)) {
                return { tex: `\\dfrac{d}{d${v}}(u^{n}) = n\\,u^{n-1}\\,u'`, regla: "potencia", detalle: { n: tex(w) } };
            }
            return null;
        }
    }
    if (n.type === "FunctionNode") {
        const nombre = typeof n.fn === "string" ? n.fn : n.fn?.name;
        const arg = n.args?.[0];
        const compuesta = arg ? !esVariableSola(arg, v) : false;
        if (nombre && compuesta) {
            return { tex: `\\dfrac{d}{d${v}}f(g(${v})) = f'(g(${v}))\\cdot g'(${v})`, regla: "cadena", detalle: { f: nombre, g: tex(arg) } };
        }
        if (nombre)
            return { tex: `\\dfrac{d}{d${v}}\\,\\mathrm{${nombre}}(${v})`, regla: "derivada-directa", detalle: { f: nombre } };
    }
    if (n.type === "SymbolNode")
        return { tex: `\\dfrac{d${v}}{d${v}} = 1`, regla: "identidad" };
    if (n.type === "ConstantNode")
        return { tex: `\\dfrac{d}{d${v}}k = 0`, regla: "constante" };
    return null;
}
function esVariableSola(n: {
    type?: string;
    name?: string;
}, v: string): boolean {
    return n.type === "SymbolNode" && n.name === v;
}
export function explicarGauss(aumentada: readonly (readonly number[])[], variables: readonly string[]): Explicacion {
    const n = variables.length;
    if (!n || aumentada.length !== n || aumentada.some(f => f.length !== n + 1))
        return NO_CUBIERTO;
    const M = aumentada.map(f => [...f]);
    const pasos: Paso[] = [{ tex: matrizTex(M, n), regla: "matriz-aumentada" }];
    for (let col = 0; col < n; col++) {
        let mejor = col;
        for (let f = col + 1; f < n; f++)
            if (Math.abs(M[f][col]) > Math.abs(M[mejor][col]))
                mejor = f;
        if (Math.abs(M[mejor][col]) < 1e-12)
            return { cubierto: false, pasos, caso: "gauss" };
        if (mejor !== col) {
            [M[col], M[mejor]] = [M[mejor], M[col]];
            pasos.push({ tex: matrizTex(M, n), regla: "intercambiar", detalle: { a: col + 1, b: mejor + 1 } });
        }
        const piv = M[col][col];
        if (piv !== 1) {
            for (let j = col; j <= n; j++)
                M[col][j] /= piv;
            pasos.push({ tex: matrizTex(M, n), regla: "normalizar", detalle: { fila: col + 1, por: num(piv) } });
        }
        for (let f = 0; f < n; f++) {
            if (f === col || Math.abs(M[f][col]) < 1e-14)
                continue;
            const k = M[f][col];
            for (let j = col; j <= n; j++)
                M[f][j] -= k * M[col][j];
            pasos.push({ tex: matrizTex(M, n), regla: "eliminar", detalle: { fila: f + 1, pivote: col + 1, factor: num(k) } });
        }
    }
    pasos.push({
        tex: variables.map((v, i) => `${v} = ${num(M[i][n])}`).join(" \\qquad "),
        regla: "resultado",
    });
    return { cubierto: true, pasos, caso: "gauss" };
}
function matrizTex(M: readonly (readonly number[])[], n: number): string {
    const filas = M.map(f => f.map(x => num(x + 0)).join(" & "));
    const cols = "c".repeat(n) + "|c";
    return `\\left[\\begin{array}{${cols}}${filas.join(" \\\\ ")}\\end{array}\\right]`;
}
export const COBERTURA = {
    cubre: ["lineal", "cuadratica", "grado>=3-factorizando", "bicuadratica-sustituyendo", "exponencial-y-logaritmica", "sistema-lineal", "derivada-reglas"] as const,
    noCubre: ["grado>=3-sin-raiz-conocida", "trigonometricas", "integrales", "inecuaciones", "ecuaciones-diferenciales"] as const,
};
export const MAX_ORDEN = 4;
export interface Derivada {
    ok: boolean;
    expr?: string;
    simplificada?: string;
    orden: number;
    variable: string;
    valorEn?: string;
    unidades?: string[];
    error?: "no-derivable" | "sin-variable" | "orden" | "no-evaluable";
}
export function derivar(math: Math, expr: string, variable?: string, orden = 1, en?: number): Derivada {
    expr = normalizaAlias(math, expr);
    const uso = usoDeSimbolos(math, expr);
    const v = variable ?? uso.libre[0] ?? freeVars(math, expr)[0] ?? "x";
    const unidades = uso.unidad.length ? uso.unidad : undefined;
    if (!Number.isInteger(orden) || orden < 1 || orden > MAX_ORDEN) {
        return { ok: false, orden, variable: v, unidades, error: "orden" };
    }
    if (!freeVars(math, expr).includes(v))
        return { ok: false, orden, variable: v, unidades, error: "sin-variable" };
    let actual = expr;
    for (let i = 0; i < orden; i++) {
        try {
            actual = math.derivative(actual, v).toString();
        }
        catch {
            return { ok: false, orden, variable: v, unidades, error: "no-derivable" };
        }
    }
    let simplificada: string | undefined;
    try {
        const s = math.simplify(actual).toString();
        if (s !== actual)
            simplificada = s;
    }
    catch { }
    const r: Derivada = { ok: true, expr: actual, simplificada, orden, variable: v, unidades };
    if (en !== undefined) {
        try {
            r.valorEn = math.format(math.evaluate(simplificada ?? actual, { [v]: en }), { precision: 14 });
        }
        catch {
            return { ...r, error: "no-evaluable" };
        }
    }
    return r;
}
export interface Simplificada {
    ok: boolean;
    expr?: string;
    cambio?: boolean;
    error?: "no-simplificable";
}
export function simplificar(math: Math, expr: string): Simplificada {
    expr = normalizaAlias(math, expr);
    let normal: string;
    let salida: string;
    try {
        normal = nodo(math, expr).toString();
        salida = math.simplify(expr).toString();
    }
    catch {
        return { ok: false, error: "no-simplificable" };
    }
    return { ok: true, expr: salida, cambio: salida !== normal };
}
export class CalcStepsService {
    explicarEcuacion = explicarEcuacion;
    explicarDerivada = explicarDerivada;
    explicarGauss = explicarGauss;
    derivar = derivar;
    simplificar = simplificar;
}
