import { Injectable, inject } from "@angular/core";
import { PgEngineService } from "./pg-engine.service";
import { ComprobacionConsulta, ColumnaResultado, Run, comprobarConsulta } from "./query-check";
export type Veredicto = "rompe" | "cambia" | "amplia" | "arregla" | "fallaba" | "igual";
export interface Cambio {
    tipo: "quitada" | "nueva" | "tipo";
    columna: string;
    antes?: string;
    despues?: string;
}
export interface ConsultaComparada {
    nombre: string;
    sql: string;
    veredicto: Veredicto;
    error?: string;
    cambios: Cambio[];
}
export interface ImpactoCambio {
    errorAntes?: string;
    errorDespues?: string;
    consultas: ConsultaComparada[];
    rompedor: boolean;
}
export function cambiosDeForma(antes: ColumnaResultado[], despues: ColumnaResultado[]): Cambio[] {
    const out: Cambio[] = [];
    const d = new Map(despues.map(c => [c.nombre, c.tipo]));
    const a = new Map(antes.map(c => [c.nombre, c.tipo]));
    for (const c of antes) {
        if (!d.has(c.nombre))
            out.push({ tipo: "quitada", columna: c.nombre, antes: c.tipo });
        else if (d.get(c.nombre) !== c.tipo)
            out.push({ tipo: "tipo", columna: c.nombre, antes: c.tipo, despues: d.get(c.nombre) });
    }
    for (const c of despues)
        if (!a.has(c.nombre))
            out.push({ tipo: "nueva", columna: c.nombre, despues: c.tipo });
    return out;
}
export function veredicto(antes: ComprobacionConsulta, despues: ComprobacionConsulta): {
    veredicto: Veredicto;
    error?: string;
    cambios: Cambio[];
} {
    if (antes.error && despues.error)
        return { veredicto: "fallaba", error: antes.error.mensaje, cambios: [] };
    if (antes.error)
        return { veredicto: "arregla", error: antes.error.mensaje, cambios: [] };
    if (despues.error)
        return { veredicto: "rompe", error: despues.error.mensaje, cambios: [] };
    const cambios = cambiosDeForma(antes.columnas, despues.columnas);
    if (!cambios.length)
        return { veredicto: "igual", cambios };
    return { veredicto: cambios.every(c => c.tipo === "nueva") ? "amplia" : "cambia", cambios };
}
export async function compararBanco(runAntes: Run, runDespues: Run, ddlAntes: string, ddlDespues: string, consultas: {
    nombre: string;
    sql: string;
}[]): Promise<ImpactoCambio> {
    const out: ImpactoCambio = { consultas: [], rompedor: false };
    const aplica = async (run: Run, ddl: string) => ddl.trim() ? (await run(ddl)).find(r => r.error)?.error : undefined;
    out.errorAntes = await aplica(runAntes, ddlAntes);
    out.errorDespues = await aplica(runDespues, ddlDespues);
    if (out.errorAntes || out.errorDespues)
        return out;
    for (const q of consultas) {
        const a = await comprobarConsulta(runAntes, "", q.sql, 0);
        const d = await comprobarConsulta(runDespues, "", q.sql, 0);
        out.consultas.push({ nombre: q.nombre, sql: q.sql, ...veredicto(a, d) });
    }
    out.rompedor = out.consultas.some(c => c.veredicto === "rompe" || c.veredicto === "cambia");
    return out;
}
@Injectable({ providedIn: "root" })
export class SchemaBreakingService {
    private engine = inject(PgEngineService);
    run(ddlAntes: string, ddlDespues: string, consultas: {
        nombre: string;
        sql: string;
    }[]): Promise<ImpactoCambio> {
        return this.engine.withScratch(a => this.engine.withScratch(d => compararBanco(a, d, ddlAntes, ddlDespues, consultas)));
    }
}
