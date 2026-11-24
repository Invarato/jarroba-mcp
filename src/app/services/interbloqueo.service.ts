import { Injectable } from "@angular/core";
export interface Recursos {
    procesos: string[];
    recursos: string[];
    asignado: number[][];
    disponible: number[];
}
export interface PasoBanquero {
    proceso: string;
    pide: number[];
    trabajo: number[];
    puede: boolean;
    trabajoDespues?: number[];
}
export interface ResultadoRecorrido {
    ok: boolean;
    secuencia: string[];
    bloqueados: string[];
    pasos: PasoBanquero[];
}
export const MAX_PROCESOS_B = 10;
export const MAX_RECURSOS_B = 6;
const suma = (a: number[], b: number[]) => a.map((x, j) => x + b[j]);
const cabe = (a: number[], b: number[]) => a.every((x, j) => x <= b[j]);
const natural = (x: number) => Number.isInteger(x) && x >= 0 && x <= 9999;
function validas(r: Recursos, ...matrices: number[][][]): boolean {
    const n = r.procesos.length, m = r.recursos.length;
    if (n < 1 || n > MAX_PROCESOS_B || m < 1 || m > MAX_RECURSOS_B)
        return false;
    if (new Set(r.procesos).size !== n || r.procesos.some(p => !p))
        return false;
    if (r.disponible.length !== m || !r.disponible.every(natural))
        return false;
    return [r.asignado, ...matrices].every(M => M.length === n && M.every(f => f.length === m && f.every(natural)));
}
export function necesidad(asignado: number[][], maximo: number[][]): number[][] | null {
    if (asignado.length !== maximo.length || asignado.some((f, i) => f.length !== maximo[i].length))
        return null;
    const out = maximo.map((f, i) => f.map((x, j) => x - asignado[i][j]));
    return out.every(f => f.every(x => x >= 0)) ? out : null;
}
function recorrer(r: Recursos, pide: number[][], terminadoDeSalida: boolean[]): ResultadoRecorrido {
    const n = r.procesos.length;
    const fin = [...terminadoDeSalida];
    let trabajo = [...r.disponible];
    const secuencia: string[] = [];
    const pasos: PasoBanquero[] = [];
    let i = 0, sinAvance = 0;
    while (sinAvance < n && fin.some(f => !f)) {
        if (!fin[i]) {
            const puede = cabe(pide[i], trabajo);
            const paso: PasoBanquero = { proceso: r.procesos[i], pide: pide[i], trabajo, puede };
            if (puede) {
                trabajo = suma(trabajo, r.asignado[i]);
                paso.trabajoDespues = trabajo;
                fin[i] = true;
                secuencia.push(r.procesos[i]);
                sinAvance = 0;
            }
            else
                sinAvance++;
            pasos.push(paso);
        }
        else
            sinAvance++;
        i = (i + 1) % n;
    }
    const bloqueados = r.procesos.filter((_, k) => !fin[k]);
    return { ok: bloqueados.length === 0, secuencia, bloqueados, pasos };
}
export function seguridad(r: Recursos, maximo: number[][]): ResultadoRecorrido | null {
    if (!validas(r, maximo))
        return null;
    const nec = necesidad(r.asignado, maximo);
    if (!nec)
        return null;
    return recorrer(r, nec, r.procesos.map(() => false));
}
export type ResultadoSolicitud = {
    resultado: "excede-necesidad";
} | {
    resultado: "esperar";
} | {
    resultado: "concedida" | "denegada";
    estado: Recursos;
    seguridad: ResultadoRecorrido;
};
export function solicitud(r: Recursos, maximo: number[][], proceso: string, peticion: number[]): ResultadoSolicitud | null {
    if (!validas(r, maximo))
        return null;
    const i = r.procesos.indexOf(proceso);
    if (i < 0 || peticion.length !== r.recursos.length || !peticion.every(natural))
        return null;
    const nec = necesidad(r.asignado, maximo);
    if (!nec)
        return null;
    if (!cabe(peticion, nec[i]))
        return { resultado: "excede-necesidad" };
    if (!cabe(peticion, r.disponible))
        return { resultado: "esperar" };
    const estado: Recursos = {
        ...r,
        disponible: r.disponible.map((x, j) => x - peticion[j]),
        asignado: r.asignado.map((f, k) => k === i ? suma(f, peticion) : [...f]),
    };
    const seg = seguridad(estado, maximo)!;
    return { resultado: seg.ok ? "concedida" : "denegada", estado, seguridad: seg };
}
export function deteccion(r: Recursos, peticiones: number[][]): ResultadoRecorrido | null {
    if (!validas(r, peticiones))
        return null;
    return recorrer(r, peticiones, r.asignado.map(f => f.every(x => x === 0)));
}
export function validarSecuencia(r: Recursos, pide: number[][], secuencia: readonly string[]): {
    ok: true;
} | {
    ok: false;
    motivo: "desconocido" | "repetido" | "incompleta" | "no-cabe";
    en?: number;
    proceso?: string;
} {
    const vistos = new Set<string>();
    let trabajo = [...r.disponible];
    for (const [k, p] of secuencia.entries()) {
        const i = r.procesos.indexOf(p);
        if (i < 0)
            return { ok: false, motivo: "desconocido", en: k, proceso: p };
        if (vistos.has(p))
            return { ok: false, motivo: "repetido", en: k, proceso: p };
        if (!cabe(pide[i], trabajo))
            return { ok: false, motivo: "no-cabe", en: k, proceso: p };
        trabajo = suma(trabajo, r.asignado[i]);
        vistos.add(p);
    }
    if (vistos.size !== r.procesos.length)
        return { ok: false, motivo: "incompleta" };
    return { ok: true };
}
export function contarSecuencias(r: Recursos, pide: number[][], tope = 100000): number {
    const n = r.procesos.length;
    let total = 0;
    const hecho = new Array(n).fill(false);
    const buscar = (trabajo: number[], k: number): void => {
        if (total >= tope)
            return;
        if (k === n) {
            total++;
            return;
        }
        for (let i = 0; i < n; i++) {
            if (hecho[i] || !cabe(pide[i], trabajo))
                continue;
            hecho[i] = true;
            buscar(suma(trabajo, r.asignado[i]), k + 1);
            hecho[i] = false;
        }
    };
    buscar([...r.disponible], 0);
    return total;
}
@Injectable({ providedIn: "root" })
export class InterbloqueoService {
    seguridad = seguridad;
    solicitud = solicitud;
    deteccion = deteccion;
    validarSecuencia = validarSecuencia;
    contarSecuencias = contarSecuencias;
}
