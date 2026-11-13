export interface Par {
    a: string;
    b: string;
    igual: boolean;
}
export const UMBRALES: readonly number[] = Array.from({ length: 50 }, (_, i) => Math.round((0.5 + i * 0.01) * 100) / 100);
export function leerPares(texto: string): Par[] {
    const out: Par[] = [];
    for (const linea of texto.split("\n")) {
        const m = linea.match(/^(.+?)\s+(=|≠|!=)\s+(.+)$/);
        if (!m)
            continue;
        const a = m[1].trim(), b = m[3].trim();
        if (a && b)
            out.push({ a, b, igual: m[2] === "=" });
    }
    return out;
}
export interface Curvas {
    umbral: number[];
    aciertos: number[];
    equivocados: number[];
}
const r3 = (x: number) => Math.round(x * 1000) / 1000;
export function curvas(cosenos: readonly number[], iguales: readonly boolean[]): Curvas {
    const n = cosenos.length;
    const aciertos: number[] = [], equivocados: number[] = [];
    for (const u of UMBRALES) {
        let si = 0, mal = 0;
        for (let i = 0; i < n; i++)
            if (cosenos[i] >= u) {
                si++;
                if (!iguales[i])
                    mal++;
            }
        aciertos.push(n ? r3(si / n) : 0);
        equivocados.push(si ? r3(mal / si) : 0);
    }
    return { umbral: [...UMBRALES], aciertos, equivocados };
}
export function umbralDeLaLista(u: number): number {
    return UMBRALES.reduce((m, x) => (Math.abs(x - u) < Math.abs(m - u) ? x : m), UMBRALES[0]);
}
export interface CacheParaArchsim extends Curvas {
    v: 1;
    n: number;
    elegido: number;
    modelo: string;
}
export function paraArchsim(c: Curvas, n: number, elegido: number, modelo: string): CacheParaArchsim {
    return { v: 1, n, elegido: umbralDeLaLista(elegido), umbral: c.umbral, aciertos: c.aciertos, equivocados: c.equivocados, modelo };
}
export function umbralSugerido(c: Curvas, maxEquivocados = 0.05): number | null {
    for (let i = 0; i < c.umbral.length; i++)
        if (c.aciertos[i] > 0 && c.equivocados[i] <= maxEquivocados)
            return c.umbral[i];
    return null;
}
