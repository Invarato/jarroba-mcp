export interface TimelineFlow {
    edge: string;
    reverse?: boolean;
    label?: string;
}
export interface TimelineStep {
    id: string;
    text: string;
    flow?: TimelineFlow[];
    focus?: string[];
    show?: string[];
    ms?: number;
}
export interface DiagramTimeline {
    mode?: "highlight" | "reveal";
    steps: TimelineStep[];
}
export interface TimelineScene {
    opacity: Map<string, number>;
    focus: Set<string>;
    flows: TimelineFlow[];
    text: string;
}
export const PENDING_OPACITY = 0.22;
export function stepRefs(step: TimelineStep, edgeEnds: Map<string, {
    from: string;
    to: string;
}>): string[] {
    const out = [...(step.show ?? []), ...(step.focus ?? [])];
    for (const f of step.flow ?? []) {
        out.push(f.edge);
        const e = edgeEnds.get(f.edge);
        if (e)
            out.push(e.from, e.to);
    }
    return out;
}
export function sceneAt(tl: DiagramTimeline, index: number, edgeEnds: Map<string, {
    from: string;
    to: string;
}>): TimelineScene {
    const steps = tl.steps, i = Math.max(0, Math.min(steps.length - 1, index));
    const firstSeen = new Map<string, number>();
    steps.forEach((s, k) => { for (const id of stepRefs(s, edgeEnds))
        if (!firstSeen.has(id))
            firstSeen.set(id, k); });
    const pending = tl.mode === "reveal" ? 0 : PENDING_OPACITY;
    const opacity = new Map<string, number>();
    for (const [id, k] of firstSeen)
        opacity.set(id, k <= i ? 1 : pending);
    const cur = steps[i];
    const focus = new Set<string>([...(cur?.focus ?? []), ...(cur?.flow ?? []).map(f => f.edge)]);
    return { opacity, focus, flows: cur?.flow ?? [], text: cur?.text ?? "" };
}
export function elapsedAt(tl: DiagramTimeline, index: number): number | null {
    if (!tl.steps.some(s => typeof s.ms === "number"))
        return null;
    return tl.steps.slice(0, index + 1).reduce((a, s) => a + (typeof s.ms === "number" && isFinite(s.ms) ? s.ms : 0), 0);
}
export function mapTimeline(tl: DiagramTimeline, nodeId: (id: string) => string | undefined, edgeId: (id: string) => string | undefined): DiagramTimeline {
    const any = (id: string) => nodeId(id) ?? edgeId(id);
    return {
        mode: tl.mode === "reveal" ? "reveal" : "highlight",
        steps: tl.steps.map((s, k) => ({
            id: s.id || "p" + (k + 1),
            text: String(s.text ?? ""),
            flow: (s.flow ?? []).map(f => ({ ...f, edge: edgeId(f.edge) })).filter((f): f is TimelineFlow => !!f.edge),
            focus: (s.focus ?? []).map(any).filter((x): x is string => !!x),
            show: (s.show ?? []).map(any).filter((x): x is string => !!x),
            ...(typeof s.ms === "number" && isFinite(s.ms) ? { ms: s.ms } : {}),
        })),
    };
}
export const HOP_MS = 700;
export const FLOW_STAGGER = 0.5;
export function flowSchedule(flows: readonly {
    label?: string;
}[]): {
    spans: [
        number,
        number
    ][];
    total: number;
    chained: boolean;
} {
    const chains = new Map<string, number>(), next = new Map<string, number>();
    let order = 0;
    for (const f of flows)
        if (f.label != null && f.label !== "" && !chains.has(f.label))
            chains.set(f.label, order++);
    const spans: [
        number,
        number
    ][] = [];
    let total = 0;
    for (const f of flows) {
        if (f.label == null || f.label === "") {
            spans.push([0, -1]);
            continue;
        }
        const at = next.get(f.label) ?? chains.get(f.label)! * FLOW_STAGGER;
        spans.push([at, at + 1]);
        next.set(f.label, at + 1);
        total = Math.max(total, at + 1);
    }
    const chained = chains.size > 0;
    if (!chained)
        total = 1;
    for (const s of spans)
        if (s[1] < 0) {
            s[0] = 0;
            s[1] = total;
        }
    return { spans, total, chained };
}
export function stepNeedMs(step: {
    flow?: readonly {
        label?: string;
    }[];
}, base: number): number {
    const f = step.flow ?? [];
    if (!f.length)
        return base;
    const s = flowSchedule(f);
    return s.chained ? Math.max(base, Math.round(s.total * HOP_MS + 600)) : base;
}
