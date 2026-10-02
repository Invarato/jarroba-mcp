import { Ambito, PeticionAcceso } from "./accesos-modelo";
import { Etapa, evaluar } from "./accesos-motor";
import { AsignacionAzure, CATALOGO_AZURE, MundoAzure, RolAzure, sugerirRolMinimo } from "./accesos-azure";
import { DeclaracionAws, MundoAws } from "./accesos-aws";
import { MundoGcp } from "./accesos-gcp";
import { MundoK8s } from "./accesos-k8s";
import { NodoRegla } from "./accesos-reglas";
import { riesgosDe } from "./k8s-riesgos";
export interface Hallazgo {
    severidad: "error" | "warn" | "info";
    clave: string;
    params?: Record<string, string | number>;
}
function tieneHijos(ambitos: ReadonlyMap<string, Ambito>, id: string): boolean {
    return [...ambitos.values()].some(a => a.padreId === id);
}
export function comodinesAmplios(mundo: MundoAzure, roles: readonly RolAzure[] = CATALOGO_AZURE): Hallazgo[] {
    const porId = new Map(roles.map(r => [r.id, r]));
    const hallazgos: Hallazgo[] = [];
    for (const a of mundo.asignaciones) {
        const rol = porId.get(a.rolId);
        if (!rol)
            continue;
        const tieneComodinTotal = rol.conceder.includes("*") || (rol.dataConceder ?? []).includes("*");
        if (tieneComodinTotal && tieneHijos(mundo.ambitos, a.ambitoId)) {
            hallazgos.push({ severidad: "warn", clave: "azure.hallazgo.comodinAmplio", params: { asignacion: a.id, rol: rol.nombre, ambito: a.ambitoId } });
        }
    }
    return hallazgos;
}
export function ownerEnSuscripcion(mundo: MundoAzure): Hallazgo[] {
    return mundo.asignaciones
        .filter(a => a.rolId === "owner" && mundo.ambitos.get(a.ambitoId)?.tipo === "subscription")
        .map(a => ({ severidad: "warn" as const, clave: "azure.hallazgo.ownerEnSub", params: { asignacion: a.id, ambito: a.ambitoId } }));
}
export function asignacionesHuerfanas(mundo: MundoAzure, conocidos?: ReadonlySet<string>): Hallazgo[] {
    if (!conocidos)
        return [];
    return mundo.asignaciones
        .filter(a => !conocidos.has(a.principalId))
        .map(a => ({ severidad: "error" as const, clave: "azure.hallazgo.huerfana", params: { asignacion: a.id, principal: a.principalId } }));
}
export function radioDeImpactoAzure(mundo: MundoAzure, asignacion: AsignacionAzure): string[] {
    const alcanzados = [asignacion.ambitoId];
    const cola = [asignacion.ambitoId];
    while (cola.length > 0) {
        const actual = cola.shift()!;
        for (const [id, a] of mundo.ambitos) {
            if (a.padreId === actual) {
                alcanzados.push(id);
                cola.push(id);
            }
        }
    }
    return alcanzados;
}
export { sugerirRolMinimo };
function propiedadesDeRegla(n: NodoRegla, acc: Set<string> = new Set()): Set<string> {
    switch (n.tipo) {
        case "y":
        case "o":
            n.hijos.forEach(h => propiedadesDeRegla(h, acc));
            break;
        case "no":
            propiedadesDeRegla(n.hijo, acc);
            break;
        case "comparacion":
            acc.add(n.propiedad.split(".").pop()!);
            break;
        case "coleccion":
            acc.add(n.propiedad.split(".").pop()!);
            propiedadesDeRegla(n.sub, acc);
            break;
        case "noModelado": break;
    }
    return acc;
}
export function atributosAutoEditables(regla: NodoRegla, autoEditables: ReadonlySet<string>): Hallazgo[] {
    const usados = [...propiedadesDeRegla(regla)].filter(p => autoEditables.has(p));
    return usados.map(atributo => ({ severidad: "warn" as const, clave: "regla.hallazgo.autoEditable", params: { atributo } }));
}
export function administradorSinBoundary(mundo: MundoAws): Hallazgo[] {
    const hallazgos: Hallazgo[] = [];
    for (const [principalId, declaraciones] of mundo.identidades) {
        const esAdmin = declaraciones.some((d: DeclaracionAws) => d.efecto === "permitir" && d.acciones.includes("*"));
        const tieneBoundary = (mundo.boundaries.get(principalId)?.length ?? 0) > 0;
        if (esAdmin && !tieneBoundary) {
            hallazgos.push({ severidad: "warn", clave: "aws.hallazgo.adminSinBoundary", params: { principal: principalId } });
        }
    }
    return hallazgos;
}
export function permisosPeligrososK8s(mundo: MundoK8s): Hallazgo[] {
    const grupos = new Set(mundo.pertenencias.map(p => p.grupoId));
    const identidades = new Set([...mundo.pertenencias.map(p => p.miembroId), ...mundo.bindings.map(b => b.principalId)].filter(id => !grupos.has(id)));
    const namespaces = [...mundo.ambitos.values()].filter(a => a.tipo === "namespace").map(a => a.id);
    const out: Hallazgo[] = [];
    for (const principal of identidades) {
        for (const r of riesgosDe(mundo, principal, namespaces)) {
            out.push({ severidad: r.ambito === "cluster" ? "error" : "warn", clave: "k8s.hallazgo.permisoPeligroso", params: { principal, riesgo: r.riesgo, ambito: r.ambito, binding: r.binding } });
        }
    }
    return out;
}
export interface CombinacionAcceso {
    principalId: string;
    accion: string;
    ambitoId: string;
    extra?: Record<string, unknown>;
}
export interface CambioAcceso extends CombinacionAcceso {
    antes: string;
    despues: string;
}
export interface DiffAcceso {
    ganan: CambioAcceso[];
    pierden: CambioAcceso[];
}
export function mundoSinPrincipalAzure(mundo: MundoAzure, principalId: string): MundoAzure {
    return {
        ...mundo,
        asignaciones: mundo.asignaciones.filter(a => a.principalId !== principalId),
        denegaciones: mundo.denegaciones.map(d => (d.principales === "TODOS" ? d : { ...d, principales: d.principales.filter(p => p !== principalId) })),
        pertenencias: mundo.pertenencias.filter(p => p.miembroId !== principalId),
    };
}
export function mundoSinPrincipalAws(mundo: MundoAws, principalId: string): MundoAws {
    const identidades = new Map(mundo.identidades);
    identidades.delete(principalId);
    const boundaries = new Map(mundo.boundaries);
    boundaries.delete(principalId);
    const recursos = new Map([...mundo.recursos].map(([id, decls]) => [id, decls.filter(d => d.principalId !== principalId)]));
    return { ...mundo, identidades, boundaries, recursos };
}
export function mundoSinPrincipalGcp(mundo: MundoGcp, principalId: string): MundoGcp {
    return {
        ...mundo,
        bindings: mundo.bindings.filter(b => b.principalId !== principalId),
        denyPolicies: mundo.denyPolicies.map(d => ({ ...d, principales: d.principales.filter(p => p !== principalId) })),
        pertenencias: mundo.pertenencias.filter(p => p.miembroId !== principalId),
    };
}
export function mundoSinPrincipalK8s(mundo: MundoK8s, principalId: string): MundoK8s {
    return {
        ...mundo,
        bindings: mundo.bindings.filter(b => b.principalId !== principalId),
        pertenencias: mundo.pertenencias.filter(p => p.miembroId !== principalId),
    };
}
export function diffAcceso<M>(pipeline: readonly Etapa<M>[], mundoAntes: M, mundoDespues: M, combinaciones: readonly CombinacionAcceso[]): DiffAcceso {
    const ganan: CambioAcceso[] = [];
    const pierden: CambioAcceso[] = [];
    for (const c of combinaciones) {
        const peticion: PeticionAcceso = { principalId: c.principalId, accion: c.accion, ambitoId: c.ambitoId, ...c.extra };
        const antes = evaluar(pipeline, peticion, mundoAntes).efecto;
        const despues = evaluar(pipeline, peticion, mundoDespues).efecto;
        if (antes === despues)
            continue;
        if (despues === "permitido")
            ganan.push({ ...c, antes, despues });
        else if (antes === "permitido")
            pierden.push({ ...c, antes, despues });
    }
    return { ganan, pierden };
}
