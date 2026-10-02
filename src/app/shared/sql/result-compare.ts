export function norma(v: unknown): string {
    if (v === null || v === undefined)
        return "\u2205";
    if (v instanceof Date)
        return isNaN(v.getTime()) ? String(v) : v.toISOString();
    if (typeof v === "bigint")
        return String(v);
    const n = typeof v === "number" ? v : (typeof v === "string" && /^-?\d+(\.\d+)?$/.test(v.trim()) ? Number(v) : NaN);
    if (Number.isFinite(n))
        return String(Math.round(n * 1000000) / 1000000);
    if (typeof v === "object")
        return JSON.stringify(v);
    return String(v);
}
const clave = (fila: unknown[]) => JSON.stringify(fila.map(norma));
export interface DiffFilas {
    iguales: boolean;
    soloA: unknown[][];
    soloB: unknown[][];
}
export function diffFilas(a: unknown[][], b: unknown[][], ordenado = false): DiffFilas {
    if (ordenado) {
        let i = 0;
        while (i < a.length && i < b.length && clave(a[i]) === clave(b[i]))
            i++;
        const iguales = i === a.length && i === b.length;
        return { iguales, soloA: iguales ? [] : a.slice(i), soloB: iguales ? [] : b.slice(i) };
    }
    const cuenta = new Map<string, {
        n: number;
        fila: unknown[];
    }>();
    for (const f of a) {
        const k = clave(f);
        const e = cuenta.get(k);
        if (e)
            e.n++;
        else
            cuenta.set(k, { n: 1, fila: f });
    }
    const soloB: unknown[][] = [];
    for (const f of b) {
        const e = cuenta.get(clave(f));
        if (e && e.n > 0)
            e.n--;
        else
            soloB.push(f);
    }
    const soloA: unknown[][] = [];
    for (const { n, fila } of cuenta.values())
        for (let i = 0; i < n; i++)
            soloA.push(fila);
    return { iguales: !soloA.length && !soloB.length, soloA, soloB };
}
export function contieneResultado(oro: Record<string, unknown>[], resp: Record<string, unknown>[], orden = false): boolean {
    if (oro.length !== resp.length)
        return false;
    if (!oro.length)
        return true;
    const co = Object.keys(oro[0]), cr = Object.keys(resp[0]);
    if (cr.length < co.length)
        return false;
    const O = oro.map(f => co.map(c => norma(f[c])));
    const R = resp.map(f => cr.map(c => norma(f[c])));
    const claves = (filas: string[][]) => { const k = filas.map(f => JSON.stringify(f)); return orden ? k : k.sort(); };
    const objetivo = claves(O).join("\n");
    const probar = (i: number, usadas: Set<number>, elegidas: number[]): boolean => {
        if (i === co.length)
            return claves(R.map(f => elegidas.map(j => f[j]))).join("\n") === objetivo;
        for (let j = 0; j < cr.length; j++) {
            if (usadas.has(j))
                continue;
            usadas.add(j);
            if (probar(i + 1, usadas, [...elegidas, j]))
                return true;
            usadas.delete(j);
        }
        return false;
    };
    return probar(0, new Set(), []);
}
