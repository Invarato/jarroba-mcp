import { Injectable } from "@angular/core";
import { MosfetService, MosfetParams } from "./mosfet.service";
import { colaNormal } from "../shared/erf";
export type SramMode = "hold" | "read" | "write";
export interface SramParams {
    vdd: number;
    cellRatio: number;
    pullUpRatio: number;
    kAccess: number;
    vthN: number;
    vthP: number;
    lambda: number;
}
export interface Punto {
    x: number;
    y: number;
}
export interface CuadradoSnm {
    x: number;
    y: number;
    s: number;
}
export interface Mariposa {
    curva1: Punto[];
    curva2: Punto[];
    snm: number;
    snmLobulo1: number;
    snmLobulo2: number;
    cuadrado1: CuadradoSnm | null;
    cuadrado2: CuadradoSnm | null;
    biestable: boolean;
}
export interface Estabilidad {
    sigmas: number;
    pCelda: number;
    pArray: number;
    celdas: number;
}
const MUESTRAS_POR_DEFECTO = 201;
const MUESTRAS_MAX = 2001;
const ITER_BISECCION = 60;
const ITER_LADO = 40;
@Injectable({ providedIn: "root" })
export class SramService {
    private mos = new MosfetService();
    private pPullDown(p: SramParams): MosfetParams {
        return { vth: p.vthN, k: p.kAccess * p.cellRatio, lambda: p.lambda };
    }
    private pPullUp(p: SramParams): MosfetParams {
        return { vth: p.vthP, k: p.kAccess * p.pullUpRatio, lambda: p.lambda };
    }
    private pAcceso(p: SramParams): MosfetParams {
        return { vth: p.vthN, k: p.kAccess, lambda: p.lambda };
    }
    private iAcceso(vNodo: number, vBl: number, vWl: number, p: SramParams): number {
        const pa = this.pAcceso(p);
        if (vWl <= 0)
            return 0;
        return vBl >= vNodo
            ? this.mos.drainCurrent(vWl - vNodo, vBl - vNodo, pa)
            : -this.mos.drainCurrent(vWl - vBl, vNodo - vBl, pa);
    }
    mediaCelda(vin: number, vbl: number, vwl: number, p: SramParams): number {
        const pd = this.pPullDown(p), pu = this.pPullUp(p);
        const f = (vout: number) => this.mos.drainCurrent(vin, vout, pd)
            - this.mos.drainCurrent(p.vdd - vin, p.vdd - vout, pu)
            - this.iAcceso(vout, vbl, vwl, p);
        let lo = 0, hi = p.vdd;
        for (let i = 0; i < ITER_BISECCION; i++) {
            const mid = (lo + hi) / 2;
            if (f(mid) > 0)
                hi = mid;
            else
                lo = mid;
        }
        return (lo + hi) / 2;
    }
    private polarizacion(modo: SramMode, vdd: number): {
        vbl1: number;
        vbl2: number;
        vwl: number;
    } {
        switch (modo) {
            case "hold": return { vbl1: 0, vbl2: 0, vwl: 0 };
            case "read": return { vbl1: vdd, vbl2: vdd, vwl: vdd };
            case "write": return { vbl1: 0, vbl2: vdd, vwl: vdd };
        }
    }
    private vtc(vbl: number, vwl: number, p: SramParams, muestras: number): number[] {
        const n = acotarMuestras(muestras);
        return Array.from({ length: n }, (_, i) => this.mediaCelda((p.vdd * i) / (n - 1), vbl, vwl, p));
    }
    mariposa(modo: SramMode, p: SramParams, muestras = MUESTRAS_POR_DEFECTO): Mariposa | null {
        if (!this.parametrosValidos(p))
            return null;
        const { vbl1, vbl2, vwl } = this.polarizacion(modo, p.vdd);
        const n = acotarMuestras(muestras);
        const f1 = this.vtc(vbl1, vwl, p, n);
        const f2 = this.vtc(vbl2, vwl, p, n);
        const eje = (i: number) => (p.vdd * i) / (n - 1);
        const curva1 = f1.map((q, i) => ({ x: q, y: eje(i) }));
        const curva2 = f2.map((qb, i) => ({ x: eje(i), y: qb }));
        const c1 = mayorCuadradoInscrito(f1, f2, p.vdd);
        const c2 = mayorCuadradoInscrito(f2, f1, p.vdd);
        const s1 = c1?.s ?? 0, s2 = c2?.s ?? 0;
        const snm = Math.min(s1, s2);
        return {
            curva1,
            curva2,
            snm,
            snmLobulo1: s1,
            snmLobulo2: s2,
            cuadrado1: c1,
            cuadrado2: c2 ? { x: c2.y, y: c2.x, s: c2.s } : null,
            biestable: snm > 0,
        };
    }
    private parametrosValidos(p: SramParams): boolean {
        const finitos = [p.vdd, p.cellRatio, p.pullUpRatio, p.kAccess, p.vthN, p.vthP, p.lambda];
        if (!finitos.every(v => Number.isFinite(v)))
            return false;
        return p.vdd > 0 && p.cellRatio > 0 && p.pullUpRatio > 0 && p.kAccess > 0
            && p.vthN > 0 && p.vthP > 0 && p.lambda >= 0;
    }
    estabilidad(snm: number, sigmaMv: number, celdas: number): Estabilidad | null {
        if (![snm, sigmaMv, celdas].every(Number.isFinite))
            return null;
        if (!(sigmaMv > 0) || !(celdas >= 1))
            return null;
        const sigmas = snm / (sigmaMv / 1000);
        const pCelda = colaNormal(sigmas);
        const pArray = pCelda >= 1 ? 1 : -Math.expm1(celdas * Math.log1p(-pCelda));
        return { sigmas, pCelda, pArray, celdas };
    }
}
function acotarMuestras(m: number): number {
    if (!Number.isFinite(m))
        return MUESTRAS_POR_DEFECTO;
    return Math.min(MUESTRAS_MAX, Math.max(2, Math.floor(m)));
}
function interp(tabla: number[], x: number, vdd: number): number {
    const n = tabla.length;
    if (n === 0)
        return 0;
    if (n === 1)
        return tabla[0];
    const t = (x / vdd) * (n - 1);
    if (!(t > 0))
        return tabla[0];
    if (t >= n - 1)
        return tabla[n - 1];
    const i = Math.floor(t);
    return tabla[i] + (tabla[i + 1] - tabla[i]) * (t - i);
}
export function mayorCuadradoInscrito(f1: number[], f2: number[], vdd: number): CuadradoSnm | null {
    const n = f1.length;
    if (n < 2 || f2.length < 2 || !(vdd > 0))
        return null;
    let mejor: CuadradoSnm | null = null;
    for (let i = 0; i < n; i++) {
        const b = (vdd * i) / (n - 1);
        const a = interp(f1, b, vdd);
        const cabe = (s: number) => a + s <= vdd && b + s <= vdd && b + s <= interp(f2, a + s, vdd);
        if (!cabe(0))
            continue;
        let lo = 0, hi = vdd;
        for (let k = 0; k < ITER_LADO; k++) {
            const mid = (lo + hi) / 2;
            if (cabe(mid))
                lo = mid;
            else
                hi = mid;
        }
        if (!mejor || lo > mejor.s)
            mejor = { x: a, y: b, s: lo };
    }
    return mejor;
}
