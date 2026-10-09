export function murmur2(data: Uint8Array): number {
    const length = data.length;
    const m = 1540483477;
    const r = 24;
    let h = (2538058380 ^ length) | 0;
    const length4 = length >> 2;
    for (let i = 0; i < length4; i++) {
        const i4 = i << 2;
        let k = data[i4] | (data[i4 + 1] << 8) | (data[i4 + 2] << 16) | (data[i4 + 3] << 24);
        k = Math.imul(k, m);
        k ^= k >>> r;
        k = Math.imul(k, m);
        h = Math.imul(h, m);
        h ^= k;
    }
    const index = length4 << 2;
    const resto = length - index;
    if (resto >= 3)
        h ^= data[index + 2] << 16;
    if (resto >= 2)
        h ^= data[index + 1] << 8;
    if (resto >= 1) {
        h ^= data[index];
        h = Math.imul(h, m);
    }
    h ^= h >>> 13;
    h = Math.imul(h, m);
    h ^= h >>> 15;
    return h | 0;
}
export function toPositive(n: number): number {
    return n & 2147483647;
}
export const MAX_PARTICIONES = 1000000;
export interface KafkaPartitionResult {
    partition: number;
    hash: number;
    positive: number;
    bytes: number;
}
const utf8 = new TextEncoder();
export function partitionForKey(key: string | Uint8Array, numPartitions: number): KafkaPartitionResult | null {
    if (!Number.isInteger(numPartitions) || numPartitions < 1 || numPartitions > MAX_PARTICIONES)
        return null;
    const data = typeof key === "string" ? utf8.encode(key) : key;
    const hash = murmur2(data);
    const positive = toPositive(hash);
    return { partition: positive % numPartitions, hash, positive, bytes: data.length };
}
