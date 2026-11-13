import type { Operator } from "./anonymize";
import type { EntityCategory } from "./detectors";
export interface ReglaContable {
    id: string;
    category: EntityCategory;
}
export function etiquetaOperador(op: Operator): string {
    switch (op) {
        case "replace": return $localize `:@@anon.op.replace:Reemplazar`;
        case "redact": return $localize `:@@anon.op.redact:Redactar`;
        case "mask": return $localize `:@@anon.op.mask:Enmascarar`;
        case "token": return $localize `:@@anon.op.token:Token reversible`;
        default: return $localize `:@@anon.op.hash:Hash`;
    }
}
export function activos(reglas: readonly ReglaContable[], encendidos: ReadonlySet<string>, cat?: EntityCategory): number {
    const ids = new Set(reglas.filter(r => !cat || r.category === cat).map(r => r.id));
    let n = 0;
    for (const id of ids)
        if (encendidos.has(id))
            n++;
    return n;
}
export function recuentoGrupo(reglas: readonly ReglaContable[], encendidos: ReadonlySet<string>, cat: EntityCategory): string {
    const total = new Set(reglas.filter(r => r.category === cat).map(r => r.id)).size;
    return `${activos(reglas, encendidos, cat)}/${total}`;
}
export function resumenDetectores(o: {
    activo: boolean;
    reglas: readonly ReglaContable[];
    encendidos: ReadonlySet<string>;
    grupos: readonly EntityCategory[];
    operadorDe: Readonly<Record<string, Operator>>;
}): string {
    if (!o.activo)
        return resumenApagado();
    const usados = new Set(o.grupos.filter(c => activos(o.reglas, o.encendidos, c) > 0).map(c => o.operadorDe[c]));
    const op = usados.size === 1 ? etiquetaOperador([...usados][0]) : $localize `:@@redact.res.varios:varios operadores`;
    const n = activos(o.reglas, o.encendidos);
    return $localize `:@@redact.res.on:Activo · ${n}:n: detectores · ${op}:op:`;
}
export function resumenApagado(): string { return $localize `:@@redact.res.off:Apagado`; }
export function resumenEncendido(): string { return $localize `:@@redact.res.activo:Activo`; }
