import { ArchNode, ArchEdge, ArchNodeKind, ArchState } from "./archsim-model";
import { buildTemplate } from "./archsim-build";
import { defaultAiSpec, isAiKind, AiNodeKind } from "./archsim-ai";
import { stepRuntimeSim, RuntimeScenario, computeDeployFaults } from "./archsim-runtime-sim";
import { costBreakdown } from "./archsim-cloud-catalog";
export type GoalMetric = "avail" | "legitAvail" | "p95" | "lost" | "lagSec" | "costHr";
export interface Goal {
    metric: GoalMetric;
    target: number;
}
export const GOAL_AT_LEAST: ReadonlySet<GoalMetric> = new Set(["avail", "legitAvail"]);
export interface ChallengeSim {
    warmup?: number;
    seconds: number;
    dt?: number;
    scenario?: RuntimeScenario;
    reqRate?: number;
}
export interface Challenge {
    id: string;
    level: 1 | 2 | 3;
    start: () => ArchState;
    sim: ChallengeSim;
    goals: Goal[];
    reference: (s: ArchState) => ArchState;
}
type NodeSpec = {
    ref: string;
    kind: ArchNodeKind;
    label: string;
    col: number;
    row?: number;
} & Partial<ArchNode>;
export function build(nodes: NodeSpec[], edges: [
    string,
    string
][]): ArchState {
    const st = buildTemplate({ id: "reto", title: "reto", nodes: nodes.map(({ ref, kind, label, col, row, capacity, latency, jitter, queue }) => ({ ref, kind, label, col, row, capacity, latency, jitter, queue })), edges });
    st.nodes.forEach((n, i) => {
        const { ref: _r, kind: _k, label: _l, col: _c, row: _w, capacity: _cap, latency: _lat, jitter: _j, queue: _q, ai, ...extra } = nodes[i];
        Object.assign(n, extra);
        if (isAiKind(n.kind))
            n.ai = { ...defaultAiSpec(n.kind as AiNodeKind), ...(ai ?? {}) };
    });
    return st;
}
export function byLabel(s: ArchState, label: string): ArchNode {
    const n = s.nodes.find(x => x.label === label);
    if (!n)
        throw new Error(`reto: no hay nodo «${label}»`);
    return n;
}
let refSeq = 0;
export function addNode(s: ArchState, kind: ArchNodeKind, label: string, extra: Partial<ArchNode> = {}): ArchNode {
    const n = { ...build([{ ref: "x", kind, label, col: 0, ...extra }], []).nodes[0], id: `ref_${kind}_${++refSeq}` };
    s.nodes.push(n);
    return n;
}
export function link(s: ArchState, a: ArchNode, b: ArchNode): void {
    s.edges.push({ id: `ref_e_${++refSeq}`, fromId: a.id, toId: b.id, fromTerm: "out", toTerm: "in" });
}
export function unlink(s: ArchState, a: ArchNode, b: ArchNode): void {
    s.edges = s.edges.filter(e => !(e.fromId === a.id && e.toId === b.id));
}
export interface Measured {
    avail: number;
    legitAvail: number;
    p95: number;
    lost: number;
    lagSec: number;
    costHr: number;
}
export function measure(nodes: ArchNode[], edges: ArchEdge[], sim: ChallengeSim): Measured {
    const dt = sim.dt ?? 0.1, warm = sim.warmup ?? 20, rr = sim.reqRate ?? 0;
    const faults = computeDeployFaults(nodes, edges);
    let q: Record<string, number> = {};
    const m: Measured = { avail: 1, legitAvail: 1, p95: 0, lost: 0, lagSec: 0, costHr: 0 };
    let off = 0, ok = 0, loff = 0, lok = 0;
    const steps = (secs: number, scn: RuntimeScenario, measuring: boolean) => {
        for (let t = 0; t < secs - 1e-9; t += dt) {
            const r = stepRuntimeSim(nodes, edges, q, dt, rr, faults, scn);
            q = r.nextQ;
            m.lost += r.asyncLost * dt;
            if (!measuring)
                continue;
            off += r.offered * dt;
            ok += r.offered * r.availability * dt;
            loff += r.legitOffered * dt;
            lok += r.legitOffered * r.legitAvailability * dt;
            m.p95 = Math.max(m.p95, r.p95);
            for (const qs of Object.values(r.queues))
                m.lagSec = Math.max(m.lagSec, Number.isFinite(qs.lagSec) ? qs.lagSec : 1000000000);
            const served: Record<string, number> = {};
            for (const id in r.perNode)
                served[id] = r.perNode[id].served;
            m.costHr = Math.max(m.costHr, costBreakdown(nodes, served, "us").infraHr);
        }
    };
    steps(warm, {}, false);
    steps(sim.seconds, sim.scenario ?? {}, true);
    m.avail = off > 0 ? ok / off : 1;
    m.legitAvail = loff > 0 ? lok / loff : 1;
    return m;
}
export interface GoalResult {
    goal: Goal;
    value: number;
    pass: boolean;
}
export function checkGoals(goals: Goal[], m: Measured): {
    results: GoalResult[];
    passed: boolean;
} {
    const results = goals.map(goal => {
        const value = m[goal.metric];
        const pass = GOAL_AT_LEAST.has(goal.metric) ? value >= goal.target - 1e-9 : value <= goal.target + 1e-9;
        return { goal, value, pass };
    });
    return { results, passed: results.every(r => r.pass) };
}
export function evaluate(ch: Challenge, s: ArchState): {
    results: GoalResult[];
    passed: boolean;
    measured: Measured;
} {
    const measured = measure(s.nodes, s.edges, ch.sim);
    return { ...checkGoals(ch.goals, measured), measured };
}
export const CHALLENGES: Challenge[] = [
    {
        id: "cuello",
        level: 1,
        start: () => build([
            { ref: "c", kind: "client", label: "Usuarios", col: 0, capacity: 500 },
            { ref: "g", kind: "gateway", label: "Gateway", col: 1 },
            { ref: "s", kind: "service", label: "Pedidos", col: 2, capacity: 200, latency: 20 },
            { ref: "d", kind: "db", label: "BD", col: 3, capacity: 400, latency: 15 },
        ], [["c", "g"], ["g", "s"], ["s", "d"]]),
        sim: { warmup: 300, seconds: 20, dt: 0.5 },
        goals: [{ metric: "avail", target: 0.999 }, { metric: "p95", target: 150 }, { metric: "costHr", target: 0.8 }],
        reference: s => { byLabel(s, "Pedidos").autoscale = true; byLabel(s, "BD").replicas = 2; return s; },
    },
    {
        id: "cola-no-quita",
        level: 1,
        start: () => build([
            { ref: "c", kind: "client", label: "Usuarios", col: 0, capacity: 1000 },
            { ref: "a", kind: "service", label: "servicioA", col: 1, capacity: 2000, latency: 10 },
            { ref: "k", kind: "queue", label: "Kafka", col: 2, queue: 100000 },
            { ref: "d", kind: "db", label: "BD", col: 3, capacity: 400, latency: 15 },
        ], [["c", "a"], ["a", "k"], ["k", "d"]]),
        sim: { warmup: 0, seconds: 600, dt: 0.5 },
        goals: [{ metric: "lost", target: 0 }, { metric: "lagSec", target: 120 }, { metric: "avail", target: 0.999 }],
        reference: s => { byLabel(s, "BD").autoscale = true; return s; },
    },
    {
        id: "particiones",
        level: 2,
        start: () => build([
            { ref: "c", kind: "client", label: "Eventos", col: 0, capacity: 300 },
            { ref: "k", kind: "queue", label: "Kafka", col: 1, queue: 50000, partitions: 2 },
            { ref: "w", kind: "worker", label: "Procesador", col: 2, capacity: 1000, latency: 50 },
        ], [["c", "k"], ["k", "w"]]),
        sim: { warmup: 0, seconds: 300, dt: 0.5 },
        goals: [{ metric: "lagSec", target: 30 }, { metric: "lost", target: 0 }],
        reference: s => { byLabel(s, "Kafka").partitions = 16; return s; },
    },
    {
        id: "pico-cola",
        level: 2,
        start: () => build([
            { ref: "c", kind: "client", label: "Usuarios", col: 0, capacity: 200 },
            { ref: "s", kind: "service", label: "API", col: 1, capacity: 2000, latency: 10 },
            { ref: "w", kind: "worker", label: "Informes", col: 2, capacity: 250, latency: 200 },
        ], [["c", "s"], ["s", "w"]]),
        sim: { seconds: 60, scenario: { loadMult: 6 } },
        goals: [{ metric: "avail", target: 0.999 }, { metric: "lost", target: 0 }, { metric: "lagSec", target: 600 }],
        reference: s => {
            const api = byLabel(s, "API"), w = byLabel(s, "Informes");
            const k = addNode(s, "queue", "Cola", { queue: 100000 });
            unlink(s, api, w);
            link(s, api, k);
            link(s, k, w);
            return s;
        },
    },
    {
        id: "cache",
        level: 2,
        start: () => build([
            { ref: "c", kind: "client", label: "Usuarios", col: 0, capacity: 1000 },
            { ref: "s", kind: "service", label: "Cat\u00E1logo", col: 1, capacity: 1200, latency: 10 },
            { ref: "d", kind: "db", label: "BD", col: 2, capacity: 400, latency: 15 },
        ], [["c", "s"], ["s", "d"]]),
        sim: { seconds: 20 },
        goals: [{ metric: "avail", target: 0.999 }, { metric: "p95", target: 60 }, { metric: "costHr", target: 0.5 }],
        reference: s => { const cache = addNode(s, "cache", "Redis"); link(s, byLabel(s, "Cat\u00E1logo"), cache); return s; },
    },
    {
        id: "reintentos",
        level: 2,
        start: () => build([
            { ref: "c", kind: "client", label: "Usuarios", col: 0, capacity: 300 },
            { ref: "s", kind: "service", label: "Pagos", col: 1, capacity: 2000, latency: 20, retries: 3 },
            { ref: "d", kind: "db", label: "BD", col: 2, capacity: 250, latency: 10 },
        ], [["c", "s"], ["s", "d"]]),
        sim: { seconds: 20 },
        goals: [{ metric: "p95", target: 900 }, { metric: "avail", target: 0.8 }],
        reference: s => { byLabel(s, "Pagos").breaker = true; return s; },
    },
    {
        id: "ddos",
        level: 2,
        start: () => build([
            { ref: "c", kind: "client", label: "Usuarios", col: 0, capacity: 200 },
            { ref: "x", kind: "attacker", label: "Botnet", col: 0, row: 1, capacity: 5000 },
            { ref: "g", kind: "gateway", label: "Gateway", col: 1 },
            { ref: "s", kind: "service", label: "Web", col: 2, capacity: 1000, latency: 10 },
            { ref: "d", kind: "db", label: "BD", col: 3, capacity: 2000, latency: 10 },
        ], [["c", "g"], ["x", "g"], ["g", "s"], ["s", "d"]]),
        sim: { seconds: 20 },
        goals: [{ metric: "legitAvail", target: 0.95 }],
        reference: s => {
            const g = byLabel(s, "Gateway"), waf = addNode(s, "waf", "WAF");
            for (const src of ["Usuarios", "Botnet"]) {
                unlink(s, byLabel(s, src), g);
                link(s, byLabel(s, src), waf);
            }
            link(s, waf, g);
            return s;
        },
    },
    {
        id: "caida-llm",
        level: 1,
        start: () => build([
            { ref: "c", kind: "client", label: "Usuarios", col: 0, capacity: 10 },
            { ref: "a", kind: "ai_agent", label: "Agente", col: 1 },
            { ref: "r", kind: "ai_router", label: "Router LLM", col: 2, ai: { model: "gpt-6-1-sol", fallback_model: "" } },
        ], [["c", "a"], ["a", "r"]]),
        sim: { seconds: 20, scenario: { downKinds: ["ai_router"] } },
        goals: [{ metric: "avail", target: 0.9 }],
        reference: s => { byLabel(s, "Router LLM").ai = { ...byLabel(s, "Router LLM").ai, fallback_model: "gpt-6-luna" }; return s; },
    },
    {
        id: "presupuesto",
        level: 3,
        start: () => build([
            { ref: "c", kind: "client", label: "Usuarios", col: 0, capacity: 200 },
            { ref: "l", kind: "lb", label: "LB", col: 1 },
            { ref: "s1", kind: "service", label: "App 1", col: 2, row: 0, capacity: 1000, latency: 15 },
            { ref: "s2", kind: "service", label: "App 2", col: 2, row: 1, capacity: 1000, latency: 15 },
            { ref: "s3", kind: "service", label: "App 3", col: 2, row: 2, capacity: 1000, latency: 15 },
            { ref: "s4", kind: "service", label: "App 4", col: 2, row: 3, capacity: 1000, latency: 15 },
            { ref: "d", kind: "db", label: "BD", col: 3, capacity: 400, latency: 15, replicas: 4 },
        ], [["c", "l"], ["l", "s1"], ["l", "s2"], ["l", "s3"], ["l", "s4"], ["s1", "d"], ["s2", "d"], ["s3", "d"], ["s4", "d"]]),
        sim: { seconds: 20 },
        goals: [{ metric: "avail", target: 0.999 }, { metric: "p95", target: 100 }, { metric: "costHr", target: 0.35 }],
        reference: s => {
            for (const l of ["App 3", "App 4"]) {
                const n = byLabel(s, l);
                s.nodes = s.nodes.filter(x => x !== n);
                s.edges = s.edges.filter(e => e.fromId !== n.id && e.toId !== n.id);
            }
            for (const l of ["App 1", "App 2"])
                byLabel(s, l).capacity = 200;
            byLabel(s, "BD").replicas = 0;
            return s;
        },
    },
    {
        id: "black-friday",
        level: 3,
        start: () => build([
            { ref: "c", kind: "client", label: "Usuarios", col: 0, capacity: 300 },
            { ref: "l", kind: "lb", label: "LB", col: 1 },
            { ref: "a", kind: "service", label: "Tienda A", col: 2, row: 0, capacity: 250, latency: 15 },
            { ref: "b", kind: "service", label: "Tienda B", col: 2, row: 1, capacity: 250, latency: 15 },
            { ref: "d", kind: "db", label: "BD", col: 3, capacity: 800, latency: 15 },
        ], [["c", "l"], ["l", "a"], ["l", "b"], ["a", "d"], ["b", "d"]]),
        sim: { seconds: 60, scenario: { loadMult: 6 } },
        goals: [{ metric: "avail", target: 0.99 }, { metric: "p95", target: 200 }, { metric: "costHr", target: 1.2 }],
        reference: s => {
            const cache = addNode(s, "cache", "Redis");
            for (const l of ["Tienda A", "Tienda B"]) {
                const n = byLabel(s, l);
                n.capacity = 1000;
                link(s, n, cache);
            }
            return s;
        },
    },
];
export function challengeById(id: string | null | undefined): Challenge | undefined { return CHALLENGES.find(c => c.id === id); }
