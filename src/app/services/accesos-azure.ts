import { Etapa } from "./accesos-motor";
import { Ambito, Pertenencia, PeticionAcceso, coincideAlgunPatron, esAncestroOIgual, pasoFinal, pasoNoAplica, principalesEfectivos, } from "./accesos-modelo";
export type PlanoAzure = "control" | "datos";
export interface PeticionAzure extends PeticionAcceso {
    plano: PlanoAzure;
}
export interface RolAzure {
    id: string;
    nombre: string;
    conceder: string[];
    excluir?: string[];
    dataConceder?: string[];
    dataExcluir?: string[];
    revisadoEn?: string;
}
export interface AsignacionAzure {
    id: string;
    principalId: string;
    rolId: string;
    ambitoId: string;
    condicion?: string;
}
export interface DenegacionAzure {
    id: string;
    principales: string[] | "TODOS";
    excludePrincipales?: string[];
    ambitoId: string;
    doNotApplyToChildScopes?: boolean;
    acciones: string[];
    accionesExcluidas?: string[];
    dataAcciones?: string[];
    dataAccionesExcluidas?: string[];
    condicion?: string;
}
export interface MundoAzure {
    ambitos: Map<string, Ambito>;
    pertenencias: Pertenencia[];
    roles: Map<string, RolAzure>;
    asignaciones: AsignacionAzure[];
    denegaciones: DenegacionAzure[];
}
export function crearMundoAzure(datos: {
    ambitos?: Ambito[];
    pertenencias?: Pertenencia[];
    roles?: RolAzure[];
    asignaciones?: AsignacionAzure[];
    denegaciones?: DenegacionAzure[];
}): MundoAzure {
    return {
        ambitos: new Map((datos.ambitos ?? []).map(a => [a.id, a])),
        pertenencias: datos.pertenencias ?? [],
        roles: new Map((datos.roles ?? CATALOGO_AZURE).map(r => [r.id, r])),
        asignaciones: datos.asignaciones ?? [],
        denegaciones: datos.denegaciones ?? [],
    };
}
function conceder(rol: RolAzure, plano: PlanoAzure): string[] {
    return plano === "control" ? rol.conceder : (rol.dataConceder ?? []);
}
function excluir(rol: RolAzure, plano: PlanoAzure): string[] | undefined {
    return plano === "control" ? rol.excluir : rol.dataExcluir;
}
function accionesDeny(d: DenegacionAzure, plano: PlanoAzure): string[] {
    return plano === "control" ? d.acciones : (d.dataAcciones ?? []);
}
function accionesDenyExcluidas(d: DenegacionAzure, plano: PlanoAzure): string[] | undefined {
    return plano === "control" ? d.accionesExcluidas : d.dataAccionesExcluidas;
}
export const denegacionAzure: Etapa<MundoAzure> = (peticion, mundo) => {
    const p = peticion as PeticionAzure;
    const efectivos = principalesEfectivos(mundo.pertenencias, p.principalId);
    for (const d of mundo.denegaciones) {
        const alcanzaPrincipal = d.principales === "TODOS" || d.principales.some(id => efectivos.has(id));
        if (!alcanzaPrincipal || (d.excludePrincipales ?? []).includes(p.principalId))
            continue;
        const alcanzaAmbito = p.ambitoId === d.ambitoId
            || (!d.doNotApplyToChildScopes && esAncestroOIgual(mundo.ambitos, d.ambitoId, p.ambitoId));
        if (!alcanzaAmbito)
            continue;
        const casa = coincideAlgunPatron(p.accion, accionesDeny(d, p.plano))
            && !coincideAlgunPatron(p.accion, accionesDenyExcluidas(d, p.plano));
        if (!casa)
            continue;
        if (d.condicion) {
            return pasoFinal("azure.denegacion", "indeterminado", "azure.condicionDesconocida", { asignacion: d.id, condicion: d.condicion });
        }
        return pasoFinal("azure.denegacion", "deniega", "azure.denegadoPor", { asignacion: d.id, ambito: d.ambitoId });
    }
    return pasoNoAplica("azure.denegacion", "azure.sinDenegacion");
};
export const asignacionesAzure: Etapa<MundoAzure> = (peticion, mundo) => {
    const p = peticion as PeticionAzure;
    const efectivos = principalesEfectivos(mundo.pertenencias, p.principalId);
    let indeterminada: AsignacionAzure | null = null;
    for (const a of mundo.asignaciones) {
        if (!efectivos.has(a.principalId))
            continue;
        if (!esAncestroOIgual(mundo.ambitos, a.ambitoId, p.ambitoId))
            continue;
        const rol = mundo.roles.get(a.rolId);
        if (!rol)
            continue;
        const casa = coincideAlgunPatron(p.accion, conceder(rol, p.plano)) && !coincideAlgunPatron(p.accion, excluir(rol, p.plano));
        if (!casa)
            continue;
        if (a.condicion) {
            indeterminada = indeterminada ?? a;
            continue;
        }
        return pasoFinal("azure.asignaciones", "permite", "azure.concedidoPor", { asignacion: a.id, rol: rol.nombre, ambito: a.ambitoId });
    }
    if (indeterminada) {
        return pasoFinal("azure.asignaciones", "indeterminado", "azure.condicionDesconocida", { asignacion: indeterminada.id, condicion: indeterminada.condicion! });
    }
    return pasoNoAplica("azure.asignaciones", "azure.sinAsignacion");
};
export const implicitoAzure: Etapa<MundoAzure> = () => pasoFinal("azure.implicito", "deniega", "azure.implicito");
export const PIPELINE_AZURE: readonly Etapa<MundoAzure>[] = [denegacionAzure, asignacionesAzure, implicitoAzure];
export const CATALOGO_AZURE: RolAzure[] = [
    {
        id: "owner",
        nombre: "Owner",
        revisadoEn: "2026-09",
        conceder: ["*"],
        excluir: [],
        dataConceder: [],
        dataExcluir: [],
    },
    {
        id: "contributor",
        nombre: "Contributor",
        revisadoEn: "2026-09",
        conceder: ["*"],
        excluir: [
            "Microsoft.Authorization/*/Delete",
            "Microsoft.Authorization/*/Write",
            "Microsoft.Authorization/elevateAccess/Action",
            "Microsoft.Blueprint/blueprintAssignments/write",
            "Microsoft.Blueprint/blueprintAssignments/delete",
            "Microsoft.Compute/galleries/share/action",
            "Microsoft.Purview/consents/write",
            "Microsoft.Purview/consents/delete",
        ],
        dataConceder: [],
        dataExcluir: [],
    },
    {
        id: "reader",
        nombre: "Reader",
        revisadoEn: "2026-09",
        conceder: ["*/read"],
        excluir: [],
        dataConceder: [],
        dataExcluir: [],
    },
    {
        id: "storage-blob-data-reader",
        nombre: "Storage Blob Data Reader",
        revisadoEn: "2026-09",
        conceder: ["Microsoft.Storage/storageAccounts/blobServices/containers/read", "Microsoft.Storage/storageAccounts/blobServices/generateUserDelegationKey/action"],
        dataConceder: ["Microsoft.Storage/storageAccounts/blobServices/containers/blobs/read"],
    },
    {
        id: "storage-blob-data-contributor",
        nombre: "Storage Blob Data Contributor",
        revisadoEn: "2026-09",
        conceder: ["Microsoft.Storage/storageAccounts/blobServices/containers/*"],
        dataConceder: ["Microsoft.Storage/storageAccounts/blobServices/containers/blobs/*"],
    },
];
function amplitud(rol: RolAzure): number {
    const patrones = [...conceder(rol, "control"), ...(rol.dataConceder ?? [])];
    return patrones.reduce((total, p) => total + (p.includes("*") || p.includes("?") ? 1000 : 1), 0);
}
export function sugerirRolMinimo(roles: readonly RolAzure[], accion: string, plano: PlanoAzure): RolAzure | null {
    const candidatos = roles.filter(r => coincideAlgunPatron(accion, conceder(r, plano)) && !coincideAlgunPatron(accion, excluir(r, plano)));
    if (candidatos.length === 0)
        return null;
    return candidatos.reduce((min, r) => (amplitud(r) < amplitud(min) ? r : min));
}
