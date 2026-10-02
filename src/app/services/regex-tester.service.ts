export interface RegexCapture {
    name: string;
    value: string | undefined;
    index: number | undefined;
    named: boolean;
}
export interface RegexMatch {
    index: number;
    value: string;
    captures: RegexCapture[];
}
export interface RegexResult {
    matches: RegexMatch[];
    isValid: boolean;
    errorMsg: string | null;
}
export interface ReplaceResult {
    output: string;
    isValid: boolean;
    errorMsg: string | null;
}
export interface ExplainToken {
    raw: string;
    kind: string;
    depth: number;
    data?: Record<string, unknown>;
}
const FLAG_CHARS = "gimsuy";
export const sanitizeFlags = (flags: string, forceGlobal = true): string => [...new Set(((forceGlobal ? "g" : "") + (flags || "").replace(new RegExp(`[^${FLAG_CHARS}]`, "g"), "")).split(""))].join("");
export interface RegexLibraryEntry {
    id: string;
    pattern: string;
    flags: string;
    sample: string;
}
export const REGEX_LIBRARY: readonly RegexLibraryEntry[] = [
    { id: "email", pattern: "(?<![\\w.+-])[\\w.+-]+@[\\w-]+(?:\\.[\\w-]+)+", flags: "gi", sample: "contacto: ana.perez@empresa.com y soporte+info@sub.dominio.es (no vale @mal)" },
    { id: "url", pattern: "https?://[^\\s]+", flags: "gi", sample: "Mira https://jarroba.com/tools y http://ej.com/a?b=1, pero no ftp://x" },
    { id: "ipv4", pattern: "\\b(?:\\d{1,3}\\.){3}\\d{1,3}\\b", flags: "g", sample: "servidor 192.168.1.10, gateway 10.0.0.1, dns 8.8.8.8" },
    { id: "date", pattern: "\\d{4}-\\d{2}-\\d{2}", flags: "g", sample: "del 2026-07-17 al 2026-08-01 (formato malo: 17/07/2026)" },
    { id: "time", pattern: "\\b([01]?\\d|2[0-3]):[0-5]\\d\\b", flags: "g", sample: "reuni\u00F3n a las 9:30, comida 14:00, cierre 23:59" },
    { id: "phone", pattern: "(?:\\+34\\s?)?[6-9]\\d{2}(?:\\s?\\d{2}){3}", flags: "g", sample: "llama al 612 34 56 78 o al +34 911223344, fijo 987654321" },
    { id: "dni", pattern: "\\b(?:\\d{8}|[XYZ]\\d{7})[A-Z]\\b", flags: "g", sample: "DNI 12345678Z, NIE X1234567L (mal: 1234A)" },
    { id: "hex", pattern: "#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})\\b", flags: "g", sample: "fondo #fff, texto #1a2b3c, borde #ABCDEF" },
    { id: "uuid", pattern: "[0-9a-fA-F]{8}-(?:[0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}", flags: "gi", sample: "id 550e8400-e29b-41d4-a716-446655440000 fin" },
    { id: "number", pattern: "-?\\d+(?:[.,]\\d+)?", flags: "g", sample: "precios: 12, 3.5, -0,99 y 1000000" },
];
type SetItem = {
    from: string;
    to?: string;
} | {
    cls: string;
};
type Node = {
    t: "lit";
    ch: string;
    raw: string;
} | {
    t: "any";
    raw: string;
} | {
    t: "class";
    c: string;
    raw: string;
} | {
    t: "set";
    neg: boolean;
    items: SetItem[];
    raw: string;
} | {
    t: "group";
    kind: string;
    name?: string;
    num?: number;
    alts: Node[][];
    raw: string;
} | {
    t: "anchor";
    a: string;
    raw: string;
} | {
    t: "backref";
    ref: string;
    raw: string;
} | {
    t: "esc";
    ch: string;
    raw: string;
} | {
    t: "uprop";
    neg: boolean;
    prop: string;
    raw: string;
} | {
    t: "quant";
    min: number;
    max: number;
    lazy: boolean;
    child: Node;
    raw: string;
};
class Parser {
    private i = 0;
    private groupNum = 0;
    constructor(private readonly s: string) { }
    parse(): Node[][] { const alts = this.parseAlternation(); return alts; }
    private parseAlternation(): Node[][] {
        const alts: Node[][] = [this.parseSequence()];
        while (this.s[this.i] === "|") {
            this.i++;
            alts.push(this.parseSequence());
        }
        return alts;
    }
    private parseSequence(): Node[] {
        const out: Node[] = [];
        while (this.i < this.s.length && this.s[this.i] !== "|" && this.s[this.i] !== ")") {
            const atom = this.parseAtom();
            if (!atom)
                break;
            out.push(this.maybeQuant(atom));
        }
        return out;
    }
    private maybeQuant(child: Node): Node {
        const start = this.i;
        const c = this.s[this.i];
        let min: number | null = null, max = Infinity;
        if (c === "*") {
            min = 0;
            this.i++;
        }
        else if (c === "+") {
            min = 1;
            this.i++;
        }
        else if (c === "?") {
            min = 0;
            max = 1;
            this.i++;
        }
        else if (c === "{") {
            const m = /^\{(\d+)(,(\d*)?)?\}/.exec(this.s.slice(this.i));
            if (m) {
                min = +m[1];
                max = m[2] === undefined ? +m[1] : (m[3] === "" || m[3] === undefined ? Infinity : +m[3]);
                this.i += m[0].length;
            }
        }
        if (min === null)
            return child;
        let lazy = false;
        if (this.s[this.i] === "?") {
            lazy = true;
            this.i++;
        }
        return { t: "quant", min, max, lazy, child, raw: this.s.slice(start, this.i) };
    }
    private parseAtom(): Node | null {
        const c = this.s[this.i];
        if (c === "(")
            return this.parseGroup();
        if (c === "[")
            return this.parseSet();
        if (c === "^" || c === "$") {
            this.i++;
            return { t: "anchor", a: c === "^" ? "start" : "end", raw: c };
        }
        if (c === ".") {
            this.i++;
            return { t: "any", raw: "." };
        }
        if (c === "\\")
            return this.parseEscape();
        this.i++;
        return { t: "lit", ch: c, raw: c };
    }
    private parseGroup(): Node {
        const st = this.i;
        this.i++;
        let kind = "cap", name: string | undefined, num: number | undefined;
        if (this.s[this.i] === "?") {
            const rest = this.s.slice(this.i);
            let m: RegExpExecArray | null;
            if ((m = /^\?<([A-Za-z_$][\w$]*)>/.exec(rest))) {
                kind = "named";
                name = m[1];
                this.i += m[0].length;
                num = ++this.groupNum;
            }
            else if (rest.startsWith("?:")) {
                kind = "ncap";
                this.i += 2;
            }
            else if (rest.startsWith("?=")) {
                kind = "la";
                this.i += 2;
            }
            else if (rest.startsWith("?!")) {
                kind = "nla";
                this.i += 2;
            }
            else if (rest.startsWith("?<=")) {
                kind = "lb";
                this.i += 3;
            }
            else if (rest.startsWith("?<!")) {
                kind = "nlb";
                this.i += 3;
            }
            else {
                this.i++;
            }
        }
        else {
            num = ++this.groupNum;
        }
        const alts = this.parseAlternation();
        if (this.s[this.i] === ")")
            this.i++;
        return { t: "group", kind, name, num, alts, raw: this.s.slice(st, this.i) };
    }
    private parseSet(): Node {
        const st = this.i;
        this.i++;
        let neg = false;
        if (this.s[this.i] === "^") {
            neg = true;
            this.i++;
        }
        const items: SetItem[] = [];
        while (this.i < this.s.length && this.s[this.i] !== "]") {
            let ch: string;
            if (this.s[this.i] === "\\") {
                const n = this.s[this.i + 1];
                if ("dDwWsS".includes(n)) {
                    items.push({ cls: n });
                    this.i += 2;
                    continue;
                }
                ch = this.unescapeChar(n);
                this.i += 2;
            }
            else {
                ch = this.s[this.i];
                this.i++;
            }
            if (this.s[this.i] === "-" && this.s[this.i + 1] !== "]" && this.i + 1 < this.s.length) {
                this.i++;
                let to: string;
                if (this.s[this.i] === "\\") {
                    to = this.unescapeChar(this.s[this.i + 1]);
                    this.i += 2;
                }
                else {
                    to = this.s[this.i];
                    this.i++;
                }
                items.push({ from: ch, to });
            }
            else
                items.push({ from: ch });
        }
        if (this.s[this.i] === "]")
            this.i++;
        return { t: "set", neg, items, raw: this.s.slice(st, this.i) };
    }
    private parseEscape(): Node {
        const st = this.i;
        this.i++;
        const c = this.s[this.i];
        if (c === undefined)
            return { t: "lit", ch: "\\", raw: "\\" };
        if ("dDwWsS".includes(c)) {
            this.i++;
            return { t: "class", c, raw: "\\" + c };
        }
        if (c === "b") {
            this.i++;
            return { t: "anchor", a: "wb", raw: "\\b" };
        }
        if (c === "B") {
            this.i++;
            return { t: "anchor", a: "nwb", raw: "\\B" };
        }
        if (/\d/.test(c)) {
            const m = /^\d+/.exec(this.s.slice(this.i))![0];
            this.i += m.length;
            return { t: "backref", ref: m, raw: "\\" + m };
        }
        if (c === "k") {
            const m = /^k<([^>]+)>/.exec(this.s.slice(this.i));
            if (m) {
                this.i += m[0].length;
                return { t: "backref", ref: m[1], raw: "\\" + m[0] };
            }
        }
        if (c === "p" || c === "P") {
            const m = /^[pP]\{([^}]+)\}/.exec(this.s.slice(this.i));
            if (m) {
                this.i += m[0].length;
                return { t: "uprop", neg: c === "P", prop: m[1], raw: "\\" + m[0] };
            }
        }
        this.i++;
        return { t: "esc", ch: this.unescapeChar(c), raw: "\\" + c };
    }
    private unescapeChar(c: string): string {
        const map: Record<string, string> = { n: "\n", r: "\r", t: "\t", f: "\f", v: "\v", "0": "\0" };
        return map[c] ?? c;
    }
}
function safeParse(pattern: string): Node[][] | null {
    try {
        return new Parser(pattern).parse();
    }
    catch {
        return null;
    }
}
export class RegexTesterService {
    groupNames(pattern: string): (string | undefined)[] {
        const out: (string | undefined)[] = [];
        const ast = safeParse(pattern);
        if (!ast)
            return out;
        const walk = (nodes: Node[]) => { for (const n of nodes)
            walkNode(n); };
        const walkNode = (n: Node) => {
            if (n.t === "group") {
                if (n.num)
                    out[n.num] = n.name;
                for (const a of n.alts)
                    walk(a);
            }
            else if (n.t === "quant")
                walkNode(n.child);
        };
        for (const a of ast)
            walk(a);
        return out;
    }
    test(pattern: string, flags: string, text: string): RegexResult | null {
        if (!pattern)
            return null;
        const base = sanitizeFlags(flags);
        const names = this.groupNames(pattern);
        let regex: RegExp;
        try {
            regex = new RegExp(pattern, base + "d");
        }
        catch {
            try {
                regex = new RegExp(pattern, base);
            }
            catch (e) {
                return { matches: [], isValid: false, errorMsg: (e as Error).message };
            }
        }
        try {
            const matches: RegexMatch[] = [];
            for (const m of (text || "").matchAll(regex)) {
                const captures: RegexCapture[] = [];
                const ind = (m as RegExpMatchArray & {
                    indices?: (number[] | undefined)[];
                }).indices;
                for (let g = 1; g < m.length; g++) {
                    captures.push({ name: names[g] ?? String(g), value: m[g], index: ind?.[g]?.[0], named: !!names[g] });
                }
                matches.push({ index: m.index!, value: m[0], captures });
            }
            return { matches, isValid: true, errorMsg: null };
        }
        catch (e) {
            return { matches: [], isValid: false, errorMsg: (e as Error).message };
        }
    }
    replace(pattern: string, flags: string, text: string, replacement: string): ReplaceResult {
        if (!pattern)
            return { output: text, isValid: true, errorMsg: null };
        try {
            const regex = new RegExp(pattern, sanitizeFlags(flags));
            return { output: (text || "").replace(regex, replacement), isValid: true, errorMsg: null };
        }
        catch (e) {
            return { output: "", isValid: false, errorMsg: (e as Error).message };
        }
    }
    explain(pattern: string, flags = ""): ExplainToken[] {
        if (!pattern)
            return [];
        try {
            new RegExp(pattern, sanitizeFlags(flags, false));
        }
        catch {
            return [];
        }
        const ast = safeParse(pattern);
        if (!ast)
            return [];
        const out: ExplainToken[] = [];
        const walkAlts = (alts: Node[][], depth: number) => {
            alts.forEach((seq, ai) => {
                if (ai > 0)
                    out.push({ raw: "|", kind: "alt", depth });
                for (const n of seq)
                    walk(n, depth);
            });
        };
        const walk = (n: Node, depth: number) => {
            switch (n.t) {
                case "lit": {
                    const last = out[out.length - 1];
                    if (last && last.kind === "lit" && last.depth === depth) {
                        last.raw += n.raw;
                        (last.data as {
                            text: string;
                        }).text += n.ch;
                    }
                    else
                        out.push({ raw: n.raw, kind: "lit", depth, data: { text: n.ch } });
                    break;
                }
                case "esc":
                    out.push({ raw: n.raw, kind: "esc", depth, data: { ch: n.ch } });
                    break;
                case "any":
                    out.push({ raw: n.raw, kind: "any", depth });
                    break;
                case "class":
                    out.push({ raw: n.raw, kind: "class", depth, data: { c: n.c } });
                    break;
                case "anchor":
                    out.push({ raw: n.raw, kind: "anchor", depth, data: { a: n.a } });
                    break;
                case "backref":
                    out.push({ raw: n.raw, kind: "backref", depth, data: { ref: n.ref } });
                    break;
                case "uprop":
                    out.push({ raw: n.raw, kind: "uprop", depth, data: { neg: n.neg, prop: n.prop } });
                    break;
                case "set":
                    out.push({ raw: n.raw, kind: "set", depth, data: { neg: n.neg, desc: describeSet(n.items) } });
                    break;
                case "group": {
                    out.push({ raw: groupOpenRaw(n.kind, n.name), kind: "group-open", depth, data: { gkind: n.kind, name: n.name, num: n.num } });
                    walkAlts(n.alts, depth + 1);
                    out.push({ raw: ")", kind: "group-close", depth });
                    break;
                }
                case "quant": {
                    walk(n.child, depth);
                    out.push({ raw: n.raw, kind: "quant", depth, data: { min: n.min, max: n.max === Infinity ? null : n.max, lazy: n.lazy } });
                    break;
                }
            }
        };
        walkAlts(ast, 0);
        return out;
    }
    generateCandidates(pattern: string, n = 60): string[] {
        const ast = safeParse(pattern);
        if (!ast)
            return [];
        const out: string[] = [];
        for (let attempt = 0; attempt < n; attempt++) {
            const s = genAlts(ast, {});
            if (s != null)
                out.push(s);
        }
        return out;
    }
    verifyFlags(flags: string): string { return sanitizeFlags(flags, false).replace(/[gy]/g, ""); }
    generateExample(pattern: string, flags: string): string | null {
        let verifier: RegExp;
        try {
            verifier = new RegExp(pattern, this.verifyFlags(flags));
        }
        catch {
            return null;
        }
        return this.generateCandidates(pattern).find(s => verifier.test(s)) ?? null;
    }
}
function groupOpenRaw(kind: string, name?: string): string {
    switch (kind) {
        case "ncap": return "(?:";
        case "named": return `(?<${name}>`;
        case "la": return "(?=";
        case "nla": return "(?!";
        case "lb": return "(?<=";
        case "nlb": return "(?<!";
        default: return "(";
    }
}
function describeSet(items: SetItem[]): string {
    return items.map(it => "cls" in it ? "\\" + it.cls : (it.to ? `${vis(it.from)}-${vis(it.to)}` : vis(it.from))).join(", ");
}
const vis = (c: string) => ({ "\n": "\\n", "\r": "\\r", "\t": "\\t", " ": "\u2423" } as Record<string, string>)[c] ?? c;
const RI = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));
const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const DIGIT = "0123456789", LOWER = "abcdefghijklmnopqrstuvwxyz", UPPER = LOWER.toUpperCase(), WORD = LOWER + UPPER + DIGIT + "_";
const PRINT = LOWER + UPPER + DIGIT + " ";
function genAlts(alts: Node[][], caps: Record<string, string>): string | null {
    const seq = pick(alts);
    let out = "";
    for (const n of seq) {
        const g = genNode(n, caps);
        if (g == null)
            return null;
        out += g;
    }
    return out;
}
function genNode(n: Node, caps: Record<string, string>): string | null {
    switch (n.t) {
        case "lit": return n.ch;
        case "esc": return n.ch;
        case "any": return pick([...LOWER + UPPER + DIGIT]);
        case "anchor": return "";
        case "class": return genClass(n.c);
        case "set": return genSet(n);
        case "uprop": return /L|Letter|Alpha/i.test(n.prop) ? pick([...LOWER]) : /N|Number|Digit/i.test(n.prop) ? pick([...DIGIT]) : "x";
        case "backref": return caps[n.ref] ?? "";
        case "group": {
            const s = genAlts(n.alts, caps);
            if (s == null)
                return null;
            if (n.kind === "nla" || n.kind === "nlb")
                return "";
            if (n.kind === "la" || n.kind === "lb")
                return n.kind === "lb" ? "" : "";
            if (n.num) {
                caps[String(n.num)] = s;
                if (n.name)
                    caps[n.name] = s;
            }
            return s;
        }
        case "quant": {
            const max = n.max === Infinity ? n.min + 3 : Math.min(n.max, n.min + 4);
            const count = RI(n.min, Math.max(n.min, max));
            let out = "";
            for (let k = 0; k < count; k++) {
                const g = genNode(n.child, caps);
                if (g == null)
                    return null;
                out += g;
            }
            return out;
        }
    }
}
function genClass(c: string): string {
    switch (c) {
        case "d": return pick([...DIGIT]);
        case "w": return pick([...WORD]);
        case "s": return " ";
        case "D": return pick([...LOWER + UPPER]);
        case "W": return pick([..." -."]);
        case "S": return pick([...LOWER + DIGIT]);
        default: return "x";
    }
}
function genSet(n: {
    neg: boolean;
    items: SetItem[];
}): string {
    if (n.neg) {
        for (let k = 0; k < 30; k++) {
            const ch = pick([...PRINT]);
            if (!inSet(ch, n.items))
                return ch;
        }
        return "x";
    }
    const it = pick(n.items);
    if ("cls" in it)
        return genClass(it.cls);
    if (it.to)
        return String.fromCharCode(RI(it.from.charCodeAt(0), it.to.charCodeAt(0)));
    return it.from;
}
function inSet(ch: string, items: SetItem[]): boolean {
    const code = ch.charCodeAt(0);
    return items.some(it => {
        if ("cls" in it)
            return new RegExp("\\" + it.cls).test(ch);
        if (it.to)
            return code >= it.from.charCodeAt(0) && code <= it.to.charCodeAt(0);
        return ch === it.from;
    });
}
