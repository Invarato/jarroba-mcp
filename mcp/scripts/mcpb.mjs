import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
const MCP = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CLI = "@anthropic-ai/mcpb@2.1.2";
const rel = process.argv[2];
if (!rel) {
    console.error("uso: node scripts/mcpb.mjs <carpeta del paquete, p. ej. packages/calc o .>");
    process.exit(2);
}
const dirPkg = resolve(MCP, rel);
const pkg = JSON.parse(readFileSync(join(dirPkg, "package.json"), "utf8"));
const binRel = Object.values(pkg.bin ?? {})[0];
if (!binRel || !existsSync(join(dirPkg, binRel))) {
    console.error(`✗ no está construido ${join(rel, binRel ?? "?")}: lanza antes \`node build.mjs\``);
    process.exit(1);
}
const caja = mkdtempSync(join(tmpdir(), "mcpb-"));
const raiz = join(caja, "bundle");
try {
    mkdirSync(raiz, { recursive: true });
    cpSync(join(dirPkg, dirname(binRel)), join(raiz, "server"), { recursive: true });
    const entrada = `server/${basename(binRel)}`;
    cpSync(join(MCP, "LICENSE"), join(raiz, "LICENSE"));
    if (existsSync(join(dirPkg, "README.md")))
        cpSync(join(dirPkg, "README.md"), join(raiz, "README.md"));
    writeFileSync(join(raiz, "package.json"), JSON.stringify({
        name: pkg.name,
        version: pkg.version,
        type: pkg.type,
        license: pkg.license,
        dependencies: pkg.dependencies,
        private: true,
    }, null, 2));
    execFileSync("npm", ["install", "--omit=dev", "--no-audit", "--no-fund", "--ignore-scripts"], { cwd: raiz, stdio: "pipe" });
    const cliente = new Client({ name: "mcpb", version: "0" });
    await cliente.connect(new StdioClientTransport({ command: process.execPath, args: [join(raiz, entrada)], cwd: raiz, stderr: "ignore" }));
    const tools = (await cliente.listTools()).tools;
    const instrucciones = cliente.getInstructions();
    await cliente.close();
    const frase = (s = "") => {
        const f = (s.match(/^.*?[.!?](\s|$)/)?.[0] ?? s).trim();
        return f.length <= 200 ? f : f.slice(0, f.lastIndexOf(" ", 197)).replace(/[,;:(\s]+$/, "") + "\u2026";
    };
    const corto = pkg.name.replace(/^@jarroba\//, "jarroba-");
    const manifiesto = {
        manifest_version: "0.3",
        name: corto,
        display_name: corto === "jarroba-mcp" ? "Jarroba Tools" : `Jarroba Tools — ${corto.replace("jarroba-mcp-", "")}`,
        version: pkg.version,
        description: frase(pkg.description),
        long_description: `${pkg.description}\n\n${instrucciones ?? ""}`.trim(),
        author: { name: "Jarroba Tools", url: "https://jarroba.com/tools/" },
        repository: { type: "git", url: "https://github.com/Invarato/jarroba-mcp" },
        homepage: "https://jarroba.com/tools/",
        license: pkg.license,
        keywords: pkg.keywords,
        server: {
            type: "node",
            entry_point: entrada,
            mcp_config: { command: "node", args: [`\${__dirname}/${entrada}`] },
        },
        tools: tools.map((t) => ({ name: t.name, description: frase(t.description) })),
        compatibility: { platforms: ["darwin", "win32", "linux"], runtimes: { node: ">=20.0.0" } },
    };
    writeFileSync(join(raiz, "manifest.json"), JSON.stringify(manifiesto, null, 2) + "\n");
    execFileSync("npx", ["-y", CLI, "validate", join(raiz, "manifest.json")], { stdio: "inherit" });
    const salida = join(MCP, "dist-mcpb", `${corto}-${pkg.version}.mcpb`);
    mkdirSync(dirname(salida), { recursive: true });
    rmSync(salida, { force: true });
    execFileSync("npx", ["-y", CLI, "pack", raiz, salida], { stdio: "inherit" });
    console.log(`\n✔ ${salida}  (${(statSync(salida).size / 1048576).toFixed(1)} MB, ${tools.length} tools)`);
}
finally {
    rmSync(caja, { recursive: true, force: true });
}
