export interface CodecResult {
    url: string | null;
    base64: string | null;
    html: string;
}
const NOMBRADAS: Record<string, string> = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: "\"",
    apos: "'",
    nbsp: "\u00A0",
    copy: "\u00A9",
    reg: "\u00AE",
    trade: "\u2122",
};
export function decodeEntidades(s: string): string {
    return s.replace(/&(#[0-9]{1,7}|#[xX][0-9a-fA-F]{1,6}|[a-zA-Z]+);/g, (m, cuerpo: string) => {
        if (cuerpo[0] === "#") {
            const cp = cuerpo[1] === "x" || cuerpo[1] === "X" ? parseInt(cuerpo.slice(2), 16) : parseInt(cuerpo.slice(1), 10);
            const valido = cp > 0 && cp <= 1114111 && !(cp >= 55296 && cp <= 57343);
            return valido ? String.fromCodePoint(cp) : m;
        }
        return NOMBRADAS[cuerpo] ?? m;
    });
}
export class CoderDecoderService {
    encode(input: string): CodecResult {
        return {
            url: encodeURIComponent(input),
            base64: this.encodeBase64(input),
            html: input.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c] ?? c)),
        };
    }
    decode(input: string): CodecResult {
        let url: string | null;
        try {
            url = decodeURIComponent(input);
        }
        catch {
            url = null;
        }
        return {
            url,
            base64: this.decodeBase64(input),
            html: decodeEntidades(input),
        };
    }
    private encodeBase64(str: string): string {
        try {
            const bytes = new TextEncoder().encode(str);
            return btoa(Array.from(bytes, b => String.fromCodePoint(b)).join(""));
        }
        catch {
            return null as unknown as string;
        }
    }
    private decodeBase64(str: string): string | null {
        try {
            const t = str.trim().replace(/\s+/g, "").replace(/-/g, "+").replace(/_/g, "/").replace(/=+$/, "");
            if (t.length % 4 === 1)
                return null;
            const binary = atob(t + "===".slice((t.length + 3) % 4));
            const bytes = Uint8Array.from(binary, m => m.codePointAt(0)!);
            return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
        }
        catch {
            return null;
        }
    }
}
