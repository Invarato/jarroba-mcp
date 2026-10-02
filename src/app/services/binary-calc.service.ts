import { Injectable } from "@angular/core";
export type BitWidth = 8 | 16 | 32 | 64 | (number & {});
export type ArithOp = "add" | "sub" | "mul" | "div" | "mod" | "pow";
export type BitOp = "and" | "or" | "xor" | "nand" | "nor" | "xnor" | "shl" | "shr" | "sar" | "rol" | "ror";
export interface NumView {
    bin: string;
    oct: string;
    dec: string;
    hex: string;
}
export interface CalcView {
    masked: bigint;
    signed: bigint;
    views: NumView;
    popcount: number;
    leadingZeros: number;
    trailingZeros: number;
    width: BitWidth;
    overflow: boolean;
}
@Injectable({ providedIn: "root" })
export class BinaryCalcService {
    parse(input: string, base?: number): bigint | null {
        if (input == null)
            return null;
        let s = input.replace(/[\s_]/g, "");
        if (s === "")
            return null;
        let neg = false;
        if (s[0] === "+" || s[0] === "-") {
            neg = s[0] === "-";
            s = s.slice(1);
        }
        if (s === "")
            return null;
        let radix = base;
        const p = s.slice(0, 2).toLowerCase();
        const prefixRadix = p === "0x" ? 16 : p === "0o" ? 8 : p === "0b" ? 2 : 0;
        if (radix == null) {
            radix = prefixRadix || 10;
            if (prefixRadix)
                s = s.slice(2);
        }
        else if (prefixRadix && prefixRadix === radix) {
            s = s.slice(2);
        }
        if (radix < 2 || radix > 36 || !Number.isInteger(radix))
            return null;
        if (s === "")
            return null;
        let value = 0n;
        const R = BigInt(radix);
        for (const ch of s.toLowerCase()) {
            const d = this.digitValue(ch);
            if (d < 0 || d >= radix)
                return null;
            value = value * R + BigInt(d);
        }
        return neg ? -value : value;
    }
    private digitValue(ch: string): number {
        const c = ch.charCodeAt(0);
        if (c >= 48 && c <= 57)
            return c - 48;
        if (c >= 97 && c <= 122)
            return c - 97 + 10;
        return -1;
    }
    arith(op: ArithOp, a: bigint, b: bigint): bigint | null {
        switch (op) {
            case "add":
                return a + b;
            case "sub":
                return a - b;
            case "mul":
                return a * b;
            case "div":
                if (b === 0n)
                    return null;
                return a / b;
            case "mod":
                if (b === 0n)
                    return null;
                return a % b;
            case "pow":
                if (b < 0n)
                    return null;
                return a ** b;
            default:
                return null;
        }
    }
    bitwise(op: BitOp, a: bigint, b: bigint, width: BitWidth): bigint {
        const w = BigInt(width);
        const mask = (1n << w) - 1n;
        const ma = this.maskTo(a, width);
        const mb = this.maskTo(b, width);
        switch (op) {
            case "and":
                return (ma & mb) & mask;
            case "or":
                return (ma | mb) & mask;
            case "xor":
                return (ma ^ mb) & mask;
            case "nand":
                return ~(ma & mb) & mask;
            case "nor":
                return ~(ma | mb) & mask;
            case "xnor":
                return ~(ma ^ mb) & mask;
            case "shl": {
                const sh = this.shiftAmount(b);
                if (sh >= w)
                    return 0n;
                return (ma << sh) & mask;
            }
            case "shr": {
                const sh = this.shiftAmount(b);
                if (sh >= w)
                    return 0n;
                return (ma >> sh) & mask;
            }
            case "sar": {
                const sh = this.shiftAmount(b);
                const signBit = (ma >> (w - 1n)) & 1n;
                if (sh >= w)
                    return signBit === 1n ? mask : 0n;
                if (signBit === 0n)
                    return (ma >> sh) & mask;
                const fill = (mask << (w - sh)) & mask;
                return ((ma >> sh) | fill) & mask;
            }
            case "rol": {
                const sh = this.rotateAmount(b, width);
                if (sh === 0n)
                    return ma;
                return ((ma << sh) | (ma >> (w - sh))) & mask;
            }
            case "ror": {
                const sh = this.rotateAmount(b, width);
                if (sh === 0n)
                    return ma;
                return ((ma >> sh) | (ma << (w - sh))) & mask;
            }
            default:
                return ma;
        }
    }
    private shiftAmount(b: bigint): bigint {
        return b < 0n ? -b : b;
    }
    private rotateAmount(b: bigint, width: BitWidth): bigint {
        const w = BigInt(width);
        let r = b % w;
        if (r < 0n)
            r += w;
        return r;
    }
    not(a: bigint, width: BitWidth): bigint {
        const mask = (1n << BigInt(width)) - 1n;
        return ~this.maskTo(a, width) & mask;
    }
    private maskTo(value: bigint, width: BitWidth): bigint {
        const mod = 1n << BigInt(width);
        return ((value % mod) + mod) % mod;
    }
    view(value: bigint, width: BitWidth, _opts?: {
        signedInput?: boolean;
    }): CalcView {
        const w = BigInt(width);
        const mod = 1n << w;
        const masked = ((value % mod) + mod) % mod;
        const half = 1n << (w - 1n);
        const signed = masked >= half ? masked - mod : masked;
        const unsignedMax = mod - 1n;
        const signedMin = -half;
        const signedMax = half - 1n;
        const inUnsigned = value >= 0n && value <= unsignedMax;
        const inSigned = value >= signedMin && value <= signedMax;
        const overflow = !inUnsigned && !inSigned;
        const views: NumView = {
            bin: masked.toString(2),
            oct: masked.toString(8),
            dec: masked.toString(10),
            hex: masked.toString(16),
        };
        const pop = this.popcount(masked, width);
        const bitLength = masked === 0n ? 0 : masked.toString(2).length;
        const leadingZeros = width - bitLength;
        const trailingZeros = masked === 0n ? width : this.countTrailingZeros(masked);
        return {
            masked,
            signed,
            views,
            popcount: pop,
            leadingZeros,
            trailingZeros,
            width,
            overflow,
        };
    }
    private countTrailingZeros(masked: bigint): number {
        let n = 0;
        let v = masked;
        while ((v & 1n) === 0n) {
            n++;
            v >>= 1n;
        }
        return n;
    }
    toBase(value: bigint, base: number, group?: number, sep = " "): string {
        let s = value.toString(base);
        let sign = "";
        if (s.startsWith("-")) {
            sign = "-";
            s = s.slice(1);
        }
        if (group && group > 0 && s.length > group) {
            const parts: string[] = [];
            for (let i = s.length; i > 0; i -= group) {
                parts.unshift(s.slice(Math.max(0, i - group), i));
            }
            s = parts.join(sep);
        }
        return sign + s;
    }
    popcount(value: bigint, width: BitWidth): number {
        let v = this.maskTo(value, width);
        let count = 0;
        while (v > 0n) {
            v &= v - 1n;
            count++;
        }
        return count;
    }
}
