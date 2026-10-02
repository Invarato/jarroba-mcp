import { Injectable } from "@angular/core";
export interface WcagLevels {
    ratio: number;
    aaNormal: boolean;
    aaLarge: boolean;
    aaaNormal: boolean;
    aaaLarge: boolean;
}
@Injectable({ providedIn: "root" })
export class WcagContrastService {
    private hexToRgb(hex: string): [
        number,
        number,
        number
    ] {
        const h = hex.replace("#", "");
        const r = parseInt(h.substring(0, 2), 16) / 255;
        const g = parseInt(h.substring(2, 4), 16) / 255;
        const b = parseInt(h.substring(4, 6), 16) / 255;
        return [r, g, b];
    }
    private linearize(c: number): number {
        return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    }
    luminance(hex: string): number {
        const [r, g, b] = this.hexToRgb(hex);
        return 0.2126 * this.linearize(r) + 0.7152 * this.linearize(g) + 0.0722 * this.linearize(b);
    }
    contrastRatio(foreground: string, background: string): number {
        const l1 = this.luminance(foreground);
        const l2 = this.luminance(background);
        const lighter = Math.max(l1, l2);
        const darker = Math.min(l1, l2);
        return (lighter + 0.05) / (darker + 0.05);
    }
    evaluate(foreground: string, background: string): WcagLevels {
        const ratio = this.contrastRatio(foreground, background);
        return {
            ratio,
            aaNormal: ratio >= 4.5,
            aaLarge: ratio >= 3,
            aaaNormal: ratio >= 7,
            aaaLarge: ratio >= 4.5,
        };
    }
}
