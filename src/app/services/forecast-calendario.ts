import { ConfigModelo, Prevision, prever } from "./forecast-modelos";
export interface EfectoCalendario {
    tipo: "multiplicativo" | "aditivo";
    valor: number;
    n: number;
}
function mediana(v: number[]): number {
    const s = [...v].sort((a, b) => a - b);
    const k = s.length;
    return k % 2 ? s[(k - 1) / 2] : (s[k / 2 - 1] + s[k / 2]) / 2;
}
function dispersion(v: number[]): number {
    const md = mediana(v);
    const mad = mediana(v.map(x => Math.abs(x - md)));
    return mad / (Math.abs(md) || 1e-9);
}
export function estimarEfecto(y: readonly number[], x: readonly number[], m: number): EfectoCalendario | null {
    const paso = Math.max(1, m);
    const diffs: number[] = [], razones: number[] = [];
    for (let t = 0; t < y.length; t++) {
        if (!x[t])
            continue;
        const refs: number[] = [];
        for (const k of [-2, -1, 1, 2]) {
            const j = t + k * paso;
            if (j >= 0 && j < y.length && !x[j])
                refs.push(y[j]);
        }
        if (!refs.length)
            continue;
        const ref = refs.reduce((s, v) => s + v, 0) / refs.length;
        diffs.push(y[t] - ref);
        if (ref > 0 && y[t] >= 0)
            razones.push(y[t] / ref);
    }
    if (!diffs.length)
        return null;
    const mult = razones.length === diffs.length && dispersion(razones) < dispersion(diffs);
    return mult ? { tipo: "multiplicativo", valor: mediana(razones), n: razones.length } : { tipo: "aditivo", valor: mediana(diffs), n: diffs.length };
}
export function quitarEfecto(y: readonly number[], x: readonly number[], e: EfectoCalendario): number[] {
    return y.map((v, t) => (!x[t] ? v : e.tipo === "multiplicativo" ? (e.valor > 0 ? v / e.valor : v) : v - e.valor));
}
export function ponerEfecto(p: Prevision, xFuturo: readonly number[], e: EfectoCalendario): Prevision {
    const f = (arr: number[]) => arr.map((v, i) => (!xFuturo[i] ? v : e.tipo === "multiplicativo" ? v * e.valor : v + e.valor));
    return { ...p, media: f(p.media), inferior: f(p.inferior), superior: f(p.superior) };
}
export function preverConCalendario(y: readonly number[], xPasado: readonly number[], xFuturo: readonly number[], h: number, nivel: number, cfg: ConfigModelo): {
    prevision: Prevision;
    efecto: EfectoCalendario | null;
} {
    const e = estimarEfecto(y, xPasado, cfg.m);
    if (!e) {
        const p = prever(y, h, nivel, cfg);
        return { prevision: { ...p, avisos: [...p.avisos, "calendario.sin-datos"] }, efecto: null };
    }
    const ajustada = quitarEfecto(y, xPasado, e);
    return { prevision: ponerEfecto(prever(ajustada, h, nivel, cfg), xFuturo, e), efecto: e };
}
