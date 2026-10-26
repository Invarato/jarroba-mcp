export interface SistemaCalculo {
    id: "nuevo" | "anterior";
    meses: number;
    mejores: number;
    divisor: number;
    fuente: string;
}
export type TipoLaguna = "100" | "80" | "50";
export interface MesCalculo {
    mes: string;
    cotizada: number | null;
    laguna: TipoLaguna | null;
    base: number;
    factor: number;
    actualizada: number;
    elegida: boolean;
    desconocido?: true;
    supuesto?: true;
}
export interface ResultadoSistema {
    sistema: SistemaCalculo;
    meses: MesCalculo[];
    suma: number;
    baseReguladora: number;
    faltan: {
        mes: string;
        que: "ipc" | "base-minima" | "base";
    }[];
}
export interface EntradaBaseReguladora {
    hechoCausante: string;
    bases: Record<string, number | null>;
    supuestos?: Set<string>;
    ipc: (mes: string) => number | null;
    baseMinima: (mes: string) => number | null;
    lagunasMejoradas?: boolean;
}
const r2 = (x: number) => Math.round((x + Number.EPSILON) * 100) / 100;
export function mesMas(mes: string, n: number): string {
    const [a, m] = mes.split("-").map(Number);
    const t = a * 12 + (m - 1) + n;
    return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
}
export function calcularSistema(e: EntradaBaseReguladora, s: SistemaCalculo): ResultadoSistema {
    const faltan: ResultadoSistema["faltan"] = [];
    const referencia = mesMas(e.hechoCausante, -25);
    const ipcRef = e.ipc(referencia);
    const meses: MesCalculo[] = [];
    let lagunas = 0;
    for (let i = 1; i <= s.meses; i++) {
        const mes = mesMas(e.hechoCausante, -i);
        const conocido = mes in e.bases;
        const cotizada = e.bases[mes] ?? null;
        let laguna: TipoLaguna | null = null;
        let base = cotizada ?? 0;
        if (!conocido)
            faltan.push({ mes, que: "base" });
        else if (cotizada === null || cotizada <= 0) {
            lagunas++;
            const min = e.baseMinima(mes);
            if (min === null)
                faltan.push({ mes, que: "base-minima" });
            laguna = lagunas <= 48 || (e.lagunasMejoradas && lagunas <= 60) ? "100" : e.lagunasMejoradas && lagunas <= 84 ? "80" : "50";
            base = r2((min ?? 0) * (laguna === "100" ? 1 : laguna === "80" ? 0.8 : 0.5));
        }
        let factor = 1;
        if (i > 24) {
            const ipcMes = e.ipc(mes);
            if (ipcRef === null || ipcMes === null) {
                faltan.push({ mes, que: "ipc" });
            }
            else
                factor = ipcRef / ipcMes;
        }
        meses.push({
            mes,
            cotizada: cotizada !== null && cotizada > 0 ? cotizada : null,
            laguna,
            base,
            factor,
            actualizada: r2(base * factor),
            elegida: false,
            ...(conocido ? {} : { desconocido: true as const }),
            ...(e.supuestos?.has(mes) ? { supuesto: true as const } : {}),
        });
    }
    [...meses].sort((a, b) => b.actualizada - a.actualizada || b.mes.localeCompare(a.mes)).slice(0, s.mejores).forEach((m) => (m.elegida = true));
    const suma = r2(meses.filter((m) => m.elegida).reduce((t, m) => t + m.actualizada, 0));
    return { sistema: s, meses, suma, baseReguladora: r2(suma / s.divisor), faltan };
}
export function porcentajePorMeses(mesesCotizados: number, anyo = 2027): number {
    if (mesesCotizados < 180)
        return 0;
    const extra = mesesCotizados - 180;
    const [t1, p1, t2, p2] = anyo <= 2026 ? [49, 0.21, 209, 0.19] : [248, 0.19, 16, 0.18];
    const p = 50 + Math.min(extra, t1) * p1 + Math.min(Math.max(0, extra - t1), t2) * p2;
    return Math.min(100, Math.round(p * 100) / 100);
}
export function mesesDeDias(dias: number): number {
    const anyos = Math.floor(dias / 365);
    return anyos * 12 + Math.floor((dias - anyos * 365) / 30.41666);
}
const CALENDARIO_NUEVO: Record<number, [
    meses: number,
    mejores: number,
    divisor: number
]> = {
    2026: [304, 302, 352.33],
    2027: [308, 304, 354.67],
    2028: [312, 306, 357],
    2029: [316, 308, 359.33],
    2030: [320, 310, 361.67],
    2031: [324, 312, 364],
    2032: [328, 314, 366.33],
    2033: [332, 316, 368.67],
    2034: [336, 318, 371],
    2035: [340, 320, 373.33],
    2036: [344, 322, 375.67],
};
const ANTERIOR_TRANSICION: Record<number, [
    meses: number,
    divisor: number
]> = { 2041: [306, 357], 2042: [312, 364], 2043: [318, 371] };
export function sistemasPara(hechoCausante: string): SistemaCalculo[] {
    const anyo = Number(hechoCausante.slice(0, 4));
    const out: SistemaCalculo[] = [];
    if (anyo < 2026) {
        out.push({ id: "anterior", meses: 300, mejores: 300, divisor: 350, fuente: "LGSS art. 209.1 (redacci\u00F3n hasta 31-12-2025)" });
        return out;
    }
    const [meses, mejores, divisor] = CALENDARIO_NUEVO[anyo] ?? [348, 324, 378];
    out.push({ id: "nuevo", meses, mejores, divisor, fuente: anyo <= 2036 ? `LGSS DT 40.ª (${anyo})` : "LGSS art. 209.1" });
    if (anyo <= 2040)
        out.push({ id: "anterior", meses: 300, mejores: 300, divisor: 350, fuente: "LGSS DT 4.\u00AA.7 (art. 209.1 a 1-1-2023)" });
    else if (ANTERIOR_TRANSICION[anyo]) {
        const [m, d] = ANTERIOR_TRANSICION[anyo];
        out.push({ id: "anterior", meses: m, mejores: m, divisor: d, fuente: `LGSS DT 4.ª.7 (${anyo})` });
    }
    return out;
}
export interface ResultadoBaseReguladora {
    sistemas: ResultadoSistema[];
    elegido: ResultadoSistema;
}
export function calcularBaseReguladora(e: EntradaBaseReguladora): ResultadoBaseReguladora {
    const sistemas = sistemasPara(e.hechoCausante).map((s) => calcularSistema(s.id === "nuevo" ? e : { ...e, lagunasMejoradas: false }, s));
    const elegido = sistemas.reduce((a, b) => (b.baseReguladora > a.baseReguladora ? b : a));
    return { sistemas, elegido };
}
