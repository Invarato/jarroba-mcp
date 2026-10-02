import { AI_CATALOG, AI_NODE_KINDS, AiNodeKind, isAiKind } from "./archsim-ai";
import { CICD_CATALOG, CICD_NODE_KINDS, CicdNodeKind, isCicdKind } from "./archsim-cicd";
import { nodeInsideRect } from "../../shared/canvas/canvas-geometry";
export type ArchNodeKind = "client" | "attacker" | "gateway" | "lb" | "cdn" | "ratelimit" | "waf" | "service" | "worker" | "auth" | "orchestrator" | "queue" | "pubsub" | "cache" | "db" | "nosql" | "objstore" | "search" | "datalake" | "warehouse" | "lakehouse" | "etl" | "bi" | "external" | "agent" | "llm" | "tool" | "vectordb" | "embed" | "k8s" | "cloud" | "vm" | "layer" | "module" | AiNodeKind | CicdNodeKind;
export const CONTAINER_KINDS: ArchNodeKind[] = ["k8s", "cloud", "vm", "layer"];
export function isContainer(k: ArchNodeKind): boolean { return CONTAINER_KINDS.includes(k); }
export function isLayer(k: ArchNodeKind): boolean { return k === "layer"; }
export function isModule(k: ArchNodeKind): boolean { return k === "module"; }
export function isDesignNode(k: ArchNodeKind): boolean { return isContainer(k) || isModule(k) || isAiKind(k) || isCicdKind(k); }
export interface ArchNode {
    id: string;
    kind: ArchNodeKind;
    x: number;
    y: number;
    label?: string;
    capacity?: number;
    latency?: number;
    jitter?: number;
    queue?: number;
    failRate?: number;
    down?: boolean;
    costHr?: number;
    w?: number;
    h?: number;
    wafEff?: number;
    retries?: number;
    autoscale?: boolean;
    scaleDelaySec?: number;
    breaker?: boolean;
    redelivery?: number;
    idempotent?: boolean;
    partitions?: number;
    fanout?: "split" | "all";
    hitRatio?: number;
    burst?: number;
    replicas?: number;
    readRatio?: number;
    coldStartMs?: number;
    concurrency?: "blocking" | "reactive" | "virtual";
    pool?: number;
    ai?: Record<string, unknown>;
    rotation?: number;
    provider?: CloudProvider;
    hosting?: CloudHosting;
    tech?: string;
    cost?: CostModel;
    defId?: string;
    pageRef?: string;
    scale?: number;
    detailReplicas?: boolean;
    collapsed?: boolean;
    pin?: number;
    arm?: {
        metric: "rho" | "avail" | "cost";
        op: "gt" | "lt";
        value: number;
    };
}
export type CloudProvider = "aws" | "azure" | "gcp" | "oci" | "alibaba" | "ibm" | "apache" | "confluent" | "cloudera" | "elastic" | "redis" | "rabbitmq" | "minio";
export type CloudHosting = "managed" | "self" | "enterprise";
export type Region = "eu" | "us";
export type Currency = "EUR" | "USD";
export interface CostModel {
    fixedHr?: number;
    perMillionReq?: number;
    perGbOut?: number;
}
export interface ArchEdge {
    id: string;
    fromId: string;
    toId: string;
    fromTerm: string;
    toTerm: string;
    label?: string;
    waypoints?: {
        x: number;
        y: number;
    }[];
    fromPort?: string;
    toPort?: string;
}
export interface ArchState {
    nodes: ArchNode[];
    edges: ArchEdge[];
}
export interface NodeMeta {
    label: string;
    group: string;
    color: string;
    hasIn: boolean;
    hasOut: boolean;
    defaults: {
        capacity: number;
        latency: number;
        jitter: number;
        queue: number;
        failRate: number;
    };
}
const C = {
    origen: "#1976d2",
    red: "#00838f",
    comp: "#388e3c",
    msg: "#f57c00",
    datos: "#7b1fa2",
    analitica: "#3949ab",
    ext: "#5d4037",
    ia: "#c2185b",
    atk: "#b71c1c",
    sec: "#303f9f",
    k8s: "#326ce5",
    cloud: "#ef6c00",
    vm: "#546e7a",
    module: "#00695c",
    layer: "#607d8b",
};
const AI_META = Object.fromEntries(AI_NODE_KINDS.map(k => [k, {
        label: AI_CATALOG[k].label,
        group: AI_CATALOG[k].group,
        color: AI_CATALOG[k].color,
        hasIn: true,
        hasOut: true,
        defaults: { capacity: 0, latency: 0, jitter: 0, queue: 0, failRate: 0 },
    }])) as Record<AiNodeKind, NodeMeta>;
const CICD_META = Object.fromEntries(CICD_NODE_KINDS.map(k => [k, {
        label: CICD_CATALOG[k].label,
        group: CICD_CATALOG[k].group,
        color: CICD_CATALOG[k].color,
        hasIn: k !== "ci_trigger",
        hasOut: k !== "ci_deploy",
        defaults: { capacity: 0, latency: 0, jitter: 0, queue: 0, failRate: 0 },
    }])) as Record<CicdNodeKind, NodeMeta>;
export const CATALOG: Record<ArchNodeKind, NodeMeta> = {
    ...AI_META,
    ...CICD_META,
    client: { label: "Cliente / carga", group: "Origen", color: C.origen, hasIn: false, hasOut: true, defaults: { capacity: 100, latency: 0, jitter: 0, queue: 0, failRate: 0 } },
    attacker: { label: "Atacante (DDoS)", group: "Ataque", color: C.atk, hasIn: false, hasOut: true, defaults: { capacity: 5000, latency: 0, jitter: 0, queue: 0, failRate: 0 } },
    waf: { label: "WAF / filtro", group: "Seguridad", color: C.sec, hasIn: true, hasOut: true, defaults: { capacity: 20000, latency: 2, jitter: 1, queue: 500, failRate: 0 } },
    gateway: { label: "API Gateway", group: "Red", color: C.red, hasIn: true, hasOut: true, defaults: { capacity: 2000, latency: 2, jitter: 1, queue: 200, failRate: 0 } },
    lb: { label: "Load Balancer", group: "Red", color: C.red, hasIn: true, hasOut: true, defaults: { capacity: 5000, latency: 1, jitter: 0, queue: 500, failRate: 0 } },
    cdn: { label: "CDN", group: "Red", color: C.red, hasIn: true, hasOut: true, defaults: { capacity: 20000, latency: 5, jitter: 3, queue: 1000, failRate: 0 } },
    ratelimit: { label: "Rate limiter", group: "Red", color: C.red, hasIn: true, hasOut: true, defaults: { capacity: 8000, latency: 1, jitter: 0, queue: 100, failRate: 0 } },
    service: { label: "Servicio", group: "C\u00F3mputo", color: C.comp, hasIn: true, hasOut: true, defaults: { capacity: 200, latency: 20, jitter: 10, queue: 100, failRate: 0 } },
    worker: { label: "Worker", group: "C\u00F3mputo", color: C.comp, hasIn: true, hasOut: true, defaults: { capacity: 100, latency: 50, jitter: 25, queue: 100, failRate: 0 } },
    auth: { label: "Auth / Identidad", group: "C\u00F3mputo", color: C.comp, hasIn: true, hasOut: true, defaults: { capacity: 1000, latency: 15, jitter: 8, queue: 100, failRate: 0 } },
    orchestrator: { label: "Orquestador (Saga)", group: "C\u00F3mputo", color: C.comp, hasIn: true, hasOut: true, defaults: { capacity: 500, latency: 10, jitter: 5, queue: 200, failRate: 0 } },
    queue: { label: "Cola (Kafka/SQS)", group: "Mensajer\u00EDa", color: C.msg, hasIn: true, hasOut: true, defaults: { capacity: 10000, latency: 1, jitter: 0, queue: 100000, failRate: 0 } },
    pubsub: { label: "Bus de eventos (Pub/Sub)", group: "Mensajer\u00EDa", color: C.msg, hasIn: true, hasOut: true, defaults: { capacity: 15000, latency: 1, jitter: 0, queue: 100000, failRate: 0 } },
    cache: { label: "Cach\u00E9 (Redis)", group: "Datos", color: C.datos, hasIn: true, hasOut: true, defaults: { capacity: 8000, latency: 1, jitter: 1, queue: 200, failRate: 0 } },
    db: { label: "Base de datos SQL", group: "Datos", color: C.datos, hasIn: true, hasOut: true, defaults: { capacity: 400, latency: 15, jitter: 8, queue: 100, failRate: 0 } },
    nosql: { label: "NoSQL (Mongo/Dynamo)", group: "Datos", color: C.datos, hasIn: true, hasOut: true, defaults: { capacity: 2000, latency: 8, jitter: 5, queue: 200, failRate: 0 } },
    objstore: { label: "Object store (S3)", group: "Datos", color: C.datos, hasIn: true, hasOut: true, defaults: { capacity: 3000, latency: 30, jitter: 20, queue: 500, failRate: 0 } },
    search: { label: "B\u00FAsqueda (Elastic)", group: "Datos", color: C.datos, hasIn: true, hasOut: true, defaults: { capacity: 1500, latency: 20, jitter: 10, queue: 150, failRate: 0 } },
    etl: { label: "ETL / Ingesta", group: "Anal\u00EDtica", color: C.analitica, hasIn: true, hasOut: true, defaults: { capacity: 200, latency: 500, jitter: 300, queue: 1000, failRate: 0 } },
    datalake: { label: "Data Lake", group: "Anal\u00EDtica", color: C.analitica, hasIn: true, hasOut: true, defaults: { capacity: 5000, latency: 40, jitter: 25, queue: 500, failRate: 0 } },
    lakehouse: { label: "Lakehouse", group: "Anal\u00EDtica", color: C.analitica, hasIn: true, hasOut: true, defaults: { capacity: 800, latency: 120, jitter: 60, queue: 200, failRate: 0 } },
    warehouse: { label: "Data Warehouse", group: "Anal\u00EDtica", color: C.analitica, hasIn: true, hasOut: true, defaults: { capacity: 300, latency: 200, jitter: 100, queue: 100, failRate: 0 } },
    bi: { label: "BI / Dashboard", group: "Anal\u00EDtica", color: C.analitica, hasIn: true, hasOut: true, defaults: { capacity: 100, latency: 150, jitter: 80, queue: 50, failRate: 0 } },
    external: { label: "API externa", group: "Externo", color: C.ext, hasIn: true, hasOut: true, defaults: { capacity: 100, latency: 120, jitter: 80, queue: 50, failRate: 0.01 } },
    agent: { label: "Agente IA", group: "IA / MCP", color: C.ia, hasIn: true, hasOut: true, defaults: { capacity: 50, latency: 100, jitter: 50, queue: 50, failRate: 0 } },
    llm: { label: "LLM", group: "IA / MCP", color: C.ia, hasIn: true, hasOut: true, defaults: { capacity: 20, latency: 800, jitter: 400, queue: 40, failRate: 0.01 } },
    tool: { label: "Herramienta / MCP", group: "IA / MCP", color: C.ia, hasIn: true, hasOut: true, defaults: { capacity: 100, latency: 40, jitter: 20, queue: 50, failRate: 0 } },
    vectordb: { label: "Vector DB", group: "IA / MCP", color: C.ia, hasIn: true, hasOut: true, defaults: { capacity: 500, latency: 25, jitter: 12, queue: 100, failRate: 0 } },
    embed: { label: "Embeddings", group: "IA / MCP", color: C.ia, hasIn: true, hasOut: true, defaults: { capacity: 200, latency: 60, jitter: 30, queue: 60, failRate: 0 } },
    k8s: { label: "Kubernetes", group: "Contenedores", color: C.k8s, hasIn: false, hasOut: false, defaults: { capacity: 0, latency: 0, jitter: 0, queue: 0, failRate: 0 } },
    cloud: { label: "Nube / regi\u00F3n", group: "Contenedores", color: C.cloud, hasIn: false, hasOut: false, defaults: { capacity: 0, latency: 0, jitter: 0, queue: 0, failRate: 0 } },
    vm: { label: "Servidor / VM", group: "Contenedores", color: C.vm, hasIn: false, hasOut: false, defaults: { capacity: 0, latency: 0, jitter: 0, queue: 0, failRate: 0 } },
    module: { label: "M\u00F3dulo", group: "M\u00F3dulos", color: C.module, hasIn: true, hasOut: true, defaults: { capacity: 0, latency: 0, jitter: 0, queue: 0, failRate: 0 } },
    layer: { label: "Capa transversal", group: "Contenedores", color: C.layer, hasIn: false, hasOut: false, defaults: { capacity: 0, latency: 0, jitter: 0, queue: 0, failRate: 0 } },
};
export const PALETTE_GROUPS: {
    group: string;
    kinds: ArchNodeKind[];
}[] = [
    { group: "Origen", kinds: ["client"] },
    { group: "Ataque", kinds: ["attacker"] },
    { group: "Seguridad", kinds: ["waf"] },
    { group: "Red", kinds: ["gateway", "lb", "cdn", "ratelimit"] },
    { group: "C\u00F3mputo", kinds: ["service", "worker", "auth", "orchestrator"] },
    { group: "Mensajer\u00EDa", kinds: ["queue", "pubsub"] },
    { group: "Datos", kinds: ["cache", "db", "nosql", "objstore", "search"] },
    { group: "Anal\u00EDtica", kinds: ["etl", "datalake", "lakehouse", "warehouse", "bi"] },
    { group: "Externo", kinds: ["external"] },
    { group: "IA / MCP", kinds: ["agent", "llm", "tool", "vectordb", "embed"] },
    { group: "Contenedores", kinds: ["k8s", "cloud", "vm", "layer"] },
];
export const NODE_COST_PRICED = "2026-08";
export const NODE_COST: Record<ArchNodeKind, number> = {
    ...(Object.fromEntries(AI_NODE_KINDS.map(k => [k, 0])) as Record<AiNodeKind, number>),
    ...(Object.fromEntries(CICD_NODE_KINDS.map(k => [k, 0])) as Record<CicdNodeKind, number>),
    client: 0,
    attacker: 0,
    waf: 0.03,
    gateway: 0.05,
    lb: 0.025,
    cdn: 0.05,
    ratelimit: 0.02,
    service: 0.05,
    worker: 0.04,
    auth: 0.03,
    orchestrator: 0.05,
    queue: 0.05,
    pubsub: 0.05,
    cache: 0.06,
    db: 0.12,
    nosql: 0.1,
    objstore: 0.02,
    search: 0.14,
    etl: 0.2,
    datalake: 0.05,
    lakehouse: 0.5,
    warehouse: 0.8,
    bi: 0.1,
    external: 0,
    agent: 0.05,
    llm: 1,
    tool: 0.02,
    vectordb: 0.1,
    embed: 0.1,
    k8s: 0,
    cloud: 0,
    vm: 0,
    module: 0,
    layer: 0,
};
export const LEGACY_NODE_COST: Partial<Record<ArchNodeKind, number>> = {
    waf: 40,
    gateway: 50,
    lb: 30,
    cdn: 100,
    ratelimit: 20,
    service: 40,
    worker: 30,
    auth: 20,
    orchestrator: 60,
    queue: 80,
    pubsub: 90,
    cache: 40,
    db: 200,
    nosql: 150,
    objstore: 20,
    search: 120,
    etl: 80,
    datalake: 30,
    lakehouse: 180,
    warehouse: 250,
    bi: 60,
    agent: 30,
    llm: 500,
    tool: 20,
    vectordb: 100,
    embed: 60,
};
export function effectiveCostHr(n: ArchNode): number {
    const v = n.costHr;
    if (v == null)
        return NODE_COST[n.kind] ?? 0;
    return v === LEGACY_NODE_COST[n.kind] ? NODE_COST[n.kind] ?? 0 : v;
}
export const NODE_W = 132;
export const NODE_H = 54;
export const DEFAULT_POOL = 200;
export const CONTAINER_HEADER = 26;
export function nodeInsideContainer(child: {
    x: number;
    y: number;
    w?: number;
    h?: number;
}, cont: {
    x: number;
    y: number;
    w?: number;
    h?: number;
}, header = CONTAINER_HEADER): boolean {
    return nodeInsideRect({ x: child.x, y: child.y, w: child.w ?? NODE_W, h: child.h ?? NODE_H }, { x: cont.x, y: cont.y, w: cont.w ?? 320, h: cont.h ?? 200 }, { header, headerSide: "top" });
}
