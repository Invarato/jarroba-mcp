export interface SistemaAcido {
    C: number;
    pKa: number[];
    carga0: number;
    nombre?: string;
}
export interface Disolucion {
    sistemas: SistemaAcido[];
    espectadores: number;
    iones?: Record<string, number>;
}
export interface ResultadoPH {
    pH: number;
    alfas: number[][];
    residuo: number;
}
export const KW_25C = 1e-14;
export function fracciones(pKa: number[], pH: number): number[] {
    const n = pKa.length;
    const logs: number[] = [];
    let acum = 0;
    for (let i = 0; i <= n; i++) {
        logs.push(-(n - i) * pH - acum);
        if (i < n)
            acum += pKa[i];
    }
    const max = Math.max(...logs);
    const t = logs.map(l => Math.pow(10, l - max));
    const s = t.reduce((a, b) => a + b, 0);
    return t.map(x => x / s);
}
export function balanceCarga(d: Disolucion, pH: number, Kw = KW_25C): number {
    const h = Math.pow(10, -pH);
    let s = h - Kw / h + d.espectadores;
    for (const sis of d.sistemas) {
        const a = fracciones(sis.pKa, pH);
        s += sis.C * a.reduce((acc, ai, i) => acc + ai * (sis.carga0 - i), 0);
    }
    return s;
}
export function phExacto(d: Disolucion, Kw = KW_25C): ResultadoPH {
    let lo = -3, hi = 17;
    for (let k = 0; k < 200 && hi - lo > 1e-13; k++) {
        const mid = (lo + hi) / 2;
        if (balanceCarga(d, mid, Kw) > 0)
            lo = mid;
        else
            hi = mid;
    }
    const pH = (lo + hi) / 2;
    return { pH, alfas: d.sistemas.map(s => fracciones(s.pKa, pH)), residuo: balanceCarga(d, pH, Kw) };
}
export function mezclar(partes: {
    volumen: number;
    disolucion: Disolucion;
}[]): Disolucion {
    const vt = partes.reduce((s, p) => s + p.volumen, 0);
    return {
        sistemas: partes.flatMap(p => p.disolucion.sistemas.map(s => ({ ...s, C: s.C * p.volumen / vt }))),
        espectadores: partes.reduce((s, p) => s + p.disolucion.espectadores * p.volumen / vt, 0),
        iones: partes.reduce<Record<string, number>>((acc, p) => {
            for (const [ion, c] of Object.entries(p.disolucion.iones ?? {}))
                acc[ion] = (acc[ion] ?? 0) + c * p.volumen / vt;
            return acc;
        }, {}),
    };
}
