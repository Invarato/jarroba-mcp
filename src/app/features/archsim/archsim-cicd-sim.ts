import { INFORMES, InformeConNiveles, NivelDora, ResultadoMetrica, clasificarAnyo, nivelUnico } from "../../shared/dora";
import { ArchNode, ArchEdge } from "./archsim-model";
import { CicdNodeKind, isCicdKind } from "./archsim-cicd";
import { SimResult, NodeSim } from "./archsim-sim";
const num = (v: unknown, d = 0) => { const n = Number(v); return isNaN(n) ? d : n; };
const frac = (v: unknown) => Math.max(0, Math.min(1, num(v) / 100));
export type DoraTier = NivelDora;
export interface CicdSimResult extends SimResult {
    leadP50: number;
    leadP95: number;
    execMin: number;
    queueMin: number;
    deploysPerDay: number;
    runnerUtil: number;
    costPerMonth: number;
    queueLen: number;
    dora: DoraTier;
    hasMergeQ: boolean;
    mergedPerDay: number;
    batchPassRate: number;
    changeFailRate: number;
    recoveryMin: number;
    deployStrategy: string;
}
const STAGE_LIKE = new Set<string>(["ci_stage", "ci_promptlint", "ci_evalgate", "ci_ragindex"]);
export const DORA_INFORME: InformeConNiveles = INFORMES.reduce((a, b) => (b.anyo > a.anyo ? b : a));
const nivel = (r: ResultadoMetrica): DoraTier => nivelUnico(r) ?? "low";
const ORDEN: Record<DoraTier, number> = { elite: 0, high: 1, medium: 2, low: 3 };
export function cfrTier(cfr: number): DoraTier { return nivel(clasificarAnyo(DORA_INFORME, { cfr: cfr * 100 }).porMetrica.cfr); }
export function recoveryTier(min: number): DoraTier { return nivel(clasificarAnyo(DORA_INFORME, { recuperacionHoras: min / 60 }).porMetrica.recuperacion); }
export function doraTier(leadMin: number, deploysDay: number): DoraTier {
    const c = clasificarAnyo(DORA_INFORME, { leadHoras: leadMin / 60, desplieguesDia: deploysDay });
    const a = nivel(c.porMetrica.lead), b = nivel(c.porMetrica.frecuencia);
    return ORDEN[a] >= ORDEN[b] ? a : b;
}
export function stepCicdSim(allNodes: ArchNode[], edges: ArchEdge[], prevQ: Record<string, number>, dt: number, arrival: number): CicdSimResult {
    const cicd = allNodes.filter(n => isCicdKind(n.kind));
    const pool = cicd.find(n => n.kind === "ci_runners");
    let M = pool ? Math.max(1, num(pool.ai?.["size"], 10)) : 1000000;
    const costMin = pool ? num(pool.ai?.["cost_min"], 0.008) : 0.008;
    const autoscale = !!pool?.ai?.["autoscale"];
    const runnerSpeedMul = String(pool?.ai?.["runner_type"] ?? "small") === "large" ? 1.6 : 1;
    const mq = cicd.find(n => n.kind === "ci_mergeq");
    const strategy = String(mq?.ai?.["strategy"] ?? "batch");
    const effBatch = mq ? (strategy === "serial" ? 1 : Math.max(1, num(mq.ai?.["batch_size"], 1))) : 1;
    const batchPassRate = mq ? Math.pow(1 - frac(mq.ai?.["pr_fail"]), effBatch) : 1;
    const bisect = !!mq?.ai?.["bisect"];
    const reRunFactor = 1 + (1 - batchPassRate) * (bisect ? Math.log2(effBatch + 1) / effBatch : 1);
    const pipelineArrival = arrival / effBatch;
    const flow = cicd.filter(n => n.kind !== "ci_runners");
    const ids = flow.map(n => n.id);
    const byId = new Map(flow.map(n => [n.id, n]));
    const outAdj = new Map<string, string[]>(ids.map(id => [id, []]));
    const inAdj = new Map<string, string[]>(ids.map(id => [id, []]));
    for (const e of edges) {
        if (byId.has(e.fromId) && byId.has(e.toId)) {
            outAdj.get(e.fromId)!.push(e.toId);
            inAdj.get(e.toId)!.push(e.fromId);
        }
    }
    const isSource = (id: string) => byId.get(id)!.kind === "ci_trigger" || inAdj.get(id)!.length === 0;
    const cacheUpstream = (id: string) => inAdj.get(id)!.map(i => byId.get(i)!).find(n => n.kind === "ci_cache");
    const stageWall = new Map<string, number>();
    const stageRunnerMin = new Map<string, number>();
    const stageShards = new Map<string, number>();
    for (const n of flow) {
        const a = n.ai ?? {};
        let wall = 0, runnerMin = 0, shards = 1;
        if (n.kind === "ci_stage") {
            shards = Math.max(1, num(a["shards"], 1));
            let dur = num(a["duration"], 5) / runnerSpeedMul;
            const cache = a["cacheable"] ? cacheUpstream(n.id) : undefined;
            if (cache) {
                const cf = 1 - frac(cache.ai?.["hit_rate"]) * frac(cache.ai?.["saves"]);
                dur *= cf;
            }
            const flakyF = a["retry"] ? (1 + frac(a["flaky"])) : 1;
            runnerMin = dur * flakyF;
            wall = (dur / shards) * flakyF;
        }
        else if (STAGE_LIKE.has(n.kind)) {
            let dur = num(a["duration"], 2) / runnerSpeedMul;
            if (n.kind === "ci_ragindex")
                dur *= Math.max(0.2, num(a["docs"], 50) / 50);
            if (n.kind === "ci_evalgate" && !a["judge"])
                dur *= 0.3;
            runnerMin = dur;
            wall = dur;
        }
        else if (n.kind === "ci_gate") {
            wall = a["auto"] ? 0 : num(a["wait"], 0);
        }
        else if (n.kind === "ci_deploy") {
            wall = num(a["duration"], 5) + num(a["bake"], 0);
        }
        stageWall.set(n.id, wall);
        stageRunnerMin.set(n.id, runnerMin);
        stageShards.set(n.id, shards);
    }
    if (autoscale) {
        let need = 1;
        for (const n of flow)
            if (STAGE_LIKE.has(n.kind)) {
                const durH = (stageWall.get(n.id)! / 60) || 0.001;
                need = Math.max(need, pipelineArrival * stageShards.get(n.id)! * durH * 1.25);
            }
        M = Math.max(M, need);
    }
    const perNode: Record<string, NodeSim> = {};
    let maxRho = 0, bottleneck: string | null = null;
    for (const n of flow) {
        const shards = stageShards.get(n.id)!, durH = (stageWall.get(n.id)! / 60);
        const cap = STAGE_LIKE.has(n.kind) && durH > 0 ? (M / shards) / durH : 1000000000;
        const rho = cap > 0 ? pipelineArrival / cap : 0;
        if (rho > maxRho) {
            maxRho = rho;
            bottleneck = n.id;
        }
        perNode[n.id] = { q: 0, lambdaIn: pipelineArrival, rho, served: pipelineArrival, dropped: 0, errored: 0, delayMs: stageWall.get(n.id)! * 60000, down: false };
    }
    const memo = new Map<string, number>();
    const stack = new Set<string>();
    const longest = (id: string): number => {
        if (memo.has(id))
            return memo.get(id)!;
        if (stack.has(id))
            return stageWall.get(id) ?? 0;
        stack.add(id);
        let best = 0;
        for (const to of outAdj.get(id) ?? [])
            best = Math.max(best, longest(to));
        stack.delete(id);
        const t = (stageWall.get(id) ?? 0) + best;
        memo.set(id, t);
        return t;
    };
    let execMin = 0;
    for (const n of flow)
        if (isSource(n.id))
            execMin = Math.max(execMin, longest(n.id));
    if (execMin === 0)
        for (const n of flow)
            execMin = Math.max(execMin, longest(n.id));
    const bnWall = bottleneck ? (stageWall.get(bottleneck) ?? 0) : 0;
    const queueMin = maxRho >= 0.99 ? bnWall * 20 : (maxRho / Math.max(0.01, 1 - maxRho)) * bnWall;
    const leadP50 = Math.round(execMin + queueMin);
    const flakyVar = flow.reduce((s, n) => s + (n.kind === "ci_stage" ? frac(n.ai?.["flaky"]) : 0), 0);
    const leadP95 = Math.round(leadP50 * (1.4 + flakyVar));
    const throughput = pipelineArrival / Math.max(1, maxRho);
    const deploysPerDay = throughput * 24;
    const mergedPerDay = mq ? deploysPerDay * effBatch * batchPassRate : deploysPerDay;
    const runnerMinPerRun = flow.reduce((s, n) => s + (stageRunnerMin.get(n.id) ?? 0), 0);
    const runsPerMonth = pipelineArrival * reRunFactor * 24 * 30;
    const costPerMonth = runsPerMonth * runnerMinPerRun * costMin;
    const runnerUtil = Math.min(3, maxRho);
    const queueLen = Math.round(maxRho > 1 ? (maxRho - 1) * pipelineArrival * (bnWall / 60) : 0);
    const stages = flow.filter(n => n.kind === "ci_stage");
    const hasAutoGate = flow.some(n => n.kind === "ci_gate" && n.ai?.["auto"]);
    const hasEvalGate = flow.some(n => n.kind === "ci_evalgate");
    let cfr = 0.15;
    if (stages.length > 0)
        cfr *= 0.6;
    if (hasAutoGate)
        cfr *= 0.7;
    if (hasEvalGate)
        cfr *= 0.7;
    const flakyEscape = stages.reduce((s, n) => s + frac(n.ai?.["flaky"]) * (n.ai?.["retry"] ? 0.2 : 1), 0);
    cfr += flakyEscape * 0.3;
    if (mq)
        cfr += frac(mq.ai?.["pr_fail"]) * 0.1 * (bisect ? 0.5 : 1);
    const dep = flow.find(n => n.kind === "ci_deploy");
    const strat = String(dep?.ai?.["strategy"] ?? "rolling");
    const canaryPct = frac(dep?.ai?.["canary_pct"]);
    const bake = num(dep?.ai?.["bake"]);
    const autoRb = !!dep?.ai?.["auto_rollback"];
    let stratMul = 1;
    if (strat === "recreate")
        stratMul = 1;
    else if (strat === "rolling")
        stratMul = 0.9;
    else if (strat === "bluegreen")
        stratMul = autoRb ? 0.4 : 0.6;
    else if (strat === "canary")
        stratMul = (0.2 + canaryPct * 0.6) * (bake > 0 ? 0.7 : 1) * (autoRb ? 0.5 : 1);
    const changeFailRate = Math.max(0.005, Math.min(0.9, cfr * stratMul));
    const depDur = num(dep?.ai?.["duration"], 5);
    let recoveryMin = strat === "bluegreen" ? (autoRb ? 1 : 3)
        : strat === "canary" ? (autoRb ? 3 : depDur)
            : strat === "rolling" ? depDur * 2
                : depDur * 2 + 10;
    const hasCe = flow.some(n => n.kind === "ci_cemonitor");
    recoveryMin += hasCe ? 2 : 15;
    return {
        perNode,
        offered: arrival,
        throughput,
        dropRate: 0,
        errorRate: 0,
        availability: 1,
        p50: leadP50,
        p95: leadP95,
        legitOffered: arrival,
        attackOffered: 0,
        legitAvailability: 1,
        underAttack: false,
        bottleneck: maxRho > 0.01 ? bottleneck : null,
        leadP50,
        leadP95,
        execMin: Math.round(execMin),
        queueMin: Math.round(queueMin),
        deploysPerDay,
        runnerUtil,
        costPerMonth,
        queueLen,
        dora: doraTier(leadP50, deploysPerDay),
        hasMergeQ: !!mq,
        mergedPerDay,
        batchPassRate,
        changeFailRate,
        recoveryMin: Math.round(recoveryMin),
        deployStrategy: dep ? strat : "\u2014",
    };
}
