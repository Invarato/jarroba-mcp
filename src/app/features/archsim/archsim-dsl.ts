import { ArchState, ArchNodeKind, CATALOG } from "./archsim-model";
import { buildTemplate } from "./archsim-build";
export interface DslNode {
    id: string;
    kind: string;
    label?: string;
    capacity?: number;
    latency?: number;
    jitter?: number;
    queue?: number;
    redelivery?: number;
    idempotent?: boolean;
    partitions?: number;
    fanout?: string;
    hitRatio?: number;
    burst?: number;
    replicas?: number;
    readRatio?: number;
    coldStartMs?: number;
}
export interface DslEdgeObj {
    from: string;
    to: string;
}
export interface ArchsimDsl {
    archsim?: number;
    mode?: string;
    nodes: DslNode[];
    edges?: (string[] | DslEdgeObj)[];
}
export type DslError = {
    code: "json";
} | {
    code: "not-object";
} | {
    code: "no-nodes";
} | {
    code: "node-id";
} | {
    code: "dup-id";
    id: string;
} | {
    code: "kind";
    id: string;
    kind: string;
} | {
    code: "edge-shape";
} | {
    code: "edge-ref";
    from: string;
    to: string;
};
export interface DslResult {
    state?: ArchState;
    mode?: "runtime" | "cicd";
    error?: DslError;
}
export function dslErrorEn(e: DslError): string {
    switch (e.code) {
        case "json": return "Invalid JSON.";
        case "not-object": return "Expected a JSON object.";
        case "no-nodes": return "Missing \"nodes\" (a non-empty list of nodes).";
        case "node-id": return "Every node needs a unique \"id\" (string).";
        case "dup-id": return `Duplicate node id: "${e.id}".`;
        case "kind": return `Unknown node kind: "${e.kind}" (in "${e.id}").`;
        case "edge-shape": return "Each edge must be [\"from\",\"to\"] or {\"from\",\"to\"}.";
        case "edge-ref": return `Edge to a non-existent id: "${e.from}" → "${e.to}".`;
    }
}
const KINDS = new Set(Object.keys(CATALOG));
const num = (x: unknown): number | undefined => (typeof x === "number" && isFinite(x) ? x : undefined);
function columnOf(ids: string[], edges: [
    string,
    string
][]): Map<string, number> {
    const col = new Map(ids.map(id => [id, 0]));
    for (let it = 0; it < ids.length; it++) {
        let changed = false;
        for (const [a, b] of edges) {
            const c = (col.get(a) ?? 0) + 1;
            if (c > (col.get(b) ?? 0)) {
                col.set(b, c);
                changed = true;
            }
        }
        if (!changed)
            break;
    }
    return col;
}
export function importArchsim(input: string | object): DslResult {
    let d: unknown;
    if (typeof input === "string") {
        try {
            d = JSON.parse(input);
        }
        catch {
            return { error: { code: "json" } };
        }
    }
    else
        d = input;
    if (!d || typeof d !== "object")
        return { error: { code: "not-object" } };
    const doc = d as ArchsimDsl;
    if (!Array.isArray(doc.nodes) || !doc.nodes.length)
        return { error: { code: "no-nodes" } };
    const ids = new Set<string>();
    for (const n of doc.nodes) {
        if (!n || typeof n.id !== "string" || !n.id)
            return { error: { code: "node-id" } };
        if (ids.has(n.id))
            return { error: { code: "dup-id", id: n.id } };
        ids.add(n.id);
        if (typeof n.kind !== "string" || !KINDS.has(n.kind))
            return { error: { code: "kind", id: n.id, kind: String(n.kind) } };
    }
    const edges: [
        string,
        string
    ][] = [];
    for (const e of (doc.edges ?? [])) {
        const a = Array.isArray(e) ? e[0] : e?.from;
        const b = Array.isArray(e) ? e[1] : e?.to;
        if (typeof a !== "string" || typeof b !== "string")
            return { error: { code: "edge-shape" } };
        if (!ids.has(a) || !ids.has(b))
            return { error: { code: "edge-ref", from: a, to: b } };
        edges.push([a, b]);
    }
    const col = columnOf(doc.nodes.map(n => n.id), edges);
    const rowByCol = new Map<number, number>();
    const tplNodes = doc.nodes.map(n => {
        const c = col.get(n.id) ?? 0;
        const r = rowByCol.get(c) ?? 0;
        rowByCol.set(c, r + 1);
        return { ref: n.id, kind: n.kind as ArchNodeKind, label: typeof n.label === "string" ? n.label : undefined, capacity: num(n.capacity), latency: num(n.latency), jitter: num(n.jitter), queue: num(n.queue), col: c, row: r, redelivery: num(n.redelivery), idempotent: typeof n.idempotent === "boolean" ? n.idempotent : undefined, partitions: num(n.partitions), hitRatio: num(n.hitRatio), burst: num(n.burst), replicas: num(n.replicas), readRatio: num(n.readRatio), coldStartMs: num(n.coldStartMs), fanout: n.fanout === "split" || n.fanout === "all" ? n.fanout as "split" | "all" : undefined };
    });
    const state = buildTemplate({ id: "dsl", title: "dsl", nodes: tplNodes, edges });
    return { state, mode: doc.mode === "cicd" ? "cicd" : "runtime" };
}
