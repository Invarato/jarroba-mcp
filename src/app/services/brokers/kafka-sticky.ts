import type { KafkaMember, TopicPartition } from "./kafka-assign";
const DEFAULT_GENERATION = -1;
export function javaStringHash(s: string): number {
    let h = 0;
    for (let i = 0; i < s.length; i++)
        h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
    return h;
}
export function ordenHashMapJava(claves: string[]): string[] {
    let cap = 16;
    while (claves.length > cap * 0.75)
        cap *= 2;
    return claves
        .map((k, i) => {
        const h = javaStringHash(k);
        return { k, i, bucket: (h ^ (h >>> 16)) & (cap - 1) };
    })
        .sort((a, b) => a.bucket - b.bucket || a.i - b.i)
        .map(x => x.k);
}
function porCodigo(a: string, b: string): number {
    return a < b ? -1 : a > b ? 1 : 0;
}
const clave = (tp: TopicPartition) => `${tp.topic}\u0000${tp.partition}`;
function quitaPrimera(lista: TopicPartition[], tp: TopicPartition): void {
    const i = lista.findIndex(x => x.topic === tp.topic && x.partition === tp.partition);
    if (i >= 0)
        lista.splice(i, 1);
}
export interface Transferencia {
    topic: string;
    partition: number;
    to: string;
    from?: string;
}
export type ResultadoSticky = {
    ok: true;
    assignment: Record<string, TopicPartition[]>;
    transferring: Transferencia[];
    orden: string[];
} | {
    ok: false;
    error: {
        codigo: "sticky-suscripciones-distintas";
    } | {
        codigo: "estado-imposible";
    };
};
export function asignaSticky(topics: Map<string, number>, miembros: KafkaMember[], cooperativo: boolean): ResultadoSticky {
    const porId = new Map(miembros.map(m => [m.id, m]));
    const orden = ordenHashMapJava(miembros.map(m => m.id));
    const suscritos = new Set(miembros.flatMap(m => m.topics));
    const todos = new Map([...topics].filter(([t]) => suscritos.has(t)));
    let iguales = true;
    const suscripcion = new Set<string>();
    const duenoPrevio = new Map<string, string>();
    const varios = new Set<string>();
    const poseidas = new Map<string, TopicPartition[]>();
    const generacion = (id: string) => porId.get(id)!.generation ?? DEFAULT_GENERATION;
    for (const id of orden) {
        const m = porId.get(id)!;
        if (suscripcion.size === 0)
            m.topics.forEach(t => suscripcion.add(t));
        else if (iguales && !(m.topics.length === suscripcion.size && m.topics.every(t => suscripcion.has(t))))
            iguales = false;
        const gen = generacion(id);
        const mias: TopicPartition[] = [];
        poseidas.set(id, mias);
        for (const tp of m.owned ?? []) {
            if (!todos.has(tp.topic))
                continue;
            const k = clave(tp);
            const otro = duenoPrevio.get(k);
            if (otro === undefined) {
                mias.push(tp);
                duenoPrevio.set(k, id);
            }
            else if (gen === generacion(otro)) {
                varios.add(k);
                quitaPrimera(poseidas.get(otro)!, tp);
                duenoPrevio.set(k, id);
            }
            else if (gen > generacion(otro)) {
                mias.push(tp);
                quitaPrimera(poseidas.get(otro)!, tp);
                duenoPrevio.set(k, id);
            }
        }
    }
    if (!iguales)
        return { ok: false, error: { codigo: "sticky-suscripciones-distintas" } };
    const total = [...todos.values()].reduce((a, b) => a + b, 0);
    const n = orden.length;
    const minQuota = Math.floor(total / n);
    const maxQuota = Math.ceil(total / n);
    const esperadosSobreMin = total % n;
    let sobreMin = 0;
    const asignacion = new Map(orden.map(id => [id, [] as TopicPartition[]]));
    const asignadas = new Set<string>();
    const quizaRevocadas = new Map<string, string>();
    const bajoMin: string[] = [];
    let justoMin: string[] = [];
    const transfer = new Map<string, Transferencia>();
    for (const id of orden) {
        const propias = [...poseidas.get(id)!].sort((a, b) => a.partition - b.partition || porCodigo(a.topic, b.topic));
        for (const k of varios) {
            const i = propias.findIndex(tp => clave(tp) === k);
            if (i >= 0)
                propias.splice(i, 1);
        }
        const suyas = asignacion.get(id)!;
        const conserva = (cuantas: number) => {
            for (const tp of propias.slice(0, cuantas)) {
                suyas.push(tp);
                asignadas.add(clave(tp));
            }
            for (const tp of propias.slice(cuantas))
                quizaRevocadas.set(clave(tp), id);
        };
        if (propias.length < minQuota) {
            conserva(propias.length);
            bajoMin.push(id);
        }
        else if (propias.length >= maxQuota && sobreMin < esperadosSobreMin) {
            sobreMin++;
            if (sobreMin === esperadosSobreMin)
                justoMin = [];
            conserva(maxQuota);
        }
        else {
            conserva(minQuota);
            if (sobreMin < esperadosSobreMin)
                justoMin.push(id);
        }
    }
    const libres: TopicPartition[] = [];
    for (const topic of [...todos.keys()].sort(porCodigo)) {
        for (let p = 0; p < todos.get(topic)!; p++)
            if (!asignadas.has(clave({ topic, partition: p })))
                libres.push({ topic, partition: p });
    }
    bajoMin.sort(porCodigo);
    justoMin.sort(porCodigo);
    const asignaNueva = (tp: TopicPartition, id: string): number => {
        const suyas = asignacion.get(id)!;
        suyas.push(tp);
        const k = clave(tp);
        const antes = quizaRevocadas.get(k);
        if ((antes !== undefined && antes !== id) || varios.has(k))
            transfer.set(k, { ...tp, to: id, ...(antes !== undefined ? { from: antes } : {}) });
        return suyas.length;
    };
    let cursor = 0;
    for (const tp of libres) {
        let id: string;
        let deBajoMin = true;
        if (cursor < bajoMin.length) {
            id = bajoMin[cursor++];
        }
        else if (bajoMin.length === 0 && justoMin.length === 0) {
            return { ok: false, error: { codigo: "estado-imposible" } };
        }
        else if (bajoMin.length === 0) {
            id = justoMin.shift()!;
            deBajoMin = false;
        }
        else {
            cursor = 0;
            id = bajoMin[cursor++];
        }
        const cuantas = asignaNueva(tp, id);
        if (cuantas === minQuota) {
            if (!deBajoMin)
                return { ok: false, error: { codigo: "estado-imposible" } };
            bajoMin.splice(--cursor, 1);
            justoMin.push(id);
        }
        else if (cuantas === maxQuota) {
            sobreMin++;
        }
    }
    if (cooperativo)
        for (const t of transfer.values())
            quitaPrimera(asignacion.get(t.to)!, t);
    const assignment: Record<string, TopicPartition[]> = {};
    for (const id of orden)
        assignment[id] = asignacion.get(id)!;
    const transferring = [...transfer.values()].sort((a, b) => porCodigo(a.topic, b.topic) || a.partition - b.partition);
    return { ok: true, assignment, transferring, orden };
}
