import { mezclar, phExacto, type Disolucion } from "./ph";
export interface PuntoCurva {
    v: number;
    pH: number;
}
export interface PuntoEquivalencia {
    v: number;
    pH: number;
    pendiente: number;
}
export interface Valoracion {
    analito: Disolucion;
    vAnalito: number;
    valorante: Disolucion;
}
export function phTrasAnadir(val: Valoracion, v: number): number {
    if (!(v > 0))
        return phExacto(val.analito).pH;
    return phExacto(mezclar([{ volumen: val.vAnalito, disolucion: val.analito }, { volumen: v, disolucion: val.valorante }])).pH;
}
export function curva(val: Valoracion, vMax: number, n = 400): PuntoCurva[] {
    const pasos = Math.max(2, Math.min(5000, Math.floor(n)));
    return Array.from({ length: pasos + 1 }, (_, i) => { const v = vMax * i / pasos; return { v, pH: phTrasAnadir(val, v) }; });
}
export function puntosEquivalencia(val: Valoracion, vMax: number, opciones: {
    n?: number;
    umbral?: number;
    prominencia?: number;
} = {}): PuntoEquivalencia[] {
    const n = Math.max(50, Math.min(20000, Math.floor(opciones.n ?? 4000)));
    const umbral = opciones.umbral ?? 0.5, prom = opciones.prominencia ?? 3;
    const h = vMax / n;
    const pend = (v: number) => {
        const d = Math.min(h / 2, v);
        return Math.abs(phTrasAnadir(val, v + h / 2) - phTrasAnadir(val, v - d)) / (h / 2 + d);
    };
    const p = Array.from({ length: n + 1 }, (_, i) => pend(i * h));
    const out: PuntoEquivalencia[] = [];
    for (let i = 1; i < n; i++) {
        if (!(p[i] >= p[i - 1] && p[i] > p[i + 1] && p[i] > umbral))
            continue;
        const w = Math.max(2, Math.round(n * 0.05));
        const valle = Math.min(Math.min(...p.slice(Math.max(0, i - w), i)), Math.min(...p.slice(i + 1, i + 1 + w)));
        if (p[i] < prom * valle)
            continue;
        let a = (i - 1) * h, b = (i + 1) * h;
        const g = (Math.sqrt(5) - 1) / 2;
        for (let k = 0; k < 60; k++) {
            const c = b - g * (b - a), d = a + g * (b - a);
            if (pend(c) > pend(d))
                b = d;
            else
                a = c;
        }
        const v = (a + b) / 2;
        out.push({ v, pH: phTrasAnadir(val, v), pendiente: pend(v) });
    }
    return out;
}
export function volumenParaPH(val: Valoracion, pH: number, v0: number, v1: number): number | null {
    let a = v0, b = v1;
    const fa = phTrasAnadir(val, a) - pH, fb = phTrasAnadir(val, b) - pH;
    if (fa === 0)
        return a;
    if (fb === 0)
        return b;
    if (Math.sign(fa) === Math.sign(fb))
        return null;
    for (let k = 0; k < 100 && b - a > 1e-10; k++) {
        const m = (a + b) / 2, fm = phTrasAnadir(val, m) - pH;
        if (Math.sign(fm) === Math.sign(fa))
            a = m;
        else
            b = m;
    }
    return (a + b) / 2;
}
export interface Indicador {
    id: string;
    viraje: [
        number,
        number
    ];
}
export interface EleccionIndicador {
    id: string;
    vCambio: number | null;
    errorPct: number | null;
}
export function elegirIndicador(val: Valoracion, eq: PuntoEquivalencia, tramo: [
    number,
    number
], indicadores: Indicador[]): EleccionIndicador[] {
    const res = indicadores.map(ind => {
        const centro = (ind.viraje[0] + ind.viraje[1]) / 2;
        const vC = volumenParaPH(val, centro, tramo[0], tramo[1]);
        return { id: ind.id, vCambio: vC, errorPct: vC === null || eq.v === 0 ? null : 100 * (vC - eq.v) / eq.v };
    });
    return res.sort((x, y) => (x.errorPct === null ? 1 : 0) - (y.errorPct === null ? 1 : 0) || Math.abs(x.errorPct ?? 0) - Math.abs(y.errorPct ?? 0));
}
