import { Injectable } from "@angular/core";
export const EV_IN_CM1 = 8065.543937;
export const KB_EV = 0.00008617333262;
const U_KG = 1.6605390666e-27;
const EV_J = 1.602176634e-19;
const C_CM_S = 29979245800;
export interface MorseSpec {
    id: string;
    formula: string;
    bond: "covalent";
    model: "morse";
    atoms: readonly string[];
    re: number;
    de: number;
    we: number;
    mu: number;
}
export interface LjSpec {
    id: string;
    formula: string;
    bond: "vdw";
    model: "lj";
    atoms: readonly string[];
    epsK: number;
    sigma: number;
}
export type DiatomicSpec = MorseSpec | LjSpec;
export interface CurvePoint {
    r: number;
    v: number;
    f: number;
}
export interface VibLevel {
    v: number;
    e: number;
}
export interface BondCurve {
    spec: DiatomicSpec;
    points: CurvePoint[];
    rMin: number;
    vMin: number;
    rZero: number;
    rMaxForce: number;
    fMaxAttract: number;
    zeroPoint: number | null;
    d0: number | null;
    levels: VibLevel[];
    kT: number;
    wellOverKT: number;
}
export interface CurveOptions {
    samples?: number;
    tempK?: number;
    rMaxFactor?: number;
}
const MORSE: readonly MorseSpec[] = [
    m("H2", "H\u2082", ["H", "H"], 74.14, 4.7466, 4401.21, 0.503912),
    m("N2", "N\u2082", ["N", "N"], 109.77, 9.9, 2358.57, 7.001537),
    m("O2", "O\u2082", ["O", "O"], 120.75, 5.2132, 1580.19, 7.997457),
    m("F2", "F\u2082", ["F", "F"], 141.19, 1.66, 916.64, 9.499085),
    m("Cl2", "Cl\u2082", ["Cl", "Cl"], 198.79, 2.514, 559.7, 17.484426),
    m("HF", "HF", ["H", "F"], 91.68, 6.122, 4138.32, 0.957178),
    m("HCl", "HCl", ["H", "Cl"], 127.46, 4.618, 2990.95, 0.979572),
    m("Li2", "Li\u2082", ["Li", "Li"], 267.29, 1.068, 351.43, 3.508002),
    m("Na2", "Na\u2082", ["Na", "Na"], 307.89, 0.73, 159.12, 11.494885),
];
const LJ: readonly LjSpec[] = [
    lj("He2", "He\u2082", ["He"], 10.22, 256),
    lj("Ne2", "Ne\u2082", ["Ne"], 36.83, 278.9),
    lj("Ar2", "Ar\u2082", ["Ar"], 119.8, 340.5),
    lj("Kr2", "Kr\u2082", ["Kr"], 171, 360),
    lj("Xe2", "Xe\u2082", ["Xe"], 221, 410),
];
function m(id: string, formula: string, atoms: string[], re: number, de: number, we: number, mu: number): MorseSpec {
    return { id, formula, bond: "covalent", model: "morse", atoms, re, de, we, mu };
}
function lj(id: string, formula: string, atoms: string[], epsK: number, sigma: number): LjSpec {
    return { id, formula, bond: "vdw", model: "lj", atoms, epsK, sigma };
}
export const DIATOMICS: readonly DiatomicSpec[] = [...MORSE, ...LJ];
export function morseA(spec: MorseSpec): number {
    const omega = 2 * Math.PI * C_CM_S * spec.we;
    const mu = spec.mu * U_KG;
    const de = spec.de * EV_J;
    return omega * Math.sqrt(mu / (2 * de)) * 1e-12;
}
export function morseAnharmonicity(spec: MorseSpec): number {
    return (spec.we * spec.we) / (4 * spec.de * EV_IN_CM1);
}
export function equilibrium(spec: DiatomicSpec): number {
    return spec.model === "morse" ? spec.re : Math.pow(2, 1 / 6) * spec.sigma;
}
export function wellDepth(spec: DiatomicSpec): number {
    return spec.model === "morse" ? spec.de : spec.epsK * KB_EV;
}
export function ljReduced(rOverSigma: number): number {
    const inv6 = 1 / Math.pow(rOverSigma, 6);
    return 4 * (inv6 * inv6 - inv6);
}
@Injectable({ providedIn: "root" })
export class BondEnergyService {
    list(): readonly DiatomicSpec[] { return DIATOMICS; }
    find(id: string): DiatomicSpec | null {
        return DIATOMICS.find(d => d.id === id) ?? null;
    }
    forElement(symbol: string): DiatomicSpec | null {
        const s = (symbol || "").trim();
        if (!s)
            return null;
        return DIATOMICS.find(d => d.atoms.includes(s)) ?? null;
    }
    potential(spec: DiatomicSpec, r: number): number {
        if (!(r > 0))
            return Number.POSITIVE_INFINITY;
        if (spec.model === "lj")
            return wellDepth(spec) * ljReduced(r / spec.sigma);
        const a = morseA(spec);
        const e = Math.exp(-a * (r - spec.re));
        return spec.de * e * (e - 2);
    }
    force(spec: DiatomicSpec, r: number): number {
        if (!(r > 0))
            return Number.POSITIVE_INFINITY;
        if (spec.model === "lj") {
            const s = spec.sigma, x = s / r, inv6 = Math.pow(x, 6);
            return (24 * wellDepth(spec) / r) * (2 * inv6 * inv6 - inv6);
        }
        const a = morseA(spec);
        const e = Math.exp(-a * (r - spec.re));
        return -2 * spec.de * a * e * (1 - e);
    }
    levels(spec: DiatomicSpec): VibLevel[] {
        if (spec.model !== "morse")
            return [];
        const we = spec.we / EV_IN_CM1;
        const wexe = morseAnharmonicity(spec) / EV_IN_CM1;
        const out: VibLevel[] = [];
        let prev = -Infinity;
        for (let v = 0; v < 200; v++) {
            const h = v + 0.5;
            const e = we * h - wexe * h * h;
            if (e <= prev || e >= spec.de)
                break;
            out.push({ v, e });
            prev = e;
        }
        return out;
    }
    turningPoints(spec: DiatomicSpec, e: number): {
        inner: number;
        outer: number;
    } | null {
        if (spec.model !== "morse")
            return null;
        if (!(e >= 0) || e >= spec.de)
            return null;
        const a = morseA(spec);
        const s = Math.sqrt(e / spec.de);
        return {
            inner: spec.re - Math.log(1 + s) / a,
            outer: spec.re - Math.log(1 - s) / a,
        };
    }
    maxAttractionAt(spec: DiatomicSpec): number {
        if (spec.model === "morse")
            return spec.re + Math.LN2 / morseA(spec);
        return Math.pow(26 / 7, 1 / 6) * spec.sigma;
    }
    zeroCrossing(spec: DiatomicSpec): number {
        if (spec.model === "morse")
            return spec.re - Math.LN2 / morseA(spec);
        return spec.sigma;
    }
    curve(spec: DiatomicSpec, opts: CurveOptions = {}): BondCurve {
        const samples = clampInt(opts.samples ?? 240, 8, 4000);
        const tempK = Number.isFinite(opts.tempK!) && opts.tempK! > 0 ? opts.tempK! : 300;
        const rMaxFactor = Number.isFinite(opts.rMaxFactor!) && opts.rMaxFactor! > 1
            ? opts.rMaxFactor! : 3;
        const re = equilibrium(spec);
        const de = wellDepth(spec);
        const rZero = this.zeroCrossing(spec);
        const r0 = Math.max(rZero * 0.82, re * 0.35);
        const r1 = re * rMaxFactor;
        const points: CurvePoint[] = [];
        for (let i = 0; i < samples; i++) {
            const r = r0 + (r1 - r0) * (i / (samples - 1));
            points.push({ r, v: finite(this.potential(spec, r)), f: finite(this.force(spec, r)) });
        }
        const levels = this.levels(spec);
        const zeroPoint = levels.length ? levels[0].e : null;
        const kT = KB_EV * tempK;
        return {
            spec,
            points,
            rMin: re,
            vMin: -de,
            rZero,
            rMaxForce: this.maxAttractionAt(spec),
            fMaxAttract: Math.abs(this.force(spec, this.maxAttractionAt(spec))),
            zeroPoint,
            d0: zeroPoint === null ? null : de - zeroPoint,
            levels,
            kT,
            wellOverKT: de / kT,
        };
    }
}
function clampInt(v: number, lo: number, hi: number): number {
    const n = Math.floor(Number(v));
    return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : lo;
}
function finite(v: number): number {
    return Number.isFinite(v) ? v : 0;
}
