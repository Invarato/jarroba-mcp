import * as jsYaml from "js-yaml";
type Esq = Record<string, any>;
export interface EsquemaVersion {
    version: string;
    raiz: Record<string, string>;
    defs: Record<string, Esq>;
}
export type TipoError = "campo-desconocido" | "tipo" | "requerido" | "api-retirada" | "sin-esquema" | "sin-kind";
export interface ErrorEsquema {
    objeto: string;
    tipo: TipoError;
    ruta?: string;
    esperado?: string;
    sugerencia?: string;
    retirada?: {
        en: string;
        usar: string;
    };
}
export const RETIRADAS: {
    api: string;
    kinds: string[];
    en: string;
    usar: string;
}[] = [
    { api: "extensions/v1beta1", kinds: ["Deployment", "DaemonSet", "ReplicaSet"], en: "1.16", usar: "apps/v1" },
    { api: "apps/v1beta1", kinds: ["Deployment", "StatefulSet", "ReplicaSet"], en: "1.16", usar: "apps/v1" },
    { api: "apps/v1beta2", kinds: ["Deployment", "StatefulSet", "DaemonSet", "ReplicaSet"], en: "1.16", usar: "apps/v1" },
    { api: "extensions/v1beta1", kinds: ["NetworkPolicy"], en: "1.16", usar: "networking.k8s.io/v1" },
    { api: "extensions/v1beta1", kinds: ["PodSecurityPolicy"], en: "1.16", usar: "policy/v1beta1" },
    { api: "extensions/v1beta1", kinds: ["Ingress"], en: "1.22", usar: "networking.k8s.io/v1" },
    { api: "networking.k8s.io/v1beta1", kinds: ["Ingress", "IngressClass"], en: "1.22", usar: "networking.k8s.io/v1" },
    { api: "rbac.authorization.k8s.io/v1beta1", kinds: ["ClusterRole", "ClusterRoleBinding", "Role", "RoleBinding"], en: "1.22", usar: "rbac.authorization.k8s.io/v1" },
    { api: "batch/v1beta1", kinds: ["CronJob"], en: "1.25", usar: "batch/v1" },
    { api: "policy/v1beta1", kinds: ["PodDisruptionBudget"], en: "1.25", usar: "policy/v1" },
    { api: "policy/v1beta1", kinds: ["PodSecurityPolicy"], en: "1.25", usar: "Pod Security Admission" },
    { api: "autoscaling/v2beta1", kinds: ["HorizontalPodAutoscaler"], en: "1.25", usar: "autoscaling/v2" },
    { api: "autoscaling/v2beta2", kinds: ["HorizontalPodAutoscaler"], en: "1.26", usar: "autoscaling/v2" },
];
const MAX_POR_OBJETO = 25;
function distancia(a: string, b: string): number {
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
    for (let j = 1; j <= b.length; j++)
        d[0][j] = j;
    for (let i = 1; i <= a.length; i++)
        for (let j = 1; j <= b.length; j++) {
            d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        }
    return d[a.length][b.length];
}
function parecido(campo: string, conocidos: string[]): string | undefined {
    let mejor: string | undefined, dm = Infinity;
    for (const k of conocidos) {
        const dd = k.toLowerCase() === campo.toLowerCase() ? 0 : distancia(campo, k);
        if (dd < dm) {
            dm = dd;
            mejor = k;
        }
    }
    return mejor !== undefined && dm <= 2 && dm < Math.max(2, campo.length / 2) ? mejor : undefined;
}
const tipoDe = (v: unknown): string => v === null ? "null" : Array.isArray(v) ? "array" : typeof v === "number" ? (Number.isInteger(v) ? "integer" : "number") : typeof v;
class Validador {
    errores: ErrorEsquema[] = [];
    constructor(private esq: EsquemaVersion, private objeto: string) { }
    private resolver(s: Esq | undefined): Esq | undefined {
        let x = s, vueltas = 0;
        while (x && vueltas++ < 10) {
            if (x["$ref"])
                x = this.esq.defs[String(x["$ref"]).split("/").pop()!];
            else if (Array.isArray(x["allOf"]) && x["allOf"].length === 1 && !x["properties"] && !x["type"])
                x = x["allOf"][0];
            else
                break;
        }
        return x;
    }
    private error(e: Omit<ErrorEsquema, "objeto">): void {
        if (this.errores.length < MAX_POR_OBJETO)
            this.errores.push({ objeto: this.objeto, ...e });
    }
    private casaTipo(tipo: string, v: unknown): boolean {
        const t = tipoDe(v);
        return t === tipo || (tipo === "number" && t === "integer");
    }
    validar(v: unknown, s: Esq | undefined, ruta: string): void {
        s = this.resolver(s);
        if (!s || v === null || v === undefined)
            return;
        if (Array.isArray(s["oneOf"])) {
            const tipos = s["oneOf"].map((o: Esq) => this.resolver(o)?.["type"]).filter(Boolean) as string[];
            if (tipos.length && !tipos.some(t => this.casaTipo(t, v)))
                this.error({ tipo: "tipo", ruta, esperado: tipos.join(" | ") });
            return;
        }
        const tipo = s["type"] as string | undefined;
        if (tipo && !this.casaTipo(tipo, v)) {
            this.error({ tipo: "tipo", ruta, esperado: tipo });
            return;
        }
        if (tipo === "array" || Array.isArray(v)) {
            if (Array.isArray(v))
                v.forEach((x, i) => this.validar(x, s!["items"], `${ruta}[${i}]`));
            return;
        }
        if (tipo !== "object" || typeof v !== "object")
            return;
        const o = v as Record<string, unknown>;
        const props = s["properties"] as Record<string, Esq> | undefined;
        for (const r of (s["required"] as string[] | undefined) ?? []) {
            if (o[r] === undefined || o[r] === null)
                this.error({ tipo: "requerido", ruta: ruta ? `${ruta}.${r}` : r });
        }
        for (const [k, x] of Object.entries(o)) {
            const hijo = ruta ? `${ruta}.${k}` : k;
            if (props && k in props)
                this.validar(x, props[k], hijo);
            else if (s["additionalProperties"] && typeof s["additionalProperties"] === "object")
                this.validar(x, s["additionalProperties"], hijo);
            else if (props && Object.keys(props).length)
                this.error({ tipo: "campo-desconocido", ruta: hijo, sugerencia: parecido(k, Object.keys(props)) });
        }
    }
}
function documentos(texto: string): Record<string, any>[] {
    const out: Record<string, any>[] = [];
    for (const trozo of texto.split(/^---[ \t]*$/m)) {
        if (!trozo.trim())
            continue;
        let docs: unknown[] = [];
        try {
            docs = jsYaml.loadAll(trozo);
        }
        catch {
            continue;
        }
        const pend = [...docs];
        while (pend.length) {
            const d = pend.shift();
            if (!d || typeof d !== "object" || Array.isArray(d))
                continue;
            const o = d as Record<string, any>;
            const kind = String(o["kind"] ?? "");
            if (kind.endsWith("List") && Array.isArray(o["items"])) {
                const deLista = kind === "List" ? "" : kind.slice(0, -4);
                pend.push(...o["items"].map((i: any) => ({ kind: deLista || undefined, apiVersion: o["apiVersion"], ...i })));
            }
            else
                out.push(o);
        }
    }
    return out;
}
export function validarManifiestos(texto: string, esq: EsquemaVersion): ErrorEsquema[] {
    const errores: ErrorEsquema[] = [];
    for (const d of documentos(texto)) {
        const kind = String(d["kind"] ?? ""), api = String(d["apiVersion"] ?? "");
        const nombre = `${d["metadata"]?.["namespace"] ? d["metadata"]["namespace"] + "/" : ""}${d["metadata"]?.["name"] ?? "?"}`;
        const objeto = `${kind || "?"} ${nombre}`;
        if (!kind || !api) {
            errores.push({ objeto, tipo: "sin-kind" });
            continue;
        }
        const def = esq.raiz[`${api}/${kind}`];
        if (!def) {
            const r = RETIRADAS.find(x => x.api === api && x.kinds.includes(kind));
            errores.push(r ? { objeto, tipo: "api-retirada", retirada: { en: r.en, usar: r.usar } } : { objeto, tipo: "sin-esquema" });
            continue;
        }
        const v = new Validador(esq, objeto);
        v.validar(d, esq.defs[def], "");
        errores.push(...v.errores);
    }
    return errores;
}
