import { Injectable } from "@angular/core";
export const Q_E = 1.602176634e-19;
export const H_PLANCK = 6.62607015e-34;
export const KB_EV = 0.00008617333262;
export const EPS0 = 8.8541878128e-12;
export const R_QUANTUM = H_PLANCK / (Q_E * Q_E);
export interface IslandInput {
    radiusNm: number;
    epsR: number;
    tempK: number;
    gateFraction: number;
    tunnelKOhm: number;
}
export interface CoulombDiamond {
    n: number;
    vgCenter: number;
    vgHalfWidth: number;
    vdsHalfHeight: number;
}
export interface SetResult {
    cTotal: number;
    cGate: number;
    charging: number;
    kT: number;
    ratio: number;
    gatePeriod: number;
    tunnelOhm: number;
    tunnelOverQuantum: number;
    blockade: BlockadeVerdict;
    diamonds: CoulombDiamond[];
    maxRadiusNm: number;
}
export type BlockadeVerdict = "ok" | "thermal" | "tunnel" | "both";
export const RATIO_MIN = 10;
@Injectable({ providedIn: "root" })
export class SingleElectronService {
    sphereCapacitance(radiusNm: number, epsR = 1): number {
        const r = Math.max(0.001, num(radiusNm)) * 1e-9;
        return 4 * Math.PI * EPS0 * Math.max(1, num(epsR)) * r;
    }
    maxRadiusNm(tempK: number, epsR = 1): number {
        const kT = KB_EV * Math.max(0.000001, num(tempK)) * Q_E;
        const eps = Math.max(1, num(epsR));
        const r = (Q_E * Q_E) / (8 * Math.PI * EPS0 * eps * RATIO_MIN * kT);
        return r * 1000000000;
    }
    diamonds(cGate: number, cTotal: number, count = 5): CoulombDiamond[] {
        const cg = num(cGate), ct = num(cTotal);
        if (!(cg > 0) || !(ct > 0))
            return [];
        const periodo = Q_E / cg;
        const alto = Q_E / ct;
        const k = clampInt(count, 1, 40);
        const desde = -Math.floor(k / 2);
        return Array.from({ length: k }, (_, i) => {
            const n = desde + i;
            return {
                n,
                vgCenter: periodo * n,
                vgHalfWidth: periodo / 2,
                vdsHalfHeight: alto,
            };
        });
    }
    analyze(input: IslandInput): SetResult {
        const epsR = Math.max(1, num(input.epsR) || 1);
        const tempK = Math.max(0.01, num(input.tempK) || 300);
        const cTotal = this.sphereCapacitance(input.radiusNm, epsR);
        const frac = clamp(num(input.gateFraction) || 0.3, 0.02, 0.9);
        const cGate = cTotal * frac;
        const charging = (Q_E * Q_E) / (2 * cTotal) / Q_E;
        const kT = KB_EV * tempK;
        const ratio = charging / kT;
        const tunnelOhm = Math.max(0, num(input.tunnelKOhm)) * 1000;
        const tunnelOverQuantum = tunnelOhm / R_QUANTUM;
        const malTermico = ratio < RATIO_MIN;
        const malTunel = tunnelOverQuantum <= 1;
        const blockade: BlockadeVerdict = malTermico && malTunel ? "both" : malTermico ? "thermal" : malTunel ? "tunnel" : "ok";
        return {
            cTotal,
            cGate,
            charging,
            kT,
            ratio,
            gatePeriod: Q_E / cGate,
            tunnelOhm,
            tunnelOverQuantum,
            blockade,
            diamonds: this.diamonds(cGate, cTotal),
            maxRadiusNm: this.maxRadiusNm(tempK, epsR),
        };
    }
    atomCount(radiusNm: number): number {
        const r = Math.max(0, num(radiusNm));
        const vol = (4 / 3) * Math.PI * r * r * r;
        return Math.round(vol * 50);
    }
}
function num(v: number): number {
    return Number.isFinite(v) ? v : 0;
}
function clamp(v: number, lo: number, hi: number): number {
    return Math.min(hi, Math.max(lo, v));
}
function clampInt(v: number, lo: number, hi: number): number {
    const n = Math.floor(Number(v));
    return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : lo;
}
