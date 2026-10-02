import { Efecto, PasoEtapa, PeticionAcceso, Veredicto, pasoFinal } from "./accesos-modelo";
export type Etapa<M> = (peticion: PeticionAcceso, mundo: M) => PasoEtapa;
const MAPA_EFECTO: Record<"permite" | "deniega" | "indeterminado", Efecto> = {
    permite: "permitido",
    deniega: "denegado",
    indeterminado: "indeterminado",
};
export function evaluar<M>(pipeline: readonly Etapa<M>[], peticion: PeticionAcceso, mundo: M): Veredicto {
    const traza: PasoEtapa[] = [];
    for (const etapa of pipeline) {
        const paso = etapa(peticion, mundo);
        traza.push(paso);
        if (paso.final) {
            return { efecto: MAPA_EFECTO[paso.efecto ?? "indeterminado"], traza };
        }
    }
    traza.push(pasoFinal("motor.pipelineIncompleto", "indeterminado", "motor.pipelineIncompleto"));
    return { efecto: "indeterminado", traza };
}
export function quienPuede<M>(pipeline: readonly Etapa<M>[], mundo: M, principales: readonly string[], accion: string, ambitoId: string, extra?: Record<string, unknown>): {
    principalId: string;
    veredicto: Veredicto;
}[] {
    return principales
        .map(principalId => ({ principalId, veredicto: evaluar(pipeline, { principalId, accion, ambitoId, ...extra }, mundo) }))
        .filter(r => r.veredicto.efecto === "permitido");
}
export function quePuede<M>(pipeline: readonly Etapa<M>[], mundo: M, principalId: string, acciones: readonly string[], ambitoId: string, extra?: Record<string, unknown>): {
    accion: string;
    veredicto: Veredicto;
}[] {
    return acciones
        .map(accion => ({ accion, veredicto: evaluar(pipeline, { principalId, accion, ambitoId, ...extra }, mundo) }))
        .filter(r => r.veredicto.efecto === "permitido");
}
