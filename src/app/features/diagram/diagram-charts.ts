import { TextRun, dashArrayFor } from "./diagram-shapes";
export type ChartType = "bar" | "barh" | "pie" | "donut" | "line" | "area" | "scatter" | "quadrant" | "radar" | "gauge" | "voronoi" | "sankey" | "boxplot" | "heatmap" | "treemap";
export const CHART_TYPES: ChartType[] = ["bar", "barh", "pie", "donut", "line", "area", "scatter", "quadrant", "radar", "gauge", "voronoi", "sankey", "boxplot", "heatmap", "treemap"];
const _chartTypesExhaustive: Record<ChartType, true> = { bar: true, barh: true, pie: true, donut: true, line: true, area: true, scatter: true, quadrant: true, radar: true, gauge: true, voronoi: true, sankey: true, boxplot: true, heatmap: true, treemap: true };
void _chartTypesExhaustive;
export interface TextStyle {
    color?: string;
    size?: number;
    bold?: boolean;
    italic?: boolean;
    font?: string;
    rotation?: number;
    align?: "left" | "center" | "right";
    boxW?: number;
    boxH?: number;
}
export interface ChartSeries {
    name?: string;
    color?: string;
    values: number[];
    kind?: "bar" | "line" | "area";
    axis?: "right";
}
export interface ChartSpec {
    type: ChartType;
    title?: string;
    categories?: string[];
    series: ChartSeries[];
    showValues?: boolean;
    points?: {
        x: number;
        y: number;
        label?: string;
        lx?: number;
        ly?: number;
        style?: TextStyle;
        labelRuns?: TextRun[];
    }[];
    xAxis?: [
        string,
        string
    ];
    yAxis?: [
        string,
        string
    ];
    quadrants?: string[];
    quadCols?: number;
    quadRows?: number;
    max?: number;
    yMin?: number;
    yMax?: number;
    yLog?: boolean;
    links?: {
        from: string;
        to: string;
        value: number;
    }[];
    bg?: string;
    frame?: boolean;
    grid?: boolean;
    legend?: boolean;
    legendBox?: boolean;
    pieRaw?: boolean;
    titleStyle?: TextStyle;
    labelStyle?: TextStyle;
    catStyle?: TextStyle;
    legendStyle?: TextStyle;
    xTitleStyle?: TextStyle;
    yTitleStyle?: TextStyle;
    frameColor?: string;
    frameWidth?: number;
    frameDash?: number[];
    titleDx?: number;
    titleDy?: number;
    titleRuns?: TextRun[];
    xTitle?: string;
    yTitle?: string;
}
export const CHART_PALETTE = ["#1565c0", "#00897b", "#ef6c00", "#8e24aa", "#c62828", "#3949ab", "#00acc1", "#7cb342", "#fb8c00", "#6d4c41"];
export function chartColor(spec: ChartSpec, i: number): string {
    return spec.series[i]?.color || CHART_PALETTE[i % CHART_PALETTE.length];
}
export function sampleChart(type: ChartType): ChartSpec {
    const cats = ["Ene", "Feb", "Mar", "Abr"];
    switch (type) {
        case "pie":
        case "donut":
            return { type, categories: ["A", "B", "C", "D"], series: [{ values: [35, 25, 22, 18] }], showValues: true };
        case "line":
        case "area":
            return { type, categories: cats, series: [{ name: "Serie 1", values: [12, 19, 15, 25] }] };
        case "scatter":
            return { type, series: [{ name: "Puntos" }], points: [{ x: 1, y: 2 }, { x: 2, y: 3.5 }, { x: 3, y: 2.8 }, { x: 4, y: 5 }] } as ChartSpec;
        case "quadrant":
            return {
                type,
                xAxis: ["Bajo", "Alto"],
                yAxis: ["Bajo", "Alto"],
                quadrants: ["Q1", "Q2", "Q3", "Q4"],
                series: [],
                points: [{ x: 0.3, y: 0.7, label: "A" }, { x: 0.75, y: 0.8, label: "B" }, { x: 0.25, y: 0.25, label: "C" }, { x: 0.7, y: 0.3, label: "D" }],
            };
        case "barh":
            return { type, categories: cats, series: [{ name: "Serie 1", values: [12, 19, 15, 25] }], showValues: true };
        case "radar":
            return { type, categories: ["Velocidad", "Fuerza", "Defensa", "Magia", "Suerte"], series: [{ name: "A", values: [70, 55, 80, 40, 60] }] };
        case "gauge":
            return { type, categories: ["Uso"], series: [{ values: [65] }], max: 100, showValues: true };
        case "voronoi":
            return { type, series: [], points: [{ x: 0.2, y: 0.3 }, { x: 0.7, y: 0.25 }, { x: 0.5, y: 0.6 }, { x: 0.85, y: 0.7 }, { x: 0.3, y: 0.8 }] };
        case "sankey":
            return { type, series: [], links: [
                    { from: "Origen", to: "Web", value: 8 },
                    { from: "Origen", to: "App", value: 4 },
                    { from: "Web", to: "Compra", value: 5 },
                    { from: "Web", to: "Salida", value: 3 },
                    { from: "App", to: "Compra", value: 3 },
                    { from: "App", to: "Salida", value: 1 },
                ] };
        case "boxplot":
            return { type, series: [
                    { name: "A", values: [12, 15, 14, 18, 21, 16, 13, 19, 17] },
                    { name: "B", values: [22, 25, 19, 28, 31, 24, 27, 20, 30] },
                    { name: "C", values: [8, 11, 9, 14, 7, 12, 10, 13, 6] },
                ] };
        case "heatmap":
            return { type, categories: ["Lun", "Mar", "Mi\u00E9", "Jue", "Vie"], series: [
                    { name: "Ma\u00F1ana", values: [3, 5, 8, 6, 9] },
                    { name: "Tarde", values: [7, 4, 6, 9, 5] },
                    { name: "Noche", values: [2, 3, 1, 4, 8] },
                ], showValues: true };
        case "treemap":
            return { type, categories: ["Alojamiento", "Comida", "Transporte", "Ocio", "Otros"], series: [{ values: [42, 28, 15, 10, 5] }], showValues: true };
        default:
            return { type: "bar", categories: cats, series: [{ name: "Serie 1", values: [12, 19, 15, 25] }], showValues: true };
    }
}
const AXIS = "#90a4ae", GRID = "#eceff1", LABEL = "#546e7a";
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export interface ChartHandle {
    key: string;
    x: number;
    y: number;
    label?: boolean;
    set(localX: number, localY: number): void;
}
export function chartHandles(spec: ChartSpec, w: number, h: number): ChartHandle[] {
    const p = plotRect(spec, w, h);
    const out: ChartHandle[] = [];
    if (spec.type === "bar" || spec.type === "line" || spec.type === "area") {
        const lay = comboLayout(spec, p), { area, gap, barSeries, bw, eff, rng } = lay;
        spec.series.filter(s => s.values.length).forEach((s, si) => {
            const r = rng(s);
            if (eff(s) === "bar") {
                const bi = barSeries.indexOf(s);
                s.values.forEach((v, i) => {
                    const x = area.x + i * gap + gap * 0.15 + bi * bw + bw / 2, y = area.y + area.h - barLen(r, v, area.h);
                    out.push({ key: `b${si}_${i}`, x, y, set: (lx, ly) => { const f = clamp((area.y + area.h - ly) / area.h, 0, 4); s.values[i] = Math.round(r.log ? rangeValue(r, f) : f * r.max); } });
                });
            }
            else
                s.values.forEach((v, i) => {
                    const x = area.x + i * gap + gap / 2, y = area.y + area.h - rangeFrac(r, v) * area.h;
                    out.push({ key: `l${si}_${i}`, x, y, set: (lx, ly) => { s.values[i] = Math.round(rangeValue(r, clamp((area.y + area.h - ly) / area.h, 0, 4)) * 10) / 10; } });
                });
        });
    }
    else if (spec.type === "barh") {
        const series = spec.series.filter(s => s.values.length);
        if (!series.length)
            return out;
        const max = Math.max(1, ...series.flatMap(s => s.values.map(v => Math.abs(v)))), axPad = 22, area = { x: p.x + axPad, y: p.y, w: p.w - axPad, h: p.h };
        const n = Math.max(spec.categories?.length ?? 0, ...series.map(s => s.values.length)), ns = series.length, gap = area.h / n, bh = gap * 0.7 / ns;
        series.forEach((s, si) => s.values.forEach((v, i) => {
            const y = area.y + i * gap + gap * 0.15 + si * bh + bh / 2, x = area.x + (Math.abs(v) / max) * area.w;
            out.push({ key: `bh${si}_${i}`, x, y, set: (lx) => { s.values[i] = Math.round(clamp((lx - area.x) / area.w, 0, 4) * max); } });
        }));
    }
    else if (spec.type === "scatter") {
        const pts = spec.points ?? [];
        if (!pts.length)
            return out;
        const area = { x: p.x + 4, y: p.y, w: p.w - 4, h: p.h - 14 };
        const xs = pts.map(q => q.x), ys = pts.map(q => q.y), xmin = Math.min(0, ...xs), xmax = Math.max(1, ...xs), ymin = Math.min(0, ...ys), ymax = Math.max(1, ...ys);
        const sx = area.w / ((xmax - xmin) || 1), sy = area.h / ((ymax - ymin) || 1);
        pts.forEach((q, i) => {
            const x = area.x + (q.x - xmin) * sx, y = area.y + area.h - (q.y - ymin) * sy;
            out.push({ key: "s" + i, x, y, set: (lx, ly) => { q.x = Math.round((clamp(lx - area.x, 0, area.w) / sx + xmin) * 10) / 10; q.y = Math.round(((area.y + area.h - clamp(ly - area.y, 0, area.h)) / sy + ymin) * 10) / 10; } });
        });
    }
    else if (spec.type === "quadrant") {
        const m = 16, area = { x: p.x + m, y: p.y, w: p.w - m, h: p.h - m };
        (spec.points ?? []).forEach((q, i) => {
            const x = area.x + clamp(q.x, 0, 1) * area.w, y = area.y + area.h - clamp(q.y, 0, 1) * area.h;
            out.push({ key: "q" + i, x, y, set: (lx, ly) => { q.x = Math.round(clamp((lx - area.x) / area.w, 0, 1) * 100) / 100; q.y = Math.round(clamp((area.y + area.h - ly) / area.h, 0, 1) * 100) / 100; } });
        });
    }
    else if (spec.type === "radar") {
        const n = Math.max(spec.categories?.length ?? 0, ...spec.series.map(s => s.values.length));
        if (n < 3)
            return out;
        const cx = p.x + p.w / 2, cy = p.y + p.h / 2 + 2, R = Math.min(p.w, p.h) / 2 - 16, max = Math.max(1, ...spec.series.flatMap(s => s.values.map(v => Math.abs(v))));
        spec.series.forEach((s, si) => s.values.forEach((v, i) => {
            const a = -Math.PI / 2 + (i / n) * Math.PI * 2, rr = R * (Math.abs(v) / max);
            out.push({ key: `r${si}_${i}`, x: cx + rr * Math.cos(a), y: cy + rr * Math.sin(a), set: (lx, ly) => { const d = Math.hypot(lx - cx, ly - cy); s.values[i] = Math.round(clamp(d / R, 0, 1) * max); } });
        }));
    }
    else if (spec.type === "gauge") {
        const s0 = spec.series[0];
        if (!s0?.values.length)
            return out;
        const max = spec.max || 100, frac = clamp(s0.values[0] / max, 0, 1);
        const cx = p.x + p.w / 2, cy = p.y + p.h * 0.72, R = Math.min(p.w / 2, p.h * 0.72) - 6, na = Math.PI + frac * Math.PI;
        out.push({ key: "g", x: cx + R * 0.88 * Math.cos(na), y: cy + R * 0.88 * Math.sin(na), set: (lx, ly) => { let ang = Math.atan2(ly - cy, lx - cx); if (ang < 0)
                ang += Math.PI * 2; const f = clamp((ang - Math.PI) / Math.PI, 0, 1); s0.values[0] = Math.round(f * max); } });
    }
    else if (spec.type === "voronoi") {
        const area = { x: p.x + 4, y: p.y + 4, w: p.w - 8, h: p.h - 8 };
        (spec.points ?? []).forEach((q, i) => {
            const x = area.x + clamp(q.x, 0, 1) * area.w, y = area.y + area.h - clamp(q.y, 0, 1) * area.h;
            out.push({ key: "v" + i, x, y, set: (lx, ly) => { q.x = Math.round(clamp((lx - area.x) / area.w, 0, 1) * 100) / 100; q.y = Math.round(clamp((area.y + area.h - ly) / area.h, 0, 1) * 100) / 100; } });
        });
    }
    else if (spec.type === "pie" || spec.type === "donut") {
        const vals = spec.series[0]?.values ?? [], total = vals.reduce((s, v) => s + Math.abs(v), 0);
        if (vals.length < 2 || total <= 0)
            return out;
        const cx = p.x + p.w / 2, cy = p.y + p.h / 2, r = Math.min(p.w, p.h) / 2 - 2, start = -Math.PI / 2;
        let cumBefore = 0;
        for (let i = 0; i < vals.length - 1; i++) {
            cumBefore += Math.abs(vals[i]);
            const a = start + (cumBefore / total) * 2 * Math.PI, pairSum = Math.abs(vals[i]) + Math.abs(vals[i + 1]), before = cumBefore - Math.abs(vals[i]);
            out.push({ key: "pie" + i, x: cx + r * 0.9 * Math.cos(a), y: cy + r * 0.9 * Math.sin(a), set: (lx, ly) => { let th = Math.atan2(ly - cy, lx - cx) - start; th = ((th % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI); const vi = clamp(th / (2 * Math.PI) * total - before, 0, pairSum); vals[i] = Math.round(vi); vals[i + 1] = Math.round(pairSum - vi); } });
        }
    }
    return out;
}
export interface ChartInsertSlot {
    x: number;
    y: number;
    index: number;
}
function catCount(spec: ChartSpec): number { return Math.max(spec.categories?.length ?? 0, ...spec.series.map(s => s.values.length), 0); }
export function chartInsertSlots(spec: ChartSpec, w: number, h: number): ChartInsertSlot[] {
    const n = catCount(spec);
    if (!n)
        return [];
    const p = plotRect(spec, w, h), axPad = 22, out: ChartInsertSlot[] = [];
    if (spec.type === "bar") {
        const area = { x: p.x, y: p.y, w: p.w, h: p.h - axPad }, gap = area.w / n;
        for (let k = 0; k <= n; k++)
            out.push({ x: area.x + k * gap, y: area.y + area.h + 9, index: k });
    }
    else if (spec.type === "barh") {
        const area = { x: p.x + axPad, y: p.y, w: p.w - axPad, h: p.h }, gap = area.h / n;
        for (let k = 0; k <= n; k++)
            out.push({ x: area.x - 9, y: area.y + k * gap, index: k });
    }
    else if (spec.type === "pie" || spec.type === "donut") {
        const vals = spec.series[0]?.values ?? [], total = vals.reduce((s, v) => s + Math.abs(v), 0) || 1;
        const cx = p.x + p.w / 2, cy = p.y + p.h / 2, r = Math.min(p.w, p.h) / 2 - 2, start = -Math.PI / 2;
        let cum = 0;
        for (let i = 0; i < vals.length; i++) {
            const a = start + (cum / total) * 2 * Math.PI;
            out.push({ x: cx + (r + 10) * Math.cos(a), y: cy + (r + 10) * Math.sin(a), index: i });
            cum += Math.abs(vals[i]);
        }
    }
    return out;
}
export function chartDeleteSlots(spec: ChartSpec, w: number, h: number): ChartInsertSlot[] {
    const n = catCount(spec);
    if (n < 2)
        return [];
    const p = plotRect(spec, w, h), axPad = 22, out: ChartInsertSlot[] = [];
    if (spec.type === "bar") {
        const area = { x: p.x, y: p.y, w: p.w, h: p.h - axPad }, gap = area.w / n;
        for (let i = 0; i < n; i++)
            out.push({ x: area.x + i * gap + gap / 2, y: area.y - 4, index: i });
    }
    else if (spec.type === "barh") {
        const area = { x: p.x + axPad, y: p.y, w: p.w - axPad, h: p.h }, gap = area.h / n;
        for (let i = 0; i < n; i++)
            out.push({ x: area.x + area.w + 8, y: area.y + i * gap + gap / 2, index: i });
    }
    else if (spec.type === "pie" || spec.type === "donut") {
        const vals = spec.series[0]?.values ?? [], total = vals.reduce((s, v) => s + Math.abs(v), 0) || 1, cx = p.x + p.w / 2, cy = p.y + p.h / 2, r = Math.min(p.w, p.h) / 2 - 2;
        let a0 = -Math.PI / 2;
        vals.forEach((v, i) => { const ang = (Math.abs(v) / total) * 2 * Math.PI, mid = a0 + ang / 2; out.push({ x: cx + (r + 8) * Math.cos(mid), y: cy + (r + 8) * Math.sin(mid), index: i }); a0 += ang; });
    }
    return out;
}
type Prim = {
    t: "rect";
    x: number;
    y: number;
    w: number;
    h: number;
    fill?: string;
    stroke?: string;
    sw?: number;
    rx?: number;
    opacity?: number;
    dash?: number[];
} | {
    t: "poly";
    pts: number[];
    fill?: string;
    stroke?: string;
    sw?: number;
    dash?: number[];
    closed?: boolean;
    opacity?: number;
} | {
    t: "circle";
    x: number;
    y: number;
    r: number;
    fill?: string;
    stroke?: string;
    sw?: number;
    opacity?: number;
} | {
    t: "wedge";
    cx: number;
    cy: number;
    r: number;
    a0: number;
    a1: number;
    fill?: string;
    stroke?: string;
    sw?: number;
} | {
    t: "text";
    x: number;
    y: number;
    s: string;
    size?: number;
    fill?: string;
    align?: "left" | "center" | "right";
    w?: number;
    h?: number;
    bold?: boolean;
    rot?: number;
    font?: string;
    italic?: boolean;
    role?: "title" | "label" | "cat" | "legend" | "xtitle" | "ytitle";
    runs?: TextRun[];
};
type Plot = {
    x: number;
    y: number;
    w: number;
    h: number;
};
export function chartSvg(spec: ChartSpec, w: number, h: number): string {
    const e = (s: unknown) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
    const st = (pr: {
        stroke?: string;
        sw?: number;
    }) => pr.stroke ? `stroke="${pr.stroke}" stroke-width="${pr.sw ?? 1}"` : "";
    const op = (o?: number) => o != null ? `opacity="${o}"` : "";
    const out: string[] = [];
    for (const pr of chartPrims(spec, w, h)) {
        if (pr.t === "rect")
            out.push(`<rect x="${pr.x}" y="${pr.y}" width="${pr.w}" height="${pr.h}" ${pr.rx ? `rx="${pr.rx}"` : ""} fill="${pr.fill ?? "none"}" ${st(pr)} ${pr.dash ? `stroke-dasharray="${pr.dash.join(" ")}"` : ""} ${op(pr.opacity)}/>`);
        else if (pr.t === "poly") {
            const ps: string[] = [];
            for (let i = 0; i + 1 < pr.pts.length; i += 2)
                ps.push(`${pr.pts[i].toFixed(1)},${pr.pts[i + 1].toFixed(1)}`);
            out.push(`<${pr.closed ? "polygon" : "polyline"} points="${ps.join(" ")}" fill="${pr.fill ?? "none"}" ${st(pr)} ${pr.dash ? `stroke-dasharray="${pr.dash.join(" ")}"` : ""} ${op(pr.opacity)} stroke-linejoin="round"/>`);
        }
        else if (pr.t === "circle")
            out.push(`<circle cx="${pr.x}" cy="${pr.y}" r="${pr.r}" fill="${pr.fill ?? "none"}" ${st(pr)} ${op(pr.opacity)}/>`);
        else if (pr.t === "wedge")
            out.push(`<path d="${wedgePath(pr.cx, pr.cy, pr.r, pr.a0, pr.a1)}" fill="${pr.fill ?? "none"}" ${st(pr)}/>`);
        else {
            const anchor = pr.align === "center" ? "middle" : pr.align === "right" ? "end" : "start";
            const tx = pr.align === "center" ? pr.x + (pr.w ?? 0) / 2 : pr.align === "right" ? pr.x + (pr.w ?? 0) : pr.x;
            const rot = pr.rot ? ` transform="rotate(${pr.rot} ${(pr.x + (pr.w ?? 0) / 2).toFixed(1)} ${(pr.y + (pr.size ?? 10) / 2).toFixed(1)})"` : "";
            const ff = pr.font ? ` font-family="${e(pr.font)}"` : "";
            const it = pr.italic ? ` font-style="italic"` : "";
            const body = pr.runs && pr.runs.length ? pr.runs.map(r => `<tspan${r.b ? " font-weight=\"bold\"" : ""}${r.i ? " font-style=\"italic\"" : ""}${r.c ? ` fill="${r.c}"` : ""}>${e(r.t)}</tspan>`).join("") : e(pr.s);
            out.push(`<text x="${tx.toFixed(1)}" y="${(pr.y + (pr.size ?? 10) * 0.9).toFixed(1)}" font-size="${pr.size ?? 10}" fill="${pr.fill ?? "#000"}" text-anchor="${anchor}"${rot}${ff}${it} ${pr.bold ? "font-weight=\"bold\"" : ""}>${body}</text>`);
        }
    }
    return out.join("");
}
function wedgePath(cx: number, cy: number, r: number, a0: number, a1: number): string {
    const x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0), x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
    const large = (a1 - a0) > Math.PI ? 1 : 0;
    return `M ${cx.toFixed(1)} ${cy.toFixed(1)} L ${x0.toFixed(1)} ${y0.toFixed(1)} A ${r.toFixed(1)} ${r.toFixed(1)} 0 ${large} 1 ${x1.toFixed(1)} ${y1.toFixed(1)} Z`;
}
export function chartHasValueAxis(t: ChartType): boolean { return t === "bar" || t === "barh" || t === "line" || t === "area"; }
export function chartSupportsLegend(spec: ChartSpec): boolean { return legendEntries(spec).length > 0; }
export function chartGridOn(spec: ChartSpec): boolean { return spec.grid ?? chartHasValueAxis(spec.type); }
export function chartLegendOn(spec: ChartSpec): boolean { return spec.legend ?? (legendEntries(spec).length > 1); }
function legendEntries(spec: ChartSpec): {
    label: string;
    color: string;
}[] {
    if (spec.type === "pie" || spec.type === "donut")
        return (spec.categories ?? []).map((c, i) => ({ label: c, color: chartColor(spec, i) }));
    if (["bar", "barh", "line", "area", "radar", "boxplot"].includes(spec.type))
        return spec.series.filter(s => s.values.length).map((s, i) => ({ label: s.name ?? `Serie ${i + 1}`, color: chartColor(spec, i) }));
    return [];
}
const CW = 0.58;
const legSize = (spec: ChartSpec) => spec.legendStyle?.size ?? 9;
const tickSize = (spec: ChartSpec) => spec.labelStyle?.size ?? 8;
const catSize = (spec: ChartSpec) => spec.catStyle?.size ?? 10;
const xTitleSize = (spec: ChartSpec) => spec.xTitleStyle?.size ?? 10;
const yTitleSize = (spec: ChartSpec) => spec.yTitleStyle?.size ?? 10;
interface LegendBox {
    label: string;
    color: string;
    x: number;
    y: number;
    w: number;
    sq: number;
    sz: number;
}
function legendLayout(spec: ChartSpec, x: number, y: number, maxW: number): {
    items: LegendBox[];
    w: number;
    h: number;
} {
    const sz = legSize(spec), sq = Math.max(8, Math.round(sz * 0.85)), rowH = sz + 6;
    let cx = x, cy = y, w = 0;
    const items = legendEntries(spec).map(it => {
        const iw = sq + 4 + it.label.length * sz * CW;
        if (cx > x && cx - x + iw > maxW) {
            cx = x;
            cy += rowH;
        }
        const b = { ...it, x: cx, y: cy, w: iw, sq, sz };
        cx += iw + 8;
        w = Math.max(w, cx - x - 8);
        return b;
    });
    return { items, w: Math.min(maxW, w), h: items.length ? cy - y + rowH : 0 };
}
function legendRow(out: Prim[], spec: ChartSpec, x: number, y: number, maxW: number, box?: boolean): void {
    const lay = legendLayout(spec, x, y, maxW);
    if (box) {
        out.push({ t: "rect", x: x - 4, y: y - 4, w: lay.w + 6, h: lay.h + 2, stroke: "#cfd8dc", sw: 1, rx: 4 });
        out.push({ t: "text", x: x - 2, y: y - 13, s: "Leyenda", size: 8, fill: LABEL, bold: true });
    }
    for (const b of lay.items) {
        out.push({ t: "rect", x: b.x, y: b.y, w: b.sq, h: b.sq, fill: b.color, rx: 2 });
        out.push({ t: "text", x: b.x + b.sq + 2, y: b.y + (b.sq - b.sz) / 2 - 0.5, s: b.label, size: 9, fill: LABEL, role: "legend" });
    }
}
function niceTicks(min: number, max: number, count: number): number[] {
    if (max <= min)
        max = min + 1;
    const span = max - min, step0 = span / count, mag = Math.pow(10, Math.floor(Math.log10(step0) || 0)), norm = step0 / mag;
    const step = (norm >= 5 ? 5 : norm >= 2 ? 2 : 1) * mag, out: number[] = [];
    for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step)
        out.push(Math.round(v * 1000) / 1000);
    return out;
}
const fmtTick = (v: number) => {
    const a = Math.abs(v), r = (x: number) => String(Math.round(x * 100) / 100);
    return a >= 1000000000 ? r(v / 1000000000) + "G" : a >= 1000000 ? r(v / 1000000) + "M" : a >= 1000 ? r(v / 1000) + "k" : r(v);
};
function titleGap(spec: ChartSpec): number { return spec.title ? (spec.titleStyle?.size ?? 13) + 15 : 8; }
export function plotRect(spec: ChartSpec, w: number, h: number): Plot {
    const hw = w / 2, hh = h / 2;
    let top = -hh + titleGap(spec), left = -hw + 8, bottom = hh - 8, right = hw - 8;
    if (chartLegendOn(spec)) {
        const lh = legendLayout(spec, 0, 0, w - 16).h;
        top += spec.legendBox ? lh + 11 : lh;
    }
    const g = chartGridOn(spec), comboFam = spec.type === "bar" || spec.type === "line" || spec.type === "area";
    if (spec.showValues && comboFam)
        top += tickSize(spec) + 7;
    if (spec.showValues && spec.type === "barh")
        right -= 22;
    const rg = comboFam ? comboRanges(spec) : null;
    if (g && rg)
        left += tickColW(spec, rg.L) + 2;
    if (g && rg)
        top += Math.max(0, tickSize(spec) / 2 + 1 - 5);
    if (spec.yTitle && comboFam)
        left += yTitleSize(spec) + 2;
    if (g && rg?.R)
        right -= tickColW(spec, rg.R) + 2;
    if (g && spec.type === "barh")
        bottom -= 12;
    if (spec.xTitle)
        bottom -= xTitleSize(spec) + 2;
    return { x: left, y: top, w: right - left, h: bottom - top };
}
export function effectiveChartSpec(spec: ChartSpec, box: {
    fill?: string;
    stroke?: string;
    borderStyle?: string;
    borderWidth?: number;
    borderPattern?: string;
}): ChartSpec {
    const dash = dashArrayFor(box.borderStyle, box.borderPattern);
    return { ...spec, bg: box.fill === "none" ? "none" : (box.fill ?? spec.bg ?? "#ffffff"), frame: box.borderStyle === "none" ? false : (spec.frame !== false), frameColor: box.stroke ?? spec.frameColor, frameWidth: box.borderWidth ?? spec.frameWidth, frameDash: dash.length ? dash : undefined,
    };
}
export function chartPrims(spec: ChartSpec, w: number, h: number): Prim[] {
    const hw = w / 2, hh = h / 2;
    const out: Prim[] = [];
    if (spec.bg !== "none")
        out.push({ t: "rect", x: -hw, y: -hh, w, h, fill: spec.bg || "#ffffff", rx: 6 });
    if (spec.frame !== false)
        out.push({ t: "rect", x: -hw, y: -hh, w, h, stroke: spec.frameColor || "#cfd8dc", sw: spec.frameWidth ?? 1, dash: spec.frameDash, rx: 6 });
    if (spec.title)
        out.push({ t: "text", x: -hw + (spec.titleDx ?? 0), y: -hh + 4 + (spec.titleDy ?? 0), s: spec.title, size: 13, fill: "#37474f", align: "center", w, bold: true, role: "title", runs: spec.titleRuns });
    if (chartLegendOn(spec))
        legendRow(out, spec, -hw + 8, -hh + titleGap(spec) + (spec.legendBox ? 10 : 0), w - 16, spec.legendBox);
    const p = plotRect(spec, w, h);
    if (spec.yTitle) {
        const sz = 10, ysz = yTitleSize(spec);
        out.push({ t: "text", x: -hw + 4 + ysz / 2 - p.h / 2, y: p.y + p.h / 2 - sz / 2, s: spec.yTitle, size: sz, fill: LABEL, align: "center", w: p.h, bold: true, rot: -90, role: "ytitle" });
    }
    if (spec.xTitle)
        out.push({ t: "text", x: p.x, y: hh - xTitleSize(spec) - 1, s: spec.xTitle, size: 10, fill: LABEL, align: "center", w: p.w, bold: true, role: "xtitle" });
    switch (spec.type) {
        case "pie":
        case "donut":
            pie(out, spec, p);
            break;
        case "bar":
        case "line":
        case "area":
            combo(out, spec, p);
            break;
        case "scatter":
            scatter(out, spec, p);
            break;
        case "quadrant":
            quadrant(out, spec, p);
            break;
        case "radar":
            radar(out, spec, p);
            break;
        case "gauge":
            gauge(out, spec, p);
            break;
        case "voronoi":
            voronoi(out, spec, p);
            break;
        case "sankey":
            sankey(out, spec, p);
            break;
        case "boxplot":
            boxplot(out, spec, p);
            break;
        case "heatmap":
            heatmap(out, spec, p);
            break;
        case "treemap":
            treemap(out, spec, p);
            break;
        case "barh":
            bars(out, spec, p, true);
            break;
        default: break;
    }
    for (const pr of out)
        if (pr.t === "text") {
            const st = pr.role === "title" ? spec.titleStyle
                : pr.role === "cat" ? spec.catStyle
                    : pr.role === "legend" ? spec.legendStyle
                        : pr.role === "xtitle" ? spec.xTitleStyle
                            : pr.role === "ytitle" ? spec.yTitleStyle
                                : pr.fill === LABEL ? spec.labelStyle : undefined;
            applyTextStyle(pr, st);
        }
    return out;
}
function applyTextStyle(pr: {
    x?: number;
    size?: number;
    fill?: string;
    bold?: boolean;
    italic?: boolean;
    font?: string;
    rot?: number;
    align?: "left" | "center" | "right";
    w?: number;
    h?: number;
}, st?: TextStyle): void {
    if (!st)
        return;
    if (st.color)
        pr.fill = st.color;
    if (st.size != null)
        pr.size = st.size;
    if (st.bold != null)
        pr.bold = st.bold;
    if (st.italic != null)
        pr.italic = st.italic;
    if (st.font)
        pr.font = st.font;
    if (st.rotation != null)
        pr.rot = st.rotation;
    if (st.align)
        pr.align = st.align;
    if (st.boxW != null && pr.x != null) {
        if (pr.align === "center")
            pr.x = pr.x + (pr.w ?? 0) / 2 - st.boxW / 2;
        pr.w = st.boxW;
    }
    if (st.boxH != null)
        pr.h = st.boxH;
}
function bars(out: Prim[], spec: ChartSpec, p: Plot, horiz: boolean): void {
    const cats = spec.categories ?? [], series = spec.series.length ? spec.series : [{ values: [] }];
    const n = Math.max(cats.length, ...series.map(s => s.values.length));
    if (!n)
        return;
    const max = Math.max(1, ...series.flatMap(s => s.values.map(v => Math.abs(v))));
    const ns = series.length, axPad = 22;
    if (horiz) {
        const area = { x: p.x + axPad, y: p.y, w: p.w - axPad, h: p.h };
        if (chartGridOn(spec))
            for (const tv of niceTicks(0, max, 4)) {
                const xx = area.x + (tv / max) * area.w;
                out.push({ t: "poly", pts: [xx, area.y, xx, area.y + area.h], stroke: GRID, sw: 1 });
                out.push({ t: "text", x: xx - 14, y: area.y + area.h + 3, s: fmtTick(tv), w: 28, align: "center", size: 8, fill: LABEL });
            }
        out.push({ t: "poly", pts: [area.x, p.y, area.x, p.y + p.h], stroke: AXIS, sw: 1 });
        const gap = area.h / n, bh = gap * 0.7 / ns;
        for (let i = 0; i < n; i++) {
            for (let s = 0; s < ns; s++) {
                const v = series[s].values[i] ?? 0, len = (Math.abs(v) / max) * area.w, y = area.y + i * gap + gap * 0.15 + s * bh;
                out.push({ t: "rect", x: area.x, y, w: len, h: bh - 1, fill: chartColor(spec, s), rx: 2 });
                if (spec.showValues && ns === 1)
                    out.push({ t: "text", x: area.x + len + 3, y: y + bh / 2 - 6, s: String(v), fill: LABEL });
            }
            if (cats[i])
                out.push({ t: "text", x: p.x, y: area.y + i * gap + gap / 2 - 6, s: cats[i], w: axPad - 3, align: "right", fill: LABEL, role: "cat" });
        }
    }
    else {
        const area = { x: p.x, y: p.y, w: p.w, h: p.h - axPad };
        if (chartGridOn(spec))
            for (const tv of niceTicks(0, max, 4)) {
                const yy = area.y + area.h - (tv / max) * area.h;
                out.push({ t: "poly", pts: [area.x, yy, area.x + area.w, yy], stroke: GRID, sw: 1 });
                out.push({ t: "text", x: area.x - 24, y: yy - 5, s: fmtTick(tv), w: 22, align: "right", size: 8, fill: LABEL });
            }
        out.push({ t: "poly", pts: [p.x, area.y + area.h, p.x + p.w, area.y + area.h], stroke: AXIS, sw: 1 });
        const gap = area.w / n, bw = gap * 0.7 / ns;
        for (let i = 0; i < n; i++) {
            for (let s = 0; s < ns; s++) {
                const v = series[s].values[i] ?? 0, len = (Math.abs(v) / max) * area.h, x = area.x + i * gap + gap * 0.15 + s * bw;
                out.push({ t: "rect", x, y: area.y + area.h - len, w: bw - 1, h: len, fill: chartColor(spec, s), rx: 2 });
                if (spec.showValues && ns === 1)
                    out.push({ t: "text", x: x - gap * 0.15, y: area.y + area.h - len - 12, s: String(v), w: bw + gap * 0.3, align: "center", fill: LABEL });
            }
            if (cats[i])
                out.push({ t: "text", x: area.x + i * gap, y: area.y + area.h + 3, s: cats[i], w: gap, align: "center", fill: LABEL, role: "cat" });
        }
    }
}
function pie(out: Prim[], spec: ChartSpec, p: Plot): void {
    const vals = spec.series[0]?.values ?? [], total = vals.reduce((s, v) => s + Math.abs(v), 0) || 1;
    const cx = p.x + p.w / 2, cy = p.y + p.h / 2, r = Math.min(p.w, p.h) / 2 - 2;
    let a0 = -Math.PI / 2;
    vals.forEach((v, i) => {
        const ang = (Math.abs(v) / total) * Math.PI * 2;
        out.push({ t: "wedge", cx, cy, r, a0, a1: a0 + ang, fill: chartColor(spec, i), stroke: "#fff", sw: 1.5 });
        if (spec.showValues && ang > 0.25) {
            const mid = a0 + ang / 2, lr = spec.type === "donut" ? r * 0.78 : r * 0.62;
            const lbl = spec.pieRaw ? String(Math.round(Math.abs(v) * 100) / 100) : Math.round(Math.abs(v) / total * 100) + "%";
            out.push({ t: "text", x: cx + Math.cos(mid) * lr - 16, y: cy + Math.sin(mid) * lr - 6, s: lbl, w: 32, align: "center", fill: "#fff", bold: true });
        }
        a0 += ang;
    });
    if (spec.type === "donut")
        out.push({ t: "circle", x: cx, y: cy, r: r * 0.55, fill: "#fff" });
}
type ComboRange = {
    min: number;
    max: number;
    span: number;
    log?: boolean;
};
export interface ComboLayout {
    area: Plot;
    n: number;
    gap: number;
    barSeries: ChartSeries[];
    bw: number;
    eff: (s: ChartSeries) => "bar" | "line" | "area";
    rng: (s: ChartSeries) => ComboRange;
    L: ComboRange;
    R: ComboRange | null;
}
function comboRanges(spec: ChartSpec): {
    series: ChartSeries[];
    eff: (s: ChartSeries) => "bar" | "line" | "area";
    L: ComboRange;
    R: ComboRange | null;
} {
    const series = spec.series.filter(s => s.values.length);
    const eff = (s: ChartSeries) => s.kind ?? (spec.type === "line" ? "line" : spec.type === "area" ? "area" : "bar");
    const rangeOf = (arr: ChartSeries[]): ComboRange => { if (!arr.length)
        return { min: 0, max: 1, span: 1 }; const all = arr.flatMap(s => s.values); const hasLA = arr.some(s => eff(s) !== "bar"); const min = hasLA ? Math.min(0, ...all) : 0, max = Math.max(1, ...all.map(v => Math.abs(v))); return { min, max, span: (max - min) || 1 }; };
    const logOf = (arr: ChartSeries[]): ComboRange => {
        const pos = arr.flatMap(s => s.values).filter(v => v > 0);
        let min = spec.yMin && spec.yMin > 0 ? spec.yMin : Math.pow(10, Math.floor(Math.log10(pos.length ? Math.min(...pos) : 1)));
        let max = spec.yMax && spec.yMax > 0 ? spec.yMax : Math.pow(10, Math.ceil(Math.log10(pos.length ? Math.max(...pos) : 10)));
        if (!(max > min))
            max = min * 10;
        return { min, max, span: max - min, log: true };
    };
    const leftS = series.filter(s => s.axis !== "right"), rightS = series.filter(s => s.axis === "right");
    const fix = (r: ComboRange): ComboRange => { const min = spec.yMin ?? r.min, max = spec.yMax ?? r.max; return { min, max, span: (max - min) || 1 }; };
    const L = spec.yLog ? logOf(leftS.length ? leftS : series) : fix(rangeOf(leftS.length ? leftS : series)), R = rightS.length ? rangeOf(rightS) : null;
    return { series, eff, L, R };
}
export function rangeFrac(r: ComboRange, v: number): number {
    if (!r.log)
        return (v - r.min) / r.span;
    const lo = Math.log10(r.min), hi = Math.log10(r.max);
    return (Math.log10(Math.max(v, r.min)) - lo) / ((hi - lo) || 1);
}
function rangeValue(r: ComboRange, f: number): number { return r.log ? Math.pow(10, Math.log10(r.min) + f * (Math.log10(r.max) - Math.log10(r.min))) : r.min + f * r.span; }
function rangeTicks(r: ComboRange): number[] {
    if (!r.log)
        return niceTicks(r.min, r.max, 4);
    const out: number[] = [];
    for (let e = Math.ceil(Math.log10(r.min) - 1e-9); e <= Math.floor(Math.log10(r.max) + 1e-9); e++)
        out.push(Math.pow(10, e));
    return out;
}
function tickColW(spec: ChartSpec, r: ComboRange): number {
    const chars = Math.max(1, ...rangeTicks(r).map(t => fmtTick(t).length));
    return Math.max(22, chars * tickSize(spec) * CW + 4);
}
export function comboLayout(spec: ChartSpec, p: Plot): ComboLayout {
    const cats = spec.categories ?? [], { series, eff, L, R } = comboRanges(spec);
    const n = Math.max(cats.length, ...series.map(s => s.values.length), 0) || 1;
    const axPad = Math.max(22, catSize(spec) + 12), area = { x: p.x, y: p.y, w: p.w, h: p.h - axPad };
    const barSeries = series.filter(s => eff(s) === "bar"), bw = barSeries.length ? (area.w / n) * 0.7 / barSeries.length : 0;
    const rng = (s: ChartSeries) => (s.axis === "right" && R) ? R : L;
    return { area, n, gap: area.w / n, barSeries, bw, eff, rng, L, R };
}
function barLen(r: ComboRange, v: number, h: number): number { return (r.log ? rangeFrac(r, Math.abs(v)) : Math.abs(v) / (r.max || 1)) * h; }
function combo(out: Prim[], spec: ChartSpec, p: Plot): void {
    const series = spec.series.filter(s => s.values.length), cats = spec.categories ?? [];
    const lay = comboLayout(spec, p), { area, n, gap, barSeries, bw, eff, rng, L, R } = lay;
    const grid = chartGridOn(spec);
    const tsz = tickSize(spec), tl = tickColW(spec, L), tr = R ? tickColW(spec, R) : 0;
    if (grid)
        for (const tv of rangeTicks(L)) {
            const yy = area.y + area.h - rangeFrac(L, tv) * area.h;
            out.push({ t: "poly", pts: [area.x, yy, area.x + area.w, yy], stroke: GRID, sw: 1 });
            out.push({ t: "text", x: area.x - tl - 2, y: yy - tsz / 2 - 1, s: fmtTick(tv), w: tl, align: "right", size: 8, fill: LABEL });
        }
    if (grid && R)
        for (const tv of rangeTicks(R)) {
            const yy = area.y + area.h - rangeFrac(R, tv) * area.h;
            out.push({ t: "text", x: area.x + area.w + 2, y: yy - tsz / 2 - 1, s: fmtTick(tv), w: tr, align: "left", size: 8, fill: LABEL });
        }
    out.push({ t: "poly", pts: [area.x, area.y + area.h, area.x + area.w, area.y + area.h], stroke: AXIS, sw: 1 });
    const single = series.length === 1;
    barSeries.forEach((s, bi) => { const r = rng(s), col = chartColor(spec, spec.series.indexOf(s)); s.values.forEach((v, i) => { const len = barLen(r, v, area.h), x = area.x + i * gap + gap * 0.15 + bi * bw; out.push({ t: "rect", x, y: area.y + area.h - len, w: bw - 1, h: len, fill: col, rx: 2 }); if (spec.showValues && single)
        out.push({ t: "text", x: x - gap * 0.15, y: area.y + area.h - len - 12, s: String(v), w: bw + gap * 0.3, align: "center", fill: LABEL }); }); });
    series.forEach(s => { const k = eff(s); if (k === "bar")
        return; const r = rng(s), col = chartColor(spec, spec.series.indexOf(s)), pts: number[] = []; s.values.forEach((v, i) => { pts.push(area.x + i * gap + gap / 2, area.y + area.h - rangeFrac(r, v) * area.h); }); if (k === "area")
        out.push({ t: "poly", pts: [pts[0], area.y + area.h, ...pts, pts[pts.length - 2], area.y + area.h], closed: true, fill: col, opacity: 0.18 }); out.push({ t: "poly", pts, stroke: col, sw: 2 }); for (let i = 0; i < pts.length; i += 2)
        out.push({ t: "circle", x: pts[i], y: pts[i + 1], r: 2.5, fill: col }); if (spec.showValues && single)
        s.values.forEach((v, i) => out.push({ t: "text", x: area.x + i * gap, y: pts[i * 2 + 1] - 12, s: String(v), w: gap, align: "center", fill: LABEL })); });
    for (let i = 0; i < n; i++)
        if (cats[i])
            out.push({ t: "text", x: area.x + i * gap, y: area.y + area.h + 3, s: cats[i], w: gap, align: "center", fill: LABEL, role: "cat" });
}
function scatter(out: Prim[], spec: ChartSpec, p: Plot): void {
    const pts = spec.points ?? [], area = { x: p.x + 4, y: p.y, w: p.w - 4, h: p.h - 14 };
    out.push({ t: "poly", pts: [area.x, area.y, area.x, area.y + area.h, area.x + area.w, area.y + area.h], stroke: AXIS, sw: 1 });
    const xs = pts.map(q => q.x), ys = pts.map(q => q.y), xmin = Math.min(0, ...xs), xmax = Math.max(1, ...xs), ymin = Math.min(0, ...ys), ymax = Math.max(1, ...ys);
    const sx = area.w / ((xmax - xmin) || 1), sy = area.h / ((ymax - ymin) || 1);
    for (const q of pts)
        out.push({ t: "circle", x: area.x + (q.x - xmin) * sx, y: area.y + area.h - (q.y - ymin) * sy, r: 4, fill: chartColor(spec, 0), opacity: 0.85 });
}
export function quadrantArea(spec: ChartSpec, w: number, h: number): Plot {
    const p = plotRect(spec, w, h), m = 16;
    return { x: p.x + m, y: p.y, w: p.w - m, h: p.h - m };
}
export interface ChartTextBox {
    key: string;
    x: number;
    y: number;
    w: number;
    h: number;
    text: string;
}
export function chartTexts(spec: ChartSpec, w: number, h: number): ChartTextBox[] {
    const hw = w / 2, hh = h / 2, out: ChartTextBox[] = [];
    if (spec.title) {
        const sz = spec.titleStyle?.size ?? 13, tw = Math.max(40, spec.title.length * sz * 0.6);
        out.push({ key: "title", x: -tw / 2 + (spec.titleDx ?? 0), y: -hh + 3 + (spec.titleDy ?? 0), w: tw, h: sz + 6, text: spec.title });
    }
    const p = plotRect(spec, w, h);
    if (spec.xTitle) {
        const xs = xTitleSize(spec), tw = Math.max(30, spec.xTitle.length * xs * 0.6);
        out.push({ key: "xtitle", x: p.x + p.w / 2 - tw / 2, y: hh - xs - 3, w: tw, h: xs + 4, text: spec.xTitle });
    }
    if (spec.yTitle)
        out.push({ key: "ytitle", x: -hw + 1, y: p.y, w: yTitleSize(spec) + 6, h: p.h, text: spec.yTitle });
    if (chartLegendOn(spec)) {
        legendLayout(spec, -hw + 8, -hh + titleGap(spec) + (spec.legendBox ? 10 : 0), w - 16).items.forEach((b, i) => out.push({ key: "leg" + i, x: b.x + b.sq, y: b.y - 3, w: b.label.length * b.sz * CW + 6, h: b.sz + 5, text: b.label }));
    }
    if (spec.type === "bar" || spec.type === "line" || spec.type === "area") {
        const lay = comboLayout(spec, p), cats = spec.categories ?? [];
        for (let i = 0; i < lay.n; i++)
            out.push({ key: "cat" + i, x: lay.area.x + i * lay.gap, y: lay.area.y + lay.area.h + 2, w: lay.gap, h: catSize(spec) + 5, text: cats[i] ?? "" });
    }
    if (spec.type === "barh") {
        const cats = spec.categories ?? [], series = spec.series.length ? spec.series : [{ values: [] }];
        const nn = Math.max(cats.length, ...series.map(s => s.values.length)), axPad = 22, gap = nn ? p.h / nn : p.h;
        for (let i = 0; i < nn; i++)
            out.push({ key: "cat" + i, x: p.x, y: p.y + i * gap + gap / 2 - 6, w: axPad - 3, h: catSize(spec) + 5, text: cats[i] ?? "" });
    }
    if (spec.type === "quadrant") {
        const A = quadrantArea(spec, w, h);
        (spec.points ?? []).forEach((pt, i) => {
            if (!pt.label)
                return;
            const px = A.x + clamp(pt.x, 0, 1) * A.w, py = A.y + A.h - clamp(pt.y, 0, 1) * A.h, sz = pt.style?.size ?? 9;
            out.push({ key: "p" + i, x: px + (pt.lx ?? 6) - 2, y: py + (pt.ly ?? -6) - 2, w: Math.max(20, pt.label.length * sz * 0.62), h: sz + 5, text: pt.label });
        });
    }
    for (const b of out) {
        const st = styleForKey(spec, b.key);
        if (!st)
            continue;
        const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
        if (st.boxW != null) {
            b.w = st.boxW;
            b.x = cx - st.boxW / 2;
        }
        if (st.boxH != null) {
            b.h = st.boxH;
            b.y = cy - st.boxH / 2;
        }
    }
    return out;
}
function styleForKey(spec: ChartSpec, key: string): TextStyle | undefined {
    if (key === "title")
        return spec.titleStyle;
    if (key === "xtitle")
        return spec.xTitleStyle;
    if (key === "ytitle")
        return spec.yTitleStyle;
    if (key.startsWith("cat"))
        return spec.catStyle;
    if (key.startsWith("leg"))
        return spec.legendStyle;
    if (key.startsWith("p"))
        return spec.points?.[+key.slice(1)]?.style;
    return undefined;
}
const TINTS = ["rgba(21,101,192,0.06)", "rgba(0,137,123,0.06)", "rgba(239,108,0,0.06)", "rgba(142,36,170,0.06)", "rgba(2,136,209,0.06)", "rgba(124,179,66,0.06)"];
function quadrant(out: Prim[], spec: ChartSpec, p: Plot): void {
    const m = 16, A = { x: p.x + m, y: p.y, w: p.w - m, h: p.h - m };
    const cols = Math.max(1, Math.min(8, spec.quadCols ?? 2)), rows = Math.max(1, Math.min(8, spec.quadRows ?? 2));
    const cw = A.w / cols, ch = A.h / rows;
    for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++)
            out.push({ t: "rect", x: A.x + c * cw, y: A.y + r * ch, w: cw, h: ch, fill: TINTS[(r * cols + c) % TINTS.length] });
    out.push({ t: "rect", x: A.x, y: A.y, w: A.w, h: A.h, stroke: AXIS, sw: 1 });
    for (let c = 1; c < cols; c++)
        out.push({ t: "poly", pts: [A.x + c * cw, A.y, A.x + c * cw, A.y + A.h], stroke: AXIS, sw: 1, dash: [3, 3] });
    for (let r = 1; r < rows; r++)
        out.push({ t: "poly", pts: [A.x, A.y + r * ch, A.x + A.w, A.y + r * ch], stroke: AXIS, sw: 1, dash: [3, 3] });
    const q = spec.quadrants ?? [];
    for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++) {
            const t = q[r * cols + c];
            if (t)
                out.push({ t: "text", x: A.x + c * cw, y: A.y + r * ch + 3, s: t, w: cw, align: "center", fill: LABEL, bold: true });
        }
    for (const pt of spec.points ?? []) {
        const x = A.x + clamp(pt.x, 0, 1) * A.w, y = A.y + A.h - clamp(pt.y, 0, 1) * A.h;
        out.push({ t: "circle", x, y, r: 4, fill: CHART_PALETTE[0] });
        if (pt.label) {
            const lp: Extract<Prim, {
                t: "text";
            }> = { t: "text", x: x + (pt.lx ?? 6), y: y + (pt.ly ?? -6), s: pt.label, size: 9, fill: "#37474f", runs: pt.labelRuns };
            applyTextStyle(lp, pt.style);
            out.push(lp);
        }
    }
    if (spec.xAxis) {
        out.push({ t: "text", x: A.x, y: A.y + A.h + 2, s: spec.xAxis[0], size: 9, fill: LABEL });
        out.push({ t: "text", x: A.x, y: A.y + A.h + 2, s: spec.xAxis[1], w: A.w, align: "right", size: 9, fill: LABEL });
    }
}
function radar(out: Prim[], spec: ChartSpec, p: Plot): void {
    const cats = spec.categories ?? [], n = Math.max(cats.length, spec.series[0]?.values.length ?? 0);
    if (n < 3)
        return;
    const cx = p.x + p.w / 2, cy = p.y + p.h / 2 + 2, R = Math.min(p.w, p.h) / 2 - 16;
    const max = Math.max(1, ...spec.series.flatMap(s => s.values.map(v => Math.abs(v))));
    const ang = (i: number) => -Math.PI / 2 + (i / n) * Math.PI * 2;
    for (let k = 1; k <= 3; k++) {
        const rr = R * k / 3, ring: number[] = [];
        for (let i = 0; i <= n; i++) {
            const a = ang(i % n);
            ring.push(cx + rr * Math.cos(a), cy + rr * Math.sin(a));
        }
        out.push({ t: "poly", pts: ring, stroke: GRID, sw: 1 });
    }
    for (let i = 0; i < n; i++) {
        const a = ang(i);
        out.push({ t: "poly", pts: [cx, cy, cx + R * Math.cos(a), cy + R * Math.sin(a)], stroke: AXIS, sw: 1 });
        if (cats[i])
            out.push({ t: "text", x: cx + (R + 4) * Math.cos(a) - 22, y: cy + (R + 4) * Math.sin(a) - 5, s: cats[i], w: 44, align: "center", size: 9, fill: LABEL });
    }
    spec.series.forEach((s, si) => { const poly: number[] = []; for (let i = 0; i < n; i++) {
        const rr = R * (Math.abs(s.values[i] ?? 0) / max), a = ang(i);
        poly.push(cx + rr * Math.cos(a), cy + rr * Math.sin(a));
    } out.push({ t: "poly", pts: poly, closed: true, fill: chartColor(spec, si), opacity: 0.18 }); out.push({ t: "poly", pts: poly, closed: true, stroke: chartColor(spec, si), sw: 2 }); for (let i = 0; i < poly.length; i += 2)
        out.push({ t: "circle", x: poly[i], y: poly[i + 1], r: 2.5, fill: chartColor(spec, si) }); });
}
function gauge(out: Prim[], spec: ChartSpec, p: Plot): void {
    const val = spec.series[0]?.values[0] ?? 0, max = spec.max || 100, frac = clamp(val / max, 0, 1);
    const cx = p.x + p.w / 2, cy = p.y + p.h * 0.72, R = Math.min(p.w / 2, p.h * 0.72) - 6;
    out.push({ t: "wedge", cx, cy, r: R, a0: Math.PI, a1: Math.PI * 2, fill: "#eceff1" });
    out.push({ t: "wedge", cx, cy, r: R, a0: Math.PI, a1: Math.PI + frac * Math.PI, fill: chartColor(spec, 0) });
    out.push({ t: "circle", x: cx, y: cy, r: R * 0.6, fill: "#fff" });
    const na = Math.PI + frac * Math.PI;
    out.push({ t: "poly", pts: [cx, cy, cx + R * 0.88 * Math.cos(na), cy + R * 0.88 * Math.sin(na)], stroke: "#37474f", sw: 2 });
    out.push({ t: "circle", x: cx, y: cy, r: 3, fill: "#37474f" });
    if (spec.showValues)
        out.push({ t: "text", x: cx - 40, y: cy - 16, s: String(val), w: 80, align: "center", size: 15, fill: "#37474f", bold: true });
}
function clipHalfPlane(poly: number[][], s: {
    x: number;
    y: number;
}, o: {
    x: number;
    y: number;
}): number[][] {
    const nx = o.x - s.x, ny = o.y - s.y, c = (o.x * o.x + o.y * o.y - s.x * s.x - s.y * s.y) / 2;
    const inside = (p: number[]) => nx * p[0] + ny * p[1] <= c + 0.000001, res: number[][] = [], N = poly.length;
    for (let i = 0; i < N; i++) {
        const a = poly[i], b = poly[(i + 1) % N], ai = inside(a), bi = inside(b);
        if (ai)
            res.push(a);
        if (ai !== bi) {
            const da = nx * a[0] + ny * a[1] - c, db = nx * b[0] + ny * b[1] - c, t = da / (da - db);
            res.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]);
        }
    }
    return res;
}
function voronoi(out: Prim[], spec: ChartSpec, p: Plot): void {
    const area = { x: p.x + 4, y: p.y + 4, w: p.w - 8, h: p.h - 8 };
    out.push({ t: "rect", x: area.x, y: area.y, w: area.w, h: area.h, stroke: AXIS, sw: 1 });
    const sites = (spec.points ?? []).map(q => ({ x: area.x + clamp(q.x, 0, 1) * area.w, y: area.y + area.h - clamp(q.y, 0, 1) * area.h }));
    const rect: number[][] = [[area.x, area.y], [area.x + area.w, area.y], [area.x + area.w, area.y + area.h], [area.x, area.y + area.h]];
    sites.forEach((s, i) => {
        let cell = rect.slice();
        for (let j = 0; j < sites.length && cell.length; j++)
            if (j !== i)
                cell = clipHalfPlane(cell, s, sites[j]);
        if (cell.length >= 3) {
            const pts = cell.flat();
            out.push({ t: "poly", pts, closed: true, fill: chartColor(spec, i), opacity: 0.16 });
            out.push({ t: "poly", pts, closed: true, stroke: chartColor(spec, i), sw: 1.5 });
        }
        out.push({ t: "circle", x: s.x, y: s.y, r: 3, fill: chartColor(spec, i) });
    });
}
function sankey(out: Prim[], spec: ChartSpec, p: Plot): void {
    const links = spec.links ?? [];
    if (!links.length)
        return;
    const area = { x: p.x + 4, y: p.y + 6, w: p.w - 8, h: p.h - 12 };
    const nodes = [...new Set(links.flatMap(l => [l.from, l.to]))];
    const layer = new Map<string, number>(nodes.map(n => [n, 0]));
    for (let iter = 0; iter < nodes.length; iter++) {
        let changed = false;
        for (const l of links) {
            const nl = layer.get(l.from)! + 1;
            if (nl > layer.get(l.to)!) {
                layer.set(l.to, nl);
                changed = true;
            }
        }
        if (!changed)
            break;
    }
    const L = Math.max(1, ...nodes.map(n => layer.get(n)! + 1));
    const outSum = new Map<string, number>(nodes.map(n => [n, 0])), inSum = new Map<string, number>(nodes.map(n => [n, 0]));
    for (const l of links) {
        outSum.set(l.from, outSum.get(l.from)! + l.value);
        inSum.set(l.to, inSum.get(l.to)! + l.value);
    }
    const nodeVal = (n: string) => Math.max(outSum.get(n)!, inSum.get(n)!);
    const cols: string[][] = Array.from({ length: L }, () => []);
    for (const n of nodes)
        cols[layer.get(n)!].push(n);
    const gap = 6, nodeW = 10;
    let scale = Infinity;
    for (const col of cols) {
        const tot = col.reduce((s, n) => s + nodeVal(n), 0);
        if (tot > 0)
            scale = Math.min(scale, (area.h - gap * (col.length - 1)) / tot);
    }
    if (!isFinite(scale) || scale <= 0)
        scale = 1;
    scale = Math.max(1, scale);
    const colX = (i: number) => L > 1 ? area.x + i / (L - 1) * (area.w - nodeW) : area.x;
    const nodeY = new Map<string, number>(), nodeH = new Map<string, number>();
    cols.forEach(col => { const tot = col.reduce((s, n) => s + nodeVal(n) * scale, 0) + gap * (col.length - 1); let y = area.y + Math.max(0, (area.h - tot) / 2); for (const n of col) {
        const hh = nodeVal(n) * scale;
        nodeY.set(n, y);
        nodeH.set(n, hh);
        y += hh + gap;
    } });
    nodes.forEach((n, i) => {
        const lv = layer.get(n)!, x = colX(lv), last = lv === L - 1;
        out.push({ t: "rect", x, y: nodeY.get(n)!, w: nodeW, h: nodeH.get(n)!, fill: chartColor(spec, i) });
        out.push({ t: "text", x: last ? x - 34 : x + nodeW + 2, y: nodeY.get(n)! + nodeH.get(n)! / 2 - 6, s: n, w: last ? 32 : undefined, align: last ? "right" : "left", size: 9, fill: LABEL });
    });
    const outCur = new Map(nodes.map(n => [n, nodeY.get(n)!])), inCur = new Map(nodes.map(n => [n, nodeY.get(n)!]));
    for (const l of links) {
        const hh = l.value * scale, x0 = colX(layer.get(l.from)!) + nodeW, x1 = colX(layer.get(l.to)!), y0 = outCur.get(l.from)!, y1 = inCur.get(l.to)!;
        outCur.set(l.from, y0 + hh);
        inCur.set(l.to, y1 + hh);
        const steps = 12, top: number[] = [], bot: number[] = [];
        for (let i = 0; i <= steps; i++) {
            const t = i / steps, ss = t * t * (3 - 2 * t), x = x0 + (x1 - x0) * t, ey = y0 + (y1 - y0) * ss;
            top.push(x, ey);
            bot.unshift(x, ey + hh);
        }
        out.push({ t: "poly", pts: [...top, ...bot], closed: true, fill: chartColor(spec, nodes.indexOf(l.from)), opacity: 0.22 });
    }
}
function boxStats(vals: number[]): {
    min: number;
    q1: number;
    med: number;
    q3: number;
    max: number;
} {
    const a = [...vals].sort((x, y) => x - y), q = (f: number) => { const idx = f * (a.length - 1), lo = Math.floor(idx), hi = Math.ceil(idx); return a[lo] + (a[hi] - a[lo]) * (idx - lo); };
    return { min: a[0], q1: q(0.25), med: q(0.5), q3: q(0.75), max: a[a.length - 1] };
}
function boxplot(out: Prim[], spec: ChartSpec, p: Plot): void {
    const boxes = spec.series.filter(s => s.values.length);
    if (!boxes.length)
        return;
    const axPad = 22, area = { x: p.x + axPad, y: p.y, w: p.w - axPad, h: p.h - axPad };
    const all = boxes.flatMap(s => s.values), min = Math.min(...all), max = Math.max(...all), span = (max - min) || 1;
    const Y = (v: number) => area.y + area.h - ((v - min) / span) * area.h;
    out.push({ t: "poly", pts: [area.x, area.y, area.x, area.y + area.h], stroke: AXIS, sw: 1 });
    const n = boxes.length, gap = area.w / n, bw = Math.min(46, gap * 0.5);
    boxes.forEach((s, i) => {
        const st = boxStats(s.values), cx = area.x + i * gap + gap / 2, x = cx - bw / 2, col = chartColor(spec, i);
        out.push({ t: "poly", pts: [cx, Y(st.min), cx, Y(st.q1)], stroke: "#607d8b", sw: 1 });
        out.push({ t: "poly", pts: [cx, Y(st.q3), cx, Y(st.max)], stroke: "#607d8b", sw: 1 });
        out.push({ t: "poly", pts: [cx - bw * 0.3, Y(st.min), cx + bw * 0.3, Y(st.min)], stroke: "#607d8b", sw: 1 });
        out.push({ t: "poly", pts: [cx - bw * 0.3, Y(st.max), cx + bw * 0.3, Y(st.max)], stroke: "#607d8b", sw: 1 });
        out.push({ t: "rect", x, y: Y(st.q3), w: bw, h: Y(st.q1) - Y(st.q3), fill: col, opacity: 0.32, stroke: col, sw: 1.5 });
        out.push({ t: "poly", pts: [x, Y(st.med), x + bw, Y(st.med)], stroke: col, sw: 2 });
        const lab = s.name ?? spec.categories?.[i];
        if (lab)
            out.push({ t: "text", x: area.x + i * gap, y: area.y + area.h + 3, s: lab, w: gap, align: "center", fill: LABEL });
    });
}
function mixHex(hex: string, t: number): string {
    const h = hex.replace("#", "");
    const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
    const m = (c: number) => Math.round(255 + (c - 255) * clamp(t, 0, 1));
    return `rgb(${m(r)},${m(g)},${m(b)})`;
}
function heatmap(out: Prim[], spec: ChartSpec, p: Plot): void {
    const cats = spec.categories ?? [], series = spec.series.filter(s => s.values.length);
    const rows = series.length, colsN = Math.max(cats.length, ...series.map(s => s.values.length));
    if (!rows || !colsN)
        return;
    const labW = 42, area = { x: p.x + labW, y: p.y + 14, w: p.w - labW, h: p.h - 14 };
    const all = series.flatMap(s => s.values), min = Math.min(...all), max = Math.max(...all), span = (max - min) || 1;
    const cw = area.w / colsN, ch = area.h / rows, base = chartColor(spec, 0);
    for (let r = 0; r < rows; r++) {
        const nm = series[r].name;
        if (nm)
            out.push({ t: "text", x: p.x, y: area.y + r * ch + ch / 2 - 6, s: nm, w: labW - 3, align: "right", size: 9, fill: LABEL });
        for (let c = 0; c < colsN; c++) {
            const v = series[r].values[c] ?? 0, t = (v - min) / span;
            out.push({ t: "rect", x: area.x + c * cw, y: area.y + r * ch, w: cw - 1, h: ch - 1, fill: mixHex(base, 0.15 + t * 0.85) });
            if (spec.showValues)
                out.push({ t: "text", x: area.x + c * cw, y: area.y + r * ch + ch / 2 - 6, s: String(v), w: cw, align: "center", size: 9, fill: t > 0.55 ? "#fff" : "#37474f" });
        }
    }
    cats.forEach((c, i) => out.push({ t: "text", x: area.x + i * cw, y: p.y, s: c, w: cw, align: "center", size: 9, fill: LABEL }));
}
function treemapLayout(items: {
    v: number;
    i: number;
    label?: string;
}[], x: number, y: number, w: number, h: number, out: {
    x: number;
    y: number;
    w: number;
    h: number;
    i: number;
    v: number;
    label?: string;
}[]): void {
    if (items.length === 1) {
        const it = items[0];
        out.push({ x, y, w, h, i: it.i, v: it.v, label: it.label });
        return;
    }
    const total = items.reduce((s, it) => s + it.v, 0) || 1;
    let acc = 0, k = 0;
    for (; k < items.length - 1; k++) {
        if (acc + items[k].v >= total / 2) {
            k++;
            break;
        }
        acc += items[k].v;
    }
    k = Math.max(1, Math.min(items.length - 1, k));
    const a = items.slice(0, k), b = items.slice(k), frac = a.reduce((s, it) => s + it.v, 0) / total;
    if (w >= h) {
        const wa = w * frac;
        treemapLayout(a, x, y, wa, h, out);
        treemapLayout(b, x + wa, y, w - wa, h, out);
    }
    else {
        const ha = h * frac;
        treemapLayout(a, x, y, w, ha, out);
        treemapLayout(b, x, y + ha, w, h - ha, out);
    }
}
function treemap(out: Prim[], spec: ChartSpec, p: Plot): void {
    const vals = spec.series[0]?.values ?? [], cats = spec.categories ?? [];
    const items = vals.map((v, i) => ({ v: Math.abs(v), i, label: cats[i] })).filter(it => it.v > 0).sort((x, y) => y.v - x.v);
    if (!items.length)
        return;
    const cells: {
        x: number;
        y: number;
        w: number;
        h: number;
        i: number;
        v: number;
        label?: string;
    }[] = [];
    treemapLayout(items, p.x, p.y, p.w, p.h, cells);
    for (const rc of cells) {
        out.push({ t: "rect", x: rc.x, y: rc.y, w: rc.w, h: rc.h, fill: chartColor(spec, rc.i), stroke: "#fff", sw: 1.5, opacity: 0.92 });
        if (rc.w > 30 && rc.h > 16) {
            if (rc.label)
                out.push({ t: "text", x: rc.x + 3, y: rc.y + 3, s: rc.label, w: rc.w - 6, size: 9, fill: "#fff", bold: true });
            if (spec.showValues)
                out.push({ t: "text", x: rc.x + 3, y: rc.y + (rc.label ? 15 : 3), s: String(rc.v), w: rc.w - 6, size: 9, fill: "#fff" });
        }
    }
}
