import { Injectable } from "@angular/core";
export type AlgoritmoReemplazo = "LRU" | "FIFO" | "OPT" | "CLOCK";
export interface PasoReemplazo {
    pagina: number;
    fallo: boolean;
    victima: number | null;
    marcos: (number | null)[];
    bitsUso?: boolean[];
    puntero?: number;
}
export interface ResultadoReemplazo {
    pasos: PasoReemplazo[];
    fallos: number;
    fallosConMarcoLibre: number;
}
export const MAX_MARCOS = 64;
export const MAX_REFERENCIAS = 2000;
export function reemplazo(referencias: readonly number[], numMarcos: number, algoritmo: AlgoritmoReemplazo): ResultadoReemplazo | null {
    if (!referencias.length || referencias.length > MAX_REFERENCIAS)
        return null;
    if (!Number.isInteger(numMarcos) || numMarcos < 1 || numMarcos > MAX_MARCOS)
        return null;
    if (referencias.some(r => !Number.isInteger(r) || r < 0))
        return null;
    const marcos: (number | null)[] = Array(numMarcos).fill(null);
    const entrada = new Map<number, number>();
    const ultimoUso = new Map<number, number>();
    const pasos: PasoReemplazo[] = [];
    let fallos = 0;
    let fallosConMarcoLibre = 0;
    const bits: boolean[] = Array(numMarcos).fill(false);
    let puntero = 0;
    referencias.forEach((pagina, i) => {
        let victima: number | null = null;
        const fallo = !marcos.includes(pagina);
        if (fallo) {
            fallos++;
            let pos = marcos.indexOf(null);
            if (pos >= 0) {
                fallosConMarcoLibre++;
            }
            else if (algoritmo === "CLOCK") {
                while (bits[puntero]) {
                    bits[puntero] = false;
                    puntero = (puntero + 1) % numMarcos;
                }
                pos = puntero;
                victima = marcos[pos];
                entrada.delete(victima!);
                ultimoUso.delete(victima!);
            }
            else {
                pos = elegirVictima(marcos as number[], algoritmo, entrada, ultimoUso, referencias, i);
                victima = marcos[pos];
                entrada.delete(victima!);
                ultimoUso.delete(victima!);
            }
            marcos[pos] = pagina;
            entrada.set(pagina, i);
            if (algoritmo === "CLOCK")
                puntero = (pos + 1) % numMarcos;
        }
        ultimoUso.set(pagina, i);
        if (algoritmo === "CLOCK") {
            bits[marcos.indexOf(pagina)] = true;
            pasos.push({ pagina, fallo, victima, marcos: [...marcos], bitsUso: [...bits], puntero });
        }
        else {
            pasos.push({ pagina, fallo, victima, marcos: [...marcos] });
        }
    });
    return { pasos, fallos, fallosConMarcoLibre };
}
function elegirVictima(marcos: number[], algoritmo: AlgoritmoReemplazo, entrada: Map<number, number>, ultimoUso: Map<number, number>, refs: readonly number[], i: number): number {
    let mejor = 0;
    if (algoritmo === "FIFO" || algoritmo === "LRU") {
        const clave = algoritmo === "FIFO" ? entrada : ultimoUso;
        for (let k = 1; k < marcos.length; k++)
            if (clave.get(marcos[k])! < clave.get(marcos[mejor])!)
                mejor = k;
        return mejor;
    }
    const proximo = (p: number) => { const j = refs.indexOf(p, i + 1); return j < 0 ? Infinity : j; };
    for (let k = 1; k < marcos.length; k++)
        if (proximo(marcos[k]) > proximo(marcos[mejor]))
            mejor = k;
    return mejor;
}
@Injectable({ providedIn: "root" })
export class ReemplazoPaginasService {
    reemplazo(referencias: readonly number[], numMarcos: number, algoritmo: AlgoritmoReemplazo): ResultadoReemplazo | null {
        return reemplazo(referencias, numMarcos, algoritmo);
    }
}
