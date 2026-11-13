import { ArchNodeKind, ArchState, CATALOG } from "./archsim-model";
import { buildTemplate, TplNode } from "./archsim-build";
import { techById } from "./archsim-cloud-catalog";
export type TerraformError = {
    code: "empty";
} | {
    code: "no-resources";
} | {
    code: "nothing-drawable";
    resources: number;
};
export type TerraformNote = {
    code: "edges-deduced";
} | {
    code: "client-added";
} | {
    code: "unknown";
    names: string[];
} | {
    code: "plumbing";
    count: number;
} | {
    code: "modules";
    names: string[];
} | {
    code: "replicas";
    name: string;
    count: number;
} | {
    code: "code-buckets";
    count: number;
} | {
    code: "via-permissions";
    count: number;
} | {
    code: "via-shared-name";
    count: number;
};
export interface TfResource {
    type: string;
    name: string;
    body: string;
    refs: string[];
    eventRefs: string[];
}
export interface TerraformResult {
    state?: ArchState;
    error?: TerraformError;
    notes: TerraformNote[];
    stats?: {
        resources: number;
        components: number;
        edges: number;
        providers: string[];
    };
}
interface Map1 {
    kind: ArchNodeKind;
    tech?: string;
    serverless?: boolean;
}
const M: [
    RegExp,
    Map1
][] = [
    [/^aws_(lb|alb|elb)$/, { kind: "lb", tech: "aws-alb" }],
    [/^aws_(api_gateway_rest_api|apigatewayv2_api)$/, { kind: "gateway", tech: "aws-apigw" }],
    [/^aws_cloudfront_distribution$/, { kind: "cdn", tech: "aws-cf" }],
    [/^aws_(wafv2_web_acl|waf_web_acl|wafregional_web_acl)$/, { kind: "waf" }],
    [/^aws_lambda_function$/, { kind: "service", tech: "aws-lambda", serverless: true }],
    [/^aws_(ecs_service|apprunner_service|elastic_beanstalk_environment)$/, { kind: "service", tech: "aws-fargate" }],
    [/^aws_(instance|autoscaling_group|eks_node_group)$/, { kind: "service" }],
    [/^aws_(db_instance|rds_cluster)$/, { kind: "db", tech: "aws-rds" }],
    [/^aws_dynamodb_table$/, { kind: "nosql", tech: "aws-dynamo" }],
    [/^aws_(elasticache_cluster|elasticache_replication_group|memorydb_cluster)$/, { kind: "cache", tech: "aws-elasticache" }],
    [/^aws_s3_bucket$/, { kind: "objstore", tech: "aws-s3" }],
    [/^aws_sqs_queue$/, { kind: "queue", tech: "aws-sqs" }],
    [/^aws_(sns_topic|cloudwatch_event_bus)$/, { kind: "pubsub", tech: "aws-sns" }],
    [/^aws_(msk_cluster|kinesis_stream)$/, { kind: "queue", tech: "apache-kafka" }],
    [/^aws_(opensearch_domain|elasticsearch_domain)$/, { kind: "search", tech: "aws-opensearch" }],
    [/^aws_cognito_user_pool$/, { kind: "auth" }],
    [/^aws_sfn_state_machine$/, { kind: "orchestrator" }],
    [/^aws_redshift_cluster$/, { kind: "warehouse" }],
    [/^aws_glue_job$/, { kind: "etl" }],
    [/^azurerm_(application_gateway|lb)$/, { kind: "lb", tech: "azure-appgw" }],
    [/^azurerm_api_management$/, { kind: "gateway", tech: "azure-apim" }],
    [/^azurerm_(frontdoor|cdn_frontdoor_profile|cdn_profile)$/, { kind: "cdn", tech: "azure-fd" }],
    [/^azurerm_(web_application_firewall_policy|cdn_frontdoor_firewall_policy)$/, { kind: "waf" }],
    [/^azurerm_(linux_function_app|windows_function_app|function_app|function_app_flex_consumption)$/, { kind: "service", tech: "azure-func", serverless: true }],
    [/^azurerm_(container_app|linux_web_app|windows_web_app|app_service|linux_virtual_machine|windows_virtual_machine|virtual_machine|(linux_|windows_)?virtual_machine_scale_set|kubernetes_cluster_node_pool)$/, { kind: "service", tech: "azure-aca" }],
    [/^azurerm_(mssql_database|sql_database|postgresql_flexible_server|postgresql_server|mysql_flexible_server|mysql_server)$/, { kind: "db", tech: "azure-sql" }],
    [/^azurerm_cosmosdb_account$/, { kind: "nosql", tech: "azure-cosmos" }],
    [/^azurerm_(redis_cache|redis_enterprise_cluster)$/, { kind: "cache", tech: "azure-redis" }],
    [/^azurerm_storage_account$/, { kind: "objstore", tech: "azure-blob" }],
    [/^azurerm_servicebus_queue$/, { kind: "queue", tech: "azure-sb" }],
    [/^azurerm_(servicebus_topic|eventgrid_topic|eventhub)$/, { kind: "pubsub", tech: "azure-egrid" }],
    [/^azurerm_search_service$/, { kind: "search", tech: "azure-search" }],
    [/^azurerm_logic_app_workflow$/, { kind: "orchestrator" }],
    [/^azurerm_synapse_workspace$/, { kind: "warehouse" }],
    [/^azurerm_data_factory$/, { kind: "etl" }],
    [/^google_compute_backend_service$/, { kind: "lb", tech: "gcp-clb" }],
    [/^google_api_gateway_api$/, { kind: "gateway", tech: "gcp-apigw" }],
    [/^google_compute_security_policy$/, { kind: "waf" }],
    [/^google_(cloudfunctions_function|cloudfunctions2_function|cloud_run_service|cloud_run_v2_service)$/, { kind: "service", tech: "gcp-run", serverless: true }],
    [/^google_(compute_instance|compute_instance_group_manager|compute_region_instance_group_manager|container_node_pool)$/, { kind: "service" }],
    [/^google_sql_database_instance$/, { kind: "db", tech: "gcp-sql" }],
    [/^google_(spanner_instance|bigtable_instance|firestore_database)$/, { kind: "nosql", tech: "gcp-firestore" }],
    [/^google_redis_instance$/, { kind: "cache", tech: "gcp-memstore" }],
    [/^google_storage_bucket$/, { kind: "objstore", tech: "gcp-gcs" }],
    [/^google_pubsub_topic$/, { kind: "pubsub", tech: "gcp-pubsub" }],
    [/^google_cloud_tasks_queue$/, { kind: "queue" }],
    [/^google_bigquery_dataset$/, { kind: "warehouse" }],
    [/^google_dataflow_job$/, { kind: "etl" }],
    [/^google_workflows_workflow$/, { kind: "orchestrator" }],
    [/^kubernetes_(deployment|deployment_v1|stateful_set|stateful_set_v1)$/, { kind: "service" }],
];
const PLUMBING = /(^|_)(vpc|subnet|subnetwork|security_group|network_acl|route|route_table|internet_gateway|nat_gateway|nat|eip|address|network_interface|iam|kms|key_pair|log_group|log_stream|metric_alarm|dashboard|acm|route53|dns|certificate|secret|ssm|ecr|repository|resource_group|virtual_network|network_security|role|policy|service_account|project|firewall|monitor|alert|diagnostic|private_endpoint|private_dns|public_ip|network|key_vault|iam_user|iam_group|security_group_rule|identity|budget|backup|random|null|time|tls|local|archive)(_|$)/;
const EVENT = /^(aws_lambda_event_source_mapping|aws_sns_topic_subscription|aws_cloudwatch_event_target|aws_s3_bucket_notification|aws_pipes_pipe|google_pubsub_subscription|google_eventarc_trigger|google_storage_notification|azurerm_eventgrid_event_subscription|azurerm_eventgrid_system_topic_event_subscription)$/;
const CLOUD = /^(aws|azurerm|google|kubernetes)_/;
const RANK: Partial<Record<ArchNodeKind, number>> = {
    client: 0,
    cdn: 1,
    waf: 1,
    gateway: 2,
    lb: 2,
    auth: 3,
    service: 3,
    orchestrator: 3,
    worker: 4,
    cache: 5,
    queue: 5,
    pubsub: 5,
    db: 6,
    nosql: 6,
    search: 6,
    objstore: 6,
    warehouse: 7,
    etl: 7,
    datalake: 7,
};
const rankOf = (k: ArchNodeKind) => RANK[k] ?? 4;
export function parseHcl(src: string): {
    resources: TfResource[];
    modules: string[];
} {
    const resources: TfResource[] = [];
    const modules: string[] = [];
    let i = 0;
    const skipStr = () => { i++; while (i < src.length && src[i] !== "\"") {
        if (src[i] === "\\")
            i++;
        i++;
    } i++; };
    const skipComment = (): boolean => {
        if (src[i] === "#" || (src[i] === "/" && src[i + 1] === "/")) {
            while (i < src.length && src[i] !== "\n")
                i++;
            return true;
        }
        if (src[i] === "/" && src[i + 1] === "*") {
            const e = src.indexOf("*/", i + 2);
            i = e < 0 ? src.length : e + 2;
            return true;
        }
        return false;
    };
    const skipHeredoc = (): boolean => {
        const m = /^<<-?([A-Za-z_]\w*)\s*\n/.exec(src.slice(i, i + 80));
        if (!m)
            return false;
        const end = new RegExp(`\\n\\s*${m[1]}\\s*(\\n|$)`).exec(src.slice(i + m[0].length));
        i = end ? i + m[0].length + end.index + end[0].length : src.length;
        return true;
    };
    const block = (): string => {
        const start = i;
        let depth = 1;
        while (i < src.length && depth > 0) {
            if (skipComment() || skipHeredoc())
                continue;
            const c = src[i];
            if (c === "\"") {
                skipStr();
                continue;
            }
            if (c === "{")
                depth++;
            else if (c === "}")
                depth--;
            i++;
        }
        return src.slice(start, i - 1);
    };
    while (i < src.length) {
        if (skipComment())
            continue;
        const m = /^(resource|module|data|variable|output|locals|provider|terraform|moved|import|check|removed)\b\s*((?:"[^"]*"\s*)*)\{/.exec(src.slice(i, i + 400));
        if (m && (i === 0 || /[\s}]/.test(src[i - 1]))) {
            i += m[0].length;
            const labels = [...m[2].matchAll(/"([^"]*)"/g)].map(x => x[1]);
            const body = block();
            if (m[1] === "resource" && labels.length >= 2)
                resources.push({ type: labels[0], name: labels[1], body, refs: refsIn(body), eventRefs: eventRefsIn(body) });
            if (m[1] === "data" && labels[0] === "aws_iam_policy_document" && labels[1])
                resources.push({ type: labels[0], name: labels[1], body, refs: refsIn(body), eventRefs: [] });
            if (m[1] === "module" && labels[0])
                modules.push(labels[0]);
            continue;
        }
        if (src[i] === "\"") {
            skipStr();
            continue;
        }
        i++;
    }
    return { resources, modules };
}
const REF = /\b((?:aws|azurerm|google|kubernetes)_[a-z0-9_]+)\.([A-Za-z_][\w-]*)/g;
const refsIn = (body: string) => [...new Set([...body.matchAll(REF)].map(m => `${m[1]}.${m[2]}`))];
const CODE_REF = /\b(s3_bucket|source_archive_bucket|code_bucket|package_bucket)\s*=\s*([a-z0-9_]+\.[\w-]+)|storage_source\s*\{[^}]*?bucket\s*=\s*([a-z0-9_]+\.[\w-]+)/g;
export const codeRefsIn = (body: string) => [...body.matchAll(CODE_REF)].map(m => m[2] ?? m[3]);
function eventRefsIn(body: string): string[] {
    const out: string[] = [];
    for (const m of body.matchAll(/\b(event_trigger|trigger)\s*\{/g)) {
        let depth = 1, j = m.index! + m[0].length;
        const s = j;
        while (j < body.length && depth > 0) {
            if (body[j] === "{")
                depth++;
            else if (body[j] === "}")
                depth--;
            j++;
        }
        out.push(...refsIn(body.slice(s, j)));
    }
    return out;
}
function parseTfJson(d: Record<string, unknown>): {
    resources: TfResource[];
    modules: string[];
} {
    const resources: TfResource[] = [];
    for (const [type, byName] of Object.entries((d["resource"] ?? {}) as Record<string, Record<string, unknown>>))
        for (const [name, cfg] of Object.entries(byName ?? {})) {
            const body = JSON.stringify(cfg);
            resources.push({ type, name, body, refs: refsIn(body), eventRefs: [] });
        }
    return { resources, modules: Object.keys((d["module"] ?? {}) as object) };
}
export function looksLikeTerraform(text: string): boolean {
    return /^\s*resource\s+"[a-z0-9_]+"\s+"[^"]+"\s*\{/m.test(text) || /^\s*\{[\s\S]*"resource"\s*:\s*\{/.test(text.trim());
}
function attrNum(body: string, key: string): number | null {
    const m = new RegExp(`(^|\\n)\\s*"?${key}"?\\s*[=:]\\s*(\\d+)\\b`).exec(body);
    return m ? Number(m[2]) : null;
}
export function importTerraform(text: string): TerraformResult {
    const notes: TerraformNote[] = [];
    if (!text || !text.trim())
        return { error: { code: "empty" }, notes };
    let parsed: {
        resources: TfResource[];
        modules: string[];
    };
    const t = text.trim();
    if (t.startsWith("{")) {
        try {
            parsed = parseTfJson(JSON.parse(t));
        }
        catch {
            parsed = parseHcl(text);
        }
    }
    else
        parsed = parseHcl(text);
    const { resources, modules } = parsed;
    if (modules.length)
        notes.push({ code: "modules", names: modules });
    if (!resources.length)
        return { error: { code: "no-resources" }, notes };
    const key = (r: TfResource) => `${r.type}.${r.name}`;
    const byKey = new Map(resources.map(r => [key(r), r]));
    const mapOf = (r: TfResource) => M.find(([re]) => re.test(r.type))?.[1];
    const replicaOf = new Map<string, string>();
    for (const r of resources) {
        const m = /replicate_source_db\s*=\s*([a-z0-9_]+\.[\w-]+)/.exec(r.body) ?? /source_server_id\s*=\s*([a-z0-9_]+\.[\w-]+)/.exec(r.body);
        if (m && byKey.has(m[1]) && mapOf(r)?.kind === "db")
            replicaOf.set(key(r), m[1]);
    }
    const drawn = resources.filter(r => mapOf(r) && !replicaOf.has(key(r)));
    const unknown = resources.filter(r => !mapOf(r) && CLOUD.test(r.type) && !PLUMBING.test(r.type.replace(CLOUD, "")) && !EVENT.test(r.type) && !isConnector(r.type));
    const plumbing = resources.filter(r => PLUMBING.test(r.type.replace(CLOUD, "")));
    if (!drawn.length)
        return { error: { code: "nothing-drawable", resources: resources.length }, notes };
    if (unknown.length)
        notes.push({ code: "unknown", names: unknown.map(key).slice(0, 12) });
    if (plumbing.length)
        notes.push({ code: "plumbing", count: plumbing.length });
    const drawnSet = new Set(drawn.map(key));
    const adj = new Map<string, Set<string>>();
    const add = (a: string, b: string) => { if (a === b)
        return; (adj.get(a) ?? adj.set(a, new Set()).get(a)!).add(b); (adj.get(b) ?? adj.set(b, new Set()).get(b)!).add(a); };
    const usable = (k: string) => byKey.has(k) && !PLUMBING.test(byKey.get(k)!.type.replace(CLOUD, ""));
    const codeBuckets = new Set(resources.flatMap(r => codeRefsIn(r.body)));
    const ARTIFACT = /^(aws_s3_object|aws_s3_bucket_object|google_storage_bucket_object|azurerm_storage_blob)$/;
    for (const r of resources)
        if (ARTIFACT.test(r.type))
            for (const ref of r.refs)
                codeBuckets.add(ref);
    for (const r of resources) {
        if (!usable(key(r)) || ARTIFACT.test(r.type))
            continue;
        const code = new Set(codeRefsIn(r.body));
        for (const ref of r.refs)
            if (usable(ref) && !code.has(ref))
                add(key(r), replicaOf.get(ref) ?? ref);
    }
    const pairs = new Map<string, {
        a: string;
        b: string;
        event: boolean;
        referrer: string;
    }>();
    for (const start of drawnSet) {
        const seen = new Set([start]);
        let frontier: {
            k: string;
            event: boolean;
        }[] = [{ k: start, event: false }];
        for (let hop = 0; hop < 4 && frontier.length; hop++) {
            const next: {
                k: string;
                event: boolean;
            }[] = [];
            for (const f of frontier)
                for (const n of adj.get(f.k) ?? []) {
                    if (seen.has(n))
                        continue;
                    seen.add(n);
                    const ev = f.event || EVENT.test(byKey.get(n)!.type) || byKey.get(start)!.eventRefs.includes(n) || (byKey.get(n)!.eventRefs.includes(start));
                    if (drawnSet.has(n)) {
                        const id = [start, n].sort().join("|");
                        if (!pairs.has(id))
                            pairs.set(id, { a: start, b: n, event: ev, referrer: byKey.get(start)!.refs.includes(n) ? start : byKey.get(n)!.refs.includes(start) ? n : start });
                    }
                    else
                        next.push({ k: n, event: ev });
                }
            frontier = next;
        }
    }
    const kindOf = (k: string) => mapOf(byKey.get(k)!)!.kind;
    const SOURCE: Partial<Record<ArchNodeKind, number>> = { objstore: 2, db: 2, nosql: 2, queue: 1, pubsub: 1 };
    const srcOf = (k: ArchNodeKind) => SOURCE[k] ?? 0;
    const edges: [
        string,
        string
    ][] = [];
    for (const { a, b, event, referrer } of pairs.values()) {
        const ka = kindOf(a), kb = kindOf(b);
        let from: string, to: string;
        if (ka === "waf" || kb === "waf")
            [from, to] = ka === "waf" ? [a, b] : [b, a];
        else if (event && srcOf(ka) !== srcOf(kb))
            [from, to] = srcOf(ka) > srcOf(kb) ? [a, b] : [b, a];
        else if (rankOf(ka) !== rankOf(kb))
            [from, to] = rankOf(ka) < rankOf(kb) ? [a, b] : [b, a];
        else
            [from, to] = referrer === a ? [a, b] : [b, a];
        edges.push([from, to]);
    }
    const STORE = new Set<ArchNodeKind>(["db", "nosql", "objstore", "queue", "pubsub", "cache", "search"]);
    const IAMISH = /(^|_)(iam|policy|role)(_|$)/;
    const iamAdj = new Map<string, Set<string>>();
    const addI = (a: string, b: string) => { (iamAdj.get(a) ?? iamAdj.set(a, new Set()).get(a)!).add(b); (iamAdj.get(b) ?? iamAdj.set(b, new Set()).get(b)!).add(a); };
    for (const r of resources)
        for (const ref of r.refs)
            if (byKey.has(ref) && (IAMISH.test(r.type) || IAMISH.test(byKey.get(ref)!.type)))
                addI(key(r), ref);
    let viaIam = 0;
    const linked0 = new Set(edges.flat());
    for (const st of drawn.map(key).filter(k => !linked0.has(k) && STORE.has(kindOf(k)) && !codeBuckets.has(k))) {
        const seen = new Set([st]);
        let fr = [st];
        for (let hop = 0; hop < 4 && fr.length; hop++) {
            const nx: string[] = [];
            for (const k of fr)
                for (const n of iamAdj.get(k) ?? []) {
                    if (seen.has(n))
                        continue;
                    seen.add(n);
                    if (drawnSet.has(n) && rankOf(kindOf(n)) === 3) {
                        edges.push([n, st]);
                        viaIam++;
                    }
                    else if (IAMISH.test(byKey.get(n)!.type))
                        nx.push(n);
                }
            fr = nx;
        }
    }
    if (viaIam)
        notes.push({ code: "via-permissions", count: viaIam });
    let viaName = 0;
    const linked1 = new Set(edges.flat());
    for (const st of drawn.map(key).filter(k => !linked1.has(k) && STORE.has(kindOf(k)) && !codeBuckets.has(k))) {
        const m = /(?:^|\n)\s*(?:name|bucket|table_name|queue_name|topic_name)\s*=\s*((?:var|local)\.[A-Za-z_]\w*)\b/.exec(byKey.get(st)!.body);
        if (!m)
            continue;
        const re = new RegExp(`\\b${m[1].replace(".", "\\.")}\\b`);
        for (const c of drawn.map(key).filter(k => k !== st && rankOf(kindOf(k)) === 3 && re.test(byKey.get(k)!.body))) {
            edges.push([c, st]);
            viaName++;
        }
    }
    if (viaName)
        notes.push({ code: "via-shared-name", count: viaName });
    if (edges.length)
        notes.push({ code: "edges-deduced" });
    const linked = new Set(edges.flat());
    const dropped = drawn.filter(r => codeBuckets.has(key(r)) && !linked.has(key(r)));
    if (dropped.length) {
        notes.push({ code: "code-buckets", count: dropped.length });
        for (const d of dropped)
            drawn.splice(drawn.indexOf(d), 1);
    }
    const hasIn = new Set(edges.map(e => e[1]));
    let entries = drawn.map(key).filter(k => !hasIn.has(k) && rankOf(kindOf(k)) <= 2);
    if (!entries.length)
        entries = drawn.map(key).filter(k => !hasIn.has(k) && rankOf(kindOf(k)) === 3);
    const CLIENT = "__client";
    if (entries.length) {
        notes.push({ code: "client-added" });
        for (const e of entries)
            edges.push([CLIENT, e]);
    }
    const outs = new Map<string, string[]>();
    for (const [a, b] of edges)
        (outs.get(a) ?? outs.set(a, []).get(a)!).push(b);
    const col = new Map<string, number>([[CLIENT, 0]]);
    for (let it = 0; it < drawn.length + 1; it++)
        for (const [a, b] of edges) {
            const c = (col.get(a) ?? 0) + 1;
            if (c > (col.get(b) ?? 0) && c < 20)
                col.set(b, c);
        }
    const rows = new Map<number, number>();
    const placed = (k: string) => { const c = col.get(k) ?? (rankOf(kindOf(k)) + 1); const r = rows.get(c) ?? 0; rows.set(c, r + 1); return { col: c, row: r }; };
    const tplNodes: TplNode[] = [];
    if (entries.length)
        tplNodes.push({ ref: CLIENT, kind: "client", label: "Usuarios", ...placed(CLIENT) });
    const providers = new Set<string>();
    for (const r of drawn) {
        const k = key(r), m = mapOf(r)!;
        const tech = m.tech ? techById(m.tech) : undefined;
        if (tech)
            providers.add(tech.provider);
        else if (/^aws_/.test(r.type))
            providers.add("aws");
        else if (/^azurerm_/.test(r.type))
            providers.add("azure");
        else if (/^google_/.test(r.type))
            providers.add("gcp");
        const n = attrNum(r.body, "count") ?? attrNum(r.body, "desired_capacity") ?? attrNum(r.body, "desired_count") ?? attrNum(r.body, "node_count") ?? attrNum(r.body, "instances") ?? 1;
        const base = tech?.defaults.capacity ?? CATALOG[m.kind].defaults.capacity;
        const node: TplNode = { ref: k, kind: m.kind, label: r.name, tech: m.tech, ...placed(k) };
        if (n > 1)
            node.capacity = base * n;
        const reps = [...replicaOf.entries()].filter(([, src]) => src === k).length;
        if (reps) {
            node.replicas = reps;
            notes.push({ code: "replicas", name: r.name, count: reps });
        }
        const parts = attrNum(r.body, "shard_count") ?? attrNum(r.body, "number_of_broker_nodes");
        if (parts && m.kind === "queue")
            node.partitions = parts;
        tplNodes.push(node);
    }
    const state = buildTemplate({ id: "terraform", title: "terraform", nodes: tplNodes, edges });
    for (const r of drawn)
        if (/autoscaling_group|instance_group_manager|scale_set/.test(r.type) || resources.some(x => /appautoscaling_target|autoscale_setting|autoscaler/.test(x.type) && x.refs.includes(key(r)))) {
            const idx = tplNodes.findIndex(t => t.ref === key(r));
            if (idx >= 0 && state.nodes[idx])
                state.nodes[idx].autoscale = true;
        }
    return { state, notes, stats: { resources: resources.length, components: drawn.length, edges: edges.length - entries.length, providers: [...providers] } };
}
function isConnector(type: string): boolean {
    return /(s3_object|bucket_object|api_gateway_account|authorizer|domain_name|api_mapping|base_path_mapping|listener|target_group|attachment|integration|_route$|routes|method|stage|deployment|permission|association|url_map|target_http|target_https|forwarding_rule|backend$|backend_bucket|health_check|instance_group$|event_rule|task_definition|launch_template|launch_configuration|api_management_api|frontdoor_(origin|endpoint|route)|cdn_frontdoor|function_app_function|_policy$|_settings?$|bucket_(versioning|acl|public|server_side|lifecycle|cors|website|ownership|logging)|database$|_db$|sql_user|parameter_group|subnet_group|option_group|cluster_instance|consumer_group|namespace|queue_policy|topic_policy|lambda_alias|lambda_layer|cloudwatch_event_rule|service_plan|app_service_plan|container_app_environment|log_analytics|application_insights|storage_container|storage_queue|storage_blob|sql_server|mssql_server|kubernetes_cluster$|eks_cluster$|ecs_cluster$|container_cluster$|cosmosdb_sql|cosmosdb_mongo|dynamodb_table_item|sqs_queue_redrive|sns_topic_policy)/.test(type);
}
