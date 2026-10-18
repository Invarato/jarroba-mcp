import { ArchNode, ArchEdge, ArchNodeKind, CATALOG, isContainer, DEFAULT_POOL } from "./archsim-model";
import { isAiKind } from "./archsim-ai";
import { isCicdKind } from "./archsim-cicd";
import { SimResult, NodeSim } from "./archsim-sim";
import { estimateDesign } from "./archsim-ai-estimate";
import { aiNodePhysics } from "./archsim-ai-sim";
export function isRuntimeKind(k: string): boolean { return !isContainer(k as ArchNodeKind) && !isCicdKind(k); }
export function deployFailImpact(dep: ArchNode): number {
    const a = dep.ai ?? {};
    const strat = String(a["strategy"] ?? "rolling");
    const autoRb = !!a["auto_rollback"];
    const canary = Math.max(0, Math.min(100, Number(a["canary_pct"]) || 10)) / 100;
    if (strat === "bluegreen")
        return autoRb ? 0.02 : 0.15;
    if (strat === "canary")
        return (autoRb ? 0.5 : 1) * canary;
    if (strat === "recreate")
        return 1;
    return 0.85;
}
function deployState(dep: ArchNode): "sano" | "canary_bad" | "fail" | "rolled_back" {
    const s = dep.ai?.["sim_state"];
    if (s === "sano" || s === "canary_bad" || s === "fail" || s === "rolled_back")
        return s;
    return dep.ai?.["fail_sim"] ? "fail" : "sano";
}
export function deployStateImpact(dep: ArchNode, state = deployState(dep)): number {
    if (state === "sano" || state === "rolled_back")
        return 0;
    if (state === "canary_bad") {
        const canary = Math.max(0, Math.min(100, Number(dep.ai?.["canary_pct"]) || 10)) / 100;
        return canary * (dep.ai?.["auto_rollback"] ? 0.5 : 1);
    }
    return deployFailImpact(dep);
}
export function computeDeployFaults(nodes: ArchNode[], edges: ArchEdge[], forceAll = false): Record<string, number> {
    const byId = new Map(nodes.map(n => [n.id, n]));
    const faults: Record<string, number> = {};
    for (const e of edges) {
        const a = byId.get(e.fromId), b = byId.get(e.toId);
        if (!a || !b)
            continue;
        const dep = a.kind === "ci_deploy" ? a : b.kind === "ci_deploy" ? b : null;
        const target = dep === a ? b : dep === b ? a : null;
        if (!dep || !target || !isRuntimeKind(target.kind))
            continue;
        const impact = forceAll ? deployFailImpact(dep) : deployStateImpact(dep);
        if (impact <= 0)
            continue;
        faults[target.id] = Math.max(faults[target.id] ?? 0, impact);
    }
    return faults;
}
export interface QueueSim {
    backlog: number;
    inRate: number;
    drainRate: number;
    drainCap: number;
    lagSec: number;
    fillInSec: number | null;
    lost: number;
    partitionLimited: boolean;
}
export interface RuntimeSimResult extends SimResult {
    tokensPerReq: number;
    tokensPerSec: number;
    costPerHour: number;
    hasAi: boolean;
    nextQ: Record<string, number>;
    queues: Record<string, QueueSim>;
    hasAsync: boolean;
    e2eP50: number;
    e2eP95: number;
    asyncLost: number;
    asyncThroughput: number;
    edgeFlow: Record<string, number>;
    edgeRetry: Record<string, number>;
    p95Path: string[];
}
interface Physics {
    cap: number;
    svcMs: number;
    costReq: number;
    tokReq: number;
    selfRetries: number;
    backoffSec: number;
    jitter: number;
}
function infraPhysics(n: ArchNode, isSource: boolean): Physics {
    let cap = Math.max(0, n.capacity ?? CATALOG[n.kind].defaults.capacity ?? 0);
    const svcMs = Math.max(0, n.latency ?? 0);
    if (!isSource && n.concurrency === "blocking" && svcMs > 0) {
        cap = Math.min(cap, Math.max(1, n.pool ?? DEFAULT_POOL) / (svcMs / 1000));
    }
    const replicas = Math.max(0, Math.floor(n.replicas ?? 0));
    if (replicas > 0 && cap > 0) {
        const r = Math.max(0, Math.min(1, n.readRatio ?? 0.8));
        cap = cap / ((1 - r) + r / (1 + replicas));
    }
    return { cap, svcMs, costReq: 0, tokReq: 0, selfRetries: 0, backoffSec: 0, jitter: Math.max(0, n.jitter ?? 0) };
}
export function erlangC(c: number, a: number): number {
    let b = 1;
    for (let k = 1; k <= c; k++)
        b = (a * b) / (k + a * b);
    const rho = a / c;
    return b / (1 - rho * (1 - b));
}
function serversOf(n: ArchNode, cap: number, svcMs: number): number {
    if (n.concurrency === "blocking")
        return Math.max(1, Math.min(2000, Math.round(n.pool ?? DEFAULT_POOL)));
    return Math.max(1, Math.min(2000, Math.round(cap * svcMs / 1000)));
}
export function queueWait(lambda: number, cap: number, c: number, svcMs: number, jitter: number, qMax: number): {
    mean: number;
    p50: number;
    p95: number;
} | null {
    if (!(svcMs > 0) || !(cap > 0) || !(lambda > 0))
        return null;
    if (lambda >= cap) {
        if (!(qMax > 0))
            return null;
        const full = (qMax / cap) * 1000;
        return { mean: full, p50: full, p95: full };
    }
    const C = erlangC(c, (lambda / cap) * c);
    const cs = Math.max(0, jitter) / svcMs, v = (1 + cs * cs) / 2;
    const gap = (cap - lambda) / 1000;
    const top = qMax > 0 ? (qMax / cap) * 1000 : Infinity;
    const pct = (p: number) => (C > 1 - p ? Math.min(top, (Math.log(C / (1 - p)) / gap) * v) : 0);
    return { mean: Math.min(top, (C / gap) * v), p50: pct(0.5), p95: pct(0.95) };
}
export const CURVE_U_MAX = 0.97;
export function waitCurve(n: ArchNode, steps = 50, uMax = CURVE_U_MAX): {
    u: number;
    p50: number;
    p95: number;
}[] | null {
    if (isAiKind(n.kind) || isAsyncKind(n.kind) || n.kind === "client" || n.kind === "attacker" || n.kind === "ratelimit")
        return null;
    const p = infraPhysics(n, false);
    if (!(p.svcMs > 0) || !(p.cap > 0))
        return null;
    const c = serversOf(n, p.cap, p.svcMs), qMax = Math.max(0, n.queue ?? 0), out: {
        u: number;
        p50: number;
        p95: number;
    }[] = [];
    for (let i = 0; i <= steps; i++) {
        const u = uMax * i / steps, w = queueWait(u * p.cap, p.cap, c, p.svcMs, p.jitter, qMax);
        out.push({ u, p50: p.svcMs + (w?.p50 ?? 0), p95: p.svcMs + (w?.p95 ?? 0) });
    }
    return out;
}
export interface RuntimeScenario {
    loadMult?: number;
    attackRate?: number;
    downKinds?: string[];
    instantScale?: boolean;
}
export const DEFAULT_SCALE_DELAY_SEC = 60;
export const SCALE_DOWN_SEC = 300;
export const RETRY_BUDGET = 0.1;
export const SPLIT_KINDS: ReadonlySet<string> = new Set(["client", "attacker", "lb", "gateway", "waf", "ratelimit", "cdn", "queue"]);
export function fanoutOf(n: ArchNode): "split" | "all" {
    if (n.fanout === "split" || n.fanout === "all")
        return n.fanout;
    if (isAiKind(n.kind))
        return "all";
    return SPLIT_KINDS.has(n.kind) ? "split" : "all";
}
export const DEFAULT_HIT: Readonly<Record<string, number>> = { cache: 0.8, cdn: 0.9 };
export function hitRatioOf(n: ArchNode): number | null {
    if (!(n.kind in DEFAULT_HIT))
        return null;
    const h = n.hitRatio ?? DEFAULT_HIT[n.kind];
    return Number.isFinite(h) ? Math.max(0, Math.min(1, h)) : DEFAULT_HIT[n.kind];
}
const DATASTORE_KINDS: ReadonlySet<string> = new Set(["db", "nosql", "search", "objstore"]);
export const SERVERLESS_IDLE_SEC = 600;
export function isAsyncKind(k: string): boolean { return k === "queue" || k === "pubsub"; }
export const subKey = (busId: string, consumerId: string): string => `${busId}>${consumerId}`;
export function runtimeToSteady(nodes: ArchNode[], edges: ArchEdge[], reqRate: number, steps = 400, dt = 0.05): RuntimeSimResult {
    let q: Record<string, number> = {};
    const faults = computeDeployFaults(nodes, edges);
    const scn: RuntimeScenario = { instantScale: true };
    let res = stepRuntimeSim(nodes, edges, q, dt, reqRate, faults, scn);
    for (let i = 0; i < steps; i++) {
        res = stepRuntimeSim(nodes, edges, q, dt, reqRate, faults, scn);
        q = res.nextQ;
    }
    return res;
}
export function stepRuntimeSim(allNodes: ArchNode[], edges: ArchEdge[], prevQ: Record<string, number>, dt: number, reqRate: number, faults: Record<string, number> = {}, scn: RuntimeScenario = {}): RuntimeSimResult {
    const nodes = allNodes.filter(n => isRuntimeKind(n.kind));
    const ids = nodes.map(n => n.id);
    const byId = new Map(nodes.map(n => [n.id, n]));
    const outAdj = new Map<string, string[]>(ids.map(id => [id, []]));
    const inAdj = new Map<string, string[]>(ids.map(id => [id, []]));
    const indeg = new Map<string, number>(ids.map(id => [id, 0]));
    for (const e of edges) {
        if (!byId.has(e.fromId) || !byId.has(e.toId))
            continue;
        outAdj.get(e.fromId)!.push(e.toId);
        inAdj.get(e.toId)!.push(e.fromId);
        indeg.set(e.toId, (indeg.get(e.toId) ?? 0) + 1);
    }
    const hasAi = nodes.some(n => isAiKind(n.kind));
    const isSource = (id: string) => { const n = byId.get(id)!; return n.kind === "client" || (inAdj.get(id)!.length === 0); };
    const marked = (n: ArchNode) => !!n.down || !!scn.downKinds?.includes(n.kind);
    const hasFallback = (n: ArchNode) => n.kind === "ai_router" && !!n.ai?.["fallback_model"];
    const isDown = (n: ArchNode) => marked(n) && !hasFallback(n);
    const wantScale: Record<string, number> = {};
    const scaledCap = (id: string, base: number, demand: number): number => {
        const top = base * 5, want = Math.min(top, Math.max(base, demand * 1.2));
        if (scn.instantScale)
            return want;
        wantScale[id] = Math.max(wantScale[id] ?? 0, want);
        return Math.min(top, Math.max(base, prevQ[`${id}#as`] ?? base));
    };
    const advanceScale = (n: ArchNode, id: string, base: number) => {
        if (!n.autoscale || scn.instantScale)
            return;
        const cur = Math.min(base * 5, Math.max(base, prevQ[`${id}#as`] ?? base));
        const want = wantScale[id] ?? base;
        const delay = Math.max(0, n.scaleDelaySec ?? DEFAULT_SCALE_DELAY_SEC);
        const tau = want > cur ? delay : SCALE_DOWN_SEC;
        nextQ[`${id}#as`] = tau <= 0 ? want : cur + (want - cur) * Math.min(1, dt / tau);
    };
    const deg = new Map(indeg);
    const q0ids = ids.filter(id => (deg.get(id) ?? 0) === 0);
    const order: string[] = [];
    const seen = new Set<string>();
    while (q0ids.length) {
        const id = q0ids.shift()!;
        order.push(id);
        seen.add(id);
        for (const to of outAdj.get(id) ?? []) {
            deg.set(to, (deg.get(to) ?? 0) - 1);
            if ((deg.get(to) ?? 0) === 0)
                q0ids.push(to);
        }
    }
    for (const id of ids)
        if (!seen.has(id))
            order.push(id);
    const phys = new Map<string, Physics>();
    for (const id of ids) {
        const n = byId.get(id)!;
        phys.set(id, isAiKind(n.kind) ? aiNodePhysics(marked(n) ? { ...n, down: true } : n) : infraPhysics(n, isSource(id)));
    }
    const perNode: Record<string, NodeSim> = {};
    const legitOut: Record<string, number> = {};
    const attackOut: Record<string, number> = {};
    const edgeOut = new Map<string, [
        number,
        number
    ]>();
    const nodeCost: Record<string, number> = {};
    const nodeTok: Record<string, number> = {};
    const pathBase: Record<string, number> = {};
    const pathFull: Record<string, number> = {};
    const e2eBase: Record<string, number> = {};
    const e2eFull: Record<string, number> = {};
    const nextQ: Record<string, number> = {};
    const edgeFlow: Record<string, number> = {};
    const edgeProb = new Map<string, number>();
    const edgeShare = new Map<string, number>();
    const passL: Record<string, number> = {};
    const passA: Record<string, number> = {};
    const coldExtra: Record<string, {
        p50: number;
        p95: number;
    }> = {};
    const prev95: Record<string, string> = {};
    const selfWait: [
        number,
        number
    ] = [0, 0];
    const retryMult = new Map<string, number>();
    const retryExtra = new Map<string, [
        number,
        number
    ]>();
    const retriesOf = (n: ArchNode) => (isAiKind(n.kind) || isAsyncKind(n.kind) ? 0 : Math.max(0, Math.floor(n.retries ?? 0)));
    const attempts = (id: string, t: string, n: ArchNode): number => {
        const r = retriesOf(n);
        if (!r)
            return 1;
        const f = Math.max(0, Math.min(1, prevQ[`${id}>${t}#f`] ?? 0));
        let m = 0;
        for (let k = 0, fk = 1; k <= r; k++, fk *= f)
            m += fk;
        if (n.breaker)
            m = Math.min(m, 1 + RETRY_BUDGET);
        let left = m - 1, e50 = 0, e95 = 0;
        for (let k = 1, fk = f; k <= r; k++, fk *= f) {
            const pk = Math.min(fk, left);
            left -= pk;
            if (pk >= 0.5 - 1e-9)
                e50++;
            if (pk >= 0.05 - 1e-9)
                e95++;
        }
        retryExtra.set(`${id}>${t}`, [e50, e95]);
        return m;
    };
    const route = (id: string, n: ArchNode) => {
        const outs = outAdj.get(id)!;
        if (!outs.length)
            return;
        const mode = fanoutOf(n);
        const healthy = outs.filter(t => !isDown(byId.get(t)!));
        const pool = mode === "split" && healthy.length ? healthy : outs;
        const hitSelf = hitRatioOf(n);
        const asideHit = Math.max(0, ...outs.map(t => hitRatioOf(byId.get(t)!) ?? 0));
        for (const t of outs) {
            const share = mode === "split" ? (pool.includes(t) ? 1 / pool.length : 0) : 1;
            let w = 1;
            if (hitSelf !== null)
                w = 1 - hitSelf;
            else if (asideHit > 0 && DATASTORE_KINDS.has(byId.get(t)!.kind))
                w = 1 - asideHit;
            const key = `${id}>${t}`;
            const m = attempts(id, t, n);
            edgeShare.set(key, share);
            edgeProb.set(key, w);
            retryMult.set(key, m);
            edgeOut.set(key, [(legitOut[id] ?? 0) * share * w * m, (attackOut[id] ?? 0) * share * w * m]);
        }
    };
    const queues: Record<string, QueueSim> = {};
    const inAsync: Record<string, boolean> = {};
    const asyncBoundary = (id: string) => { const n = byId.get(id)!; return isAsyncKind(n.kind) && !isSource(id) && outAdj.get(id)!.length > 0; };
    const pullCap = (bus: ArchNode, cid: string, demand: number, share: number): {
        cap: number;
        partLimited: boolean;
    } => {
        const c = byId.get(cid)!;
        const pc = phys.get(cid)!;
        if (isDown(c))
            return { cap: 0, partLimited: false };
        let cap = Math.max(0, pc.cap);
        if (c.autoscale)
            cap = scaledCap(cid, pc.cap, demand);
        const parts = Math.max(0, Math.floor(bus.partitions ?? 0)) * share;
        if (parts > 0 && pc.svcMs > 0) {
            const partCap = parts * 1000 / pc.svcMs;
            if (partCap < cap)
                return { cap: partCap, partLimited: true };
        }
        return { cap, partLimited: false };
    };
    for (const id of order) {
        const n = byId.get(id)!;
        const p = phys.get(id)!;
        const source = isSource(id);
        const down = isDown(n);
        const loadMult = scn.loadMult ?? 1;
        const fr = Math.max(0, Math.min(1, (n.failRate ?? 0) + (faults[id] ?? 0)));
        nodeCost[id] = p.costReq;
        nodeTok[id] = p.tokReq;
        const ups = inAdj.get(id)!;
        inAsync[id] = !source && ups.length > 0 && ups.every(u => asyncBoundary(u) || inAsync[u]);
        let legitIn = 0, attackIn = 0;
        if (source) {
            if (n.kind === "attacker")
                attackIn = down ? 0 : p.cap;
            else if (n.kind === "client") {
                legitIn = down ? 0 : p.cap * loadMult;
                attackIn += scn.attackRate ?? 0;
            }
            else
                legitIn = down ? 0 : reqRate * loadMult;
        }
        else {
            for (const up of ups) {
                const upNode = byId.get(up)!;
                const isQueueLike = isAsyncKind(upNode.kind);
                const redeliveryFrac = isQueueLike ? Math.max(0, Math.min(100, upNode.redelivery ?? 0)) / 100 : 0;
                const dupMult = redeliveryFrac > 0 && n.idempotent !== true ? 1 + redeliveryFrac : 1;
                const viaEdge = edgeOut.get(`${up}>${id}`);
                if (!viaEdge)
                    continue;
                legitIn += viaEdge[0] * dupMult;
                attackIn += viaEdge[1] * dupMult;
                edgeFlow[`${up}>${id}`] = viaEdge[0] + viaEdge[1];
            }
        }
        const attackInRaw = attackIn;
        if (n.kind === "waf")
            attackIn *= (1 - Math.max(0, Math.min(1, n.wafEff ?? 0.9)));
        let lambdaIn = legitIn + attackIn;
        const legitFrac0 = lambdaIn > 0 ? legitIn / lambdaIn : 1;
        let ub = 0, uf = 0, eb = 0, ef = 0;
        for (const u of ups) {
            ub = Math.max(ub, pathBase[u] ?? 0);
            if ((pathFull[u] ?? 0) > uf || prev95[id] === undefined) {
                uf = Math.max(uf, pathFull[u] ?? 0);
                prev95[id] = u;
            }
            eb = Math.max(eb, e2eBase[u] ?? 0);
            ef = Math.max(ef, e2eFull[u] ?? 0);
        }
        if (asyncBoundary(id)) {
            const qMax = Math.max(0, n.queue ?? 0);
            const consumers = outAdj.get(id)!;
            const accepted = down ? 0 : Math.min(lambdaIn, Math.max(0, p.cap));
            const rejected = lambdaIn - accepted;
            const acceptedErr = accepted * fr;
            const acceptedOk = accepted - acceptedErr;
            let drainedTotal = 0, lostTotal = 0, drainCapTotal = 0, partLimited = false, backlogMax = 0, lagSec = 0;
            let fillIn: number | null = null;
            const fan = n.kind === "pubsub";
            const lanes = fan ? consumers.map(c => [c]) : [consumers];
            for (const lane of lanes) {
                const key = fan ? subKey(id, lane[0]) : id;
                const q0 = Math.max(0, prevQ[key] ?? 0);
                const demand = acceptedOk + q0 / 10;
                const caps = lane.map(c => pullCap(n, c, fan ? demand : demand / lane.length, fan ? 1 : 1 / lane.length));
                const drainCap = caps.reduce((a, c) => a + c.cap, 0);
                partLimited ||= caps.some(c => c.partLimited);
                const avail = q0 + acceptedOk * dt;
                const drained = down ? 0 : Math.min(avail, drainCap * dt);
                let q1 = avail - drained, lost = 0;
                if (down) {
                    lost = avail;
                    q1 = 0;
                }
                else if (qMax > 0 && q1 > qMax) {
                    lost = q1 - qMax;
                    q1 = qMax;
                }
                nextQ[key] = q1;
                const drainRate = drained / dt;
                lane.forEach((c, i) => {
                    const f = drainCap > 0 ? caps[i].cap / drainCap : 0;
                    edgeOut.set(`${id}>${c}`, [drainRate * f * legitFrac0, drainRate * f * (1 - legitFrac0)]);
                });
                const growth = acceptedOk - drainCap;
                const laneLag = drainCap > 0 ? q1 / drainCap : (q1 > 0 ? Infinity : 0);
                if (q1 >= backlogMax) {
                    backlogMax = q1;
                    lagSec = laneLag;
                }
                if (qMax > 0 && growth > 0 && q1 < qMax) {
                    const t = (qMax - q1) / growth;
                    fillIn = fillIn === null ? t : Math.min(fillIn, t);
                }
                drainedTotal += drainRate;
                lostTotal += lost / dt;
                drainCapTotal += drainCap;
            }
            nextQ[id] = backlogMax;
            passL[id] = passA[id] = lambdaIn > 0 ? acceptedOk / lambdaIn : 1;
            for (const c of consumers) {
                edgeProb.set(`${id}>${c}`, 1);
                edgeShare.set(`${id}>${c}`, fan ? 1 : 1 / consumers.length);
            }
            queues[id] = { backlog: backlogMax, inRate: acceptedOk, drainRate: drainedTotal, drainCap: drainCapTotal, lagSec, fillInSec: fillIn, lost: lostTotal, partitionLimited: partLimited };
            legitOut[id] = acceptedOk * legitFrac0;
            attackOut[id] = acceptedOk * (1 - legitFrac0);
            const rho = down ? (lambdaIn > 0 ? 2 : 0) : (p.cap > 0 ? lambdaIn / p.cap : 0);
            perNode[id] = { q: backlogMax, lambdaIn, rho, served: drainedTotal, dropped: rejected + lostTotal, errored: acceptedErr, delayMs: p.svcMs, down };
            pathBase[id] = ub + p.svcMs;
            pathFull[id] = uf + p.svcMs;
            e2eBase[id] = eb + p.svcMs;
            e2eFull[id] = ef + p.svcMs + (Number.isFinite(lagSec) ? lagSec * 1000 : 0);
            continue;
        }
        let effCap = Math.max(0.001, p.cap);
        if (n.autoscale && !down && !source)
            effCap = scaledCap(id, p.cap, lambdaIn);
        const lambdaReq = lambdaIn;
        let selfF = 0, selfM = 1;
        if (p.selfRetries > 0 && !source && !down) {
            selfF = Math.max(0, Math.min(1, prevQ[`${id}#rf`] ?? 0));
            selfM = 0;
            for (let k = 0, fk = 1; k <= p.selfRetries; k++, fk *= selfF)
                selfM += fk;
            if (n.breaker)
                selfM = Math.min(selfM, 1 + RETRY_BUDGET);
            lambdaIn *= selfM;
        }
        let breakerShed = 0;
        const lambdaMix = lambdaReq;
        if (n.breaker && !source && !down && lambdaIn > effCap) {
            breakerShed = lambdaIn - effCap;
            lambdaIn = effCap;
        }
        const qMax = isAiKind(n.kind) ? 200 : Math.max(0, n.queue ?? 0);
        const q0 = Math.max(0, prevQ[id] ?? 0);
        const inflow = lambdaIn * dt;
        let served: number, q1: number, droppedReq = breakerShed * dt;
        const cold = Math.max(0, n.coldStartMs ?? 0);
        if (cold > 0 && !source) {
            const wk = `${id}#warm`, warm0 = Math.max(0, prevQ[wk] ?? 0);
            const coldFrac = lambdaIn > warm0 && lambdaIn > 0 ? (lambdaIn - warm0) / lambdaIn : 0;
            nextQ[wk] = lambdaIn >= warm0 ? lambdaIn : warm0 * Math.exp(-dt / SERVERLESS_IDLE_SEC);
            coldExtra[id] = { p50: coldFrac >= 0.5 ? cold : 0, p95: coldFrac >= 0.05 ? cold : 0 };
        }
        if (n.kind === "ratelimit" && !source && !down) {
            const tk = `${id}#tok`, burst = Math.max(0, n.burst ?? effCap);
            const avail = Math.min(burst, prevQ[tk] ?? burst) + effCap * dt;
            served = Math.min(inflow, avail);
            nextQ[tk] = Math.min(burst, avail - served);
            droppedReq += inflow - served;
            q1 = 0;
        }
        else if (down && !source) {
            served = 0;
            droppedReq = q0 + inflow;
            q1 = 0;
        }
        else {
            const canServe = (source ? Infinity : effCap) * dt;
            const avail = q0 + inflow;
            served = Math.min(canServe, avail);
            q1 = avail - served;
            if (!source && qMax > 0 && q1 > qMax) {
                droppedReq += q1 - qMax;
                q1 = qMax;
            }
        }
        nextQ[id] = q1;
        let servedRate = served / dt;
        if (p.selfRetries > 0 && !source && !down) {
            const att = lambdaReq * selfM, fNow = att > 0 ? Math.max(0, Math.min(1, droppedReq / dt / att)) : 0;
            nextQ[`${id}#rf`] = p.backoffSec > 0 ? selfF + (fNow - selfF) * Math.min(1, dt / (2 * p.backoffSec)) : fNow;
            servedRate = Math.min(servedRate, lambdaReq);
        }
        const erroredRate = source ? 0 : servedRate * fr;
        const outRate = servedRate - erroredRate;
        const legitFrac = lambdaMix > 0 ? legitIn / lambdaMix : 1;
        legitOut[id] = outRate * legitFrac;
        attackOut[id] = outRate * (1 - legitFrac);
        const rho = down && !source ? (lambdaIn > 0 ? 2 : 0) : (effCap > 0 && !source ? lambdaIn / effCap : 0);
        const waitMs = (!down && effCap > 0) ? (q1 / effCap) * 1000 : 0;
        const qw = source || down || n.kind === "ratelimit" ? null
            : queueWait(lambdaIn, effCap, serversOf(n, effCap, p.svcMs), p.svcMs, p.jitter, breakerShed > 0 ? 0 : qMax);
        const delayMs = p.svcMs + Math.max(waitMs, qw?.mean ?? 0);
        perNode[id] = { q: q1, lambdaIn, rho, served: outRate, dropped: droppedReq / dt, errored: erroredRate, delayMs, down, degraded: marked(n) && !down || undefined };
        if (qw && waitMs < 1e-9 && lambdaIn < effCap) {
            perNode[id].queueWaitMs = qw.mean;
            perNode[id].waitingAvg = lambdaIn * qw.mean / 1000;
        }
        if (selfM > 1 + 0.000001) {
            perNode[id].retryX = selfM;
            perNode[id].retryCapped = !!n.breaker && selfM >= 1 + RETRY_BUDGET - 1e-9;
        }
        passL[id] = source ? 1 : legitIn > 0 ? Math.min(1, legitOut[id] / legitIn) : 1;
        const blocked = n.kind === "waf" ? attackInRaw - attackIn : 0;
        passA[id] = source ? 1 : attackInRaw > 0 ? Math.min(1, (attackOut[id] + blocked) / attackInRaw) : 1;
        route(id, n);
        const ce = coldExtra[id] ?? { p50: 0, p95: 0 };
        let r50 = 0, r95 = 0;
        for (const u of ups) {
            const x = retryExtra.get(`${u}>${id}`);
            if (x) {
                r50 = Math.max(r50, x[0]);
                r95 = Math.max(r95, x[1]);
            }
        }
        let rb = r50 * p.svcMs, rf = r95 * delayMs;
        const w50 = Math.max(waitMs, qw?.p50 ?? 0), w95 = Math.max(waitMs, qw?.p95 ?? 0);
        if (p.selfRetries > 0 && p.backoffSec > 0) {
            let left = selfM - 1, w50 = 0, w95 = 0;
            for (let k = 1, fk = selfF; k <= p.selfRetries; k++, fk *= selfF) {
                const pk = Math.min(fk, left);
                left -= pk;
                const wait = p.backoffSec * 1000 * 2 ** (k - 1);
                if (pk >= 0.5 - 1e-9)
                    w50 += wait;
                if (pk >= 0.05 - 1e-9)
                    w95 += wait;
            }
            rb += w50;
            rf += w95;
            selfWait[0] = Math.max(selfWait[0], w50);
            selfWait[1] = Math.max(selfWait[1], w95);
        }
        pathBase[id] = ub + (source ? 0 : p.svcMs + w50 + ce.p50 + rb);
        pathFull[id] = uf + (source ? 0 : p.svcMs + w95 + ce.p95 + rf);
        e2eBase[id] = eb + (source ? 0 : p.svcMs + w50 + ce.p50 + rb);
        e2eFull[id] = ef + (source ? 0 : p.svcMs + w95 + ce.p95 + rf);
    }
    for (const id of order)
        advanceScale(byId.get(id)!, id, phys.get(id)!.cap);
    const hasAsync = Object.keys(queues).length > 0;
    const memo = [new Map<string, number>(), new Map<string, number>()];
    const succ = (id: string, cls: 0 | 1, depth = 0): number => {
        const m = memo[cls];
        const hit = m.get(id);
        if (hit !== undefined)
            return hit;
        if (depth > 64)
            return 1;
        m.set(id, 1);
        const own = (cls === 0 ? passL[id] : passA[id]) ?? 1;
        let rest = 1;
        if (!asyncBoundary(id)) {
            const outs = outAdj.get(id)!;
            if (outs.length) {
                const split = fanoutOf(byId.get(id)!) === "split";
                let acc = split ? 0 : 1;
                for (const t of outs) {
                    const k = `${id}>${t}`, w = edgeProb.get(k) ?? 1, sh = edgeShare.get(k) ?? (split ? 1 / outs.length : 1);
                    const leg = 1 - w + w * Math.min(1, succ(t, cls, depth + 1) * (retryMult.get(k) ?? 1));
                    if (split)
                        acc += sh * leg;
                    else
                        acc *= leg;
                }
                rest = acc;
            }
        }
        const v = Math.max(0, Math.min(1, own * rest));
        m.set(id, v);
        return v;
    };
    const edgeRetry: Record<string, number> = {};
    for (const [k, m] of retryMult)
        if (m > 1 + 0.000001) {
            edgeRetry[k] = m;
            const from = k.slice(0, k.indexOf(">")), s = perNode[from];
            if (s) {
                s.retryX = Math.max(s.retryX ?? 1, m);
                if (byId.get(from)?.breaker)
                    s.retryCapped = m >= 1 + RETRY_BUDGET - 1e-9;
            }
        }
    for (const id of order) {
        if (!retriesOf(byId.get(id)!) || asyncBoundary(id))
            continue;
        for (const t of outAdj.get(id)!)
            nextQ[`${id}>${t}#f`] = 1 - succ(t, 0);
    }
    const prob: Record<string, number> = {};
    for (const id of order) {
        if (isSource(id)) {
            prob[id] = 1;
            continue;
        }
        let pr = 0;
        for (const u of inAdj.get(id)!)
            pr = Math.max(pr, (prob[u] ?? 0) * (edgeProb.get(`${u}>${id}`) ?? 1));
        prob[id] = pr;
    }
    let offered = 0, throughput = 0, dropped = 0, errored = 0, bnRho = -1;
    let legitOffered = 0, attackOffered = 0, legitThroughput = 0, tokensPerReq = 0, costPerReq = 0;
    let asyncLost = 0, asyncThroughput = 0, attackOk = 0;
    let bottleneck: string | null = null;
    const respEnds: [
        string,
        number
    ][] = [];
    const e2eEnds: [
        string,
        number
    ][] = [];
    for (const id of ids) {
        const s = perNode[id];
        if (!s)
            continue;
        const nn = byId.get(id)!;
        if (isSource(id)) {
            const forced = nn.down || !!scn.downKinds?.includes(nn.kind);
            const legitEmit = forced ? 0 : (nn.kind === "attacker" ? 0 : (nn.kind === "client" ? (nn.capacity ?? 0) : reqRate) * (scn.loadMult ?? 1));
            const atkEmit = (nn.kind === "attacker" ? (forced ? 0 : (nn.capacity ?? 0)) : 0) + (nn.kind === "client" ? (scn.attackRate ?? 0) : 0);
            offered += legitEmit + atkEmit;
            legitOffered += legitEmit;
            attackOffered += atkEmit;
            legitThroughput += legitEmit * succ(id, 0);
            attackOk += atkEmit * succ(id, 1);
        }
        const q = queues[id];
        const sink = outAdj.get(id)!.length === 0 && !isSource(id);
        if (inAsync[id]) {
            asyncLost += s.dropped + s.errored;
            if (sink) {
                asyncThroughput += s.served;
                e2eEnds.push([id, prob[id] ?? 1]);
            }
        }
        else if (q) {
            dropped += s.dropped - q.lost;
            errored += s.errored;
            asyncLost += q.lost;
            respEnds.push([id, prob[id] ?? 1]);
        }
        else {
            if (sink)
                respEnds.push([id, prob[id] ?? 1]);
            else {
                const h = hitRatioOf(nn);
                if (h !== null && !isSource(id))
                    respEnds.push([id, (prob[id] ?? 1) * h]);
            }
            dropped += s.dropped;
            errored += s.errored;
        }
        if (s.lambdaIn > 0.0001) {
            tokensPerReq += nodeTok[id];
            costPerReq += nodeCost[id];
        }
        if (!isSource(id) && s.rho > bnRho) {
            bnRho = s.rho;
            bottleneck = id;
        }
    }
    throughput = legitThroughput + Math.max(0, attackOk);
    let pctEnd: string | null = null;
    const pct = (ends: [
        string,
        number
    ][], path: Record<string, number>, thr: number) => {
        let v = -1;
        pctEnd = null;
        for (const [id, pr] of ends)
            if (pr >= thr - 1e-9 && (path[id] ?? 0) > v) {
                v = path[id] ?? 0;
                pctEnd = id;
            }
        if (v < 0)
            for (const [id] of ends)
                if ((path[id] ?? 0) > v) {
                    v = path[id] ?? 0;
                    pctEnd = id;
                }
        return Math.max(0, v);
    };
    let p50 = pct(respEnds, pathBase, 0.5);
    let p95 = pct(respEnds, pathFull, 0.05);
    const p95Path: string[] = [];
    for (let id: string | null = pctEnd, guard = 0; id && guard < 200; id = prev95[id] ?? null, guard++) {
        if (p95Path.includes(id))
            break;
        p95Path.unshift(id);
    }
    let e2eP50 = pct(e2eEnds, e2eBase, 0.5), e2eP95 = pct(e2eEnds, e2eFull, 0.05);
    const availability = offered > 0 ? Math.max(0, Math.min(1, throughput / offered)) : 1;
    const fail = 1 - availability, de = dropped + errored;
    const dropRate = de > 0 ? fail * dropped / de : fail;
    const errorRate = de > 0 ? fail * errored / de : 0;
    const legitAvailability = legitOffered > 0 ? Math.max(0, Math.min(1, legitThroughput / legitOffered)) : 1;
    if (hasAi) {
        const est = estimateDesign(allNodes, edges);
        if (est.p50 > 0) {
            p50 = est.p50 + selfWait[0];
            p95 = Math.round(est.p95 * Math.max(1, bnRho > 0 ? bnRho : 1)) + selfWait[1];
        }
    }
    if (!hasAsync) {
        e2eP50 = p50;
        e2eP95 = p95;
    }
    else {
        e2eP50 = Math.max(e2eP50, p50);
        e2eP95 = Math.max(e2eP95, p95);
    }
    const tokensPerSec = (throughput + asyncThroughput) * tokensPerReq;
    const costPerHour = (throughput + asyncThroughput) * costPerReq * 3600;
    return {
        perNode,
        offered,
        throughput,
        dropRate,
        errorRate,
        availability,
        p50,
        p95,
        legitOffered,
        attackOffered,
        legitAvailability,
        underAttack: attackOffered > 0,
        bottleneck: bnRho > 0.01 ? bottleneck : null,
        tokensPerReq,
        tokensPerSec,
        costPerHour,
        hasAi,
        nextQ,
        queues,
        hasAsync,
        e2eP50,
        e2eP95,
        asyncLost,
        asyncThroughput,
        edgeFlow,
        edgeRetry,
        p95Path,
    };
}
