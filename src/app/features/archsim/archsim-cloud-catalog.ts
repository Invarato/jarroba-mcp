import { ArchNode, ArchNodeKind, CATALOG, CloudProvider, CloudHosting, Region, Currency, CostModel, NODE_COST, LEGACY_NODE_COST, effectiveCostHr } from "./archsim-model";
import { isAiKind } from "./archsim-ai";
import { isRuntimeKind } from "./archsim-runtime-sim";
export interface CloudTech {
    id: string;
    provider: CloudProvider;
    hosting: CloudHosting;
    kinds: ArchNodeKind[];
    label: string;
    defaults: {
        capacity: number;
        latency: number;
        coldStartMs?: number;
    };
    prices: Partial<Record<Region, CostModel>>;
    pricedAt: string;
    note?: string;
    docUrl?: string;
}
const PRICED = "2026-08";
export const AVG_RESP_BYTES = 60000;
export const FX: Record<Currency, {
    rate: number;
    symbol: string;
    pricedAt: string;
}> = {
    USD: { rate: 1, symbol: "$", pricedAt: PRICED },
    EUR: { rate: 0.92, symbol: "\u20AC", pricedAt: PRICED },
};
export const PROVIDER_PRICING: Record<CloudProvider, string> = {
    aws: "https://aws.amazon.com/pricing/",
    azure: "https://azure.microsoft.com/pricing/",
    gcp: "https://cloud.google.com/pricing",
    oci: "https://www.oracle.com/cloud/price-list/",
    alibaba: "https://www.alibabacloud.com/product",
    ibm: "https://www.ibm.com/cloud/pricing",
    apache: "https://kafka.apache.org/",
    confluent: "https://www.confluent.io/pricing/",
    cloudera: "https://www.cloudera.com/products/pricing.html",
    elastic: "https://www.elastic.co/pricing/",
    redis: "https://redis.io/pricing/",
    rabbitmq: "https://www.rabbitmq.com/",
    minio: "https://min.io/pricing",
};
const r3 = (x: number) => Math.round(x * 1000) / 1000;
function reg(us: CostModel, euMult = 1.06): Partial<Record<Region, CostModel>> {
    const eu: CostModel = { perMillionReq: us.perMillionReq, perGbOut: us.perGbOut };
    if (us.fixedHr != null)
        eu.fixedHr = r3(us.fixedHr * euMult);
    return { us, eu };
}
export const CLOUD_TECHS: CloudTech[] = [
    t("aws-apigw", "aws", "managed", ["gateway"], "API Gateway (HTTP)", { capacity: 10000, latency: 3 }, reg({ perMillionReq: 1 })),
    t("azure-apim", "azure", "managed", ["gateway"], "API Management (Consumo)", { capacity: 8000, latency: 4 }, reg({ perMillionReq: 3.5 })),
    t("gcp-apigw", "gcp", "managed", ["gateway"], "API Gateway / Apigee", { capacity: 10000, latency: 4 }, reg({ perMillionReq: 3 })),
    t("aws-alb", "aws", "managed", ["lb"], "Application Load Balancer", { capacity: 20000, latency: 2 }, reg({ fixedHr: 0.0225, perGbOut: 0.008 })),
    t("azure-appgw", "azure", "managed", ["lb"], "Application Gateway (v2)", { capacity: 20000, latency: 2 }, reg({ fixedHr: 0.246, perGbOut: 0.008 })),
    t("gcp-clb", "gcp", "managed", ["lb"], "Cloud Load Balancing", { capacity: 25000, latency: 2 }, reg({ fixedHr: 0.025, perGbOut: 0.008 })),
    t("aws-cf", "aws", "managed", ["cdn"], "CloudFront", { capacity: 50000, latency: 5 }, reg({ perGbOut: 0.085 })),
    t("azure-fd", "azure", "managed", ["cdn"], "Front Door / CDN", { capacity: 50000, latency: 5 }, reg({ perGbOut: 0.081, perMillionReq: 0.6 })),
    t("gcp-cdn", "gcp", "managed", ["cdn"], "Cloud CDN", { capacity: 50000, latency: 5 }, reg({ perGbOut: 0.08 })),
    t("aws-fargate", "aws", "managed", ["service", "worker"], "ECS Fargate", { capacity: 300, latency: 20 }, reg({ fixedHr: 0.049 })),
    t("azure-aca", "azure", "managed", ["service", "worker"], "Container Apps", { capacity: 300, latency: 20 }, reg({ fixedHr: 0.043 })),
    t("gcp-run", "gcp", "managed", ["service", "worker"], "Cloud Run", { capacity: 400, latency: 18, coldStartMs: 600 }, reg({ perMillionReq: 0.4, fixedHr: 0.006 })),
    t("aws-lambda", "aws", "managed", ["worker"], "Lambda", { capacity: 500, latency: 30, coldStartMs: 400 }, reg({ perMillionReq: 0.2 })),
    t("azure-func", "azure", "managed", ["worker"], "Functions (consumo)", { capacity: 500, latency: 30, coldStartMs: 900 }, reg({ perMillionReq: 0.2 })),
    t("aws-sqs", "aws", "managed", ["queue"], "SQS", { capacity: 30000, latency: 1 }, reg({ perMillionReq: 0.4 })),
    t("azure-sb", "azure", "managed", ["queue"], "Service Bus", { capacity: 20000, latency: 1 }, reg({ fixedHr: 0.0135, perMillionReq: 0.8 })),
    t("gcp-pubsub-q", "gcp", "managed", ["queue"], "Pub/Sub (pull)", { capacity: 30000, latency: 1 }, reg({ perMillionReq: 0.4 })),
    t("aws-sns", "aws", "managed", ["pubsub"], "SNS / EventBridge", { capacity: 30000, latency: 1 }, reg({ perMillionReq: 0.5 })),
    t("azure-egrid", "azure", "managed", ["pubsub"], "Event Grid", { capacity: 30000, latency: 1 }, reg({ perMillionReq: 0.6 })),
    t("gcp-pubsub", "gcp", "managed", ["pubsub"], "Pub/Sub (temas)", { capacity: 30000, latency: 1 }, reg({ perMillionReq: 0.4 })),
    t("aws-elasticache", "aws", "managed", ["cache"], "ElastiCache (Redis)", { capacity: 12000, latency: 1 }, reg({ fixedHr: 0.068 })),
    t("azure-redis", "azure", "managed", ["cache"], "Cache for Redis", { capacity: 10000, latency: 1 }, reg({ fixedHr: 0.055 })),
    t("gcp-memstore", "gcp", "managed", ["cache"], "Memorystore", { capacity: 12000, latency: 1 }, reg({ fixedHr: 0.049 })),
    t("aws-rds", "aws", "managed", ["db"], "RDS / Aurora", { capacity: 500, latency: 12 }, reg({ fixedHr: 0.12 })),
    t("azure-sql", "azure", "managed", ["db"], "Azure SQL / Postgres", { capacity: 500, latency: 12 }, reg({ fixedHr: 0.12 })),
    t("gcp-sql", "gcp", "managed", ["db"], "Cloud SQL / AlloyDB", { capacity: 500, latency: 12 }, reg({ fixedHr: 0.11 })),
    t("aws-dynamo", "aws", "managed", ["nosql"], "DynamoDB (on-demand)", { capacity: 4000, latency: 6 }, reg({ perMillionReq: 0.5 })),
    t("azure-cosmos", "azure", "managed", ["nosql"], "Cosmos DB", { capacity: 4000, latency: 6 }, reg({ perMillionReq: 0.6, fixedHr: 0.032 })),
    t("gcp-firestore", "gcp", "managed", ["nosql"], "Firestore / Bigtable", { capacity: 4000, latency: 6 }, reg({ perMillionReq: 0.7 }), "Firestore: $0.06/100k lecturas, $0.18/100k escrituras (blend)."),
    t("aws-s3", "aws", "managed", ["objstore"], "S3", { capacity: 6000, latency: 25 }, reg({ perMillionReq: 0.4, perGbOut: 0.09 })),
    t("azure-blob", "azure", "managed", ["objstore"], "Blob Storage", { capacity: 6000, latency: 25 }, reg({ perMillionReq: 0.44, perGbOut: 0.087 })),
    t("gcp-gcs", "gcp", "managed", ["objstore"], "Cloud Storage", { capacity: 6000, latency: 25 }, reg({ perMillionReq: 0.4, perGbOut: 0.12 })),
    t("aws-opensearch", "aws", "managed", ["search"], "OpenSearch Service", { capacity: 2000, latency: 18 }, reg({ fixedHr: 0.14 })),
    t("azure-search", "azure", "managed", ["search"], "Azure AI Search", { capacity: 2000, latency: 18 }, reg({ fixedHr: 0.101 })),
    t("gcp-vertex-search", "gcp", "managed", ["search"], "Vertex AI Search", { capacity: 2000, latency: 18 }, reg({ perMillionReq: 2000 }), "B\u00FAsqueda gestionada POR CONSULTA ($1,5\u20136 por 1.000, edici\u00F3n est\u00E1ndar). Muy cara a alto QPS: para b\u00FAsqueda intensiva sale mejor un cl\u00FAster propio (OpenSearch/Elastic)."),
    t("aws-bedrock", "aws", "managed", ["llm"], "Bedrock", { capacity: 25, latency: 700 }, { us: {}, eu: {} }, "Coste por tokens (lo calcula la simulaci\u00F3n)."),
    t("azure-openai", "azure", "managed", ["llm"], "Azure OpenAI", { capacity: 25, latency: 700 }, { us: {}, eu: {} }, "Coste por tokens (lo calcula la simulaci\u00F3n)."),
    t("gcp-vertex", "gcp", "managed", ["llm"], "Vertex AI (Gemini)", { capacity: 25, latency: 700 }, { us: {}, eu: {} }, "Coste por tokens (lo calcula la simulaci\u00F3n)."),
    t("apache-kafka", "apache", "self", ["queue", "pubsub"], "Apache Kafka", { capacity: 40000, latency: 2 }, reg({ fixedHr: 0.2 }), "Coste = las VMs/K8s del cl\u00FAster + operaci\u00F3n; sin licencia."),
    t("pg-self", "apache", "self", ["db"], "PostgreSQL (self-hosted)", { capacity: 500, latency: 12 }, reg({ fixedHr: 0.05 }), "Coste = la VM/servidor + operaci\u00F3n; sin licencia."),
    t("redis-self", "redis", "self", ["cache"], "Redis (self-hosted)", { capacity: 12000, latency: 1 }, reg({ fixedHr: 0.04 }), "Coste = la VM/servidor + operaci\u00F3n; sin licencia."),
    t("minio-self", "minio", "self", ["objstore"], "MinIO (self-hosted, S3-compatible)", { capacity: 6000, latency: 20 }, reg({ fixedHr: 0.08 }), "Coste = servidores + discos; sin egress de nube."),
    t("opensearch-self", "elastic", "self", ["search"], "OpenSearch (self-hosted)", { capacity: 2000, latency: 18 }, reg({ fixedHr: 0.12 }), "Coste = el cl\u00FAster de VMs + operaci\u00F3n."),
    t("rabbitmq-self", "rabbitmq", "self", ["queue"], "RabbitMQ (self-hosted)", { capacity: 15000, latency: 2 }, reg({ fixedHr: 0.05 }), "Coste = la VM/servidor + operaci\u00F3n."),
    t("confluent", "confluent", "enterprise", ["queue", "pubsub"], "Confluent Platform/Cloud", { capacity: 40000, latency: 2 }, reg({ fixedHr: 0.6, perGbOut: 0.05 }), "Kafka gestionado/enterprise: compute + licencia/soporte."),
    t("cloudera", "cloudera", "enterprise", ["db", "search"], "Cloudera (Hadoop/Spark)", { capacity: 1500, latency: 20 }, reg({ fixedHr: 0.9 }), "Distribuci\u00F3n comercial: compute + licencia/soporte."),
    t("elastic-ent", "elastic", "enterprise", ["search"], "Elastic (comercial)", { capacity: 2500, latency: 16 }, reg({ fixedHr: 0.25 }), "Elastic comercial: compute + suscripci\u00F3n."),
    t("redis-ent", "redis", "enterprise", ["cache"], "Redis Enterprise", { capacity: 15000, latency: 1 }, reg({ fixedHr: 0.12 }), "Redis Enterprise: compute + licencia."),
];
function t(id: string, provider: CloudProvider, hosting: CloudHosting, kinds: ArchNodeKind[], label: string, defaults: {
    capacity: number;
    latency: number;
    coldStartMs?: number;
}, prices: Partial<Record<Region, CostModel>>, note?: string): CloudTech {
    return { id, provider, hosting, kinds, label, defaults, prices, pricedAt: PRICED, note };
}
const BY_ID = new Map(CLOUD_TECHS.map(x => [x.id, x]));
export function techById(id: string | undefined): CloudTech | undefined { return id ? BY_ID.get(id) : undefined; }
export function techsFor(kind: ArchNodeKind, opts: {
    provider?: CloudProvider;
    hosting?: CloudHosting;
} = {}): CloudTech[] {
    return CLOUD_TECHS.filter(x => x.kinds.includes(kind)
        && (!opts.provider || x.provider === opts.provider)
        && (!opts.hosting || x.hosting === opts.hosting));
}
export function providersFor(kind: ArchNodeKind): CloudProvider[] {
    return [...new Set(CLOUD_TECHS.filter(x => x.kinds.includes(kind)).map(x => x.provider))];
}
export type CostSource = "tech" | "default" | "manual";
export function baseCost(n: ArchNode, region: Region): CostModel {
    const tech = techById(n.tech);
    if (tech)
        return tech.prices[region] ?? tech.prices[region === "us" ? "eu" : "us"] ?? {};
    return { fixedHr: effectiveCostHr(n) };
}
export function resolveCost(n: ArchNode, region: Region): CostModel {
    const base = baseCost(n, region);
    if (!n.cost)
        return base;
    const out: CostModel = { ...base };
    for (const k of ["fixedHr", "perMillionReq", "perGbOut"] as const) {
        const v = n.cost[k];
        if (typeof v === "number" && Number.isFinite(v))
            out[k] = v;
    }
    return out;
}
export function costSource(n: ArchNode): CostSource {
    if (n.cost && Object.values(n.cost).some(v => typeof v === "number"))
        return "manual";
    if (techById(n.tech))
        return "tech";
    return n.costHr == null || n.costHr === NODE_COST[n.kind] || n.costHr === LEGACY_NODE_COST[n.kind] ? "default" : "manual";
}
export function instancesOf(n: ArchNode, servedRps: number): number {
    const replicas = Math.max(0, Math.floor(n.replicas ?? 0));
    const perInst = techById(n.tech)?.defaults.capacity ?? CATALOG[n.kind]?.defaults.capacity ?? 0;
    let inst = 1;
    if (perInst > 0) {
        inst = Math.max(1, (n.capacity ?? perInst) / perInst);
        if (n.autoscale)
            inst = Math.max(inst, servedRps / perInst);
    }
    return (1 + replicas) * inst;
}
export function scaledCost(n: ArchNode, c: CostModel, servedRps: number): CostModel {
    const k = instancesOf(n, servedRps);
    return k === 1 || c.fixedHr == null ? c : { ...c, fixedHr: c.fixedHr * k };
}
export function nodeCostHrUsd(cost: CostModel, servedRps: number): number {
    return (cost.fixedHr ?? 0)
        + (cost.perMillionReq ?? 0) * servedRps * 3600 / 1000000
        + (cost.perGbOut ?? 0) * servedRps * AVG_RESP_BYTES * 3600 / 1000000000;
}
export interface CostBreakdown {
    infraHr: number;
    aiInfraHr: number;
    byProvider: Record<string, number>;
}
export function costBreakdown(nodes: ArchNode[], served: Record<string, number>, region: Region): CostBreakdown {
    let infraHr = 0, aiInfraHr = 0;
    const byProvider: Record<string, number> = {};
    for (const n of nodes) {
        if (!isRuntimeKind(n.kind) || n.down)
            continue;
        const hr = nodeCostHrUsd(scaledCost(n, resolveCost(n, region), served[n.id] ?? 0), served[n.id] ?? 0);
        if (hr <= 0)
            continue;
        if (isAiKind(n.kind)) {
            aiInfraHr += hr;
            continue;
        }
        infraHr += hr;
        const key = techById(n.tech) ? (n.hosting === "self" || n.hosting === "enterprise" ? n.hosting : (n.provider ?? "sin-tarifa")) : "sin-tarifa";
        byProvider[key] = (byProvider[key] ?? 0) + hr;
    }
    return { infraHr, aiInfraHr, byProvider };
}
