import { AiFieldDef } from "./archsim-ai";
export type CicdNodeKind = "ci_trigger" | "ci_mergeq" | "ci_stage" | "ci_runners" | "ci_gate" | "ci_cache" | "ci_deploy" | "ci_promptlint" | "ci_evalgate" | "ci_ragindex" | "ci_registry" | "ci_cemonitor";
export const CICD_NODE_KINDS: CicdNodeKind[] = ["ci_trigger", "ci_mergeq", "ci_stage", "ci_runners", "ci_gate", "ci_cache", "ci_deploy", "ci_promptlint", "ci_evalgate", "ci_ragindex", "ci_registry", "ci_cemonitor"];
export function isCicdKind(k: string): k is CicdNodeKind { return (CICD_NODE_KINDS as string[]).includes(k); }
export interface CicdNodeMeta {
    label: string;
    group: string;
    color: string;
    icon: string;
    blurb: string;
    fields: AiFieldDef[];
    defaults: Record<string, unknown>;
}
const C = { origen: "#1565c0", mergeq: "#5d4037", stage: "#00695c", res: "#6a1b9a", gate: "#ef6c00", cache: "#00838f", deploy: "#2e7d32", ai: "#00838f", aigate: "#ad1457", airag: "#4527a0" };
export const CICD_CATALOG: Record<CicdNodeKind, CicdNodeMeta> = {
    ci_trigger: {
        label: "Disparador",
        group: "Origen",
        color: C.origen,
        icon: "\uD83D\uDD00",
        blurb: "Origen del pipeline: cu\u00E1ntos commits/PRs llegan al d\u00EDa.",
        fields: [
            { key: "event", label: "Evento", type: "select", options: [{ value: "push", label: "Push / commit" }, { value: "pr", label: "Pull request" }, { value: "schedule", label: "Programado (cron)" }] },
            { key: "per_day", label: "Ejecuciones al d\u00EDa", type: "number", help: "Cu\u00E1ntos pipelines se disparan al d\u00EDa (pico de PRs \u2192 cola)." },
        ],
        defaults: { event: "pr", per_day: 60 },
    },
    ci_mergeq: {
        label: "Merge queue",
        group: "Control",
        color: C.mergeq,
        icon: "\uD83D\uDE82",
        blurb: "Serializa/agrupa PRs contra main. Batch grande = menos ejecuciones\u2026 hasta que un PR malo tumba el batch.",
        fields: [
            { key: "strategy", label: "Estrategia", type: "select", options: [{ value: "serial", label: "Serial (1 a 1)" }, { value: "batch", label: "Batch" }, { value: "speculative", label: "Especulativa (paralela)" }] },
            { key: "batch_size", label: "Tama\u00F1o del batch", type: "number", help: "PRs por ejecuci\u00F3n. \u00D3ptimo t\u00EDpico 2-5: m\u00E1s throughput pero un flaky tumba el batch entero." },
            { key: "pr_fail", label: "Fallo por PR (%)", type: "number", help: "Prob. de que un PR falle: el batch pasa solo si TODOS pasan \u2192 (1\u2212p)^batch." },
            { key: "bisect", label: "Bisecci\u00F3n al fallar", type: "bool", help: "A\u00EDsla el PR culpable partiendo el batch (coste log\u2082n) en vez de re-probar todo." },
        ],
        defaults: { strategy: "batch", batch_size: 3, pr_fail: 5, bisect: true },
    },
    ci_stage: {
        label: "Etapa",
        group: "Etapas",
        color: C.stage,
        icon: "\u2699\uFE0F",
        blurb: "Una etapa del pipeline (build, test, lint\u2026): duraci\u00F3n, paralelismo y flaky.",
        fields: [
            { key: "duration", label: "Duraci\u00F3n (min)", type: "number" },
            { key: "shards", label: "Paralelismo / shards (matrix)", type: "number", help: "Divide el trabajo en N jobs concurrentes: m\u00E1s r\u00E1pido (wall-clock \u00F7N) pero consume N runners." },
            { key: "cacheable", label: "Cacheable", type: "bool", help: "Con una cach\u00E9 delante, un acierto acelera esta etapa." },
            { key: "flaky", label: "Tests flaky (%)", type: "number", help: "Fallos intermitentes \u2192 reintentos que alargan el lead time y comen 20-30% del compute." },
            { key: "retry", label: "Reintentar los flaky", type: "bool", help: "Re-run autom\u00E1tico: recupera el flaky pero empuja la cola de TODOS los PRs." },
        ],
        defaults: { duration: 6, shards: 1, cacheable: false, flaky: 0, retry: true },
    },
    ci_runners: {
        label: "Pool de runners",
        group: "Recursos",
        color: C.res,
        icon: "\uD83D\uDDA5\uFE0F",
        blurb: "Recurso limitado compartido: n\u00BA de jobs concurrentes y su coste. Suele ser el cuello.",
        fields: [
            { key: "size", label: "Runners concurrentes", type: "number", help: "Jobs en paralelo que soporta el pool. Pocos runners + muchos PRs = cola (el cuello t\u00EDpico)." },
            { key: "runner_type", label: "Tama\u00F1o", type: "select", help: "Precios GitHub Actions 2026 orientativos.", options: [{ value: "small", label: "Small (2 vCPU \u00B7 $0,008/min)" }, { value: "large", label: "Large 16-core ($0,042/min)" }, { value: "self", label: "Self-hosted ($0/min GitLab)" }] },
            { key: "cost_min", label: "Coste por minuto ($)", type: "number", help: "Coste de CI = minutos de runner \u00D7 precio." },
            { key: "autoscale", label: "Autoescalado", type: "bool", help: "Absorbe los picos de commits \u2192 mata la cola (caso real: 15 min \u2192 <1 min)." },
        ],
        defaults: { size: 10, runner_type: "small", cost_min: 0.008, autoscale: false },
    },
    ci_gate: {
        label: "Gate / aprobaci\u00F3n",
        group: "Control",
        color: C.gate,
        icon: "\uD83D\uDEA6",
        blurb: "Gate de calidad (autom\u00E1tico) o aprobaci\u00F3n manual (bloquea \u2192 alarga el lead time).",
        fields: [
            { key: "auto", label: "Autom\u00E1tico (calidad)", type: "bool", help: "Autom\u00E1tico: no espera. Manual: espera humana \u2192 alarga el lead time." },
            { key: "wait", label: "Espera si manual (min)", type: "number" },
        ],
        defaults: { auto: true, wait: 0 },
    },
    ci_cache: {
        label: "Cach\u00E9 / artefactos",
        group: "Recursos",
        color: C.cache,
        icon: "\u26A1",
        blurb: "Cach\u00E9 de dependencias/capas/build: un acierto salta o acelera la etapa siguiente.",
        fields: [
            { key: "hit_rate", label: "Aciertos de cach\u00E9 (%)", type: "number" },
            { key: "saves", label: "Ahorro en la etapa (%)", type: "number", help: "En un acierto, cu\u00E1nto se recorta la duraci\u00F3n de la etapa siguiente." },
        ],
        defaults: { hit_rate: 70, saves: 60 },
    },
    ci_deploy: {
        label: "Despliegue",
        group: "Deploy",
        color: C.deploy,
        icon: "\uD83D\uDE80",
        blurb: "Despliegue a un entorno, con su estrategia y duraci\u00F3n. La estrategia decide el change failure rate y el tiempo de recuperaci\u00F3n (DORA).",
        fields: [
            { key: "env", label: "Entorno", type: "select", options: [{ value: "dev", label: "Dev" }, { value: "staging", label: "Staging" }, { value: "prod", label: "Producci\u00F3n" }] },
            { key: "strategy", label: "Estrategia", type: "select", help: "Blue-green: cutover y rollback casi instant\u00E1neos. Canary: progresivo por % (m\u00E1s lento por el bake, pero coge el fallo antes de llegar a todos). Recreate: hay downtime.", options: [{ value: "rolling", label: "Rolling" }, { value: "canary", label: "Canary (progresivo por %)" }, { value: "bluegreen", label: "Blue-green" }, { value: "recreate", label: "Recreate" }] },
            { key: "duration", label: "Duraci\u00F3n (min)", type: "number" },
            { key: "canary_pct", label: "Canary: % de tr\u00E1fico inicial", type: "number", help: "Solo canary: a qu\u00E9 % de usuarios llega el primer paso. Menos % = menor blast radius (menos change failure rate efectivo)." },
            { key: "bake", label: "Bake time (min)", type: "number", help: "Espera entre pasos del canary/blue-green para observar m\u00E9tricas antes de avanzar (baja el change failure rate)." },
            { key: "auto_rollback", label: "Rollback autom\u00E1tico por m\u00E9tricas", type: "bool", help: "Aborta y revierte solo si las m\u00E9tricas del canary/verde empeoran \u2192 recuperaci\u00F3n casi instant\u00E1nea y menos fallos en prod." },
            { key: "sim_state", label: "Estado del despliegue (efecto en runtime)", type: "select", help: "Puente CI/CD\u2192Runtime: enlaza este Despliegue a un subsistema (arrastra un cable a un nodo del runtime) y elige su estado para ver el RADIO DE IMPACTO en la lente Runtime. \u00ABCanary con fallo\u00BB solo afecta a su % de tr\u00E1fico; \u00ABFallo\u00BB tumba seg\u00FAn la estrategia (rolling/recreate\u2248todo, blue-green\u2248poco); \u00ABRevertido\u00BB (rollback) recupera.", options: [{ value: "sano", label: "Sano (sin impacto)" }, { value: "canary_bad", label: "Canary con fallo (solo su %)" }, { value: "fail", label: "Fallo (seg\u00FAn estrategia)" }, { value: "rolled_back", label: "Revertido (rollback \u2192 recupera)" }] },
        ],
        defaults: { env: "prod", strategy: "rolling", duration: 5, canary_pct: 10, bake: 0, auto_rollback: false, sim_state: "sano" },
    },
    ci_promptlint: {
        label: "Prompt lint",
        group: "IA (LLMOps)",
        color: C.ai,
        icon: "\uD83D\uDCDD",
        blurb: "Gate barato de higiene de prompts: variables sin usar, longitud, patrones de jailbreak. Como un linter, corre en segundos.",
        fields: [
            { key: "strict", label: "Falla el build (bloqueante)", type: "bool", help: "En estricto, un prompt sucio para el pipeline (como un lint --error)." },
            { key: "duration", label: "Duraci\u00F3n (min)", type: "number", help: "Es r\u00E1pido: segundos/1 min." },
        ],
        defaults: { strict: true, duration: 1 },
    },
    ci_evalgate: {
        label: "Gate de Evals",
        group: "IA (LLMOps)",
        color: C.aigate,
        icon: "\uD83E\uDDEA",
        blurb: "Gate de evaluaciones sobre un dataset dorado (LLM-as-Judge, exactitud, RAG faithfulness\u2026): bloquea el deploy si baja del umbral. Sube compute pero baja el change failure rate.",
        fields: [
            { key: "level", label: "Nivel", type: "select", options: [{ value: "unit", label: "Unidad (por respuesta)" }, { value: "trajectory", label: "Trayectoria (multi-paso)" }, { value: "e2e", label: "End-to-end" }] },
            { key: "threshold", label: "Umbral para pasar (0\u20131)", type: "number", help: "Score m\u00EDnimo del dataset dorado para dejar avanzar el pipeline." },
            { key: "judge", label: "Juez LLM (si no, heur\u00EDsticas)", type: "bool", help: "LLM-as-Judge: m\u00E1s fiel pero m\u00E1s caro/lento que las m\u00E9tricas heur\u00EDsticas." },
            { key: "duration", label: "Duraci\u00F3n (min)", type: "number", help: "Correr el dataset de evals consume runners (y tokens si el juez es un LLM)." },
        ],
        defaults: { level: "trajectory", threshold: 0.8, judge: true, duration: 8 },
    },
    ci_ragindex: {
        label: "Reindex RAG (CKU)",
        group: "IA (LLMOps)",
        color: C.airag,
        icon: "\uD83D\uDCDA",
        blurb: "Continuous Knowledge Update: reprocesa el corpus (chunking + embeddings) y publica el \u00EDndice. Se puede hacer blue-green (\u00EDndice nuevo en paralelo y swap) para no servir a medias.",
        fields: [
            { key: "docs", label: "Documentos (miles)", type: "number", help: "Tama\u00F1o del corpus a reindexar; escala la duraci\u00F3n/coste." },
            { key: "strategy", label: "Publicaci\u00F3n del \u00EDndice", type: "select", help: "Blue-green: construye el \u00EDndice nuevo aparte y hace swap at\u00F3mico (sin resultados a medias).", options: [{ value: "inplace", label: "In-place (sobrescribe)" }, { value: "bluegreen", label: "Blue-green (swap at\u00F3mico)" }] },
            { key: "duration", label: "Duraci\u00F3n (min)", type: "number" },
        ],
        defaults: { docs: 50, strategy: "bluegreen", duration: 15 },
    },
    ci_registry: {
        label: "Model/Prompt registry",
        group: "IA (LLMOps)",
        color: C.res,
        icon: "\uD83D\uDDC3\uFE0F",
        blurb: "Registro versionado de modelos y prompts (gobernanza, promoci\u00F3n por etapas, hot-swap sin redeploy). Es un marcador de gobernanza; no consume tiempo de pipeline.",
        fields: [
            { key: "artifact", label: "Artefacto", type: "select", options: [{ value: "model", label: "Modelo (peso/endpoint)" }, { value: "prompt", label: "Prompt / plantilla" }, { value: "adapter", label: "Adapter LoRA/QLoRA" }] },
            { key: "hotswap", label: "Hot-swap sin redeploy", type: "bool", help: "Cambiar de versi\u00F3n en caliente (config), sin re-desplegar el servicio." },
        ],
        defaults: { artifact: "model", hotswap: true },
    },
    ci_cemonitor: {
        label: "CE monitor (prod)",
        group: "IA (LLMOps)",
        color: C.ai,
        icon: "\uD83D\uDCC8",
        blurb: "Continuous Evaluation en producci\u00F3n: eval\u00FAa muestras vivas (deriva, calidad, alucinaci\u00F3n). No est\u00E1 en el camino del deploy, pero detectar antes = recuperar antes (baja el MTTR).",
        fields: [
            { key: "sample_pct", label: "Muestreo de tr\u00E1fico (%)", type: "number", help: "Qu\u00E9 % de respuestas reales se eval\u00FAan en vivo." },
            { key: "drift", label: "Detecci\u00F3n de deriva", type: "bool", help: "Alerta si la distribuci\u00F3n de entradas/calidad se desv\u00EDa \u2192 dispara reindex/fine-tuning." },
        ],
        defaults: { sample_pct: 5, drift: true },
    },
};
export const CICD_PALETTE_GROUPS: {
    group: string;
    kinds: CicdNodeKind[];
}[] = [
    { group: "Origen", kinds: ["ci_trigger"] },
    { group: "Etapas", kinds: ["ci_stage"] },
    { group: "Control", kinds: ["ci_mergeq", "ci_gate"] },
    { group: "Recursos", kinds: ["ci_runners", "ci_cache"] },
    { group: "Deploy", kinds: ["ci_deploy"] },
    { group: "IA (LLMOps)", kinds: ["ci_promptlint", "ci_evalgate", "ci_ragindex", "ci_registry", "ci_cemonitor"] },
];
export function defaultCicdSpec(kind: CicdNodeKind): Record<string, unknown> {
    return structuredClone(CICD_CATALOG[kind].defaults);
}
