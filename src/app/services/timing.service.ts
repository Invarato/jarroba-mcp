import { Injectable } from "@angular/core";
export interface CaminoParams {
    tclkNs: number;
    tcqNs: number;
    tlogicNs: number;
    tlogicMinNs: number;
    tsetupNs: number;
    tholdNs: number;
    tskewNs: number;
}
export interface Timing {
    slackSetupNs: number;
    slackHoldNs: number;
    cumpleSetup: boolean;
    cumpleHold: boolean;
    fmaxMhz: number;
    fActualMhz: number;
    tramos: {
        clave: "cq" | "logica" | "setup";
        ns: number;
    }[];
    caminoNs: number;
}
export function factorPorCaida(vdd: number, caidaV: number, vth: number, alpha = 1.3): number | null {
    if (![vdd, caidaV, vth, alpha].every(Number.isFinite))
        return null;
    if (!(vdd > 0) || caidaV < 0 || !(vth > 0) || !(alpha > 0))
        return null;
    if (vdd - vth < 0.05 * vdd)
        return null;
    const v = vdd - caidaV;
    if (v - vth < 0.05 * vdd)
        return null;
    const d = (x: number) => x / Math.pow(x - vth, alpha);
    return d(v) / d(vdd);
}
const TOL_NS = 1e-9;
@Injectable({ providedIn: "root" })
export class TimingService {
    analizar(p: CaminoParams): Timing | null {
        if (!this.valido(p))
            return null;
        const caminoNs = p.tcqNs + p.tlogicNs + p.tsetupNs;
        const slackSetupNs = p.tclkNs + p.tskewNs - caminoNs;
        const slackHoldNs = p.tcqNs + p.tlogicMinNs - p.tholdNs - p.tskewNs;
        const periodoMin = caminoNs - p.tskewNs;
        return {
            slackSetupNs,
            slackHoldNs,
            cumpleSetup: slackSetupNs >= -TOL_NS,
            cumpleHold: slackHoldNs >= -TOL_NS,
            fmaxMhz: periodoMin > 0 ? 1000 / periodoMin : Infinity,
            fActualMhz: 1000 / p.tclkNs,
            tramos: [
                { clave: "cq", ns: p.tcqNs },
                { clave: "logica", ns: p.tlogicNs },
                { clave: "setup", ns: p.tsetupNs },
            ],
            caminoNs,
        };
    }
    private valido(p: CaminoParams): boolean {
        const n = [p.tclkNs, p.tcqNs, p.tlogicNs, p.tlogicMinNs, p.tsetupNs, p.tholdNs, p.tskewNs];
        if (!n.every(Number.isFinite))
            return false;
        return p.tclkNs > 0 && p.tclkNs <= 1000
            && p.tcqNs >= 0 && p.tlogicNs >= 0 && p.tlogicMinNs >= 0
            && p.tsetupNs >= 0 && p.tholdNs >= 0
            && p.tlogicMinNs <= p.tlogicNs
            && Math.abs(p.tskewNs) <= 100;
    }
}
