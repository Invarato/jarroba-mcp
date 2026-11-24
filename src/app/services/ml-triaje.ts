import { Datos, Modelo, Tabla, TipoModelo, entrenar, generador, leerCsv, preparar } from "./explicar-modelos";
export type Tarea = "clasificacion" | "regresion";
export type TipoColumna = "numerica" | "categorica" | "fecha" | "texto" | "id";
export type CodigoAviso = "desbalance" | "constante" | "huecos" | "fuga" | "id" | "muestreado" | "alta-cardinalidad" | "pocas-filas";
export type CodigoError = "vacio" | "pocas-filas" | "objetivo-no-existe" | "objetivo-no-valido" | "sin-variables";
export type ClaveModelo = "base" | TipoModelo;
export type Metrica = "accuracy" | "f1-macro" | "r2" | "mae";
export interface ColumnaTriaje {
    nombre: string;
    tipo: TipoColumna;
    huecos: number;
    distintos: number;
    usada: boolean;
}
export interface AvisoTriaje {
    codigo: CodigoAviso;
    columna?: string;
    valor?: number;
}
export interface ModeloTriaje {
    clave: ClaveModelo;
    metrica: Metrica;
    media: number;
    desv: number;
    pliegues: number;
    secundaria?: {
        metrica: Metrica;
        media: number;
    };
}
export interface Triaje {
    tarea: Tarea;
    objetivo: string;
    objetivoElegidoPor: "pedido" | "ultima-columna";
    filas: number;
    filasUsadas: number;
    columnas: ColumnaTriaje[];
    avisos: AvisoTriaje[];
    modelos: ModeloTriaje[];
    recomendado: {
        clave: ClaveModelo;
        bateALaBase: boolean;
        margen: number;
        empataCon?: TipoModelo;
    };
}
export interface ErrorTriaje {
    error: CodigoError;
    linea?: number;
}
export interface OpcionesTriaje {
    csv: string;
    objetivo?: string;
    semilla?: number;
    pliegues?: number;
}
export const MAX_FILAS_TRIAJE = 1500;
export const MIN_FILAS_TRIAJE = 20;
const MODELOS: readonly TipoModelo[] = ["lineal", "arbol", "bosque", "boosting"];
const vacia = (v: string) => v.trim() === "";
const numero = (v: string) => { const t = v.trim().replace(",", "."); return t === "" ? NaN : Number(t); };
const FECHA = /^\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2}(:\d{2})?)?$|^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$/;
const NOMBRE_ID = /\b(id|identificador|código|codigo|dni|nif|uuid)\b/i;
function esSecuencia(nums: number[]): boolean {
    if (nums.length < 2)
        return false;
    if (nums.every((v, i) => i === 0 || Math.abs(v - nums[i - 1]) === 1))
        return true;
    return nums.every((v, i) => i === 0 || v > nums[i - 1]) || nums.every((v, i) => i === 0 || v < nums[i - 1]);
}
function tipoDe(nombre: string, vals: string[], nFilas: number): TipoColumna {
    const llenas = vals.filter(v => !vacia(v)), distintos = new Set(llenas).size;
    if (!llenas.length)
        return "categorica";
    if (llenas.every(v => FECHA.test(v.trim())))
        return "fecha";
    const numericas = llenas.every(v => Number.isFinite(numero(v)));
    if (distintos === llenas.length && nFilas >= 20) {
        if (!numericas || NOMBRE_ID.test(nombre.replace(/[_-]+/g, " ")))
            return "id";
        if (llenas.every(v => Number.isInteger(numero(v))) && esSecuencia(llenas.map(numero)))
            return "id";
    }
    if (numericas)
        return "numerica";
    return distintos <= Math.max(20, nFilas * 0.05) ? "categorica" : "texto";
}
function barajar<T>(xs: T[], r: () => number): T[] {
    const a = xs.slice();
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(r() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}
function metricas(m: Modelo | null, X: number[][], y: number[], tarea: Tarea, base: number): {
    acc: number;
    f1: number;
    r2: number;
    mae: number;
} {
    const p = X.map(x => (m ? m.predecir(x) : base));
    if (tarea === "clasificacion") {
        const pred = p.map(v => (v >= 0.5 ? 1 : 0)), acc = pred.filter((v, i) => v === y[i]).length / (y.length || 1);
        const f1c = (c: 0 | 1) => { const tp = pred.filter((v, i) => v === c && y[i] === c).length, fp = pred.filter((v, i) => v === c && y[i] !== c).length, fn = pred.filter((v, i) => v !== c && y[i] === c).length; return tp ? (2 * tp) / (2 * tp + fp + fn) : 0; };
        return { acc, f1: (f1c(0) + f1c(1)) / 2, r2: 0, mae: 0 };
    }
    const media = y.reduce((s, v) => s + v, 0) / (y.length || 1), sst = y.reduce((s, v) => s + (v - media) ** 2, 0), sse = y.reduce((s, v, i) => s + (v - p[i]) ** 2, 0);
    return { acc: 0, f1: 0, r2: sst ? 1 - sse / sst : 0, mae: y.reduce((s, v, i) => s + Math.abs(v - p[i]), 0) / (y.length || 1) };
}
export function triar(o: OpcionesTriaje): Triaje | ErrorTriaje {
    const semilla = o.semilla ?? 1, K = Math.max(2, Math.min(10, Math.round(o.pliegues ?? 5)));
    if (!o.csv || !o.csv.trim())
        return { error: "vacio" };
    let tabla: Tabla | null;
    try {
        tabla = leerCsv(o.csv);
    }
    catch {
        tabla = null;
    }
    if (!tabla || tabla.filas.length < MIN_FILAS_TRIAJE)
        return { error: "pocas-filas", linea: tabla ? tabla.filas.length + 1 : undefined };
    const iObj = o.objetivo !== undefined ? tabla.columnas.indexOf(o.objetivo) : tabla.columnas.length - 1;
    if (iObj < 0)
        return { error: "objetivo-no-existe" };
    const r = generador(semilla), avisos: AvisoTriaje[] = [];
    const filasTotales = tabla.filas.length;
    let filas = tabla.filas.filter(f => !vacia(f[iObj] ?? ""));
    if (filas.length > MAX_FILAS_TRIAJE) {
        filas = barajar(filas, r).slice(0, MAX_FILAS_TRIAJE);
        avisos.push({ codigo: "muestreado", valor: MAX_FILAS_TRIAJE });
    }
    const yTxt = filas.map(f => f[iObj]), distintosY = [...new Set(yTxt)].sort();
    let tarea: Tarea;
    if (distintosY.length === 2)
        tarea = "clasificacion";
    else if (yTxt.every(v => Number.isFinite(numero(v))))
        tarea = "regresion";
    else
        return { error: "objetivo-no-valido" };
    const columnas: ColumnaTriaje[] = tabla.columnas.map((nombre, j) => {
        const vals = filas.map(f => f[j] ?? ""), llenas = vals.filter(v => !vacia(v));
        return { nombre, tipo: j === iObj ? (tarea === "regresion" ? "numerica" : "categorica") : tipoDe(nombre, vals, filas.length), huecos: 1 - llenas.length / (vals.length || 1), distintos: new Set(llenas).size, usada: false };
    });
    columnas.forEach((c, j) => {
        if (j === iObj)
            return;
        if (c.distintos <= 1)
            avisos.push({ codigo: "constante", columna: c.nombre });
        if (c.tipo === "id")
            avisos.push({ codigo: "id", columna: c.nombre });
        if (c.huecos > 0)
            avisos.push({ codigo: "huecos", columna: c.nombre, valor: Number(c.huecos.toFixed(3)) });
        if (c.tipo === "categorica" && c.distintos > 12)
            avisos.push({ codigo: "alta-cardinalidad", columna: c.nombre, valor: c.distintos });
        c.usada = c.distintos > 1 && (c.tipo === "numerica" || c.tipo === "categorica");
    });
    const usadas = columnas.map((c, j) => (c.usada ? j : -1)).filter(j => j >= 0);
    if (!usadas.length)
        return { error: "sin-variables" };
    if (tarea === "clasificacion") {
        const mayor = Math.max(...distintosY.map(v => yTxt.filter(x => x === v).length)) / yTxt.length;
        if (mayor >= 0.8)
            avisos.push({ codigo: "desbalance", columna: tabla.columnas[iObj], valor: Number(mayor.toFixed(3)) });
    }
    if (filas.length < 10 * usadas.length)
        avisos.push({ codigo: "pocas-filas", valor: filas.length });
    const t: Tabla = { columnas: [...usadas.map(j => tabla!.columnas[j]), tabla.columnas[iObj]], filas: filas.map(f => [...usadas.map(j => f[j] ?? ""), f[iObj]]) };
    const objT = usadas.length, orden = barajar(filas.map((_, i) => i), generador(semilla + 1)), pliegue = new Array<number>(filas.length);
    orden.forEach((i, k) => (pliegue[i] = k % K));
    const claves: ClaveModelo[] = ["base", ...MODELOS];
    const res = new Map<ClaveModelo, {
        acc: number;
        f1: number;
        r2: number;
        mae: number;
    }[]>(claves.map(c => [c, []]));
    const fugas = new Map<number, number[]>();
    for (let f = 0; f < K; f++) {
        const entreno = new Set(filas.map((_, i) => i).filter(i => pliegue[i] !== f));
        const d = preparar(t, objT, MAX_FILAS_TRIAJE, "media", entreno, "onehot");
        if (!d)
            return { error: "objetivo-no-valido" };
        const tr = d.origen.map((o2, i) => (entreno.has(o2) ? i : -1)).filter(i => i >= 0), te = d.origen.map((o2, i) => (entreno.has(o2) ? -1 : i)).filter(i => i >= 0);
        const sub = (ids: number[]): Datos => ({ ...d, X: ids.map(i => d.X[i]), y: ids.map(i => d.y[i]) });
        const dTr = sub(tr), dTe = sub(te);
        const base = tarea === "clasificacion" ? (dTr.y.filter(v => v === 1).length >= dTr.y.length / 2 ? 1 : 0) : dTr.y.reduce((s, v) => s + v, 0) / (dTr.y.length || 1);
        res.get("base")!.push(metricas(null, dTe.X, dTe.y, tarea, base));
        for (const m of MODELOS)
            res.get(m)!.push(metricas(entrenar(m, dTr, { profundidad: 4, arboles: 40, tasa: 0.1, semilla: semilla + f }), dTe.X, dTe.y, tarea, base));
        usadas.forEach((j, k) => {
            const nombre = tabla!.columnas[j], cols = d.columnas.map((c, i) => (c === nombre || c.startsWith(nombre + "=") ? i : -1)).filter(i => i >= 0);
            if (!cols.length)
                return;
            const solo = (D: Datos): Datos => ({ ...D, columnas: cols.map(i => D.columnas[i]), X: D.X.map(x => cols.map(i => x[i])) });
            const mm = metricas(entrenar("arbol", solo(dTr), { profundidad: 3, arboles: 1, tasa: 0.1, semilla }), solo(dTe).X, dTe.y, tarea, base);
            fugas.set(k, [...(fugas.get(k) ?? []), tarea === "clasificacion" ? mm.acc : mm.r2]);
        });
    }
    fugas.forEach((v, k) => {
        const media = v.reduce((s, x) => s + x, 0) / v.length;
        if (media >= (tarea === "clasificacion" ? 0.97 : 0.95))
            avisos.push({ codigo: "fuga", columna: tabla!.columnas[usadas[k]], valor: Number(media.toFixed(3)) });
    });
    const desbalance = avisos.some(a => a.codigo === "desbalance");
    const principal: Metrica = tarea === "regresion" ? "r2" : desbalance ? "f1-macro" : "accuracy";
    const secundaria: Metrica = tarea === "regresion" ? "mae" : desbalance ? "accuracy" : "f1-macro";
    const valor = (x: {
        acc: number;
        f1: number;
        r2: number;
        mae: number;
    }, m: Metrica) => (m === "accuracy" ? x.acc : m === "f1-macro" ? x.f1 : m === "r2" ? x.r2 : x.mae);
    const r4 = (v: number) => Number(v.toFixed(4));
    const modelos: ModeloTriaje[] = claves.map(clave => {
        const v = res.get(clave)!.map(x => valor(x, principal)), media = v.reduce((s, x) => s + x, 0) / v.length;
        const desv = Math.sqrt(v.reduce((s, x) => s + (x - media) ** 2, 0) / v.length);
        const v2 = res.get(clave)!.map(x => valor(x, secundaria));
        return { clave, metrica: principal, media: r4(media), desv: r4(desv), pliegues: K, secundaria: { metrica: secundaria, media: r4(v2.reduce((s, x) => s + x, 0) / v2.length) } };
    });
    const base = modelos[0];
    const bateBase = (m: ModeloTriaje) => m.media - base.media > Math.max(0.01, m.desv);
    const mejor = modelos.slice(1).reduce((a, b) => (b.media > a.media ? b : a));
    const elegido = bateBase(mejor) ? modelos.slice(1).find(m => bateBase(m) && m.media + m.desv >= mejor.media - mejor.desv) ?? mejor : null;
    const ref = elegido ?? mejor;
    return {
        tarea,
        objetivo: tabla.columnas[iObj],
        objetivoElegidoPor: o.objetivo !== undefined ? "pedido" : "ultima-columna",
        filas: filasTotales,
        filasUsadas: filas.length,
        columnas,
        avisos,
        modelos,
        recomendado: {
            clave: elegido ? elegido.clave : "base",
            bateALaBase: !!elegido,
            margen: r4(ref.media - base.media),
            ...(elegido && elegido.clave !== mejor.clave ? { empataCon: mejor.clave as TipoModelo } : {}),
        },
    };
}
export const esError = (t: Triaje | ErrorTriaje): t is ErrorTriaje => "error" in t;
