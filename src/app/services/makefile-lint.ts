import { palabras } from "./makefile-expand";
import { MakefileLeido, LineaReceta, ReglaMk } from "./makefile-parse";
import type { ReglaDiagMk, DatosMk } from "./makefile-expand";
export type GravedadLint = "error" | "aviso" | "info";
export type ReglaLintPropia = "objetivo-duplicado" | "phony-no-declarado" | "phony-con-fichero-real" | "receta-larga" | "phony-esperado-ausente" | "shell-en-recursiva" | "cd-no-persiste" | "rm-rf-sobre-variable" | "make-recursivo" | "tuberia-sin-pipefail" | "variable-no-definida" | "sin-delete-on-error";
export type ReglaLint = ReglaLintPropia | ReglaDiagMk;
export interface Hallazgo {
    regla: ReglaLint;
    gravedad: GravedadLint;
    linea: number;
    datos: DatosMk;
}
export interface OpcionesLint {
    ficheros?: readonly string[];
    maxLineasReceta?: number;
    phonyEsperados?: readonly string[];
}
const FUNCIONES = new Set([
    "subst",
    "patsubst",
    "strip",
    "findstring",
    "filter",
    "filter-out",
    "sort",
    "word",
    "words",
    "wordlist",
    "firstword",
    "lastword",
    "dir",
    "notdir",
    "suffix",
    "basename",
    "addsuffix",
    "addprefix",
    "join",
    "wildcard",
    "realpath",
    "abspath",
    "if",
    "or",
    "and",
    "foreach",
    "call",
    "value",
    "origin",
    "flavor",
    "shell",
    "error",
    "warning",
    "info",
    "eval",
    "file",
    "guile",
]);
const AUTOMATICAS = new Set(["@", "<", "^", "?", "*", "+", "|", "%", "@D", "@F", "<D", "<F", "^D", "^F", "*D", "*F"]);
const PHONY_TIPICOS = ["all", "clean", "test", "install", "uninstall", "help", "build", "run", "lint", "fmt", "check", "deploy", "dist"];
function referencias(texto: string): {
    nombre: string;
    cruda: string;
}[] {
    const out: {
        nombre: string;
        cruda: string;
    }[] = [];
    for (let i = 0; i < texto.length; i++) {
        if (texto[i] !== "$")
            continue;
        const sig = texto[i + 1];
        if (sig === undefined)
            break;
        if (sig === "$") {
            i++;
            continue;
        }
        if (sig === "(" || sig === "{") {
            let nivel = 0, fin = -1;
            for (let j = i + 1; j < texto.length; j++) {
                const c = texto[j];
                if (c === "(" || c === "{")
                    nivel++;
                else if (c === ")" || c === "}") {
                    nivel--;
                    if (nivel === 0) {
                        fin = j;
                        break;
                    }
                }
            }
            if (fin < 0)
                break;
            const interior = texto.slice(i + 2, fin);
            out.push({ nombre: interior, cruda: texto.slice(i, fin + 1) });
            i = fin;
            continue;
        }
        out.push({ nombre: sig, cruda: "$" + sig });
        i++;
    }
    return out;
}
function nombreDeVariable(interior: string): string | null {
    const t = interior.trim();
    if (t === "")
        return null;
    const primera = t.split(/\s/)[0];
    if (FUNCIONES.has(primera) && /\s/.test(t))
        return null;
    if (t.includes(":") && t.includes("="))
        return null;
    if (t.includes("$"))
        return null;
    if (!/^[A-Za-z0-9_.@<^?*+|-]+$/.test(t))
        return null;
    return t;
}
function pareceCrearElObjetivo(receta: LineaReceta[]): boolean {
    return receta.some(l => l.texto.includes("$@") ||
        /(^|\s)(-o|--output)(\s|=)/.test(l.texto) ||
        /(^|\s)(tee|mkdir|touch|install)(\s|$)/.test(l.texto));
}
function esFichero(opts: OpcionesLint, ruta: string): boolean {
    return (opts.ficheros ?? []).includes(ruta);
}
export function revisar(mk: MakefileLeido, opts: OpcionesLint = {}): Hallazgo[] {
    const out: Hallazgo[] = [];
    const maxReceta = opts.maxLineasReceta ?? 12;
    const esperados = opts.phonyEsperados ?? ["all", "clean", "test"];
    const nombresConocidos = new Set<string>([...mk.vars.keys()]);
    for (const lista of mk.varsObjetivo.values())
        for (const d of lista)
            nombresConocidos.add(d.nombre);
    for (const d of mk.diags) {
        if (d.gravedad === "error") {
            out.push({ regla: d.regla, gravedad: "error", linea: d.linea, datos: d.datos });
        }
        else if (d.regla === "shell-no-ejecutable" || d.regla === "eval-no-soportado") {
            out.push({ regla: d.regla, gravedad: "info", linea: d.linea, datos: d.datos });
        }
    }
    const conReceta = new Map<string, ReglaMk[]>();
    for (const r of mk.reglas) {
        if (r.receta.length === 0)
            continue;
        for (const t of r.objetivos)
            conReceta.set(t, [...(conReceta.get(t) ?? []), r]);
    }
    for (const [objetivo, reglas] of conReceta) {
        if (reglas.length > 1 && !reglas[0].dobleDosPuntos) {
            out.push({
                regla: "objetivo-duplicado",
                gravedad: "aviso",
                linea: reglas[1].linea,
                datos: { objetivo, primera: reglas[0].linea, segunda: reglas[1].linea },
            });
        }
    }
    for (const r of mk.reglas) {
        if (r.patron)
            continue;
        for (const objetivo of r.objetivos) {
            const declarado = mk.phony.has(objetivo);
            if (!declarado && r.receta.length > 0 && !pareceCrearElObjetivo(r.receta) && PHONY_TIPICOS.includes(objetivo)) {
                out.push({
                    regla: "phony-no-declarado",
                    gravedad: "aviso",
                    linea: r.linea,
                    datos: { objetivo },
                });
            }
            if (declarado && esFichero(opts, objetivo)) {
                out.push({
                    regla: "phony-con-fichero-real",
                    gravedad: "info",
                    linea: r.linea,
                    datos: { objetivo },
                });
            }
            if (r.receta.length > maxReceta) {
                out.push({
                    regla: "receta-larga",
                    gravedad: "info",
                    linea: r.linea,
                    datos: { objetivo, lineas: r.receta.length, max: maxReceta },
                });
            }
        }
    }
    for (const esperado of esperados) {
        if (!mk.reglas.some(r => r.objetivos.includes(esperado))) {
            out.push({
                regla: "phony-esperado-ausente",
                gravedad: "info",
                linea: 0,
                datos: { objetivo: esperado },
            });
        }
    }
    for (const [nombre, def] of mk.vars) {
        if (def.origen !== "fichero")
            continue;
        if (def.sabor === "recursiva" && def.valor.includes("$(shell ")) {
            out.push({
                regla: "shell-en-recursiva",
                gravedad: "aviso",
                linea: def.linea,
                datos: { nombre },
            });
        }
    }
    for (const r of mk.reglas) {
        for (let i = 0; i < r.receta.length; i++) {
            const l = r.receta[i];
            const txt = l.texto;
            if (/^\s*cd\s+\S/.test(txt) && !txt.includes("&&") && i < r.receta.length - 1) {
                out.push({
                    regla: "cd-no-persiste",
                    gravedad: "error",
                    linea: l.linea,
                    datos: {},
                });
            }
            const rm = /\brm\b[^;&|]*?\s(-[a-zA-Z]*[rR][a-zA-Z]*|--recursive)\b/.test(txt) && /\brm\b[^;&|]*?\s(-[a-zA-Z]*f[a-zA-Z]*|--force)\b/.test(txt);
            if (rm) {
                for (const w of palabras(txt)) {
                    const m = /^(\$[({][^)}]+[)}])\/(.*)$/.exec(w);
                    if (!m)
                        continue;
                    out.push({
                        regla: "rm-rf-sobre-variable",
                        gravedad: "error",
                        linea: l.linea,
                        datos: { ruta: w, variable: m[1], resto: m[2] },
                    });
                }
            }
            if (/\$\(MAKE\)|\bmake\s+-C\b/.test(txt)) {
                out.push({
                    regla: "make-recursivo",
                    gravedad: "info",
                    linea: l.linea,
                    datos: {},
                });
            }
            if (txt.includes("|") && !txt.includes("||") && !/pipefail/.test(txt)) {
                const shell = mk.vars.get("SHELL")?.valor ?? "";
                const flags = mk.vars.get(".SHELLFLAGS")?.valor ?? "";
                if (!/pipefail/.test(flags)) {
                    out.push({
                        regla: "tuberia-sin-pipefail",
                        gravedad: "aviso",
                        linea: l.linea,
                        datos: { shell },
                    });
                }
            }
            for (const ref of referencias(txt)) {
                const nombre = nombreDeVariable(ref.nombre);
                if (nombre === null)
                    continue;
                if (AUTOMATICAS.has(nombre) || nombresConocidos.has(nombre))
                    continue;
                const pareceShell = /^[a-z_][a-z0-9_]*$/.test(nombre);
                out.push({
                    regla: "variable-no-definida",
                    gravedad: pareceShell ? "error" : "aviso",
                    linea: l.linea,
                    datos: { referencia: ref.cruda, deShell: pareceShell ? 1 : 0 },
                });
            }
        }
    }
    const hayObjetivosFichero = mk.reglas.some(r => r.receta.length > 0 && r.objetivos.some(t => !mk.phony.has(t)));
    if (hayObjetivosFichero && !mk.especiales.has(".DELETE_ON_ERROR")) {
        out.push({
            regla: "sin-delete-on-error",
            gravedad: "aviso",
            linea: 0,
            datos: {},
        });
    }
    return out.sort((a, b) => a.linea - b.linea || a.regla.localeCompare(b.regla));
}
