import { auditarFichero, VERBO_ENVIO, type Hallazgo } from "./agente-audit.service";
import { diagnosticarTrifecta, type DiagnosticoTrifecta, type Trifecta } from "./prompt-injection.service";
import type { ToolEntry } from "./mcp-audit.service";
export interface VeredictoEnvenenamiento {
    tool: string;
    hallazgos: Hallazgo[];
    trifecta: Trifecta;
    diagnostico: DiagnosticoTrifecta;
    enEsquema: string[];
    codificado: boolean;
}
const legible = (t: string) => t.length >= 8 && [...t].filter(c => /[\p{L}\p{N}\p{P}\p{Zs}\n]/u.test(c)).length / t.length > 0.9;
export function decodificados(texto: string, nivel = 0): string[] {
    if (nivel >= 2)
        return [];
    const out: string[] = [];
    const probar = (t: string | null) => { if (t && legible(t) && !out.includes(t)) {
        out.push(t);
        out.push(...decodificados(t, nivel + 1));
    } };
    const utf8 = (bytes: Uint8Array) => { try {
        return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    }
    catch {
        return null;
    } };
    for (const m of texto.matchAll(/[A-Za-z0-9+/_-]{24,}={0,2}/g)) {
        try {
            const b64 = m[0].replace(/-/g, "+").replace(/_/g, "/");
            probar(utf8(Uint8Array.from(atob(b64 + "===".slice((b64.length + 3) % 4)), c => c.charCodeAt(0))));
        }
        catch { }
    }
    for (const m of texto.matchAll(/\b(?:[0-9a-fA-F]{2}){16,}\b/g)) {
        probar(utf8(Uint8Array.from(m[0].match(/../g)!.map(h => parseInt(h, 16)))));
    }
    for (const m of texto.matchAll(/[\w.~!*'()+-]*(?:%[0-9a-fA-F]{2}[\w.~!*'()+-]*){3,}/g)) {
        try {
            probar(decodeURIComponent(m[0]));
        }
        catch { }
    }
    return out;
}
const VOCABULARIO_SCHEMA = new Set([
    "type",
    "description",
    "title",
    "properties",
    "required",
    "items",
    "enum",
    "const",
    "default",
    "examples",
    "format",
    "minimum",
    "maximum",
    "exclusiveMinimum",
    "exclusiveMaximum",
    "minLength",
    "maxLength",
    "pattern",
    "minItems",
    "maxItems",
    "uniqueItems",
    "additionalProperties",
    "patternProperties",
    "propertyNames",
    "minProperties",
    "maxProperties",
    "oneOf",
    "anyOf",
    "allOf",
    "not",
    "if",
    "then",
    "else",
    "$ref",
    "$defs",
    "definitions",
    "$schema",
    "$id",
    "$comment",
    "nullable",
    "readOnly",
    "writeOnly",
    "deprecated",
    "contentMediaType",
    "contentEncoding",
    "dependentRequired",
    "dependentSchemas",
    "prefixItems",
    "contains",
    "multipleOf",
    "unevaluatedProperties",
]);
const PARAM_IMPERATIVO = /(content|contents|value|output|text|data)s?_(from|of)_(reading|read|cat)|read_and_(include|send|return)|append_(content|contents)_of|exfil(trate)?_/i;
const PARAM_SENSIBLE = /ssh|id_rsa|id_ed25519|passwd|shadow|credential|secret|token|api_?key|private_?key|\benv\b|_env_|mcp_?json|aws/i;
export interface TextoEsquema {
    donde: string;
    texto: string;
    estructural?: "param-imperativo";
}
export function textosDelEsquema(esquema: unknown, ruta = "", profundidad = 0, out: TextoEsquema[] = []): TextoEsquema[] {
    if (!esquema || typeof esquema !== "object" || profundidad > 8 || out.length > 500)
        return out;
    if (Array.isArray(esquema)) {
        esquema.forEach((x, i) => textosDelEsquema(x, `${ruta}[${i}]`, profundidad + 1, out));
        return out;
    }
    const o = esquema as Record<string, unknown>;
    for (const [k, v] of Object.entries(o)) {
        const aqui = ruta ? `${ruta}.${k}` : k;
        if (k === "properties" && v && typeof v === "object" && !Array.isArray(v)) {
            for (const [nombre, sub] of Object.entries(v as Record<string, unknown>)) {
                const frase = nombre.replace(/[_-]+/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2");
                out.push({ donde: `param:${nombre}`, texto: frase, ...(PARAM_IMPERATIVO.test(nombre) && PARAM_SENSIBLE.test(nombre) ? { estructural: "param-imperativo" as const } : {}) });
                textosDelEsquema(sub, `${aqui}.${nombre}`, profundidad + 1, out);
            }
        }
        else if (typeof v === "string") {
            out.push({ donde: VOCABULARIO_SCHEMA.has(k) ? `campo:${aqui}` : `campo-no-estandar:${aqui}`, texto: v });
        }
        else if (Array.isArray(v) && v.every(x => typeof x === "string")) {
            if (v.length)
                out.push({ donde: `campo:${aqui}`, texto: (v as string[]).join(". ") });
        }
        else if (v && typeof v === "object") {
            textosDelEsquema(v, aqui, profundidad + 1, out);
        }
    }
    return out;
}
const PARECE_TOOL = /\b[a-z][a-z0-9]*(?:_[a-z0-9]+)+\b/g;
const VERBOS_DE_TOOL = /^(send|read|write|delete|remove|exec|execute|run|get|create|update|post|fetch|list|search|upload|download|query|call|open|move|copy|transfer|pay|email|mail)_/;
const CONDICION = /\b(always|must|never|instead|before|after|whenever|override|use\s+only|siempre|nunca|debe|en\s+lugar\s+de|antes\s+de|despu[eé]s\s+de|cada\s+vez)\b/i;
export interface Sombra {
    tool: string;
    nombrada: string;
    fragmento: string;
}
export function sombras(tools: Pick<ToolEntry, "name" | "description">[]): Sombra[] {
    const nombres = new Set(tools.map(t => t.name));
    const out: Sombra[] = [];
    for (const t of tools) {
        const d = t.description ?? "";
        for (const frase of d.split(/(?<=[.!?\n])\s+/)) {
            if (!CONDICION.test(frase))
                continue;
            const nombrada = [...frase.matchAll(PARECE_TOOL)].map(m => m[0])
                .find(n => !nombres.has(n) && VERBOS_DE_TOOL.test(n));
            if (nombrada) {
                out.push({ tool: t.name, nombrada, fragmento: frase.trim().slice(0, 160) });
                break;
            }
        }
    }
    return out;
}
export function auditarDescripcionTool(tool: Pick<ToolEntry, "name" | "description" | "inputSchema">): VeredictoEnvenenamiento {
    const partes: TextoEsquema[] = [{ donde: "description", texto: tool.description ?? "" }, ...textosDelEsquema(tool.inputSchema)];
    const conCodificados = partes.flatMap(p => [p, ...decodificados(p.texto).map(t => ({ donde: p.donde, texto: t, codificado: true }))]);
    const hallazgos: Hallazgo[] = [];
    const enEsquema = new Set<string>();
    let codificado = false;
    for (const p of conCodificados) {
        const hs = auditarFichero(`mcp-tool-${tool.name}.md`, p.texto).hallazgos;
        if (hs.length) {
            hallazgos.push(...hs);
            if (p.donde !== "description")
                enEsquema.add(p.donde);
            if ("codificado" in p)
                codificado = true;
        }
    }
    const estructurales = partes.filter(p => p.estructural === "param-imperativo");
    for (const p of estructurales)
        enEsquema.add(p.donde);
    const todo = conCodificados.map(p => p.texto).join("\n");
    const datosPrivados = hallazgos.some(h => h.regla === "texto-ruta-sensible") || estructurales.length > 0;
    const canalDeSalida = hallazgos.some(h => h.regla === "texto-exfil-imagen") || VERBO_ENVIO.test(todo) || estructurales.length > 0;
    const trifecta: Trifecta = { datosPrivados, contenidoNoFiable: true, canalDeSalida };
    if (estructurales.length && !hallazgos.length) {
        hallazgos.push({ regla: "texto-ruta-sensible", gravedad: "alto", confianza: "indicio", fichero: `mcp-tool-${tool.name}.md`, linea: 0, fragmento: estructurales.map(p => p.donde).join(", ") });
    }
    return { tool: tool.name, hallazgos, trifecta, diagnostico: diagnosticarTrifecta(trifecta), enEsquema: [...enEsquema], codificado };
}
export function auditarCatalogoMcp(tools: Pick<ToolEntry, "name" | "description" | "inputSchema">[]): VeredictoEnvenenamiento[] {
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
