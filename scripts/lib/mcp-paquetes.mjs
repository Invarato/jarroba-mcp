import { readdirSync, existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
export const RAIZ = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
export function paquetesMcp() {
    const out = [];
    const mira = (rel) => {
        const dir = join(RAIZ, rel);
        if (existsSync(join(dir, "package.json")) && existsSync(join(dir, "server.json"))) {
            out.push({
                rel,
                pkg: JSON.parse(readFileSync(join(dir, "package.json"), "utf8")),
                server: JSON.parse(readFileSync(join(dir, "server.json"), "utf8")),
            });
        }
    };
    mira("mcp");
    const sub = join(RAIZ, "mcp", "packages");
    if (existsSync(sub)) {
        for (const e of readdirSync(sub, { withFileTypes: true })) {
            if (e.isDirectory())
                mira(join("mcp", "packages", e.name));
        }
    }
    return out;
}
