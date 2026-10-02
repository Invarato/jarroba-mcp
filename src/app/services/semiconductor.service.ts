import { Injectable } from "@angular/core";
export type MaterialId = "Si" | "Ge" | "GaAs";
export interface Material {
    id: MaterialId;
    eg300: number;
    eg0: number;
    varshniA: number;
    varshniB: number;
    nc300: number;
    nv300: number;
    epsR: number;
    valence: number;
    muN: number;
    muP: number;
    niRef300: number;
}
export const MATERIALS: Record<MaterialId, Material> = {
    Si: { id: "Si", eg300: 1.124, eg0: 1.17, varshniA: 0.000473, varshniB: 636, nc300: 28600000000000000000, nv300: 31000000000000000000, epsR: 11.7, valence: 4, niRef300: 10000000000, muN: 1400, muP: 450 },
    Ge: { id: "Ge", eg300: 0.661, eg0: 0.7437, varshniA: 0.0004774, varshniB: 235, nc300: 10400000000000000000, nv300: 6000000000000000000, epsR: 16, valence: 4, niRef300: 23000000000000, muN: 3900, muP: 1900 },
    GaAs: { id: "GaAs", eg300: 1.424, eg0: 1.519, varshniA: 0.0005405, varshniB: 204, nc300: 470000000000000000, nv300: 9000000000000000000, epsR: 12.9, valence: 4, niRef300: 2200000, muN: 8500, muP: 400 },
};
export const K_EV = 0.00008617333;
export const Q = 1.602176634e-19;
export const EPS0_CM = 8.8541878e-14;
export type CarrierType = "n" | "p" | "intrinseco";
export type Conduction = "conductor" | "semiconductor" | "aislante";
export interface BandState {
    t: number;
    eg: number;
    nc: number;
    nv: number;
    ni: number;
    nd: number;
    na: number;
    n: number;
    p: number;
    type: CarrierType;
    efMinusEi: number;
    efFromEv: number;
}
export interface PnJunction {
    vbi: number;
    bias: number;
    w: number;
    xn: number;
    xp: number;
    emax: number;
    collapsed: boolean;
}
@Injectable({ providedIn: "root" })
export class SemiconductorService {
    bandGap(mat: Material, t: number): number {
        const T = safeT(t);
        return Math.max(0, mat.eg0 - (mat.varshniA * T * T) / (T + mat.varshniB));
    }
    intrinsic(mat: Material, t: number): {
        ni: number;
        nc: number;
        nv: number;
        eg: number;
    } {
        const T = safeT(t);
        const escala = Math.pow(T / 300, 1.5);
        const nc = mat.nc300 * escala;
        const nv = mat.nv300 * escala;
        const eg = this.bandGap(mat, T);
        const ni = Math.sqrt(nc * nv) * Math.exp(-eg / (2 * K_EV * T));
        return { ni: finite(ni), nc: finite(nc), nv: finite(nv), eg };
    }
    bands(mat: Material, t: number, nd: number, na: number): BandState {
        const T = safeT(t);
        const { ni, nc, nv, eg } = this.intrinsic(mat, T);
        const Nd = nonNeg(nd);
        const Na = nonNeg(na);
        const medio = (Nd - Na) / 2;
        const raiz = Math.sqrt(medio * medio + ni * ni);
        let n: number, p: number;
        if (medio >= 0) {
            n = finite(medio + raiz);
            p = finite((ni * ni) / n);
        }
        else {
            p = finite(-medio + raiz);
            n = finite((ni * ni) / p);
        }
        const efMinusEi = finite(K_EV * T * Math.log(n / ni));
        const eiFromEv = (nc > 0 && nv > 0)
            ? eg / 2 + (K_EV * T / 2) * Math.log(nv / nc)
            : eg / 2;
        const umbral = Math.max(ni * 0.001, 1);
        const type: CarrierType = Math.abs(Nd - Na) < umbral ? "intrinseco" : (Nd > Na ? "n" : "p");
        return {
            t: T,
            eg,
            nc,
            nv,
            ni,
            nd: Nd,
            na: Na,
            n,
            p,
            type,
            efMinusEi,
            efFromEv: clamp(eiFromEv + efMinusEi, 0, eg),
        };
    }
    classify(eg: number): Conduction {
        if (Number.isNaN(eg))
            return "conductor";
        if (eg <= 0.1)
            return "conductor";
        if (eg <= 3)
            return "semiconductor";
        return "aislante";
    }
    pnJunction(mat: Material, t: number, na: number, nd: number, bias = 0): PnJunction {
        const T = safeT(t);
        const { ni } = this.intrinsic(mat, T);
        const Na = Math.max(1, nonNeg(na));
        const Nd = Math.max(1, nonNeg(nd));
        const vbi = (ni > 0) ? finite(K_EV * T * Math.log((Na * Nd) / (ni * ni))) : 0;
        const va = Number.isFinite(bias) ? bias : 0;
        const vNeta = vbi - va;
        const collapsed = vNeta <= 0;
        const vUtil = Math.max(0, vNeta);
        const eps = mat.epsR * EPS0_CM;
        const w = finite(Math.sqrt((2 * eps * vUtil / Q) * (1 / Na + 1 / Nd)));
        const xn = finite(w * Na / (Na + Nd));
        const xp = finite(w * Nd / (Na + Nd));
        const emax = finite(Q * Nd * xn / eps);
        return { vbi, bias: va, w, xn, xp, emax, collapsed };
    }
    dopantEffect(dopantValence: number, hostValence = 4): {
        kind: "donante" | "aceptor" | "neutro";
        freeElectrons: number;
        holes: number;
        fixedIonCharge: number;
    } {
        const v = Number.isFinite(dopantValence) ? Math.round(dopantValence) : hostValence;
        const d = v - hostValence;
        if (d > 0)
            return { kind: "donante", freeElectrons: d, holes: 0, fixedIonCharge: d };
        if (d < 0)
            return { kind: "aceptor", freeElectrons: 0, holes: -d, fixedIonCharge: d };
        return { kind: "neutro", freeElectrons: 0, holes: 0, fixedIonCharge: 0 };
    }
}
function safeT(t: number): number {
    return Number.isFinite(t) ? Math.min(1000, Math.max(1, t)) : 300;
}
function nonNeg(v: number): number {
    return Number.isFinite(v) && v > 0 ? v : 0;
}
function finite(v: number): number {
    return Number.isFinite(v) ? v : 0;
}
function clamp(v: number, lo: number, hi: number): number {
    if (!Number.isFinite(v))
        return lo;
    return Math.min(hi, Math.max(lo, v));
}
