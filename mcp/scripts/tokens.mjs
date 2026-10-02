import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { encode } from "gpt-tokenizer";
import { DOMINIOS } from "../src/catalogo.ts";
import { FACTOR_CLAUDE_CODE } from "../src/factor-claude.ts";
const pedidos = process.argv.slice(2);
const dominios = pedidos.length ? pedidos : Object.keys(DOMINIOS);
async function medir(filtro) {
    const transporte = new StdioClientTransport({
        command: "npx",
        args: ["tsx", "src/server.ts"],
        env: { ...process.env, ...(filtro ? { JARROBA_MCP_DOMAINS: filtro } : {}) },
        stderr: "ignore",
    });
    const cliente = new Client({ name: "tokens", version: "0.0.0" });
    await cliente.connect(transporte);
    const tools = (await cliente.listTools()).tools;
    await cliente.close();
    const tokens = tools.reduce((t, x) => t + encode(JSON.stringify({
        name: "mcp__jarroba-tools__" + x.name,
        description: x.description,
        input_schema: x.inputSchema,
    })).length, 0);
    return { n: tools.length, tokens, cc: Math.round(tokens * FACTOR_CLAUDE_CODE), porTool: Math.round(tokens / tools.length) };
}
console.log("\n  dominio      tools   o200k   Claude Code (\u2248)   o200k por tool");
console.log("  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500");
const filas = [];
for (const d of dominios) {
    const m = await medir(d);
    filas.push([d, m]);
    console.log(`  ${d.padEnd(12)} ${String(m.n).padStart(5)} ${String(m.tokens).padStart(7)} ${String(m.cc).padStart(17)} ${String(m.porTool).padStart(16)}`);
}
if (!pedidos.length) {
    const t = await medir();
    console.log("  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500");
    console.log(`  ${"TODO".padEnd(12)} ${String(t.n).padStart(5)} ${String(t.tokens).padStart(7)} ${String(t.cc).padStart(17)} ${String(t.porTool).padStart(16)}`);
}
console.log();
