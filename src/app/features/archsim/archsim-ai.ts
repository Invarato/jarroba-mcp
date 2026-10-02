export type AiNodeKind = "ai_agent" | "ai_planner" | "ai_router" | "ai_tool" | "ai_guardrail" | "ai_sandbox" | "ai_memory" | "ai_data" | "ai_checkpoint" | "ai_eval" | "ai_gateway" | "ai_observability";
export const AI_NODE_KINDS: AiNodeKind[] = [
    "ai_agent",
    "ai_planner",
    "ai_router",
    "ai_tool",
    "ai_guardrail",
    "ai_sandbox",
    "ai_memory",
    "ai_data",
    "ai_checkpoint",
    "ai_eval",
    "ai_gateway",
    "ai_observability",
];
export function isAiKind(k: string): k is AiNodeKind { return (AI_NODE_KINDS as string[]).includes(k); }
export interface AiFieldDef {
    key: string;
    label: string;
    type: "text" | "textarea" | "number" | "bool" | "select" | "tags";
    options?: {
        value: string;
        label: string;
    }[];
    help?: string;
    placeholder?: string;
}
export interface AiNodeMeta {
    label: string;
    group: string;
    color: string;
    icon: string;
    blurb: string;
    fields: AiFieldDef[];
    defaults: Record<string, unknown>;
}
const C = {
    agent: "#6a1b9a",
    planner: "#8e24aa",
    model: "#00695c",
    tool: "#1565c0",
    guard: "#c62828",
    mem: "#4527a0",
    data: "#00838f",
    human: "#ef6c00",
    eval: "#2e7d32",
    gate: "#37474f",
    obs: "#5d4037",
    sandbox: "#455a64",
};
export interface ModelProfile {
    id: string;
    label: string;
    latencyMs: number;
    costPerReq: number;
}
export const MODEL_PROFILES: ModelProfile[] = [
    { id: "gemini-flash", label: "Gemini Flash (r\u00E1pido/barato)", latencyMs: 300, costPerReq: 0.0003 },
    { id: "gpt-4o-mini", label: "GPT-4o mini (r\u00E1pido/barato)", latencyMs: 400, costPerReq: 0.0004 },
    { id: "claude-haiku", label: "Claude Haiku (r\u00E1pido/barato)", latencyMs: 350, costPerReq: 0.0005 },
    { id: "claude-sonnet", label: "Claude Sonnet (equilibrado)", latencyMs: 700, costPerReq: 0.008 },
    { id: "gpt-4o", label: "GPT-4o (equilibrado)", latencyMs: 800, costPerReq: 0.006 },
    { id: "claude-opus", label: "Claude Opus (potente/lento)", latencyMs: 2200, costPerReq: 0.05 },
    { id: "o1", label: "o1 (razonamiento/lento)", latencyMs: 3000, costPerReq: 0.06 },
    { id: "custom", label: "Otro / personalizado", latencyMs: 800, costPerReq: 0.01 },
];
export function modelProfile(id: string): ModelProfile {
    return MODEL_PROFILES.find(m => m.id === id) ?? MODEL_PROFILES[MODEL_PROFILES.length - 1];
}
export const AI_CATALOG: Record<AiNodeKind, AiNodeMeta> = {
    ai_agent: {
        label: "Agente",
        group: "Agentes",
        color: C.agent,
        icon: "\uD83E\uDD16",
        blurb: "El agente: rol, objetivo, reglas de negocio y formato de salida.",
        fields: [
            { key: "role", label: "Rol", type: "text", placeholder: "Asistente de soporte de facturaci\u00F3n" },
            { key: "goal", label: "Objetivo / tarea", type: "textarea", placeholder: "Resolver dudas de facturas y emitir reembolsos \u2264 50\u20AC" },
            { key: "constraints", label: "Reglas de negocio (if/then)", type: "textarea", help: "Prefiere reglas condicionales a absolutos en may\u00FAsculas.", placeholder: "Si el importe > 50\u20AC, deriva a un humano." },
            { key: "output_format", label: "Formato de salida", type: "select", options: [{ value: "text", label: "Texto" }, { value: "json", label: "JSON" }, { value: "markdown", label: "Markdown" }] },
            { key: "instruction_level", label: "Nivel de instrucci\u00F3n", type: "select", help: "Jerarqu\u00EDa de instrucciones (OpenAI): el contenido de herramientas NO es de confianza.", options: [{ value: "platform", label: "Plataforma" }, { value: "system", label: "Sistema" }, { value: "developer", label: "Desarrollador" }, { value: "user", label: "Usuario" }] },
            { key: "injection_defense", label: "Defensa anti-inyecci\u00F3n", type: "select", help: "Patr\u00F3n estructural (arXiv:2506.08837).", options: [{ value: "none", label: "\u2014 (ninguna)" }, { value: "plan_then_execute", label: "Plan-then-Execute" }, { value: "dual_llm", label: "Dual-LLM" }, { value: "action_selector", label: "Action-Selector" }, { value: "camel", label: "CaMeL (capabilities)" }] },
        ],
        defaults: { role: "", goal: "", constraints: "", output_format: "text", instruction_level: "system", injection_defense: "none" },
    },
    ai_planner: {
        label: "Planificador",
        group: "Agentes",
        color: C.planner,
        icon: "\uD83D\uDDFA\uFE0F",
        blurb: "Descompone el objetivo en subtareas ordenadas: estrategia, descomposici\u00F3n y replanificaci\u00F3n.",
        fields: [
            { key: "strategy", label: "Estrategia de planificaci\u00F3n", type: "select", help: "El patr\u00F3n de razonamiento con el que decide y ordena las subtareas.", options: [{ value: "react", label: "ReAct (razonar + actuar)" }, { value: "plan_execute", label: "Plan-and-Execute" }, { value: "tree_of_thought", label: "\u00C1rbol de pensamiento (ToT)" }, { value: "graph", label: "Grafo de tareas (DAG)" }, { value: "reflexion", label: "Reflexion (auto-cr\u00EDtica)" }] },
            { key: "decomposition", label: "Descomposici\u00F3n", type: "select", options: [{ value: "sequential", label: "Secuencial" }, { value: "parallel", label: "Paralela (subtareas en paralelo)" }, { value: "hierarchical", label: "Jer\u00E1rquica (sub-agentes)" }] },
            { key: "max_steps", label: "Pasos m\u00E1ximos", type: "number", help: "L\u00EDmite de iteraciones del bucle: evita el planificador que nunca converge (coste desbocado)." },
            { key: "replanning", label: "Replanifica ante fallo/estado", type: "bool", help: "Rehace el plan cuando un tool falla o el estado cambia (frente a ejecutar un plan fijo)." },
        ],
        defaults: { strategy: "plan_execute", decomposition: "sequential", max_steps: 10, replanning: true },
    },
    ai_router: {
        label: "Router LLM",
        group: "Modelo",
        color: C.model,
        icon: "\uD83D\uDD00",
        blurb: "Enrutado multi-modelo: estrategia, fallback, reintentos y budget.",
        fields: [
            { key: "model", label: "Modelo principal", type: "select", help: "Fija la latencia y el coste estimados por petici\u00F3n.", options: MODEL_PROFILES.map(m => ({ value: m.id, label: m.label })) },
            { key: "cache_hit", label: "Cach\u00E9 de prompts (% aciertos)", type: "number", help: "Las peticiones cacheadas no llaman al LLM: bajan coste y latencia (0\u2013100)." },
            { key: "escalation", label: "Cascada: % que escala al modelo fuerte", type: "number", help: "Router coste-calidad: el resto lo resuelve el modelo principal (barato)." },
            { key: "strong_model", label: "Modelo fuerte (cascada)", type: "select", options: MODEL_PROFILES.map(m => ({ value: m.id, label: m.label })) },
            { key: "tpm_limit", label: "L\u00EDmite del proveedor (tokens/min)", type: "number", help: "La TPM (no la RPM) suele ser el techo real. 0 = sin l\u00EDmite." },
            { key: "retry_policy", label: "Pol\u00EDtica de reintento", type: "select", help: "Ante 429/l\u00EDmite: los reintentos ingenuos ampl\u00EDan la carga (death spiral).", options: [{ value: "none", label: "Sin reintentos" }, { value: "immediate", label: "Inmediato (peligroso)" }, { value: "backoff", label: "Backoff + jitter" }] },
            { key: "fallback_model", label: "Modelo de respaldo (failover)", type: "select", help: "Si marcas el router \u00ABca\u00EDdo\u00BB, las peticiones van aqu\u00ED.", options: MODEL_PROFILES.map(m => ({ value: m.id, label: m.label })) },
            { key: "strategy", label: "Estrategia", type: "select", options: [{ value: "cost", label: "Coste (cascada)" }, { value: "latency", label: "Latencia" }, { value: "semantic", label: "Sem\u00E1ntica / clasificador" }, { value: "least_busy", label: "Menos ocupado" }, { value: "simple", label: "Simple" }] },
            { key: "models", label: "Modelos / niveles", type: "tags", help: "p.ej. tier-fast, tier-strong", placeholder: "gpt-mini, gpt-strong" },
            { key: "budget_tokens", label: "Budget de tokens", type: "number" },
        ],
        defaults: { model: "gpt-4o", cache_hit: 0, escalation: 0, strong_model: "claude-opus", tpm_limit: 0, retry_policy: "backoff", fallback_model: "gpt-4o-mini", strategy: "cost", models: [], budget_tokens: 0 },
    },
    ai_tool: {
        label: "Herramienta / MCP",
        group: "Herramientas",
        color: C.tool,
        icon: "\uD83D\uDD27",
        blurb: "Herramienta conectada v\u00EDa Model Context Protocol: transporte, auth y riesgo.",
        fields: [
            { key: "tool_name", label: "Nombre", type: "text", placeholder: "crear_reembolso" },
            { key: "transport", label: "Transporte", type: "select", options: [{ value: "stdio", label: "stdio (local)" }, { value: "http", label: "streamable-http" }, { value: "sse", label: "SSE (deprecado)" }] },
            { key: "auth", label: "Autenticaci\u00F3n", type: "select", options: [{ value: "none", label: "Ninguna (stdio/env)" }, { value: "oauth2.1", label: "OAuth 2.1 (PKCE)" }, { value: "apikey", label: "API key / bearer" }] },
            { key: "read_only", label: "Solo lectura (readOnlyHint)", type: "bool" },
            { key: "destructive", label: "Destructiva (destructiveHint)", type: "bool", help: "Si es destructiva deber\u00EDa pasar por checkpoint humano." },
            { key: "effect", label: "Efecto (si aborta)", type: "select", help: "Qu\u00E9 queda hecho si el agente aborta tras ejecutarla. Lo irreversible (enviar dinero/correo, borrar) necesita aprobaci\u00F3n o compensaci\u00F3n (deshacer del \u00FAltimo paso al primero); y ojo: reintentar la ejecuta N veces.", options: [{ value: "read", label: "Lectura (sin efecto)" }, { value: "reversible", label: "Reversible" }, { value: "irreversible", label: "Irreversible" }] },
            { key: "human_approval", label: "Requiere aprobaci\u00F3n humana", type: "bool" },
            { key: "least_privilege", label: "Permisos m\u00EDnimos (scope acotado)", type: "bool" },
            { key: "exec", label: "Ejecuta c\u00F3digo / comandos", type: "bool", help: "Int\u00E9rprete de c\u00F3digo, shell o navegador: puede correr c\u00F3digo arbitrario que el modelo genera. Debe ir dentro de un Sandbox (entorno aislado), no en el proceso del host." },
            { key: "protocol_rev", label: "Revisi\u00F3n MCP", type: "select", options: [{ value: "2026-07-28", label: "2026-07-28 (stateless)" }, { value: "2025-11-25", label: "2025-11-25" }, { value: "2025-06-18", label: "2025-06-18" }] },
        ],
        defaults: { tool_name: "", transport: "stdio", auth: "none", read_only: false, destructive: false, effect: "reversible", human_approval: false, least_privilege: true, exec: false, protocol_rev: "2026-07-28" },
    },
    ai_guardrail: {
        label: "Guardrail",
        group: "Seguridad IA",
        color: C.guard,
        icon: "\uD83D\uDEE1\uFE0F",
        blurb: "Barrera de entrada/salida: PII, jailbreak, toxicidad, topical\u2026 con acci\u00F3n al fallar.",
        fields: [
            { key: "direction", label: "Direcci\u00F3n / etapa", type: "select", options: [{ value: "input", label: "Entrada" }, { value: "output", label: "Salida" }, { value: "dialog", label: "Di\u00E1logo" }, { value: "retrieval", label: "Recuperaci\u00F3n (RAG)" }, { value: "execution", label: "Ejecuci\u00F3n (tools)" }] },
            { key: "check", label: "Tipo de comprobaci\u00F3n", type: "select", options: [{ value: "pii", label: "PII" }, { value: "jailbreak", label: "Jailbreak / inyecci\u00F3n" }, { value: "toxicity", label: "Toxicidad / moderaci\u00F3n" }, { value: "topical", label: "Fuera de tema" }, { value: "schema", label: "Formato / esquema" }, { value: "keyword", label: "Palabras / regex" }, { value: "groundedness", label: "Groundedness" }] },
            { key: "on_fail", label: "Acci\u00F3n al fallar", type: "select", options: [{ value: "block", label: "Bloquear" }, { value: "mask", label: "Enmascarar / anonimizar" }, { value: "reask", label: "Reintentar (reask)" }, { value: "refrain", label: "Abstenerse (refrain)" }, { value: "noop", label: "Solo registrar (noop)" }] },
            { key: "provider", label: "Implementaci\u00F3n", type: "select", options: [{ value: "nemo", label: "NeMo Guardrails" }, { value: "guardrails_ai", label: "Guardrails AI" }, { value: "llama_guard", label: "Llama Guard" }, { value: "openai_moderation", label: "OpenAI Moderation" }, { value: "presidio", label: "Presidio (PII)" }, { value: "rules", label: "Reglas / regex" }] },
        ],
        defaults: { direction: "input", check: "jailbreak", on_fail: "block", provider: "nemo" },
    },
    ai_sandbox: {
        label: "Sandbox / Contenci\u00F3n",
        group: "Seguridad IA",
        color: C.sandbox,
        icon: "\uD83E\uDDF1",
        blurb: "Entorno de ejecuci\u00F3n aislado para el c\u00F3digo y las herramientas del agente: aislamiento, control de salida a internet (egress) y detecci\u00F3n de fuga.",
        fields: [
            { key: "runtime", label: "Aislamiento de ejecuci\u00F3n", type: "select", help: "D\u00F3nde corre el c\u00F3digo del agente. \u00ABProceso del host\u00BB NO a\u00EDsla: una fuga llega a tu m\u00E1quina. Contenedor a\u00EDsla; microVM (gVisor/Firecracker) y WASM a\u00EDslan m\u00E1s fuerte.", options: [{ value: "none", label: "Proceso del host (sin aislar)" }, { value: "container", label: "Contenedor" }, { value: "microvm", label: "microVM (gVisor / Firecracker)" }, { value: "wasm", label: "WASM (sandbox del runtime)" }] },
            { key: "egress", label: "Salida a internet (egress)", type: "select", help: "La lecci\u00F3n del incidente: el entorno de prueba debe estar SIN internet, con la API del modelo como \u00FAnica conexi\u00F3n permitida. \u00ABAbierta\u00BB deja exfiltrar datos y descargar cargas.", options: [{ value: "none", label: "Sin red (solo la API del modelo)" }, { value: "allowlist", label: "Allowlist (destinos permitidos)" }, { value: "open", label: "Abierta (todo internet)" }] },
            { key: "escape_monitor", label: "Detecci\u00F3n de fuga (en vivo)", type: "select", help: "NO es un guardrail de contenido (\u00ABesta herramienta est\u00E1 prohibida\u00BB), sino detectar que el agente intenta SALIR de la caja (acceder a internet, escalar, escapar del entorno). \u00ABCorta + avisa\u00BB frena la tentativa y alerta a un humano.", options: [{ value: "none", label: "Ninguna" }, { value: "detect", label: "Detecta y registra (no corta)" }, { value: "kill_switch", label: "Corta + avisa a un humano (kill-switch)" }] },
            { key: "seal_check", label: "Verifica el sello antes de cada ejecuci\u00F3n", type: "bool", help: "Comprueba que el aislamiento sigue sellado (sin red inesperada, sin montajes filtrados) ANTES de cada ejecuci\u00F3n. Una config filtrada abre la caja sin que nadie lo note." },
        ],
        defaults: { runtime: "container", egress: "allowlist", escape_monitor: "kill_switch", seal_check: true },
    },
    ai_memory: {
        label: "Memoria / Contexto",
        group: "Contexto",
        color: C.mem,
        icon: "\uD83E\uDDE0",
        blurb: "Memoria a corto/largo plazo, RAG o Memory Bank.",
        fields: [
            { key: "mem_kind", label: "Tipo", type: "select", options: [{ value: "short", label: "Corto plazo (sesi\u00F3n)" }, { value: "long", label: "Largo plazo" }, { value: "rag", label: "RAG" }, { value: "memory_bank", label: "Memory Bank" }] },
            { key: "store", label: "Almac\u00E9n", type: "text", placeholder: "Redis / Postgres / vector store" },
            { key: "window", label: "Ventana de contexto (tokens)", type: "number" },
            { key: "retention", label: "Retenci\u00F3n", type: "text", placeholder: "30 d\u00EDas" },
        ],
        defaults: { mem_kind: "short", store: "", window: 0, retention: "" },
    },
    ai_data: {
        label: "Fuente de datos",
        group: "Contexto",
        color: C.data,
        icon: "\uD83D\uDDC4\uFE0F",
        blurb: "Fuente de datos / vector store con su clasificaci\u00F3n y gobierno.",
        fields: [
            { key: "source", label: "Fuente", type: "text", placeholder: "Docs internos / API / S3" },
            { key: "ingestion", label: "Ingesti\u00F3n", type: "select", options: [{ value: "batch", label: "Batch" }, { value: "stream", label: "Streaming" }] },
            { key: "vector_store", label: "Es vector store", type: "bool" },
            { key: "batch", label: "Modo batch (\u221250% coste, diferido)", type: "bool", help: "Para trabajo no interactivo (embeddings/indexado): \u221250% de coste, latencia diferida (no cuenta en p95)." },
            { key: "classification", label: "Clasificaci\u00F3n del dato", type: "select", options: [{ value: "public", label: "P\u00FAblico" }, { value: "internal", label: "Interno" }, { value: "confidential", label: "Confidencial" }, { value: "restricted", label: "Restringido" }] },
            { key: "authz", label: "Autorizaci\u00F3n de acceso", type: "select", help: "Sin control por usuario/inquilino, un agente multi-tenant puede filtrar datos de un cliente a otro.", options: [{ value: "none", label: "Sin control" }, { value: "role", label: "Por rol" }, { value: "tenant", label: "Por inquilino/usuario" }] },
            { key: "freshness", label: "Frescura del corpus", type: "select", help: "Un RAG con datos rancios responde con informaci\u00F3n vieja. Declara cada cu\u00E1nto se re-indexa.", options: [{ value: "realtime", label: "Tiempo real" }, { value: "daily", label: "Diaria" }, { value: "weekly", label: "Semanal" }, { value: "unknown", label: "Sin definir" }] },
            { key: "citations", label: "Cita las fuentes en la respuesta", type: "bool", help: "Sin citar de d\u00F3nde sali\u00F3, no hay linaje: no puedes auditar ni verificar la respuesta." },
        ],
        defaults: { source: "", ingestion: "batch", vector_store: false, batch: false, classification: "internal", authz: "none", freshness: "unknown", citations: false },
    },
    ai_checkpoint: {
        label: "Checkpoint humano",
        group: "Control",
        color: C.human,
        icon: "\uD83D\uDE4B",
        blurb: "Aprobaci\u00F3n humana (human-in-the-loop) para acciones sensibles.",
        fields: [
            { key: "trigger", label: "Disparador", type: "text", placeholder: "Reembolso > 50\u20AC, acci\u00F3n legal/m\u00E9dica\u2026" },
            { key: "risk", label: "Riesgo", type: "select", options: [{ value: "low", label: "Bajo" }, { value: "medium", label: "Medio" }, { value: "high", label: "Alto" }] },
            { key: "oversight", label: "Supervisi\u00F3n", type: "select", help: "S\u00EDncrono (in-the-loop) BLOQUEA y dispara la latencia; as\u00EDncrono (on-the-loop) no bloquea el throughput.", options: [{ value: "in_the_loop", label: "In-the-loop (s\u00EDncrono, bloquea)" }, { value: "on_the_loop", label: "On-the-loop (as\u00EDncrono)" }] },
            { key: "gated_fraction", label: "% de acciones que se gatean", type: "number", help: "Risk tiering: gatea solo lo irreversible/costoso; el resto pasa directo (menos cola y fatiga del revisor)." },
        ],
        defaults: { trigger: "", risk: "high", oversight: "on_the_loop", gated_fraction: 100 },
    },
    ai_eval: {
        label: "Evals (spec)",
        group: "ADLC",
        color: C.eval,
        icon: "\u2705",
        blurb: "Conjunto de evals: la spec ejecutable del agente (evals-as-spec).",
        fields: [
            { key: "dataset", label: "Dataset", type: "text", placeholder: "casos_soporte.jsonl" },
            { key: "level", label: "Nivel", type: "select", options: [{ value: "end_to_end", label: "Extremo a extremo" }, { value: "trajectory", label: "Trayectoria (tools)" }, { value: "component", label: "Componente / span" }] },
            { key: "judge_model", label: "Juez (LLM-as-judge)", type: "text", placeholder: "modelo fijado para reproducibilidad" },
            { key: "matching", label: "Modo de coincidencia (trayectoria)", type: "select", options: [{ value: "strict", label: "Estricto (orden importa)" }, { value: "unordered", label: "Sin orden" }, { value: "subset", label: "Subconjunto" }, { value: "superset", label: "Superconjunto" }] },
            { key: "threshold", label: "Umbral de aprobaci\u00F3n (0\u20131)", type: "number" },
            { key: "format", label: "Formato", type: "select", options: [{ value: "promptfoo", label: "promptfoo (YAML)" }, { value: "adk", label: "Google ADK (.evalset.json)" }, { value: "openai", label: "OpenAI Evals" }] },
            { key: "batch", label: "Modo batch (\u221250% coste, offline)", type: "bool", help: "Las evals corren offline/CI \u2192 batch API: \u221250% de coste." },
        ],
        defaults: { dataset: "", level: "end_to_end", judge_model: "", matching: "unordered", threshold: 0.8, format: "promptfoo", batch: false },
    },
    ai_gateway: {
        label: "Gateway IA",
        group: "Seguridad IA",
        color: C.gate,
        icon: "\uD83D\uDEAA",
        blurb: "Gateway tipo APIM: rate-limit, budget de tokens y filtros de prompt/palabras.",
        fields: [
            { key: "rate_limit", label: "Rate limit (rpm)", type: "number" },
            { key: "token_budget", label: "Budget de tokens", type: "number" },
            { key: "prompt_filter", label: "Filtro de prompt (inyecci\u00F3n)", type: "bool" },
            { key: "word_filters", label: "Filtros de palabras", type: "tags", placeholder: "competidor, secreto\u2026" },
            { key: "cache", label: "Cach\u00E9", type: "select", options: [{ value: "none", label: "Ninguna" }, { value: "simple", label: "Simple" }, { value: "semantic", label: "Sem\u00E1ntica" }] },
        ],
        defaults: { rate_limit: 0, token_budget: 0, prompt_filter: true, word_filters: [], cache: "none" },
    },
    ai_observability: {
        label: "Observabilidad",
        group: "ADLC",
        color: C.obs,
        icon: "\uD83D\uDCCA",
        blurb: "Trazas, logs y spans del agente (base de las evals online y los learning loops).",
        fields: [
            { key: "tracing", label: "Trazado activo", type: "bool" },
            { key: "standard", label: "Est\u00E1ndar", type: "select", options: [{ value: "otel", label: "OpenTelemetry (GenAI semconv)" }, { value: "langsmith", label: "LangSmith" }, { value: "phoenix", label: "Arize Phoenix" }] },
            { key: "sample_rate", label: "Muestreo (%)", type: "number" },
            { key: "online_evals", label: "Evals online (drift)", type: "bool" },
            { key: "audit_log", label: "Log de auditor\u00EDa", type: "bool", help: "Requerido por gobierno/EU AI Act." },
            { key: "log_denials", label: "Registra los rechazos", type: "bool", help: "Auditar solo lo ejecutado deja fuera las denegaciones (guardrails, checkpoints) \u2014 que es lo primero que se busca al investigar un incidente." },
        ],
        defaults: { tracing: true, standard: "otel", sample_rate: 10, online_evals: false, audit_log: true, log_denials: false },
    },
};
export const AI_PALETTE_GROUPS: {
    group: string;
    kinds: AiNodeKind[];
}[] = [
    { group: "Agentes", kinds: ["ai_agent", "ai_planner"] },
    { group: "Modelo", kinds: ["ai_router"] },
    { group: "Herramientas", kinds: ["ai_tool"] },
    { group: "Contexto", kinds: ["ai_memory", "ai_data"] },
    { group: "Seguridad IA", kinds: ["ai_guardrail", "ai_gateway", "ai_sandbox"] },
    { group: "Control", kinds: ["ai_checkpoint"] },
    { group: "ADLC", kinds: ["ai_eval", "ai_observability"] },
];
export function defaultAiSpec(kind: AiNodeKind): Record<string, unknown> {
    return structuredClone(AI_CATALOG[kind].defaults);
}
