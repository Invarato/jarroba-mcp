import { execFileSync } from "node:child_process";
const INSPECTOR = "@modelcontextprotocol/inspector@2.11.0";
const inspector = (...args) => JSON.parse(execFileSync("npx", ["-y", INSPECTOR, "--cli", "node", "dist/server.mjs", ...args], { encoding: "utf8", timeout: 300000, stdio: ["ignore", "pipe", "pipe"], maxBuffer: 64 * 1024 * 1024 }));
let fallos = 0;
const check = (nombre, ok, visto) => { console.log(`${ok ? "\u2713" : "\u2717"} ${nombre}${ok ? "" : `  visto=${JSON.stringify(visto).slice(0, 300)}`}`); if (!ok)
    fallos++; };
const lista = inspector("--method", "tools/list");
check("tools/list: m\u00E1s de 100 herramientas, todas con nombre, descripci\u00F3n y esquema de objeto", lista.tools?.length > 100 && lista.tools.every((t) => t.name && t.description && t.inputSchema?.type === "object"), lista.tools?.length);
check("tools/list: todas declaran annotations", lista.tools?.every((t) => t.annotations && typeof t.annotations.readOnlyHint === "boolean"), lista.tools?.filter((t) => !t.annotations).map((t) => t.name));
const hash = inspector("--method", "tools/call", "--tool-name", "hash_text", "--tool-arg", "text=abc");
check("tools/call hash_text: el SHA-256 de \u00ABabc\u00BB de la RFC", JSON.parse(hash.content?.[0]?.text ?? "{}").sha256
    === "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad", hash);
const calc = inspector("--method", "tools/call", "--tool-name", "calc_eval", "--tool-arg", "expression=2 km + 300 m to m");
check("tools/call calc_eval: 2 km + 300 m = 2300 m", /2300 m/.test(calc.content?.[0]?.text ?? ""), calc);
console.log(fallos ? `\n${fallos} FALLOS` : "\nCONFORMIDAD OK");
process.exit(fallos ? 1 : 0);
