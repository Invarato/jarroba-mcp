import { ArchNode, ArchEdge } from "./archsim-model";
import { isAiKind } from "./archsim-ai";
import { isCicdKind } from "./archsim-cicd";
import { isRuntimeKind, RuntimeSimResult } from "./archsim-runtime-sim";
import { CicdSimResult } from "./archsim-cicd-sim";
export type InsightSev = "good" | "info" | "warn" | "bad";
export interface Insight {
    sev: InsightSev;
    title: string;
    detail: string;
    nodeId?: string;
    key: string;
    params?: Record<string, string | number>;
}
const has = (nodes: ArchNode[], kind: string) => nodes.some(n => n.kind === kind);
const pct = (x: number) => `${Math.round(x * 100)}%`;
export function runtimeInsights(nodes: ArchNode[], edges: ArchEdge[], res: RuntimeSimResult, infraCostHr: number): Insight[] {
    const out: Insight[] = [];
    const rt = nodes.filter(n => isRuntimeKind(n.kind));
    const byId = new Map(rt.map(n => [n.id, n]));
    const upstream = new Map<string, string[]>();
    for (const e of edges) {
        if (byId.has(e.toId))
            (upstream.get(e.toId) ?? upstream.set(e.toId, []).get(e.toId)!).push(e.fromId);
    }
    if (res.bottleneck) {
        const bn = byId.get(res.bottleneck);
        const rho = res.perNode[res.bottleneck]?.rho ?? 0;
        out.push({
            sev: rho >= 1 ? "bad" : "warn",
            nodeId: res.bottleneck,
            key: "bottleneck",
            params: { name: bn?.label || bn?.kind || res.bottleneck, pct: pct(Math.min(1, rho)), sat: rho >= 1 ? 1 : 0 },
            title: `Cuello de botella: ${bn?.label || bn?.kind || res.bottleneck}`,
            detail: `Al ${pct(Math.min(1, rho))} de su capacidad${rho >= 1 ? " (saturado)" : ""}. Opciones: subir capacidad, añadir réplicas, activar autoescalado, o poner una caché delante para descargarlo.`,
        });
    }
    if (res.availability < 0.99 && res.offered > 0) {
        out.push({ sev: res.availability < 0.9 ? "bad" : "warn", key: "avail-bad", params: { pct: pct(res.availability), drop: pct(res.dropRate) }, title: `Disponibilidad ${pct(res.availability)}`, detail: `Se descarta el ${pct(res.dropRate)} de las peticiones. Alivia el cuello o amplía la cola del nodo saturado.` });
    }
    else if (res.offered > 0) {
        out.push({ sev: "good", key: "avail-ok", params: { pct: pct(res.availability) }, title: `Disponibilidad ${pct(res.availability)}`, detail: "El sistema completa la carga actual sin descartes apreciables." });
    }
    if ((has(rt, "client") || has(rt, "gateway") || has(rt, "lb")) && !has(rt, "waf") && !has(rt, "ratelimit")) {
        out.push({ sev: "warn", key: "edge-no-waf", title: "Borde sin WAF ni rate-limiter", detail: "No hay defensa en el borde: un pico o un DDoS pasa directo a los servicios. A\u00F1ade un WAF y/o un rate-limiter (pru\u00E9balo con el escenario \u00ABDDoS\u00BB)." });
    }
    if (res.bottleneck) {
        const bn = byId.get(res.bottleneck);
        if (bn && !bn.autoscale && bn.kind !== "client") {
            out.push({ sev: "info", nodeId: res.bottleneck, key: "no-autoscale", title: "El cuello no tiene autoescalado", detail: "En un pico de tr\u00E1fico se saturar\u00E1 (pru\u00E9balo con el escenario \u00ABPico \u00D76\u00BB). Activa autoescalado en ese nodo para absorber los picos." });
        }
    }
    for (const n of rt)
        if ((n.retries ?? 0) > 0 && !n.breaker) {
            out.push({ sev: "warn", nodeId: n.id, key: "retries-no-breaker", params: { name: n.label || n.kind }, title: `Reintentos sin circuit breaker: ${n.label || n.kind}`, detail: "Si lo que llama falla, cada fallo se reintenta y la carga que le llega se multiplica justo cuando no da abasto. Un circuit breaker limita los reintentos (como mucho un 10 % de llamadas extra)." });
        }
    const downstream = new Map<string, string[]>();
    for (const e of edges)
        if (byId.has(e.fromId) && byId.has(e.toId))
            (downstream.get(e.fromId) ?? downstream.set(e.fromId, []).get(e.fromId)!).push(e.toId);
    const retr = (n: ArchNode) => (isAiKind(n.kind) || n.kind === "queue" || n.kind === "pubsub" ? 0 : Math.max(0, Math.floor(n.retries ?? 0)));
    const worst = (id: string, seen: Set<string>): [
        number,
        string[]
    ] => {
        const n = byId.get(id)!;
        const r = retr(n);
        let best: [
            number,
            string[]
        ] = [1, []];
        if (n.kind !== "queue" && n.kind !== "pubsub")
            for (const t of downstream.get(id) ?? []) {
                if (seen.has(t))
                    continue;
                const w = worst(t, new Set(seen).add(t));
                if (w[0] > best[0])
                    best = w;
            }
        return r > 0 ? [best[0] * (r + 1), [n.label || n.kind, ...best[1]]] : best;
    };
    const retriedAbove = (id: string, seen = new Set<string>([id])): boolean => (upstream.get(id) ?? []).some(u => {
        const un = byId.get(u);
        if (!un || seen.has(u) || un.kind === "queue" || un.kind === "pubsub")
            return false;
        seen.add(u);
        return retr(un) > 0 || retriedAbove(u, seen);
    });
    for (const n of rt)
        if (retr(n) > 0) {
            const [factor, names] = worst(n.id, new Set([n.id]));
            if (names.length < 2 || retriedAbove(n.id))
                continue;
            out.push({ sev: "warn", nodeId: n.id, key: "retries-multi-layer", params: { names: names.join(" \u2192 "), factor }, title: `Reintentos en varias capas: ${names.join(" \u2192 ")}`, detail: `Con la dependencia del final caída, cada capa reintenta lo que le falla a la de abajo y los intentos se multiplican: le llegan ${factor} veces la carga. Reintenta en un solo punto de la cadena, normalmente el más alto.` });
        }
    const callsCache = (u: string) => edges.some(e => e.fromId === u && byId.get(e.toId)?.kind === "cache");
    for (const n of rt)
        if ((n.kind === "db" || n.kind === "nosql") && !(upstream.get(n.id) ?? []).some(u => byId.get(u)?.kind === "cache" || callsCache(u))) {
            out.push({ sev: "info", nodeId: n.id, key: "db-no-cache", params: { name: n.label || "Base de datos" }, title: `${n.label || "Base de datos"} sin caché delante`, detail: "Cada petici\u00F3n pega a la base de datos. Una cach\u00E9 (Redis) delante reduce la carga y la latencia de las lecturas repetidas." });
            break;
        }
    for (const q of rt) {
        if ((q.kind !== "queue" && q.kind !== "pubsub") || !((q.redelivery ?? 0) > 0))
            continue;
        const consumerIds = edges.filter(e => e.fromId === q.id).map(e => e.toId);
        for (const cid of consumerIds) {
            const c = byId.get(cid);
            if (!c || c.idempotent === true)
                continue;
            out.push({ sev: "warn", nodeId: c.id, key: "dup-no-idempotent", params: { name: c.label || c.kind, pct: pct((q.redelivery ?? 0) / 100) }, title: `Duplicados sin proteger: ${c.label || c.kind}`, detail: `${q.label || (q.kind === "pubsub" ? "El bus" : "La cola")} reentrega un ${pct((q.redelivery ?? 0) / 100)} de los mensajes (at-least-once) y «${c.label || c.kind}» no está marcado idempotente: cada reentrega se procesa de nuevo. Deduplica por eventId (patrón inbox) o márcalo idempotente.` });
        }
    }
    const dur = (sec: number) => sec < 90 ? `${Math.round(sec)} s` : sec < 5400 ? `${Math.round(sec / 60)} min` : `${(sec / 3600).toFixed(1)} h`;
    for (const [qid, qs] of Object.entries(res.queues)) {
        const q = byId.get(qid);
        if (!q)
            continue;
        const name = q.label || q.kind;
        const params = { name, inRate: Math.round(qs.inRate), drain: Math.round(qs.drainCap), fill: qs.fillInSec !== null ? dur(qs.fillInSec) : "", lost: Math.round(qs.lost) };
        if (qs.lost > 0) {
            out.push({ sev: "bad", nodeId: qid, key: "queue-full", params, title: `Cola llena, pierde mensajes: ${name}`, detail: `Pierde ~${params.lost} msg/s que el productor ya dio por enviados. Entran ${params.inRate} msg/s y los consumidores procesan como mucho ${params.drain}. Más consumidores, más particiones o autoescalado por lag; la cola solo compra tiempo.` });
        }
        else if (qs.fillInSec !== null) {
            out.push({ sev: "warn", nodeId: qid, key: "queue-grows", params, title: `La cola crece: se llena en ~${params.fill}: ${name}`, detail: `Entran ${params.inRate} msg/s y los consumidores procesan como mucho ${params.drain}. En media una cola no quita carga, la aplaza: vale para PICOS, no para un exceso sostenido. Sube consumidores o particiones, o autoescala por lag.` });
        }
        else if ((q.queue ?? 0) <= 0 && qs.inRate > qs.drainCap + 0.001) {
            out.push({ sev: "warn", nodeId: qid, key: "queue-unbounded", params, title: `Cola sin tope que no para de crecer: ${name}`, detail: "Sin tama\u00F1o m\u00E1ximo no pierde mensajes, pero el backlog crece sin l\u00EDmite (disco, memoria, lag de horas). Ponle un tope o una retenci\u00F3n y dimensiona los consumidores." });
        }
        if (qs.partitionLimited) {
            out.push({ sev: "warn", nodeId: qid, key: "queue-partitions", params: { name, parts: q.partitions ?? 0 }, title: `Limitada por particiones: ${name}`, detail: `Con ${q.partitions ?? 0} particiones el grupo de consumidores no puede paralelizar más: cada partición la procesa un consumidor en serie. Sube las particiones (no se pueden bajar después en Kafka).` });
        }
    }
    for (const q of rt) {
        if ((q.kind !== "queue" && q.kind !== "pubsub") || !(upstream.get(q.id) ?? []).length)
            continue;
        if (edges.some(e => e.fromId === q.id && byId.has(e.toId)))
            continue;
        out.push({ sev: "info", nodeId: q.id, key: "queue-no-consumer", params: { name: q.label || q.kind }, title: `Cola sin consumidores: ${q.label || q.kind}`, detail: "Se trata como si la consumiera otro sistema: lo aceptado cuenta como hecho. Conecta sus consumidores para ver el lag y si dan abasto." });
    }
    if (res.hasAi) {
        if (res.costPerHour > 0)
            out.push({ sev: res.costPerHour > infraCostHr ? "warn" : "info", key: "llm-cost", params: { cost: res.costPerHour.toFixed(2) }, title: `El LLM cuesta ~$${res.costPerHour.toFixed(2)}/h`, detail: "El LLM suele dominar el coste. Baja la factura con una cach\u00E9 de respuestas y un router por coste (modelo barato para lo f\u00E1cil, potente solo para lo dif\u00EDcil)." });
        const router = rt.find(n => n.kind === "ai_router");
        if (router && !router.ai?.["fallback_model"])
            out.push({ sev: "warn", nodeId: router.id, key: "router-no-fallback", title: "Router LLM sin modelo de respaldo", detail: "Una ca\u00EDda del proveedor tumba el sistema (pru\u00E9balo con \u00ABCa\u00EDda LLM\u00BB). Configura un modelo de fallback para degradar en vez de caer." });
    }
    if (!out.some(i => i.sev === "warn" || i.sev === "bad"))
        out.unshift({ sev: "good", key: "runtime-ok", title: "Sin avisos de runtime", detail: "La arquitectura aguanta la carga actual sin cuellos ni riesgos evidentes. \uD83C\uDF89" });
    return out;
}
export function cicdInsights(nodes: ArchNode[], edges: ArchEdge[], res: CicdSimResult): Insight[] {
    const out: Insight[] = [];
    const ci = nodes.filter(n => isCicdKind(n.kind));
    out.push({ sev: res.dora === "elite" ? "good" : res.dora === "low" ? "bad" : "info", key: "dora", params: { dora: res.dora, lead: Math.round(res.leadP50), deploys: res.deploysPerDay.toFixed(1), cfr: pct(res.changeFailRate), mttr: Math.round(res.recoveryMin) }, title: `Tier DORA: ${res.dora}`, detail: `Lead time ${Math.round(res.leadP50)} min · ${res.deploysPerDay.toFixed(1)} deploys/día · CFR ${pct(res.changeFailRate)} · MTTR ${Math.round(res.recoveryMin)} min.` });
    if (res.queueMin > res.execMin)
        out.push({ sev: "warn", key: "queue-wait", params: { q: Math.round(res.queueMin), e: Math.round(res.execMin) }, title: "El lead time es sobre todo ESPERA de runner", detail: `${Math.round(res.queueMin)} min de cola vs ${Math.round(res.execMin)} de ejecución. Sube el pool de runners o activa autoescalado; el cuello no es el pipeline, es la espera.` });
    if (res.changeFailRate > 0.15)
        out.push({ sev: "bad", key: "cfr-high", params: { pct: pct(res.changeFailRate) }, title: `Change failure rate alto (${pct(res.changeFailRate)})`, detail: "Demasiados despliegues fallan en prod. A\u00F1ade tests/quality gate (o un gate de evals si es IA) y despliega con canary para coger el fallo antes de llegar a todos." });
    if (res.recoveryMin > 60)
        out.push({ sev: "warn", key: "mttr-high", params: { min: Math.round(res.recoveryMin) }, title: `Recuperación lenta (${Math.round(res.recoveryMin)} min)`, detail: "Tardas en revertir un fallo. Usa blue-green o canary con auto-rollback para volver a la versi\u00F3n buena casi al instante; un CE monitor detecta antes." });
    if (res.deploysPerDay < 1)
        out.push({ sev: "info", key: "deploy-freq", params: { n: res.deploysPerDay.toFixed(2) }, title: `Despliegas ${res.deploysPerDay.toFixed(2)}/día`, detail: "Para Elite conviene desplegar bajo demanda (varias veces al d\u00EDa). Lotes peque\u00F1os y pipeline r\u00E1pido ayudan." });
    if (ci.some(n => n.kind === "ci_stage" && Number(n.ai?.["flaky"]) > 0))
        out.push({ sev: "info", key: "flaky", title: "Tests flaky en el pipeline", detail: "Los flaky comen 20-30% del compute con reintentos y empujan la cola de TODOS los PRs. Estabil\u00EDzalos o a\u00EDslalos." });
    if (res.hasMergeQ && res.batchPassRate < 0.7)
        out.push({ sev: "warn", key: "mergeq-low", params: { pct: pct(res.batchPassRate) }, title: `La merge queue pasa solo el ${pct(res.batchPassRate)} de los batches`, detail: "El batch es demasiado grande: un PR malo tumba todo el lote. Baja el tama\u00F1o del batch (\u00F3ptimo 2-5) o activa la bisecci\u00F3n." });
    if (ci.some(n => n.kind === "ci_ragindex" && String(n.ai?.["strategy"]) === "inplace"))
        out.push({ sev: "info", key: "ragindex-inplace", title: "Reindex RAG in-place: ventana de inconsistencia", detail: "Sobrescribir el \u00EDndice en el sitio deja resultados a medias durante el reindexado. Blue-green (\u00EDndice nuevo aparte + swap at\u00F3mico) evita servir a medias." });
    if (ci.some(n => n.kind === "ci_cemonitor" && !n.ai?.["drift"]))
        out.push({ sev: "info", key: "cemonitor-no-drift", title: "CE monitor sin detecci\u00F3n de deriva", detail: "El monitor mide calidad en producci\u00F3n, pero sin detecci\u00F3n de deriva no dispara el reindex/fine-tuning cuando la distribuci\u00F3n cambia \u2014 alguien tiene que notarlo a mano." });
    return out;
}
