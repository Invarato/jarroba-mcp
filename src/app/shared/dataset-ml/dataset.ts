export const MAX_DATASET = 300000;
export const MAX_FILAS_DATASET = 5000;
export interface Dataset {
    columnas: string[];
    filas: string[][];
    numericas: number[];
    descartadas?: number;
    recortadas?: number;
}
const HUECO = /^(na|n\/a|nan|null|none|nil|\?|-|—)$/i;
export function normalizarCelda(v: string): string {
    const t = v.trim();
    if (HUECO.test(t))
        return "";
    if (/^[-+]?\d{1,3}(\.\d{3})+,\d+$/.test(t) || /^[-+]?\d{1,3}(\.\d{3}){2,}$/.test(t))
        return t.replace(/\./g, "").replace(",", ".");
    if (/^[-+]?\d{1,3}(,\d{3})+\.\d+$/.test(t) || /^[-+]?\d{1,3}(,\d{3}){2,}$/.test(t))
        return t.replace(/,/g, "");
    return t;
}
function partirRegistros(texto: string): string[] {
    const out: string[] = [];
    let cur = "", dentro = false;
    for (const c of texto.replace(/\r\n?/g, "\n")) {
        if (c === "\"")
            dentro = !dentro;
        if (c === "\n" && !dentro) {
            out.push(cur);
            cur = "";
        }
        else
            cur += c;
    }
    out.push(cur);
    return out;
}
const num = (v: string) => { const t = v.trim().replace(",", "."); return t === "" ? NaN : Number(t); };
const esNumero = (v: string) => Number.isFinite(num(v));
function partirLinea(l: string, sep: string): string[] {
    const out: string[] = [];
    let cur = "", dentro = false;
    for (let i = 0; i < l.length; i++) {
        const c = l[i];
        if (c === "\"") {
            if (dentro && l[i + 1] === "\"") {
                cur += "\"";
                i++;
            }
            else
                dentro = !dentro;
        }
        else if (c === sep && !dentro) {
            out.push(cur.trim());
            cur = "";
        }
        else
            cur += c;
    }
    out.push(cur.trim());
    return out;
}
export function trocearCsv(texto: string): string[][] {
    const lineas = partirRegistros(texto).filter(l => l.trim());
    if (!lineas.length)
        return [];
    const sep = [";", "\t", ","].map(s => [s, partirLinea(lineas[0], s).length] as const).sort((a, b) => b[1] - a[1])[0][0];
    return lineas.map(l => partirLinea(l, sep).map(normalizarCelda));
}
export function leerDataset(texto: string, maxFilas = MAX_FILAS_DATASET): Dataset | null {
    const todas = trocearCsv(texto);
    if (todas.length < 2)
        return null;
    const ancho = todas[0].length;
    if (ancho < 2)
        return null;
    const primera = todas[0], segunda = todas[1] ?? [];
    const cabecera = primera.some((v, j) => !esNumero(v) && (esNumero(segunda[j] ?? "") || primera.every(x => !esNumero(x))));
    const columnas = cabecera ? primera.map((c, j) => c || `c${j + 1}`) : primera.map((_, j) => `c${j + 1}`);
    const datos = cabecera ? todas.slice(1) : todas;
    const completas = datos.filter(f => f.length === ancho), filas = completas.slice(0, maxFilas);
    if (filas.length < 2)
        return null;
    const numericas = columnas.map((_, j) => j).filter(j => { const llenas = filas.map(f => f[j]).filter(v => v.trim() !== ""); return llenas.length > 0 && llenas.every(esNumero); });
    const descartadas = datos.length - completas.length, recortadas = completas.length - filas.length;
    return { columnas, filas, numericas, ...(descartadas ? { descartadas } : {}), ...(recortadas ? { recortadas } : {}) };
}
export function filasCompletas(ds: Dataset, numericas: readonly number[], noVacias: readonly number[] = []): string[][] {
    return ds.filas.filter(f => numericas.every(j => esNumero(f[j] ?? "")) && noVacias.every(j => (f[j] ?? "") !== ""));
}
export function puntosDe(ds: Dataset, cx: number, cy: number, max = MAX_FILAS_DATASET): [
    number,
    number
][] {
    const out: [
        number,
        number
    ][] = [];
    for (const f of ds.filas) {
        const x = num(f[cx] ?? ""), y = num(f[cy] ?? "");
        if (Number.isFinite(x) && Number.isFinite(y))
            out.push([x, y]);
        if (out.length >= max)
            break;
    }
    return out;
}
export function aCsv(columnas: readonly string[], filas: readonly (readonly (string | number)[])[]): string {
    const celda = (v: string | number) => { const t = String(v); return /[",\n]/.test(t) ? `"${t.replace(/"/g, "\"\"")}"` : t; };
    return [columnas, ...filas].map(f => f.map(celda).join(",")).join("\n");
}
export function columnasXY(ds: Dataset): [
    number,
    number
] | null {
    return ds.numericas.length >= 2 ? [ds.numericas[0], ds.numericas[ds.numericas.length - 1]] : null;
}
