import * as jsYaml from "js-yaml";
import { DeclaracionAws, DeclaracionRecursoAws } from "./accesos-aws";
import { BindingK8s, RolK8s } from "./accesos-k8s";
export interface ResultadoImportacion<T> {
    datos: T;
    noEntendido: string[];
}
interface SentenciaAwsCruda {
    Sid?: string;
    Effect?: string;
    Action?: string | string[];
    NotAction?: string | string[];
    Resource?: string | string[];
    Principal?: unknown;
    Condition?: unknown;
}
function listaStatements(doc: unknown): SentenciaAwsCruda[] {
    const s = (doc as {
        Statement?: unknown;
    } | null)?.Statement;
    if (Array.isArray(s))
        return s as SentenciaAwsCruda[];
    if (s && typeof s === "object")
        return [s as SentenciaAwsCruda];
    return [];
}
function analizarPrincipal(principal: unknown): {
    principalId: string;
    via: "usuario" | "rol" | "sesionDeRol";
} | null {
    let arn: unknown = principal;
    if (principal && typeof principal === "object" && "AWS" in (principal as Record<string, unknown>)) {
        arn = (principal as Record<string, unknown>)["AWS"];
    }
    if (Array.isArray(arn))
        arn = arn[0];
    if (typeof arn !== "string")
        return null;
    if (arn === "*")
        return { principalId: "*", via: "usuario" };
    const sesion = arn.match(/:assumed-role\/([^/]+)\/([^/]+)$/);
    if (sesion)
        return { principalId: sesion[1], via: "sesionDeRol" };
    const usuario = arn.match(/:user\/([^/]+)$/);
    if (usuario)
        return { principalId: usuario[1], via: "usuario" };
    const rol = arn.match(/:role\/([^/]+)$/);
    if (rol)
        return { principalId: rol[1], via: "rol" };
    return null;
}
function accionesDe(s: SentenciaAwsCruda): string[] | null {
    if (s.Action == null)
        return null;
    return Array.isArray(s.Action) ? s.Action : [s.Action];
}
export function importarPoliticaIdentidadAws(json: string): ResultadoImportacion<DeclaracionAws[]> {
    const noEntendido: string[] = [];
    let doc: unknown;
    try {
        doc = JSON.parse(json);
    }
    catch {
        return { datos: [], noEntendido: ["El texto no es JSON v\u00E1lido."] };
    }
    const datos: DeclaracionAws[] = [];
    listaStatements(doc).forEach((s, i) => {
        const etiqueta = s.Sid ? `Statement "${s.Sid}"` : `Statement[${i}]`;
        if (s.Effect !== "Allow" && s.Effect !== "Deny") {
            noEntendido.push(`${etiqueta}: Effect desconocido "${String(s.Effect)}".`);
            return;
        }
        if (s.NotAction != null) {
            noEntendido.push(`${etiqueta}: usa NotAction, que este importador no modela (a diferencia de Azure, AWS no tiene una resta local por sentencia).`);
            return;
        }
        if (s.Principal != null) {
            noEntendido.push(`${etiqueta}: trae "Principal" — parece una política de RECURSO, no de identidad. Usa importarPoliticaRecursoAws.`);
            return;
        }
        const acciones = accionesDe(s);
        if (!acciones) {
            noEntendido.push(`${etiqueta}: sin "Action".`);
            return;
        }
        const d: DeclaracionAws = { efecto: s.Effect === "Allow" ? "permitir" : "denegar", acciones };
        if (s.Condition != null)
            d.condicion = JSON.stringify(s.Condition);
        datos.push(d);
    });
    if (listaStatements(doc).length === 0 && doc != null)
        noEntendido.push("No se encontr\u00F3 ning\u00FAn \"Statement\" en el JSON.");
    return { datos, noEntendido };
}
export function importarPoliticaRecursoAws(json: string): ResultadoImportacion<DeclaracionRecursoAws[]> {
    const noEntendido: string[] = [];
    let doc: unknown;
    try {
        doc = JSON.parse(json);
    }
    catch {
        return { datos: [], noEntendido: ["El texto no es JSON v\u00E1lido."] };
    }
    const datos: DeclaracionRecursoAws[] = [];
    listaStatements(doc).forEach((s, i) => {
        const etiqueta = s.Sid ? `Statement "${s.Sid}"` : `Statement[${i}]`;
        if (s.Effect !== "Allow" && s.Effect !== "Deny") {
            noEntendido.push(`${etiqueta}: Effect desconocido "${String(s.Effect)}".`);
            return;
        }
        if (s.NotAction != null) {
            noEntendido.push(`${etiqueta}: usa NotAction, no modelado.`);
            return;
        }
        const acciones = accionesDe(s);
        if (!acciones) {
            noEntendido.push(`${etiqueta}: sin "Action".`);
            return;
        }
        const principal = analizarPrincipal(s.Principal);
        if (!principal) {
            noEntendido.push(`${etiqueta}: sin "Principal" reconocible (¿es una política de identidad? usa importarPoliticaIdentidadAws).`);
            return;
        }
        if (principal.principalId === "*") {
            noEntendido.push(`${etiqueta}: Principal "*" (acceso público) — este laboratorio no modela el acceso anónimo.`);
            return;
        }
        const d: DeclaracionRecursoAws = { efecto: s.Effect === "Allow" ? "permitir" : "denegar", acciones, principalId: principal.principalId, via: principal.via };
        if (s.Condition != null)
            d.condicion = JSON.stringify(s.Condition);
        datos.push(d);
    });
    return { datos, noEntendido };
}
interface ReglaK8sCruda {
    apiGroups?: unknown;
    resources?: unknown;
    verbs?: unknown;
}
interface DocK8sCrudo {
    apiVersion?: unknown;
    kind?: unknown;
    metadata?: {
        name?: unknown;
        namespace?: unknown;
    };
    rules?: ReglaK8sCruda[];
    subjects?: {
        kind?: unknown;
        name?: unknown;
        namespace?: unknown;
    }[];
    roleRef?: {
        kind?: unknown;
        name?: unknown;
    };
}
function comboReglas(regla: ReglaK8sCruda): string[] {
    const verbos = Array.isArray(regla.verbs) ? regla.verbs.filter((v): v is string => typeof v === "string") : [];
    const recursos = Array.isArray(regla.resources) ? regla.resources.filter((r): r is string => typeof r === "string") : [];
    const combos: string[] = [];
    for (const v of verbos)
        for (const r of recursos)
            combos.push(`${v}:${r}`);
    return combos;
}
export function principalK8s(kind: unknown, nombre: string, namespace: string | null): string {
    return kind === "ServiceAccount" && namespace ? `system:serviceaccount:${namespace}:${nombre}` : nombre;
}
export const idRolK8s = (kind: unknown, nombre: string, namespace: string | null) => kind === "Role" && namespace ? `${namespace}/${nombre}` : nombre;
export function importarK8sRbacYaml(yaml: string): ResultadoImportacion<{
    roles: RolK8s[];
    bindings: BindingK8s[];
}> {
    const noEntendido: string[] = [];
    const docs: DocK8sCrudo[] = [];
    try {
        jsYaml.loadAll(yaml, d => { if (d && typeof d === "object")
            docs.push(d as DocK8sCrudo); });
    }
    catch (e) {
        return { datos: { roles: [], bindings: [] }, noEntendido: [`YAML inválido: ${e instanceof Error ? e.message : String(e)}`] };
    }
    const roles: RolK8s[] = [];
    const bindings: BindingK8s[] = [];
    let contadorBinding = 0;
    for (const [i, doc] of docs.entries()) {
        const kind = typeof doc.kind === "string" ? doc.kind : "";
        const nombre = typeof doc.metadata?.name === "string" ? doc.metadata.name : `doc${i}`;
        if (kind === "Role" || kind === "ClusterRole") {
            const reglas = (doc.rules ?? []).flatMap(comboReglas);
            if (reglas.length === 0)
                noEntendido.push(`${kind} "${nombre}": sin reglas reconocibles (¿faltan "verbs"/"resources"?).`);
            const ns = typeof doc.metadata?.namespace === "string" ? doc.metadata.namespace : null;
            roles.push({ id: idRolK8s(kind, nombre, kind === "Role" ? ns ?? "default" : null), reglas });
        }
        else if (kind === "RoleBinding" || kind === "ClusterRoleBinding") {
            const ambitoId = kind === "RoleBinding"
                ? (typeof doc.metadata?.namespace === "string" ? doc.metadata.namespace : null)
                : "cluster";
            if (!ambitoId) {
                noEntendido.push(`RoleBinding "${nombre}": sin "metadata.namespace".`);
                continue;
            }
            const nombreRol = typeof doc.roleRef?.name === "string" ? doc.roleRef.name : null;
            if (!nombreRol) {
                noEntendido.push(`${kind} "${nombre}": sin "roleRef.name".`);
                continue;
            }
            const rolId = idRolK8s(kind === "RoleBinding" ? doc.roleRef?.kind : "ClusterRole", nombreRol, kind === "RoleBinding" ? ambitoId : null);
            for (const sujeto of doc.subjects ?? []) {
                if (typeof sujeto.name !== "string") {
                    noEntendido.push(`${kind} "${nombre}": un subject sin "name".`);
                    continue;
                }
                const nsSujeto = typeof sujeto.namespace === "string" ? sujeto.namespace : kind === "RoleBinding" ? ambitoId : null;
                if (sujeto.kind === "ServiceAccount" && !nsSujeto) {
                    noEntendido.push(`${kind} "${nombre}": la ServiceAccount "${sujeto.name}" no dice su namespace.`);
                    continue;
                }
                bindings.push({ id: `${nombre}-${contadorBinding++}`, principalId: principalK8s(sujeto.kind, sujeto.name, nsSujeto), rolId, ambitoId });
            }
        }
        else if (kind) {
            noEntendido.push(`Documento ${i} (kind "${kind}"): no es Role/ClusterRole/RoleBinding/ClusterRoleBinding, se ignora.`);
        }
    }
    const rolesConocidos = new Set(roles.map(r => r.id));
    for (const b of bindings) {
        if (!rolesConocidos.has(b.rolId))
            noEntendido.push(`El binding "${b.id}" referencia el rol "${b.rolId}", que no está entre los documentos pegados.`);
    }
    return { datos: { roles, bindings }, noEntendido };
}
