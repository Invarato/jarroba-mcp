import { Injectable } from "@angular/core";
export const RYDBERG_EV = 13.598287;
export const HC_EV_NM = 1239.8419;
export const N_AIR = 1.000277;
export type SeriesId = "lyman" | "balmer" | "paschen" | "brackett" | "pfund";
export interface Series {
    id: SeriesId;
    nLow: number;
    region: "uv" | "visible" | "ir";
}
export const SERIES: readonly Series[] = [
    { id: "lyman", nLow: 1, region: "uv" },
    { id: "balmer", nLow: 2, region: "visible" },
    { id: "paschen", nLow: 3, region: "ir" },
    { id: "brackett", nLow: 4, region: "ir" },
    { id: "pfund", nLow: 5, region: "ir" },
];
export interface Transition {
    nHigh: number;
    nLow: number;
    energy: number;
    wavelength: number;
    wavelengthAir: number;
    frequency: number;
    series: SeriesId | null;
    visible: boolean;
    color: string;
}
const VIS_MIN = 380;
const VIS_MAX = 750;
@Injectable({ providedIn: "root" })
export class SpectrumService {
    levelEnergy(n: number): number {
        const k = Math.floor(n);
        if (!Number.isFinite(k) || k < 1)
            return 0;
        return -RYDBERG_EV / (k * k);
    }
    transition(nHigh: number, nLow: number): Transition | null {
        const hi = Math.floor(nHigh);
        const lo = Math.floor(nLow);
        if (!Number.isFinite(hi) || !Number.isFinite(lo) || hi < 1 || lo < 1 || hi === lo)
            return null;
        const [a, b] = hi > lo ? [hi, lo] : [lo, hi];
        const energy = RYDBERG_EV * (1 / (b * b) - 1 / (a * a));
        if (!(energy > 0))
            return null;
        const wavelength = HC_EV_NM / energy;
        const wavelengthAir = wavelength / N_AIR;
        const visible = wavelength >= VIS_MIN && wavelength <= VIS_MAX;
        return {
            nHigh: a,
            nLow: b,
            energy,
            wavelength,
            wavelengthAir,
            frequency: 299792.458 / wavelength,
            series: SERIES.find(s => s.nLow === b)?.id ?? null,
            visible,
            color: this.wavelengthToCss(wavelength),
        };
    }
    seriesLines(nLow: number, count = 8): Transition[] {
        const lo = Math.max(1, Math.floor(nLow) || 1);
        const n = Math.max(0, Math.min(40, Math.floor(count) || 0));
        const out: Transition[] = [];
        for (let i = 1; i <= n; i++) {
            const t = this.transition(lo + i, lo);
            if (t)
                out.push(t);
        }
        return out;
    }
    seriesLimit(nLow: number): {
        energy: number;
        wavelength: number;
    } {
        const lo = Math.max(1, Math.floor(nLow) || 1);
        const energy = RYDBERG_EV / (lo * lo);
        return { energy, wavelength: HC_EV_NM / energy };
    }
    visibleLines(nMax = 10): Transition[] {
        const max = Math.max(2, Math.min(40, Math.floor(nMax) || 2));
        const out: Transition[] = [];
        for (let lo = 1; lo < max; lo++) {
            for (let hi = lo + 1; hi <= max; hi++) {
                const t = this.transition(hi, lo);
                if (t?.visible)
                    out.push(t);
            }
        }
        return out.sort((a, b) => a.wavelength - b.wavelength);
    }
    gapToWavelength(egEv: number): number {
        return (Number.isFinite(egEv) && egEv > 0) ? HC_EV_NM / egEv : 0;
    }
    wavelengthToCss(nm: number): string {
        if (!Number.isFinite(nm) || nm < VIS_MIN || nm > VIS_MAX)
            return "#9e9e9e";
        let r = 0, g = 0, b = 0;
        if (nm < 440) {
            r = -(nm - 440) / (440 - 380);
            b = 1;
        }
        else if (nm < 490) {
            g = (nm - 440) / (490 - 440);
            b = 1;
        }
        else if (nm < 510) {
            g = 1;
            b = -(nm - 510) / (510 - 490);
        }
        else if (nm < 580) {
            r = (nm - 510) / (580 - 510);
            g = 1;
        }
        else if (nm < 645) {
            r = 1;
            g = -(nm - 645) / (645 - 580);
        }
        else {
            r = 1;
        }
        let f = 1;
        if (nm < 420)
            f = 0.3 + 0.7 * (nm - 380) / (420 - 380);
        else if (nm > 700)
            f = 0.3 + 0.7 * (750 - nm) / (750 - 700);
        const c = (v: number) => Math.round(255 * Math.pow(Math.max(0, Math.min(1, v)) * f, 0.8));
        return `rgb(${c(r)}, ${c(g)}, ${c(b)})`;
    }
}
