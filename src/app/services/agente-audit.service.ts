import * as jsYaml from "js-yaml";
import { analizarTexto } from "./texto-oculto.service";
import { DETECTORS } from "../shared/redact";
import { Trifecta, DiagnosticoTrifecta, diagnosticarTrifecta } from "./prompt-injection.service";
export type { Trifecta, DiagnosticoTrifecta };
export type TipoFichero = "claude-settings" | "mcp" | "vscode-settings" | "vscode-tasks" | "codex-toml" | "gemini-settings" | "entorno" | "instrucciones" | "skill" | "subagente" | "script" | "desconocido";
export type Gravedad = "critico" | "alto" | "aviso" | "info";
export type Confianza = "estructural" | "indicio";
export type ReglaId = "hook-comando" | "hook-http" | "comando-ayudante" | "mcp-auto-aprobado" | "env-desvia-api" | "env-node-options" | "secreto-literal" | "permiso-shell-libre" | "permiso-interprete" | "permiso-red-libre" | "permiso-lectura-amplia" | "permiso-escritura-libre" | "modo-sin-permisos" | "directorio-amplio" | "deny-red-insuficiente" | "mcp-shell" | "mcp-sin-version" | "mcp-docker-privilegiado" | "mcp-http-plano" | "mcp-confianza-total" | "mcp-esquema-equivocado" | "mcp-url-interna" | "mcp-escucha-todas" | "mcp-remote-vulnerable" | "vscode-autoaprobar" | "vscode-sin-confianza" | "vscode-tarea-al-abrir" | "codex-sin-sandbox" | "codex-sin-aprobacion" | "codex-red" | "gemini-sin-confianza" | "gemini-shell-libre" | "entorno-desvia-config" | "unicode-oculto" | "texto-ocultar-usuario" | "texto-anular-instrucciones" | "texto-autoridad-falsa" | "texto-pipe-shell" | "texto-host-sospechoso" | "texto-exfil-imagen" | "texto-ruta-sensible" | "texto-escribe-memoria" | "texto-comentario-oculto" | "import-externo" | "skill-herramientas-libres" | "skill-inyeccion-comando" | "skill-nombre-invalido" | "subagente-sin-permisos" | "script-empaquetado" | "json-invalido";
export interface Hallazgo {
    regla: ReglaId;
    gravedad: Gravedad;
    confianza: Confianza;
    fichero: string;
    linea: number;
    fragmento: string;
    seEjecutaSolo?: boolean;
    datos?: Record<string, string>;
}
export interface FicheroAuditado {
    ruta: string;
    tipo: TipoFichero;
    hallazgos: Hallazgo[];
}
export interface Auditoria {
    ficheros: FicheroAuditado[];
    hallazgos: Hallazgo[];
    porGravedad: Record<Gravedad, number>;
    seEjecutaSolo: Hallazgo[];
}
const base = (ruta: string) => ruta.split("/").pop() ?? ruta;
export function tipoDeFichero(ruta: string, contenido = ""): TipoFichero {
    const r = ruta.replace(/\\/g, "/");
    const b = base(r).toLowerCase();
    if (/(^|\/)\.claude\/settings(\.local)?\.json$/.test(r) || /(^|\/)managed-settings\.json$/.test(r)
        || /(^|\/)hooks\/hooks\.json$/.test(r) || /(^|\/)\.claude-plugin\/plugin\.json$/.test(r))
        return "claude-settings";
    if (/(^|\/)\.gemini\/settings\.json$/.test(r))
        return "gemini-settings";
    if (/(^|\/)\.vscode\/settings\.json$/.test(r))
        return "vscode-settings";
    if (/(^|\/)\.vscode\/tasks\.json$/.test(r))
        return "vscode-tasks";
    if (b === ".mcp.json" || b === "mcp.json" || b === "claude_desktop_config.json")
        return "mcp";
    if (/(^|\/)\.codex\/config\.toml$/.test(r) || b === "config.toml" && /\b(sandbox_mode|approval_policy|mcp_servers)\b/.test(contenido))
        return "codex-toml";
    if (b === ".env" || /^\.env\./.test(b))
        return "entorno";
    if (b === "skill.md")
        return "skill";
    if (/(^|\/)\.claude\/(agents|commands)\/[^/]+\.md$/.test(r))
        return "subagente";
    if (/(^|\/)skills\/[^/]+\/.+\.(sh|bash|zsh|py|js|mjs|ts|ps1|rb)$/i.test(r))
        return "script";
    if (["claude.md", "claude.local.md", "agents.md", "agents.override.md", "gemini.md", ".cursorrules", ".windsurfrules", "copilot-instructions.md"].includes(b)
        || /(^|\/)\.(cursor|windsurf|devin|claude)\/rules\/[^/]+\.(mdc|md)$/.test(r)
        || /(^|\/)\.github\/(instructions|prompts)\/[^/]+\.(instructions|prompt)\.md$/.test(r))
        return "instrucciones";
    if (b.endsWith(".json")) {
        if (/"(permissions|hooks|enableAllProjectMcpServers|apiKeyHelper)"\s*:/.test(contenido))
            return "claude-settings";
        if (/"(mcpServers|servers)"\s*:/.test(contenido))
            return "mcp";
        if (/"(chat\.|security\.workspace\.trust)/.test(contenido))
            return "vscode-settings";
        if (/"tasks"\s*:\s*\[/.test(contenido))
            return "vscode-tasks";
        if (pareceServidorEnRaiz(contenido))
            return "mcp";
    }
    if (b.endsWith(".md") || b.endsWith(".mdc"))
        return "instrucciones";
    return "desconocido";
}
function pareceServidorEnRaiz(contenido: string): boolean {
    try {
        const o = parseJsonc(contenido);
        return esObj(o) && Object.values(o).some(v => esObj(v) && (typeof v["command"] === "string" || typeof v["url"] === "string"));
    }
    catch {
        return false;
    }
}
export function rutaParaPegado(contenido: string): string {
    const t = contenido.trim();
    if (/^[{[]/.test(t)) {
        try {
            parseJsonc(t);
        }
        catch {
            return "pegado.json";
        }
        if (/"hooks"\s*:/.test(t) && !/"(permissions|env|mcpServers)"\s*:/.test(t) && /\$\{CLAUDE_PLUGIN_ROOT\}/.test(t))
            return "plugin/hooks/hooks.json";
        if (/"servers"\s*:/.test(t) && !/"mcpServers"\s*:/.test(t))
            return ".vscode/mcp.json";
        if (/"trust"\s*:\s*true|"folderTrust"/.test(t))
            return ".gemini/settings.json";
        return "pegado.json";
    }
    if (/^\s*(sandbox_mode|approval_policy|model_provider)\s*=|^\s*\[mcp_servers\./m.test(t))
        return ".codex/config.toml";
    const fm = frontmatter(t);
    if (fm && typeof fm["name"] === "string" && typeof fm["description"] === "string") {
        if ("permissionMode" in fm || "tools" in fm)
            return ".claude/agents/pegado.md";
        return `.claude/skills/${fm["name"].replace(/[^a-z0-9-]/g, "") || "pegada"}/SKILL.md`;
    }
    const lineas = t.split("\n").filter(l => l.trim() && !l.trim().startsWith("#"));
    if (lineas.length && lineas.every(l => /^\s*(export\s+)?[A-Za-z_][A-Za-z0-9_]*\s*=/.test(l)))
        return ".env";
    return "CLAUDE.md";
}
export function esRutaDeAgente(ruta: string): boolean {
    const r = ruta.replace(/\\/g, "/");
    if (/\.(md|mdc)$/i.test(r) && !/(^|\/)\.(claude|cursor|windsurf|devin|github)\//.test(r)
        && !/^(claude|claude\.local|agents|agents\.override|gemini|skill|copilot-instructions)\.md$/i.test(base(r)))
        return false;
    if (/\.json$/i.test(r) && !/(^|\/)(\.claude|\.gemini|\.vscode|\.cursor|\.claude-plugin)\/|(^|\/)(\.mcp|mcp|claude_desktop_config|managed-settings)\.json$|(^|\/)hooks\/hooks\.json$/.test(r))
        return false;
    return tipoDeFichero(r, "") !== "desconocido";
}
function lineaDe(contenido: string, ...agujas: (string | Map<string, number>)[]): number {
    const cursor = agujas.find((a): a is Map<string, number> => a instanceof Map);
    for (const a of agujas) {
        if (typeof a !== "string" || !a)
            continue;
        for (const forma of [a, JSON.stringify(a).slice(1, -1)]) {
            const i = contenido.indexOf(forma, cursor?.get(forma) ?? 0);
            if (i >= 0) {
                cursor?.set(forma, i + 1);
                return lineaDeOffset(contenido, i);
            }
        }
    }
    return 1;
}
const lineaDeOffset = (contenido: string, i: number) => contenido.slice(0, i).split("\n").length;
const recorta = (s: string, n = 160) => (s.length > n ? s.slice(0, n - 1) + "\u2026" : s);
export function parseJsonc(texto: string): unknown {
    let out = "";
    for (let i = 0; i < texto.length; i++) {
        const c = texto[i];
        if (c === "\"") {
            let j = i + 1;
            while (j < texto.length && texto[j] !== "\"")
                j += texto[j] === "\\" ? 2 : 1;
            out += texto.slice(i, j + 1);
            i = j;
            continue;
        }
        if (c === "/" && texto[i + 1] === "/") {
            while (i < texto.length && texto[i] !== "\n")
                i++;
            out += "\n";
            continue;
        }
        if (c === "/" && texto[i + 1] === "*") {
            const f = texto.indexOf("*/", i + 2);
            i = f < 0 ? texto.length : f + 1;
            continue;
        }
        out += c;
    }
    return JSON.parse(out.replace(/,(\s*[}\]])/g, "$1"));
}
const esObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x);
const texto = (x: unknown) => (typeof x === "string" ? x : "");
const lista = (x: unknown) => (Array.isArray(x) ? x.filter((v): v is string => typeof v === "string") : []);
export const PIPE_A_SHELL = [
    /\b(curl|wget)\b[^\n|]*\|\s*(sudo\s+)?(ba|z|da)?sh\b/i,
    /\b(iwr|Invoke-WebRequest|irm|Invoke-RestMethod)\b[^\n|]*\|\s*iex\b/i,
    /\b(ba|z)?sh\s*<\(\s*(curl|wget)/i,
    /base64\s+(-d|--decode)[^\n]*\|\s*(ba|z)?sh\b/i,
];
export const HOST_SOSPECHOSO = /\b(glot\.io|pastebin\.com|paste\.ee|hastebin\.com|webhook\.site|requestbin\.\w+|pipedream\.net|ngrok(-free)?\.(io|app|dev)|trycloudflare\.com|interact\.sh|oast\.\w+|burpcollaborator\.net)\b|https?:\/\/\d{1,3}(\.\d{1,3}){3}\b/i;
const RED_EN_COMANDO = /\b(curl|wget|nc|ncat|netcat|Invoke-WebRequest|iwr|scp|rsync)\b|https?:\/\//i;
const RUTA_SENSIBLE = /(~\/\.ssh|\bid_(rsa|ed25519|ecdsa)\b|\.aws\/credentials|\.npmrc|\.git-credentials|\.docker\/config\.json|\.netrc|\.kube\/config|(^|[\s"'`/])\.env\b|mcp\.json|keychain|\/etc\/shadow)/i;
const esPipeAShell = (s: string) => PIPE_A_SHELL.some(r => r.test(s));
const comandoPeligroso = (s: string) => esPipeAShell(s) || HOST_SOSPECHOSO.test(s) || (RED_EN_COMANDO.test(s) && RUTA_SENSIBLE.test(s));
const SECRETOS = DETECTORS.filter(d => d.category === "secret");
const CLAVE_CREDENCIAL = /(token|secret|password|passwd|api[-_]?key|auth|credential)/i;
function pareceSecreto(clave: string, valor: string): boolean {
    if (!valor || /\$\{|\$\(|\{\{/.test(valor))
        return false;
    if (SECRETOS.some(d => { d.regex.lastIndex = 0; const m = d.regex.exec(valor); return !!m && (!d.validate || d.validate(m[0])); }))
        return true;
    return CLAVE_CREDENCIAL.test(clave) && valor.length >= 12 && !/\s/.test(valor);
}
const HOSTS_OFICIALES = /^(api\.anthropic\.com|api\.openai\.com|generativelanguage\.googleapis\.com|[\w-]+\.openai\.azure\.com)$/i;
function hostDe(url: string): string {
    try {
        return new URL(url).hostname;
    }
    catch {
        return url;
    }
}
const esLocal = (h: string) => /^(localhost|127\.0\.0\.1|\[::1\]|::1|0\.0\.0\.0)$/i.test(h);
const esMetadatos = (h: string) => /^(169\.254\.169\.254|\[?fd00:ec2::254\]?|metadata\.google\.internal|metadata|100\.100\.100\.200|169\.254\.170\.2)$/i.test(h);
const esPrivada = (h: string) => /^(10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|169\.254\.\d+\.\d+|\[?f[cd][0-9a-f]{2}:[^\]]*\]?|\[?fe[89ab][0-9a-f]:[^\]]*\]?)$/i.test(h);
function versionMenor(v: string, tope: [
    number,
    number,
    number
]): boolean | null {
    const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(v.trim());
    if (!m)
        return null;
    for (let i = 0; i < 3; i++) {
        const n = Number(m[i + 1]);
        if (n !== tope[i])
            return n < tope[i];
    }
    return false;
}
type Emitir = (h: Omit<Hallazgo, "fichero">) => void;
function revisarEnv(env: Record<string, unknown>, contenido: string, emitir: Emitir, deRepo: boolean): void {
    for (const [k, v] of Object.entries(env)) {
        const val = texto(v);
        const linea = lineaDe(contenido, `"${k}"`, k);
        if (/(_BASE_URL|_API_BASE|_ENDPOINT)$/i.test(k) && /(ANTHROPIC|OPENAI|AZURE|GEMINI|GOOGLE|CLAUDE|BEDROCK|VERTEX)/i.test(k) || /^(HTTPS?_PROXY|ALL_PROXY)$/i.test(k)) {
            const h = hostDe(val);
            if (val && !HOSTS_OFICIALES.test(h)) {
                emitir({ regla: "env-desvia-api", gravedad: esLocal(h) ? "aviso" : (deRepo ? "critico" : "alto"), confianza: "estructural", linea, fragmento: recorta(`${k}=${val}`), seEjecutaSolo: true, datos: { clave: k, host: h } });
            }
        }
        if (/^NODE_OPTIONS$/i.test(k) && /(--require|-r\s|--import|--loader|--experimental-loader)/.test(val)) {
            emitir({ regla: "env-node-options", gravedad: "critico", confianza: "estructural", linea, fragmento: recorta(`${k}=${val}`), seEjecutaSolo: true });
        }
        if (pareceSecreto(k, val)) {
            emitir({ regla: "secreto-literal", gravedad: "alto", confianza: "estructural", linea, fragmento: `${k}=${val.slice(0, 4)}…`, datos: { clave: k } });
        }
    }
}
const INTERPRETES = ["python", "python3", "node", "npx", "bunx", "deno", "bun", "ruby", "perl", "php", "bash", "sh", "zsh", "eval", "exec", "sudo", "su", "docker", "ssh", "curl", "wget", "nc", "powershell", "pwsh", "env", "xargs", "uvx", "pip", "npm exec"];
function revisarPermisos(perm: Record<string, unknown>, raiz: Record<string, unknown>, contenido: string, emitir: Emitir): void {
    for (const regla of lista(perm["allow"])) {
        const linea = lineaDe(contenido, `"${regla}"`);
        const m = /^(\w+)(?:\((.*)\))?$/.exec(regla.trim());
        if (!m)
            continue;
        const [, tool, arg = ""] = m;
        const a = arg.trim();
        if (tool === "Bash") {
            if (!m[2] || /^(\*|:\*|\*\s*\*)$/.test(a)) {
                emitir({ regla: "permiso-shell-libre", gravedad: "alto", confianza: "estructural", linea, fragmento: regla });
                continue;
            }
            const cmd = a.replace(/[:\s]\*$/, "").replace(/\s+\*$/, "").trim();
            if (INTERPRETES.includes(cmd.split(/\s+/)[0]) && /\*/.test(a))
                emitir({ regla: "permiso-interprete", gravedad: "alto", confianza: "estructural", linea, fragmento: regla, datos: { comando: cmd.split(/\s+/)[0] } });
        }
        if (tool === "WebFetch" && (!m[2] || /^domain:\*$/.test(a)))
            emitir({ regla: "permiso-red-libre", gravedad: "aviso", confianza: "estructural", linea, fragmento: regla });
        if (tool === "Read" && (/^(~\/?\*\*|\/\/\*\*|\/\*\*|\*\*)$/.test(a) || RUTA_SENSIBLE.test(a)))
            emitir({ regla: "permiso-lectura-amplia", gravedad: "alto", confianza: "estructural", linea, fragmento: regla });
        if ((tool === "Edit" || tool === "Write") && (!m[2] || /^(~\/?\*\*|\/\/\*\*|\/\*\*)$/.test(a)))
            emitir({ regla: "permiso-escritura-libre", gravedad: "aviso", confianza: "estructural", linea, fragmento: regla });
    }
    const modo = texto(perm["defaultMode"]);
    if (modo === "bypassPermissions" || modo === "auto") {
        emitir({ regla: "modo-sin-permisos", gravedad: modo === "bypassPermissions" ? "alto" : "aviso", confianza: "estructural", linea: lineaDe(contenido, "\"defaultMode\""), fragmento: `defaultMode: ${modo}`, datos: { modo } });
    }
    for (const d of lista(perm["additionalDirectories"])) {
        if (/^(\/|~|~\/|\/\/|[A-Za-z]:\\?)$/.test(d.trim()))
            emitir({ regla: "directorio-amplio", gravedad: "alto", confianza: "estructural", linea: lineaDe(contenido, `"${d}"`), fragmento: d });
    }
    const denyRed = lista(perm["deny"]).find(r => /^Bash\((curl|wget)\b/.test(r));
    const sandbox = esObj(raiz["sandbox"]) && raiz["sandbox"]["enabled"] === true;
    if (denyRed && !sandbox)
        emitir({ regla: "deny-red-insuficiente", gravedad: "info", confianza: "estructural", linea: lineaDe(contenido, `"${denyRed}"`), fragmento: denyRed });
}
type Origen = "repo" | "plugin";
const origenDe = (ruta: string): Origen => /(^|\/)(hooks\/hooks\.json|\.claude-plugin\/plugin\.json)$/.test(ruta) ? "plugin" : "repo";
function revisarHooks(hooks: Record<string, unknown>, contenido: string, emitir: Emitir, origen: Origen = "repo"): void {
    const cursor = new Map<string, number>();
    for (const [evento, grupos] of Object.entries(hooks)) {
        for (const g of Array.isArray(grupos) ? grupos : []) {
            if (!esObj(g))
                continue;
            for (const h of Array.isArray(g["hooks"]) ? g["hooks"] : []) {
                if (!esObj(h))
                    continue;
                const tipo = texto(h["type"]) || "command";
                if (tipo === "command") {
                    const cmd = [texto(h["command"]), ...lista(h["args"])].join(" ").trim();
                    const gravedad: Gravedad = comandoPeligroso(cmd) ? "critico" : origen === "plugin" ? "aviso" : "alto";
                    emitir({ regla: "hook-comando", gravedad, confianza: "estructural", linea: lineaDe(contenido, texto(h["command"]), `"${evento}"`, cursor), fragmento: recorta(cmd), seEjecutaSolo: true, datos: { evento, matcher: texto(g["matcher"]), origen } });
                }
                else if (tipo === "http") {
                    const url = texto(h["url"]);
                    emitir({ regla: "hook-http", gravedad: origen === "plugin" ? "aviso" : "alto", confianza: "estructural", linea: lineaDe(contenido, url, `"${evento}"`, cursor), fragmento: url, seEjecutaSolo: true, datos: { evento, host: hostDe(url), origen } });
                }
            }
        }
    }
}
export interface ServidorMcp {
    nombre: string;
    command: string;
    args: string[];
    env: Record<string, unknown>;
    headers: Record<string, unknown>;
    url: string;
    trust?: boolean;
    headersHelper?: string;
}
function revisarServidor(s: ServidorMcp, contenido: string, emitir: Emitir): void {
    const linea = lineaDe(contenido, `"${s.nombre}"`, `[mcp_servers.${s.nombre}]`, s.nombre);
    const bin = base(s.command).toLowerCase().replace(/\.exe$/, "");
    const todo = [s.command, ...s.args].join(" ");
    if (["sh", "bash", "zsh", "cmd", "powershell", "pwsh"].includes(bin) && s.args.some(a => /^(-c|\/c|-Command|-EncodedCommand)$/i.test(a))) {
        emitir({ regla: "mcp-shell", gravedad: comandoPeligroso(todo) ? "critico" : "alto", confianza: "estructural", linea, fragmento: recorta(todo), datos: { servidor: s.nombre } });
    }
    else if (comandoPeligroso(todo)) {
        emitir({ regla: "mcp-shell", gravedad: "critico", confianza: "estructural", linea, fragmento: recorta(todo), datos: { servidor: s.nombre } });
    }
    if (["npx", "bunx", "uvx", "pipx"].includes(bin) || (bin === "pnpm" && s.args[0] === "dlx")) {
        const pkg = s.args.filter(a => !a.startsWith("-") && a !== "dlx" && a !== "run")[0] ?? "";
        const version = /^@[^/]+\/[^@]+@(.+)$/.exec(pkg)?.[1] ?? /^[^@/][^@]*@(.+)$/.exec(pkg)?.[1] ?? (/==(.+)$/.exec(pkg)?.[1]);
        if (pkg && (!version || version === "latest"))
            emitir({ regla: "mcp-sin-version", gravedad: "aviso", confianza: "estructural", linea, fragmento: recorta(todo), datos: { servidor: s.nombre, paquete: pkg } });
    }
    if (bin === "docker" && (s.args.includes("--privileged") || s.args.some((a, i) => (a === "-v" || a === "--volume") && /^(\/:|\/var\/run\/docker\.sock)/.test(s.args[i + 1] ?? "")) || s.args.some(a => /^--(net|network)(=|$)/.test(a) && /host/.test(a + " " + (s.args[s.args.indexOf(a) + 1] ?? ""))))) {
        emitir({ regla: "mcp-docker-privilegiado", gravedad: "alto", confianza: "estructural", linea, fragmento: recorta(todo), datos: { servidor: s.nombre } });
    }
    const urls = [s.url, ...s.args.filter(a => /^https?:\/\//i.test(a))].filter(Boolean);
    for (const url of urls) {
        const host = hostDe(url);
        if (/^http:\/\//i.test(url) && !esLocal(host))
            emitir({ regla: "mcp-http-plano", gravedad: "alto", confianza: "estructural", linea: lineaDe(contenido, url), fragmento: url, datos: { servidor: s.nombre } });
        if (esMetadatos(host) || esPrivada(host))
            emitir({ regla: "mcp-url-interna", gravedad: esMetadatos(host) ? "alto" : "info", confianza: "estructural", linea: lineaDe(contenido, url), fragmento: url, datos: { servidor: s.nombre, host, tipo: esMetadatos(host) ? "metadata" : "private" } });
    }
    const TODAS = /^(0\.0\.0\.0|::|\[::\])$/;
    const OPCION = /^--?(host|bind|listen|address|addr)$/i;
    let bind = "";
    s.args.forEach((a, i) => {
        const [k, v] = a.split("=", 2);
        if (!bind && OPCION.test(k) && TODAS.test(v ?? s.args[i + 1] ?? ""))
            bind = v !== undefined ? a : `${a} ${s.args[i + 1]}`;
    });
    for (const [k, v] of Object.entries(s.env))
        if (!bind && /^(HOST|BIND|LISTEN|MCP_HOST|SERVER_HOST|FASTMCP_HOST)$/i.test(k) && TODAS.test(texto(v)))
            bind = `${k}=${texto(v)}`;
    if (bind)
        emitir({ regla: "mcp-escucha-todas", gravedad: "aviso", confianza: "estructural", linea, fragmento: bind, datos: { servidor: s.nombre } });
    const remoto = s.args.find(a => /^mcp-remote@/.test(a));
    if (remoto && versionMenor(remoto.slice("mcp-remote@".length), [0, 1, 16])) {
        emitir({ regla: "mcp-remote-vulnerable", gravedad: "critico", confianza: "estructural", linea, fragmento: remoto, datos: { servidor: s.nombre, version: remoto.slice("mcp-remote@".length) } });
    }
    if (s.trust === true)
        emitir({ regla: "mcp-confianza-total", gravedad: "alto", confianza: "estructural", linea: lineaDe(contenido, "\"trust\""), fragmento: `${s.nombre}: trust: true`, seEjecutaSolo: true, datos: { servidor: s.nombre } });
    if (s.headersHelper)
        emitir({ regla: "comando-ayudante", gravedad: comandoPeligroso(s.headersHelper) ? "critico" : "aviso", confianza: "estructural", linea: lineaDe(contenido, s.headersHelper), fragmento: recorta(s.headersHelper), seEjecutaSolo: true, datos: { clave: "headersHelper" } });
    for (const [k, v] of [...Object.entries(s.env), ...Object.entries(s.headers)]) {
        if (pareceSecreto(k, texto(v)))
            emitir({ regla: "secreto-literal", gravedad: "alto", confianza: "estructural", linea: lineaDe(contenido, texto(v)), fragmento: `${k}=${texto(v).slice(0, 4)}…`, datos: { clave: k, servidor: s.nombre } });
    }
}
const pareceServidor = (v: unknown) => esObj(v) && (typeof v["command"] === "string" || typeof v["url"] === "string");
export function servidoresDeJson(obj: Record<string, unknown>): ServidorMcp[] {
    const raiz = Object.fromEntries(Object.entries(obj).filter(([, v]) => pareceServidor(v)));
    const mapa = esObj(obj["mcpServers"]) ? obj["mcpServers"] : esObj(obj["servers"]) ? obj["servers"] : raiz;
    return Object.entries(mapa).filter(([, v]) => esObj(v)).map(([nombre, v]) => {
        const o = v as Record<string, unknown>;
        return {
            nombre,
            command: texto(o["command"]),
            args: lista(o["args"]),
            env: esObj(o["env"]) ? o["env"] : {},
            headers: esObj(o["headers"]) ? o["headers"] : {},
            url: texto(o["url"]) || texto(o["httpUrl"]),
            trust: o["trust"] === true,
            headersHelper: texto(o["headersHelper"]) || undefined,
        };
    });
}
const REGLAS_TEXTO: {
    regla: ReglaId;
    gravedad: Gravedad;
    re: RegExp;
}[] = [
    { regla: "texto-ocultar-usuario", gravedad: "alto", re: /\b(do\s*n[o']?t|never)\s+(tell|mention|inform|reveal|show|notify|disclose)\b[^.\n]{0,40}\b(user|human|developer)s?\b/i },
    { regla: "texto-ocultar-usuario", gravedad: "alto", re: /\bno\s+(se\s+lo\s+|le\s+)?(digas|menciones|cuentes|informes|muestres|avises|comentes)\b[^.\n]{0,40}\busuari[oa]s?\b/i },
    { regla: "texto-anular-instrucciones", gravedad: "alto", re: /\bignore\s+(all\s+)?(the\s+)?(previous|prior|above|earlier|preceding)\s+(instructions|rules|prompts?|directions)\b/i },
    { regla: "texto-anular-instrucciones", gravedad: "alto", re: /\bignora\s+(todas\s+)?(las\s+)?(instrucciones|reglas)\s+(anteriores|previas)\b/i },
    { regla: "texto-anular-instrucciones", gravedad: "aviso", re: /\bNON-NEGOTIABLE\b|\bwithout\s+asking\s+(the\s+user\s+)?(for\s+)?(permission|confirmation)\b|\bsin\s+pedir\s+(permiso|confirmaci[oó]n)\b/i },
    { regla: "texto-autoridad-falsa", gravedad: "aviso", re: /<\s*\/?\s*(IMPORTANT|SYSTEM|system|admin|ADMIN)\s*>|\[\s*SYSTEM\s*\]/ },
    { regla: "texto-exfil-imagen", gravedad: "alto", re: /!\[[^\]]*\]\(\s*https?:\/\/[^)\s]*\?[^)\s]*(\{\{|\$\{|<|%7B|\b(env|key|token|secret|data|password|q)=)/i },
];
const ESCRIBE_MEMORIA = /\b(write|append|modify|overwrite|update|escribe|añade|modifica|sobrescribe|actualiza)\b[^.\n]{0,50}\b(CLAUDE\.md|AGENTS\.md|SOUL\.md|MEMORY\.md|GEMINI\.md|\.cursorrules|\.cursor\/rules|settings\.json|mcp\.json)|echo\b[^\n]*>>\s*\S*(CLAUDE|AGENTS|SOUL|MEMORY|GEMINI)\.md/i;
export const VERBO_ENVIO = /\b(send(s|ing)?|sent|upload(s|ing|ed)?|post(s|ing|ed)?|pass(es|ing|ed)?|include(s|d)?|including|exfiltrat\w*|attach(es|ing|ed)?|forward(s|ing|ed)?|env[ií]a|sube|manda|adjunta|incluye|reenv[ií]a|curl|wget)\b/i;
function revisarTexto(contenido: string, tipo: TipoFichero, emitir: Emitir): void {
    const lineas = contenido.split("\n");
    const oculto = analizarTexto(contenido);
    if (oculto.graves) {
        const primero = oculto.hallazgos.find(x => x.gravedad === "grave")!;
        emitir({
            regla: "unicode-oculto",
            gravedad: "critico",
            confianza: "estructural",
            linea: lineaDeOffset(contenido, primero.inicio),
            fragmento: `${oculto.graves} tramo(s)`,
            datos: { mensaje: oculto.mensajes.map(m => m.texto).join(" \u00B7 ") },
        });
    }
    lineas.forEach((l, i) => {
        if (tipo !== "script")
            for (const r of REGLAS_TEXTO) {
                const m = r.re.exec(l);
                if (!m)
                    continue;
                const citado = new RegExp(`["'“«\`]\\s*[^"'”»\`]{0,20}${m[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(l);
                emitir({ regla: r.regla, gravedad: citado && r.gravedad === "alto" ? "aviso" : r.gravedad, confianza: "indicio", linea: i + 1, fragmento: recorta(l.trim()), ...(citado ? { datos: { citado: "si" } } : {}) });
            }
        if (esPipeAShell(l))
            emitir({ regla: "texto-pipe-shell", gravedad: "alto", confianza: "indicio", linea: i + 1, fragmento: recorta(l.trim()) });
        if (HOST_SOSPECHOSO.test(l))
            emitir({ regla: "texto-host-sospechoso", gravedad: "alto", confianza: "indicio", linea: i + 1, fragmento: recorta(l.trim()) });
        if (RUTA_SENSIBLE.test(l) && VERBO_ENVIO.test(l))
            emitir({ regla: "texto-ruta-sensible", gravedad: "alto", confianza: "indicio", linea: i + 1, fragmento: recorta(l.trim()) });
        if (ESCRIBE_MEMORIA.test(l))
            emitir({ regla: "texto-escribe-memoria", gravedad: "aviso", confianza: "indicio", linea: i + 1, fragmento: recorta(l.trim()) });
        if (tipo === "instrucciones" && /^\s*@(~\/|\/)/.test(l))
            emitir({ regla: "import-externo", gravedad: "aviso", confianza: "estructural", linea: i + 1, fragmento: l.trim() });
    });
    for (const m of contenido.matchAll(/<!--([\s\S]*?)-->/g)) {
        if (/\b(ignore|execute|run|send|do\s+not|never|ejecuta|env[ií]a|ignora|no\s+(digas|menciones))\b/i.test(m[1])) {
            emitir({ regla: "texto-comentario-oculto", gravedad: "aviso", confianza: "indicio", linea: lineaDe(contenido, m[0]), fragmento: recorta(m[1].trim()) });
        }
    }
}
function frontmatter(contenido: string): Record<string, unknown> | null {
    const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(contenido);
    if (!m)
        return null;
    try {
        const y = jsYaml.load(m[1]);
        return esObj(y) ? y : null;
    }
    catch {
        return null;
    }
}
function revisarSkill(ruta: string, contenido: string, emitir: Emitir): void {
    const fm = frontmatter(contenido);
    const herramientas = fm ? (Array.isArray(fm["allowed-tools"]) ? lista(fm["allowed-tools"]) : texto(fm["allowed-tools"]).split(/[\s,]+/)) : [];
    const libre = herramientas.find(t => /^Bash(\((\*|:\*)\))?$/.test(t.trim()));
    if (libre)
        emitir({ regla: "skill-herramientas-libres", gravedad: "alto", confianza: "estructural", linea: lineaDe(contenido, "allowed-tools"), fragmento: `allowed-tools: ${herramientas.join(" ")}` });
    const nombre = fm ? texto(fm["name"]) : "";
    const carpeta = ruta.split("/").slice(-2, -1)[0];
    if (fm && (!/^(?!-)(?!.*--)[a-z0-9-]{1,64}(?<!-)$/.test(nombre) || (carpeta && carpeta !== nombre && ruta.includes("/")))) {
        emitir({ regla: "skill-nombre-invalido", gravedad: "info", confianza: "estructural", linea: lineaDe(contenido, "name:"), fragmento: `name: ${nombre}`, datos: { carpeta: carpeta ?? "" } });
    }
    if (fm && esObj(fm["hooks"]))
        revisarHooks(fm["hooks"], contenido, emitir);
    revisarInyeccionComando(contenido, emitir);
}
function revisarInyeccionComando(contenido: string, emitir: Emitir): void {
    const lineas = contenido.split("\n");
    let enBloque = false, enBloqueExclamacion = false, inicioBloque = 0, cuerpo: string[] = [];
    lineas.forEach((l, i) => {
        const valla = /^\s*(```|~~~)(!?)/.exec(l);
        if (valla) {
            if (!enBloque) {
                enBloque = true;
                enBloqueExclamacion = valla[2] === "!";
                inicioBloque = i;
                cuerpo = [];
                return;
            }
            if (enBloqueExclamacion && cuerpo.join("").trim()) {
                const cmd = cuerpo.join("\n").trim();
                emitir({ regla: "skill-inyeccion-comando", gravedad: comandoPeligroso(cmd) ? "critico" : "aviso", confianza: "estructural", linea: inicioBloque + 1, fragmento: recorta(cmd.replace(/\n/g, " ; ")), seEjecutaSolo: true });
            }
            enBloque = false;
            enBloqueExclamacion = false;
            return;
        }
        if (enBloqueExclamacion) {
            cuerpo.push(l);
            return;
        }
        for (const m of l.matchAll(/(?:^|\s)!`([^`]+)`/g)) {
            emitir({
                regla: "skill-inyeccion-comando",
                gravedad: comandoPeligroso(m[1]) ? "critico" : enBloque ? "info" : "aviso",
                confianza: "estructural",
                linea: i + 1,
                fragmento: recorta(m[1]),
                seEjecutaSolo: !enBloque,
                ...(enBloque ? { datos: { enBloque: "si" } } : {}),
            });
        }
    });
}
function revisarSubagente(ruta: string, contenido: string, emitir: Emitir): void {
    const fm = frontmatter(contenido);
    if (/(^|\/)\.claude\/commands\//.test(ruta))
        revisarInyeccionComando(contenido, emitir);
    if (fm && texto(fm["permissionMode"]) === "bypassPermissions") {
        emitir({ regla: "subagente-sin-permisos", gravedad: "alto", confianza: "estructural", linea: lineaDe(contenido, "permissionMode"), fragmento: "permissionMode: bypassPermissions" });
    }
    if (fm && esObj(fm["hooks"]))
        revisarHooks(fm["hooks"], contenido, emitir);
}
function revisarCodex(contenido: string, emitir: Emitir): void {
    const lin = (re: RegExp) => { const m = re.exec(contenido); return m ? lineaDe(contenido, m[0]) : 0; };
    let l = lin(/^\s*sandbox_mode\s*=\s*"danger-full-access"/m);
    if (l)
        emitir({ regla: "codex-sin-sandbox", gravedad: "alto", confianza: "estructural", linea: l, fragmento: "sandbox_mode = \"danger-full-access\"" });
    l = lin(/^\s*approval_policy\s*=\s*"never"/m);
    if (l)
        emitir({ regla: "codex-sin-aprobacion", gravedad: "alto", confianza: "estructural", linea: l, fragmento: "approval_policy = \"never\"" });
    l = lin(/^\s*network_access\s*=\s*true/m);
    if (l)
        emitir({ regla: "codex-red", gravedad: "aviso", confianza: "estructural", linea: l, fragmento: "network_access = true" });
    for (const m of contenido.matchAll(/^\s*base_url\s*=\s*"([^"]+)"/gm)) {
        const h = hostDe(m[1]);
        if (!HOSTS_OFICIALES.test(h))
            emitir({ regla: "env-desvia-api", gravedad: esLocal(h) ? "aviso" : "alto", confianza: "estructural", linea: lineaDe(contenido, m[0]), fragmento: m[0].trim(), seEjecutaSolo: true, datos: { clave: "base_url", host: h } });
    }
    for (const s of servidoresDeCodex(contenido))
        revisarServidor(s, contenido, emitir);
}
export function servidoresDeCodex(contenido: string): ServidorMcp[] {
    const secciones = contenido.split(/^(?=\s*\[mcp_servers\.)/m).filter(s => /^\s*\[mcp_servers\./.test(s));
    return secciones.map(sec => {
        const nombre = /\[mcp_servers\.([^\]\s]+)\]/.exec(sec)?.[1] ?? "?";
        const command = /^\s*command\s*=\s*"([^"]*)"/m.exec(sec)?.[1] ?? "";
        const args = [...(/^\s*args\s*=\s*\[([^\]]*)\]/m.exec(sec)?.[1] ?? "").matchAll(/"([^"]*)"/g)].map(x => x[1]);
        const url = /^\s*url\s*=\s*"([^"]*)"/m.exec(sec)?.[1] ?? "";
        return { nombre, command, args, env: {}, headers: {}, url };
    });
}
const ORDEN: Record<Gravedad, number> = { critico: 0, alto: 1, aviso: 2, info: 3 };
export function auditarFichero(ruta: string, contenido: string): FicheroAuditado {
    const tipo = tipoDeFichero(ruta, contenido);
    const hallazgos: Hallazgo[] = [];
    const emitir: Emitir = h => hallazgos.push({ ...h, fichero: ruta });
    const deRepo = !/^~|\/home\/|\/Users\//.test(ruta);
    const json = (): Record<string, unknown> | null => {
        try {
            const o = parseJsonc(contenido);
            if (esObj(o))
                return o;
        }
        catch { }
        emitir({ regla: "json-invalido", gravedad: "info", confianza: "estructural", linea: 1, fragmento: base(ruta) });
        return null;
    };
    switch (tipo) {
        case "claude-settings": {
            const o = json();
            if (!o)
                break;
            if (esObj(o["permissions"]))
                revisarPermisos(o["permissions"], o, contenido, emitir);
            if (esObj(o["hooks"]))
                revisarHooks(o["hooks"], contenido, emitir, origenDe(ruta));
            if (esObj(o["env"]))
                revisarEnv(o["env"], contenido, emitir, deRepo);
            for (const k of ["apiKeyHelper", "otelHeadersHelper", "awsAuthRefresh", "awsCredentialExport"]) {
                const v = texto(o[k]);
                if (v)
                    emitir({ regla: "comando-ayudante", gravedad: comandoPeligroso(v) ? "critico" : "aviso", confianza: "estructural", linea: lineaDe(contenido, `"${k}"`), fragmento: recorta(v), seEjecutaSolo: true, datos: { clave: k } });
            }
            const sl = esObj(o["statusLine"]) ? texto(o["statusLine"]["command"]) : "";
            if (sl)
                emitir({ regla: "comando-ayudante", gravedad: comandoPeligroso(sl) ? "critico" : "aviso", confianza: "estructural", linea: lineaDe(contenido, "\"statusLine\""), fragmento: recorta(sl), seEjecutaSolo: true, datos: { clave: "statusLine" } });
            const auto = o["enableAllProjectMcpServers"] === true || lista(o["enabledMcpjsonServers"]).length > 0;
            if (auto)
                emitir({ regla: "mcp-auto-aprobado", gravedad: "alto", confianza: "estructural", linea: lineaDe(contenido, o["enableAllProjectMcpServers"] === true ? "\"enableAllProjectMcpServers\"" : "\"enabledMcpjsonServers\""), fragmento: o["enableAllProjectMcpServers"] === true ? "enableAllProjectMcpServers: true" : `enabledMcpjsonServers: ${lista(o["enabledMcpjsonServers"]).join(", ")}`, seEjecutaSolo: true });
            servidoresDeJson(o).forEach(s => revisarServidor(s, contenido, emitir));
            break;
        }
        case "mcp": {
            const o = json();
            if (!o)
                break;
            const vscode = /(^|\/)\.vscode\/mcp\.json$/.test(ruta);
            if (vscode && esObj(o["mcpServers"]) && !esObj(o["servers"]))
                emitir({ regla: "mcp-esquema-equivocado", gravedad: "info", confianza: "estructural", linea: lineaDe(contenido, "\"mcpServers\""), fragmento: "mcpServers", datos: { espera: "servers" } });
            if (!vscode && esObj(o["servers"]) && !esObj(o["mcpServers"]))
                emitir({ regla: "mcp-esquema-equivocado", gravedad: "info", confianza: "estructural", linea: lineaDe(contenido, "\"servers\""), fragmento: "servers", datos: { espera: "mcpServers" } });
            servidoresDeJson(o).forEach(s => revisarServidor(s, contenido, emitir));
            break;
        }
        case "gemini-settings": {
            const o = json();
            if (!o)
                break;
            servidoresDeJson(o).forEach(s => revisarServidor(s, contenido, emitir));
            const ft = esObj(o["security"]) && esObj(o["security"]["folderTrust"]) ? o["security"]["folderTrust"]["enabled"] : undefined;
            if (ft === false)
                emitir({ regla: "gemini-sin-confianza", gravedad: "alto", confianza: "estructural", linea: lineaDe(contenido, "\"folderTrust\""), fragmento: "security.folderTrust.enabled: false", seEjecutaSolo: true });
            const permitidas = esObj(o["tools"]) ? lista(o["tools"]["allowed"]) : [];
            const libre = permitidas.find(t => /^run_shell_command$/.test(t.trim()));
            if (libre)
                emitir({ regla: "gemini-shell-libre", gravedad: "alto", confianza: "estructural", linea: lineaDe(contenido, `"${libre}"`), fragmento: libre });
            break;
        }
        case "vscode-settings": {
            const o = json();
            if (!o)
                break;
            if (o["chat.tools.autoApprove"] === true)
                emitir({ regla: "vscode-autoaprobar", gravedad: "critico", confianza: "estructural", linea: lineaDe(contenido, "\"chat.tools.autoApprove\""), fragmento: "\"chat.tools.autoApprove\": true", seEjecutaSolo: true });
            if (o["security.workspace.trust.enabled"] === false)
                emitir({ regla: "vscode-sin-confianza", gravedad: "alto", confianza: "estructural", linea: lineaDe(contenido, "\"security.workspace.trust.enabled\""), fragmento: "\"security.workspace.trust.enabled\": false", seEjecutaSolo: true });
            break;
        }
        case "vscode-tasks": {
            const o = json();
            if (!o)
                break;
            for (const t of Array.isArray(o["tasks"]) ? o["tasks"] : []) {
                if (!esObj(t) || !esObj(t["runOptions"]) || t["runOptions"]["runOn"] !== "folderOpen")
                    continue;
                const cmd = [texto(t["command"]), ...lista(t["args"])].join(" ");
                emitir({ regla: "vscode-tarea-al-abrir", gravedad: comandoPeligroso(cmd) ? "critico" : "alto", confianza: "estructural", linea: lineaDe(contenido, "\"folderOpen\""), fragmento: recorta(`${texto(t["label"])}: ${cmd}`), seEjecutaSolo: true });
            }
            break;
        }
        case "codex-toml":
            revisarCodex(contenido, emitir);
            break;
        case "entorno": {
            const env: Record<string, string> = {};
            for (const m of contenido.matchAll(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*("?)(.*?)\2\s*$/gm))
                env[m[1]] = m[3];
            revisarEnv(env, contenido, emitir, deRepo);
            for (const k of ["CODEX_HOME", "GEMINI_CLI_TRUST_WORKSPACE", "CLAUDE_CONFIG_DIR"]) {
                if (env[k] !== undefined)
                    emitir({ regla: "entorno-desvia-config", gravedad: "alto", confianza: "estructural", linea: lineaDe(contenido, k), fragmento: `${k}=${env[k]}`, seEjecutaSolo: true, datos: { clave: k } });
            }
            break;
        }
        case "skill":
            revisarSkill(ruta, contenido, emitir);
            revisarTexto(contenido, tipo, emitir);
            break;
        case "subagente":
            revisarSubagente(ruta, contenido, emitir);
            revisarTexto(contenido, tipo, emitir);
            break;
        case "script":
            emitir({ regla: "script-empaquetado", gravedad: "info", confianza: "estructural", linea: 1, fragmento: base(ruta) });
            revisarTexto(contenido, tipo, emitir);
            break;
        case "instrucciones":
            revisarTexto(contenido, tipo, emitir);
            break;
        case "desconocido": break;
    }
    hallazgos.sort((a, b) => ORDEN[a.gravedad] - ORDEN[b.gravedad] || a.linea - b.linea);
    return { ruta, tipo, hallazgos };
}
export type PataTrifecta = keyof Trifecta;
export type EtiquetaCapacidad = "ficheros" | "bd" | "red" | "navegador" | "mensajeria" | "repositorio" | "credenciales" | "dinero" | "shell" | "remoto";
export interface CapacidadServidor {
    nombre: string;
    fichero: string;
    etiquetas: EtiquetaCapacidad[];
    patas: PataTrifecta[];
    confianza: "conocido" | "heuristico" | "sin-datos";
    identificado?: string;
}
export interface MapaAccesoMcp {
    servidores: CapacidadServidor[];
    trifecta: Trifecta;
    diagnostico: DiagnosticoTrifecta;
}
interface ServidorConocido {
    patron: RegExp;
    nombre: string;
    etiquetas: EtiquetaCapacidad[];
    patas: PataTrifecta[];
}
const SERVIDORES_CONOCIDOS: ServidorConocido[] = [
    { patron: /server-filesystem/, nombre: "Filesystem", etiquetas: ["ficheros"], patas: ["datosPrivados"] },
    { patron: /server-fetch\b/, nombre: "Fetch", etiquetas: ["red"], patas: ["contenidoNoFiable"] },
    { patron: /mcp-server-git\b/, nombre: "Git", etiquetas: ["repositorio"], patas: ["datosPrivados"] },
    { patron: /server-memory/, nombre: "Memory", etiquetas: [], patas: [] },
    { patron: /server-sequentialthinking/, nombre: "Sequential Thinking", etiquetas: [], patas: [] },
    { patron: /server-time\b/, nombre: "Time", etiquetas: [], patas: [] },
    { patron: /server-everything/, nombre: "Everything (referencia/test)", etiquetas: ["ficheros", "red"], patas: ["datosPrivados", "contenidoNoFiable"] },
    { patron: /server-github/, nombre: "GitHub", etiquetas: ["repositorio", "red"], patas: ["datosPrivados", "canalDeSalida"] },
    { patron: /server-gitlab/, nombre: "GitLab", etiquetas: ["repositorio", "red"], patas: ["datosPrivados", "canalDeSalida"] },
    { patron: /server-slack/, nombre: "Slack", etiquetas: ["mensajeria"], patas: ["canalDeSalida"] },
    { patron: /server-postgres/, nombre: "Postgres", etiquetas: ["bd"], patas: ["datosPrivados"] },
    { patron: /server-redis/, nombre: "Redis", etiquetas: ["bd"], patas: ["datosPrivados"] },
    { patron: /server-puppeteer/, nombre: "Puppeteer", etiquetas: ["navegador", "red"], patas: ["contenidoNoFiable", "canalDeSalida"] },
    { patron: /@playwright\/mcp/, nombre: "Playwright MCP", etiquetas: ["navegador", "red"], patas: ["contenidoNoFiable", "canalDeSalida"] },
    { patron: /server-google-drive/, nombre: "Google Drive", etiquetas: ["ficheros"], patas: ["datosPrivados"] },
    { patron: /server-sentry/, nombre: "Sentry", etiquetas: ["red"], patas: ["datosPrivados"] },
    { patron: /brave-search/, nombre: "Brave Search", etiquetas: ["red"], patas: ["contenidoNoFiable"] },
    { patron: /firebase-tools/, nombre: "Firebase", etiquetas: ["bd", "red"], patas: ["datosPrivados", "canalDeSalida"] },
    { patron: /api\.githubcopilot\.com/, nombre: "GitHub (remoto)", etiquetas: ["repositorio", "red"], patas: ["datosPrivados", "canalDeSalida"] },
    { patron: /mcp\.linear\.app/, nombre: "Linear (remoto)", etiquetas: ["red"], patas: ["datosPrivados", "canalDeSalida"] },
    { patron: /mcp\.context7\.com/, nombre: "Context7 (remoto)", etiquetas: ["red"], patas: ["contenidoNoFiable"] },
    { patron: /mcp\.notion\.com/, nombre: "Notion (remoto)", etiquetas: ["red"], patas: ["datosPrivados", "canalDeSalida"] },
];
const HEURISTICAS_CAPACIDAD: {
    patron: RegExp;
    etiqueta: EtiquetaCapacidad;
    pata: PataTrifecta;
}[] = [
    { patron: /\bfs\b|filesystem|file-?system|\bfiles?\b/i, etiqueta: "ficheros", pata: "datosPrivados" },
    { patron: /fetch|browser|scrape|crawl|web-?search|\bsearch\b/i, etiqueta: "red", pata: "contenidoNoFiable" },
    { patron: /slack|discord|telegram|imessage|whatsapp|signal|gmail|\bemail\b|smtp|webhook|notify|twilio/i, etiqueta: "mensajeria", pata: "canalDeSalida" },
    { patron: /\bgit(hub|lab)?\b/i, etiqueta: "repositorio", pata: "datosPrivados" },
    { patron: /postgres|mysql|mongo|sqlite|redis|database|\bdb\b/i, etiqueta: "bd", pata: "datosPrivados" },
    { patron: /\baws\b|\bgcp\b|azure|stripe|billing|payment|terraform|kubernetes|\bk8s\b/i, etiqueta: "dinero", pata: "canalDeSalida" },
];
function capacidadesDeServidor(s: ServidorMcp, fichero: string): CapacidadServidor {
    const bin = base(s.command).toLowerCase().replace(/\.exe$/, "");
    const linea = [s.command, ...s.args, s.url].filter(Boolean).join(" ");
    const lineaConNombre = `${s.nombre} ${linea}`;
    const etiquetas = new Set<EtiquetaCapacidad>();
    const patas = new Set<PataTrifecta>();
    let confianza: CapacidadServidor["confianza"] = "sin-datos";
    let identificado: string | undefined;
    const conocido = SERVIDORES_CONOCIDOS.find(c => c.patron.test(linea));
    if (conocido) {
        conocido.etiquetas.forEach(e => etiquetas.add(e));
        conocido.patas.forEach(p => patas.add(p));
        confianza = "conocido";
        identificado = conocido.nombre;
    }
    else {
        for (const h of HEURISTICAS_CAPACIDAD) {
            if (h.patron.test(lineaConNombre)) {
                etiquetas.add(h.etiqueta);
                patas.add(h.pata);
                confianza = "heuristico";
                identificado ??= h.etiqueta;
            }
        }
    }
    if (["sh", "bash", "zsh", "cmd", "powershell", "pwsh"].includes(bin) && s.args.some(a => /^(-c|\/c|-Command|-EncodedCommand)$/i.test(a))) {
        etiquetas.add("shell");
        patas.add("datosPrivados");
        patas.add("contenidoNoFiable");
        patas.add("canalDeSalida");
        confianza = "conocido";
        identificado ??= "shell";
    }
    const clavesArgs = s.args.flatMap((a, i) => (/^(-e|--env)$/.test(a) ? /^([A-Za-z_][A-Za-z0-9_]*)=/.exec(s.args[i + 1] ?? "")?.[1] : /^--env=([A-Za-z_][A-Za-z0-9_]*)=/.exec(a)?.[1]) ?? []);
    if ([...Object.keys(s.env), ...clavesArgs].some(k => CLAVE_CREDENCIAL.test(k))) {
        etiquetas.add("credenciales");
        patas.add("datosPrivados");
    }
    if (s.url)
        etiquetas.add("remoto");
    return { nombre: s.nombre, fichero, etiquetas: [...etiquetas], patas: [...patas], confianza, identificado };
}
export function mapaAccesoMcp(ficheros: {
    ruta: string;
    contenido: string;
}[]): MapaAccesoMcp {
    const servidores: CapacidadServidor[] = [];
    for (const f of ficheros) {
        const tipo = tipoDeFichero(f.ruta, f.contenido);
        let lista: ServidorMcp[] = [];
        if (tipo === "mcp" || tipo === "claude-settings" || tipo === "gemini-settings") {
            try {
                const o = parseJsonc(f.contenido);
                if (esObj(o))
                    lista = servidoresDeJson(o);
            }
            catch { }
        }
        else if (tipo === "codex-toml") {
            lista = servidoresDeCodex(f.contenido);
        }
        for (const s of lista)
            servidores.push(capacidadesDeServidor(s, f.ruta));
    }
    const trifecta: Trifecta = {
        datosPrivados: servidores.some(s => s.patas.includes("datosPrivados")),
        contenidoNoFiable: servidores.some(s => s.patas.includes("contenidoNoFiable")),
        canalDeSalida: servidores.some(s => s.patas.includes("canalDeSalida")),
    };
    return { servidores, trifecta, diagnostico: diagnosticarTrifecta(trifecta) };
}
export function auditar(ficheros: {
    ruta: string;
    contenido: string;
}[]): Auditoria {
    const auditados = ficheros.map(f => auditarFichero(f.ruta, f.contenido));
    const vistos = new Map<string, Hallazgo>();
    for (const f of auditados) {
        f.hallazgos = f.hallazgos.filter(h => {
            if (h.regla !== "script-empaquetado")
                return true;
            const skill = /^(.*?\/skills\/[^/]+)\//.exec(h.fichero)?.[1] ?? h.fichero;
            const previo = vistos.get(skill);
            if (!previo) {
                vistos.set(skill, h);
                h.datos = { skill, n: "1" };
                return true;
            }
            previo.datos = { ...previo.datos, n: String(Number(previo.datos?.["n"] ?? 1) + 1) };
            return false;
        });
    }
    const hallazgos = auditados.flatMap(f => f.hallazgos).sort((a, b) => ORDEN[a.gravedad] - ORDEN[b.gravedad]);
    const porGravedad: Record<Gravedad, number> = { critico: 0, alto: 0, aviso: 0, info: 0 };
    for (const h of hallazgos)
        porGravedad[h.gravedad]++;
    return { ficheros: auditados, hallazgos, porGravedad, seEjecutaSolo: hallazgos.filter(h => h.seEjecutaSolo) };
}
