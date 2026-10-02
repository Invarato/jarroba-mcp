import { ArchNode, ArchEdge } from "./archsim-model";
import { AiNodeKind, isAiKind, modelProfile, AI_CATALOG } from "./archsim-ai";
const AI_LAT: Record<AiNodeKind, number> = {
    ai_agent: 20,
    ai_planner: 20,
    ai_router: 800,
    ai_tool: 40,
    ai_guardrail: 30,
    ai_sandbox: 35,
    ai_memory: 15,
    ai_data: 25,
    ai_checkpoint: 0,
    ai_eval: 0,
    ai_gateway: 5,
    ai_observability: 0,
};
const AI_COST: Record<AiNodeKind, number> = {
    ai_router: 0.01,
    ai_tool: 0.0005,
    ai_guardrail: 0.0002,
    ai_sandbox: 0.0002,
    ai_data: 0.0001,
    ai_memory: 0.0001,
    ai_agent: 0,
    ai_planner: 0,
    ai_checkpoint: 0,
    ai_eval: 0,
    ai_gateway: 0,
    ai_observability: 0,
};
const AI_TOK: Record<AiNodeKind, number> = {
    ai_agent: 500,
    ai_planner: 500,
    ai_router: 500,
    ai_tool: 300,
    ai_data: 400,
    ai_memory: 200,
    ai_guardrail: 50,
    ai_sandbox: 0,
    ai_checkpoint: 0,
    ai_eval: 0,
    ai_gateway: 0,
    ai_observability: 0,
};
const frac = (v: unknown) => Math.max(0, Math.min(1, Number(v) / 100 || 0));
export function nodeLatencyMs(n: ArchNode): number {
    const a = n.ai ?? {};
    if (n.kind === "ai_router") {
        const primary = modelProfile(String(a["model"] || "custom")).latencyMs;
        const strong = modelProfile(String(a["strong_model"] || "custom")).latencyMs;
        const hit = frac(a["cache_hit"]), esc = frac(a["escalation"]);
        return hit * 20 + (1 - hit) * (primary + esc * strong);
    }
    if (n.kind === "ai_checkpoint") {
        return String(a["oversight"]) === "in_the_loop" ? frac(a["gated_fraction"]) * 30000 : 0;
    }
    if ((n.kind === "ai_data" || n.kind === "ai_eval") && a["batch"] === true)
        return 0;
    return AI_LAT[n.kind as AiNodeKind] ?? 0;
}
export function nodeCostPerReq(n: ArchNode): number {
    const a = n.ai ?? {};
    if (n.kind === "ai_router") {
        const primary = modelProfile(String(a["model"] || "custom")).costPerReq;
        const strong = modelProfile(String(a["strong_model"] || "custom")).costPerReq;
        const hit = frac(a["cache_hit"]), esc = frac(a["escalation"]);
        return (1 - hit) * (primary + esc * strong);
    }
    const base = AI_COST[n.kind as AiNodeKind] ?? 0;
    if ((n.kind === "ai_data" || n.kind === "ai_eval") && a["batch"] === true)
        return base * 0.5;
    return base;
}
export interface AiEstimate {
    p50: number;
    p95: number;
    ttft: number;
    costPerReq: number;
    tokens: number;
    bottleneckId: string | null;
    bottleneckLabel: string;
    bottleneckMs: number;
    hasHuman: boolean;
    criticalPath: string[];
    costByNode: {
        id: string;
        label: string;
        cost: number;
    }[];
}
export function estimateDesign(allNodes: ArchNode[], edges: ArchEdge[]): AiEstimate {
    const nodes = allNodes.filter(n => isAiKind(n.kind));
    const byId = new Map(nodes.map(n => [n.id, n]));
    const lat = (n: ArchNode) => nodeLatencyMs(n);
    const nodeCost = (n: ArchNode) => nodeCostPerReq(n);
    const outAdj = new Map<string, string[]>(nodes.map(n => [n.id, []]));
    for (const e of edges)
        if (byId.has(e.fromId) && byId.has(e.toId))
            outAdj.get(e.fromId)!.push(e.toId);
    const memo = new Map<string, number>();
    const nextOf = new Map<string, string | null>();
    const stack = new Set<string>();
    const longest = (id: string): number => {
        if (memo.has(id))
            return memo.get(id)!;
        if (stack.has(id))
            return lat(byId.get(id)!);
        stack.add(id);
        let best = 0, bestChild: string | null = null;
        for (const to of outAdj.get(id) ?? []) {
            const v = longest(to);
            if (v > best) {
                best = v;
                bestChild = to;
            }
        }
        stack.delete(id);
        nextOf.set(id, bestChild);
        const total = lat(byId.get(id)!) + best;
        memo.set(id, total);
        return total;
    };
    let p50 = 0, startId: string | null = null;
    for (const n of nodes) {
        const v = longest(n.id);
        if (v > p50) {
            p50 = v;
            startId = n.id;
        }
    }
    const criticalPath: string[] = [];
    for (let id = startId; id; id = nextOf.get(id) ?? null) {
        if (criticalPath.includes(id))
            break;
        criticalPath.push(id);
    }
    let cost = 0, tokens = 0;
    const costByNode: {
        id: string;
        label: string;
        cost: number;
    }[] = [];
    for (const n of nodes) {
        const c = nodeCost(n);
        cost += c;
        tokens += AI_TOK[n.kind as AiNodeKind] ?? 0;
        if (c > 0)
            costByNode.push({ id: n.id, label: n.label || labelFor(n.kind as AiNodeKind), cost: c });
    }
    costByNode.sort((a, b) => b.cost - a.cost);
    let bId: string | null = null, bMs = -1, bLabel = "";
    for (const n of nodes) {
        const l = lat(n);
        if (l > bMs) {
            bMs = l;
            bId = n.id;
            bLabel = n.label || labelFor(n.kind as AiNodeKind);
        }
    }
    const routerVar = nodes.filter(n => n.kind === "ai_router").reduce((s, n) => s + modelProfile(String((n.ai ?? {})["model"] || "custom")).latencyMs, 0);
    const p95 = Math.round(p50 + routerVar * 0.6);
    const hasHuman = nodes.some(n => n.kind === "ai_checkpoint");
    const routersOnPath = criticalPath.map(id => byId.get(id)!).filter(nn => nn.kind === "ai_router");
    const genMs = routersOnPath.reduce((s, nn) => s + nodeLatencyMs(nn), 0) * 0.6;
    const ttft = Math.max(30, Math.round(p50 - genMs));
    return { p50: Math.round(p50), p95, ttft, costPerReq: cost, tokens, bottleneckId: bId, bottleneckLabel: bLabel, bottleneckMs: Math.max(0, bMs), hasHuman, criticalPath, costByNode };
}
function labelFor(k: AiNodeKind): string {
    return AI_CATALOG[k]?.label ?? k;
}
