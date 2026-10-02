import * as jsYaml from "js-yaml";
import { Modelo, Carga, HallazgoK8s } from "./k8s-network";
import { importarK8sRbacYaml, principalK8s } from "./accesos-import";
import { crearMundoK8s, MundoK8s } from "./accesos-k8s";
import { RiesgoConcedido, concede, riesgosDe } from "./k8s-riesgos";
import { Pertenencia } from "./accesos-modelo";
export type { RiesgoRbac, RiesgoConcedido } from "./k8s-riesgos";
export interface IdentidadCarga {
    carga: string;
    serviceAccount: string;
    principal: string;
    tokenMontado: boolean;
    riesgos: RiesgoConcedido[];
    algunPermiso: boolean;
}
export interface AnalisisRbac {
    hayRbac: boolean;
    identidades: IdentidadCarga[];
}
function automountDeServiceAccounts(texto: string): Map<string, boolean> {
    const out = new Map<string, boolean>();
    for (const trozo of texto.split(/^---[ \t]*$/m)) {
        let docs: unknown[] = [];
        try {
            docs = jsYaml.loadAll(trozo);
        }
        catch {
            continue;
        }
        for (const d of docs) {
            const o = d as Record<string, any> | null;
            if (o?.["kind"] === "ServiceAccount" && typeof o["automountServiceAccountToken"] === "boolean") {
                out.set(`${o["metadata"]?.["namespace"] ?? "default"}/${o["metadata"]?.["name"]}`, o["automountServiceAccountToken"]);
            }
        }
    }
    return out;
}
const saDe = (c: Carga) => String(c.spec?.["serviceAccountName"] ?? c.spec?.["serviceAccount"] ?? "default");
export function analizarRbac(texto: string, m: Modelo): AnalisisRbac {
    const rbac = importarK8sRbacYaml(texto).datos;
    const hayRbac = rbac.roles.length > 0 || rbac.bindings.length > 0;
    const automount = automountDeServiceAccounts(texto);
    const namespaces = new Set<string>([...m.namespaces.keys(), ...rbac.bindings.map(b => b.ambitoId).filter(a => a !== "cluster")]);
    const pertenencias: Pertenencia[] = [];
    for (const c of m.cargas) {
        const p = principalK8s("ServiceAccount", saDe(c), c.ns);
        pertenencias.push({ grupoId: "system:serviceaccounts", miembroId: p }, { grupoId: `system:serviceaccounts:${c.ns}`, miembroId: p }, { grupoId: "system:authenticated", miembroId: p });
    }
    const mundo: MundoK8s = crearMundoK8s({
        ambitos: [{ id: "cluster", tipo: "cluster" }, ...[...namespaces].map(n => ({ id: n, tipo: "namespace", padreId: "cluster" }))],
        pertenencias,
        roles: rbac.roles,
        bindings: rbac.bindings,
    });
    const identidades = m.cargas.map((c): IdentidadCarga => {
        const sa = saDe(c);
        const principal = principalK8s("ServiceAccount", sa, c.ns);
        const delPod = c.spec?.["automountServiceAccountToken"];
        const tokenMontado = typeof delPod === "boolean" ? delPod : automount.get(`${c.ns}/${sa}`) ?? true;
        const riesgos = riesgosDe(mundo, principal, [c.ns]);
        const algunPermiso = riesgos.length > 0 || ["get:pods", "list:pods", "get:configmaps", "list:services"].some(p => concede(mundo, principal, p, c.ns) !== null);
        return { carga: c.id, serviceAccount: sa, principal, tokenMontado, riesgos, algunPermiso };
    });
    return { hayRbac, identidades };
}
export function hallazgosRbac(a: AnalisisRbac, cargas: Carga[]): HallazgoK8s[] {
    if (!a.hayRbac)
        return [];
    const tipo = new Map(cargas.map(c => [c.id, c.tipo]));
    const out: HallazgoK8s[] = [];
    for (const i of a.identidades) {
        const fragmento = `${tipo.get(i.carga) ?? "Pod"} ${i.carga}`;
        if (i.riesgos.length) {
            out.push({ regla: "sa-peligrosa", gravedad: i.tokenMontado ? "alto" : "info", fragmento, datos: { sa: i.serviceAccount, riesgos: i.riesgos.map(r => r.riesgo).join(", "), montado: String(i.tokenMontado) } });
        }
        else if (i.tokenMontado && !i.algunPermiso) {
            out.push({ regla: "sa-token-innecesario", gravedad: "info", fragmento, datos: { sa: i.serviceAccount } });
        }
    }
    return out;
}
