import { auditarFichero, VERBO_ENVIO, type Hallazgo } from "./agente-audit.service";
import { diagnosticarTrifecta, type DiagnosticoTrifecta, type Trifecta } from "./prompt-injection.service";
import type { ToolEntry } from "./mcp-audit.service";
export interface VeredictoEnvenenamiento {
    tool: string;
    hallazgos: Hallazgo[];
    trifecta: Trifecta;
    diagnostico: DiagnosticoTrifecta;
}
export function auditarDescripcionTool(tool: Pick<ToolEntry, "name" | "description">): VeredictoEnvenenamiento {
    const texto = tool.description ?? "";
    const hallazgos = auditarFichero(`mcp-tool-${tool.name}.md`, texto).hallazgos;
    const datosPrivados = hallazgos.some(h => h.regla === "texto-ruta-sensible");
    const canalDeSalida = hallazgos.some(h => h.regla === "texto-exfil-imagen") || VERBO_ENVIO.test(texto);
    const trifecta: Trifecta = { datosPrivados, contenidoNoFiable: true, canalDeSalida };
    return { tool: tool.name, hallazgos, trifecta, diagnostico: diagnosticarTrifecta(trifecta) };
}
export function auditarCatalogoMcp(tools: Pick<ToolEntry, "name" | "description">[]): VeredictoEnvenenamiento[] {
    return tools.map(auditarDescripcionTool).filter(v => v.hallazgos.length > 0);
}
export type TipoCambio = "tool-nueva" | "tool-quitada" | "descripcion-cambiada" | "envenenamiento-nuevo" | "esquema-cambiado" | "annotations-debilitadas";
export interface CambioCatalogo {
    tipo: TipoCambio;
    tool: string;
    gravedad: "critico" | "alto" | "aviso" | "info";
    detalle?: string;
}
type ToolComparable = Pick<ToolEntry, "name" | "description" | "inputSchema" | "annotations">;
function estable(v: unknown): string {
    if (Array.isArray(v))
        return `[${v.map(estable).join(",")}]`;
    if (v && typeof v === "object") {
        return `{${Object.keys(v as object).sort().map(k => `${JSON.stringify(k)}:${estable((v as Record<string, unknown>)[k])}`).join(",")}}`;
    }
    return JSON.stringify(v) ?? "null";
}
const PESIMISTA: Record<string, boolean> = { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true };
function annotationsDebilitadas(antes?: Record<string, unknown>, despues?: Record<string, unknown>): string[] {
    const v = (a: Record<string, unknown> | undefined, k: string) => (typeof a?.[k] === "boolean" ? a[k] as boolean : PESIMISTA[k]);
    return Object.keys(PESIMISTA).filter(k => v(antes, k) !== PESIMISTA[k] && v(despues, k) === PESIMISTA[k]);
}
export function compararCatalogos(antes: ToolComparable[], despues: ToolComparable[]): CambioCatalogo[] {
    const cambios: CambioCatalogo[] = [];
    const previas = new Map(antes.map(t => [t.name, t]));
    const actuales = new Map(despues.map(t => [t.name, t]));
    for (const t of despues) {
        const p = previas.get(t.name);
        if (!p) {
            const v = auditarDescripcionTool(t);
            cambios.push({ tipo: "tool-nueva", tool: t.name, gravedad: v.hallazgos.length ? "alto" : "aviso" });
            continue;
        }
        if ((p.description ?? "") !== (t.description ?? "")) {
            const reglasAntes = new Set(auditarDescripcionTool(p).hallazgos.map(h => h.regla));
            const vNueva = auditarDescripcionTool(t);
            const nuevas = [...new Set(vNueva.hallazgos.map(h => h.regla))].filter(r => !reglasAntes.has(r));
            if (nuevas.length) {
                cambios.push({ tipo: "envenenamiento-nuevo", tool: t.name, gravedad: vNueva.diagnostico.explotable ? "critico" : "alto", detalle: nuevas.join(", ") });
            }
            else {
                cambios.push({ tipo: "descripcion-cambiada", tool: t.name, gravedad: "aviso" });
            }
        }
        if (estable(p.inputSchema) !== estable(t.inputSchema)) {
            const props = (s: unknown) => Object.keys(((s as {
                properties?: object;
            } | undefined)?.properties) ?? {});
            const anadidas = props(t.inputSchema).filter(k => !props(p.inputSchema).includes(k));
            cambios.push({ tipo: "esquema-cambiado", tool: t.name, gravedad: anadidas.length ? "alto" : "aviso", detalle: anadidas.join(", ") || undefined });
        }
        const peores = annotationsDebilitadas(p.annotations, t.annotations);
        if (peores.length) {
            cambios.push({ tipo: "annotations-debilitadas", tool: t.name, gravedad: peores.includes("destructiveHint") || peores.includes("readOnlyHint") ? "alto" : "aviso", detalle: peores.join(", ") });
        }
    }
    for (const p of antes)
        if (!actuales.has(p.name))
            cambios.push({ tipo: "tool-quitada", tool: p.name, gravedad: "info" });
    const orden = { critico: 0, alto: 1, aviso: 2, info: 3 };
    return cambios.sort((a, b) => orden[a.gravedad] - orden[b.gravedad]);
}
