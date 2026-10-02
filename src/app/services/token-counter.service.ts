export interface TokenResult {
    tokens: number;
    words: number;
    chars: number;
    contextPercent: number;
    contextWindow: number;
}
export interface TokenSegments {
    segments: string[];
    truncated: boolean;
    total: number;
}
const VIZ_LIMIT = 500;
export type Encoding = "o200k_base" | "cl100k_base" | "p50k_base" | "r50k_base";
export interface EncodingOption {
    id: Encoding;
    label: string;
    models: string;
    contextWindow: number;
}
export const ENCODINGS: EncodingOption[] = [
    { id: "o200k_base", label: "GPT-4o / o1", models: "GPT-4o, GPT-4o-mini, o1", contextWindow: 128000 },
    { id: "cl100k_base", label: "GPT-4 / GPT-3.5", models: "GPT-4, GPT-3.5 Turbo, embeddings", contextWindow: 128000 },
    { id: "p50k_base", label: "Codex / davinci-002", models: "Codex, text-davinci-002/003", contextWindow: 8000 },
    { id: "r50k_base", label: "GPT-3 / GPT-2", models: "davinci (GPT-3), GPT-2", contextWindow: 2048 },
];
const LOADERS: Record<Encoding, () => Promise<{
    encode: (t: string) => number[];
    decode: (ids: number[]) => string;
}>> = {
    o200k_base: () => import("gpt-tokenizer/encoding/o200k_base"),
    cl100k_base: () => import("gpt-tokenizer/encoding/cl100k_base"),
    p50k_base: () => import("gpt-tokenizer/encoding/p50k_base"),
    r50k_base: () => import("gpt-tokenizer/encoding/r50k_base"),
};
export class TokenCounterService {
    private cache = new Map<Encoding, {
        encode: (t: string) => number[];
        decode: (ids: number[]) => string;
    }>();
    private async enc(encoding: Encoding) {
        let e = this.cache.get(encoding);
        if (!e) {
            e = await LOADERS[encoding]();
            this.cache.set(encoding, e);
        }
        return e;
    }
    async count(text: string, encoding: Encoding = "o200k_base"): Promise<TokenResult | null> {
        if (!text.trim())
            return null;
        try {
            const { encode } = await this.enc(encoding);
            const tokens = encode(text).length;
            const words = text.trim().split(/\s+/).filter(w => w.length > 0).length;
            const chars = text.length;
            const contextWindow = ENCODINGS.find(e => e.id === encoding)?.contextWindow ?? 128000;
            const contextPercent = Math.min(100, (tokens / contextWindow) * 100);
            return { tokens, words, chars, contextPercent, contextWindow };
        }
        catch {
            return null;
        }
    }
    async getSegments(text: string, encoding: Encoding = "o200k_base"): Promise<TokenSegments | null> {
        if (!text.trim())
            return null;
        try {
            const { encode, decode } = await this.enc(encoding);
            const ids = encode(text);
            const total = ids.length;
            const truncated = total > VIZ_LIMIT;
            const limited = truncated ? ids.slice(0, VIZ_LIMIT) : ids;
            const segments = limited.map((id: number) => decode([id]));
            return { segments, truncated, total };
        }
        catch {
            return null;
        }
    }
}
