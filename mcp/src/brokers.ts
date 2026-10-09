import type { RabbitRouteResult, RabbitRouteError, RazonBinding, CondicionHeader } from "../../src/app/services/brokers/rabbit-route";
import type { KafkaAssignResult, KafkaAssignError } from "../../src/app/services/brokers/kafka-assign";
const MODO: Record<CondicionHeader["modo"], string> = { presencia: "present", igual: "equals" };
const RESULTADO: Record<CondicionHeader["resultado"], string> = { casa: "match", falla: "no-match", ignorada: "ignored" };
function razonEn(r: RazonBinding) {
    switch (r.tipo) {
        case "fanout": return { type: "fanout" };
        case "direct": return { type: "direct", matches: r.casa };
        case "topic": return { type: "topic", matches: r.casa, routingKeyWords: r.palabrasClave, bindingKeyWords: r.palabrasPatron };
        case "headers": return { type: "headers", matches: r.casa, xMatch: r.xMatch, conditions: r.condiciones.map((c) => ({ header: c.clave, mode: MODO[c.modo], result: RESULTADO[c.resultado] })) };
    }
}
const ERROR_RABBIT: {
    [K in RabbitRouteError["codigo"]]: (e: Extract<RabbitRouteError, {
        codigo: K;
    }>) => string;
} = {
    "tipo-desconocido": (e) => `Unknown exchange type "${e.valor}": use direct, topic, fanout or headers.`,
    "x-match-invalido": (e) => `Binding ${e.binding}: x-match must be all, any, all-with-x or any-with-x (got ${JSON.stringify(e.valor)}).`,
    "clave-larga": (e) => `${e.donde === "routingKey" ? "The routing key" : `Binding ${e.binding}'s binding key`} is ${e.bytes} bytes; AMQP 0-9-1 allows 255 (the broker would close the channel).`,
    "demasiados-bindings": (e) => `Too many bindings (max ${e.maximo}).`,
    "cola-vacia": (e) => `Binding ${e.binding} has no queue name.`,
};
export function rabbitEn(r: RabbitRouteResult) {
    if (!r.ok)
        return { error: (ERROR_RABBIT[r.error.codigo] as (e: RabbitRouteError) => string)(r.error) };
    return {
        queues: r.queues,
        unroutable: r.unroutable,
        matchedBindings: r.matched,
        bindings: r.bindings.map((b) => ({ index: b.indice, queue: b.queue, matches: b.casa, why: razonEn(b.razon) })),
    };
}
const ERROR_KAFKA: {
    [K in KafkaAssignError["codigo"]]: (e: Extract<KafkaAssignError, {
        codigo: K;
    }>) => string;
} = {
    "estrategia-desconocida": (e) => `Unknown strategy "${e.valor}": use range, roundrobin, sticky or cooperative-sticky.`,
    "miembro-repetido": (e) => `Member "${e.id}" appears twice.`,
    "miembro-sin-id": () => "A member has no id.",
    "topic-repetido": (e) => `Topic "${e.nombre}" appears twice.`,
    "particiones-invalidas": (e) => `Topic "${e.topic}": partitions must be a positive integer (got ${e.valor}).`,
    "demasiado-grande": (e) => `Too big: at most ${e.maximo} partitions in total.`,
    "particion-inexistente": (e) => `Member "${e.miembro}" owns ${e.topic}-${e.partition}, which does not exist.`,
    "generacion-invalida": (e) => `Member "${e.miembro}": generation must be a non-negative integer.`,
    "sticky-suscripciones-distintas": () => "sticky and cooperative-sticky are only modelled when every member subscribes to the same topics (as Kafka's general case is not covered here).",
    "estado-imposible": () => "The owned partitions describe a state Kafka cannot reach (check owned and generation).",
};
export function kafkaAssignEn(r: KafkaAssignResult) {
    if (!r.ok)
        return { error: (ERROR_KAFKA[r.error.codigo] as (e: KafkaAssignError) => string)(r.error) };
    return {
        assignment: r.assignment,
        idleMembers: r.idle,
        memberOrder: r.orden,
        ...(r.transferring.length ? { transferring: r.transferring } : {}),
    };
}
