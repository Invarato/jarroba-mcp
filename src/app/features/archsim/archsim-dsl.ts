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
export interface DslResult {
    state?: ArchState;
    mode?: "runtime" | "cicd";
    error?: string;
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
            return { error: "JSON no v\u00E1lido." };
        }
    }
    else
        d = input;
    if (!d || typeof d !== "object")
        return { error: "Se esperaba un objeto JSON." };
    const doc = d as ArchsimDsl;
    if (!Array.isArray(doc.nodes) || !doc.nodes.length)
        return { error: "Falta \"nodes\" (lista de nodos)." };
    const ids = new Set<string>();
    for (const n of doc.nodes) {
        if (!n || typeof n.id !== "string" || !n.id)
            return { error: "Cada nodo necesita un \"id\" \u00FAnico (texto)." };
        if (ids.has(n.id))
            return { error: `Id de nodo repetido: "${n.id}".` };
        ids.add(n.id);
        if (typeof n.kind !== "string" || !KINDS.has(n.kind))
            return { error: `Tipo de nodo desconocido: "${n.kind}" (en "${n.id}").` };
    }
    const edges: [
        string,
        string
    ][] = [];
    for (const e of (doc.edges ?? [])) {
        const a = Array.isArray(e) ? e[0] : e?.from;
        const b = Array.isArray(e) ? e[1] : e?.to;
        if (typeof a !== "string" || typeof b !== "string")
            return { error: "Cada arista debe ser [\"origen\",\"destino\"] o {\"from\",\"to\"}." };
        if (!ids.has(a) || !ids.has(b))
            return { error: `Arista hacia un id inexistente: "${a}" → "${b}".` };
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
