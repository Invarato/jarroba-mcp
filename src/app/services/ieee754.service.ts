import { Injectable } from "@angular/core";
export type FloatPrecision = 32 | 64;
export type FloatCategory = "zero" | "subnormal" | "normal" | "infinity" | "nan";
export interface FloatFields {
    precision: FloatPrecision;
    bits: string;
    sign: string;
    exponent: string;
    mantissa: string;
    signBit: number;
    exponentRaw: number;
    bias: number;
    unbiasedExponent: number | null;
    hex: string;
    value: number;
    category: FloatCategory;
}
interface Layout {
    precision: FloatPrecision;
    totalBits: number;
    expBits: number;
    mantBits: number;
    bias: number;
    bytes: number;
    hexDigits: number;
}
const LAYOUT_32: Layout = {
    precision: 32,
    totalBits: 32,
    expBits: 8,
    mantBits: 23,
    bias: 127,
    bytes: 4,
    hexDigits: 8,
};
const LAYOUT_64: Layout = {
    precision: 64,
    totalBits: 64,
    expBits: 11,
    mantBits: 52,
    bias: 1023,
    bytes: 8,
    hexDigits: 16,
};
function layoutFor(precision: FloatPrecision): Layout {
    return precision === 32 ? LAYOUT_32 : LAYOUT_64;
}
@Injectable({ providedIn: "root" })
export class Ieee754Service {
    fromDecimal(x: number, precision: FloatPrecision): FloatFields {
        const L = layoutFor(precision);
        const buf = new ArrayBuffer(L.bytes);
        const dv = new DataView(buf);
        if (precision === 32) {
            dv.setFloat32(0, x, false);
        }
        else {
            dv.setFloat64(0, x, false);
        }
        const bytes = new Uint8Array(buf);
        return this.fieldsFromBytes(bytes, L);
    }
    fromBits(bits: string, precision: FloatPrecision): FloatFields | null {
        const L = layoutFor(precision);
        if (bits.length !== L.totalBits)
            return null;
        if (!/^[01]+$/.test(bits))
            return null;
        const bytes = new Uint8Array(L.bytes);
        for (let i = 0; i < L.bytes; i++) {
            const chunk = bits.slice(i * 8, i * 8 + 8);
            bytes[i] = parseInt(chunk, 2);
        }
        return this.fieldsFromBytes(bytes, L);
    }
    fromHex(hex: string, precision: FloatPrecision): FloatFields | null {
        const L = layoutFor(precision);
        let h = hex.trim();
        if (/^0x/i.test(h))
            h = h.slice(2);
        if (h.length !== L.hexDigits)
            return null;
        if (!/^[0-9a-fA-F]+$/.test(h))
            return null;
        const bytes = new Uint8Array(L.bytes);
        for (let i = 0; i < L.bytes; i++) {
            bytes[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
        }
        return this.fieldsFromBytes(bytes, L);
    }
    private fieldsFromBytes(bytes: Uint8Array, L: Layout): FloatFields {
        let bits = "";
        for (let i = 0; i < bytes.length; i++) {
            bits += bytes[i].toString(2).padStart(8, "0");
        }
        const sign = bits[0];
        const exponent = bits.slice(1, 1 + L.expBits);
        const mantissa = bits.slice(1 + L.expBits);
        const signBit = sign === "1" ? 1 : 0;
        const exponentRaw = parseInt(exponent, 2);
        const expAllZero = /^0+$/.test(exponent);
        const expAllOne = /^1+$/.test(exponent);
        const mantZero = /^0+$/.test(mantissa);
        let category: FloatCategory;
        if (expAllZero && mantZero)
            category = "zero";
        else if (expAllZero)
            category = "subnormal";
        else if (expAllOne && mantZero)
            category = "infinity";
        else if (expAllOne)
            category = "nan";
        else
            category = "normal";
        let unbiasedExponent: number | null;
        switch (category) {
            case "normal":
                unbiasedExponent = exponentRaw - L.bias;
                break;
            case "subnormal":
                unbiasedExponent = 1 - L.bias;
                break;
            case "zero":
                unbiasedExponent = exponentRaw - L.bias;
                break;
            default:
                unbiasedExponent = null;
                break;
        }
        let hex = "";
        for (let i = 0; i < bytes.length; i++) {
            hex += bytes[i].toString(16).padStart(2, "0");
        }
        const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        const value = L.precision === 32 ? dv.getFloat32(0, false) : dv.getFloat64(0, false);
        return {
            precision: L.precision,
            bits,
            sign,
            exponent,
            mantissa,
            signBit,
            exponentRaw,
            bias: L.bias,
            unbiasedExponent,
            hex,
            value,
            category,
        };
    }
}
