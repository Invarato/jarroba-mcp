import { Injectable } from "@angular/core";
export interface BitInfo {
    position: number;
    value: number;
    isParity: boolean;
    isOverall?: boolean;
}
export interface CorrectedBit extends BitInfo {
    wasFlipped: boolean;
}
export interface ParityCheck {
    parityPos: number;
    positions: number[];
    result: number;
    ok: boolean;
}
export interface EncodeResult {
    bits: BitInfo[];
    word: string;
    overallParity?: number;
}
export interface DetectResult {
    checks: ParityCheck[];
    syndrome: number;
    hasError: boolean;
    errorPosition: number;
    bits: CorrectedBit[];
    word: string;
    secded?: boolean;
    doubleError?: boolean;
    overallOk?: boolean;
}
export interface HammingOptions {
    secded?: boolean;
}
@Injectable({ providedIn: "root" })
export class HammingService {
    encode(input: string, opts?: HammingOptions): EncodeResult | null {
        const secded = !!opts?.secded;
        const cleaned = input.trim();
        if (!cleaned)
            return { bits: [], word: "" };
        if (!/^[01]+$/.test(cleaned))
            return null;
        const data = cleaned.split("").map(Number);
        const n = data.length;
        let r = 0;
        while ((1 << r) < n + r + 1)
            r++;
        const total = n + r;
        const codeword = new Array(total + 1).fill(0);
        let dataIdx = 0;
        for (let i = 1; i <= total; i++) {
            if ((i & (i - 1)) !== 0)
                codeword[i] = data[dataIdx++];
        }
        for (let k = 0; k < r; k++) {
            const p = 1 << k;
            let parity = 0;
            for (let j = p; j <= total; j++) {
                if (j & p)
                    parity ^= codeword[j];
            }
            codeword[p] = parity;
        }
        const bits: BitInfo[] = [];
        for (let i = 1; i <= total; i++) {
            bits.push({ position: i, value: codeword[i], isParity: (i & (i - 1)) === 0 });
        }
        const word = codeword.slice(1).join("");
        if (!secded)
            return { bits, word };
        let overall = 0;
        for (let i = 1; i <= total; i++)
            overall ^= codeword[i];
        const overallBit: BitInfo = { position: 0, value: overall, isParity: true, isOverall: true };
        return { bits: [overallBit, ...bits], word: overall + word, overallParity: overall };
    }
    detectAndCorrect(input: string, opts?: HammingOptions): DetectResult | null {
        const secded = !!opts?.secded;
        const cleaned = input.trim();
        if (!cleaned) {
            const empty: DetectResult = {
                checks: [],
                syndrome: 0,
                hasError: false,
                errorPosition: 0,
                bits: [],
                word: "",
            };
            if (secded) {
                empty.secded = true;
                empty.doubleError = false;
                empty.overallOk = true;
            }
            return empty;
        }
        if (!/^[01]+$/.test(cleaned))
            return null;
        if (!secded)
            return this.detectPlain(cleaned);
        return this.detectSecded(cleaned);
    }
    params(dataBits: number, opts?: HammingOptions): {
        n: number;
        k: number;
        r: number;
        rate: number;
        distance: number;
    } {
        const k = Math.max(0, Math.floor(dataBits));
        let r = 0;
        while ((1 << r) < k + r + 1)
            r++;
        const extra = opts?.secded ? 1 : 0;
        const totalParity = r + extra;
        const n = k + totalParity;
        return {
            n,
            k,
            r: totalParity,
            rate: n === 0 ? 0 : k / n,
            distance: opts?.secded ? 4 : 3,
        };
    }
    coverage(totalBits: number): {
        parityPos: number;
        covers: number[];
    }[] {
        const out: {
            parityPos: number;
            covers: number[];
        }[] = [];
        for (let p = 1; p <= totalBits; p <<= 1) {
            const covers: number[] = [];
            for (let j = 1; j <= totalBits; j++) {
                if (j & p)
                    covers.push(j);
            }
            out.push({ parityPos: p, covers });
        }
        return out;
    }
    textToDataBits(text: string): string | null {
        let out = "";
        for (const ch of text) {
            const code = ch.codePointAt(0)!;
            if (code > 255)
                return null;
            out += code.toString(2).padStart(8, "0");
        }
        return out;
    }
    dataBitsToText(bits: string): string | null {
        if (!/^[01]*$/.test(bits))
            return null;
        if (bits.length % 8 !== 0)
            return null;
        let out = "";
        for (let i = 0; i < bits.length; i += 8) {
            out += String.fromCharCode(parseInt(bits.slice(i, i + 8), 2));
        }
        return out;
    }
    simulate(dataBits: string, flips: number[], opts?: HammingOptions): DetectResult | null {
        const enc = this.encode(dataBits, opts);
        if (!enc)
            return null;
        const arr = enc.word.split("");
        for (const idx of flips) {
            if (idx < 0 || idx >= arr.length)
                continue;
            arr[idx] = arr[idx] === "0" ? "1" : "0";
        }
        return this.detectAndCorrect(arr.join(""), opts);
    }
    private detectPlain(cleaned: string): DetectResult {
        const total = cleaned.length;
        const received = [0, ...cleaned.split("").map(Number)];
        let r = 0;
        while ((1 << r) <= total)
            r++;
        let syndromeVal = 0;
        const checks: ParityCheck[] = [];
        for (let k = 0; k < r; k++) {
            const p = 1 << k;
            if (p > total)
                break;
            const positions: number[] = [];
            let xorResult = 0;
            for (let j = p; j <= total; j++) {
                if (j & p) {
                    positions.push(j);
                    xorResult ^= received[j];
                }
            }
            checks.push({ parityPos: p, positions, result: xorResult, ok: xorResult === 0 });
            if (xorResult !== 0)
                syndromeVal += p;
        }
        const corrected = [...received];
        let hasError = false;
        let errorPosition = 0;
        if (syndromeVal !== 0 && syndromeVal <= total) {
            hasError = true;
            errorPosition = syndromeVal;
            corrected[syndromeVal] ^= 1;
        }
        const bits: CorrectedBit[] = [];
        for (let i = 1; i <= total; i++) {
            bits.push({
                position: i,
                value: corrected[i],
                isParity: (i & (i - 1)) === 0,
                wasFlipped: i === syndromeVal,
            });
        }
        return { checks, syndrome: syndromeVal, hasError, errorPosition, bits, word: corrected.slice(1).join("") };
    }
    private detectSecded(cleaned: string): DetectResult {
        const fullBits = cleaned.split("").map(Number);
        let overallVal = fullBits[0];
        const hamming = fullBits.slice(1);
        const total = hamming.length;
        const full = [0, ...hamming];
        let r = 0;
        while ((1 << r) <= total)
            r++;
        let syndromeVal = 0;
        const checks: ParityCheck[] = [];
        for (let k = 0; k < r; k++) {
            const p = 1 << k;
            if (p > total)
                break;
            const positions: number[] = [];
            let xorResult = 0;
            for (let j = p; j <= total; j++) {
                if (j & p) {
                    positions.push(j);
                    xorResult ^= full[j];
                }
            }
            checks.push({ parityPos: p, positions, result: xorResult, ok: xorResult === 0 });
            if (xorResult !== 0)
                syndromeVal += p;
        }
        let overallParity = overallVal;
        for (let i = 1; i <= total; i++)
            overallParity ^= full[i];
        const overallOk = overallParity === 0;
        const corrected = [...full];
        let hasError = false;
        let doubleError = false;
        let errorPosition = 0;
        let overallFlipped = false;
        if (syndromeVal === 0 && overallOk) {
        }
        else if (syndromeVal !== 0 && !overallOk) {
            if (syndromeVal <= total) {
                hasError = true;
                errorPosition = syndromeVal;
                corrected[syndromeVal] ^= 1;
            }
            else {
                hasError = true;
                doubleError = true;
            }
        }
        else if (syndromeVal !== 0 && overallOk) {
            hasError = true;
            doubleError = true;
        }
        else {
            hasError = true;
            overallFlipped = true;
            overallVal ^= 1;
        }
        const bits: CorrectedBit[] = [{
                position: 0,
                value: overallVal,
                isParity: true,
                isOverall: true,
                wasFlipped: overallFlipped,
            }];
        for (let i = 1; i <= total; i++) {
            bits.push({
                position: i,
                value: corrected[i],
                isParity: (i & (i - 1)) === 0,
                wasFlipped: !doubleError && i === errorPosition,
            });
        }
        return {
            checks,
            syndrome: syndromeVal,
            hasError,
            errorPosition,
            bits,
            word: overallVal + corrected.slice(1).join(""),
            secded: true,
            doubleError,
            overallOk,
        };
    }
}
