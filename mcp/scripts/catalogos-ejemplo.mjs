import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const version = JSON.parse(readFileSync(join(raiz, "package.json"), "utf8")).version;
const destino = join(raiz, "..", "src", "app", "features", "mcp-audit", "catalogos-jarroba.ts");
async function toolsList(filtro) {
    const transporte = new StdioClientTransport({
        command: "npx",
        args: ["tsx", "src/server.ts"],
        cwd: raiz,
        env: { ...process.env, ...(filtro ? { JARROBA_MCP_DOMAINS: filtro } : {}) },
        stderr: "ignore",
    });
    const cliente = new Client({ name: "catalogos-ejemplo", version: "0.0.0" });
    await cliente.connect(transporte);
    const r = await cliente.listTools();
    await cliente.close();
    return { tools: r.tools };
}
const calc = await toolsList("calc");
const todo = await toolsList();
const fecha = new Date().toISOString().slice(0, 10);
const cuerpo = `// GENERADO por mcp/scripts/catalogos-ejemplo.mjs — no lo edites a mano: regenéralo.
// El \`tools/list\` real de nuestros paquetes MCP (versión ${version}, ${fecha}), para los ejemplos de /mcp-audit.
// Se carga bajo demanda (import dinámico): no pesa en la tool hasta que alguien pide el ejemplo. Va compacto; la tool\n// le da formato al pegarlo.

export interface CatalogoJarroba { paquete: string; version: string; fecha: string; toolsList: string; }

export const CATALOGOS_JARROBA: Record<'jarroba-calc' | 'jarroba', CatalogoJarroba> = {
  'jarroba-calc': { paquete: '@jarroba/mcp-calc', version: ${JSON.stringify(version)}, fecha: ${JSON.stringify(fecha)},
    toolsList: ${JSON.stringify(JSON.stringify(calc))} },
  'jarroba': { paquete: '@jarroba/mcp', version: ${JSON.stringify(version)}, fecha: ${JSON.stringify(fecha)},
    toolsList: ${JSON.stringify(JSON.stringify(todo))} },
};
`;
writeFileSync(destino, cuerpo);
console.log(`calc: ${calc.tools.length} tools · todo: ${todo.tools.length} tools · ${Math.round(cuerpo.length / 1024)} KB → ${destino}`);
