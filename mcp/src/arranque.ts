export function fijarDominios(dominios: string): void {
    process.env["JARROBA_MCP_DOMAINS"] ??= dominios;
}
