import { ShapeKind, PathPt, buildPathData, buildCompoundPathData, SHAPE_SIZES, cylinderPaths, cylinderRy, shapeRadii, roundRectPath, CornerPreset, ShapeParams, trianglePts, starPts, notePts, noteFold, documentPath, calloutGeom, hexagonPts, cardPts, crossPts, processBar } from "./diagram-shapes";
import { ChartSpec, chartSvg, effectiveChartSpec } from "./diagram-charts";
export interface SvgNode extends ShapeParams {
    kind: ShapeKind;
    x: number;
    y: number;
    w: number;
    h: number;
    text: string;
    fill?: string;
    stroke?: string;
    borderStyle?: string;
    borderWidth?: number;
    borderPattern?: string;
    rotation?: number;
    corners?: CornerPreset;
    path?: PathPt[];
    paths?: PathPt[][];
    opacity?: number;
    chart?: ChartSpec;
    titleH?: number;
}
export function shapePreviewSvg(kind: ShapeKind, slant?: number): string | null {
    if (kind === "icon" || kind === "image" || kind === "text" || kind === "container")
        return null;
    const W = 26, H = 18, pad = 2;
    const nat = SHAPE_SIZES[kind] ?? { w: 120, h: 60 };
    const scale = Math.min((W - pad * 2) / nat.w, (H - pad * 2) / nat.h);
    const n: SvgNode = { kind, x: W / 2, y: H / 2, w: nat.w * scale, h: nat.h * scale, text: "", fill: "#e3f2fd", stroke: "#1565c0", slant };
    return `<svg viewBox="0 0 ${W} ${H}" width="21" height="15" xmlns="http://www.w3.org/2000/svg" style="display:block">${shapeSvg(n)}</svg>`;
}
export interface SvgEdge {
    pts: number[];
    label?: string;
    color?: string;
    dash?: number[];
    arrows?: "none" | "end" | "start" | "both";
    head?: "line" | "triangle" | "diamond" | "circle";
    width?: number;
    toCenter?: {
        x: number;
        y: number;
    };
    fromCenter?: {
        x: number;
        y: number;
    };
}
function aimBase(ex: number, ey: number, bx: number, by: number, center?: {
    x: number;
    y: number;
}): [
    number,
    number
] {
    if (!center)
        return [bx, by];
    const dx = center.x - ex, dy = center.y - ey, d = Math.hypot(dx, dy);
    return d > 1 ? [ex - (dx / d) * 12, ey - (dy / d) * 12] : [bx, by];
}
const FILL = "#e3f2fd", STROKE = "#1565c0", EDGE = "#607d8b", ARROW = "#455a64", TEXT = "#263238";
const esc = (s: string) => s.replace(/[<>&"]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "\"": "&quot;" }[c]!));
export function buildSvg(nodes: SvgNode[], edges: SvgEdge[], background?: string, clip?: {
    x: number;
    y: number;
    width: number;
    height: number;
}, a11y?: {
    title: string;
    desc: string;
}): string {
    let x: number, y: number, w: number, h: number;
    if (clip) {
        x = clip.x;
        y = clip.y;
        w = clip.width;
        h = clip.height;
    }
    else {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const n of nodes) {
            const ext = n.rotation ? Math.hypot(n.w, n.h) / 2 : 0;
            const ex = Math.max(n.w / 2, ext), ey = Math.max(n.h / 2, ext);
            minX = Math.min(minX, n.x - ex);
            minY = Math.min(minY, n.y - ey);
            maxX = Math.max(maxX, n.x + ex);
            maxY = Math.max(maxY, n.y + ey);
        }
        for (const e of edges)
            for (let i = 0; i + 1 < e.pts.length; i += 2) {
                minX = Math.min(minX, e.pts[i]);
                maxX = Math.max(maxX, e.pts[i]);
                minY = Math.min(minY, e.pts[i + 1]);
                maxY = Math.max(maxY, e.pts[i + 1]);
            }
        if (!isFinite(minX)) {
            minX = minY = 0;
            maxX = maxY = 100;
        }
        const pad = 16;
        x = minX - pad;
        y = minY - pad;
        w = maxX - minX + 2 * pad;
        h = maxY - minY + 2 * pad;
    }
    const parts: string[] = [];
    if (background)
        parts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${background}"/>`);
    for (const e of edges) {
        if (e.pts.length < 4)
            continue;
        let d = `M ${e.pts[0]} ${e.pts[1]}`;
        for (let i = 2; i + 1 < e.pts.length; i += 2)
            d += ` L ${e.pts[i]} ${e.pts[i + 1]}`;
        const col = e.color ?? EDGE;
        const dash = e.dash && e.dash.length ? ` stroke-dasharray="${e.dash.join(" ")}"` : "";
        parts.push(`<path d="${d}" fill="none" stroke="${col}" stroke-width="${e.width ?? 2}" stroke-linejoin="round" stroke-linecap="round"${dash}/>`);
        const arr = e.arrows ?? "end", hd = e.head ?? "line", n = e.pts.length;
        if (arr === "end" || arr === "both") {
            const [bx, by] = aimBase(e.pts[n - 2], e.pts[n - 1], e.pts[n - 4], e.pts[n - 3], e.toCenter);
            parts.push(arrowhead(bx, by, e.pts[n - 2], e.pts[n - 1], col, hd));
        }
        if (arr === "start" || arr === "both") {
            const [bx, by] = aimBase(e.pts[0], e.pts[1], e.pts[2], e.pts[3], e.fromCenter);
            parts.push(arrowhead(bx, by, e.pts[0], e.pts[1], col, hd));
        }
        if (e.label) {
            const m = midpoint(e.pts);
            parts.push(labelChip(m.x, m.y, e.label));
        }
    }
    for (const n of nodes) {
        let m = shapeSvg(n);
        if (n.rotation)
            m = `<g transform="rotate(${n.rotation} ${n.x} ${n.y})">${m}</g>`;
        if (n.opacity != null && n.opacity < 1)
            m = `<g opacity="${n.opacity}">${m}</g>`;
        parts.push(m);
    }
    const a11yAttrs = a11y ? " role=\"img\" aria-labelledby=\"d-title d-desc\"" : "";
    const a11yTags = a11y ? `<title id="d-title">${esc(a11y.title)}</title>\n<desc id="d-desc">${esc(a11y.desc)}</desc>\n` : "";
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${w} ${h}" width="${w}" height="${h}" font-family="Roboto, sans-serif"${a11yAttrs}>\n${a11yTags}${parts.join("\n")}\n</svg>`;
}
export function nodeMiniSvg(n: SvgNode): string {
    return n.rotation ? `<g transform="rotate(${n.rotation} ${n.x} ${n.y})">${shapeSvg(n, false)}</g>` : shapeSvg(n, false);
}
function shapeSvg(n: SvgNode, withText = true): string {
    const { x, y, w, h } = n, hw = w / 2, hh = h / 2;
    const fill = n.fill ?? FILL, stroke = n.stroke ?? STROKE;
    const attrs = `fill="${fill}" stroke="${stroke}" stroke-width="2"`;
    const txt = withText ? textSvg(n) : "";
    if (n.kind === "chart" && n.chart)
        return `<g transform="translate(${x} ${y})">${chartSvg(effectiveChartSpec(n.chart, { fill: n.fill, stroke: n.stroke, borderStyle: n.borderStyle, borderWidth: n.borderWidth, borderPattern: n.borderPattern }), w, h)}</g>`;
    if (n.paths && n.paths.length)
        return `<path d="${buildCompoundPathData(n.paths)}" transform="translate(${x} ${y})" ${attrs} fill-rule="nonzero"/>` + txt;
    if (n.path && n.path.length >= 3)
        return `<path d="${buildPathData(n.path)}" transform="translate(${x} ${y})" ${attrs}/>` + txt;
    let shape = "";
    const pointsAttr = (pts: number[]) => { const s: string[] = []; for (let i = 0; i + 1 < pts.length; i += 2)
        s.push(`${pts[i]},${pts[i + 1]}`); return s.join(" "); };
    switch (n.kind) {
        case "round":
        case "rect": {
            const r = shapeRadii(n.kind, w, h, n.corners, n.radii);
            shape = r.some(v => v > 0) ? `<path d="${roundRectPath(x - hw, y - hh, w, h, r)}" ${attrs}/>` : `<rect x="${x - hw}" y="${y - hh}" width="${w}" height="${h}" ${attrs}/>`;
            break;
        }
        case "ellipse":
            shape = `<ellipse cx="${x}" cy="${y}" rx="${hw}" ry="${hh}" ${attrs}/>`;
            break;
        case "diamond":
            shape = `<polygon points="${pointsAttr([x, y - hh, x + hw, y, x, y + hh, x - hw, y])}" ${attrs}/>`;
            break;
        case "parallelogram": {
            const s = Math.min(hw * 0.9, (n.slant ?? 0.2) * w);
            shape = `<polygon points="${pointsAttr([x - hw + s, y - hh, x + hw, y - hh, x + hw - s, y + hh, x - hw, y + hh])}" ${attrs}/>`;
            break;
        }
        case "hexagon":
            shape = `<polygon points="${pointsAttr(hexagonPts(w, h, n.cut).map((v, i) => v + (i % 2 ? y : x)))}" ${attrs}/>`;
            break;
        case "cylinder": {
            const cp = cylinderPaths(w, h, n.depth, x, y);
            shape = `<path d="${cp.body}" ${attrs}/><path d="${cp.lip}" fill="none" stroke="${stroke}" stroke-width="2"/>`;
            break;
        }
        case "note": {
            const f = noteFold(w, h, n.fold);
            shape = `<polygon points="${pointsAttr(notePts(w, h, n.fold).map((v, i) => v + (i % 2 ? y : x)))}" ${attrs}/>` + `<polyline points="${pointsAttr([x + hw - f, y - hh, x + hw - f, y - hh + f, x + hw, y - hh + f])}" fill="none" stroke="${stroke}" stroke-width="2"/>`;
            break;
        }
        case "triangle":
            shape = `<polygon points="${pointsAttr(trianglePts(w, h, n.apex).map((v, i) => v + (i % 2 ? y : x)))}" ${attrs}/>`;
            break;
        case "card":
            shape = `<polygon points="${pointsAttr(cardPts(w, h, n.cut).map((v, i) => v + (i % 2 ? y : x)))}" ${attrs}/>`;
            break;
        case "star":
            shape = `<polygon points="${pointsAttr(starPts(w, h, n.points, n.inner).map((v, i) => v + (i % 2 ? y : x)))}" ${attrs}/>`;
            break;
        case "cross":
            shape = `<polygon points="${pointsAttr(crossPts(w, h, n.arm).map((v, i) => v + (i % 2 ? y : x)))}" ${attrs}/>`;
            break;
        case "document":
            shape = `<path d="${documentPath(w, h, n.wave, x, y)}" ${attrs}/>`;
            break;
        case "process": {
            const bar = processBar(w, n.bar);
            shape = `<rect x="${x - hw}" y="${y - hh}" width="${w}" height="${h}" ${attrs}/><line x1="${x - hw + bar}" y1="${y - hh}" x2="${x - hw + bar}" y2="${y + hh}" stroke="${stroke}" stroke-width="2"/><line x1="${x + hw - bar}" y1="${y - hh}" x2="${x + hw - bar}" y2="${y + hh}" stroke="${stroke}" stroke-width="2"/>`;
            break;
        }
        case "callout":
            shape = `<polygon points="${pointsAttr(calloutGeom(w, h, n.tailX, n.tailH).pts.map((v, i) => v + (i % 2 ? y : x)))}" ${attrs}/>`;
            break;
        case "actor": {
            const headR = Math.min(w, h) * 0.17, headCy = -hh + headR + 2, bodyTop = headCy + headR, hipY = h * 0.12, footY = hh - 2;
            const shoulderY = bodyTop + (hipY - bodyTop) * 0.32, armSpan = w * 0.42, legSpan = w * 0.32;
            const ls = `stroke="${stroke}" stroke-width="2.5" stroke-linecap="round" fill="none"`;
            return `<g transform="translate(${x} ${y})"><circle cx="0" cy="${headCy}" r="${headR}" ${attrs}/><line x1="0" y1="${bodyTop}" x2="0" y2="${hipY}" ${ls}/><line x1="${-armSpan}" y1="${shoulderY}" x2="${armSpan}" y2="${shoulderY}" ${ls}/><line x1="0" y1="${hipY}" x2="${-legSpan}" y2="${footY}" ${ls}/><line x1="0" y1="${hipY}" x2="${legSpan}" y2="${footY}" ${ls}/></g>` + txt;
        }
        case "cloud": {
            const arc = (cx: number, cy: number, r: number, a0: number, a1: number) => { const pts: number[] = []; const steps = Math.max(4, Math.ceil(Math.abs(a1 - a0) / (Math.PI / 8))); for (let i = 0; i <= steps; i++) {
                const a = a0 + (a1 - a0) * i / steps;
                pts.push(x + cx + r * Math.cos(a), y + cy + r * Math.sin(a));
            } return pts; };
            const pts = [...arc(-hw * 0.45, hh * 0.2, hh * 0.5, Math.PI * 0.5, Math.PI * 1.5), ...arc(-hw * 0.1, -hh * 0.35, hh * 0.55, Math.PI, Math.PI * 1.85), ...arc(hw * 0.45, -hh * 0.2, hh * 0.5, Math.PI * 1.37, Math.PI * 2), ...arc(hw * 0.55, hh * 0.35, hh * 0.42, Math.PI * 1.7, Math.PI * 2.5)];
            shape = `<polygon points="${pointsAttr(pts)}" ${attrs}/>`;
            break;
        }
        case "text":
        case "icon":
            shape = "";
            break;
        default:
            shape = `<rect x="${x - hw}" y="${y - hh}" width="${w}" height="${h}" rx="4" ${attrs}/>`;
            break;
        case "container": {
            const bar = Math.max(26, Math.min(n.titleH ?? 26, h - 8));
            return `<rect x="${x - hw}" y="${y - hh}" width="${w}" height="${h}" rx="6" fill="${n.fill ?? "rgba(21,101,192,0.04)"}" stroke="${stroke}" stroke-width="1.5"/>`
                + `<path d="M ${x - hw} ${y - hh + bar} L ${x - hw} ${y - hh + 6} Q ${x - hw} ${y - hh} ${x - hw + 6} ${y - hh} L ${x + hw - 6} ${y - hh} Q ${x + hw} ${y - hh} ${x + hw} ${y - hh + 6} L ${x + hw} ${y - hh + bar} Z" fill="${stroke}"/>`
                + (withText ? `<text x="${x - hw + 8}" y="${y - hh + bar / 2 + 4}" font-size="13" font-weight="bold" fill="#fff">${esc(n.text || "Carril")}</text>` : "");
        }
    }
    return shape + txt;
}
function textSvg(n: SvgNode): string {
    if (!n.text)
        return "";
    const lines = n.text.split("\n");
    const lh = 16, cy = n.y + (n.kind === "cylinder" ? cylinderRy(n.h, n.depth) : 0);
    const startY = cy - ((lines.length - 1) * lh) / 2;
    const tspans = lines.map((l, i) => `<tspan x="${n.x}" y="${startY + i * lh + 5}">${esc(l)}</tspan>`).join("");
    return `<text text-anchor="middle" font-size="14" fill="${TEXT}">${tspans}</text>`;
}
function arrowhead(bx: number, by: number, ex: number, ey: number, color = ARROW, head: "line" | "triangle" | "diamond" | "circle" = "line"): string {
    const a = Math.atan2(ey - by, ex - bx), sz = 10;
    const at = (d: number, perp: number) => `${(ex + d * Math.cos(a) - perp * Math.sin(a)).toFixed(1)},${(ey + d * Math.sin(a) - perp * Math.cos(a)).toFixed(1)}`;
    if (head === "circle")
        return `<circle cx="${ex}" cy="${ey}" r="${sz * 0.45}" fill="${color}"/>`;
    if (head === "triangle")
        return `<polygon points="${ex},${ey} ${at(-sz, sz * 0.55)} ${at(-sz, -sz * 0.55)}" fill="${color}"/>`;
    if (head === "diamond")
        return `<polygon points="${ex},${ey} ${at(-sz * 0.6, sz * 0.5)} ${at(-sz * 1.2, 0)} ${at(-sz * 0.6, -sz * 0.5)}" fill="${color}"/>`;
    const p1x = ex - sz * Math.cos(a - 0.5), p1y = ey - sz * Math.sin(a - 0.5);
    const p2x = ex - sz * Math.cos(a + 0.5), p2y = ey - sz * Math.sin(a + 0.5);
    return `<polyline points="${p1x},${p1y} ${ex},${ey} ${p2x},${p2y}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`;
}
function midpoint(pts: number[]): {
    x: number;
    y: number;
} {
    let total = 0;
    const seg: number[] = [];
    for (let i = 0; i + 3 < pts.length; i += 2) {
        const d = Math.hypot(pts[i + 2] - pts[i], pts[i + 3] - pts[i + 1]);
        seg.push(d);
        total += d;
    }
    let acc = 0;
    const half = total / 2;
    for (let i = 0, s = 0; i + 3 < pts.length; i += 2, s++) {
        if (acc + seg[s] >= half) {
            const t = seg[s] ? (half - acc) / seg[s] : 0;
            return { x: pts[i] + (pts[i + 2] - pts[i]) * t, y: pts[i + 1] + (pts[i + 3] - pts[i + 1]) * t };
        }
        acc += seg[s];
    }
    return { x: pts[0], y: pts[1] };
}
function labelChip(x: number, y: number, label: string): string {
    const w = label.length * 7 + 8, h = 16;
    return `<rect x="${x - w / 2}" y="${y - h / 2}" width="${w}" height="${h}" rx="3" fill="#fff"/><text x="${x}" y="${y + 4}" text-anchor="middle" font-size="12" fill="${TEXT}">${esc(label)}</text>`;
}
