export interface MedidaFactorClaude {
    modelo: string;
    claudeCode: string;
    fecha: string;
    factor: number;
    rango: [
        number,
        number
    ];
    sobre: string;
    como: string;
}
export const MEDIDAS_FACTOR_CLAUDE: readonly MedidaFactorClaude[] = [
    {
        modelo: "Claude Opus 5.5",
        claudeCode: "2.1.281",
        fecha: "2026-09-30",
        factor: 1.74,
        rango: [1.38, 2],
        sobre: "MCP tool definitions (English + JSON)",
        como: "`/context all` without Tool Search on @jarroba/mcp 0.1.7 (41 996) vs o200k on name+description+input_schema (24 120); no fixed cost per tool",
    },
];
export function medidaClaude(modelo?: string): MedidaFactorClaude {
    const m = modelo ? MEDIDAS_FACTOR_CLAUDE.filter(x => x.modelo === modelo) : [];
    return (m.length ? m : MEDIDAS_FACTOR_CLAUDE)[(m.length ? m : MEDIDAS_FACTOR_CLAUDE).length - 1];
}
export function estimarTokensClaude(tokensO200k: number, medida: MedidaFactorClaude = medidaClaude()): number {
    return Math.round(Math.max(0, tokensO200k) * medida.factor);
}
const ULTIMA = medidaClaude();
export const FACTOR_CLAUDE_CODE = ULTIMA.factor;
export const FACTOR_CLAUDE_FUENTE = `measured ${ULTIMA.fecha} with Claude Code ${ULTIMA.claudeCode} (${ULTIMA.modelo.replace(/^Claude /, "")}) on ${ULTIMA.sobre}: ` +
    `${ULTIMA.rango[0].toFixed(2)}–${ULTIMA.rango[1].toFixed(2)}× per tool, median ${ULTIMA.factor}`;
