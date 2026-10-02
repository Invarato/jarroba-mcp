import * as jsYaml from "js-yaml";
import { PIPE_A_SHELL, HOST_SOSPECHOSO } from "./agente-audit.service";
import { DETECTORS } from "../shared/redact/detectors";
export type Gravedad = "critico" | "alto" | "aviso" | "info";
export type Confianza = "estructural" | "indicio";
export type ReglaAccion = "inyeccion-comando" | "inyeccion-script" | "pwn-request" | "accion-sin-pin" | "secreto-literal" | "permisos-totales" | "pipe-a-shell" | "host-sospechoso" | "yaml-invalido" | "checkout-credenciales" | "workflow-run-inseguro" | "github-env-inseguro" | "secretos-heredados" | "secretos-volcados" | "sin-permisos";
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
}
interface Job {
    permissions?: unknown;
    steps?: unknown;
    uses?: unknown;
    secrets?: unknown;
}
interface Workflow {
    on?: unknown;
    permissions?: unknown;
    jobs?: unknown;
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
    for (const [nombreJob, jobRaw] of Object.entries(jobs)) {
        if (!esObj(jobRaw))
            continue;
        const job = jobRaw as Job;
        const steps = listaSteps(job.steps);
        if (cadena(job.uses) && cadena(job.secrets) === "inherit") {
            emitir({ regla: "secretos-heredados", gravedad: "aviso", confianza: "estructural", linea: lineaDe(contenido, "secrets: inherit", cursorZ), fragmento: "secrets: inherit", job: nombreJob });
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
