import { MundoK8s, PIPELINE_K8S } from "./accesos-k8s";
import { evaluar } from "./accesos-motor";
export type RiesgoRbac = "leer-secretos" | "crear-cargas" | "exec-pods" | "crear-volumenes" | "nodes-proxy" | "escalate" | "bind" | "impersonate" | "certificados" | "tokens" | "webhooks" | "namespaces" | "comodin";
const SONDAS: Record<RiesgoRbac, string[]> = {
    "leer-secretos": ["get:secrets", "list:secrets", "watch:secrets"],
    "crear-cargas": ["create:pods", "create:deployments", "create:daemonsets", "create:statefulsets", "create:jobs", "create:cronjobs", "create:replicasets", "create:replicationcontrollers"],
    "exec-pods": ["create:pods/exec", "create:pods/attach"],
    "crear-volumenes": ["create:persistentvolumes"],
    "nodes-proxy": ["get:nodes/proxy", "create:nodes/proxy"],
    "escalate": ["escalate:roles", "escalate:clusterroles"],
    "bind": ["bind:roles", "bind:clusterroles"],
    "impersonate": ["impersonate:users", "impersonate:groups", "impersonate:serviceaccounts"],
    "certificados": ["create:certificatesigningrequests"],
    "tokens": ["create:serviceaccounts/token"],
    "webhooks": ["create:validatingwebhookconfigurations", "update:validatingwebhookconfigurations", "patch:validatingwebhookconfigurations", "create:mutatingwebhookconfigurations", "update:mutatingwebhookconfigurations", "patch:mutatingwebhookconfigurations"],
    "namespaces": ["patch:namespaces", "update:namespaces"],
    "comodin": ["verbo-inventado:recurso-inventado"],
};
const DE_CLUSTER = new Set<RiesgoRbac>(["crear-volumenes", "nodes-proxy", "certificados", "webhooks", "namespaces"]);
export interface RiesgoConcedido {
    riesgo: RiesgoRbac;
    ambito: string;
    binding: string;
    peticion: string;
}
export function concede(mundo: MundoK8s, principal: string, accion: string, ambitoId: string): string | null {
    const v = evaluar(PIPELINE_K8S, { principalId: principal, accion, ambitoId }, mundo);
    return v.efecto === "permitido" ? String(v.traza.at(-1)?.params?.["binding"] ?? "") : null;
}
export function riesgosDe(mundo: MundoK8s, principal: string, namespaces: readonly string[]): RiesgoConcedido[] {
    const riesgos: RiesgoConcedido[] = [];
    for (const r of Object.keys(SONDAS) as RiesgoRbac[]) {
        for (const ambito of DE_CLUSTER.has(r) ? ["cluster"] : ["cluster", ...namespaces]) {
            const hit = SONDAS[r].map(p => ({ p, b: concede(mundo, principal, p, ambito) })).find(x => x.b !== null);
            if (!hit)
                continue;
            riesgos.push({ riesgo: r, ambito, binding: hit.b!, peticion: hit.p });
            if (ambito === "cluster")
                break;
        }
    }
    const comodin = riesgos.filter(x => x.riesgo === "comodin");
    return comodin.length ? comodin : riesgos;
}
