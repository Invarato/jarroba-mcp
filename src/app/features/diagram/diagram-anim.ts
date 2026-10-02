export type TransitionKind = "none" | "fade" | "morph";
export interface SceneTransition {
    kind: TransitionKind;
    ms?: number;
}
export const DEFAULT_TRANSITION_MS = 1000;
export const TRANSITION_MS_CHOICES = [300, 500, 1000, 2000, 3000] as const;
export function refOf(pageId: string, o: {
    id: string;
    ref?: string;
}): string { return o.ref ?? `${pageId}:${o.id}`; }
export const easeInOut = (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp01 = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
function parseColor(c: string): [
    number,
    number,
    number,
    number
] | null {
    const s = c.trim();
    let m = /^#([0-9a-f]{3})$/i.exec(s);
    if (m) {
        const [r, g, b] = m[1].split("").map(h => parseInt(h + h, 16));
        return [r, g, b, 1];
    }
    m = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(s);
    if (m) {
        const n = parseInt(m[1], 16);
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255, m[2] ? parseInt(m[2], 16) / 255 : 1];
    }
    m = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i.exec(s);
    if (m)
        return [+m[1], +m[2], +m[3], m[4] != null ? +m[4] : 1];
    return null;
}
export function lerpColor(a: string, b: string, t: number): string {
    const x = parseColor(a), y = parseColor(b);
    if (!x || !y)
        return t < 0.5 ? a : b;
    const c = x.map((v, i) => lerp(v, y[i], t));
    return c[3] >= 0.999 ? `rgb(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])})` : `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${Math.round(c[3] * 1000) / 1000})`;
}
const isPlain = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const FIXED = new Set(["id", "ref", "fromId", "toId", "fromPort", "toPort", "kind"]);
const INTEGER = new Set(["points", "seq"]);
export function lerpValue(a: unknown, b: unknown, t: number, key = ""): unknown {
    if (a === b)
        return a;
    if (typeof a === "number" && typeof b === "number" && isFinite(a) && isFinite(b)) {
        if (key === "rotation") {
            let d = ((b - a) % 360 + 540) % 360 - 180;
            if (d === -180 && b > a)
                d = 180;
            return a + d * t;
        }
        const v = lerp(a, b, t);
        return INTEGER.has(key) ? Math.round(v) : v;
    }
    if (typeof a === "string" && typeof b === "string")
        return (parseColor(a) && parseColor(b)) ? lerpColor(a, b, t) : (t < 0.5 ? a : b);
    if (Array.isArray(a) && Array.isArray(b) && a.length === b.length)
        return a.map((v, i) => lerpValue(v, b[i], t, key));
    if (isPlain(a) && isPlain(b))
        return lerpObject(a, b, t);
    return t < 0.5 ? a : b;
}
export function lerpObject<T extends Record<string, unknown>>(a: T, b: T, t: number): T {
    const out: Record<string, unknown> = {};
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
        if (FIXED.has(k)) {
            out[k] = t < 0.5 ? (a[k] ?? b[k]) : (b[k] ?? a[k]);
            continue;
        }
        const va = a[k], vb = b[k];
        if (va === undefined) {
            if (vb !== undefined && t >= 0.5)
                out[k] = vb;
            continue;
        }
        if (vb === undefined) {
            if (t < 0.5)
                out[k] = va;
            continue;
        }
        out[k] = lerpValue(va, vb, t, k);
    }
    return out as T;
}
export interface AnimNode {
    id: string;
    ref?: string;
    kind?: string;
    opacity?: number;
}
export interface AnimEdge {
    id: string;
    ref?: string;
    fromId: string;
    toId: string;
    opacity?: number;
}
export interface AnimScene<N extends AnimNode, E extends AnimEdge> {
    pageId: string;
    nodes: readonly N[];
    edges: readonly E[];
}
export function blendScenes<N extends AnimNode, E extends AnimEdge>(A: AnimScene<N, E>, B: AnimScene<N, E>, t: number, kind: "fade" | "morph"): {
    nodes: N[];
    edges: E[];
} {
    t = clamp01(t);
    const aByRef = new Map(A.nodes.map(n => [refOf(A.pageId, n), n])), bByRef = new Map(B.nodes.map(n => [refOf(B.pageId, n), n]));
    const matched = new Set<string>();
    if (kind === "morph")
        for (const [r, na] of aByRef) {
            const nb = bByRef.get(r);
            if (nb && (na.kind ?? "") === (nb.kind ?? ""))
                matched.add(r);
        }
    const fadeOut = <T extends {
        opacity?: number;
    }>(o: T): T => ({ ...o, opacity: (o.opacity ?? 1) * (1 - t) });
    const fadeIn = <T extends {
        opacity?: number;
    }>(o: T): T => ({ ...o, opacity: (o.opacity ?? 1) * t });
    const aId = new Map<string, string>(), bId = new Map<string, string>();
    const nodes: N[] = [];
    for (const n of A.nodes) {
        const r = refOf(A.pageId, n);
        if (matched.has(r)) {
            const id = "m:" + r;
            aId.set(n.id, id);
            nodes.push({ ...lerpObject(n as unknown as Record<string, unknown>, bByRef.get(r) as unknown as Record<string, unknown>, t), id } as unknown as N);
        }
        else {
            const id = "a:" + r;
            aId.set(n.id, id);
            if (t < 1)
                nodes.push({ ...fadeOut(n), id });
        }
    }
    for (const n of B.nodes) {
        const r = refOf(B.pageId, n);
        if (matched.has(r)) {
            bId.set(n.id, "m:" + r);
            continue;
        }
        const id = "b:" + r;
        bId.set(n.id, id);
        if (t > 0)
            nodes.push({ ...fadeIn(n), id });
    }
    const edges: E[] = [];
    const bEdgeByRef = new Map(B.edges.map(e => [refOf(B.pageId, e), e]));
    const edgeMatched = new Set<string>();
    for (const e of A.edges) {
        const r = refOf(A.pageId, e), eb = kind === "morph" ? bEdgeByRef.get(r) : undefined;
        const fa = aId.get(e.fromId), ta = aId.get(e.toId);
        if (eb && fa?.startsWith("m:") && ta?.startsWith("m:") && bId.get(eb.fromId) === fa && bId.get(eb.toId) === ta) {
            edgeMatched.add(r);
            edges.push({ ...lerpObject(e as unknown as Record<string, unknown>, eb as unknown as Record<string, unknown>, t), id: "m:" + r, fromId: fa, toId: ta } as unknown as E);
        }
        else if (t < 1 && fa && ta)
            edges.push({ ...fadeOut(e), id: "a:" + r, fromId: fa, toId: ta });
    }
    for (const e of B.edges) {
        const r = refOf(B.pageId, e);
        if (edgeMatched.has(r))
            continue;
        const fb = bId.get(e.fromId), tb = bId.get(e.toId);
        if (t > 0 && fb && tb)
            edges.push({ ...fadeIn(e), id: "b:" + r, fromId: fb, toId: tb });
    }
    return { nodes, edges };
}
function vertexFractions(p: readonly number[]): number[] {
    const n = p.length / 2, acc = [0];
    for (let i = 1; i < n; i++)
        acc.push(acc[i - 1] + Math.hypot(p[i * 2] - p[i * 2 - 2], p[i * 2 + 1] - p[i * 2 - 1]));
    const L = acc[n - 1] || 1;
    return acc.map(v => v / L);
}
function pointAtFraction(p: readonly number[], fr: readonly number[], f: number): [
    number,
    number
] {
    const n = p.length / 2;
    if (n < 2)
        return [p[0] ?? 0, p[1] ?? 0];
    let i = 1;
    while (i < n - 1 && fr[i] < f)
        i++;
    const a = fr[i - 1], b = fr[i], t = b > a ? (f - a) / (b - a) : 0;
    return [lerp(p[i * 2 - 2], p[i * 2], t), lerp(p[i * 2 - 1], p[i * 2 + 1], t)];
}
export function lerpPolyline(a: readonly number[], b: readonly number[], t: number): number[] {
    if (a.length < 4)
        return [...b];
    if (b.length < 4)
        return [...a];
    const fa = vertexFractions(a), fb = vertexFractions(b);
    const fs = [...fa, ...fb].sort((x, y) => x - y).filter((v, i, arr) => i === 0 || v - arr[i - 1] > 1e-9);
    const out: number[] = [];
    for (const f of fs) {
        const [ax, ay] = pointAtFraction(a, fa, f), [bx, by] = pointAtFraction(b, fb, f);
        out.push(lerp(ax, bx, t), lerp(ay, by, t));
    }
    const clean: number[] = [];
    for (let i = 0; i < out.length; i += 2)
        if (!clean.length || Math.abs(clean[clean.length - 2] - out[i]) > 0.000001 || Math.abs(clean[clean.length - 1] - out[i + 1]) > 0.000001)
            clean.push(out[i], out[i + 1]);
    return clean;
}
export interface Cam {
    x: number;
    y: number;
    w: number;
    h: number;
}
export interface Box {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
}
export function withAspect(c: Cam, aspect: number): Cam {
    if (!(aspect > 0))
        return c;
    return c.w / c.h > aspect ? { ...c, h: c.w / aspect } : { ...c, w: c.h * aspect };
}
export function lerpCam(a: Cam, b: Cam, t: number): Cam {
    t = clamp01(t);
    const gw = a.w > 0 && b.w > 0 ? a.w * Math.pow(b.w / a.w, t) : lerp(a.w, b.w, t);
    const gh = a.h > 0 && b.h > 0 ? a.h * Math.pow(b.h / a.h, t) : lerp(a.h, b.h, t);
    return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), w: gw, h: gh };
}
export function fitCam(c: Cam, vw: number, vh: number): {
    scale: number;
    x: number;
    y: number;
} {
    const scale = Math.min(vw / Math.max(0.000001, c.w), vh / Math.max(0.000001, c.h));
    return { scale, x: vw / 2 - c.x * scale, y: vh / 2 - c.y * scale };
}
export function screenWindow(aspect: number, vw: number, vh: number): {
    x: number;
    y: number;
    w: number;
    h: number;
} {
    const w = Math.min(vw, vh * aspect), h = w / aspect;
    return { x: (vw - w) / 2, y: (vh - h) / 2, w, h };
}
export function resolveCameras(frames: ReadonlyArray<Cam | null>, content: ReadonlyArray<Box | null>, fallbackAspect: number, pad = 40): Cam[] {
    const first = frames.find((f): f is Cam => !!f && f.w > 0 && f.h > 0);
    const aspect = first ? first.w / first.h : fallbackAspect;
    return frames.map((f, i) => {
        if (f && f.w > 0 && f.h > 0)
            return withAspect(f, aspect);
        const b = content[i];
        const c: Cam = b ? { x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2, w: b.x1 - b.x0 + 2 * pad, h: b.y1 - b.y0 + 2 * pad } : { x: 0, y: 0, w: 800, h: 600 };
        return withAspect(c, aspect);
    });
}
export interface FrameTiming {
    holdMs?: number;
    transition?: SceneTransition | null;
}
export const DEFAULT_HOLD_MS = 2000;
export const holdOf = (f: FrameTiming): number => Math.max(100, f.holdMs ?? DEFAULT_HOLD_MS);
export const transOf = (fs: readonly FrameTiming[], k: number): number => (k > 0 && fs[k].transition && fs[k].transition!.kind !== "none" ? Math.max(100, fs[k].transition!.ms ?? DEFAULT_TRANSITION_MS) : 0);
export interface TimeSeg {
    kind: "trans" | "hold";
    frame: number;
    start: number;
    end: number;
}
export function timelineSegments(fs: readonly FrameTiming[]): {
    segs: TimeSeg[];
    total: number;
} {
    const segs: TimeSeg[] = [];
    let t = 0;
    fs.forEach((f, k) => {
        const tr = transOf(fs, k);
        if (tr) {
            segs.push({ kind: "trans", frame: k, start: t, end: t + tr });
            t += tr;
        }
        const h = holdOf(f);
        segs.push({ kind: "hold", frame: k, start: t, end: t + h });
        t += h;
    });
    return { segs, total: t };
}
export function frameAt(fs: readonly FrameTiming[], ms: number): {
    kind: "hold";
    frame: number;
} | {
    kind: "trans";
    from: number;
    to: number;
    t: number;
} {
    const { segs, total } = timelineSegments(fs);
    if (!segs.length)
        return { kind: "hold", frame: 0 };
    const x = Math.max(0, Math.min(total - 0.000001, ms));
    const s = segs.find(g => x >= g.start && x < g.end) ?? segs[segs.length - 1];
    return s.kind === "hold" ? { kind: "hold", frame: s.frame } : { kind: "trans", from: s.frame - 1, to: s.frame, t: (x - s.start) / Math.max(1, s.end - s.start) };
}
export function holdStart(fs: readonly FrameTiming[], k: number): number {
    return timelineSegments(fs).segs.find(g => g.kind === "hold" && g.frame === k)?.start ?? 0;
}
export function resizedMs(ms0: number, dxPx: number, pxPerSec: number): number {
    return Math.max(100, Math.round((ms0 + dxPx / pxPerSec * 1000) / 100) * 100);
}
export function dropIndex(centers: readonly number[], i: number, dxPx: number): number {
    const cx = centers[i] + dxPx;
    if (dxPx >= 0) {
        let to = i;
        centers.forEach((c, k) => { if (k > i && cx > c)
            to = k; });
        return to;
    }
    let to = i;
    for (let k = i - 1; k >= 0; k--)
        if (cx < centers[k])
            to = k;
    return to;
}
export type TrackEvent = "in" | "change" | "out";
export interface ObjectTrack {
    key: string;
    label: string;
    events: {
        frame: number;
        kind: TrackEvent;
    }[];
}
export function objectTracks<N extends {
    id: string;
}>(frames: ReadonlyArray<readonly N[]>, keyOf: (n: N) => string, labelOf: (n: N) => string): ObjectTrack[] {
    const byKey = frames.map(ns => new Map(ns.map(n => [keyOf(n), n])));
    const order: string[] = [];
    const seen = new Set<string>();
    for (const m of byKey)
        for (const k of m.keys())
            if (!seen.has(k)) {
                seen.add(k);
                order.push(k);
            }
    const sig = (n: N) => JSON.stringify(n);
    const out: ObjectTrack[] = [];
    for (const key of order) {
        const events: {
            frame: number;
            kind: TrackEvent;
        }[] = [];
        let label = "";
        for (let k = 0; k < byKey.length; k++) {
            const cur = byKey[k].get(key), prev = k > 0 ? byKey[k - 1].get(key) : undefined;
            if (cur && !label)
                label = labelOf(cur);
            if (k === 0)
                continue;
            if (cur && !prev)
                events.push({ frame: k, kind: "in" });
            else if (!cur && prev)
                events.push({ frame: k, kind: "out" });
            else if (cur && prev && sig({ ...cur, id: "" }) !== sig({ ...prev, id: "" }))
                events.push({ frame: k, kind: "change" });
        }
        if (events.length)
            out.push({ key, label, events });
    }
    return out;
}
export type PresentItem = {
    kind: "hold";
    scene: number;
    ms: number;
} | {
    kind: "step";
    scene: number;
    step: number;
    ms: number;
} | {
    kind: "trans";
    from: number;
    to: number;
    tkind: "fade" | "morph";
    ms: number;
};
export function presentItems(scenes: ReadonlyArray<FrameTiming & {
    steps: number;
}>): PresentItem[] {
    const out: PresentItem[] = [];
    scenes.forEach((s, k) => {
        const tr = transOf(scenes, k);
        if (tr)
            out.push({ kind: "trans", from: k - 1, to: k, tkind: s.transition?.kind === "morph" ? "morph" : "fade", ms: tr });
        const h = holdOf(s);
        if (s.steps > 0)
            for (let i = 0; i < s.steps; i++)
                out.push({ kind: "step", scene: k, step: i, ms: Math.max(100, h / s.steps) });
        else
            out.push({ kind: "hold", scene: k, ms: h });
    });
    return out;
}
export const sceneOfItem = (it: PresentItem): number => (it.kind === "trans" ? it.to : it.scene);
export interface LegacyObj {
    id: string;
    ref?: string;
}
export interface LegacyNode extends LegacyObj {
    x: number;
    y: number;
    w: number;
    h: number;
}
export interface LegacyScene {
    seq?: number;
    nodes: LegacyNode[];
    edges?: LegacyObj[];
    transition?: SceneTransition | null;
    timeline?: unknown;
    frames?: unknown[];
    activeFrame?: number;
}
export interface LegacyProject<S extends LegacyScene = LegacyScene> {
    index: {
        pages: {
            id: string;
            name?: string;
        }[];
        activeId: string;
    };
    scenes: Record<string, S>;
}
export function migrateLinkedPages<S extends LegacyScene>(p: LegacyProject<S>): LegacyProject<S> {
    const linked = (sc: S | undefined) => !!sc?.transition && sc.transition.kind !== "none";
    const order = p.index.pages.map(x => x.id);
    if (!order.some((id, k) => k > 0 && linked(p.scenes[id])))
        return p;
    const scenes: Record<string, S> = { ...p.scenes }, keep: string[] = [], merged = new Map<string, string>();
    const empty = () => ({ seq: 0, nodes: [], edges: [] }) as unknown as S;
    let head: string | null = null, chain: string[] = [];
    const flush = () => {
        if (!head)
            return;
        keep.push(head);
        if (chain.length < 2)
            return;
        const frames = chain.map((id, k) => {
            const sc = scenes[id] ?? empty(), pg = sc.nodes.find(n => n.id === "poster");
            const stamp = <T extends LegacyObj>(o: T): T => ({ ...o, ref: refOf(id, o) });
            return { id: "f" + (k + 1), name: p.index.pages.find(x => x.id === id)?.name, holdMs: DEFAULT_HOLD_MS, transition: k === 0 ? null : (sc.transition ?? null), camera: pg ? { x: pg.x, y: pg.y, w: pg.w, h: pg.h } : null, nodes: structuredClone(sc.nodes.filter(n => n.id !== "poster").map(stamp)), edges: structuredClone((sc.edges ?? []).map(stamp)), timeline: sc.timeline ? structuredClone(sc.timeline) : undefined };
        });
        const { transition: _t, ...base } = scenes[head] ?? empty();
        scenes[head] = { ...base, seq: Math.max(...chain.map(id => scenes[id]?.seq ?? 0)), nodes: structuredClone(frames[0].nodes), edges: structuredClone(frames[0].edges), timeline: frames[0].timeline, frames, activeFrame: 0 } as unknown as S;
        for (const id of chain.slice(1)) {
            merged.set(id, head);
            delete scenes[id];
        }
    };
    for (const id of order) {
        if (head && linked(scenes[id])) {
            chain.push(id);
            continue;
        }
        flush();
        head = id;
        chain = [id];
    }
    flush();
    for (const id of keep)
        if (scenes[id]?.transition !== undefined) {
            const { transition: _t, ...rest } = scenes[id];
            scenes[id] = rest as S;
        }
    const activeId = merged.get(p.index.activeId) ?? p.index.activeId;
    return { index: { ...p.index, pages: p.index.pages.filter(x => keep.includes(x.id)), activeId }, scenes };
}
