import { Ambito, coincideAlgunPatron, esAncestroOIgual, pasoFinal, pasoNoAplica, principalesEfectivos, Pertenencia } from "./accesos-modelo";
import { Etapa } from "./accesos-motor";
export interface RolGcp {
    id: string;
    permisos: string[];
}
export interface BindingGcp {
    id: string;
    principalId: string;
    rolId: string;
    ambitoId: string;
}
export interface DenyPolicyGcp {
    id: string;
    principales: string[];
    excludePrincipales?: string[];
    permisosDenegados: string[];
    ambitoId: string;
}
export interface MundoGcp {
    ambitos: Map<string, Ambito>;
    pertenencias: Pertenencia[];
    roles: Map<string, RolGcp>;
    bindings: BindingGcp[];
    denyPolicies: DenyPolicyGcp[];
}
export function crearMundoGcp(datos: {
    ambitos?: Ambito[];
    pertenencias?: Pertenencia[];
    roles?: RolGcp[];
    bindings?: BindingGcp[];
    denyPolicies?: DenyPolicyGcp[];
}): MundoGcp {
    return {
        ambitos: new Map((datos.ambitos ?? []).map(a => [a.id, a])),
        pertenencias: datos.pertenencias ?? [],
        roles: new Map((datos.roles ?? []).map(r => [r.id, r])),
        bindings: datos.bindings ?? [],
        denyPolicies: datos.denyPolicies ?? [],
    };
}
export const denegacionGcp: Etapa<MundoGcp> = (peticion, mundo) => {
    const efectivos = principalesEfectivos(mundo.pertenencias, peticion.principalId);
    for (const d of mundo.denyPolicies) {
        if (!d.principales.some(p => efectivos.has(p)))
            continue;
        if ((d.excludePrincipales ?? []).includes(peticion.principalId))
            continue;
        if (!esAncestroOIgual(mundo.ambitos, d.ambitoId, peticion.ambitoId))
            continue;
        if (!coincideAlgunPatron(peticion.accion, d.permisosDenegados))
            continue;
        return pasoFinal("gcp.denegacion", "deniega", "gcp.denegadoPor", { politica: d.id, ambito: d.ambitoId });
    }
    return pasoNoAplica("gcp.denegacion", "gcp.sinDenegacion");
};
export const bindingsGcp: Etapa<MundoGcp> = (peticion, mundo) => {
    const efectivos = principalesEfectivos(mundo.pertenencias, peticion.principalId);
    for (const b of mundo.bindings) {
        if (!efectivos.has(b.principalId))
            continue;
        if (!esAncestroOIgual(mundo.ambitos, b.ambitoId, peticion.ambitoId))
            continue;
        const rol = mundo.roles.get(b.rolId);
        if (!rol)
            continue;
        if (coincideAlgunPatron(peticion.accion, rol.permisos)) {
            return pasoFinal("gcp.binding", "permite", "gcp.concedidoPor", { binding: b.id, rol: b.rolId, ambito: b.ambitoId });
        }
    }
    return pasoNoAplica("gcp.binding", "gcp.sinBinding");
};
export const implicitoGcp: Etapa<MundoGcp> = () => pasoFinal("gcp.implicito", "deniega", "gcp.implicito");
export const PIPELINE_GCP: readonly Etapa<MundoGcp>[] = [denegacionGcp, bindingsGcp, implicitoGcp];
