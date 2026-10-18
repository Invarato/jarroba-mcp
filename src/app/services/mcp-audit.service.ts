import { estimarTokensClaude } from "../shared/factor-claude";
import { TokenCounterService, type Encoding } from "./token-counter.service";
import { LIMITES_REGISTRO_MCP } from "../shared/mcp-registry-limits";
import { auditarCatalogoMcp, sombras } from "./mcp-tool-poisoning.service";
export type Gravedad = "critico" | "alto" | "aviso" | "info";
export type ReglaId = "esquema-invalido" | "description-vacia" | "sin-annotations" | "annotations-incompletas" | "annotation-sospechosa" | "nombre-formato-dudoso" | "registro-campo-largo" | "registro-campo-corto" | "registro-name-formato" | "recuento-desincronizado" | "sin-instructions" | "instructions-larga" | "version-desincronizada" | "tool-cara" | "posible-envenenamiento" | "envenenamiento-esquema" | "sombra-entre-tools";
export interface Hallazgo {
    regla: ReglaId;
    gravedad: Gravedad;
    tool?: string;
    datos?: Record<string, string | number>;
}
export interface ToolEntry {
    name: string;
    description?: string;
    inputSchema?: unknown;
    annotations?: Record<string, unknown>;
}
export interface InformeCatalogo {
    totalTools: number;
    tokensTotal: number | null;
    tokensClaude: number | null;
    porTool: {
        nombre: string;
        tokens: number;
    }[];
    hallazgos: Hallazgo[];
    porGravedad: Record<Gravedad, number>;
}
export const LIMITES_REGISTRO = LIMITES_REGISTRO_MCP;
const TOPE_INSTRUCTIONS_BYTES = 2000;
const VERBOS_QUE_ESCRIBEN = /\b(delete|remove|drop|purge|destroy|truncate|wipe|clear|reset|overwrite)\b/i;
const recorta = (s: string, n = 140) => (s.length > n ? s.slice(0, n) + "\u2026" : s);
export function parseToolsList(texto: string): ToolEntry[] | null {
    let json: unknown;
    try {
        json = JSON.parse(texto);
    }
    catch {
        return null;
    }
    const arr = Array.isArray(json) ? json
        : (json && typeof json === "object" && Array.isArray((json as any).tools)) ? (json as any).tools
            : null;
    if (!arr)
        return null;
    if (!arr.every((t: unknown) => t && typeof t === "object" && typeof (t as any).name === "string"))
        return null;
    return arr as ToolEntry[];
}
function parseOpcional(texto: string | undefined): Record<string, unknown> | null | undefined {
    const t = texto?.trim();
    if (!t)
        return undefined;
    try {
        return JSON.parse(t);
    }
    catch {
        return null;
    }
}
function auditarTool(t: ToolEntry): Hallazgo[] {
    const h: Hallazgo[] = [];
    if (!t.description || !t.description.trim()) {
        h.push({ regla: "description-vacia", gravedad: "alto", tool: t.name });
    }
    if (!t.annotations) {
        h.push({ regla: "sin-annotations", gravedad: "aviso", tool: t.name });
    }
    else {
        const campos = ["readOnlyHint", "destructiveHint", "idempotentHint", "openWorldHint"];
        const faltan = campos.filter((c) => !(c in t.annotations!));
        if (faltan.length) {
            h.push({ regla: "annotations-incompletas", gravedad: "info", tool: t.name, datos: { faltan: faltan.length, campos: faltan.join(", ") } });
        }
        const destructiva = t.annotations["destructiveHint"] === true;
        const soloLectura = t.annotations["readOnlyHint"] === true;
        if (VERBOS_QUE_ESCRIBEN.test(t.name.replace(/_/g, " ")) && (soloLectura || !destructiva)) {
            h.push({ regla: "annotation-sospechosa", gravedad: "aviso", tool: t.name, datos: { soloLectura: soloLectura ? 1 : 0 } });
        }
    }
    if (!/^[a-z][a-z0-9_]*$/.test(t.name)) {
        h.push({ regla: "nombre-formato-dudoso", gravedad: "info", tool: t.name });
    }
    return h;
}
function auditarServerJson(s: Record<string, unknown>): Hallazgo[] {
    const h: Hallazgo[] = [];
    for (const [campo, limite] of Object.entries(LIMITES_REGISTRO)) {
        const v = s[campo];
        if (v === undefined)
            continue;
        const str = String(v);
        if ("maxLength" in limite && str.length > limite.maxLength) {
            h.push({ regla: "registro-campo-largo", gravedad: "alto", datos: { campo, longitud: str.length, maximo: limite.maxLength } });
        }
        if ("minLength" in limite && str.length < limite.minLength) {
            h.push({ regla: "registro-campo-corto", gravedad: "alto", datos: { campo, longitud: str.length, minimo: limite.minLength } });
        }
        if ("pattern" in limite && limite.pattern && !limite.pattern.test(str)) {
            h.push({ regla: "registro-name-formato", gravedad: "critico", datos: { campo, valor: recorta(str, 60), patron: String(limite.pattern) } });
        }
    }
    return h;
}
export async function auditarCatalogo(input: {
    toolsListJson: string;
    serverJson?: string;
    packageJson?: string;
    instructions?: string;
    encoding?: Encoding;
}, tokenCounter: TokenCounterService): Promise<InformeCatalogo | {
    error: string;
}> {
    const tools = parseToolsList(input.toolsListJson);
    if (!tools) {
        return { error: "No parece la respuesta de `tools/list`: pega el JSON completo ({\"tools\": [...]}) o el array a pelo." };
    }
    const encoding = input.encoding ?? "o200k_base";
    const hallazgos: Hallazgo[] = [];
    for (const t of tools)
        hallazgos.push(...auditarTool(t));
    const porTool: {
        nombre: string;
        tokens: number;
    }[] = [];
    for (const t of tools) {
        const def = JSON.stringify({ name: t.name, description: t.description ?? "", input_schema: t.inputSchema ?? {} });
        const r = await tokenCounter.count(def, encoding);
        porTool.push({ nombre: t.name, tokens: r?.tokens ?? 0 });
    }
    const tokensTotal = tools.length ? porTool.reduce((a, p) => a + p.tokens, 0) : null;
    porTool.sort((a, b) => b.tokens - a.tokens);
    if (porTool.length >= 4) {
        const mediana = porTool[Math.floor(porTool.length / 2)].tokens;
        for (const p of porTool) {
            if (mediana > 0 && p.tokens > mediana * 3 && p.tokens > 200) {
                hallazgos.push({ regla: "tool-cara", gravedad: "aviso", tool: p.nombre, datos: { tokens: p.tokens, mediana, veces: Math.round(p.tokens / mediana) } });
            }
        }
    }
    for (const v of auditarCatalogoMcp(tools)) {
        let gravedad: Gravedad = v.diagnostico.explotable ? "critico" : v.diagnostico.patas >= 2 ? "alto" : "aviso";
        if (v.codificado && gravedad === "aviso")
            gravedad = "alto";
        hallazgos.push({
            regla: v.enEsquema.length ? "envenenamiento-esquema" : "posible-envenenamiento",
            gravedad,
            tool: v.tool,
            datos: { patas: v.diagnostico.patas, explotable: v.diagnostico.explotable ? 1 : 0, codificado: v.codificado ? 1 : 0, reglas: [...new Set(v.hallazgos.map((h) => h.regla))].join(", "), faltan: v.diagnostico.faltan.join(", "), enEsquema: v.enEsquema.join(", ") },
        });
    }
    for (const s of sombras(tools)) {
        hallazgos.push({
            regla: "sombra-entre-tools",
            gravedad: "alto",
            tool: s.tool,
            datos: { nombrada: s.nombrada, texto: recorta(s.fragmento, 120) },
        });
    }
    if (input.instructions !== undefined) {
        const ins = input.instructions.trim();
        if (!ins) {
            hallazgos.push({ regla: "sin-instructions", gravedad: "aviso" });
        }
        else {
            const bytes = new TextEncoder().encode(ins).length;
            if (bytes >= TOPE_INSTRUCTIONS_BYTES) {
                hallazgos.push({ regla: "instructions-larga", gravedad: "aviso", datos: { bytes, tope: TOPE_INSTRUCTIONS_BYTES } });
            }
        }
    }
    const server = parseOpcional(input.serverJson);
    const pkg = parseOpcional(input.packageJson);
    if (server === null)
        hallazgos.push({ regla: "esquema-invalido", gravedad: "info", datos: { fichero: "server.json" } });
    if (pkg === null)
        hallazgos.push({ regla: "esquema-invalido", gravedad: "info", datos: { fichero: "package.json" } });
    if (server && typeof server === "object") {
        hallazgos.push(...auditarServerJson(server));
        const desc = String(server["description"] ?? "");
        const citado = desc.match(/\b(\d{1,4})\s+(?:deterministic\s+)?tools?\b/i)?.[1];
        if (citado && Number(citado) !== tools.length) {
            hallazgos.push({ regla: "recuento-desincronizado", gravedad: "alto", datos: { citado: Number(citado), real: tools.length } });
        }
    }
    if (server && pkg && typeof server === "object" && typeof pkg === "object") {
        if (server["version"] !== pkg["version"]) {
            hallazgos.push({ regla: "version-desincronizada", gravedad: "critico", datos: { server: String(server["version"] ?? ""), paquete: String(pkg["version"] ?? "") } });
        }
    }
    const porGravedad: Record<Gravedad, number> = { critico: 0, alto: 0, aviso: 0, info: 0 };
    for (const h of hallazgos)
        porGravedad[h.gravedad]++;
    return {
        totalTools: tools.length,
        tokensTotal,
        tokensClaude: tokensTotal !== null && encoding === "o200k_base" ? estimarTokensClaude(tokensTotal) : null,
        porTool,
        hallazgos,
        porGravedad,
    };
}
