import { Injectable } from "@angular/core";
export type MosfetChannel = "n" | "p";
export type MosfetRegion = "cutoff" | "triode" | "saturation";
export interface MosfetParams {
    vth: number;
    k: number;
    lambda: number;
}
export interface IdVdsCurve {
    vgs: number;
    points: {
        vds: number;
        id: number;
    }[];
}
export const MAX_SAMPLES = 2000;
export function muestras(samples: number): number {
    if (!Number.isFinite(samples))
        return 80;
    return Math.min(MAX_SAMPLES, Math.max(2, Math.floor(samples)));
}
const fin = (v: number): number => (Number.isFinite(v) ? v : 0);
const finP = (p: MosfetParams): MosfetParams => ({ vth: fin(p.vth), k: fin(p.k), lambda: fin(p.lambda) });
@Injectable({ providedIn: "root" })
export class MosfetService {
    drainCurrent(vgs: number, vds: number, p: MosfetParams): number {
        vgs = fin(vgs);
        vds = fin(vds);
        p = finP(p);
        const vov = vgs - p.vth;
        if (vov <= 0)
            return 0;
        if (vds < vov) {
            return p.k * (vov * vds - 0.5 * vds * vds);
        }
        return 0.5 * p.k * vov * vov * (1 + p.lambda * (vds - vov));
    }
    conductances(vgs: number, vds: number, p: MosfetParams): {
        id: number;
        gm: number;
        gds: number;
    } {
        vgs = fin(vgs);
        vds = fin(vds);
        p = finP(p);
        const vov = vgs - p.vth;
        if (vov <= 0)
            return { id: 0, gm: 0, gds: 0 };
        if (vds < vov) {
            return { id: p.k * (vov * vds - 0.5 * vds * vds), gm: p.k * vds, gds: p.k * (vov - vds) };
        }
        const lam = 1 + p.lambda * (vds - vov);
        return {
            id: 0.5 * p.k * vov * vov * lam,
            gm: p.k * vov * lam - 0.5 * p.k * p.lambda * vov * vov,
            gds: 0.5 * p.k * vov * vov * p.lambda,
        };
    }
    region(vgs: number, vds: number, p: MosfetParams): MosfetRegion {
        vgs = fin(vgs);
        vds = fin(vds);
        p = finP(p);
        if (vgs - p.vth <= 0)
            return "cutoff";
        return vds < (vgs - p.vth) ? "triode" : "saturation";
    }
    kneeVds(vgs: number, p: MosfetParams): number {
        return Math.max(0, fin(vgs) - fin(p.vth));
    }
    idVdsFamily(vgsList: number[], vdsMax: number, p: MosfetParams, samples = 80): IdVdsCurve[] {
        const n = muestras(samples);
        vdsMax = fin(vdsMax);
        return vgsList.map(fin).map(vgs => ({
            vgs,
            points: Array.from({ length: n }, (_, i) => {
                const vds = (vdsMax * i) / (n - 1);
                return { vds, id: this.drainCurrent(vgs, vds, p) };
            }),
        }));
    }
    idVgsTransfer(vgsMax: number, vds: number, p: MosfetParams, samples = 80): {
        vgs: number;
        id: number;
    }[] {
        const n = muestras(samples);
        vgsMax = fin(vgsMax);
        return Array.from({ length: n }, (_, i) => {
            const vgs = (vgsMax * i) / (n - 1);
            return { vgs, id: this.drainCurrent(vgs, vds, p) };
        });
    }
    ronTriode(vgs: number, p: MosfetParams): number {
        const vov = fin(vgs) - fin(p.vth), k = fin(p.k);
        return vov > 0 && k > 0 ? 1 / (k * vov) : Infinity;
    }
    cmosInverter(vin: number, vcc: number, pn: MosfetParams, pp: MosfetParams): {
        vout: number;
        ishort: number;
    } {
        vin = fin(vin);
        vcc = fin(vcc);
        const idn = (vout: number) => this.drainCurrent(vin, vout, pn);
        const idp = (vout: number) => this.drainCurrent(vcc - vin, vcc - vout, pp);
        let lo = 0, hi = vcc;
        for (let i = 0; i < 60; i++) {
            const mid = (lo + hi) / 2;
            if (idn(mid) - idp(mid) > 0)
                hi = mid;
            else
                lo = mid;
        }
        const vout = (lo + hi) / 2;
        return { vout, ishort: idn(vout) };
    }
    cmosVtc(vcc: number, pn: MosfetParams, pp: MosfetParams, samples = 80): {
        vin: number;
        vout: number;
        ishort: number;
    }[] {
        const n = muestras(samples);
        vcc = fin(vcc);
        return Array.from({ length: n }, (_, i) => {
            const vin = (vcc * i) / (n - 1);
            const { vout, ishort } = this.cmosInverter(vin, vcc, pn, pp);
            return { vin, vout, ishort };
        });
    }
}
