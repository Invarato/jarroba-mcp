import * as jsYaml from "js-yaml";
import { PIPE_A_SHELL, HOST_SOSPECHOSO } from "./agente-audit.service";
import { DETECTORS } from "../shared/redact/detectors";
import { imagenSinVersion } from "./k8s-fiabilidad";
export type Gravedad = "critico" | "alto" | "aviso" | "info";
export type Confianza = "estructural" | "indicio";
export type ReglaAccion = "inyeccion-comando" | "inyeccion-script" | "pwn-request" | "accion-sin-pin" | "secreto-literal" | "permisos-totales" | "pipe-a-shell" | "host-sospechoso" | "yaml-invalido" | "checkout-credenciales" | "workflow-run-inseguro" | "github-env-inseguro" | "secretos-heredados" | "secretos-volcados" | "sin-permisos" | "condicion-bot" | "comandos-inseguros" | "imagen-sin-pin" | "condicion-siempre-cierta" | "contains-cadena" | "cache-en-publicacion" | "ofuscacion" | "publicacion-con-token" | "dependabot-ejecucion" | "dependabot-sin-cooldown";
export interface HallazgoAccion {
    regla: ReglaAccion;
    gravedad: Gravedad;
    confianza: Confianza;
    fichero: string;
    linea: number;
    fragmento: string;
    job?: string;
    datos?: Record<string, string>;
}
export interface FicheroAuditadoAccion {
    ruta: string;
    hallazgos: HallazgoAccion[];
}
export interface AuditoriaAcciones {
    ficheros: FicheroAuditadoAccion[];
    hallazgos: HallazgoAccion[];
    porGravedad: Record<Gravedad, number>;
}
const base = (ruta: string) => ruta.split("/").pop() ?? ruta;
const recorta = (s: string, n = 160) => (s.length > n ? s.slice(0, n - 1) + "\u2026" : s);
const esObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x);
const cadena = (x: unknown): string => (typeof x === "string" ? x : "");
function lineaDe(contenido: string, aguja: string, cursor: Map<string, number>): number {
    if (!aguja)
        return 1;
    const i = contenido.indexOf(aguja, cursor.get(aguja) ?? 0);
    if (i < 0)
        return 1;
    cursor.set(aguja, i + 1);
    return contenido.slice(0, i).split("\n").length;
}
function triggersDe(on: unknown): Set<string> {
    if (typeof on === "string")
        return new Set([on]);
    if (Array.isArray(on))
        return new Set(on.filter((x): x is string => typeof x === "string"));
    if (esObj(on))
        return new Set(Object.keys(on));
    return new Set();
}
const SUFIJO_NO_FIABLE = "(?:body|default_branch|email|head_ref|label|message|name|page_name|ref|title)";
const CONTEXTO_NO_FIABLE = new RegExp(`\\$\\{\\{\\s*(github\\.(?:event\\.[\\w.\\[\\]]*\\.${SUFIJO_NO_FIABLE}|head_ref))\\s*\\}\\}`, "g");
const REF_DE_FORK = /\$\{\{\s*github\.event\.pull_request\.head\.(sha|ref)\s*\}\}|refs\/pull\/\$\{\{\s*github\.event\.(pull_request|issue\.pull_request)\.number\s*\}\}\/merge/;
const SECRETOS = DETECTORS.filter(d => d.category === "secret");
const CLAVE_CREDENCIAL = /(token|secret|password|passwd|api[-_]?key|auth|credential)/i;
function pareceSecreto(clave: string, valor: string): boolean {
    if (!valor || /\$\{\{/.test(valor))
        return false;
    if (SECRETOS.some(d => { d.regex.lastIndex = 0; const m = d.regex.exec(valor); return !!m && (!d.validate || d.validate(m[0])); }))
        return true;
    return CLAVE_CREDENCIAL.test(clave) && valor.length >= 12 && !/\s/.test(valor);
}
interface Step {
    name?: unknown;
    uses?: unknown;
    run?: unknown;
    with?: unknown;
    env?: unknown;
    if?: unknown;
}
interface Job {
    permissions?: unknown;
    steps?: unknown;
    uses?: unknown;
    secrets?: unknown;
    env?: unknown;
    if?: unknown;
    container?: unknown;
    services?: unknown;
}
interface Workflow {
    on?: unknown;
    permissions?: unknown;
    jobs?: unknown;
    env?: unknown;
}
const listaSteps = (x: unknown): Step[] => (Array.isArray(x) ? x.filter((v): v is Step => esObj(v)) : []);
type Emitir = (h: Omit<HallazgoAccion, "fichero">) => void;
function revisarComandoPeligroso(texto: string, emitir: Emitir, linea: number, job?: string): void {
    if (PIPE_A_SHELL.some(r => r.test(texto))) {
        emitir({ regla: "pipe-a-shell", gravedad: "alto", confianza: "indicio", linea, fragmento: recorta(texto), job });
    }
    if (HOST_SOSPECHOSO.test(texto)) {
        emitir({ regla: "host-sospechoso", gravedad: "aviso", confianza: "indicio", linea, fragmento: recorta(texto), job });
    }
}
function revisarInterpolaciones(texto: string, regla: "inyeccion-comando" | "inyeccion-script", contenido: string, cursor: Map<string, number>, emitir: Emitir, job?: string): void {
    for (const m of texto.matchAll(CONTEXTO_NO_FIABLE)) {
        emitir({ regla, gravedad: "critico", confianza: "estructural", linea: lineaDe(contenido, m[0], cursor), fragmento: recorta(m[0]), job, datos: { contexto: m[1] } });
    }
}
function revisarEnvOWith(mapa: unknown, contenido: string, cursor: Map<string, number>, emitir: Emitir, job?: string): void {
    if (!esObj(mapa))
        return;
    for (const [k, v] of Object.entries(mapa)) {
        const val = cadena(v);
        if (pareceSecreto(k, val)) {
            emitir({ regla: "secreto-literal", gravedad: "alto", confianza: "estructural", linea: lineaDe(contenido, val, cursor), fragmento: `${k}: ${val.slice(0, 4)}…`, job, datos: { clave: k } });
        }
    }
}
const CON_CACHE: {
    accion: string;
    siempre?: true;
    input?: string;
    porDefecto?: boolean;
    invertido?: true;
}[] = [
    { accion: "actions/cache", siempre: true },
    { accion: "actions/setup-java", input: "cache" },
    { accion: "actions/setup-go", input: "cache", porDefecto: true },
    { accion: "actions/setup-node", input: "cache" },
    { accion: "actions/setup-python", input: "cache" },
    { accion: "actions/setup-dotnet", input: "cache" },
    { accion: "astral-sh/setup-uv", input: "enable-cache" },
    { accion: "Swatinem/rust-cache", siempre: true },
    { accion: "ruby/setup-ruby", input: "bundler-cache" },
    { accion: "mlugg/setup-zig", input: "use-cache", porDefecto: true },
    { accion: "oven-sh/setup-bun", input: "no-cache", invertido: true },
    { accion: "pnpm/setup", input: "cache" },
    { accion: "DeterminateSystems/magic-nix-cache-action", siempre: true },
    { accion: "actions-rust-lang/setup-rust-toolchain", input: "cache", porDefecto: true },
    { accion: "Mozilla-Actions/sccache-action", siempre: true },
    { accion: "nix-community/cache-nix-action", siempre: true },
    { accion: "jdx/mise-action", input: "cache", porDefecto: true },
    { accion: "awalsh128/cache-apt-pkgs-action", siempre: true },
];
const PUBLICAN = [
    "pypa/gh-action-pypi-publish",
    "rubygems/release-gem",
    "jreleaser/release-action",
    "goreleaser/goreleaser-action",
    "softprops/action-gh-release",
    "release-drafter/release-drafter",
    "googleapis/release-please-action",
    "docker/build-push-action",
    "redhat-actions/push-to-registry",
    "aws-actions/amazon-ecs-deploy-task-definition",
    "aws-actions/aws-cloudformation-github-deploy",
    "Azure/aci-deploy",
    "Azure/container-apps-deploy-action",
    "Azure/functions-action",
    "Azure/sql-action",
    "cloudflare/wrangler-action",
    "google-github-actions/deploy-appengine",
    "google-github-actions/deploy-cloudrun",
    "google-github-actions/deploy-cloud-functions",
];
const accionDe = (usa: string) => usa.split("@")[0].toLowerCase();
const esAccion = (usa: string, nombre: string) => accionDe(usa) === nombre.toLowerCase() || accionDe(usa).startsWith(nombre.toLowerCase() + "/");
const verdadero = (v: unknown) => v === true || (typeof v === "string" && /^(true|yes|on|1)$/i.test(v.trim()));
function usaCache(s: Step): boolean {
    const usa = cadena(s.uses);
    const c = CON_CACHE.find(x => esAccion(usa, x.accion));
    if (!c)
        return false;
    if (c.siempre)
        return true;
    const w = esObj(s.with) ? (s.with as Record<string, unknown>) : {};
    const v = w[c.input!];
    if (v === undefined)
        return !!c.porDefecto;
    if (/\$\{\{/.test(String(v)))
        return true;
    const on = typeof v === "boolean" || /^(true|false)$/i.test(String(v).trim()) ? verdadero(v) : String(v).trim() !== "";
    return c.invertido ? !on : on;
}
function esDisparoDeRelease(on: unknown, triggers: Set<string>): boolean {
    if (triggers.has("release"))
        return true;
    const push = esObj(on) ? (on as Record<string, unknown>)["push"] : undefined;
    if (!esObj(push))
        return false;
    const p = push as Record<string, unknown>;
    if (p["tags"] !== undefined)
        return true;
    const ramas = Array.isArray(p["branches"]) ? p["branches"].map(String) : [];
    return ramas.some(r => /^release/i.test(r));
}
const PUBLICA_CMD = /(?:^|[\s;&|(])(?:cargo\s+publish|twine\s+upload|uv\s+publish|uvx?\s+(?:run\s+)?twine\s+upload|poetry\s+publish|hatch\s+publish|pdm\s+publish|gem\s+push|npm\s+publish|pnpm\s+publish|yarn\s+(?:npm\s+)?publish|bun\s+publish)\b(?![^\n]*--dry-run)/;
export function condicionSiempreCierta(cond: unknown): boolean {
    if (typeof cond !== "string" || !cond.includes("${{"))
        return false;
    return cond.replace(/\$\{\{[\s\S]*?\}\}/g, "") !== "";
}
const CONTAINS_CADENA = /contains\(\s*'[^']*'\s*,\s*(?!')[^)]+\)/i;
const CONDICION_BOT = /github\.(?:actor|triggering_actor)\s*==\s*'[^']*\[bot\]'|'[^']*\[bot\]'\s*==\s*github\.(?:actor|triggering_actor)|contains\(\s*github\.(?:actor|triggering_actor)\s*,\s*'\[bot\]'\s*\)/i;
function auditarDependabot(ruta: string, contenido: string, doc: Record<string, unknown>): HallazgoAccion[] {
    const hallazgos: HallazgoAccion[] = [];
    const cursor = new Map<string, number>();
    const updates = Array.isArray(doc["updates"]) ? doc["updates"].filter(esObj) : [];
    for (const u of updates) {
        const eco = cadena(u["package-ecosystem"]) || "?";
        if (cadena(u["insecure-external-code-execution"]).toLowerCase() === "allow") {
            hallazgos.push({ regla: "dependabot-ejecucion", gravedad: "alto", confianza: "estructural", fichero: ruta, linea: lineaDe(contenido, "insecure-external-code-execution", cursor), fragmento: "insecure-external-code-execution: allow", datos: { ecosistema: eco } });
        }
        const cd = esObj(u["cooldown"]) ? (u["cooldown"] as Record<string, unknown>) : null;
        const dias = cd ? Number(cd["default-days"] ?? 0) : 0;
        if (!cd || !(dias >= 7)) {
            hallazgos.push({ regla: "dependabot-sin-cooldown", gravedad: "aviso", confianza: "estructural", fichero: ruta, linea: lineaDe(contenido, eco, cursor), fragmento: cd ? `cooldown: default-days: ${cd["default-days"] ?? "\u2014"}` : `package-ecosystem: ${eco}`, datos: { ecosistema: eco } });
        }
    }
    return hallazgos;
}
function auditarWorkflow(ruta: string, contenido: string): HallazgoAccion[] {
    const hallazgos: HallazgoAccion[] = [];
    const emitir: Emitir = h => hallazgos.push({ ...h, fichero: ruta });
    const cursor = new Map<string, number>();
    let doc: unknown;
    try {
        doc = jsYaml.load(contenido);
    }
    catch {
        emitir({ regla: "yaml-invalido", gravedad: "info", confianza: "estructural", linea: 1, fragmento: base(ruta) });
        return hallazgos;
    }
    if (!esObj(doc))
        return hallazgos;
    if (esRutaDeDependabot(ruta) || (Array.isArray(doc["updates"]) && doc["jobs"] === undefined))
        return auditarDependabot(ruta, contenido, doc);
    const wf = doc as Workflow;
    const triggers = triggersDe(wf.on);
    const conPullRequestTarget = triggers.has("pull_request_target");
    const permisosGlobales = cadena(wf.permissions);
    if (permisosGlobales === "write-all") {
        emitir({ regla: "permisos-totales", gravedad: "alto", confianza: "estructural", linea: lineaDe(contenido, "write-all", cursor), fragmento: "permissions: write-all" });
    }
    const jobs = esObj(wf.jobs) ? wf.jobs : {};
    const cursorZ = new Map<string, number>();
    const disparadorPeligroso = ["pull_request_target", "workflow_run", "issue_comment"].find(t => triggers.has(t));
    if (wf.permissions === undefined && Object.values(jobs).some(j => esObj(j) && (j as Job).permissions === undefined)) {
        emitir({ regla: "sin-permisos", gravedad: "aviso", confianza: "estructural", linea: 1, fragmento: "" });
    }
    for (const m of contenido.matchAll(/toJSON\(\s*secrets\s*\)/gi)) {
        emitir({ regla: "secretos-volcados", gravedad: "alto", confianza: "estructural", linea: lineaDe(contenido, m[0], cursorZ), fragmento: m[0] });
    }
    for (const m of contenido.matchAll(/fromJSON\(\s*toJSON\(|format\(\s*'[^']*'(?:\s*,\s*'[^']*')+\s*\)/gi)) {
        emitir({ regla: "ofuscacion", gravedad: "aviso", confianza: "indicio", linea: lineaDe(contenido, m[0], cursorZ), fragmento: recorta(m[0]) });
    }
    const inseguro = (env: unknown, job?: string) => {
        if (esObj(env) && verdadero((env as Record<string, unknown>)["ACTIONS_ALLOW_UNSECURE_COMMANDS"])) {
            emitir({ regla: "comandos-inseguros", gravedad: "alto", confianza: "estructural", linea: lineaDe(contenido, "ACTIONS_ALLOW_UNSECURE_COMMANDS", cursorZ), fragmento: "ACTIONS_ALLOW_UNSECURE_COMMANDS: true", job });
        }
    };
    inseguro(wf.env);
    const deRelease = esDisparoDeRelease(wf.on, triggers);
    const revisarIf = (cond: unknown, job: string) => {
        if (typeof cond !== "string")
            return;
        if (condicionSiempreCierta(cond)) {
            emitir({ regla: "condicion-siempre-cierta", gravedad: "alto", confianza: "estructural", linea: lineaDe(contenido, cond.trim().split("\n")[0], cursorZ), fragmento: recorta(JSON.stringify(cond)), job });
        }
        const c = CONTAINS_CADENA.exec(cond);
        if (c)
            emitir({ regla: "contains-cadena", gravedad: "aviso", confianza: "estructural", linea: lineaDe(contenido, c[0], cursorZ), fragmento: recorta(c[0]), job });
        const b = CONDICION_BOT.exec(cond);
        if (b) {
            emitir({ regla: "condicion-bot", gravedad: disparadorPeligroso ? "alto" : "aviso", confianza: "estructural", linea: lineaDe(contenido, b[0], cursorZ), fragmento: recorta(b[0]), job, ...(disparadorPeligroso ? { datos: { disparador: disparadorPeligroso } } : {}) });
        }
    };
    for (const [nombreJob, jobRaw] of Object.entries(jobs)) {
        if (!esObj(jobRaw))
            continue;
        const job = jobRaw as Job;
        const steps = listaSteps(job.steps);
        if (cadena(job.uses) && cadena(job.secrets) === "inherit") {
            emitir({ regla: "secretos-heredados", gravedad: "aviso", confianza: "estructural", linea: lineaDe(contenido, "secrets: inherit", cursorZ), fragmento: "secrets: inherit", job: nombreJob });
        }
        inseguro(job.env, nombreJob);
        revisarIf(job.if, nombreJob);
        const imagenes: string[] = [];
        const imagenDe = (x: unknown) => (typeof x === "string" ? x : esObj(x) ? cadena((x as Record<string, unknown>)["image"]) : "");
        if (job.container !== undefined)
            imagenes.push(imagenDe(job.container));
        if (esObj(job.services))
            for (const sv of Object.values(job.services))
                imagenes.push(imagenDe(sv));
        for (const img of imagenes) {
            if (img && !/\$\{\{/.test(img) && imagenSinVersion(img)) {
                emitir({ regla: "imagen-sin-pin", gravedad: "aviso", confianza: "estructural", linea: lineaDe(contenido, img, cursorZ), fragmento: img, job: nombreJob });
            }
        }
        const publica = deRelease || steps.some(s => PUBLICAN.some(a => esAccion(cadena(s.uses), a)));
        if (publica)
            for (const s of steps.filter(usaCache)) {
                const usa = cadena(s.uses);
                emitir({ regla: "cache-en-publicacion", gravedad: "alto", confianza: "indicio", linea: lineaDe(contenido, usa, cursorZ), fragmento: usa, job: nombreJob });
            }
        const subeArtefactos = steps.some(s => /^actions\/upload-artifact(@|$)/.test(cadena(s.uses)));
        let traeCodigoDelRun = false;
        for (const s of steps) {
            const usa = cadena(s.uses);
            const conWith = esObj(s.with) ? (s.with as Record<string, unknown>) : {};
            if (/^actions\/checkout(@|$)/.test(usa) && conWith["persist-credentials"] !== false && conWith["persist-credentials"] !== "false") {
                emitir({ regla: "checkout-credenciales", gravedad: subeArtefactos ? "aviso" : "info", confianza: "estructural", linea: lineaDe(contenido, usa, cursorZ), fragmento: usa, job: nombreJob });
            }
            if (/^actions\/checkout(@|$)/.test(usa) && /github\.event\.workflow_run\.head_/.test(JSON.stringify(conWith)))
                traeCodigoDelRun = true;
            if (/download-artifact(@|$)/.test(usa))
                traeCodigoDelRun = true;
            const run = cadena(s.run);
            const esc = /GITHUB_(ENV|PATH)\b/.exec(run);
            if (disparadorPeligroso && esc && />>/.test(run)) {
                const linea = run.split("\n").find(l => /GITHUB_(ENV|PATH)\b/.test(l)) ?? esc[0];
                emitir({ regla: "github-env-inseguro", gravedad: "alto", confianza: "indicio", linea: lineaDe(contenido, linea.trim(), cursorZ), fragmento: recorta(linea.trim()), job: nombreJob, datos: { disparador: disparadorPeligroso } });
            }
        }
        if (triggers.has("workflow_run") && traeCodigoDelRun) {
            emitir({ regla: "workflow-run-inseguro", gravedad: "alto", confianza: "estructural", linea: lineaDe(contenido, "workflow_run", cursorZ), fragmento: "workflow_run", job: nombreJob });
        }
        let hayCheckoutDeFork = false;
        for (const s of steps) {
            const usa = cadena(s.uses);
            const conFork = REF_DE_FORK.test(JSON.stringify(s.with ?? {}));
            if (/^actions\/checkout(@|$)/.test(usa) && conFork)
                hayCheckoutDeFork = true;
            const m = /^([^@\s]+)@([^\s]+)$/.exec(usa);
            if (m && !/^[0-9a-f]{40}$/i.test(m[2]) && !usa.startsWith("./") && !usa.startsWith("docker://")) {
                emitir({ regla: "accion-sin-pin", gravedad: "aviso", confianza: "estructural", linea: lineaDe(contenido, usa, cursor), fragmento: usa, job: nombreJob, datos: { accion: m[1], ref: m[2] } });
            }
            inseguro(s.env, nombreJob);
            revisarIf(s.if, nombreJob);
            const rutaUses = usa.split("@")[0];
            if (usa && !usa.startsWith("docker://") && /\/\/|(^|\/)\.\.?(\/|$)/.test(rutaUses.replace(/^\.\//, ""))) {
                emitir({ regla: "ofuscacion", gravedad: "aviso", confianza: "estructural", linea: lineaDe(contenido, usa, cursorZ), fragmento: usa, job: nombreJob });
            }
            const conToken = /\$\{\{\s*secrets\./.test(JSON.stringify([s.env ?? {}, s.with ?? {}, job.env ?? {}, wf.env ?? {}]));
            const w = esObj(s.with) ? (s.with as Record<string, unknown>) : {};
            if ((esAccion(usa, "pypa/gh-action-pypi-publish") && w["password"] !== undefined) || (PUBLICA_CMD.test(cadena(s.run)) && conToken)) {
                const frag = usa || (PUBLICA_CMD.exec(cadena(s.run))?.[0].trim() ?? "");
                emitir({ regla: "publicacion-con-token", gravedad: "info", confianza: "indicio", linea: lineaDe(contenido, frag, cursorZ), fragmento: recorta(frag), job: nombreJob });
            }
            revisarEnvOWith(s.env, contenido, cursor, emitir, nombreJob);
            revisarEnvOWith(s.with, contenido, cursor, emitir, nombreJob);
            const run = cadena(s.run);
            if (run) {
                revisarInterpolaciones(run, "inyeccion-comando", contenido, cursor, emitir, nombreJob);
                revisarComandoPeligroso(run, emitir, lineaDe(contenido, run.split("\n")[0], cursor), nombreJob);
            }
            if (/^actions\/github-script(@|$)/.test(usa) && esObj(s.with)) {
                const script = cadena((s.with as Record<string, unknown>)["script"]);
                if (script)
                    revisarInterpolaciones(script, "inyeccion-script", contenido, cursor, emitir, nombreJob);
            }
        }
        if (conPullRequestTarget && hayCheckoutDeFork) {
            emitir({
                regla: "pwn-request",
                gravedad: "critico",
                confianza: "estructural",
                linea: lineaDe(contenido, "pull_request_target", cursor),
                fragmento: "pull_request_target",
                job: nombreJob,
            });
        }
    }
    return hallazgos;
}
const ORDEN: Record<Gravedad, number> = { critico: 0, alto: 1, aviso: 2, info: 3 };
export function esRutaDeDependabot(ruta: string): boolean {
    return /(^|\/)\.github\/dependabot\.ya?ml$/.test(ruta.replace(/\\/g, "/"));
}
export function esRutaDeWorkflow(ruta: string): boolean {
    return /(^|\/)\.github\/workflows\/[^/]+\.ya?ml$/.test(ruta.replace(/\\/g, "/"));
}
export function auditarAcciones(ficheros: {
    ruta: string;
    contenido: string;
}[]): AuditoriaAcciones {
    const ficherosAuditados: FicheroAuditadoAccion[] = ficheros.map(f => ({
        ruta: f.ruta,
        hallazgos: auditarWorkflow(f.ruta, f.contenido).sort((a, b) => ORDEN[a.gravedad] - ORDEN[b.gravedad] || a.linea - b.linea),
    }));
    const hallazgos = ficherosAuditados.flatMap(f => f.hallazgos).sort((a, b) => ORDEN[a.gravedad] - ORDEN[b.gravedad]);
    const porGravedad: Record<Gravedad, number> = { critico: 0, alto: 0, aviso: 0, info: 0 };
    for (const h of hallazgos)
        porGravedad[h.gravedad]++;
    return { ficheros: ficherosAuditados, hallazgos, porGravedad };
}
