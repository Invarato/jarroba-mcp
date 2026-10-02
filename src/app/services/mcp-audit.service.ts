import { estimarTokensClaude } from "../shared/factor-claude";
import { TokenCounterService, type Encoding } from "./token-counter.service";
import { LIMITES_REGISTRO_MCP } from "../shared/mcp-registry-limits";
import { auditarCatalogoMcp } from "./mcp-tool-poisoning.service";
export type Gravedad = "critico" | "alto" | "aviso" | "info";
export type ReglaId = "esquema-invalido" | "description-vacia" | "sin-annotations" | "annotations-incompletas" | "annotation-sospechosa" | "nombre-formato-dudoso" | "registro-campo-largo" | "registro-campo-corto" | "registro-name-formato" | "recuento-desincronizado" | "sin-instructions" | "instructions-larga" | "version-desincronizada" | "tool-cara" | "posible-envenenamiento";
export const TITULOS_REGLA: Record<ReglaId, string> = {
    "esquema-invalido": "JSON no v\u00E1lido",
    "description-vacia": "Sin descripci\u00F3n",
    "sin-annotations": "Sin annotations",
    "annotations-incompletas": "Annotations incompletas",
    "annotation-sospechosa": "Nombre y annotation no cuadran",
    "nombre-formato-dudoso": "Formato de nombre inusual",
    "registro-campo-largo": "Campo demasiado largo para el registro",
    "registro-campo-corto": "Campo demasiado corto para el registro",
    "registro-name-formato": "Formato de campo inv\u00E1lido para el registro",
    "recuento-desincronizado": "La descripci\u00F3n cita un recuento desfasado",
    "sin-instructions": "Sin `instructions`",
    "instructions-larga": "`instructions` puede quedar recortada",
    "version-desincronizada": "Versi\u00F3n desincronizada",
    "tool-cara": "Tool desproporcionadamente cara",
    "posible-envenenamiento": "Posible tool poisoning",
};
export interface Hallazgo {
    regla: ReglaId;
    gravedad: Gravedad;
    tool?: string;
    fragmento: string;
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
        h.push({ regla: "description-vacia", gravedad: "alto", tool: t.name, fragmento: "sin `description`, o vac\u00EDa" });
    }
    if (!t.annotations) {
        h.push({ regla: "sin-annotations", gravedad: "aviso", tool: t.name, fragmento: "sin `annotations`: el spec dice que el cliente debe asumir lo PESIMISTA "
                + "(puede escribir, puede ser destructiva) hasta que se declare lo contrario" });
    }
    else {
        const campos = ["readOnlyHint", "destructiveHint", "idempotentHint", "openWorldHint"];
        const faltan = campos.filter((c) => !(c in t.annotations!));
        if (faltan.length) {
            h.push({ regla: "annotations-incompletas", gravedad: "info", tool: t.name, fragmento: `faltan: ${faltan.join(", ")}`, datos: { faltan: faltan.length } });
        }
        const destructiva = t.annotations["destructiveHint"] === true;
        const soloLectura = t.annotations["readOnlyHint"] === true;
        if (VERBOS_QUE_ESCRIBEN.test(t.name.replace(/_/g, " ")) && (soloLectura || !destructiva)) {
            h.push({ regla: "annotation-sospechosa", gravedad: "aviso", tool: t.name, fragmento: `el nombre sugiere que escribe o borra, pero `
                    + (soloLectura ? "`readOnlyHint: true`" : "`destructiveHint` no es `true`")
                    + " \u2014 rev\u00EDsalo a mano; puede ser un nombre confuso, o una annotation optimista" });
        }
    }
    if (!/^[a-z][a-z0-9_]*$/.test(t.name)) {
        h.push({ regla: "nombre-formato-dudoso", gravedad: "info", tool: t.name, fragmento: "no es `snake_case` en min\u00FAsculas: no lo proh\u00EDbe el spec, pero es la convenci\u00F3n que "
                + "siguen los cat\u00E1logos grandes (la nuestra, la de GitHub) y lo que un modelo espera ver" });
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
            h.push({ regla: "registro-campo-largo", gravedad: "alto", fragmento: `${campo}: ${str.length} caracteres, el máximo del registro es ${limite.maxLength} `
                    + "\u2014 el registro devuelve un 422 con esto, DESPU\u00C9S de autenticarte", datos: { campo, longitud: str.length, maximo: limite.maxLength } });
        }
        if ("minLength" in limite && str.length < limite.minLength) {
            h.push({ regla: "registro-campo-corto", gravedad: "alto", fragmento: `${campo}: ${str.length} caracteres, el mínimo del registro es ${limite.minLength}`, datos: { campo, longitud: str.length, minimo: limite.minLength } });
        }
        if ("pattern" in limite && limite.pattern && !limite.pattern.test(str)) {
            h.push({ regla: "registro-name-formato", gravedad: "critico", fragmento: `${campo}: "${recorta(str, 60)}" no casa con el patrón que exige el registro (${limite.pattern})`, datos: { campo } });
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
                hallazgos.push({ regla: "tool-cara", gravedad: "aviso", tool: p.nombre, fragmento: `${p.tokens} tokens, ${Math.round(p.tokens / mediana)}× la mediana del catálogo (${mediana})`, datos: { tokens: p.tokens, mediana } });
            }
        }
    }
    for (const v of auditarCatalogoMcp(tools)) {
        const gravedad: Gravedad = v.diagnostico.explotable ? "critico" : v.diagnostico.patas >= 2 ? "alto" : "aviso";
        const reglas = v.hallazgos.map((h) => h.regla).join(", ");
        hallazgos.push({
            regla: "posible-envenenamiento",
            gravedad,
            tool: v.tool,
            fragmento: v.diagnostico.explotable
                ? `${v.diagnostico.patas}/3 señales — coincide con el patrón publicado (Invariant Labs): la `
                    + `description pide leer algo sensible Y mandarlo, en el mismo texto (${reglas})`
                : `${v.diagnostico.patas}/3 señales de la trifecta (${reglas}); falta: ${v.diagnostico.faltan.join(", ") || "\u2014"}`,
            datos: { patas: v.diagnostico.patas, explotable: v.diagnostico.explotable ? 1 : 0 },
        });
    }
    if (input.instructions !== undefined) {
        const ins = input.instructions.trim();
        if (!ins) {
            hallazgos.push({ regla: "sin-instructions", gravedad: "aviso", fragmento: "vac\u00EDo. Bajo Tool Search (por defecto en Claude Code desde enero de 2026) es lo "
                    + "\u00FAnico que queda cargado antes de que el modelo busque nada: sin \u00E9l, decidir si merece la "
                    + "pena buscar aqu\u00ED depende solo de adivinar por el nombre del servidor" });
        }
        else {
            const bytes = new TextEncoder().encode(ins).length;
            if (bytes >= TOPE_INSTRUCTIONS_BYTES) {
                hallazgos.push({ regla: "instructions-larga", gravedad: "aviso", fragmento: `${bytes} bytes — la comunidad documenta que algunos clientes recortan este campo `
                        + `sin avisar por encima de ~${TOPE_INSTRUCTIONS_BYTES}`, datos: { bytes } });
            }
        }
    }
    const server = parseOpcional(input.serverJson);
    const pkg = parseOpcional(input.packageJson);
    if (server === null)
        hallazgos.push({ regla: "esquema-invalido", gravedad: "info", fragmento: "el server.json pegado no es JSON v\u00E1lido; se ignora" });
    if (pkg === null)
        hallazgos.push({ regla: "esquema-invalido", gravedad: "info", fragmento: "el package.json pegado no es JSON v\u00E1lido; se ignora" });
    if (server && typeof server === "object") {
        hallazgos.push(...auditarServerJson(server));
        const desc = String(server["description"] ?? "");
        const citado = desc.match(/\b(\d{1,4})\s+(?:deterministic\s+)?tools?\b/i)?.[1];
        if (citado && Number(citado) !== tools.length) {
            hallazgos.push({ regla: "recuento-desincronizado", gravedad: "alto", fragmento: `la description cita "${citado} tools" y el \`tools/list\` pegado trae ${tools.length}`, datos: { citado: Number(citado), real: tools.length } });
        }
    }
    if (server && pkg && typeof server === "object" && typeof pkg === "object") {
        if (server["version"] !== pkg["version"]) {
            hallazgos.push({ regla: "version-desincronizada", gravedad: "critico", fragmento: `server.json dice "${server["version"]}" y package.json dice "${pkg["version"]}" — `
                    + "el registro oficial verifica la versi\u00F3n contra npm y esto da un 400 despu\u00E9s de autenticarte" });
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
