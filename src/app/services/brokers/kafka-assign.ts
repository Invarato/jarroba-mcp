import { asignaSticky, Transferencia } from "./kafka-sticky";
export type AssignStrategy = "range" | "roundrobin" | "sticky" | "cooperative-sticky";
export interface KafkaTopic {
    name: string;
    partitions: number;
}
export interface KafkaMember {
    id: string;
    topics: string[];
    groupInstanceId?: string;
    owned?: TopicPartition[];
    generation?: number;
}
export interface TopicPartition {
    topic: string;
    partition: number;
}
export interface KafkaAssignInput {
    topics: KafkaTopic[];
    members: KafkaMember[];
    strategy: AssignStrategy;
}
export type KafkaAssignResult = {
    ok: true;
    assignment: Record<string, TopicPartition[]>;
    idle: string[];
    orden: string[];
    transferring: Transferencia[];
} | {
    ok: false;
    error: KafkaAssignError;
};
export type KafkaAssignError = {
    codigo: "estrategia-desconocida";
    valor: string;
} | {
    codigo: "miembro-repetido";
    id: string;
} | {
    codigo: "miembro-sin-id";
} | {
    codigo: "topic-repetido";
    nombre: string;
} | {
    codigo: "particiones-invalidas";
    topic: string;
    valor: number;
} | {
    codigo: "demasiado-grande";
    maximo: number;
} | {
    codigo: "particion-inexistente";
    miembro: string;
    topic: string;
    partition: number;
} | {
    codigo: "generacion-invalida";
    miembro: string;
} | {
    codigo: "sticky-suscripciones-distintas";
} | {
    codigo: "estado-imposible";
};
export const MAX_PARTICIONES_TOTAL = 200000;
export const MAX_MIEMBROS = 10000;
const ESTRATEGIAS: readonly AssignStrategy[] = ["range", "roundrobin", "sticky", "cooperative-sticky"];
function porCodigo(a: string, b: string): number {
    return a < b ? -1 : a > b ? 1 : 0;
}
export function ordenMiembros(a: KafkaMember, b: KafkaMember): number {
    const ga = a.groupInstanceId, gb = b.groupInstanceId;
    if (ga !== undefined && gb !== undefined)
        return porCodigo(ga, gb);
    if (ga !== undefined)
        return -1;
    if (gb !== undefined)
        return 1;
    return porCodigo(a.id, b.id);
}
function porTopicYParticion(a: TopicPartition, b: TopicPartition): number {
    return porCodigo(a.topic, b.topic) || a.partition - b.partition;
}
function asignaRange(topics: Map<string, number>, miembros: KafkaMember[], out: Record<string, TopicPartition[]>): void {
    for (const [topic, n] of topics) {
        if (n === 0)
            continue;
        const suscritos = miembros.filter(m => m.topics.includes(topic));
        if (suscritos.length === 0)
            continue;
        const porMiembro = Math.floor(n / suscritos.length);
        const conExtra = n % suscritos.length;
        let siguiente = 0;
        suscritos.forEach((m, i) => {
            const cuantas = porMiembro + (i < conExtra ? 1 : 0);
            for (let k = 0; k < cuantas; k++)
                out[m.id].push({ topic, partition: siguiente++ });
        });
    }
}
function asignaRoundRobin(topics: Map<string, number>, miembros: KafkaMember[], out: Record<string, TopicPartition[]>): void {
    const suscritos = [...new Set(miembros.flatMap(m => m.topics))].sort(porCodigo);
    let cursor = 0;
    for (const topic of suscritos) {
        const n = topics.get(topic);
        if (n === undefined)
            continue;
        for (let p = 0; p < n; p++) {
            while (!miembros[cursor].topics.includes(topic))
                cursor = (cursor + 1) % miembros.length;
            out[miembros[cursor].id].push({ topic, partition: p });
            cursor = (cursor + 1) % miembros.length;
        }
    }
}
export function kafkaAssign(input: KafkaAssignInput): KafkaAssignResult {
    if (!ESTRATEGIAS.includes(input.strategy)) {
        return { ok: false, error: { codigo: "estrategia-desconocida", valor: String(input.strategy) } };
    }
    const topics = new Map<string, number>();
    let total = 0;
    for (const t of input.topics ?? []) {
        if (topics.has(t.name))
            return { ok: false, error: { codigo: "topic-repetido", nombre: t.name } };
        if (!Number.isInteger(t.partitions) || t.partitions < 0) {
            return { ok: false, error: { codigo: "particiones-invalidas", topic: t.name, valor: t.partitions } };
        }
        total += t.partitions;
        topics.set(t.name, t.partitions);
    }
    if (total > MAX_PARTICIONES_TOTAL)
        return { ok: false, error: { codigo: "demasiado-grande", maximo: MAX_PARTICIONES_TOTAL } };
    const miembros = input.members ?? [];
    if (miembros.length > MAX_MIEMBROS)
        return { ok: false, error: { codigo: "demasiado-grande", maximo: MAX_MIEMBROS } };
    const ids = new Set<string>();
    for (const m of miembros) {
        if (!m.id)
            return { ok: false, error: { codigo: "miembro-sin-id" } };
        if (ids.has(m.id))
            return { ok: false, error: { codigo: "miembro-repetido", id: m.id } };
        ids.add(m.id);
        if (m.generation !== undefined && !Number.isInteger(m.generation))
            return { ok: false, error: { codigo: "generacion-invalida", miembro: m.id } };
        for (const tp of m.owned ?? []) {
            const n = topics.get(tp.topic);
            if (n !== undefined && !(Number.isInteger(tp.partition) && tp.partition >= 0 && tp.partition < n)) {
                return { ok: false, error: { codigo: "particion-inexistente", miembro: m.id, topic: tp.topic, partition: tp.partition } };
            }
        }
    }
    if (input.strategy === "sticky" || input.strategy === "cooperative-sticky") {
        if (miembros.length === 0)
            return { ok: true, assignment: {}, idle: [], orden: [], transferring: [] };
        const r = asignaSticky(topics, miembros, input.strategy === "cooperative-sticky");
        if (!r.ok)
            return r;
        for (const id of Object.keys(r.assignment))
            r.assignment[id].sort(porTopicYParticion);
        return {
            ok: true,
            assignment: r.assignment,
            idle: r.orden.filter(id => r.assignment[id].length === 0),
            orden: r.orden,
            transferring: r.transferring,
        };
    }
    const ordenados = [...miembros].sort(ordenMiembros);
    const assignment: Record<string, TopicPartition[]> = {};
    for (const m of ordenados)
        assignment[m.id] = [];
    if (ordenados.length > 0) {
        if (input.strategy === "range")
            asignaRange(topics, ordenados, assignment);
        else
            asignaRoundRobin(topics, ordenados, assignment);
    }
    for (const id of Object.keys(assignment))
        assignment[id].sort(porTopicYParticion);
    return {
        ok: true,
        assignment,
        idle: ordenados.filter(m => assignment[m.id].length === 0).map(m => m.id),
        orden: ordenados.map(m => m.id),
        transferring: [],
    };
}
