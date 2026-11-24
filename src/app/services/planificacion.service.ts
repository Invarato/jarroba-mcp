import { Injectable } from "@angular/core";
export interface Proceso {
    id: string;
    llegada: number;
    rafaga: number;
    prioridad?: number;
}
export type DesempateRR = "nuevo-antes" | "expulsado-antes";
export interface OpcionesRR {
    quantum: number;
    desempate: DesempateRR;
}
export interface TramoGantt {
    id: string | null;
    inicio: number;
    fin: number;
}
export type MotivoPaso = "inicio" | "termina" | "quantum" | "expulsion" | "sigue";
export interface PasoRR {
    t: number;
    ejecuta: string;
    cola: string[];
    motivo: MotivoPaso;
    anterior?: string;
    llegan: string[];
    empate?: boolean;
    nivel?: number;
    colas?: string[][];
    baja?: number;
}
export type PasoPlan = PasoRR;
export interface MetricasProceso {
    id: string;
    fin: number;
    retorno: number;
    espera: number;
    respuesta: number;
}
export type ResultadoPlan = ResultadoRR;
export interface ResultadoRR {
    gantt: TramoGantt[];
    pasos: PasoRR[];
    metricas: MetricasProceso[];
    media: {
        retorno: number;
        espera: number;
        respuesta: number;
    };
}
const entero = (n: number, min: number) => Number.isInteger(n) && n >= min;
export const MAX_PROCESOS = 100;
export const MAX_TRAMOS = 20000;
export function roundRobin(procesos: readonly Proceso[], op: OpcionesRR): ResultadoRR | null {
    if (!procesos.length || !entero(op.quantum, 1))
        return null;
    const ids = new Set<string>();
    for (const p of procesos) {
        if (!p.id || ids.has(p.id) || !entero(p.llegada, 0) || !entero(p.rafaga, 1))
            return null;
        ids.add(p.id);
    }
    if (procesos.length > MAX_PROCESOS)
        return null;
    if (procesos.reduce((s, p) => s + Math.ceil(p.rafaga / op.quantum), 0) > MAX_TRAMOS)
        return null;
    const porLlegada = procesos.map((p, i) => ({ p, i }))
        .sort((a, b) => a.p.llegada - b.p.llegada || a.i - b.i).map(x => x.p);
    const resta = new Map(procesos.map(p => [p.id, p.rafaga]));
    const primero = new Map<string, number>();
    const fin = new Map<string, number>();
    const cola: string[] = [];
    const gantt: TramoGantt[] = [];
    const pasos: PasoRR[] = [];
    let siguiente = 0;
    const encolarHasta = (t: number, incluido: boolean) => {
        while (siguiente < porLlegada.length &&
            (incluido ? porLlegada[siguiente].llegada <= t : porLlegada[siguiente].llegada < t)) {
            cola.push(porLlegada[siguiente++].id);
        }
    };
    const lleganEn = (t: number) => porLlegada.filter(p => p.llegada === t).map(p => p.id);
    let t = 0;
    let motivo: MotivoPaso = "inicio";
    let anterior: string | undefined;
    let empate = false;
    encolarHasta(t, true);
    while (fin.size < procesos.length) {
        if (!cola.length) {
            const llega = porLlegada[siguiente].llegada;
            gantt.push({ id: null, inicio: t, fin: llega });
            t = llega;
            encolarHasta(t, true);
            motivo = "inicio";
            anterior = undefined;
            empate = false;
            continue;
        }
        const id = cola.shift()!;
        const m: MotivoPaso = motivo === "quantum" && id === anterior ? "sigue" : motivo;
        pasos.push({ t, ejecuta: id, cola: [...cola], motivo: m, ...(anterior ? { anterior } : {}), llegan: lleganEn(t), ...(empate ? { empate } : {}) });
        if (!primero.has(id))
            primero.set(id, t);
        const tramo = Math.min(op.quantum, resta.get(id)!);
        const hasta = t + tramo;
        gantt.push({ id, inicio: t, fin: hasta });
        resta.set(id, resta.get(id)! - tramo);
        encolarHasta(hasta, false);
        anterior = id;
        if (resta.get(id) === 0) {
            fin.set(id, hasta);
            encolarHasta(hasta, true);
            motivo = "termina";
            empate = false;
        }
        else {
            empate = porLlegada.some(p => p.llegada === hasta);
            if (op.desempate === "nuevo-antes") {
                encolarHasta(hasta, true);
                cola.push(id);
            }
            else {
                cola.push(id);
                encolarHasta(hasta, true);
            }
            motivo = "quantum";
        }
        t = hasta;
    }
    const metricas = procesos.map(p => {
        const f = fin.get(p.id)!;
        return { id: p.id, fin: f, retorno: f - p.llegada, espera: f - p.llegada - p.rafaga, respuesta: primero.get(p.id)! - p.llegada };
    });
    const media = (k: "retorno" | "espera" | "respuesta") => metricas.reduce((s, m) => s + m[k], 0) / metricas.length;
    return { gantt, pasos, metricas, media: { retorno: media("retorno"), espera: media("espera"), respuesta: media("respuesta") } };
}
export type QuantumFB = "uno" | "potencia";
export interface OpcionesFB {
    quantum: QuantumFB;
    bajaSolo?: boolean;
    llegadaExpulsa?: boolean;
}
export function realimentacion(procesos: readonly Proceso[], op: OpcionesFB): ResultadoRR | null {
    if (!procesos.length || procesos.length > MAX_PROCESOS)
        return null;
    const ids = new Set<string>();
    for (const p of procesos) {
        if (!p.id || ids.has(p.id) || !entero(p.llegada, 0) || !entero(p.rafaga, 1))
            return null;
        ids.add(p.id);
    }
    if (procesos.reduce((s, p) => s + p.rafaga, 0) > MAX_TRAMOS)
        return null;
    const quantum = (nivel: number) => op.quantum === "uno" ? 1 : 2 ** Math.min(nivel, 30);
    const porLlegada = procesos.map((p, i) => ({ p, i }))
        .sort((a, b) => a.p.llegada - b.p.llegada || a.i - b.i).map(x => x.p);
    const resta = new Map(procesos.map(p => [p.id, p.rafaga]));
    const primero = new Map<string, number>();
    const fin = new Map<string, number>();
    const colas: string[][] = [];
    const gantt: TramoGantt[] = [];
    const pasos: PasoRR[] = [];
    let siguiente = 0;
    const encolarHasta = (t: number, incluido: boolean) => {
        while (siguiente < porLlegada.length && (incluido ? porLlegada[siguiente].llegada <= t : porLlegada[siguiente].llegada < t)) {
            (colas[0] ??= []).push(porLlegada[siguiente++].id);
        }
    };
    const hayListos = () => colas.some(c => c?.length);
    const foto = () => {
        let n = colas.length - 1;
        while (n >= 0 && !colas[n]?.length)
            n--;
        return Array.from({ length: n + 1 }, (_, i) => [...(colas[i] ?? [])]);
    };
    const lleganEn = (t: number) => porLlegada.filter(p => p.llegada === t).map(p => p.id);
    let t = 0;
    let motivo: MotivoPaso = "inicio";
    let anterior: string | undefined;
    let baja: number | undefined;
    encolarHasta(t, true);
    while (fin.size < procesos.length) {
        if (!hayListos()) {
            const llega = porLlegada[siguiente].llegada;
            gantt.push({ id: null, inicio: t, fin: llega });
            t = llega;
            encolarHasta(t, true);
            motivo = "inicio";
            anterior = undefined;
            baja = undefined;
            continue;
        }
        const nivel = colas.findIndex(c => c?.length);
        const id = colas[nivel].shift()!;
        const resto = foto();
        pasos.push({
            t,
            ejecuta: id,
            cola: resto.flat(),
            motivo,
            ...(anterior ? { anterior } : {}),
            llegan: lleganEn(t),
            nivel,
            colas: resto,
            ...(motivo === "quantum" && baja !== undefined ? { baja } : {}),
        });
        if (!primero.has(id))
            primero.set(id, t);
        const q = quantum(nivel);
        let tramo = Math.min(q, resta.get(id)!);
        if (op.llegadaExpulsa && nivel > 0 && siguiente < porLlegada.length && porLlegada[siguiente].llegada < t + tramo) {
            tramo = porLlegada[siguiente].llegada - t;
        }
        const hasta = t + tramo;
        gantt.push({ id, inicio: t, fin: hasta });
        resta.set(id, resta.get(id)! - tramo);
        encolarHasta(hasta, false);
        anterior = id;
        t = hasta;
        if (resta.get(id) === 0) {
            fin.set(id, t);
            encolarHasta(t, true);
            motivo = "termina";
            baja = undefined;
            continue;
        }
        encolarHasta(t, true);
        const cortado = tramo < q;
        if (!hayListos() && !op.bajaSolo && !cortado) {
            (colas[nivel] ??= []).push(id);
            motivo = "sigue";
            baja = undefined;
        }
        else {
            baja = cortado ? nivel : nivel + 1;
            (colas[baja] ??= []).push(id);
            motivo = cortado ? "expulsion" : "quantum";
        }
    }
    const metricas = procesos.map(p => {
        const f = fin.get(p.id)!;
        return { id: p.id, fin: f, retorno: f - p.llegada, espera: f - p.llegada - p.rafaga, respuesta: primero.get(p.id)! - p.llegada };
    });
    const media = (k: "retorno" | "espera" | "respuesta") => metricas.reduce((s, m) => s + m[k], 0) / metricas.length;
    return { gantt, pasos, metricas, media: { retorno: media("retorno"), espera: media("espera"), respuesta: media("respuesta") } };
}
export type Algoritmo = "FCFS" | "SJF" | "SRTF" | "RR" | "HRRN" | "PRIORIDAD" | "FB";
export interface OpcionesPlan {
    algoritmo: Algoritmo;
    quantum?: number;
    desempate?: DesempateRR;
    quantumFB?: QuantumFB;
}
export function planificar(procesos: readonly Proceso[], op: OpcionesPlan): ResultadoRR | null {
    if (op.algoritmo === "RR")
        return roundRobin(procesos, { quantum: op.quantum ?? 0, desempate: op.desempate ?? "nuevo-antes" });
    if (op.algoritmo === "FB")
        return realimentacion(procesos, { quantum: op.quantumFB ?? "uno" });
    if (!procesos.length || procesos.length > MAX_PROCESOS)
        return null;
    const ids = new Set<string>();
    for (const p of procesos) {
        if (!p.id || ids.has(p.id) || !entero(p.llegada, 0) || !entero(p.rafaga, 1))
            return null;
        if (op.algoritmo === "PRIORIDAD" && !(p.prioridad !== undefined && Number.isInteger(p.prioridad)))
            return null;
        ids.add(p.id);
    }
    const orden = new Map(procesos.map((p, i) => [p.id, i]));
    const porLlegada = [...procesos].sort((a, b) => a.llegada - b.llegada || orden.get(a.id)! - orden.get(b.id)!);
    const dato = new Map(procesos.map(p => [p.id, p]));
    const resta = new Map(procesos.map(p => [p.id, p.rafaga]));
    const primero = new Map<string, number>();
    const fin = new Map<string, number>();
    const listos: string[] = [];
    const gantt: TramoGantt[] = [];
    const pasos: PasoRR[] = [];
    let siguiente = 0;
    const encolarHasta = (t: number) => { while (siguiente < porLlegada.length && porLlegada[siguiente].llegada <= t)
        listos.push(porLlegada[siguiente++].id); };
    const lleganEn = (t: number) => porLlegada.filter(p => p.llegada === t).map(p => p.id);
    const clave = (id: string, t: number): number => {
        const p = dato.get(id)!;
        switch (op.algoritmo) {
            case "FCFS": return 0;
            case "SJF": return p.rafaga;
            case "SRTF": return resta.get(id)!;
            case "PRIORIDAD": return p.prioridad!;
            case "HRRN": return -((t - p.llegada) + p.rafaga) / p.rafaga;
        }
        return 0;
    };
    const elegir = (candidatos: string[], t: number) => candidatos.reduce((mejor, id) => clave(id, t) < clave(mejor, t) ? id : mejor, candidatos[0]);
    let t = 0;
    let actual: string | null = null;
    let motivo: MotivoPaso = "inicio";
    let anterior: string | undefined;
    encolarHasta(t);
    while (fin.size < procesos.length) {
        if (actual === null) {
            if (!listos.length) {
                const llega = porLlegada[siguiente].llegada;
                gantt.push({ id: null, inicio: t, fin: llega });
                t = llega;
                encolarHasta(t);
                motivo = "inicio";
                anterior = undefined;
                continue;
            }
            actual = elegir(listos, t);
            listos.splice(listos.indexOf(actual), 1);
            pasos.push({ t, ejecuta: actual, cola: [...listos], motivo, ...(anterior ? { anterior } : {}), llegan: lleganEn(t) });
            if (!primero.has(actual))
                primero.set(actual, t);
        }
        const proxima = op.algoritmo === "SRTF" && siguiente < porLlegada.length ? porLlegada[siguiente].llegada : Infinity;
        const hasta = Math.min(t + resta.get(actual)!, proxima);
        const ult = gantt.at(-1);
        if (ult && ult.id === actual && ult.fin === t)
            ult.fin = hasta;
        else
            gantt.push({ id: actual, inicio: t, fin: hasta });
        resta.set(actual, resta.get(actual)! - (hasta - t));
        t = hasta;
        encolarHasta(t);
        if (resta.get(actual) === 0) {
            fin.set(actual, t);
            anterior = actual;
            actual = null;
            motivo = "termina";
            continue;
        }
        const mejor: string = listos.length ? elegir(listos, t) : actual;
        if (mejor !== actual && clave(mejor, t) < clave(actual, t)) {
            listos.push(actual);
            anterior = actual;
            actual = null;
            motivo = "expulsion";
        }
        else {
            pasos.push({ t, ejecuta: actual, cola: [...listos], motivo: "sigue", anterior: actual, llegan: lleganEn(t) });
        }
    }
    const metricas = procesos.map(p => {
        const f = fin.get(p.id)!;
        return { id: p.id, fin: f, retorno: f - p.llegada, espera: f - p.llegada - p.rafaga, respuesta: primero.get(p.id)! - p.llegada };
    });
    const media = (k: "retorno" | "espera" | "respuesta") => metricas.reduce((s, m) => s + m[k], 0) / metricas.length;
    return { gantt, pasos, metricas, media: { retorno: media("retorno"), espera: media("espera"), respuesta: media("respuesta") } };
}
@Injectable({ providedIn: "root" })
export class PlanificacionService {
    roundRobin(procesos: readonly Proceso[], op: OpcionesRR): ResultadoRR | null {
        return roundRobin(procesos, op);
    }
    planificar(procesos: readonly Proceso[], op: OpcionesPlan): ResultadoRR | null {
        return planificar(procesos, op);
    }
}
