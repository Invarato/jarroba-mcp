import { diaDe } from "../shared/dias";
export type FestivoDato = [
    string,
    string,
    string[]?
];
export interface PaisFestivos {
    nombre: string;
    fuente: string;
    anios: number[];
    regiones: Record<string, string>;
    festivos: FestivoDato[];
    notas?: {
        anio?: number;
        regiones?: string[];
        texto?: string;
        id?: string;
    }[];
    boe?: Record<string, string>;
}
export interface DatosFestivos {
    generado: string;
    paises: Record<string, PaisFestivos>;
}
export function festivosDe(datos: DatosFestivos | null, pais: string, regiones: readonly string[]): Map<number, string> {
    const out = new Map<number, string>();
    const p = datos?.paises[pais];
    if (!p)
        return out;
    const todas = Object.keys(p.regiones ?? {});
    for (const [fecha, nombre, regs] of p.festivos) {
        const nacional = !regs || (todas.length > 0 && todas.every(r => regs.includes(r)));
        if (!nacional && !regs.some(r => regiones.includes(r)))
            continue;
        const d = diaDe(fecha);
        if (d !== null && !out.has(d))
            out.set(d, nombre);
    }
    return out;
}
export function aniosSinDatos(datos: DatosFestivos | null, pais: string, desde: number, hasta: number): number[] {
    const y0 = new Date(Math.min(desde, hasta) * 86400000).getUTCFullYear();
    const y1 = new Date(Math.max(desde, hasta) * 86400000).getUTCFullYear();
    const tiene = new Set(datos?.paises[pais]?.anios ?? []);
    const faltan: number[] = [];
    for (let y = y0; y <= y1 && faltan.length < 200; y++)
        if (!tiene.has(y))
            faltan.push(y);
    return faltan;
}
export function esDatosFestivos(x: unknown): x is DatosFestivos {
    const d = x as DatosFestivos;
    return !!d && typeof d === "object" && typeof d.paises === "object" && d.paises !== null
        && Object.values(d.paises).every(p => Array.isArray(p?.festivos) && Array.isArray(p?.anios));
}
