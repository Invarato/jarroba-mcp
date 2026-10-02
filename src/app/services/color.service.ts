import { bytesToHex } from "../shared/bytes";
export interface Rgb {
    r: number;
    g: number;
    b: number;
}
export interface Hsl {
    h: number;
    s: number;
    l: number;
}
export interface Oklch {
    l: number;
    c: number;
    h: number;
}
export interface Oklab {
    l: number;
    a: number;
    b: number;
}
export interface ColorResult {
    hex: string;
    rgb: Rgb;
    hsl: Hsl;
    alpha: number;
    oklch: Oklch;
    oklab: Oklab;
    fueraDeGama: boolean;
}
const aLineal = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const aGamma = (c: number) => (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
export function rgbAOklab({ r, g, b }: Rgb): Oklab {
    const R = aLineal(r / 255), G = aLineal(g / 255), B = aLineal(b / 255);
    const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
    const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
    const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
    return {
        l: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
        a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
        b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
    };
}
function oklabALineal({ l: L, a, b }: Oklab): [
    number,
    number,
    number
] {
    const l = Math.pow(L + 0.3963377774 * a + 0.2158037573 * b, 3);
    const m = Math.pow(L - 0.1055613458 * a - 0.0638541728 * b, 3);
    const s = Math.pow(L - 0.0894841775 * a - 1.291485548 * b, 3);
    return [
        +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
        -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
        -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
    ];
}
const TOLERANCIA_GAMA = 2 / 255;
const gammaConSigno = (v: number) => Math.sign(v) * aGamma(Math.abs(v));
const enGama = (lin: number[]) => lin.every(v => { const g = gammaConSigno(v); return g >= -TOLERANCIA_GAMA && g <= 1 + TOLERANCIA_GAMA; });
export function oklabAOklch({ l, a, b }: Oklab): Oklch {
    const c = Math.hypot(a, b);
    const h = c < 0.0001 ? 0 : ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360;
    return { l, c, h };
}
export function oklchAOklab({ l, c, h }: Oklch): Oklab {
    const r = (h * Math.PI) / 180;
    return { l, a: c * Math.cos(r), b: c * Math.sin(r) };
}
export function oklchARgb(o: Oklch): {
    rgb: Rgb;
    fueraDeGama: boolean;
} {
    const lin = oklabALineal(oklchAOklab(o));
    const a255 = (v: number) => Math.round(Math.min(1, Math.max(0, aGamma(Math.min(1, Math.max(0, v))))) * 255);
    return { rgb: { r: a255(lin[0]), g: a255(lin[1]), b: a255(lin[2]) }, fueraDeGama: !enGama(lin) };
}
export function cabeEnSrgb(o: Oklch): boolean { return enGama(oklabALineal(oklchAOklab(o))); }
export function escalaOklch(base: Oklch, luminosidades = [0.97, 0.93, 0.87, 0.78, 0.69, 0.6, 0.51, 0.43, 0.35, 0.28, 0.2]): Oklch[] {
    return luminosidades.map(l => {
        let c = base.c;
        if (!cabeEnSrgb({ l, c, h: base.h })) {
            let lo = 0, hi = c;
            for (let i = 0; i < 20; i++) {
                const mid = (lo + hi) / 2;
                if (cabeEnSrgb({ l, c: mid, h: base.h }))
                    lo = mid;
                else
                    hi = mid;
            }
            c = lo;
        }
        return { l, c, h: base.h };
    });
}
const r3 = (n: number) => Math.round(n * 1000) / 1000;
const r1 = (n: number) => Math.round(n * 10) / 10;
export function textoOklch(o: Oklch, alpha = 1): string {
    return `oklch(${r1(o.l * 100)}% ${r3(o.c)} ${r1(o.h)}${alpha < 1 ? ` / ${r3(alpha)}` : ""})`;
}
export function textoOklab(o: Oklab, alpha = 1): string {
    return `oklab(${r1(o.l * 100)}% ${r3(o.a)} ${r3(o.b)}${alpha < 1 ? ` / ${r3(alpha)}` : ""})`;
}
const NUM = String.raw `[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?`;
const COMP = String.raw `(${NUM})(%|deg)?`;
const FUNC = new RegExp(String.raw `^(rgba?|hsla?|oklch|oklab)\(\s*${COMP}\s*(?:,\s*|\s+)${COMP}\s*(?:,\s*|\s+)${COMP}\s*(?:(?:,|\/)\s*${COMP}\s*)?\)$`, "i");
function alfa(v: string | undefined, unidad: string | undefined): number | null {
    if (v === undefined)
        return 1;
    const n = unidad === "%" ? +v / 100 : +v;
    return n >= 0 && n <= 1 ? n : null;
}
export class ColorService {
    parse(input: string): ColorResult | null {
        const v = input.trim();
        const hexM = v.match(/^#?([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i);
        if (hexM) {
            let h = hexM[1];
            if (h.length <= 4)
                h = [...h].map(c => c + c).join("");
            const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
            return this.fromRgb({ r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) }, a);
        }
        const m = v.match(FUNC);
        if (!m)
            return null;
        const f = m[1].toLowerCase();
        const [n1, u1, n2, u2, n3, u3] = [+m[2], m[3], +m[4], m[5], +m[6], m[7]];
        const a = alfa(m[8], m[9]);
        if (a === null)
            return null;
        if (f.startsWith("rgb")) {
            const canal = (n: number, u?: string) => (u === "%" ? (n / 100) * 255 : u ? NaN : n);
            const c = [canal(n1, u1), canal(n2, u2), canal(n3, u3)];
            if (c.some(x => !(x >= 0 && x <= 255)))
                return null;
            return this.fromRgb({ r: Math.round(c[0]), g: Math.round(c[1]), b: Math.round(c[2]) }, a);
        }
        if (f.startsWith("hsl")) {
            if ((u1 && u1 !== "deg") || (u2 && u2 !== "%") || (u3 && u3 !== "%"))
                return null;
            if (!(n1 >= 0 && n1 <= 360 && n2 >= 0 && n2 <= 100 && n3 >= 0 && n3 <= 100))
                return null;
            return this.fromHsl({ h: n1 % 360, s: n2, l: n3 }, a);
        }
        if (f === "oklch") {
            if (u2 === "deg" || u3 === "%")
                return null;
            const l = u1 === "%" ? n1 / 100 : n1;
            const c = u2 === "%" ? (n2 / 100) * 0.4 : n2;
            if (!(l >= 0 && l <= 1 && c >= 0 && n3 >= 0 && n3 <= 360))
                return null;
            return this.fromOklch({ l, c, h: n3 % 360 }, a);
        }
        if (u1 === "deg" || u2 === "deg" || u3 === "deg")
            return null;
        const l = u1 === "%" ? n1 / 100 : n1;
        const ab = (n: number, u?: string) => (u === "%" ? (n / 100) * 0.4 : n);
        if (!(l >= 0 && l <= 1))
            return null;
        return this.fromOklch(oklabAOklch({ l, a: ab(n2, u2), b: ab(n3, u3) }), a);
    }
    parseConNavegador(input: string): ColorResult | null {
        const v = input.trim();
        if (typeof document === "undefined" || typeof CSS === "undefined" || !CSS.supports("color", v))
            return null;
        const c = document.createElement("canvas");
        c.width = c.height = 1;
        const ctx = c.getContext("2d", { willReadFrequently: true });
        if (!ctx)
            return null;
        ctx.fillStyle = v;
        ctx.fillRect(0, 0, 1, 1);
        const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
        return this.fromRgb({ r, g, b }, Math.round((a / 255) * 1000) / 1000);
    }
    deOklch(o: Oklch, alpha = 1): ColorResult { return this.fromOklch(o, alpha); }
    private fromRgb(rgb: Rgb, alpha = 1): ColorResult {
        const oklab = rgbAOklab(rgb);
        return { rgb, alpha, hex: this.rgbToHex(rgb, alpha), hsl: this.rgbToHsl(rgb), oklab, oklch: oklabAOklch(oklab), fueraDeGama: false };
    }
    private fromHsl(hsl: Hsl, alpha = 1): ColorResult {
        const rgb = this.hslToRgb(hsl);
        const oklab = rgbAOklab(rgb);
        return { rgb, alpha, hex: this.rgbToHex(rgb, alpha), hsl, oklab, oklch: oklabAOklch(oklab), fueraDeGama: false };
    }
    private fromOklch(o: Oklch, alpha = 1): ColorResult {
        const { rgb, fueraDeGama } = oklchARgb(o);
        return { rgb, alpha, hex: this.rgbToHex(rgb, alpha), hsl: this.rgbToHsl(rgb), oklch: o, oklab: oklchAOklab(o), fueraDeGama };
    }
    private rgbToHex({ r, g, b }: Rgb, alpha = 1): string {
        const bytes = alpha < 1 ? [r, g, b, Math.round(alpha * 255)] : [r, g, b];
        return "#" + bytesToHex(new Uint8Array(bytes));
    }
    private rgbToHsl({ r, g, b }: Rgb): Hsl {
        const rn = r / 255, gn = g / 255, bn = b / 255;
        const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
        const l = (max + min) / 2;
        if (max === min)
            return { h: 0, s: 0, l: Math.round(l * 100) };
        const d = max - min;
        const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        let h = 0;
        if (max === rn)
            h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
        else if (max === gn)
            h = ((bn - rn) / d + 2) / 6;
        else
            h = ((rn - gn) / d + 4) / 6;
        return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
    }
    private hslToRgb({ h, s, l }: Hsl): Rgb {
        const hn = h / 360, sn = s / 100, ln = l / 100;
        if (sn === 0) {
            const v = Math.round(ln * 255);
            return { r: v, g: v, b: v };
        }
        const q = ln < 0.5 ? ln * (1 + sn) : ln + sn - ln * sn;
        const p = 2 * ln - q;
        const hue = (t: number) => {
            if (t < 0)
                t += 1;
            if (t > 1)
                t -= 1;
            if (t < 1 / 6)
                return p + (q - p) * 6 * t;
            if (t < 1 / 2)
                return q;
            if (t < 2 / 3)
                return p + (q - p) * (2 / 3 - t) * 6;
            return p;
        };
        return { r: Math.round(hue(hn + 1 / 3) * 255), g: Math.round(hue(hn) * 255), b: Math.round(hue(hn - 1 / 3) * 255) };
    }
}
