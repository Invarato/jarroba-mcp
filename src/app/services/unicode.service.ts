export interface UnicodeInfo {
    char: string;
    codePoint: number;
    hex: string;
    decimal: number;
    octal: string;
    binary: string;
    htmlDecimal: string;
    htmlHex: string;
    utf8Bytes: string;
    utf16Bytes: string;
}
export class UnicodeService {
    lookup(input: string): UnicodeInfo[] | null {
        if (!input.trim())
            return null;
        const uPlusMatch = input.match(/^U\+([0-9A-Fa-f]{1,6})$/);
        if (uPlusMatch) {
            const cp = parseInt(uPlusMatch[1], 16);
            return [this.infoFromCodePoint(cp)];
        }
        const decMatch = input.match(/^\d+$/);
        if (decMatch) {
            const cp = parseInt(input, 10);
            if (cp >= 0 && cp <= 1114111) {
                return [this.infoFromCodePoint(cp)];
            }
        }
        const results: UnicodeInfo[] = [];
        for (const char of input) {
            const cp = char.codePointAt(0);
            if (cp !== undefined)
                results.push(this.infoFromCodePoint(cp));
        }
        return results.length > 0 ? results : null;
    }
    asciiTable(): UnicodeInfo[] {
        const result: UnicodeInfo[] = [];
        for (let i = 32; i <= 127; i++) {
            result.push(this.infoFromCodePoint(i));
        }
        return result;
    }
    private infoFromCodePoint(cp: number): UnicodeInfo {
        const char = String.fromCodePoint(cp);
        const encoder = new TextEncoder();
        const utf8 = encoder.encode(char);
        const utf8Bytes = Array.from(utf8).map(b => b.toString(16).toUpperCase().padStart(2, "0")).join(" ");
        const utf16Arr: number[] = [];
        for (let i = 0; i < char.length; i++) {
            const code = char.charCodeAt(i);
            utf16Arr.push((code >> 8) & 255, code & 255);
        }
        const utf16Bytes = utf16Arr.map(b => b.toString(16).toUpperCase().padStart(2, "0")).join(" ");
        return {
            char,
            codePoint: cp,
            hex: `U+${cp.toString(16).toUpperCase().padStart(4, "0")}`,
            decimal: cp,
            octal: cp.toString(8),
            binary: cp.toString(2),
            htmlDecimal: `&#${cp};`,
            htmlHex: `&#x${cp.toString(16).toUpperCase()};`,
            utf8Bytes,
            utf16Bytes,
        };
    }
}
