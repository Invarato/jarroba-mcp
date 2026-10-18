import { ArchNode, ArchEdge, ArchNodeKind, ArchState, CATALOG, NODE_COST } from "./archsim-model";
import { techById } from "./archsim-cloud-catalog";
export interface TplNode {
    ref: string;
    kind: ArchNodeKind;
    label?: string;
    col: number;
    row?: number;
    capacity?: number;
    latency?: number;
    jitter?: number;
    queue?: number;
    tech?: string;
    redelivery?: number;
    idempotent?: boolean;
    partitions?: number;
    fanout?: "split" | "all";
    hitRatio?: number;
    burst?: number;
    replicas?: number;
    readRatio?: number;
    coldStartMs?: number;
    retries?: number;
    breaker?: boolean;
    failRate?: number;
    down?: boolean;
}
export const BEHAVIOR_FIELDS = ["partitions", "fanout", "hitRatio", "burst", "replicas", "readRatio", "coldStartMs", "retries", "breaker", "failRate", "down"] as const;
export interface Tpl {
    id: string;
    title: string;
    nodes: TplNode[];
    edges: [
        string,
        string
    ][];
}
export function buildTemplate(tpl: Tpl): ArchState {
    const nodes: ArchNode[] = [];
    const edges: ArchEdge[] = [];
    const idOf = new Map<string, string>();
    let seq = 0;
    for (const t of tpl.nodes) {
        const id = `${t.kind}_${++seq}`;
        idOf.set(t.ref, id);
        const d = CATALOG[t.kind].defaults;
        const tech = techById(t.tech);
        const node: ArchNode = {
            id,
            kind: t.kind,
            label: t.label,
            x: 70 + t.col * 185,
            y: 80 + (t.row ?? 0) * 95,
            capacity: t.capacity ?? tech?.defaults.capacity ?? d.capacity,
            latency: t.latency ?? tech?.defaults.latency ?? d.latency,
            jitter: t.jitter ?? d.jitter,
            queue: t.queue ?? d.queue,
            failRate: d.failRate,
        };
        if (t.redelivery !== undefined)
            node.redelivery = t.redelivery;
        if (t.idempotent !== undefined)
            node.idempotent = t.idempotent;
        for (const f of BEHAVIOR_FIELDS)
            if (t[f] !== undefined)
                (node as unknown as Record<string, unknown>)[f] = t[f];
        if (tech) {
            node.provider = tech.provider;
            node.hosting = tech.hosting;
            node.tech = tech.id;
            if (tech.defaults.coldStartMs)
                node.coldStartMs = tech.defaults.coldStartMs;
        }
        else
            node.costHr = NODE_COST[t.kind];
        nodes.push(node);
    }
    for (const [a, b] of tpl.edges) {
        edges.push({ id: `e_${++seq}`, fromId: idOf.get(a)!, toId: idOf.get(b)!, fromTerm: "out", toTerm: "in" });
    }
    return { nodes, edges };
}
