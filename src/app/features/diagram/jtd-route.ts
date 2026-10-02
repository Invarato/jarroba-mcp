export type Side = "n" | "s" | "e" | "w";
export interface RBox {
    x: number;
    y: number;
    w: number;
    h: number;
    point?: boolean;
}
export interface REdge {
    from: string;
    to: string;
    fromPort?: string;
    toPort?: string;
}
const STUB = 20, AROUND = 24;
const isSide = (p: string | undefined): p is Side => p === "n" || p === "s" || p === "e" || p === "w";
const vertical = (s: Side) => s === "n" || s === "s";
const out: Record<Side, [
    number,
    number
]> = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] };
export function facingSide(a: RBox, b: RBox): Side {
    const dx = b.x - a.x, dy = b.y - a.y;
    return Math.abs(dx) / (a.w + b.w) > Math.abs(dy) / (a.h + b.h) ? (dx >= 0 ? "e" : "w") : (dy >= 0 ? "s" : "n");
}
function sidePoint(b: RBox, s: Side, f: number): [
    number,
    number
] {
    const l = b.x - b.w / 2, t = b.y - b.h / 2;
    if (s === "n")
        return [l + b.w * f, t];
    if (s === "s")
        return [l + b.w * f, t + b.h];
    if (s === "w")
        return [l, t + b.h * f];
    return [l + b.w, t + b.h * f];
}
function simplify(p: [
    number,
    number
][]): number[] {
    const q: [
        number,
        number
    ][] = [];
    for (const pt of p) {
        const last = q[q.length - 1];
        if (last && Math.abs(last[0] - pt[0]) < 0.01 && Math.abs(last[1] - pt[1]) < 0.01)
            continue;
        if (q.length >= 2) {
            const a = q[q.length - 2], b = q[q.length - 1];
            if ((Math.abs(a[0] - b[0]) < 0.01 && Math.abs(b[0] - pt[0]) < 0.01) || (Math.abs(a[1] - b[1]) < 0.01 && Math.abs(b[1] - pt[1]) < 0.01)) {
                q[q.length - 1] = pt;
                continue;
            }
        }
        q.push(pt);
    }
    return q.flat();
}
function connect(A: RBox, sa: Side, p0: [
    number,
    number
], B: RBox, sb: Side, q0: [
    number,
    number
], all: readonly RBox[]): number[] {
    const p1: [
        number,
        number
    ] = [p0[0] + out[sa][0] * STUB, p0[1] + out[sa][1] * STUB];
    const q1: [
        number,
        number
    ] = [q0[0] + out[sb][0] * STUB, q0[1] + out[sb][1] * STUB];
    const pts: [
        number,
        number
    ][] = [p0, p1];
    const ahead = (s: Side, from: [
        number,
        number
    ], to: [
        number,
        number
    ]) => (to[0] - from[0]) * out[s][0] + (to[1] - from[1]) * out[s][1] >= 0;
    const aroundX = (y0: number, y1: number): number => {
        const lo = Math.min(y0, y1), hi = Math.max(y0, y1), inRun = all.filter(b => b.y + b.h / 2 > lo && b.y - b.h / 2 < hi);
        return A.x >= B.x ? Math.max(...[A, B, ...inRun].map(b => b.x + b.w / 2)) + AROUND : Math.min(...[A, B, ...inRun].map(b => b.x - b.w / 2)) - AROUND;
    };
    const aroundY = (x0: number, x1: number): number => {
        const lo = Math.min(x0, x1), hi = Math.max(x0, x1), inRun = all.filter(b => b.x + b.w / 2 > lo && b.x - b.w / 2 < hi);
        return A.y >= B.y ? Math.max(...[A, B, ...inRun].map(b => b.y + b.h / 2)) + AROUND : Math.min(...[A, B, ...inRun].map(b => b.y - b.h / 2)) - AROUND;
    };
    if (vertical(sa) && vertical(sb)) {
        if (sa !== sb && ahead(sa, p1, q1) && ahead(sb, q1, p1)) {
            const my = (p1[1] + q1[1]) / 2;
            pts.push([p1[0], my], [q1[0], my]);
        }
        else if (sa === sb) {
            const y = sa === "s" ? Math.max(p1[1], q1[1]) : Math.min(p1[1], q1[1]);
            pts.push([p1[0], y], [q1[0], y]);
        }
        else {
            const x = aroundX(p1[1], q1[1]);
            pts.push([x, p1[1]], [x, q1[1]]);
        }
    }
    else if (!vertical(sa) && !vertical(sb)) {
        if (sa !== sb && ahead(sa, p1, q1) && ahead(sb, q1, p1)) {
            const mx = (p1[0] + q1[0]) / 2;
            pts.push([mx, p1[1]], [mx, q1[1]]);
        }
        else if (sa === sb) {
            const x = sa === "e" ? Math.max(p1[0], q1[0]) : Math.min(p1[0], q1[0]);
            pts.push([x, p1[1]], [x, q1[1]]);
        }
        else {
            const y = aroundY(p1[0], q1[0]);
            pts.push([p1[0], y], [q1[0], y]);
        }
    }
    else if (vertical(sa))
        pts.push([p1[0], q1[1]]);
    else
        pts.push([q1[0], p1[1]]);
    pts.push(q1, q0);
    return simplify(pts);
}
export function routeOrthogonal(boxes: ReadonlyMap<string, RBox>, edges: readonly REdge[]): number[][] {
    const ends = edges.map(e => {
        const A = boxes.get(e.from), B = boxes.get(e.to);
        if (!A || !B || e.from === e.to)
            return null;
        return { A, B, sa: isSide(e.fromPort) ? e.fromPort : facingSide(A, B), sb: isSide(e.toPort) ? e.toPort : facingSide(B, A) };
    });
    const slots = new Map<string, {
        k: number;
        end: 0 | 1;
        key: number;
    }[]>();
    ends.forEach((x, k) => {
        if (!x)
            return;
        const other = (b: RBox, s: Side) => (vertical(s) ? b.x : b.y);
        const add = (id: string, s: Side, end: 0 | 1, key: number) => { const kk = id + "|" + s; (slots.get(kk) ?? slots.set(kk, []).get(kk)!).push({ k, end, key }); };
        add(edges[k].from, x.sa, 0, other(x.B, x.sa));
        add(edges[k].to, x.sb, 1, other(x.A, x.sb));
    });
    const frac = new Map<string, number>();
    for (const list of slots.values()) {
        list.sort((a, b) => a.key - b.key || a.k - b.k);
        list.forEach((s, i) => frac.set(s.k + ":" + s.end, (i + 1) / (list.length + 1)));
    }
    return ends.map((x, k) => {
        if (!x)
            return [];
        const p0 = sidePoint(x.A, x.sa, x.A.point ? 0.5 : frac.get(k + ":0") ?? 0.5), q0 = sidePoint(x.B, x.sb, x.B.point ? 0.5 : frac.get(k + ":1") ?? 0.5);
        return connect(x.A, x.sa, p0, x.B, x.sb, q0, [...boxes.values()]);
    });
}
