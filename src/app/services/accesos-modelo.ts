export interface Principal {
    id: string;
    tipo: "usuario" | "grupo" | "carga";
    subtipo?: string;
    atributos?: Record<string, string | number | boolean | null>;
}
export interface Pertenencia {
    grupoId: string;
    miembroId: string;
}
export interface Ambito {
    id: string;
    tipo: string;
    padreId?: string;
    etiquetas?: Record<string, string>;
}
export interface PeticionAcceso {
    principalId: string;
    accion: string;
    ambitoId: string;
    [extra: string]: unknown;
}
export type Efecto = "permitido" | "denegado" | "indeterminado";
export interface PasoEtapa {
    etapaId: string;
    aplica: boolean;
    efecto?: "permite" | "deniega" | "indeterminado";
    detalleKey: string;
    params?: Record<string, string | number | boolean>;
    final: boolean;
}
export interface Veredicto {
    efecto: Efecto;
    traza: PasoEtapa[];
}
export function pasoFinal(etapaId: string, efecto: "permite" | "deniega" | "indeterminado", detalleKey: string, params?: Record<string, string | number | boolean>): PasoEtapa {
    return { etapaId, aplica: true, efecto, final: true, detalleKey, params };
}
export function pasoContinua(etapaId: string, detalleKey: string, params?: Record<string, string | number | boolean>): PasoEtapa {
    return { etapaId, aplica: true, final: false, detalleKey, params };
}
export function pasoNoAplica(etapaId: string, detalleKey: string): PasoEtapa {
    return { etapaId, aplica: false, final: false, detalleKey };
}
const ESCAPE_REGEX = /[.+^${}()|[\]\\]/g;
export function coincidePatron(accion: string, patron: string): boolean {
    const cuerpo = patron
        .replace(ESCAPE_REGEX, "\\$&")
        .replace(/\*/g, ".*")
        .replace(/\?/g, ".");
    return new RegExp(`^${cuerpo}$`, "i").test(accion);
}
export function coincideAlgunPatron(accion: string, patrones: readonly string[] | undefined): boolean {
    return !!patrones?.some(p => coincidePatron(accion, p));
}
export function caminoDesdeRaiz(ambitos: ReadonlyMap<string, Ambito>, id: string): string[] {
    const camino: string[] = [];
    const visto = new Set<string>();
    let actual: string | undefined = id;
    while (actual != null) {
        if (visto.has(actual) || !ambitos.has(actual))
            return [];
        visto.add(actual);
        camino.unshift(actual);
        actual = ambitos.get(actual)!.padreId;
    }
    return camino;
}
export function esAncestroOIgual(ambitos: ReadonlyMap<string, Ambito>, ancestroId: string, id: string): boolean {
    return caminoDesdeRaiz(ambitos, id).includes(ancestroId);
}
export function principalesEfectivos(pertenencias: readonly Pertenencia[], principalId: string): Set<string> {
    const efectivos = new Set<string>([principalId]);
    const cola = [principalId];
    while (cola.length > 0) {
        const actual = cola.shift()!;
        for (const p of pertenencias) {
            if (p.miembroId === actual && !efectivos.has(p.grupoId)) {
                efectivos.add(p.grupoId);
                cola.push(p.grupoId);
            }
        }
    }
    return efectivos;
}
