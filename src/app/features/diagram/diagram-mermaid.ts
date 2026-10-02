import { ShapeKind, SHAPE_SIZES } from "./diagram-shapes";
import { SHAPE_PARAM_KEYS } from "./diagram-shapes";
import type { DiagramTimeline } from "./diagram-timeline";
import { ChartSpec } from "./diagram-charts";
export interface ImportNode {
    id: string;
    kind: ShapeKind;
    x: number;
    y: number;
    w: number;
    h: number;
    text: string;
    fill?: string;
    stroke?: string;
    icon?: string;
    noPorts?: boolean;
    chart?: ChartSpec;
    extra?: Record<string, unknown>;
}
export interface ImportEdge {
    id: string;
    docId?: string;
    fromId: string;
    fromPort: string;
    toId: string;
    toPort: string;
    label?: string;
    style: "straight" | "orthogonal" | "rounded";
    arrows?: "none" | "start" | "end" | "both";
    extra?: Record<string, unknown>;
}
export const IMPORT_NODE_EXTRA = ["bold", "italic", "textColor", "fontSize", "font", "align", "valign", "textRotation", "borderStyle", "borderWidth", "borderPattern", "corners", "opacity", "rotation", "skin", "group", "runs", "titleSide", "titleH", ...SHAPE_PARAM_KEYS] as const;
export const IMPORT_EDGE_EXTRA = ["color", "dash", "dashPattern", "width", "head"] as const;
export interface ImportResult {
    nodes: ImportNode[];
    edges: ImportEdge[];
    meta?: {
        theme?: string;
        skin?: string;
        background?: string;
        poster?: {
            x: number;
            y: number;
            w: number;
            h: number;
        };
        timeline?: DiagramTimeline;
    };
}
export type MermaidError = "empty" | "unsupported" | "unparsable";
const EXPORT_WRAP: Record<ShapeKind, [
    string,
    string
]> = {
    rect: ["[", "]"],
    round: ["(", ")"],
    ellipse: ["((", "))"],
    diamond: ["{", "}"],
    hexagon: ["{{", "}}"],
    parallelogram: ["[/", "/]"],
    cylinder: ["[(", ")]"],
    note: [">", "]"],
    text: ["[", "]"],
    container: ["[", "]"],
    triangle: ["[", "]"],
    star: ["[", "]"],
    cloud: ["(", ")"],
    document: ["[", "]"],
    card: ["[", "]"],
    callout: ["[", "]"],
    actor: ["[", "]"],
    cross: ["[", "]"],
    process: ["[", "]"],
    icon: ["[", "]"],
    image: ["[", "]"],
    chart: ["[", "]"],
};
function mermaidExportable(n: {
    kind: ShapeKind;
    text: string;
}): boolean {
    return !!(n.text ?? "").trim() && n.kind !== "chart" && n.kind !== "image";
}
export function exportMermaid(nodes: Array<{
    id: string;
    kind: ShapeKind;
    text: string;
}>, edges: Array<{
    fromId: string;
    toId: string;
    label?: string;
}>): string {
    const drawable = nodes.filter(mermaidExportable);
    const keep = new Set(drawable.map(n => n.id));
    const idMap = new Map<string, string>();
    const used = new Set<string>();
    const safeId = (raw: string): string => {
        if (idMap.has(raw))
            return idMap.get(raw)!;
        let base = raw.replace(/[^A-Za-z0-9_]/g, "_").replace(/^(\d)/, "n$1") || "n";
        let id = base, k = 1;
        while (used.has(id))
            id = `${base}_${k++}`;
        used.add(id);
        idMap.set(raw, id);
        return id;
    };
    const q = (t: string) => `"${(t || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/\n/g, " ")}"`;
    const lines = ["graph TD"];
    for (const n of drawable) {
        const [o, c] = EXPORT_WRAP[n.kind] ?? ["[", "]"];
        lines.push(`  ${safeId(n.id)}${o}${q(n.text)}${c}`);
    }
    for (const e of edges) {
        if (!keep.has(e.fromId) || !keep.has(e.toId))
            continue;
        const lbl = e.label ? `|${e.label.replace(/\|/g, " ")}|` : "";
        lines.push(`  ${safeId(e.fromId)} -->${lbl} ${safeId(e.toId)}`);
    }
    return lines.join("\n");
}
const LAYER_GAP = 130, NODE_GAP = 60;
export function importMermaid(text: string): {
    result?: ImportResult;
    error?: MermaidError;
} {
    const clean = stripComments(text).trim();
    if (!clean)
        return { error: "empty" };
    const first = clean.split(/\s+/)[0].toLowerCase();
    if (first === "graph" || first === "flowchart")
        return parseFlowchart(clean);
    if (first === "statediagram" || first === "statediagram-v2")
        return parseGraphLike(clean, "state");
    if (first === "erdiagram")
        return parseGraphLike(clean, "er");
    if (first === "classdiagram")
        return parseGraphLike(clean, "class");
    if (first === "sequencediagram")
        return parseSequence(clean);
    if (first === "quadrantchart")
        return parseQuadrant(clean);
    if (first === "pie")
        return parsePie(clean);
    if (first === "xychart-beta" || first === "xychart")
        return parseXychart(clean);
    return { error: "unsupported" };
}
const unq = (s: string) => s.trim().replace(/^["']|["']$/g, "").trim();
function parseQuadrant(clean: string): {
    result?: ImportResult;
    error?: MermaidError;
} {
    const spec: ChartSpec = { type: "quadrant", series: [], points: [], quadrants: ["", "", "", ""] };
    for (const raw of clean.split("\n")) {
        const line = raw.trim();
        if (!line || /^quadrantchart/i.test(line))
            continue;
        let m: RegExpExecArray | null;
        if ((m = /^title\s+(.+)/i.exec(line)))
            spec.title = unq(m[1]);
        else if ((m = /^x-axis\s+(.+)/i.exec(line))) {
            const p = m[1].split("-->");
            spec.xAxis = [unq(p[0]), unq(p[1] ?? "")];
        }
        else if ((m = /^y-axis\s+(.+)/i.exec(line))) {
            const p = m[1].split("-->");
            spec.yAxis = [unq(p[0]), unq(p[1] ?? "")];
        }
        else if ((m = /^quadrant-([1-4])\s+(.+)/i.exec(line)))
            spec.quadrants![+m[1] - 1] = unq(m[2]);
        else if ((m = /^(.+?):\s*\[\s*([\d.]+)\s*,\s*([\d.]+)\s*\]/.exec(line)))
            spec.points!.push({ label: unq(m[1]), x: +m[2], y: +m[3] });
    }
    const s = SHAPE_SIZES.chart;
    return { result: { nodes: [{ id: "chart1", kind: "chart", x: 0, y: 0, w: Math.round(s.w * 1.5), h: Math.round(s.h * 1.6), text: "", chart: spec }], edges: [] } };
}
function parsePie(clean: string): {
    result?: ImportResult;
    error?: MermaidError;
} {
    const spec: ChartSpec = { type: "pie", categories: [], series: [{ values: [] }], showValues: true };
    for (const raw of clean.split("\n")) {
        const line = raw.trim();
        if (!line)
            continue;
        let m: RegExpExecArray | null;
        if ((m = /^pie(?:\s+showData)?(?:\s+title\s+(.+))?/i.exec(line)) && /^pie/i.test(line)) {
            if (m[1])
                spec.title = unq(m[1]);
            continue;
        }
        if ((m = /^"([^"]+)"\s*:\s*([\d.]+)/.exec(line)) || (m = /^([^:]+):\s*([\d.]+)/.exec(line))) {
            spec.categories!.push(unq(m[1]));
            spec.series[0].values.push(+m[2]);
        }
    }
    if (!spec.series[0].values.length)
        return { error: "unparsable" };
    const s = SHAPE_SIZES.chart;
    return { result: { nodes: [{ id: "chart1", kind: "chart", x: 0, y: 0, w: s.w, h: s.h, text: "", chart: spec }], edges: [] } };
}
function parseXychart(clean: string): {
    result?: ImportResult;
    error?: MermaidError;
} {
    const spec: ChartSpec = { type: "bar", categories: [], series: [], grid: true };
    let horizontal = false;
    const kinds: ("bar" | "line")[] = [];
    for (const raw of clean.split("\n")) {
        const line = raw.trim();
        if (!line)
            continue;
        let m: RegExpExecArray | null;
        if (/^xychart(-beta)?\b/i.test(line)) {
            if (/\bhorizontal\b/i.test(line))
                horizontal = true;
            continue;
        }
        if ((m = /^title\s+(.+)/i.exec(line))) {
            spec.title = unq(m[1]);
            continue;
        }
        if ((m = /^x-axis\s+(.+)/i.exec(line))) {
            const rest = m[1].trim(), arr = /^\[(.*)\]$/.exec(rest);
            if (arr)
                spec.categories = splitList(arr[1]).map(unq);
            else {
                const lm = /^("[^"]*"|'[^']*'|[^\s]+?)\s*[\d.]+\s*-->/.exec(rest);
                spec.xTitle = unq(lm ? lm[1] : rest.replace(/\s*[\d.]+\s*-->.*$/, ""));
            }
            continue;
        }
        if ((m = /^y-axis\s+(.+)/i.exec(line))) {
            const rest = m[1].trim(), lm = /^("[^"]*"|'[^']*')/.exec(rest);
            if (lm)
                spec.yTitle = unq(lm[1]);
            else {
                const t = rest.replace(/\s*-?[\d.]+\s*-->.*$/, "").trim();
                if (t)
                    spec.yTitle = unq(t);
            }
            const rng = /(-?[\d.]+)\s*-->\s*(-?[\d.]+)/.exec(rest);
            if (rng) {
                spec.yMin = +rng[1];
                spec.yMax = +rng[2];
            }
            continue;
        }
        if ((m = /^bar\s+\[(.*)\]/i.exec(line))) {
            spec.series.push({ values: splitList(m[1]).map(Number), kind: "bar" });
            kinds.push("bar");
            continue;
        }
        if ((m = /^line\s+\[(.*)\]/i.exec(line))) {
            spec.series.push({ values: splitList(m[1]).map(Number), kind: "line" });
            kinds.push("line");
            continue;
        }
    }
    if (!spec.series.length)
        return { error: "unparsable" };
    const allBar = kinds.every(k => k === "bar");
    spec.type = horizontal && allBar ? "barh" : (kinds.includes("line") ? "line" : "bar");
    if (!spec.categories?.length) {
        const n = Math.max(...spec.series.map(s => s.values.length));
        spec.categories = Array.from({ length: n }, (_, i) => String(i + 1));
    }
    if (spec.series.length > 1)
        spec.legend = true;
    const s = SHAPE_SIZES.chart;
    return { result: { nodes: [{ id: "chart1", kind: "chart", x: 0, y: 0, w: Math.round(s.w * 1.4), h: Math.round(s.h * 1.3), text: "", chart: spec }], edges: [] } };
}
function splitList(s: string): string[] {
    const out: string[] = [];
    let cur = "", q = false;
    for (const ch of s) {
        if (ch === "\"" || ch === "'") {
            q = !q;
            cur += ch;
            continue;
        }
        if (ch === "," && !q) {
            out.push(cur.trim());
            cur = "";
            continue;
        }
        cur += ch;
    }
    if (cur.trim())
        out.push(cur.trim());
    return out;
}
function stripComments(text: string): string {
    return text.split("\n").map(l => l.replace(/%%.*$/, "")).join("\n");
}
const SHAPE_WRAPS: Array<{
    open: string;
    close: string;
    kind: ShapeKind;
}> = [
    { open: "([", close: "])", kind: "round" },
    { open: "[[", close: "]]", kind: "rect" },
    { open: "[(", close: ")]", kind: "cylinder" },
    { open: "((", close: "))", kind: "ellipse" },
    { open: "{{", close: "}}", kind: "hexagon" },
    { open: "[/", close: "/]", kind: "parallelogram" },
    { open: "[\\", close: "\\]", kind: "parallelogram" },
    { open: ">", close: "]", kind: "note" },
    { open: "[", close: "]", kind: "rect" },
    { open: "(", close: ")", kind: "round" },
    { open: "{", close: "}", kind: "diamond" },
];
function parseFlowchart(clean: string): {
    result?: ImportResult;
    error?: MermaidError;
} {
    const lines = clean.split("\n");
    const header = lines.shift() ?? "";
    const dirMatch = /^(?:graph|flowchart)\s+(TB|TD|BT|LR|RL)?/i.exec(header);
    const dir = (dirMatch?.[1] ?? "TD").toUpperCase();
    const nodes = new Map<string, ImportNode>();
    const edges: ImportEdge[] = [];
    let eSeq = 0;
    const ensure = (id: string, kind?: ShapeKind, text?: string): ImportNode => {
        let n = nodes.get(id);
        if (!n) {
            const s = SHAPE_SIZES[kind ?? "rect"];
            n = { id, kind: kind ?? "rect", x: 0, y: 0, w: s.w, h: s.h, text: text ?? id };
            nodes.set(id, n);
        }
        else {
            if (kind) {
                n.kind = kind;
                const s = SHAPE_SIZES[kind];
                n.w = s.w;
                n.h = s.h;
            }
            if (text != null)
                n.text = text;
        }
        return n;
    };
    const statements = splitStatements(lines.join("\n"));
    for (const stmt of statements) {
        if (/^(subgraph|end|direction|classDef|class|style|linkStyle|click)\b/i.test(stmt))
            continue;
        parseChain(stmt, ensure, edges, () => `m${++eSeq}`);
    }
    if (!nodes.size)
        return { error: "unparsable" };
    layeredLayout([...nodes.values()], edges, dir);
    const [fromP, toP] = dir === "LR" ? ["e", "w"] : dir === "RL" ? ["w", "e"] : dir === "BT" ? ["n", "s"] : ["s", "n"];
    for (const e of edges) {
        e.fromPort = fromP;
        e.toPort = toP;
    }
    return { result: { nodes: [...nodes.values()], edges } };
}
function parseChain(s: string, ensure: (id: string, k?: ShapeKind, t?: string) => ImportNode, edges: ImportEdge[], nextId: () => string): void {
    let i = 0, prev: string | null = null;
    let pending: {
        label?: string;
    } | null = null;
    while (i < s.length) {
        while (i < s.length && /\s/.test(s[i]))
            i++;
        if (i >= s.length)
            break;
        const node = matchNode(s, i);
        if (node) {
            ensure(node.id, node.kind, node.text);
            if (prev !== null && pending)
                edges.push({ id: nextId(), fromId: prev, fromPort: "s", toId: node.id, toPort: "n", label: pending.label, style: "orthogonal" });
            prev = node.id;
            pending = null;
            i = node.end;
            continue;
        }
        const edge = matchEdge(s, i);
        if (edge) {
            pending = { label: edge.label };
            i = edge.end;
            continue;
        }
        i++;
    }
}
function matchNode(s: string, i: number): {
    id: string;
    kind?: ShapeKind;
    text?: string;
    end: number;
} | null {
    const idM = /^[A-Za-z0-9_À-￿]+/.exec(s.slice(i));
    if (!idM)
        return null;
    const id = idM[0];
    const j = i + id.length;
    for (const wrap of SHAPE_WRAPS) {
        if (s.startsWith(wrap.open, j)) {
            const contentStart = j + wrap.open.length;
            if (s[contentStart] === "\"") {
                const qEnd = s.indexOf("\"", contentStart + 1);
                if (qEnd >= 0 && s.startsWith(wrap.close, qEnd + 1)) {
                    return { id, kind: wrap.kind, text: decodeEntities(s.slice(contentStart + 1, qEnd)), end: qEnd + 1 + wrap.close.length };
                }
            }
            const close = s.indexOf(wrap.close, contentStart);
            if (close >= 0) {
                const text = s.slice(contentStart, close).trim().replace(/^["']|["']$/g, "");
                return { id, kind: wrap.kind, text: decodeEntities(text), end: close + wrap.close.length };
            }
        }
    }
    return { id, end: j };
}
function decodeEntities(t: string): string {
    return t.replace(/&quot;/g, "\"").replace(/&amp;/g, "&");
}
function splitStatements(src: string): string[] {
    const out: string[] = [];
    let cur = "", inQuote = false;
    for (const ch of src) {
        if (ch === "\"") {
            inQuote = !inQuote;
            cur += ch;
            continue;
        }
        if (!inQuote && (ch === "\n" || ch === ";")) {
            const t = cur.trim();
            if (t)
                out.push(t);
            cur = "";
            continue;
        }
        cur += ch;
    }
    const t = cur.trim();
    if (t)
        out.push(t);
    return out;
}
function matchEdge(s: string, i: number): {
    label?: string;
    end: number;
} | null {
    const rest = s.slice(i);
    const labelled = /^(-{2,3}|-\.-?|={2,3})\s*([^-=>|][^>|]*?)\s*(-{1,2}>|-{3}|-\.->|={1,2}>|={3})/.exec(rest);
    if (labelled && labelled[2])
        return { label: labelled[2].trim(), end: i + labelled[0].length };
    const m = /^(<?-{2,3}>?|-\.->?|={2,3}>?|--[ox]|[ox]--[ox]|x--x|o--o)/.exec(rest);
    if (m) {
        let end = i + m[0].length;
        let label: string | undefined;
        const lbl = /^\s*\|([^|]*)\|/.exec(s.slice(end));
        if (lbl) {
            label = lbl[1].trim();
            end += lbl[0].length;
        }
        return { label, end };
    }
    return null;
}
function parseSequence(clean: string): {
    result?: ImportResult;
    error?: MermaidError;
} {
    const lines = clean.split("\n");
    lines.shift();
    const cols = new Map<string, number>();
    const label = new Map<string, string>();
    const ensure = (id: string, text?: string) => { if (!cols.has(id))
        cols.set(id, cols.size); if (text)
        label.set(id, text); };
    const msgs: Array<{
        from: string;
        to: string;
        text: string;
    }> = [];
    const partRe = /^(?:participant|actor)\s+(\w+)(?:\s+as\s+(.+))?$/;
    const msgRe = /^(\w+)\s*(?:-{1,2}>>?|-{1,2}x|-\)|--?>)\s*(\w+)\s*:\s*(.+)$/;
    for (const raw of lines) {
        const line = raw.trim();
        if (!line)
            continue;
        let m = partRe.exec(line);
        if (m) {
            ensure(m[1], m[2]?.trim());
            continue;
        }
        m = msgRe.exec(line);
        if (m) {
            ensure(m[1]);
            ensure(m[2]);
            msgs.push({ from: m[1], to: m[2], text: m[3].trim() });
        }
    }
    if (!cols.size)
        return { error: "unparsable" };
    const COL = 190, TOP = 40, Y0 = 130, GAP = 56;
    const bottom = Y0 + Math.max(msgs.length - 1, 0) * GAP + 30;
    const colX = (name: string) => 140 + cols.get(name)! * COL;
    const nodes: ImportNode[] = [];
    const edges: ImportEdge[] = [];
    for (const [name, i] of cols) {
        const x = 140 + i * COL;
        nodes.push({ id: `act_${name}`, kind: "rect", x, y: TOP, w: 120, h: 44, text: label.get(name) ?? name });
        nodes.push({ id: `life_${name}`, kind: "rect", x, y: (TOP + 22 + bottom) / 2, w: 4, h: bottom - (TOP + 22), text: "", fill: "#eceff1", noPorts: true });
    }
    msgs.forEach((mg, i) => {
        const y = Y0 + i * GAP;
        const af = `mf${i}`, at = `mt${i}`;
        nodes.push({ id: af, kind: "text", x: colX(mg.from), y, w: 2, h: 2, text: "", noPorts: true });
        nodes.push({ id: at, kind: "text", x: colX(mg.to), y, w: 2, h: 2, text: "", noPorts: true });
        edges.push({ id: `m${i}`, fromId: af, fromPort: "@auto", toId: at, toPort: "@auto", label: mg.text, style: "straight" });
    });
    return { result: { nodes, edges } };
}
type GraphKind = "state" | "er" | "class";
function parseGraphLike(clean: string, type: GraphKind): {
    result?: ImportResult;
    error?: MermaidError;
} {
    const raw = clean.split("\n");
    raw.shift();
    const nodes = new Map<string, ImportNode>();
    const edges: ImportEdge[] = [];
    const baseKind: ShapeKind = type === "state" ? "round" : "rect";
    let eSeq = 0;
    const ensure = (id: string, text?: string, kind?: ShapeKind): ImportNode => {
        let n = nodes.get(id);
        if (!n) {
            const s = SHAPE_SIZES[kind ?? baseKind];
            n = { id, kind: kind ?? baseKind, x: 0, y: 0, w: s.w, h: s.h, text: text ?? id };
            nodes.set(id, n);
        }
        else {
            if (kind)
                n.kind = kind;
            if (text != null && (n.text === n.id || !n.text))
                n.text = text;
        }
        return n;
    };
    const marker = (id: string): string => {
        const key = id;
        const n = ensure(key, "\u25CF", "ellipse");
        n.w = 40;
        n.h = 40;
        return key;
    };
    const setBody = (id: string, title: string, members: string[]): void => {
        const n = ensure(id);
        const body = members.map(m => m.trim()).filter(Boolean);
        n.text = body.length ? `${title}\n${body.join("\n")}` : title;
        n.w = Math.max(n.w, 140);
        n.h = Math.max(70, 30 + (body.length + 1) * 16);
    };
    const stmts: string[] = [];
    for (let i = 0; i < raw.length; i++) {
        const line = raw[i].trim();
        if (!line)
            continue;
        if (line.includes("{") && !line.includes("}")) {
            const buf = [line];
            i++;
            while (i < raw.length && !raw[i].includes("}")) {
                buf.push(raw[i]);
                i++;
            }
            if (i < raw.length)
                buf.push(raw[i]);
            stmts.push(buf.join("\n"));
        }
        else
            stmts.push(line);
    }
    const relRe = /^(\[\*\]|"[^"]*"|\w+)\s*(?:"[^"]*"\s*)?([|}{o<>*.+\-]{2,})\s*(?:"[^"]*"\s*)?(\[\*\]|"[^"]*"|\w+)\s*(?::\s*(.+))?$/;
    const idOf = (tok: string): string => tok === "[*]" ? "[*]" : tok.replace(/^"|"$/g, "");
    for (const stmt of stmts) {
        const block = /^(?:class\s+)?(\w+)\s*\{([\s\S]*)\}\s*$/.exec(stmt);
        if (block) {
            setBody(block[1], block[1], block[2].split(/[\n;]+/));
            continue;
        }
        let m = /^state\s+"([^"]*)"\s+as\s+(\w+)/.exec(stmt);
        if (m) {
            ensure(m[2], m[1]);
            continue;
        }
        m = /^(?:state|class)\s+(\w+)\s*$/.exec(stmt);
        if (m) {
            ensure(m[1]);
            continue;
        }
        m = /^(\w+)\s*:\s*(.+)$/.exec(stmt);
        if (m && type === "class" && !relRe.test(stmt)) {
            const n = ensure(m[1]);
            n.text = n.text === n.id ? `${m[1]}\n${m[2].trim()}` : `${n.text}\n${m[2].trim()}`;
            n.h = Math.max(70, n.h + 16);
            continue;
        }
        const r = relRe.exec(stmt);
        if (r) {
            const a = idOf(r[1]), b = idOf(r[3]), label = r[4]?.trim();
            const from = a === "[*]" ? marker("__start") : (ensure(a), a);
            const to = b === "[*]" ? marker("__end") : (ensure(b), b);
            edges.push({ id: `m${++eSeq}`, fromId: from, fromPort: "s", toId: to, toPort: "n", label, style: "orthogonal" });
        }
    }
    if (!nodes.size)
        return { error: "unparsable" };
    layeredLayout([...nodes.values()], edges, "TD");
    for (const e of edges) {
        e.fromPort = "s";
        e.toPort = "n";
    }
    return { result: { nodes: [...nodes.values()], edges } };
}
export function layeredLayout(nodes: ImportNode[], edges: Array<{
    fromId: string;
    toId: string;
}>, dir: string): void {
    const id2 = new Map(nodes.map(n => [n.id, n]));
    const rawSucc = new Map<string, string[]>();
    for (const n of nodes)
        rawSucc.set(n.id, []);
    for (const e of edges) {
        if (!id2.has(e.fromId) || !id2.has(e.toId) || e.fromId === e.toId)
            continue;
        rawSucc.get(e.fromId)!.push(e.toId);
    }
    const color = new Map<string, number>();
    const back = new Set<string>();
    const dfs = (u: string) => {
        color.set(u, 1);
        for (const v of rawSucc.get(u) ?? []) {
            const c = color.get(v);
            if (c === 1)
                back.add(`${u}\u0000${v}`);
            else if (c === undefined)
                dfs(v);
        }
        color.set(u, 2);
    };
    for (const n of nodes)
        if (!color.has(n.id))
            dfs(n.id);
    const succ = new Map<string, string[]>(), indeg = new Map<string, number>();
    for (const n of nodes) {
        succ.set(n.id, []);
        indeg.set(n.id, 0);
    }
    for (const [u, vs] of rawSucc)
        for (const v of vs) {
            if (back.has(`${u}\u0000${v}`))
                continue;
            succ.get(u)!.push(v);
            indeg.set(v, (indeg.get(v) ?? 0) + 1);
        }
    const layer = new Map<string, number>();
    const deg = new Map(indeg);
    const queue = nodes.filter(n => (indeg.get(n.id) ?? 0) === 0).map(n => { layer.set(n.id, 0); return n.id; });
    while (queue.length) {
        const u = queue.shift()!;
        for (const v of succ.get(u) ?? []) {
            layer.set(v, Math.max(layer.get(v) ?? 0, (layer.get(u) ?? 0) + 1));
            deg.set(v, (deg.get(v) ?? 1) - 1);
            if ((deg.get(v) ?? 0) === 0)
                queue.push(v);
        }
    }
    for (const n of nodes)
        if (!layer.has(n.id))
            layer.set(n.id, 0);
    const byLayer = new Map<number, ImportNode[]>();
    for (const n of nodes) {
        const l = layer.get(n.id)!;
        (byLayer.get(l) ?? byLayer.set(l, []).get(l)!).push(n);
    }
    const horiz = dir === "LR" || dir === "RL";
    const layers = [...byLayer.keys()].sort((a, b) => a - b);
    for (const l of layers) {
        const row = byLayer.get(l)!;
        const cross = l * LAYER_GAP;
        let along = 0;
        const totalW = row.reduce((s, n) => s + (horiz ? n.h : n.w) + NODE_GAP, -NODE_GAP);
        along = -totalW / 2;
        for (const n of row) {
            const span = horiz ? n.h : n.w;
            const center = along + span / 2;
            if (horiz) {
                n.x = 200 + (dir === "RL" ? -cross : cross);
                n.y = 200 + center;
            }
            else {
                n.x = 300 + center;
                n.y = 160 + (dir === "BT" ? -cross : cross);
            }
            along += span + NODE_GAP;
        }
    }
}
