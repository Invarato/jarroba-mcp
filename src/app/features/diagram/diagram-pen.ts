export type PenArrows = "none" | "start" | "end" | "both";
export type PenHead = "line" | "triangle" | "diamond" | "circle";
export interface PenData {
    pts: number[];
    pr?: number[];
    curve?: boolean;
    arrows?: PenArrows;
    head?: PenHead;
    hl?: boolean;
    reveal?: number;
    glue?: {
        a?: Glue;
        b?: Glue;
    };
}
export function boxOf(abs: readonly number[], min = 8): {
    x: number;
    y: number;
    w: number;
    h: number;
    pts: number[];
} {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let i = 0; i + 1 < abs.length; i += 2) {
        x0 = Math.min(x0, abs[i]);
        x1 = Math.max(x1, abs[i]);
        y0 = Math.min(y0, abs[i + 1]);
        y1 = Math.max(y1, abs[i + 1]);
    }
    if (!isFinite(x0))
        return { x: 0, y: 0, w: min, h: min, pts: [] };
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    return { x: cx, y: cy, w: Math.max(min, x1 - x0), h: Math.max(min, y1 - y0), pts: abs.map((v, i) => r2(v - (i % 2 ? cy : cx))) };
}
const r2 = (v: number) => Math.round(v * 100) / 100;
export function toAbs(pts: readonly number[], cx: number, cy: number): number[] { return pts.map((v, i) => v + (i % 2 ? cy : cx)); }
export function scalePen(p: PenData, w0: number, h0: number, w: number, h: number): PenData {
    const sx = w0 > 0.5 ? w / w0 : 1, sy = h0 > 0.5 ? h / h0 : 1;
    return { ...p, pts: p.pts.map((v, i) => r2(v * (i % 2 ? sy : sx))) };
}
export function simplify(pts: readonly number[], eps: number): number[] {
    const n = pts.length / 2;
    if (n <= 2)
        return Array.from({ length: n }, (_, i) => i);
    const keep = new Uint8Array(n);
    keep[0] = keep[n - 1] = 1;
    const stack: [
        number,
        number
    ][] = [[0, n - 1]];
    while (stack.length) {
        const [a, b] = stack.pop()!;
        let best = -1, bd = eps;
        for (let i = a + 1; i < b; i++) {
            const d = segDist(pts[2 * i], pts[2 * i + 1], pts[2 * a], pts[2 * a + 1], pts[2 * b], pts[2 * b + 1]);
            if (d > bd) {
                bd = d;
                best = i;
            }
        }
        if (best >= 0) {
            keep[best] = 1;
            stack.push([a, best], [best, b]);
        }
    }
    const out: number[] = [];
    for (let i = 0; i < n; i++)
        if (keep[i])
            out.push(i);
    return out;
}
export function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
    const t = l2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2)) : 0;
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
export function polyDist(px: number, py: number, pts: readonly number[]): number {
    if (pts.length < 4)
        return pts.length >= 2 ? Math.hypot(px - pts[0], py - pts[1]) : Infinity;
    let d = Infinity;
    for (let i = 0; i + 3 < pts.length; i += 2)
        d = Math.min(d, segDist(px, py, pts[i], pts[i + 1], pts[i + 2], pts[i + 3]));
    return d;
}
export function polyPath(pts: readonly number[], curve = false): string {
    const n = pts.length / 2;
    if (n < 2)
        return "";
    const f = (v: number) => (Math.round(v * 100) / 100).toString();
    let d = `M ${f(pts[0])} ${f(pts[1])}`;
    if (!curve || n === 2) {
        for (let i = 1; i < n; i++)
            d += ` L ${f(pts[2 * i])} ${f(pts[2 * i + 1])}`;
        return d;
    }
    const P = (i: number) => [pts[2 * Math.max(0, Math.min(n - 1, i))], pts[2 * Math.max(0, Math.min(n - 1, i)) + 1]];
    for (let i = 0; i < n - 1; i++) {
        const [x0, y0] = P(i - 1), [x1, y1] = P(i), [x2, y2] = P(i + 1), [x3, y3] = P(i + 2);
        d += ` C ${f(x1 + (x2 - x0) / 6)} ${f(y1 + (y2 - y0) / 6)} ${f(x2 - (x3 - x1) / 6)} ${f(y2 - (y3 - y1) / 6)} ${f(x2)} ${f(y2)}`;
    }
    return d;
}
export function sampleLine(pts: readonly number[], curve = false, per = 12): number[] {
    const n = pts.length / 2;
    if (!curve || n <= 2)
        return [...pts];
    const P = (i: number) => [pts[2 * Math.max(0, Math.min(n - 1, i))], pts[2 * Math.max(0, Math.min(n - 1, i)) + 1]];
    const out: number[] = [pts[0], pts[1]];
    for (let i = 0; i < n - 1; i++) {
        const [x0, y0] = P(i - 1), [x1, y1] = P(i), [x2, y2] = P(i + 1), [x3, y3] = P(i + 2);
        const c1x = x1 + (x2 - x0) / 6, c1y = y1 + (y2 - y0) / 6, c2x = x2 - (x3 - x1) / 6, c2y = y2 - (y3 - y1) / 6;
        for (let k = 1; k <= per; k++) {
            const t = k / per, u = 1 - t;
            out.push(u * u * u * x1 + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t * t * t * x2, u * u * u * y1 + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t * t * t * y2);
        }
    }
    return out;
}
export function polyLength(pts: readonly number[]): number { let L = 0; for (let i = 0; i + 3 < pts.length; i += 2)
    L += Math.hypot(pts[i + 2] - pts[i], pts[i + 3] - pts[i + 1]); return L; }
export function truncate(pts: readonly number[], t: number): number[] {
    if (t >= 1 || pts.length < 4)
        return [...pts];
    const goal = polyLength(pts) * Math.max(0, t), out = [pts[0], pts[1]];
    let acc = 0;
    for (let i = 0; i + 3 < pts.length; i += 2) {
        const l = Math.hypot(pts[i + 2] - pts[i], pts[i + 3] - pts[i + 1]);
        if (acc + l >= goal) {
            const k = l ? (goal - acc) / l : 0;
            out.push(pts[i] + (pts[i + 2] - pts[i]) * k, pts[i + 1] + (pts[i + 3] - pts[i + 1]) * k);
            return out;
        }
        acc += l;
        out.push(pts[i + 2], pts[i + 3]);
    }
    return out;
}
export interface RawPt {
    x: number;
    y: number;
    p: number;
    t: number;
}
export function inkFromRaw(raw: readonly RawPt[], eps = 0.6): {
    abs: number[];
    pr: number[];
} {
    if (!raw.length)
        return { abs: [], pr: [] };
    const flat = raw.flatMap(r => [r.x, r.y]);
    const realPressure = raw.some(r => r.p > 0 && Math.abs(r.p - 0.5) > 0.01);
    let pr: number[];
    if (realPressure)
        pr = raw.map(r => clamp01(r.p));
    else {
        const sp = raw.map((r, i) => { const q = raw[Math.max(0, i - 1)]; const dt = Math.max(1, r.t - q.t); return Math.hypot(r.x - q.x, r.y - q.y) / dt; });
        pr = sp.map((_, i) => { let s = 0, c = 0; for (let k = Math.max(0, i - 3); k <= Math.min(sp.length - 1, i + 3); k++) {
            s += sp[k];
            c++;
        } return clamp01(1 - Math.min(1, (s / c) / 2.2) * 0.65); });
    }
    const keep = simplify(flat, eps);
    return { abs: keep.flatMap(i => [flat[2 * i], flat[2 * i + 1]]), pr: keep.map(i => r2(pr[i])) };
}
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
export function inkOutline(pts: readonly number[], pr: readonly number[] | undefined, width: number, taper = true): number[] {
    const s = smoothPolyline(pts, 2), n = s.length / 2;
    if (n === 0)
        return [];
    const prAt = (i: number) => { if (!pr || pr.length < 2)
        return 0.6; const f = i / Math.max(1, n - 1) * (pr.length - 1), a = Math.floor(f), b = Math.min(pr.length - 1, a + 1); return pr[a] + (pr[b] - pr[a]) * (f - a); };
    const len = polyLength(s);
    let acc = 0;
    const radius = (i: number, along: number) => {
        let r = width / 2 * (0.35 + 0.65 * prAt(i));
        if (taper && len > 0) {
            const e = Math.min(along, len - along), tl = Math.min(len / 3, width * 2.5);
            if (tl > 0 && e < tl)
                r *= 0.35 + 0.65 * (e / tl);
        }
        return Math.max(0.3, r);
    };
    if (n === 1) {
        const r = radius(0, 0);
        return circlePts(s[0], s[1], r, 10);
    }
    const L: number[] = [], R: number[] = [];
    for (let i = 0; i < n; i++) {
        if (i > 0)
            acc += Math.hypot(s[2 * i] - s[2 * i - 2], s[2 * i + 1] - s[2 * i - 1]);
        const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1);
        let tx = s[2 * b] - s[2 * a], ty = s[2 * b + 1] - s[2 * a + 1];
        const tl = Math.hypot(tx, ty) || 1;
        tx /= tl;
        ty /= tl;
        const r = radius(i, acc);
        L.push(s[2 * i] - ty * r, s[2 * i + 1] + tx * r);
        R.push(s[2 * i] + ty * r, s[2 * i + 1] - tx * r);
    }
    const out = [...L];
    out.push(...cap(s[2 * n - 2], s[2 * n - 1], L[2 * n - 2], L[2 * n - 1], R[2 * n - 2], R[2 * n - 1]));
    for (let i = n - 1; i >= 0; i--)
        out.push(R[2 * i], R[2 * i + 1]);
    out.push(...cap(s[0], s[1], R[0], R[1], L[0], L[1]));
    return out.map(r2);
}
function cap(cx: number, cy: number, ax: number, ay: number, bx: number, by: number): number[] {
    const a0 = Math.atan2(ay - cy, ax - cx), r = Math.hypot(ax - cx, ay - cy), out: number[] = [];
    let a1 = Math.atan2(by - cy, bx - cx);
    while (a1 > a0)
        a1 -= 2 * Math.PI;
    for (let k = 1; k < 6; k++) {
        const a = a0 + (a1 - a0) * k / 6;
        out.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    return out;
}
function circlePts(cx: number, cy: number, r: number, k: number): number[] { const out: number[] = []; for (let i = 0; i < k; i++) {
    const a = i / k * 2 * Math.PI;
    out.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
} return out; }
export function smoothPolyline(pts: readonly number[], iterations = 2): number[] {
    let p = [...pts];
    for (let it = 0; it < iterations && p.length >= 6; it++) {
        const q = [p[0], p[1]];
        for (let i = 0; i + 3 < p.length; i += 2)
            q.push(0.75 * p[i] + 0.25 * p[i + 2], 0.75 * p[i + 1] + 0.25 * p[i + 3], 0.25 * p[i] + 0.75 * p[i + 2], 0.25 * p[i + 1] + 0.75 * p[i + 3]);
        q.push(p[p.length - 2], p[p.length - 1]);
        p = q;
    }
    return p;
}
export function arrowHead(bx: number, by: number, ex: number, ey: number, head: PenHead, width: number, size?: number): {
    kind: "open" | "fill" | "circle";
    pts: number[];
    r?: number;
} {
    const a = Math.atan2(ey - by, ex - bx), sz = size ?? 7 + width * 1.5;
    const at = (d: number, perp: number) => [ex + d * Math.cos(a) - perp * Math.sin(a), ey + d * Math.sin(a) + perp * Math.cos(a)];
    if (head === "circle")
        return { kind: "circle", pts: [ex, ey], r: sz * 0.45 };
    if (head === "triangle")
        return { kind: "fill", pts: [ex, ey, ...at(-sz, sz * 0.55), ...at(-sz, -sz * 0.55)] };
    if (head === "diamond")
        return { kind: "fill", pts: [ex, ey, ...at(-sz * 0.6, sz * 0.5), ...at(-sz * 1.2, 0), ...at(-sz * 0.6, -sz * 0.5)] };
    return { kind: "open", pts: [ex - sz * Math.cos(a - 0.5), ey - sz * Math.sin(a - 0.5), ex, ey, ex - sz * Math.cos(a + 0.5), ey - sz * Math.sin(a + 0.5)] };
}
export function lineHeads(pts: readonly number[], p: PenData, width: number): ReturnType<typeof arrowHead>[] {
    const arr = p.arrows ?? "none";
    if (arr === "none" || pts.length < 4)
        return [];
    const s = sampleLine(pts, !!p.curve), n = s.length, head = p.head ?? "line", out: ReturnType<typeof arrowHead>[] = [];
    if (arr === "end" || arr === "both")
        out.push(arrowHead(s[n - 4], s[n - 3], s[n - 2], s[n - 1], head, width));
    if (arr === "start" || arr === "both")
        out.push(arrowHead(s[2], s[3], s[0], s[1], head, width));
    return out;
}
export type Recognized = {
    kind: "line";
    abs: number[];
} | {
    kind: "ellipse" | "rect" | "triangle" | "diamond";
    x: number;
    y: number;
    w: number;
    h: number;
};
export function recognize(abs: readonly number[]): Recognized | null {
    const n = abs.length / 2;
    if (n < 2)
        return null;
    const L = polyLength(abs), bx = boxOf(abs, 0), diag = Math.hypot(bx.w, bx.h);
    if (L < 8)
        return null;
    const gap = Math.hypot(abs[0] - abs[2 * n - 2], abs[1] - abs[2 * n - 1]);
    const closed = n >= 6 && gap < Math.max(18, L * 0.18) && L > diag * 1.8;
    if (!closed)
        return { kind: "line", abs: [abs[0], abs[1], abs[2 * n - 2], abs[2 * n - 1]] };
    if (bx.w < 12 || bx.h < 12)
        return null;
    const ring = [...abs, abs[0], abs[1]], keep = simplify(ring, diag * 0.09), corners = keep.length - 1;
    const box = { x: bx.x, y: bx.y, w: bx.w, h: bx.h };
    const rad = [];
    for (let i = 0; i < n; i++)
        rad.push(Math.hypot((abs[2 * i] - bx.x) / (bx.w / 2), (abs[2 * i + 1] - bx.y) / (bx.h / 2)));
    const mean = rad.reduce((a, b) => a + b, 0) / n, dev = Math.sqrt(rad.reduce((a, b) => a + (b - mean) ** 2, 0) / n) / mean;
    if (corners === 3)
        return { kind: "triangle", ...box };
    if (corners === 4) {
        const kp = keep.slice(0, 4).map(i => [ring[2 * i], ring[2 * i + 1]]);
        const near = (cx: number, cy: number) => Math.min(...kp.map(([x, y]) => Math.hypot(x - cx, y - cy)));
        const hw = bx.w / 2, hh = bx.h / 2;
        const dRect = [[-1, -1], [1, -1], [1, 1], [-1, 1]].reduce((a, [sx, sy]) => a + near(bx.x + sx * hw, bx.y + sy * hh), 0);
        const dDia = [[0, -1], [1, 0], [0, 1], [-1, 0]].reduce((a, [sx, sy]) => a + near(bx.x + sx * hw, bx.y + sy * hh), 0);
        if (dev < 0.07)
            return { kind: "ellipse", ...box };
        return { kind: dDia < dRect ? "diamond" : "rect", ...box };
    }
    if (corners >= 5 && dev < 0.2)
        return { kind: "ellipse", ...box };
    if (corners <= 2 && dev < 0.25)
        return { kind: "ellipse", ...box };
    return null;
}
export function snap45(x0: number, y0: number, x: number, y: number): [
    number,
    number
] {
    const a = Math.atan2(y - y0, x - x0), r = Math.hypot(x - x0, y - y0), s = Math.round(a / (Math.PI / 4)) * (Math.PI / 4);
    return [r2(x0 + Math.cos(s) * r), r2(y0 + Math.sin(s) * r)];
}
export function densify(pts: readonly number[], step: number, pr?: readonly number[]): {
    pts: number[];
    pr?: number[];
} {
    const n = pts.length / 2;
    if (n < 2 || step <= 0)
        return { pts: [...pts], pr: pr ? [...pr] : undefined };
    const out = [pts[0], pts[1]], po: number[] | undefined = pr ? [pr[0]] : undefined;
    for (let i = 0; i < n - 1; i++) {
        const x0 = pts[2 * i], y0 = pts[2 * i + 1], x1 = pts[2 * i + 2], y1 = pts[2 * i + 3], k = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / step));
        for (let j = 1; j <= k; j++) {
            const t = j / k;
            out.push(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t);
            if (po && pr)
                po.push(pr[i] + (pr[i + 1] - pr[i]) * t);
        }
    }
    return { pts: out, pr: po };
}
export interface Piece {
    pts: number[];
    pr?: number[];
    keepsStart: boolean;
    keepsEnd: boolean;
}
export function erasePart(abs: readonly number[], pr: readonly number[] | undefined, cx: number, cy: number, r: number, w: number, minLen = 2): Piece[] | null {
    const reach = r + w / 2;
    if (polyDist(cx, cy, abs) > reach)
        return null;
    const d = densify(abs, Math.max(0.5, r / 3), pr), n = d.pts.length / 2;
    const pieces: Piece[] = [];
    let cur: number[] = [], cpr: number[] = [], start = -1;
    const flush = (end: number) => {
        if (cur.length >= 2 && (cur.length >= 4 ? polyLength(cur) >= minLen : true)) {
            const keep = simplify(cur, 0.3);
            pieces.push({ pts: keep.flatMap(i => [cur[2 * i], cur[2 * i + 1]]), pr: d.pr ? keep.map(i => cpr[i]) : undefined, keepsStart: start === 0, keepsEnd: end === n - 1 });
        }
        cur = [];
        cpr = [];
        start = -1;
    };
    for (let i = 0; i < n; i++) {
        const x = d.pts[2 * i], y = d.pts[2 * i + 1];
        if (Math.hypot(x - cx, y - cy) <= reach) {
            if (cur.length)
                flush(i - 1);
            continue;
        }
        if (!cur.length)
            start = i;
        cur.push(x, y);
        if (d.pr)
            cpr.push(d.pr[i]);
    }
    if (cur.length)
        flush(n - 1);
    return pieces;
}
export function insidePoly(x: number, y: number, poly: readonly number[]): boolean {
    let inside = false;
    const n = poly.length / 2;
    for (let i = 0, j = n - 1; i < n; j = i++) {
        const xi = poly[2 * i], yi = poly[2 * i + 1], xj = poly[2 * j], yj = poly[2 * j + 1];
        if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi)
            inside = !inside;
    }
    return inside;
}
export interface Glue {
    id: string;
    fx: number;
    fy: number;
}
export function glueOf(id: string, x: number, y: number, box: {
    x: number;
    y: number;
    w: number;
    h: number;
}): Glue {
    return { id, fx: Math.round((x - box.x) / (box.w || 1) * 1000) / 1000, fy: Math.round((y - box.y) / (box.h || 1) * 1000) / 1000 };
}
export function gluePoint(g: Glue, box: {
    x: number;
    y: number;
    w: number;
    h: number;
}): [
    number,
    number
] { return [box.x + g.fx * box.w, box.y + g.fy * box.h]; }
