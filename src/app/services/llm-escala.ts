export interface ArquitecturaLlm {
    id: string;
    nombre: string;
    parametros: number;
    activos?: number;
    capas: number;
    cabezasKv: number;
    dimCabeza: number;
    contextoMax: number;
}
export const ARQUITECTURAS: readonly ArquitecturaLlm[] = [
    { id: "qwen3-0.6b", nombre: "Qwen3 0.6B", parametros: 751632384, capas: 28, cabezasKv: 8, dimCabeza: 128, contextoMax: 40960 },
    { id: "mistral-7b", nombre: "Mistral 7B", parametros: 7241732096, capas: 32, cabezasKv: 8, dimCabeza: 128, contextoMax: 32768 },
    { id: "qwen3-8b", nombre: "Qwen3 8B", parametros: 8190735360, capas: 36, cabezasKv: 8, dimCabeza: 128, contextoMax: 40960 },
    { id: "qwen3-32b", nombre: "Qwen3 32B", parametros: 32762123264, capas: 64, cabezasKv: 8, dimCabeza: 128, contextoMax: 40960 },
    { id: "qwen3-235b-a22b", nombre: "Qwen3 235B-A22B (MoE)", parametros: 235093634560, activos: 22000000000, capas: 94, cabezasKv: 4, dimCabeza: 128, contextoMax: 40960 },
];
export type Precision = "fp32" | "fp16" | "q8" | "q4";
export const BYTES_PESO: Readonly<Record<Precision, number>> = { fp32: 4, fp16: 2, q8: 8.5 / 8, q4: 4.5 / 8 };
export type PrecisionKv = "fp16" | "q8";
export const BYTES_KV: Readonly<Record<PrecisionKv, number>> = { fp16: 2, q8: 1 };
export interface EntradaMemoria {
    arq: ArquitecturaLlm;
    precision: Precision;
    precisionKv: PrecisionKv;
    contexto: number;
    lote: number;
    margen: number;
}
export interface Memoria {
    pesos: number;
    kv: number;
    margen: number;
    total: number;
    kvPorToken: number;
}
export function kvPorToken(arq: ArquitecturaLlm, precisionKv: PrecisionKv): number {
    return 2 * arq.capas * arq.cabezasKv * arq.dimCabeza * BYTES_KV[precisionKv];
}
export function memoria(e: EntradaMemoria): Memoria {
    const pesos = e.arq.parametros * BYTES_PESO[e.precision];
    const porToken = kvPorToken(e.arq, e.precisionKv);
    const kv = porToken * Math.max(0, e.contexto) * Math.max(1, e.lote);
    const margen = (pesos + kv) * Math.max(0, e.margen);
    return { pesos, kv, margen, total: pesos + kv + margen, kvPorToken: porToken };
}
export function contextoQueCabe(e: Omit<EntradaMemoria, "contexto">, bytesGpu: number): number {
    const util = bytesGpu / (1 + Math.max(0, e.margen));
    const libre = util - e.arq.parametros * BYTES_PESO[e.precision];
    if (libre <= 0)
        return 0;
    return Math.floor(libre / (kvPorToken(e.arq, e.precisionKv) * Math.max(1, e.lote)));
}
export function techoTokensPorSegundo(arq: ArquitecturaLlm, precision: Precision, anchoBandaBytesS: number): number {
    return anchoBandaBytesS / ((arq.activos ?? arq.parametros) * BYTES_PESO[precision]);
}
export interface Gpu {
    id: string;
    nombre: string;
    gb: number;
    anchoGbS: number;
}
export const GIB = 2 ** 30;
export const GPUS: readonly Gpu[] = [
    { id: "rtx5060", nombre: "GeForce RTX 5060", gb: 8, anchoGbS: 448 },
    { id: "rtx5090", nombre: "GeForce RTX 5090", gb: 32, anchoGbS: 1792 },
    { id: "h100sxm", nombre: "H100 SXM", gb: 80, anchoGbS: 3350 },
    { id: "h100nvl", nombre: "H100 NVL", gb: 94, anchoGbS: 3900 },
];
export const CHINCHILLA = { E: 1.69, A: 406.4, B: 410.7, alfa: 0.34, beta: 0.28 } as const;
export function perdida(n: number, d: number): number {
    const { E, A, B, alfa, beta } = CHINCHILLA;
    return E + A / Math.pow(n, alfa) + B / Math.pow(d, beta);
}
export function flops(n: number, d: number): number { return 6 * n * d; }
export function optimoChinchilla(c: number): {
    n: number;
    d: number;
    perdida: number;
} {
    const { A, B, alfa, beta } = CHINCHILLA;
    const g = Math.pow((alfa * A) / (beta * B), 1 / (alfa + beta));
    const n = g * Math.pow(c / 6, beta / (alfa + beta));
    const d = c / (6 * n);
    return { n, d, perdida: perdida(n, d) };
}
export function curvaIsoFlops(c: number, nMin: number, nMax: number, puntos = 60): {
    n: number;
    d: number;
    perdida: number;
}[] {
    const out: {
        n: number;
        d: number;
        perdida: number;
    }[] = [];
    const a = Math.log10(nMin), b = Math.log10(nMax);
    for (let i = 0; i < puntos; i++) {
        const n = Math.pow(10, a + ((b - a) * i) / (puntos - 1));
        const d = c / (6 * n);
        out.push({ n, d, perdida: perdida(n, d) });
    }
    return out;
}
export interface ModeloEntrenado {
    id: string;
    nombre: string;
    n: number;
    d: number;
    fuente: string;
}
export const MODELOS_ENTRENADOS: readonly ModeloEntrenado[] = [
    { id: "gpt3", nombre: "GPT-3", n: 175000000000, d: 300000000000, fuente: "Hoffmann et al. 2022, tabla 1" },
    { id: "gopher", nombre: "Gopher", n: 280000000000, d: 300000000000, fuente: "Hoffmann et al. 2022, tabla 1" },
    { id: "mt-nlg", nombre: "MT-NLG 530B", n: 530000000000, d: 270000000000, fuente: "Hoffmann et al. 2022, tabla 1" },
    { id: "chinchilla", nombre: "Chinchilla", n: 70000000000, d: 1400000000000, fuente: "Hoffmann et al. 2022, tabla 1" },
    { id: "llama3-8b", nombre: "Llama 3 8B", n: 8000000000, d: 15000000000000, fuente: "ai.meta.com/blog/meta-llama-3" },
];
