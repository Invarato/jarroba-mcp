import { Injectable } from "@angular/core";
export const EPS_SI = 11.7;
export const EPS_OX = 3.9;
export const KB_EV = 0.00008617333262;
export const LAMBDA_RULE = 5;
export type ArchStatus = "produccion" | "investigacion" | "hoja-de-ruta";
export interface Architecture {
    id: string;
    gates: number;
    cylindrical: boolean;
    status: ArchStatus;
    year: number | null;
    makers: readonly string[];
    minBodyNm: number;
}
export const ARCHITECTURES: readonly Architecture[] = [
    { id: "planar", gates: 1, cylindrical: false, status: "produccion", year: 1960, makers: ["todos"], minBodyNm: 6 },
    { id: "fdsoi", gates: 1, cylindrical: false, status: "produccion", year: 2012, makers: ["STMicroelectronics", "GlobalFoundries"], minBodyNm: 5 },
    { id: "finfet", gates: 3, cylindrical: false, status: "produccion", year: 2011, makers: ["Intel", "TSMC", "Samsung"], minBodyNm: 5 },
    { id: "nanosheet", gates: 4, cylindrical: false, status: "produccion", year: 2022, makers: ["Samsung", "TSMC", "Intel"], minBodyNm: 3 },
    { id: "nanowire", gates: 4, cylindrical: true, status: "investigacion", year: 2016, makers: [], minBodyNm: 3 },
    { id: "forksheet", gates: 4, cylindrical: false, status: "investigacion", year: 2021, makers: [], minBodyNm: 3 },
    { id: "cfet", gates: 4, cylindrical: false, status: "hoja-de-ruta", year: 2031, makers: [], minBodyNm: 3 },
];
export interface GeometryInput {
    bodyNm: number;
    oxideNm: number;
    gateLenNm: number;
    tempK: number;
}
export interface ArchResult {
    arch: Architecture;
    lambda: number;
    minGateLenNm: number;
    margin: number;
    ok: boolean;
    drainPenetration: number;
    bodyFeasible: boolean;
}
export interface GeometryResult {
    archs: ArchResult[];
    ssLimit: number;
    best: ArchResult | null;
}
@Injectable({ providedIn: "root" })
export class GateGeometryService {
    list(): readonly Architecture[] { return ARCHITECTURES; }
    find(id: string): Architecture | null {
        return ARCHITECTURES.find(a => a.id === id) ?? null;
    }
    naturalLength(arch: Architecture, bodyNm: number, oxideNm: number): number {
        const tSi = Math.max(0.1, num(bodyNm));
        const tOx = Math.max(0.1, num(oxideNm));
        if (arch.cylindrical) {
            const a = 2 * EPS_SI * tSi * tSi * Math.log(1 + (2 * tOx) / tSi);
            const b = EPS_OX * tSi * tSi;
            return Math.sqrt((a + b) / (16 * EPS_OX));
        }
        const n = Math.max(1, num(arch.gates));
        return Math.sqrt((EPS_SI / (n * EPS_OX)) * tSi * tOx);
    }
    subthresholdLimit(tempK: number): number {
        return KB_EV * Math.max(0.01, num(tempK)) * Math.LN10 * 1000;
    }
    analyze(input: GeometryInput): GeometryResult {
        const body = Math.max(0.1, num(input.bodyNm) || 6);
        const ox = Math.max(0.1, num(input.oxideNm) || 1);
        const lg = Math.max(0.1, num(input.gateLenNm) || 20);
        const archs = ARCHITECTURES.map(arch => {
            const lambda = this.naturalLength(arch, body, ox);
            const minGateLenNm = LAMBDA_RULE * lambda;
            return {
                arch,
                lambda,
                minGateLenNm,
                margin: lg / lambda,
                ok: lg >= minGateLenNm,
                drainPenetration: Math.exp(-lg / (2 * lambda)),
                bodyFeasible: body >= arch.minBodyNm,
            };
        });
        const viables = archs.filter(a => a.ok && a.bodyFeasible && !a.arch.cylindrical);
        const best = viables.length
            ? viables.reduce((a, b) => (b.lambda < a.lambda ? b : a))
            : null;
        return { archs, ssLimit: this.subthresholdLimit(input.tempK), best };
    }
    lambdaGain(from: Architecture, to: Architecture, bodyNm: number, oxideNm: number): number {
        if (from.cylindrical || to.cylindrical)
            return 0;
        const a = this.naturalLength(from, bodyNm, oxideNm);
        const b = this.naturalLength(to, bodyNm, oxideNm);
        return b > 0 ? a / b : 0;
    }
    thinningGain(from: Architecture, to: Architecture, oxideNm: number): number {
        if (from.cylindrical || to.cylindrical)
            return 0;
        const a = this.naturalLength(from, from.minBodyNm, oxideNm);
        const b = this.naturalLength(to, to.minBodyNm, oxideNm);
        return b > 0 ? a / b : 0;
    }
}
function num(v: number): number {
    return Number.isFinite(v) ? v : 0;
}
