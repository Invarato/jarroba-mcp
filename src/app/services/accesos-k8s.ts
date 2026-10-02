import { Ambito, coincideAlgunPatron, esAncestroOIgual, pasoFinal, pasoNoAplica, principalesEfectivos, Pertenencia } from "./accesos-modelo";
import { Etapa } from "./accesos-motor";
export interface RolK8s {
    id: string;
    reglas: string[];
}
export interface BindingK8s {
    id: string;
    principalId: string;
    rolId: string;
    ambitoId: string;
}
export interface MundoK8s {
    ambitos: Map<string, Ambito>;
    pertenencias: Pertenencia[];
    roles: Map<string, RolK8s>;
    bindings: BindingK8s[];
}
export function crearMundoK8s(datos: {
    ambitos?: Ambito[];
    pertenencias?: Pertenencia[];
    roles?: RolK8s[];
    bindings?: BindingK8s[];
}): MundoK8s {
    return {
        ambitos: new Map((datos.ambitos ?? []).map(a => [a.id, a])),
        pertenencias: datos.pertenencias ?? [],
        roles: new Map((datos.roles ?? []).map(r => [r.id, r])),
        bindings: datos.bindings ?? [],
    };
}
export const bindingsK8s: Etapa<MundoK8s> = (peticion, mundo) => {
    const efectivos = principalesEfectivos(mundo.pertenencias, peticion.principalId);
    for (const b of mundo.bindings) {
        if (!efectivos.has(b.principalId))
            continue;
        if (!esAncestroOIgual(mundo.ambitos, b.ambitoId, peticion.ambitoId))
            continue;
        const rol = mundo.roles.get(b.rolId);
        if (!rol)
            continue;
        if (coincideAlgunPatron(peticion.accion, rol.reglas)) {
            return pasoFinal("k8s.binding", "permite", "k8s.concedidoPor", { binding: b.id, rol: b.rolId, ambito: b.ambitoId });
        }
    }
    return pasoNoAplica("k8s.binding", "k8s.sinBinding");
};
export const implicitoK8s: Etapa<MundoK8s> = () => pasoFinal("k8s.implicito", "deniega", "k8s.implicito");
export const PIPELINE_K8S: readonly Etapa<MundoK8s>[] = [bindingsK8s, implicitoK8s];
