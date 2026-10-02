import DOMPurify from "dompurify";
import mermaid from "mermaid";
type Purify = Record<string, unknown>;
const p = DOMPurify as unknown as Purify;
p["addHook"] ??= () => { };
p["removeHook"] ??= () => { };
p["removeHooks"] ??= () => { };
p["removeAllHooks"] ??= () => { };
p["sanitize"] ??= (s: unknown) => s;
export interface ResultadoMermaid {
    valid: boolean;
    diagramType?: string;
    error?: string;
    line?: number;
    column?: number;
    expected?: string[];
}
export async function validarMermaid(texto: string): Promise<ResultadoMermaid> {
    try {
        const r = await mermaid.parse(texto);
        if (!r)
            return { valid: false, error: "Mermaid rejected the diagram without an error message." };
        return { valid: true, diagramType: r.diagramType };
    }
    catch (e) {
        const err = e as {
            message?: string;
            hash?: {
                loc?: {
                    first_line?: number;
                    first_column?: number;
                };
                expected?: string[];
            };
        };
        const msg = String(err.message ?? e);
        const loc = err.hash?.loc;
        const txt = /line (\d+), column (\d+)/i.exec(msg);
        return {
            valid: false,
            error: msg.trim(),
            line: loc?.first_line ?? (txt ? Number(txt[1]) : undefined),
            column: loc?.first_column !== undefined ? loc.first_column + 1 : txt ? Number(txt[2]) : undefined,
            expected: err.hash?.expected?.map((x) => x.replace(/^'|'$/g, "")).slice(0, 12),
        };
    }
}
