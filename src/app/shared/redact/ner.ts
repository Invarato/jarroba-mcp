import { Span } from "./anonymize";
export interface NerToken {
    entity: string;
    word?: string;
    start?: number;
    end?: number;
    score?: number;
}
const TYPE_MAP: Record<string, string> = {
    PER: "person",
    PERSON: "person",
    LOC: "location",
    ORG: "org",
    MISC: "misc",
    private_person: "person",
    private_address: "address",
    private_date: "date",
    account_number: "account",
    secret: "credential",
};
interface Group {
    type: string;
    words: string[];
    score: number;
    n: number;
    start?: number;
    end?: number;
}
export function aggregateNerSpans(tokens: NerToken[], text: string, minScore = 0.5): Span[] {
    const groups: Group[] = [];
    let cur: Group | null = null;
    for (const t of tokens) {
        const m = /^([BIES])-(\w+)$/.exec(t.entity || "");
        if (!m) {
            cur = null;
            continue;
        }
        const bi = m[1] === "S" ? "B" : m[1] === "E" ? "I" : m[1], type = m[2];
        if (!(type in TYPE_MAP) && !/^[A-Z]+$/.test(type)) {
            cur = null;
            continue;
        }
        const hasOff = t.start != null && t.end != null;
        if (bi === "B" || !cur || cur.type !== type) {
            cur = { type, words: [t.word ?? ""], score: t.score ?? 1, n: 1, start: hasOff ? t.start : undefined, end: hasOff ? t.end : undefined };
            groups.push(cur);
        }
        else {
            cur.words.push(t.word ?? "");
            cur.score += t.score ?? 1;
            cur.n++;
            if (hasOff)
                cur.end = t.end;
        }
        if (m[1] === "S" || m[1] === "E")
            cur = null;
    }
    const spans: Span[] = [];
    let cursor = 0;
    for (const g of groups) {
        if (g.score / g.n < minScore)
            continue;
        let start = g.start, end = g.end;
        if (start == null || end == null) {
            const bpe = g.words.some(w => /^[\sĠ▁]/.test(w));
            const s = bpe
                ? g.words.map(w => w.replace(/^[Ġ▁]/, " ")).join("").trim()
                : g.words.map((w, i) => w.startsWith("##") ? w.slice(2) : (i > 0 ? " " + w : w)).join("");
            const idx = text.indexOf(s, cursor);
            if (idx < 0)
                continue;
            start = idx;
            end = idx + s.length;
        }
        cursor = end;
        if (end > start)
            spans.push({ start, end, entity: TYPE_MAP[g.type] ?? "misc", value: text.slice(start, end) });
    }
    return spans;
}
export const NER_ENTITIES = ["person", "org", "location", "misc", "address", "date", "account", "credential"] as const;
export function nerChunks(text: string, maxChars = 1500): {
    text: string;
    offset: number;
}[] {
    if (text.length <= maxChars)
        return [{ text, offset: 0 }];
    const out: {
        text: string;
        offset: number;
    }[] = [];
    let buf = "", bufStart = 0, pos = 0;
    const flush = () => { if (buf) {
        out.push({ text: buf, offset: bufStart });
        buf = "";
    } };
    for (const line of text.split(/(?<=\n)/)) {
        if (line.length > maxChars) {
            flush();
            for (let i = 0; i < line.length; i += maxChars)
                out.push({ text: line.slice(i, i + maxChars), offset: pos + i });
        }
        else {
            if (buf && buf.length + line.length > maxChars)
                flush();
            if (!buf)
                bufStart = pos;
            buf += line;
        }
        pos += line.length;
    }
    flush();
    return out;
}
