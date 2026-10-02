import { MathMin, cribar, freeVars, normalizaAlias } from "./calc-eval.service";
type Math = MathMin & {
    rationalize(expr: string, scope?: unknown, detailed?: boolean): {
        coefficients: number[];
    };
    eigs(m: unknown): {
        values: {
            toArray(): unknown[];
        };
    };
    polynomialRoot(...coef: number[]): unknown[];
    matrix(a: unknown): unknown;
    lusolve(a: unknown, b: unknown): unknown;
    det(a: unknown): number;
    simplify(expr: string): {
        toString(): string;
    };
};
export type MetodoSolucion = "lineal" | "cuadratica" | "polinomica" | "inversa" | "numerica" | "sistema";
export interface Solucion {
    ok: boolean;
    raices: number[];
    metodo?: MetodoSolucion;
    aproximada?: boolean;
    intervalo?: [
        number,
        number
    ];
    complejasDescartadas?: number;
    grado?: number;
    error?: "sin-incognita" | "no-es-ecuacion" | "sin-solucion" | "no-soportada" | "cota";
    variable?: string;
    sinSolucionReal?: boolean;
}
const LIMPIEZA = 1e-10;
function limpia(x: number): number {
    const r = Math.round(x);
    return Math.abs(x - r) < LIMPIEZA * Math.max(1, Math.abs(x)) ? r : x;
}
export function aCero(ecuacion: string): string | null {
    const partes = ecuacion.split(/(?<![<>=!])=(?!=)/);
    if (partes.length === 1)
        return ecuacion.trim() || null;
    if (partes.length !== 2)
        return null;
    const [i, d] = partes.map(p => p.trim());
    if (!i || !d)
        return null;
    return `(${i}) - (${d})`;
}
export function resolver(math: Math, ecuacion: string, variable?: string, intervalo: [
    number,
    number
] = [-100, 100]): Solucion {
    const igualada = aCero(ecuacion);
    if (!igualada)
        return { ok: false, raices: [], error: "no-es-ecuacion" };
    const expr = normalizaAlias(math, igualada);
    if (!cribar(math, expr).ok)
        return { ok: false, raices: [], error: "cota" };
    const v = variable ?? freeVars(math, expr)[0];
    if (!v)
        return { ok: false, raices: [], error: "sin-incognita" };
    const exacta = porPolinomio(math, expr, v);
    if (exacta)
        return exacta;
    const inversa = porInversa(math, ecuacion, v);
    if (inversa)
        return inversa;
    const grado = gradoDe(math, expr);
    const numerica = porBiseccion(math, expr, v, intervalo);
    if (numerica)
        return { ...numerica, grado };
    return { ok: false, raices: [], error: "sin-solucion", variable: v, intervalo, grado };
}
interface Inversa {
    de(c: number): number;
    vale(c: number): boolean;
}
const INVERSAS: Record<string, Inversa> = {
    log: { de: (c) => Math.exp(c), vale: () => true },
    log10: { de: (c) => 10 ** c, vale: () => true },
    log2: { de: (c) => 2 ** c, vale: () => true },
    exp: { de: (c) => Math.log(c), vale: (c) => c > 0 },
    sqrt: { de: (c) => c * c, vale: (c) => c >= 0 },
    cbrt: { de: (c) => c ** 3, vale: () => true },
};
function porInversa(math: Math, ecuacion: string, v: string): Solucion | null {
    const partes = ecuacion.split(/(?<![<>=!])=(?!=)/);
    if (partes.length !== 2)
        return null;
    const lados = partes.map(t => t.trim());
    const constante = (t: string) => {
        if (freeVars(math, t).includes(v))
            return null;
        try {
            const n = Number(math.evaluate(t));
            return Number.isFinite(n) ? n : null;
        }
        catch {
            return null;
        }
    };
    const c0 = constante(lados[0]), c1 = constante(lados[1]);
    if ((c0 === null) === (c1 === null))
        return null;
    const c = (c0 ?? c1) as number;
    const ladoFn = c0 === null ? lados[0] : lados[1];
    let n: {
        type?: string;
        fn?: {
            name?: string;
        };
        args?: unknown[];
        op?: string;
        name?: string;
    };
    try {
        n = math.parse(normalizaAlias(math, ladoFn)) as never;
    }
    catch {
        return null;
    }
    const esLaIncognita = (a: unknown) => (a as {
        type?: string;
        name?: string;
    })?.type === "SymbolNode"
        && (a as {
            name?: string;
        }).name === v;
    if (n.type === "FunctionNode" && n.args?.length === 1 && esLaIncognita(n.args[0])) {
        const inv = INVERSAS[n.fn?.name ?? ""];
        if (!inv)
            return null;
        if (!inv.vale(c))
            return { ok: true, raices: [], metodo: "inversa", variable: v, sinSolucionReal: true };
        return { ok: true, raices: [limpia(inv.de(c))], metodo: "inversa", variable: v };
    }
    if (n.type === "OperatorNode" && n.op === "^" && n.args?.length === 2 && esLaIncognita(n.args[1])) {
        let base: number;
        try {
            base = Number(math.evaluate((n.args[0] as {
                toString(): string;
            }).toString()));
        }
        catch {
            return null;
        }
        if (!Number.isFinite(base) || base <= 0 || base === 1)
            return null;
        if (c <= 0)
            return { ok: true, raices: [], metodo: "inversa", variable: v, sinSolucionReal: true };
        return { ok: true, raices: [limpia(Math.log(c) / Math.log(base))], metodo: "inversa", variable: v };
    }
    return null;
}
function gradoDe(math: Math, expr: string): number | undefined {
    try {
        const c = [...math.rationalize(expr, {}, true).coefficients];
        while (c.length > 1 && Math.abs(c[c.length - 1]) < 1e-14)
            c.pop();
        const g = c.length - 1;
        return g >= 1 ? g : undefined;
    }
    catch {
        return undefined;
    }
}
function porPolinomio(math: Math, expr: string, v: string): Solucion | null {
    let coef: number[];
    try {
        coef = math.rationalize(expr, {}, true).coefficients;
    }
    catch {
        return null;
    }
    if (!Array.isArray(coef) || coef.length < 2)
        return null;
    if (freeVars(math, expr).length !== 1)
        return null;
    return porCoeficientes(math, coef, v);
}
function porCoeficientes(math: Math, coef: readonly number[], v: string): Solucion | null {
    const c = [...coef];
    while (c.length > 1 && Math.abs(c[c.length - 1]) < 1e-14)
        c.pop();
    const grado = c.length - 1;
    if (grado < 1)
        return null;
    if (!c.every(x => Number.isFinite(x)))
        return null;
    if (grado === 1) {
        const [b, a] = c;
        if (a === 0)
            return null;
        return { ok: true, raices: [limpia(-b / a)], metodo: "lineal", variable: v };
    }
    if (grado === 2) {
        const [cc, b, a] = c;
        const disc = b * b - 4 * a * cc;
        if (disc < 0)
            return { ok: true, raices: [], metodo: "cuadratica", variable: v, complejasDescartadas: 2 };
        const r = Math.sqrt(disc);
        const raices = disc === 0 ? [limpia(-b / (2 * a))]
            : [limpia((-b - r) / (2 * a)), limpia((-b + r) / (2 * a))].sort((p, q) => p - q);
        return { ok: true, raices, metodo: "cuadratica", variable: v };
    }
    if (grado === 3) {
        try {
            const sol = clasifica(math.polynomialRoot(c[0], c[1], c[2], c[3]));
            if (sol)
                return { ok: true, ...sol, metodo: "polinomica", variable: v };
        }
        catch { }
    }
    if (grado >= 4 && grado % 2 === 0 && c.every((x, i) => i % 2 === 0 || x === 0)) {
        const enY = porCoeficientes(math, c.filter((_, i) => i % 2 === 0), v);
        if (enY?.ok) {
            const raices: number[] = [];
            let complejas = 2 * (enY.complejasDescartadas ?? 0);
            for (const y of enY.raices) {
                if (y < 0) {
                    complejas += 2;
                    continue;
                }
                if (y === 0) {
                    raices.push(0);
                    continue;
                }
                const r = Math.sqrt(y);
                raices.push(limpia(-r), limpia(r));
            }
            if (raices.length || complejas) {
                return {
                    ok: true,
                    raices: raices.sort((p, q) => p - q),
                    metodo: "polinomica",
                    variable: v,
                    complejasDescartadas: complejas || undefined,
                };
            }
        }
    }
    try {
        const n = grado, an = c[n];
        if (!an)
            return null;
        const M: number[][] = Array.from({ length: n }, () => Array.from({ length: n }, () => 0));
        for (let i = 0; i < n; i++)
            M[i][n - 1] = -c[i] / an;
        for (let i = 1; i < n; i++)
            M[i][i - 1] = 1;
        const sol = clasifica(math.eigs(math.matrix(M)).values.toArray());
        if (!sol)
            return null;
        return { ok: true, ...sol, metodo: "polinomica", variable: v };
    }
    catch {
        return null;
    }
}
function clasifica(valores: readonly unknown[]): {
    raices: number[];
    complejasDescartadas?: number;
} | null {
    const reales: number[] = [];
    let complejas = 0;
    for (const val of valores) {
        if (typeof val === "number") {
            reales.push(limpia(val));
            continue;
        }
        const z = val as {
            re?: number;
            im?: number;
        };
        if (typeof z?.re === "number" && typeof z?.im === "number") {
            if (Math.abs(z.im) < 1e-8)
                reales.push(limpia(z.re));
            else
                complejas++;
        }
        else
            complejas++;
    }
    if (!reales.length && !complejas)
        return null;
    return { raices: reales.sort((p, q) => p - q), complejasDescartadas: complejas || undefined };
}
function porBiseccion(math: Math, expr: string, v: string, intervalo: [
    number,
    number
]): Solucion | null {
    let f: (x: number) => number;
    try {
        const code = math.compile(expr);
        f = (x: number) => {
            try {
                const y = code.evaluate({ [v]: x });
                return typeof y === "number" ? y : NaN;
            }
            catch {
                return NaN;
            }
        };
    }
    catch {
        return null;
    }
    const [lo, hi] = intervalo;
    if (!(hi > lo))
        return null;
    const N = 2000;
    const paso = (hi - lo) / N;
    const raices: number[] = [];
    let xPrev = lo, yPrev = f(lo);
    if (Number.isFinite(yPrev) && yPrev === 0)
        raices.push(limpia(lo));
    for (let i = 1; i <= N; i++) {
        const x = lo + paso * i, y = f(x);
        if (Number.isFinite(yPrev) && Number.isFinite(y)) {
            if (y === 0)
                raices.push(limpia(x));
            else if (yPrev * y < 0) {
                const r = afina(f, xPrev, x);
                if (r !== null)
                    raices.push(limpia(r));
            }
        }
        xPrev = x;
        yPrev = y;
        if (raices.length >= 32)
            break;
    }
    if (!raices.length)
        return null;
    return {
        ok: true,
        raices: dedup(raices),
        metodo: "numerica",
        variable: v,
        aproximada: true,
        intervalo,
    };
}
function afina(f: (x: number) => number, a: number, b: number): number | null {
    let fa = f(a);
    if (!Number.isFinite(fa))
        return null;
    for (let i = 0; i < 80; i++) {
        const m = (a + b) / 2, fm = f(m);
        if (!Number.isFinite(fm))
            return null;
        if (fa * fm <= 0)
            b = m;
        else {
            a = m;
            fa = fm;
        }
    }
    return (a + b) / 2;
}
function dedup(xs: number[]): number[] {
    const out: number[] = [];
    for (const x of [...xs].sort((a, b) => a - b)) {
        if (!out.length || Math.abs(x - out[out.length - 1]) > 1e-7)
            out.push(x);
    }
    return out;
}
export interface SistemaSolucion {
    ok: boolean;
    valores?: number[];
    variables?: string[];
    aumentada?: number[][];
    error?: "no-lineal" | "sin-solucion-unica" | "vacio" | "cota";
}
export function resolverSistema(math: Math, lineas: readonly string[], variables?: readonly string[]): SistemaSolucion {
    const exprs: string[] = [];
    for (const l of lineas) {
        const t = l.trim();
        if (!t || t.startsWith("#"))
            continue;
        const e = aCero(t);
        if (e)
            exprs.push(normalizaAlias(math, e));
    }
    if (!exprs.length)
        return { ok: false, error: "vacio" };
    for (const e of exprs)
        if (!cribar(math, e).ok)
            return { ok: false, error: "cota" };
    const vars = variables ? [...variables] : [...new Set(exprs.flatMap(e => freeVars(math, e)))].sort();
    if (!vars.length)
        return { ok: false, error: "vacio" };
    if (exprs.length !== vars.length)
        return { ok: false, error: "sin-solucion-unica" };
    const A: number[][] = [];
    const b: number[] = [];
    for (const e of exprs) {
        let code: {
            evaluate(s: Record<string, unknown>): unknown;
        };
        try {
            code = math.compile(e);
        }
        catch {
            return { ok: false, error: "no-lineal" };
        }
        const en = (vals: Record<string, number>) => {
            const y = code.evaluate(vals);
            return typeof y === "number" ? y : NaN;
        };
        const cero: Record<string, number> = {};
        for (const v of vars)
            cero[v] = 0;
        const c0 = en(cero);
        if (!Number.isFinite(c0))
            return { ok: false, error: "no-lineal" };
        const fila: number[] = [];
        for (const v of vars) {
            const uno = { ...cero, [v]: 1 };
            const c1 = en(uno);
            if (!Number.isFinite(c1))
                return { ok: false, error: "no-lineal" };
            const coef = c1 - c0;
            const dos = { ...cero, [v]: 2 };
            const c2 = en(dos);
            if (!Number.isFinite(c2) || Math.abs((c2 - c0) - 2 * coef) > 1e-9 * (1 + Math.abs(coef))) {
                return { ok: false, error: "no-lineal" };
            }
            fila.push(coef);
        }
        const todosUno: Record<string, number> = {};
        for (const v of vars)
            todosUno[v] = 1;
        const cTodos = en(todosUno);
        const esperado = c0 + fila.reduce((a, x) => a + x, 0);
        if (!Number.isFinite(cTodos) || Math.abs(cTodos - esperado) > 1e-9 * (1 + Math.abs(esperado))) {
            return { ok: false, error: "no-lineal" };
        }
        A.push(fila);
        b.push(-c0);
    }
    try {
        const escala = A.reduce((m, f) => Math.max(m, f.reduce((a2, c) => a2 + Math.abs(c), 0)), 0);
        const det = math.det(A);
        if (!Number.isFinite(det) || Math.abs(det) < 1e-12 * Math.max(1, Math.pow(escala, A.length))) {
            return { ok: false, error: "sin-solucion-unica", variables: vars, aumentada: A.map((f, i) => [...f, b[i]]) };
        }
    }
    catch { }
    try {
        const sol = math.lusolve(A, b) as number[][] | {
            toArray(): number[][];
        };
        const arr = Array.isArray(sol) ? sol : sol.toArray();
        const valores = arr.map(f => limpia(Array.isArray(f) ? Number(f[0]) : Number(f)));
        if (!valores.every(x => Number.isFinite(x)))
            return { ok: false, error: "sin-solucion-unica" };
        for (let i = 0; i < A.length; i++) {
            const suma = A[i].reduce((acc, coef, j) => acc + coef * valores[j], 0);
            const escala = 1 + Math.abs(b[i]) + A[i].reduce((acc, c) => acc + Math.abs(c), 0);
            if (!Number.isFinite(suma) || Math.abs(suma - b[i]) > 1e-7 * escala) {
                return { ok: false, error: "sin-solucion-unica", variables: vars, aumentada: A.map((f, k) => [...f, b[k]]) };
            }
        }
        return { ok: true, valores, variables: vars, aumentada: A.map((f, i) => [...f, b[i]]) };
    }
    catch {
        return { ok: false, error: "sin-solucion-unica", variables: vars, aumentada: A.map((f, i) => [...f, b[i]]) };
    }
}
export class CalcSolveService {
    resolver = resolver;
    resolverSistema = resolverSistema;
    aCero = aCero;
}
