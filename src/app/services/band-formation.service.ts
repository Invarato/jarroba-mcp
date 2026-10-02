import { Injectable } from "@angular/core";
export interface ChainInput {
    atoms: number;
    alpha: number;
    beta: number;
    electronsPerAtom: number;
}
export interface Level {
    j: number;
    e: number;
    filled: number;
}
export type Conduction = "metal" | "aislante" | "vacio";
export interface ChainResult {
    levels: Level[];
    width: number;
    meanGap: number;
    minGap: number;
    fermi: number | null;
    conduction: Conduction;
    filling: number;
}
export const D0_PM = 250;
export const DECAY_PM = 60;
@Injectable({ providedIn: "root" })
export class BandFormationService {
    chainLevels(n: number, alpha: number, beta: number): number[] {
        const N = clampInt(n, 1, 400);
        const a = num(alpha), b = num(beta);
        const out: number[] = [];
        for (let j = 1; j <= N; j++)
            out.push(a + 2 * b * Math.cos((j * Math.PI) / (N + 1)));
        return out.sort((x, y) => x - y);
    }
    betaAtDistance(distancePm: number, beta0: number): number {
        const d = Math.max(1, num(distancePm));
        return num(beta0) * Math.exp(-(d - D0_PM) / DECAY_PM);
    }
    analyze(input: ChainInput): ChainResult {
        const energias = this.chainLevels(input.atoms, input.alpha, input.beta);
        const n = energias.length;
        const epa = Math.max(0, num(input.electronsPerAtom));
        let quedan = Math.min(epa * n, 2 * n);
        const levels: Level[] = energias.map((e, i) => {
            const pone = Math.max(0, Math.min(2, quedan));
            quedan -= pone;
            return { j: i + 1, e, filled: pone };
        });
        const width = n > 1 ? energias[n - 1] - energias[0] : 0;
        const huecos = energias.slice(1).map((e, i) => e - energias[i]);
        const meanGap = huecos.length ? width / (n - 1) : 0;
        const minGap = huecos.length ? Math.min(...huecos) : 0;
        const ultimoLleno = levels.filter(l => l.filled > 0).pop() ?? null;
        const primerVacio = levels.find(l => l.filled === 0) ?? null;
        let conduction: Conduction;
        if (!ultimoLleno)
            conduction = "vacio";
        else if (ultimoLleno.filled < 2 || primerVacio)
            conduction = "metal";
        else
            conduction = "aislante";
        return {
            levels,
            width,
            meanGap,
            minGap,
            fermi: ultimoLleno ? ultimoLleno.e : null,
            conduction,
            filling: n ? (epa * n) / (2 * n) : 0,
        };
    }
    fan(n: number, alpha: number, beta0: number, fromPm: number, toPm: number, steps = 40): {
        d: number;
        levels: number[];
    }[] {
        const x = Math.max(1, num(fromPm)), y = Math.max(1, num(toPm));
        const a = Math.min(x, y);
        const b = Math.max(a + 1, Math.max(x, y));
        const k = clampInt(steps, 2, 400);
        return Array.from({ length: k }, (_, i) => {
            const d = a + ((b - a) * i) / (k - 1);
            return { d, levels: this.chainLevels(n, alpha, this.betaAtDistance(d, beta0)) };
        });
    }
}
function num(v: number): number {
    return Number.isFinite(v) ? v : 0;
}
function clampInt(v: number, lo: number, hi: number): number {
    const n = Math.floor(Number(v));
    return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : lo;
}
