import { ARQUITECTURAS, BYTES_PESO, GIB, GPUS, contextoQueCabe, memoria, techoTokensPorSegundo, type ArquitecturaLlm, type Precision, type PrecisionKv, } from "../../src/app/services/llm-escala";
import { UMBRALES, curvas, paraArchsim, umbralSugerido } from "../../src/app/services/cache-calibracion.service";
import { aB64url } from "../../src/app/shared/b64url";
const g = (bytes: number) => Math.round((bytes / GIB) * 100) / 100;
const r2 = (x: number) => Math.round(x * 100) / 100;
export const MODELOS_LLM = ARQUITECTURAS.map((a) => a.id) as [
    string,
    ...string[]
];
export const GPUS_LLM = GPUS.map((x) => x.id) as [
    string,
    ...string[]
];
export interface EntradaMemoria {
    model?: string;
    architecture?: {
        name?: string;
        parameters: number;
        activeParameters?: number;
        layers: number;
        kvHeads: number;
        headDim: number;
        maxContext?: number;
    };
    precision: Precision;
    kvPrecision: PrecisionKv;
    context?: number;
    batch: number;
    overhead: number;
    gpu?: string;
    gpuMemoryGiB?: number;
    bandwidthGBs?: number;
    gpuCount: number;
}
export function memoriaLlm(e: EntradaMemoria) {
    let arq: ArquitecturaLlm;
    if (e.architecture) {
        const a = e.architecture;
        arq = { id: "custom", nombre: a.name ?? "custom", parametros: a.parameters, ...(a.activeParameters ? { activos: a.activeParameters } : {}), capas: a.layers, cabezasKv: a.kvHeads, dimCabeza: a.headDim, contextoMax: a.maxContext ?? Infinity };
    }
    else {
        const f = ARQUITECTURAS.find((x) => x.id === e.model);
        if (!f)
            return { error: `Unknown model "${e.model}". Known: ${MODELOS_LLM.join(", ")} — or pass architecture (from the model's config.json).` };
        arq = f;
    }
    const gpu = e.gpu ? GPUS.find((x) => x.id === e.gpu)! : null;
    const memGiB = e.gpuMemoryGiB ?? gpu?.gb;
    const anchoGBs = e.bandwidthGBs ?? gpu?.anchoGbS;
    const contexto = e.context ?? (Number.isFinite(arq.contextoMax) ? arq.contextoMax : 8192);
    const mem = memoria({ arq, precision: e.precision, precisionKv: e.kvPrecision, contexto, lote: e.batch, margen: e.overhead });
    const bytesGpu = memGiB !== undefined ? memGiB * GIB * e.gpuCount : null;
    const cabe = (precision: Precision) => {
        const t = memoria({ arq, precision, precisionKv: e.kvPrecision, contexto, lote: e.batch, margen: e.overhead }).total;
        return { precision, totalGiB: g(t), ...(bytesGpu !== null ? { fits: t <= bytesGpu } : {}) };
    };
    const maxCtx = bytesGpu !== null ? contextoQueCabe({ arq, precision: e.precision, precisionKv: e.kvPrecision, lote: e.batch, margen: e.overhead }, bytesGpu) : null;
    const techo = anchoGBs !== undefined ? techoTokensPorSegundo(arq, e.precision, anchoGBs * 1000000000) : null;
    return {
        model: { name: arq.nombre, parameters: arq.parametros, ...(arq.activos ? { activeParametersPerToken: arq.activos } : {}), layers: arq.capas, kvHeads: arq.cabezasKv, headDim: arq.dimCabeza, ...(Number.isFinite(arq.contextoMax) ? { maxContext: arq.contextoMax } : {}) },
        assumptions: { precision: e.precision, bytesPerWeight: r2(BYTES_PESO[e.precision] * 1000) / 1000, kvPrecision: e.kvPrecision, context: contexto, batch: e.batch, overhead: e.overhead },
        memory: {
            weightsGiB: g(mem.pesos),
            kvCacheGiB: g(mem.kv),
            overheadGiB: g(mem.margen),
            totalGiB: g(mem.total),
            kvCacheBytesPerToken: mem.kvPorToken,
            kvCacheMiBPer1kTokens: Math.round((mem.kvPorToken * 1000 * e.batch / 2 ** 20) * 10) / 10,
        },
        ...(bytesGpu !== null ? {
            gpu: {
                name: gpu ? gpu.nombre : "custom",
                memoryGiB: memGiB,
                count: e.gpuCount,
                totalGiB: g(bytesGpu),
                fits: mem.total <= bytesGpu,
                freeGiB: g(bytesGpu - mem.total),
                maxContextThatFits: maxCtx === 0 ? 0 : Number.isFinite(arq.contextoMax) ? Math.min(maxCtx!, arq.contextoMax) : maxCtx,
                ...(maxCtx !== null && Number.isFinite(arq.contextoMax) && maxCtx > arq.contextoMax ? { limitedBy: "the model's maxContext, not memory" } : {}),
            },
        } : {}),
        ...(techo !== null ? { decodeTokensPerSecondCeiling: Math.round(techo * 10) / 10 } : {}),
        byPrecision: (["fp16", "q8", "q4"] as Precision[]).map(cabe),
        notes: [
            "Weights = parameters \u00D7 bytes per weight (q8/q4 include their block scales: 8.5 and 4.5 bits, llama.cpp Q8_0/Q4_0). KV cache = 2 \u00D7 layers \u00D7 KV heads \u00D7 head dim \u00D7 tokens \u00D7 batch \u00D7 bytes: it grows with the conversation, not with the model.",
            "Memory is in GiB (what nvidia-smi shows; a \"24 GB\" card is 24 GiB). The overhead for activations and the runtime is an assumption you set, not a measurement.",
            ...(techo !== null ? ["The tokens/s figure is a CEILING: each generated token reads every active weight, so tokens/s \u2264 bandwidth / active weight bytes. Real decoding is slower; with several GPUs, tensor parallelism adds communication."] : []),
            ...(arq.activos ? ["Mixture of experts: ALL parameters must be in memory, but only the active ones are read per token \u2014 that is why its speed ceiling is much higher than its size suggests."] : []),
            ...(e.gpuCount > 1 ? ["Several GPUs: memory is summed as if the model split perfectly; real splits waste some."] : []),
            "Same engine as https://jarroba.com/tools/en/llm-costs (models read from Hugging Face config.json on 2026-11-11; GPUs from nvidia.com on 2026-11-12).",
        ],
    };
}
export interface EntradaCache {
    pairs: {
        cosine: number;
        same: boolean;
    }[];
    maxWrong: number;
    chosen?: number;
    embeddingModel?: string;
}
export function umbralCache(e: EntradaCache) {
    const c = curvas(e.pairs.map((p) => p.cosine), e.pairs.map((p) => p.same));
    const sugerido = umbralSugerido(c, e.maxWrong);
    const elegido = e.chosen ?? sugerido;
    const fila = (u: number) => { const i = UMBRALES.indexOf(u); return { threshold: u, hitRate: c.aciertos[i], wrongAmongHits: c.equivocados[i] }; };
    const iguales = e.pairs.filter((p) => p.same).length;
    const notas = [
        "hitRate(u): share of pairs with cosine \u2265 u (the cache would treat them as the same question). wrongAmongHits(u): of those, the share that did NOT have the same answer \u2014 a wrong answer served from cache.",
        "This is YOUR SAMPLE, not your traffic: the real hit rate depends on how often real questions repeat. The wrong rate is what transfers, and only with the same embedding model.",
    ];
    if (e.pairs.length < 30)
        notas.push(`Only ${e.pairs.length} pairs: each one moves the curves by ${Math.round(100 / e.pairs.length)} points. Aim for 50+, with many near-misses (similar questions, different answers).`);
    if (iguales === 0 || iguales === e.pairs.length)
        notas.push("All pairs have the same label: with no contrast there is nothing to calibrate.");
    const archsim = elegido !== null ? paraArchsim(c, e.pairs.length, elegido, e.embeddingModel ?? "unknown") : null;
    return {
        pairs: e.pairs.length,
        samePairs: iguales,
        suggested: sugerido === null
            ? { threshold: null, why: `No threshold keeps wrong answers at or below ${Math.round(e.maxWrong * 100)} % while still hitting: this model mixes up your near-misses. Raise maxWrong, try another embedding model, or do not use a semantic cache here.` }
            : { ...fila(sugerido), why: `The lowest threshold (most hits) whose wrongAmongHits ≤ ${e.maxWrong}.` },
        ...(e.chosen !== undefined ? { chosen: fila(UMBRALES.reduce((m, x) => (Math.abs(x - e.chosen!) < Math.abs(m - e.chosen!) ? x : m), UMBRALES[0])) } : {}),
        curve: UMBRALES.filter((u) => Math.round(u * 100) % 5 === 0).map(fila),
        ...(archsim ? {
            archsim: { threshold: archsim.elegido, link: `https://jarroba.com/tools/en/archsim#cache=${aB64url(JSON.stringify(archsim))}`, how: "Open the link: the Architecture Simulator puts these curves into the semantic cache of its LLM gateway (it adds a gateway if the page has none), so the cache hits and errs as measured here and the threshold can be moved there." },
        } : {}),
        notes: notas,
    };
}
