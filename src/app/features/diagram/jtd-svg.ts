import { importJtd } from "./diagram-jtd";
import { buildSvg, SvgNode, SvgEdge } from "./diagram-svg";
import { routeOrthogonal } from "./jtd-route";
import { dashArrayFor, SHAPE_PARAM_KEYS, ShapeParams, CornerPreset } from "./diagram-shapes";
export function renderJtdSvg(text: string): {
    svg?: string;
    error?: string;
} {
    const { result, error } = importJtd(text);
    if (!result)
        return { error: error ?? "invalid" };
    const byId = new Map(result.nodes.map(n => [n.id, n]));
    const pg = result.meta?.poster;
    const nodes: SvgNode[] = result.nodes.map(n => ({
        kind: n.kind,
        x: n.x,
        y: n.y,
        w: n.w,
        h: n.h,
        text: n.text,
        fill: n.fill,
        stroke: n.stroke,
        chart: n.chart,
        borderStyle: n.extra?.["borderStyle"] as string | undefined,
        borderWidth: n.extra?.["borderWidth"] as number | undefined,
        borderPattern: n.extra?.["borderPattern"] as string | undefined,
        rotation: n.extra?.["rotation"] as number | undefined,
        opacity: n.extra?.["opacity"] as number | undefined,
        corners: n.extra?.["corners"] as CornerPreset | undefined,
        titleH: n.extra?.["titleH"] as number | undefined,
        bold: n.extra?.["bold"] as boolean | undefined,
        italic: n.extra?.["italic"] as boolean | undefined,
        fontSize: n.extra?.["fontSize"] as number | undefined,
        textColor: n.extra?.["textColor"] as string | undefined,
        font: n.extra?.["font"] as string | undefined,
        align: n.extra?.["align"] as string | undefined,
        valign: n.extra?.["valign"] as string | undefined,
        ...Object.fromEntries(SHAPE_PARAM_KEYS.filter(k => n.extra?.[k] != null).map(k => [k, n.extra![k]])) as ShapeParams,
    }));
    const RECT = new Set(["rect", "round", "card", "container", "process", "note", "chart", "text", "document", "cylinder", "callout", "image", "icon"]);
    const boxes = new Map(result.nodes.map(n => [n.id, { x: n.x, y: n.y, w: n.w, h: n.h, point: !RECT.has(n.kind) }]));
    const routes = routeOrthogonal(boxes, result.edges.map(e => ({ from: e.fromId, to: e.toId, fromPort: e.fromPort, toPort: e.toPort })));
    const edges: SvgEdge[] = result.edges.map((e, k) => {
        const a = byId.get(e.fromId)!, b = byId.get(e.toId)!;
        const p1 = clip(a, b.x, b.y), p2 = clip(b, a.x, a.y);
        const dash = e.extra?.["dash"] as string | undefined;
        const pts = e.style === "straight" || routes[k].length < 4 ? [p1.x, p1.y, p2.x, p2.y] : routes[k];
        return {
            pts,
            label: e.label,
            arrows: e.arrows,
            color: e.extra?.["color"] as string | undefined,
            width: e.extra?.["width"] as number | undefined,
            head: e.extra?.["head"] as SvgEdge["head"],
            dash: dash ? dashArrayFor(dash) : undefined,
            fromCenter: { x: a.x, y: a.y },
            toCenter: { x: b.x, y: b.y },
        };
    });
    if (pg)
        nodes.unshift({ kind: "rect", x: pg.x, y: pg.y, w: pg.w, h: pg.h, text: "", fill: "#ffffff", stroke: "#cfd8dc", borderWidth: 2 });
    return { svg: buildSvg(nodes, edges, result.meta?.background) };
}
function clip(n: {
    x: number;
    y: number;
    w: number;
    h: number;
}, tx: number, ty: number): {
    x: number;
    y: number;
} {
    const dx = tx - n.x, dy = ty - n.y;
    if (!dx && !dy)
        return { x: n.x, y: n.y };
    const sx = dx ? (n.w / 2) / Math.abs(dx) : Infinity, sy = dy ? (n.h / 2) / Math.abs(dy) : Infinity, s = Math.min(sx, sy);
    return { x: n.x + dx * s, y: n.y + dy * s };
}
