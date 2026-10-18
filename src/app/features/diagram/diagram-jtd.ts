import { SceneTransition, DEFAULT_TRANSITION_MS, DEFAULT_HOLD_MS, Cam } from "./diagram-anim";
import { ShapeKind, SHAPE_SIZES, TextRun, SHAPE_PARAM_KEYS } from "./diagram-shapes";
import { ChartSpec, ChartType, CHART_TYPES, sampleChart } from "./diagram-charts";
import { ImportNode, ImportEdge, ImportResult, layeredLayout, IMPORT_NODE_EXTRA, IMPORT_EDGE_EXTRA } from "./diagram-mermaid";
import { THEMES, DiagramTheme } from "./diagram-themes";
import type { DiagramTimeline, TimelineStep } from "./diagram-timeline";
import { safeUrl } from "./diagram-link";
import { boxOf, toAbs, PenData } from "./diagram-pen";
export type JtdError = "empty" | "unparsable" | "notjtd" | "invalid";
export const JTD_SHAPES: ShapeKind[] = [
    "rect",
    "round",
    "ellipse",
    "diamond",
    "parallelogram",
    "cylinder",
    "hexagon",
    "note",
    "text",
    "container",
    "triangle",
    "star",
    "cloud",
    "document",
    "card",
    "callout",
    "actor",
    "cross",
    "process",
    "line",
    "ink",
];
export const JTD_CHART_TYPES: ChartType[] = CHART_TYPES;
export interface JtdNode {
    id: string;
    text?: string;
    shape?: ShapeKind;
    icon?: string;
    x?: number;
    y?: number;
    w?: number;
    h?: number;
    fill?: string;
    stroke?: string;
    borderStyle?: string;
    borderWidth?: number;
    borderPattern?: string;
    corners?: string;
    bold?: boolean;
    italic?: boolean;
    textColor?: string;
    fontSize?: number;
    font?: string;
    align?: "left" | "center" | "right" | "justify";
    valign?: "top" | "middle" | "bottom";
    textRotation?: number;
    opacity?: number;
    rotation?: number;
    skin?: string;
    group?: string;
    slant?: number;
    depth?: number;
    radii?: number[];
    apex?: number;
    points?: number;
    inner?: number;
    tailX?: number;
    tailH?: number;
    fold?: number;
    wave?: number;
    runs?: TextRun[];
    path?: number[][];
    curve?: boolean;
    arrow?: "none" | "start" | "end" | "both";
    head?: "line" | "triangle" | "diamond" | "circle";
    width?: number;
    dash?: string;
    pressure?: number[];
    highlighter?: boolean;
    annotation?: boolean;
    link?: string;
}
const COLOR_TOKENS: Record<string, (t: DiagramTheme) => string | undefined> = {
    surface: t => t.nodeFill,
    stroke: t => t.nodeStroke,
    text: t => t.nodeText,
    edge: t => t.edgeColor,
    bg: t => t.bg,
    muted: t => t.grid,
    accent: t => t.accents?.[0] ?? t.nodeStroke,
};
const TEXT_TOKENS: Record<string, (t: DiagramTheme) => string | undefined> = { muted: t => mixHex(t.nodeText, t.bg, 0.55) };
function resolveColor(c: string | undefined, theme: DiagramTheme, role: "fill" | "text" = "fill"): string | undefined {
    if (typeof c !== "string")
        return c;
    const tok = (role === "text" ? TEXT_TOKENS[c] : undefined) ?? COLOR_TOKENS[c];
    return tok ? tok(theme) ?? c : c;
}
function mixHex(a: string, b: string, w: number): string {
    const re = /^#[0-9a-f]{6}$/i;
    if (!re.test(a) || !re.test(b))
        return a;
    const ch = (h: string, i: number) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16);
    return "#" + [0, 1, 2].map(i => Math.round(ch(a, i) * w + ch(b, i) * (1 - w)).toString(16).padStart(2, "0")).join("");
}
export type JtdPort = "top" | "bottom" | "left" | "right" | "auto" | "n" | "s" | "e" | "w";
export interface JtdEdge {
    from: string;
    to: string;
    label?: string;
    arrow?: "none" | "start" | "end" | "both";
    style?: "straight" | "orthogonal" | "rounded";
    color?: string;
    dash?: string;
    width?: number;
    head?: string;
    fromPort?: JtdPort;
    toPort?: JtdPort;
    id?: string;
}
export interface JtdChart extends Partial<ChartSpec> {
    type: ChartType;
    id?: string;
    x?: number;
    y?: number;
    w?: number;
    h?: number;
}
export const JTD_POSTERS: Record<"blog" | "square" | "story" | "wide", {
    w: number;
    h: number;
}> = {
    blog: { w: 1200, h: 1600 },
    square: { w: 1080, h: 1080 },
    story: { w: 1080, h: 1920 },
    wide: { w: 1200, h: 675 },
};
export type JtdPoster = keyof typeof JTD_POSTERS | {
    w: number;
    h: number;
    x?: number;
    y?: number;
};
function posterSize(p: unknown): {
    w: number;
    h: number;
    x: number;
    y: number;
} | null {
    if (typeof p === "string") {
        const s = JTD_POSTERS[p as keyof typeof JTD_POSTERS];
        return s ? { ...s, x: 0, y: 0 } : null;
    }
    if (p && typeof p === "object") {
        const { w, h, x, y } = p as {
            w?: unknown;
            h?: unknown;
            x?: unknown;
            y?: unknown;
        };
        if (typeof w === "number" && typeof h === "number" && w > 0 && h > 0)
            return { w, h, x: typeof x === "number" && isFinite(x) ? x : 0, y: typeof y === "number" && isFinite(y) ? y : 0 };
    }
    return null;
}
export interface JtdFrame {
    name?: string;
    notes?: string;
    hold?: number;
    transition?: JtdPage["transition"];
    camera?: {
        x: number;
        y: number;
        w: number;
        h: number;
    };
    layout?: JtdDoc["layout"];
    poster?: JtdPoster;
    timeline?: DiagramTimeline;
    nodes?: JtdNode[];
    edges?: JtdEdge[];
    charts?: JtdChart[];
}
export interface JtdPage {
    frames?: JtdFrame[];
    name?: string;
    transition?: "none" | "fade" | "morph" | {
        kind: "none" | "fade" | "morph";
        ms?: number;
    };
    layout?: JtdDoc["layout"];
    title?: string;
    poster?: JtdPoster;
    timeline?: DiagramTimeline;
    nodes?: JtdNode[];
    edges?: JtdEdge[];
    charts?: JtdChart[];
}
export interface JtdDoc {
    pages?: JtdPage[];
    frames?: JtdFrame[];
    jtd: number;
    layout?: "flow-down" | "flow-right" | "free" | "grid" | "radial";
    title?: string;
    theme?: string;
    skin?: string;
    background?: string;
    poster?: JtdPoster;
    timeline?: DiagramTimeline;
    nodes?: JtdNode[];
    edges?: JtdEdge[];
    charts?: JtdChart[];
}
const JTD_PORT_MAP: Record<string, string> = { top: "n", bottom: "s", left: "w", right: "e", auto: "@auto", n: "n", s: "s", e: "e", w: "w" };
function mapPort(p: string | undefined, fallback: string): string | null {
    if (p == null)
        return null;
    return JTD_PORT_MAP[String(p).toLowerCase()] ?? fallback;
}
function pickExtra(src: Record<string, unknown>, keys: readonly string[]): Record<string, unknown> | undefined {
    const out: Record<string, unknown> = {};
    for (const k of keys)
        if (src[k] != null)
            out[k] = src[k];
    return Object.keys(out).length ? out : undefined;
}
function validTimeline(t: unknown): DiagramTimeline | undefined {
    if (!t || typeof t !== "object" || !Array.isArray((t as {
        steps?: unknown;
    }).steps))
        return undefined;
    const raw = t as {
        mode?: unknown;
        steps: unknown[];
    };
    const strs = (v: unknown) => (Array.isArray(v) ? v.filter(x => x != null).map(String) : undefined);
    const steps: TimelineStep[] = raw.steps.filter(s => s && typeof s === "object").map((s0, k) => {
        const s = s0 as Record<string, unknown>;
        const flow = Array.isArray(s["flow"]) ? (s["flow"] as Record<string, unknown>[]).filter(f => f && f["edge"] != null).map(f => ({ edge: String(f["edge"]), reverse: f["reverse"] === true || undefined, label: f["label"] != null ? String(f["label"]) : undefined })) : undefined;
        const ms = typeof s["ms"] === "number" && isFinite(s["ms"] as number) ? s["ms"] as number : undefined;
        return { id: s["id"] != null ? String(s["id"]) : "p" + (k + 1), text: s["text"] != null ? String(s["text"]) : "", flow, focus: strs(s["focus"]), show: strs(s["show"]), ...(ms != null ? { ms } : {}) };
    });
    return steps.length ? { mode: raw.mode === "reveal" ? "reveal" : "highlight", steps } : undefined;
}
export function isJtd(text: string): boolean {
    const t = text.trim();
    if (!t.startsWith("{"))
        return false;
    try {
        const o = JSON.parse(t);
        return !!o && typeof o === "object" && "jtd" in o;
    }
    catch {
        return false;
    }
}
export function importJtd(text: string): {
    result?: ImportResult;
    error?: JtdError;
} {
    const t = text.trim();
    if (!t)
        return { error: "empty" };
    let doc: JtdDoc;
    try {
        doc = JSON.parse(t);
    }
    catch {
        return { error: "unparsable" };
    }
    if (!doc || typeof doc !== "object" || !("jtd" in doc))
        return { error: "notjtd" };
    if (Array.isArray(doc.pages) && doc.pages.length) {
        const { pages, ...rest } = doc;
        doc = { ...rest, ...pages[0], jtd: rest.jtd } as JtdDoc;
    }
    if (Array.isArray(doc.frames) && doc.frames.length) {
        const { frames, ...rest } = doc;
        doc = { ...rest, ...frames[0], jtd: rest.jtd } as JtdDoc;
    }
    const nodes: ImportNode[] = [], edges: ImportEdge[] = [];
    const shapeOk = new Set<string>(JTD_SHAPES);
    const explicit = new Set<string>();
    const theme = THEMES.find(t => t.id === doc.theme) ?? THEMES.find(t => t.id === "minimal")!;
    let seq = 0;
    for (const n of doc.nodes ?? []) {
        if (!n || n.id == null)
            continue;
        const id = String(n.id);
        const kind: ShapeKind = n.icon ? "icon" : (n.shape && shapeOk.has(n.shape) ? n.shape : "rect");
        const s = SHAPE_SIZES[kind] ?? SHAPE_SIZES.rect;
        if (n.x != null || n.y != null)
            explicit.add(id);
        let extra = pickExtra(n as unknown as Record<string, unknown>, IMPORT_NODE_EXTRA);
        if (n.annotation === true)
            extra = { ...(extra ?? {}), annot: true };
        if (extra && "link" in extra) {
            const u = safeUrl(String(extra["link"]));
            if (u)
                extra["link"] = u;
            else
                delete extra["link"];
        }
        if (extra && typeof extra["textColor"] === "string")
            extra["textColor"] = resolveColor(extra["textColor"] as string, theme, "text");
        const stroke = n.stroke ?? (kind === "icon" && typeof extra?.["textColor"] === "string" ? extra["textColor"] as string : undefined);
        const nodeText = n.text ?? (Array.isArray(n.runs) ? n.runs.map(r => r?.t ?? "").join("") : "");
        if (kind === "line" || kind === "ink") {
            const ox = n.x ?? 0, oy = n.y ?? 0;
            let abs = (Array.isArray(n.path) ? n.path : []).filter(p => Array.isArray(p) && isFinite(p[0]) && isFinite(p[1])).flatMap(p => [Number(p[0]), Number(p[1])]);
            if (abs.length < (kind === "line" ? 4 : 2))
                abs = [ox, oy + s.h / 2, ox + (n.w ?? s.w), oy + s.h / 2];
            const b = boxOf(abs, 4);
            const pen: PenData = { pts: b.pts };
            if (kind === "line") {
                if (n.curve)
                    pen.curve = true;
                if (n.arrow && ["none", "start", "end", "both"].includes(n.arrow))
                    pen.arrows = n.arrow;
                if (n.head && ["line", "triangle", "diamond", "circle"].includes(n.head))
                    pen.head = n.head;
            }
            else {
                if (Array.isArray(n.pressure) && n.pressure.length === abs.length / 2)
                    pen.pr = n.pressure.map(v => Math.max(0, Math.min(1, Number(v) || 0)));
                if (n.highlighter)
                    pen.hl = true;
            }
            const ex: Record<string, unknown> = { ...(extra ?? {}), pen };
            if (typeof n.width === "number" && n.width > 0)
                ex["borderWidth"] = n.width;
            if (typeof n.dash === "string")
                ex["borderStyle"] = n.dash;
            explicit.add(id);
            nodes.push({ id, kind, x: b.x - b.w / 2, y: b.y - b.h / 2, w: b.w, h: b.h, text: "", stroke: resolveColor(n.stroke, theme), extra: ex });
            continue;
        }
        nodes.push({ id, kind, x: n.x ?? 0, y: n.y ?? 0, w: n.w ?? s.w, h: n.h ?? s.h, text: nodeText, fill: resolveColor(n.fill, theme), stroke: resolveColor(stroke, theme), icon: n.icon, extra });
    }
    for (const c of doc.charts ?? []) {
        if (!c)
            continue;
        const type = JTD_CHART_TYPES.includes(c.type) ? c.type : "bar";
        const spec = { ...sampleChart(type), ...c, type } as ChartSpec & Record<string, unknown>;
        delete spec["id"];
        delete spec["x"];
        delete spec["y"];
        delete spec["w"];
        delete spec["h"];
        const id = c.id ? String(c.id) : `chart${++seq}`, cs = SHAPE_SIZES.chart;
        if (c.x != null || c.y != null)
            explicit.add(id);
        nodes.push({ id, kind: "chart", x: c.x ?? 0, y: c.y ?? 0, w: c.w ?? Math.round(cs.w * 1.4), h: c.h ?? Math.round(cs.h * 1.3), text: "", chart: spec as ChartSpec });
    }
    const nodeIds = new Set(nodes.filter(n => n.kind !== "line" && n.kind !== "ink").map(n => n.id));
    const pinnedPort = new Set<string>();
    for (const e of doc.edges ?? []) {
        if (!e || !nodeIds.has(String(e.from)) || !nodeIds.has(String(e.to)))
            continue;
        const id = `je${++seq}`;
        const fp = mapPort(e.fromPort, "s"), tp = mapPort(e.toPort, "n");
        if (fp || tp)
            pinnedPort.add(id);
        edges.push({ id, docId: e.id != null ? String(e.id) : undefined, fromId: String(e.from), fromPort: fp ?? "s", toId: String(e.to), toPort: tp ?? "n", label: e.label, style: e.style ?? "orthogonal", arrows: e.arrow ?? "end", extra: pickExtra(e as unknown as Record<string, unknown>, IMPORT_EDGE_EXTRA) });
    }
    if (!nodes.length)
        return { error: "invalid" };
    const layout = doc.layout ?? "flow-down";
    const lay = nodes.filter(n => n.kind !== "line" && n.kind !== "ink");
    if (layout === "grid")
        gridLayout(lay);
    else if (layout === "radial")
        radialLayout(lay);
    else if (layout !== "free" && explicit.size < nodes.length) {
        const dir = layout === "flow-right" ? "LR" : "TD";
        layeredLayout(lay, edges.map(e => ({ fromId: e.fromId, toId: e.toId })), dir);
        const [fromP, toP] = dir === "LR" ? ["e", "w"] : ["s", "n"];
        for (const e of edges) {
            if (pinnedPort.has(e.id))
                continue;
            e.fromPort = fromP;
            e.toPort = toP;
        }
    }
    const byId = new Map(nodes.map(n => [n.id, n]));
    const parentOf = (n: ImportNode): ImportNode | null => {
        const g = (n.extra as Record<string, unknown> | undefined)?.["group"];
        return typeof g === "string" && g !== n.id && byId.has(g) ? byId.get(g)! : null;
    };
    const placed = new Set<string>();
    const resolve = (n: ImportNode): void => {
        if (placed.has(n.id))
            return;
        placed.add(n.id);
        const p = parentOf(n);
        if (!p)
            return;
        resolve(p);
        n.x += p.x;
        n.y += p.y;
    };
    for (const n of nodes)
        resolve(n);
    const page = posterSize(doc.poster);
    if (typeof doc.title === "string" && doc.title.trim() && page) {
        const tid = `jtitle${++seq}`;
        nodes.push({ id: tid, kind: "text", x: page.x, y: page.y + 24, w: page.w, h: 44, text: doc.title.trim(), extra: { bold: true, fontSize: 22, align: "center" } });
        explicit.add(tid);
    }
    else if (typeof doc.title === "string" && doc.title.trim() && nodes.length) {
        let minX = Infinity, maxX = -Infinity, minY = Infinity;
        for (const n of nodes) {
            minX = Math.min(minX, n.x);
            maxX = Math.max(maxX, n.x + n.w);
            minY = Math.min(minY, n.y);
        }
        const tw = Math.max(240, maxX - minX), tid = `jtitle${++seq}`;
        nodes.push({ id: tid, kind: "text", x: minX, y: minY - 72, w: tw, h: 44, text: doc.title.trim(), extra: { bold: true, fontSize: 22, align: "center" } });
        explicit.add(tid);
    }
    for (const n of nodes)
        if (explicit.has(n.id)) {
            n.x += n.w / 2;
            n.y += n.h / 2;
        }
    const tl = validTimeline(doc.timeline);
    const meta = (doc.theme || doc.skin || doc.background || page || tl) ? { theme: doc.theme, skin: doc.skin, background: doc.background, ...(page ? { poster: { x: page.x + page.w / 2, y: page.y + page.h / 2, w: page.w, h: page.h } } : {}), ...(tl ? { timeline: tl } : {}) } : undefined;
    return { result: { nodes, edges, meta } };
}
function pageTransition(t: JtdPage["transition"]): SceneTransition | null {
    const kind = typeof t === "string" ? t : t && typeof t === "object" ? t.kind : undefined;
    if (kind !== "fade" && kind !== "morph")
        return null;
    const ms = typeof t === "object" && t && typeof t.ms === "number" && isFinite(t.ms) && t.ms > 0 ? t.ms : undefined;
    return { kind, ...(ms ? { ms } : {}) };
}
export interface ImportedFrame {
    name?: string;
    notes?: string;
    holdMs?: number;
    transition: SceneTransition | null;
    camera: Cam | null;
    result: ImportResult;
}
export interface ImportedPage {
    name?: string;
    transition: SceneTransition | null;
    frames?: ImportedFrame[];
    result: ImportResult;
}
export function importJtdPages(text: string): {
    pages?: ImportedPage[];
    error?: JtdError;
} {
    const t = text.trim();
    if (!t)
        return { error: "empty" };
    let doc: JtdDoc;
    try {
        doc = JSON.parse(t);
    }
    catch {
        return { error: "unparsable" };
    }
    if (!doc || typeof doc !== "object" || !("jtd" in doc))
        return { error: "notjtd" };
    const { pages, frames: docFrames, ...globals } = doc;
    const onePage = (p: JtdPage & Record<string, unknown>, k: number): {
        page?: ImportedPage;
        error?: JtdError;
    } => {
        const { frames, name, transition, ...content } = p;
        if (Array.isArray(frames) && frames.length) {
            const out: ImportedFrame[] = [];
            for (const [i, fr] of frames.entries()) {
                if (!fr || typeof fr !== "object")
                    continue;
                const { hold, transition: ft, camera, name: fn, notes: fnotes, ...fc } = fr;
                const r = importJtd(JSON.stringify({ ...globals, ...content, ...fc, jtd: globals.jtd }));
                if (!r.result)
                    return { error: r.error };
                out.push({ name: typeof fn === "string" && fn.trim() ? fn.trim() : undefined, ...(typeof fnotes === "string" && fnotes.trim() ? { notes: fnotes.slice(0, 20000) } : {}), holdMs: typeof hold === "number" && isFinite(hold) && hold > 0 ? hold : undefined, transition: i === 0 ? null : pageTransition(ft), camera: camRect(camera), result: r.result });
            }
            if (!out.length)
                return { error: "empty" };
            return { page: { name: typeof name === "string" && name.trim() ? name.trim() : undefined, transition: k === 0 ? null : pageTransition(transition), frames: out, result: out[0].result } };
        }
        const r = importJtd(JSON.stringify({ ...globals, ...content, jtd: globals.jtd }));
        if (!r.result)
            return { error: r.error };
        return { page: { name: typeof name === "string" && name.trim() ? name.trim() : undefined, transition: k === 0 ? null : pageTransition(transition), result: r.result } };
    };
    const list: (JtdPage & Record<string, unknown>)[] = Array.isArray(pages) && pages.length ? pages as never : [{ ...(docFrames ? { frames: docFrames } : {}) } as never];
    const out: ImportedPage[] = [];
    for (const [k, p] of list.entries()) {
        if (!p || typeof p !== "object")
            continue;
        const r = onePage(p, k);
        if (!r.page)
            return { error: r.error };
        out.push(r.page);
    }
    return out.length ? { pages: out } : { error: "empty" };
}
function camRect(c: unknown): Cam | null {
    if (!c || typeof c !== "object")
        return null;
    const { x, y, w, h } = c as Record<string, unknown>;
    if (![x, y, w, h].every(v => typeof v === "number" && isFinite(v as number)) || (w as number) <= 0 || (h as number) <= 0)
        return null;
    return { x: (x as number) + (w as number) / 2, y: (y as number) + (h as number) / 2, w: w as number, h: h as number };
}
function gridLayout(nodes: ImportNode[]): void {
    const cols = Math.max(1, Math.ceil(Math.sqrt(nodes.length)));
    const cw = Math.max(...nodes.map(n => n.w)) + 60, ch = Math.max(...nodes.map(n => n.h)) + 60;
    nodes.forEach((n, i) => { const r = Math.floor(i / cols), c = i % cols; n.x = 200 + c * cw; n.y = 160 + r * ch; });
}
function radialLayout(nodes: ImportNode[]): void {
    const cx = 400, cy = 320;
    if (nodes.length === 1) {
        nodes[0].x = cx;
        nodes[0].y = cy;
        return;
    }
    const rest = nodes.slice(1), R = Math.max(160, 40 * rest.length);
    nodes[0].x = cx;
    nodes[0].y = cy;
    rest.forEach((n, i) => { const a = -Math.PI / 2 + (i / rest.length) * Math.PI * 2; n.x = cx + R * Math.cos(a); n.y = cy + R * Math.sin(a); });
}
export interface JtdExportNode {
    pen?: PenData;
    annot?: boolean;
    link?: string;
    id: string;
    kind: string;
    text?: string;
    x: number;
    y: number;
    w: number;
    h: number;
    fill?: string;
    stroke?: string;
    icon?: string;
    chart?: ChartSpec;
    borderStyle?: string;
    borderWidth?: number;
    borderPattern?: string;
    corners?: string;
    bold?: boolean;
    italic?: boolean;
    textColor?: string;
    fontSize?: number;
    font?: string;
    align?: string;
    valign?: string;
    textRotation?: number;
    opacity?: number;
    rotation?: number;
    skin?: string;
    group?: string;
    runs?: TextRun[];
    titleSide?: string;
    titleH?: number;
    slant?: number;
    depth?: number;
    radii?: number[];
    apex?: number;
    points?: number;
    inner?: number;
    tailX?: number;
    tailH?: number;
    fold?: number;
    wave?: number;
}
export interface JtdExportEdge {
    id?: string;
    fromId: string;
    toId: string;
    label?: string;
    arrows?: "none" | "start" | "end" | "both";
    style?: "straight" | "orthogonal" | "rounded";
    color?: string;
    dash?: string;
    width?: number;
    head?: string;
    fromPort?: string;
    toPort?: string;
}
const NODE_STYLE_KEYS = ["fill", "stroke", "icon", "borderStyle", "borderWidth", "borderPattern", "corners", "bold", "italic", "textColor", "fontSize", "font", "align", "valign", "textRotation", "opacity", "rotation", "skin", "group", "runs", "titleSide", "titleH", ...SHAPE_PARAM_KEYS] as const;
const EDGE_STYLE_KEYS = ["color", "dash", "width", "head"] as const;
function copyDefined<S extends object, T extends object>(dst: T, src: S, keys: readonly string[]): void {
    for (const k of keys) {
        const v = (src as Record<string, unknown>)[k];
        if (v !== undefined)
            (dst as Record<string, unknown>)[k] = v;
    }
}
function portOut(p: string | undefined): JtdPort | undefined {
    if (!p || p === "@auto")
        return undefined;
    return (["n", "s", "e", "w"] as const).includes(p as "n") ? (p as JtdPort) : undefined;
}
export function exportJtd(nodes: JtdExportNode[], edges: JtdExportEdge[], meta?: {
    title?: string;
    theme?: string;
    background?: string;
    poster?: {
        x: number;
        y: number;
        w: number;
        h: number;
    };
    timeline?: DiagramTimeline;
    absolute?: boolean;
}): JtdDoc {
    const ox = meta?.poster && !meta.absolute ? meta.poster.x - meta.poster.w / 2 : 0, oy = meta?.poster && !meta.absolute ? meta.poster.y - meta.poster.h / 2 : 0;
    const jtdNodes: JtdNode[] = [];
    const charts: JtdChart[] = [];
    for (const n of nodes) {
        const x = n.x - n.w / 2 - ox, y = n.y - n.h / 2 - oy;
        if (n.kind === "chart" && n.chart) {
            charts.push({ ...n.chart, type: n.chart.type, id: n.id, x, y, w: n.w, h: n.h });
            continue;
        }
        if ((n.kind === "line" || n.kind === "ink") && n.pen) {
            const abs = toAbs(n.pen.pts, n.x - ox, n.y - oy), path: number[][] = [];
            for (let i = 0; i + 1 < abs.length; i += 2)
                path.push([Math.round(abs[i] * 10) / 10, Math.round(abs[i + 1] * 10) / 10]);
            const jn: JtdNode = { id: n.id, shape: n.kind, path };
            if (n.stroke)
                jn.stroke = n.stroke;
            if (n.borderWidth != null)
                jn.width = n.borderWidth;
            if (n.kind === "line") {
                if (n.pen.curve)
                    jn.curve = true;
                if (n.pen.arrows && n.pen.arrows !== "none")
                    jn.arrow = n.pen.arrows;
                if (n.pen.head && n.pen.head !== "line")
                    jn.head = n.pen.head;
                if (n.borderStyle && n.borderStyle !== "solid")
                    jn.dash = n.borderStyle;
            }
            else {
                if (n.pen.pr?.length)
                    jn.pressure = n.pen.pr;
                if (n.pen.hl)
                    jn.highlighter = true;
            }
            if (n.opacity != null && n.opacity !== 1)
                jn.opacity = n.opacity;
            if (n.annot)
                jn.annotation = true;
            jtdNodes.push(jn);
            continue;
        }
        const jn: JtdNode = { id: n.id, shape: n.kind as ShapeKind, x, y, w: n.w, h: n.h };
        if (n.text)
            jn.text = n.text;
        copyDefined(jn, n, NODE_STYLE_KEYS);
        if (n.annot)
            jn.annotation = true;
        const web = safeUrl(n.link);
        if (web && n.link === web)
            jn.link = web;
        jtdNodes.push(jn);
    }
    const tlEdges = new Set((meta?.timeline?.steps ?? []).flatMap(st => [...(st.flow ?? []).map(f => f.edge), ...(st.focus ?? []), ...(st.show ?? [])]));
    const jtdEdges: JtdEdge[] = edges.map(e => {
        const je: JtdEdge = { from: e.fromId, to: e.toId };
        if (e.id && tlEdges.has(e.id))
            je.id = e.id;
        if (e.label)
            je.label = e.label;
        if (e.arrows)
            je.arrow = e.arrows;
        if (e.style)
            je.style = e.style;
        copyDefined(je, e, EDGE_STYLE_KEYS);
        const fp = portOut(e.fromPort), tp = portOut(e.toPort);
        if (fp)
            je.fromPort = fp;
        if (tp)
            je.toPort = tp;
        return je;
    });
    const doc: JtdDoc = { jtd: 1, layout: "free" };
    if (meta?.title)
        doc.title = meta.title;
    if (meta?.theme)
        doc.theme = meta.theme;
    if (meta?.background)
        doc.background = meta.background;
    if (meta?.timeline?.steps.length)
        doc.timeline = meta.timeline;
    if (meta?.poster && meta.absolute) {
        const { x, y, w, h } = meta.poster;
        doc.poster = { x: x - w / 2, y: y - h / 2, w, h };
    }
    else if (meta?.poster) {
        const { w, h } = meta.poster;
        doc.poster = (Object.keys(JTD_POSTERS) as (keyof typeof JTD_POSTERS)[]).find(k => JTD_POSTERS[k].w === w && JTD_POSTERS[k].h === h) ?? { w, h };
    }
    if (jtdNodes.length)
        doc.nodes = jtdNodes;
    if (jtdEdges.length)
        doc.edges = jtdEdges;
    if (charts.length)
        doc.charts = charts;
    return doc;
}
export function exportJtdFrames(frames: {
    name?: string;
    notes?: string;
    holdMs?: number;
    transition?: SceneTransition | null;
    camera?: Cam | null;
    nodes: JtdExportNode[];
    edges: JtdExportEdge[];
    poster?: {
        x: number;
        y: number;
        w: number;
        h: number;
    };
    timeline?: DiagramTimeline;
}[]): JtdFrame[] {
    return frames.map((f, k) => {
        const { jtd: _v, theme: _t, background: _b, ...one } = exportJtd(f.nodes, f.edges, { poster: f.poster, timeline: f.timeline, absolute: true });
        const fr: JtdFrame = { ...(f.name ? { name: f.name } : {}), ...(f.notes ? { notes: f.notes } : {}), ...one };
        if (f.holdMs && f.holdMs !== DEFAULT_HOLD_MS)
            fr.hold = f.holdMs;
        if (k > 0 && f.transition && f.transition.kind !== "none")
            fr.transition = f.transition.ms && f.transition.ms !== DEFAULT_TRANSITION_MS ? { kind: f.transition.kind, ms: f.transition.ms } : f.transition.kind;
        if (f.camera)
            fr.camera = { x: Math.round(f.camera.x - f.camera.w / 2), y: Math.round(f.camera.y - f.camera.h / 2), w: Math.round(f.camera.w), h: Math.round(f.camera.h) };
        return fr;
    });
}
