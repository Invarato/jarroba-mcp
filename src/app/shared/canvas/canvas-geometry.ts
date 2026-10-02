export interface Pt {
    x: number;
    y: number;
}
export function snapToGrid(v: number, grid: number): number {
    return Math.round(v / grid) * grid;
}
export interface Rect {
    x: number;
    y: number;
    w: number;
    h: number;
}
export const ROUTE_CLEARANCE = 10;
export function routeOrtho(start: Pt, end: Pt, obstacles: Rect[], grid: number, startDir?: Pt, endDir?: Pt): number[] {
    const G = Math.max(8, grid);
    const segHitsRect = (x0: number, y0: number, x1: number, y1: number, o: Rect): boolean => {
        const m = 1, rx0 = o.x + m, ry0 = o.y + m, rx1 = o.x + o.w - m, ry1 = o.y + o.h - m;
        if (Math.max(x0, x1) <= rx0 || Math.min(x0, x1) >= rx1 || Math.max(y0, y1) <= ry0 || Math.min(y0, y1) >= ry1)
            return false;
        return true;
    };
    const pathClear = (pts: Pt[], obs: Rect[]): boolean => {
        for (let i = 0; i + 1 < pts.length; i++)
            for (const o of obs)
                if (segHitsRect(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y, o))
                    return false;
        return true;
    };
    const dirsOk = (pts: Pt[]): boolean => {
        if (startDir) {
            const d = { x: pts[1].x - pts[0].x, y: pts[1].y - pts[0].y };
            if (d.x * startDir.x + d.y * startDir.y <= 0.01)
                return false;
        }
        if (endDir) {
            const n = pts.length, d = { x: pts[n - 1].x - pts[n - 2].x, y: pts[n - 1].y - pts[n - 2].y };
            if (d.x * endDir.x + d.y * endDir.y >= -0.01)
                return false;
        }
        return true;
    };
    const flat = (pts: Pt[]) => pts.flatMap(p => [p.x, p.y]);
    const C = ROUTE_CLEARANCE;
    const inside = (p: Pt, o: Rect) => p.x > o.x && p.x < o.x + o.w && p.y > o.y && p.y < o.y + o.h;
    const halo = obstacles.map(o => { const inf = { x: o.x - C, y: o.y - C, w: o.w + 2 * C, h: o.h + 2 * C }; return inside(start, inf) || inside(end, inf) ? o : inf; });
    const cands: Pt[][] = [];
    if (Math.abs(start.x - end.x) < 0.5 || Math.abs(start.y - end.y) < 0.5)
        cands.push([start, end]);
    cands.push([start, { x: start.x, y: end.y }, end]);
    cands.push([start, { x: end.x, y: start.y }, end]);
    const mx = (start.x + end.x) / 2, my = (start.y + end.y) / 2;
    cands.push([start, { x: mx, y: start.y }, { x: mx, y: end.y }, end]);
    cands.push([start, { x: start.x, y: my }, { x: end.x, y: my }, end]);
    for (const c of cands)
        if (pathClear(c, halo) && dirsOk(c))
            return flat(c);
    const found = hananRoute(start, end, obstacles, G, startDir, endDir) ?? (startDir || endDir ? hananRoute(start, end, obstacles, G) : null);
    if (found)
        return found;
    for (const c of cands)
        if (pathClear(c, obstacles) && dirsOk(c))
            return flat(c);
    return start.y === end.y || start.x === end.x ? [start.x, start.y, end.x, end.y] : [start.x, start.y, mx, start.y, mx, end.y, end.x, end.y];
}
class MinHeap {
    private f: number[] = [];
    private k: number[] = [];
    get size(): number { return this.f.length; }
    push(f: number, k: number): void {
        const F = this.f, K = this.k;
        let i = F.length;
        F.push(f);
        K.push(k);
        while (i > 0) {
            const p = (i - 1) >> 1;
            if (F[p] <= f)
                break;
            F[i] = F[p];
            K[i] = K[p];
            i = p;
        }
        F[i] = f;
        K[i] = k;
    }
    pop(): number {
        const F = this.f, K = this.k, top = K[0], lf = F.pop()!, lk = K.pop()!, n = F.length;
        if (n) {
            let i = 0;
            for (;;) {
                let c = 2 * i + 1;
                if (c >= n)
                    break;
                if (c + 1 < n && F[c + 1] < F[c])
                    c++;
                if (F[c] >= lf)
                    break;
                F[i] = F[c];
                K[i] = K[c];
                i = c;
            }
            F[i] = lf;
            K[i] = lk;
        }
        return top;
    }
}
function dirIndex(v: Pt): number { return Math.abs(v.x) >= Math.abs(v.y) ? (v.x >= 0 ? 0 : 1) : (v.y >= 0 ? 2 : 3); }
function hananRoute(start: Pt, end: Pt, obstacles: Rect[], G: number, startDir?: Pt, endDir?: Pt): number[] | null {
    const C = ROUTE_CLEARANCE, EPS = 0.5, pad = Math.max(2 * G, 40);
    let x0 = Math.min(start.x, end.x) - pad, x1 = Math.max(start.x, end.x) + pad, y0 = Math.min(start.y, end.y) - pad, y1 = Math.max(start.y, end.y) + pad;
    let rel: Rect[] = [];
    for (let pass = 0; pass < 3; pass++) {
        rel = obstacles.filter(o => o.x < x1 && o.x + o.w > x0 && o.y < y1 && o.y + o.h > y0);
        let grew = false;
        for (const o of rel) {
            if (o.x - C - G < x0) {
                x0 = o.x - C - G;
                grew = true;
            }
            if (o.x + o.w + C + G > x1) {
                x1 = o.x + o.w + C + G;
                grew = true;
            }
            if (o.y - C - G < y0) {
                y0 = o.y - C - G;
                grew = true;
            }
            if (o.y + o.h + C + G > y1) {
                y1 = o.y + o.h + C + G;
                grew = true;
            }
        }
        if (!grew)
            break;
    }
    const uniq = (vals: number[], keep: number[]): number[] => {
        const v = [...vals].sort((p, q) => p - q), out: number[] = [];
        for (const x of v) {
            if (out.length && x - out[out.length - 1] < 0.01) {
                if (keep.some(k => Math.abs(k - x) < 1e-9))
                    out[out.length - 1] = x;
                continue;
            }
            out.push(x);
        }
        return out;
    };
    const lines = (ends: number[], lo: (o: Rect) => number, hi: (o: Rect) => number, a: number, b: number, mids: boolean): number[] => {
        const vals = [a, b, ...ends];
        for (const o of rel)
            vals.push(lo(o) - C, hi(o) + C, lo(o), hi(o));
        let v = uniq(vals.filter(x => x >= a && x <= b), ends);
        if (mids) {
            const m: number[] = [];
            for (let i = 0; i + 1 < v.length; i++)
                if (v[i + 1] - v[i] > 2 * C)
                    m.push((v[i] + v[i + 1]) / 2);
            v = uniq([...v, ...m], ends);
        }
        return v;
    };
    let xs = lines([start.x, end.x], o => o.x, o => o.x + o.w, x0, x1, true), ys = lines([start.y, end.y], o => o.y, o => o.y + o.h, y0, y1, true);
    if (xs.length * ys.length > 90000) {
        xs = lines([start.x, end.x], o => o.x, o => o.x + o.w, x0, x1, false);
        ys = lines([start.y, end.y], o => o.y, o => o.y + o.h, y0, y1, false);
    }
    const cols = xs.length, rows = ys.length;
    if (cols < 2 || rows < 2 || cols * rows > 90000)
        return null;
    const xi = (v: number) => xs.findIndex(x => Math.abs(x - v) < 1e-9), yi = (v: number) => ys.findIndex(y => Math.abs(y - v) < 1e-9);
    const sc = xi(start.x), sr = yi(start.y), ec = xi(end.x), er = yi(end.y);
    if (sc < 0 || sr < 0 || ec < 0 || er < 0)
        return null;
    const rowBlock = ys.map(y => rel.filter(o => y > o.y + EPS && y < o.y + o.h - EPS));
    const colBlock = xs.map(x => rel.filter(o => x > o.x + EPS && x < o.x + o.w - EPS));
    const rowNear = ys.map(y => rel.filter(o => y > o.y - C - EPS && y < o.y + o.h + C + EPS && !(y > o.y + EPS && y < o.y + o.h - EPS)));
    const colNear = xs.map(x => rel.filter(o => x > o.x - C - EPS && x < o.x + o.w + C + EPS && !(x > o.x + EPS && x < o.x + o.w - EPS)));
    const overlap = (a0: number, a1: number, b0: number, b1: number) => Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));
    const BEND = Math.max(24, G), NEAR = 0.6;
    const DIRS: [
        number,
        number
    ][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    const N = cols * rows, g = new Float64Array(N * 4).fill(Infinity), prev = new Int32Array(N * 4).fill(-1);
    const h = (c: number, r: number) => Math.abs(xs[c] - xs[ec]) + Math.abs(ys[r] - ys[er]);
    const heap = new MinHeap(), sk = sr * cols + sc, ek = er * cols + ec;
    const sd = startDir ? dirIndex(startDir) : -1, needEnd = endDir ? dirIndex({ x: -endDir.x, y: -endDir.y }) : -1;
    for (let d = 0; d < 4; d++) {
        if (sd >= 0 && d !== sd)
            continue;
        g[sk * 4 + d] = 0;
        heap.push(h(sc, sr), sk * 4 + d);
    }
    let endState = -1;
    while (heap.size) {
        const st = heap.pop(), k = st >> 2, cd = st & 3, base = g[st];
        if (k === ek && (needEnd < 0 || cd === needEnd)) {
            endState = st;
            break;
        }
        const c = k % cols, r = (k - c) / cols;
        for (let nd = 0; nd < 4; nd++) {
            const first = k === sk && base === 0;
            if (first ? (sd >= 0 && nd !== sd) : (nd ^ 1) === cd)
                continue;
            const nc = c + DIRS[nd][0], nr = r + DIRS[nd][1];
            if (nc < 0 || nr < 0 || nc >= cols || nr >= rows)
                continue;
            let step: number, pen = 0;
            if (nd < 2) {
                const a = Math.min(xs[c], xs[nc]), b = Math.max(xs[c], xs[nc]);
                step = b - a;
                if (rowBlock[r].some(o => b > o.x + EPS && a < o.x + o.w - EPS))
                    continue;
                for (const o of rowNear[r])
                    pen += overlap(a, b, o.x - C, o.x + o.w + C) * NEAR;
            }
            else {
                const a = Math.min(ys[r], ys[nr]), b = Math.max(ys[r], ys[nr]);
                step = b - a;
                if (colBlock[c].some(o => b > o.y + EPS && a < o.y + o.h - EPS))
                    continue;
                for (const o of colNear[c])
                    pen += overlap(a, b, o.y - C, o.y + o.h + C) * NEAR;
            }
            const ns = (nr * cols + nc) * 4 + nd, cost = base + step + pen + (nd !== cd ? BEND : 0);
            if (cost < g[ns]) {
                g[ns] = cost;
                prev[ns] = st;
                heap.push(cost + h(nc, nr), ns);
            }
        }
    }
    if (endState < 0)
        return null;
    const cells: number[] = [];
    for (let s = endState; s >= 0; s = prev[s])
        cells.push(s >> 2);
    cells.reverse();
    const out: number[] = [];
    for (const k of cells) {
        const x = xs[k % cols], y = ys[(k - k % cols) / cols], n = out.length;
        if (n >= 4) {
            const px = out[n - 2], py = out[n - 1], qx = out[n - 4], qy = out[n - 3];
            if (Math.abs((px - qx) * (y - py) - (py - qy) * (x - px)) < 0.01) {
                out[n - 2] = x;
                out[n - 1] = y;
                continue;
            }
        }
        if (n >= 2 && Math.abs(out[n - 2] - x) < 0.01 && Math.abs(out[n - 1] - y) < 0.01)
            continue;
        out.push(x, y);
    }
    out[0] = start.x;
    out[1] = start.y;
    out[out.length - 2] = end.x;
    out[out.length - 1] = end.y;
    return out;
}
export interface RouteOpts {
    fromCenterX: number;
    toCenterX: number;
    obstacles?: Pt[];
    grid: number;
}
export function routeWire(termA: Pt, termB: Pt, o: RouteOpts): {
    pts: number[];
    swap: boolean;
} {
    const swap = termA.x > termB.x;
    const a = swap ? termB : termA;
    const b = swap ? termA : termB;
    const rFromX = swap ? o.toCenterX : o.fromCenterX;
    const rToX = swap ? o.fromCenterX : o.toCenterX;
    const G = o.grid;
    const sameHeight = Math.abs(b.y - a.y) < G * 3;
    const midY = (a.y + b.y) / 2;
    const hasNodeBetween = sameHeight && (o.obstacles ?? []).some(c => c.x > a.x && c.x < b.x && Math.abs(c.y - midY) < G * 2);
    const srcBlocks = sameHeight && a.x < rFromX && b.x > rFromX;
    const destBlocks = sameHeight && b.x > rToX && a.x < rToX;
    const goingBack = sameHeight && (srcBlocks || destBlocks || hasNodeBetween);
    let pts: number[];
    if (goingBack) {
        const topY = Math.min(a.y, b.y) - 80;
        const botY = Math.max(a.y, b.y) + 80;
        const ry = topY > 20 ? topY : botY;
        pts = [a.x, a.y, a.x, ry, b.x, ry, b.x, b.y];
    }
    else {
        let mx = (a.x + b.x) / 2;
        if (a.y !== b.y) {
            const destCrossed = (b.x > rToX && mx < rToX) || (b.x < rToX && mx > rToX);
            const srcCrossed = (a.x < rFromX && mx > rFromX) || (a.x > rFromX && mx < rFromX);
            if (destCrossed)
                mx = b.x;
            else if (srcCrossed)
                mx = a.x;
        }
        pts = [a.x, a.y, mx, a.y, mx, b.y, b.x, b.y];
    }
    return { pts, swap };
}
export interface Box {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
}
export interface ViewTransform {
    scale: number;
    x: number;
    y: number;
}
export function fitView(box: Box, stageW: number, stageH: number, opts: {
    pad?: number;
    maxScale?: number;
} = {}): ViewTransform {
    const pad = opts.pad ?? 60;
    const maxScale = opts.maxScale ?? 2;
    const minX = box.minX - pad, minY = box.minY - pad;
    const maxX = box.maxX + pad, maxY = box.maxY + pad;
    const bw = maxX - minX, bh = maxY - minY;
    if (![stageW, stageH, bw, bh].every((v) => Number.isFinite(v) && v > 0)) {
        return { scale: Math.min(1, maxScale), x: 0, y: 0 };
    }
    const scale = Math.min(stageW / bw, stageH / bh, maxScale);
    return {
        scale,
        x: (stageW - bw * scale) / 2 - minX * scale,
        y: (stageH - bh * scale) / 2 - minY * scale,
    };
}
export interface RectBox {
    x: number;
    y: number;
    w: number;
    h: number;
}
export interface InsideRectOpts {
    header?: number;
    headerSide?: "top" | "left" | "right" | "bottom";
    margin?: number;
}
export function nodeInsideRect(child: RectBox, cont: RectBox, opts: InsideRectOpts = {}): boolean {
    const h = opts.header ?? 0, side = opts.headerSide ?? "top", m = opts.margin ?? (1 / 3);
    const mx = child.w * m, my = child.h * m;
    const left = cont.x - cont.w / 2 + (side === "left" ? h : 0);
    const right = cont.x + cont.w / 2 - (side === "right" ? h : 0);
    const top = cont.y - cont.h / 2 + (side === "top" ? h : 0);
    const bottom = cont.y + cont.h / 2 - (side === "bottom" ? h : 0);
    return child.x - mx >= left && child.x + mx <= right && child.y - my >= top && child.y + my <= bottom;
}
