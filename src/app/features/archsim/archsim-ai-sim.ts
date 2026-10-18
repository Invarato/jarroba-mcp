import { ArchNode } from "./archsim-model";
import { AiNodeKind, modelProfile } from "./archsim-ai";
import { nodeLatencyMs, nodeCostPerReq } from "./archsim-ai-estimate";
const frac = (v: unknown) => Math.max(0, Math.min(1, Number(v) / 100 || 0));
const TOK_PER_LLM_CALL = 500;
const BACKOFF_BASE_SEC = 1;
function routerParams(n: ArchNode): {
    cap: number;
    selfRetries: number;
    backoffSec: number;
    costReq: number;
    tokReq: number;
} {
    const a = n.ai ?? {};
    const hit = frac(a["cache_hit"]), esc = frac(a["escalation"]);
    const down = !!n.down;
    const primId = down && a["fallback_model"] ? String(a["fallback_model"]) : String(a["model"] || "custom");
    const prim = modelProfile(primId), strong = modelProfile(String(a["strong_model"] || "custom"));
    const llmLatMs = prim.latencyMs + esc * strong.latencyMs;
    const concCap = 20 / Math.max(0.001, llmLatMs / 1000);
    const tpm = Number(a["tpm_limit"]) || 0;
    const tpmCap = tpm > 0 ? (tpm / 60) / TOK_PER_LLM_CALL : Infinity;
    const llmCap = Math.min(concCap, tpmCap);
    const cap = hit < 1 ? llmCap / (1 - hit) : 1000000000;
    const pol = String(a["retry_policy"]);
    const selfRetries = pol === "none" ? 0 : Math.max(0, Math.floor(Number(a["num_retries"] ?? 2) || 0));
    const backoffSec = pol === "backoff" ? BACKOFF_BASE_SEC : 0;
    const costReq = (1 - hit) * (prim.costPerReq + esc * strong.costPerReq);
    const tokReq = (1 - hit) * (TOK_PER_LLM_CALL + esc * TOK_PER_LLM_CALL);
    return { cap: Math.max(0.001, cap), selfRetries, backoffSec, costReq, tokReq };
}
const AI_CONC: Record<AiNodeKind, number> = {
    ai_router: 20,
    ai_agent: 60,
    ai_planner: 60,
    ai_tool: 40,
    ai_guardrail: 120,
    ai_sandbox: 60,
    ai_memory: 300,
    ai_data: 300,
    ai_gateway: 800,
    ai_checkpoint: 100000,
    ai_eval: 1000000000000,
    ai_observability: 1000000000000,
};
const AI_TOK: Partial<Record<AiNodeKind, number>> = {
    ai_agent: 500,
    ai_router: 500,
    ai_tool: 300,
    ai_data: 400,
    ai_memory: 200,
    ai_guardrail: 50,
};
function capacityReqPerSec(n: ArchNode): number {
    const latS = Math.max(0.001, nodeLatencyMs(n) / 1000);
    return (AI_CONC[n.kind as AiNodeKind] ?? 100) / latS;
}
export function aiNodePhysics(n: ArchNode): {
    cap: number;
    svcMs: number;
    costReq: number;
    tokReq: number;
    selfRetries: number;
    backoffSec: number;
    jitter: number;
} {
    const rp = n.kind === "ai_router" ? routerParams(n) : null;
    return {
        cap: Math.max(0.001, rp ? rp.cap : capacityReqPerSec(n)),
        svcMs: nodeLatencyMs(n),
        costReq: rp ? rp.costReq : nodeCostPerReq(n),
        tokReq: rp ? rp.tokReq : (AI_TOK[n.kind as AiNodeKind] ?? 0),
        selfRetries: rp ? rp.selfRetries : 0,
        backoffSec: rp ? rp.backoffSec : 0,
        jitter: 0,
    };
}
