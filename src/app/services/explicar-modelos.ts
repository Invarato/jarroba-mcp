export type Tarea = "clasificacion" | "regresion";
export type TipoModelo = "arbol" | "bosque" | "boosting" | "lineal";
export interface Datos {
    columnas: string[];
    X: number[][];
    y: number[];
    tarea: Tarea;
}
export interface Modelo {
    tipo: TipoModelo;
    tarea: Tarea;
    predecir(x: readonly number[]): number;
}
export function generador(semilla: number): () => number {
    let a = semilla >>> 0;
    return () => {
        a = (a + 1831565813) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
interface Nodo {
    hoja: boolean;
    valor: number;
    n: number;
    var?: number;
    umbral?: number;
    izq?: Nodo;
    der?: Nodo;
}
export interface OpcionesArbol {
    profundidad: number;
    minHoja: number;
    variables?: (d: number) => number[];
}
export function arbol(X: number[][], y: number[], o: OpcionesArbol, filas?: number[]): Nodo {
    const d = X[0]?.length ?? 0;
    const media = (ids: number[]) => ids.reduce((s, i) => s + y[i], 0) / Math.max(1, ids.length);
    const construir = (ids: number[], prof: number): Nodo => {
        const m = media(ids);
        if (prof >= o.profundidad || ids.length < 2 * o.minHoja)
            return { hoja: true, valor: m, n: ids.length };
        let mejor: {
            v: number;
            u: number;
            ganancia: number;
            izq: number[];
            der: number[];
        } | null = null;
        const sse = (s: number, s2: number, n: number) => s2 - (s * s) / n;
        let s = 0, s2 = 0;
        for (const i of ids) {
            s += y[i];
            s2 += y[i] * y[i];
        }
        const base = sse(s, s2, ids.length);
        for (const v of o.variables ? o.variables(d) : Array.from({ length: d }, (_, k) => k)) {
            const orden = ids.slice().sort((a, b) => X[a][v] - X[b][v]);
            let ls = 0, ls2 = 0;
            for (let k = 0; k < orden.length - 1; k++) {
                const yi = y[orden[k]];
                ls += yi;
                ls2 += yi * yi;
                const nl = k + 1, nr = orden.length - nl;
                if (nl < o.minHoja || nr < o.minHoja || X[orden[k]][v] === X[orden[k + 1]][v])
                    continue;
                const ganancia = base - sse(ls, ls2, nl) - sse(s - ls, s2 - ls2, nr);
                if (ganancia > 1e-12 && (!mejor || ganancia > mejor.ganancia)) {
                    mejor = { v, u: (X[orden[k]][v] + X[orden[k + 1]][v]) / 2, ganancia, izq: orden.slice(0, nl), der: orden.slice(nl) };
                }
            }
        }
        if (!mejor)
            return { hoja: true, valor: m, n: ids.length };
        return { hoja: false, valor: m, n: ids.length, var: mejor.v, umbral: mejor.u, izq: construir(mejor.izq, prof + 1), der: construir(mejor.der, prof + 1) };
    };
    return construir(filas ?? y.map((_, i) => i), 0);
}
export function predecirArbol(n: Nodo, x: readonly number[]): number {
    while (!n.hoja)
        n = x[n.var!] <= n.umbral! ? n.izq! : n.der!;
    return n.valor;
}
function escalador(X: number[][]) {
    const d = X[0]?.length ?? 0, n = X.length;
    const mu = Array.from({ length: d }, (_, k) => X.reduce((s, r) => s + r[k], 0) / n);
    const sd = Array.from({ length: d }, (_, k) => Math.sqrt(X.reduce((s, r) => s + (r[k] - mu[k]) ** 2, 0) / n) || 1);
    return (x: readonly number[]) => x.map((v, k) => (v - mu[k]) / sd[k]);
}
export function resolver(A: number[][], b: number[]): number[] {
    const n = b.length, M = A.map((r, i) => [...r, b[i]]);
    for (let c = 0; c < n; c++) {
        let p = c;
        for (let r = c + 1; r < n; r++)
            if (Math.abs(M[r][c]) > Math.abs(M[p][c]))
                p = r;
        [M[c], M[p]] = [M[p], M[c]];
        const piv = M[c][c] || 1e-12;
        for (let r = 0; r < n; r++) {
            if (r === c)
                continue;
            const f = M[r][c] / piv;
            for (let k = c; k <= n; k++)
                M[r][k] -= f * M[c][k];
        }
    }
    return M.map((r, i) => r[n] / (r[i] || 1e-12));
}
export function ajusteLineal(Z: number[][], y: number[], pesos?: number[], lambda = 0.001): number[] {
    const d = Z[0].length + 1;
    const A = Array.from({ length: d }, () => new Array(d).fill(0)), b = new Array(d).fill(0);
    Z.forEach((z, i) => {
        const w = pesos ? pesos[i] : 1, zz = [...z, 1];
        for (let a = 0; a < d; a++) {
            b[a] += w * zz[a] * y[i];
            for (let c = 0; c < d; c++)
                A[a][c] += w * zz[a] * zz[c];
        }
    });
    for (let a = 0; a < d - 1; a++)
        A[a][a] += lambda;
    return resolver(A, b);
}
function lineal(datos: Datos): Modelo {
    const esc = escalador(datos.X), Z = datos.X.map(esc);
    const sig = (t: number) => 1 / (1 + Math.exp(-t));
    let w: number[];
    if (datos.tarea === "regresion")
        w = ajusteLineal(Z, datos.y, undefined, 0.01);
    else {
        const d = Z[0].length;
        w = new Array(d + 1).fill(0);
        for (let it = 0; it < 400; it++) {
            const g = new Array(d + 1).fill(0);
            Z.forEach((z, i) => { const e = sig(z.reduce((s, v, k) => s + v * w[k], w[d])) - datos.y[i]; z.forEach((v, k) => (g[k] += e * v)); g[d] += e; });
            for (let k = 0; k <= d; k++)
                w[k] -= (0.5 * (g[k] / Z.length + (k < d ? 0.001 * w[k] : 0)));
        }
    }
    const d = datos.X[0].length;
    return {
        tipo: "lineal",
        tarea: datos.tarea,
        predecir: x => { const z = esc(x), t = z.reduce((s, v, k) => s + v * w[k], w[d]); return datos.tarea === "regresion" ? t : sig(t); },
    };
}
export interface OpcionesModelo {
    profundidad: number;
    arboles: number;
    tasa: number;
    semilla?: number;
}
export const OPCIONES_DEFECTO: OpcionesModelo = { profundidad: 4, arboles: 60, tasa: 0.1, semilla: 1 };
export function entrenar(tipo: TipoModelo, datos: Datos, o: OpcionesModelo = OPCIONES_DEFECTO): Modelo {
    const { X, y, tarea } = datos, azar = generador(o.semilla ?? 1), minHoja = Math.max(2, Math.round(X.length / 200));
    if (tipo === "lineal")
        return lineal(datos);
    if (tipo === "arbol") {
        const t = arbol(X, y, { profundidad: o.profundidad, minHoja });
        return { tipo, tarea, predecir: x => predecirArbol(t, x) };
    }
    if (tipo === "bosque") {
        const raizD = (d: number) => {
            const k = Math.max(1, Math.round(Math.sqrt(d))), todas = Array.from({ length: d }, (_, i) => i);
            for (let i = d - 1; i > 0; i--) {
                const j = Math.floor(azar() * (i + 1));
                [todas[i], todas[j]] = [todas[j], todas[i]];
            }
            return todas.slice(0, k);
        };
        const arboles = Array.from({ length: o.arboles }, () => {
            const filas = Array.from({ length: X.length }, () => Math.floor(azar() * X.length));
            return arbol(X, y, { profundidad: Math.max(o.profundidad, 6), minHoja, variables: raizD }, filas);
        });
        return { tipo, tarea, predecir: x => arboles.reduce((s, t) => s + predecirArbol(t, x), 0) / arboles.length };
    }
    const sig = (t: number) => 1 / (1 + Math.exp(-t));
    const media = y.reduce((s, v) => s + v, 0) / y.length;
    const base = tarea === "regresion" ? media : Math.log(Math.max(0.000001, media) / Math.max(0.000001, 1 - media));
    const F = new Array(y.length).fill(base), arboles: Nodo[] = [];
    for (let m = 0; m < o.arboles; m++) {
        const r = y.map((v, i) => (tarea === "regresion" ? v - F[i] : v - sig(F[i])));
        const t = arbol(X, r, { profundidad: Math.min(o.profundidad, 3), minHoja });
        arboles.push(t);
        X.forEach((x, i) => (F[i] += o.tasa * predecirArbol(t, x)));
    }
    return {
        tipo,
        tarea,
        predecir: x => { const f = arboles.reduce((s, t) => s + o.tasa * predecirArbol(t, x), base); return tarea === "regresion" ? f : sig(f); },
    };
}
export function puntuar(m: Modelo, X: number[][], y: number[]): number {
    if (!X.length)
        return 0;
    if (m.tarea === "clasificacion")
        return X.filter((x, i) => (m.predecir(x) >= 0.5 ? 1 : 0) === y[i]).length / X.length;
    const media = y.reduce((s, v) => s + v, 0) / y.length;
    const ssr = X.reduce((s, x, i) => s + (y[i] - m.predecir(x)) ** 2, 0), sst = y.reduce((s, v) => s + (v - media) ** 2, 0);
    return 1 - ssr / (sst || 1);
}
export function partir(n: number, prueba = 0.25, semilla = 1): {
    train: number[];
    test: number[];
} {
    const azar = generador(semilla), ids = Array.from({ length: n }, (_, i) => i);
    for (let i = n - 1; i > 0; i--) {
        const j = Math.floor(azar() * (i + 1));
        [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    const k = Math.round(n * prueba);
    return { test: ids.slice(0, k), train: ids.slice(k) };
}
export interface Tabla {
    columnas: string[];
    filas: string[][];
}
export function leerCsv(texto: string): Tabla | null {
    const lineas = texto.replace(/\r/g, "").split("\n").filter(l => l.trim());
    if (lineas.length < 3)
        return null;
    const sep = [",", ";", "\t"].map(s => [s, lineas[0].split(s).length] as const).sort((a, b) => b[1] - a[1])[0][0];
    const partir1 = (l: string) => {
        const out: string[] = [];
        let cur = "", comillas = false;
        for (let i = 0; i < l.length; i++) {
            const c = l[i];
            if (c === "\"") {
                if (comillas && l[i + 1] === "\"") {
                    cur += "\"";
                    i++;
                }
                else
                    comillas = !comillas;
            }
            else if (c === sep && !comillas) {
                out.push(cur.trim());
                cur = "";
            }
            else
                cur += c;
        }
        out.push(cur.trim());
        return out;
    };
    const columnas = partir1(lineas[0]);
    const filas = lineas.slice(1).map(partir1).filter(f => f.length === columnas.length);
    return filas.length >= 2 ? { columnas, filas } : null;
}
const numero = (s: string) => { const t = s.replace(/\s/g, "").replace(",", "."); return t !== "" && Number.isFinite(Number(t)) ? Number(t) : NaN; };
export interface Preparado extends Datos {
    categorias: (string[] | null)[];
    positiva?: string;
}
export function preparar(t: Tabla, objetivo: number, maxFilas = 2000): Preparado | null {
    const filas = t.filas.slice(0, maxFilas);
    const vars = t.columnas.map((_, i) => i).filter(i => i !== objetivo);
    const categorias = vars.map(i => {
        const vals = filas.map(f => f[i]);
        return vals.every(v => !Number.isNaN(numero(v))) ? null : [...new Set(vals)].sort();
    });
    const yTxt = filas.map(f => f[objetivo]);
    const yNum = yTxt.map(numero);
    let tarea: Tarea, y: number[], positiva: string | undefined;
    const distintos = [...new Set(yTxt)].sort();
    if (distintos.length === 2) {
        tarea = "clasificacion";
        positiva = distintos.includes("1") && distintos.includes("0") ? "1" : distintos[1];
        y = yTxt.map(v => (v === positiva ? 1 : 0));
    }
    else if (yNum.every(v => !Number.isNaN(v))) {
        tarea = "regresion";
        y = yNum;
    }
    else
        return null;
    const X = filas.map(f => vars.map((i, k) => (categorias[k] ? categorias[k]!.indexOf(f[i]) : numero(f[i]))));
    if (X.length < 10)
        return null;
    return { columnas: vars.map(i => t.columnas[i]), X, y, tarea, categorias, positiva };
}
export type IdEjemplo = "credito" | "pisos";
export function ejemplo(id: IdEjemplo, n = 600, semilla = 5): Tabla {
    const azar = generador(semilla), g = () => { let s = 0; for (let k = 0; k < 6; k++)
        s += azar(); return s - 3; };
    if (id === "credito") {
        const columnas = ["ingresos", "deuda", "anos_trabajo", "edad", "dia_nacimiento", "devuelve"];
        const filas = Array.from({ length: n }, () => {
            const ingresos = Math.round(1500 + 700 * g() + 0 * azar()), deuda = Math.round(Math.max(0, 8000 + 5000 * g())), anos = Math.max(0, Math.round(6 + 4 * g()));
            const edad = Math.max(19, Math.round(25 + anos + 6 * azar())), dia = 1 + Math.floor(azar() * 28);
            const z = 0.003 * (ingresos - 1500) - 0.00025 * (deuda - 8000) + 0.15 * (anos - 6) + 0.0004 * Math.max(0, ingresos - 1500) * (anos > 6 ? 1 : 0) + 0.8 * g();
            return [ingresos, deuda, anos, edad, dia, z > 0 ? 1 : 0].map(String);
        });
        return { columnas, filas };
    }
    const barrios = ["afueras", "ensanche", "centro"], extra = [0, 60, 150];
    const columnas = ["metros", "barrio", "planta", "ascensor", "puerta", "precio"];
    const filas = Array.from({ length: n }, () => {
        const metros = Math.round(Math.max(30, 85 + 25 * g())), b = Math.floor(azar() * 3), planta = Math.floor(azar() * 8), asc = azar() < 0.6 ? 1 : 0;
        const puerta = 1 + Math.floor(azar() * 6);
        const precio = 2.2 * metros + extra[b] + (asc ? 6 * planta : -4 * planta) + 15 * g();
        return [String(metros), barrios[b], String(planta), asc ? "s\u00ED" : "no", String(puerta), String(Math.round(precio))];
    });
    return { columnas, filas };
}
