import { DefVar, TablaVars, expandir } from "./makefile-expand";
import { MakefileLeido, ReglaMk, LineaReceta } from "./makefile-parse";
export type Rol = "fichero" | "accion" | "dudoso";
export interface Senal {
    hacia: Rol;
    texto: string;
    decisiva: boolean;
}
export interface ObjetivoClasificado {
    nombre: string;
    rol: Rol;
    linea: number;
    senales: Senal[];
    dependencias: string[];
    fuentes: string[];
    receta: LineaReceta[];
    patron: boolean;
}
export type Veredicto = "lanzador" | "build" | "mixto" | "vacio";
export interface Diagnostico {
    objetivos: ObjetivoClasificado[];
    ficheros: number;
    acciones: number;
    dudosos: number;
    veredicto: Veredicto;
    sePierde: string[];
    noFiable: boolean;
}
const EXT_ARTEFACTO = /\.(o|a|so|dylib|dll|exe|out|bin|elf|hex|tar|gz|tgz|bz2|xz|zip|jar|war|whl|deb|rpm|img|iso|pdf|html|css|js|mjs|cjs|map|min|lock|d|mo|po|pot|class|pyc|wasm)$/i;
const VERBOS = new Set([
    "all",
    "clean",
    "distclean",
    "mrproper",
    "purge",
    "test",
    "tests",
    "check",
    "install",
    "uninstall",
    "reinstall",
    "help",
    "usage",
    "run",
    "start",
    "stop",
    "restart",
    "lint",
    "fmt",
    "format",
    "vet",
    "deploy",
    "release",
    "publish",
    "docs",
    "doc",
    "dev",
    "serve",
    "watch",
    "setup",
    "init",
    "bootstrap",
    "deps",
    "update",
    "upgrade",
    "bench",
    "coverage",
    "ci",
    "push",
    "pull",
    "up",
    "down",
    "logs",
    "shell",
    "exec",
    "build",
    "rebuild",
    "compile",
    "package",
    "dist",
    "tag",
    "version",
    "audit",
    "migrate",
    "seed",
    "generate",
    "gen",
    "proto",
    "mock",
    "e2e",
    "integration",
    "unit",
    "smoke",
    "debug",
    "profile",
    "image",
    "container",
    "apply",
    "destroy",
    "plan",
    "fix",
    "verify",
    "validate",
    "typecheck",
    "todo",
]);
const AUTO_DE_FICHERO = /\$[@<^]|\$\{[@<^]\}|\$\([@<^]\)/;
function recetaCreaElObjetivo(nombre: string, receta: readonly LineaReceta[], expandirLinea: (t: string) => string): string | null {
    const escapado = nombre.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    for (const l of receta) {
        if (AUTO_DE_FICHERO.test(l.texto))
            return "$@ / $< / $^: la receta trabaja con el objetivo como fichero";
        const texto = expandirLinea(l.texto);
        if (new RegExp(`(^|\\s)(-o|--output|>|>>)\\s*${escapado}(\\s|$)`).test(texto)) {
            return `la receta escribe en \`${nombre}\``;
        }
        if (new RegExp(`(^|\\s)(mkdir|touch|tee|install)\\b[^;&|]*\\s${escapado}(\\s|/|$)`).test(texto)) {
            return `la receta crea \`${nombre}\``;
        }
    }
    return null;
}
function reglasPorObjetivo(mk: MakefileLeido): Map<string, {
    regla: ReglaMk;
    reqs: string[];
    orden: string[];
}> {
    const out = new Map<string, {
        regla: ReglaMk;
        reqs: string[];
        orden: string[];
    }>();
    for (const r of mk.reglas) {
        for (const obj of r.objetivos) {
            if (obj.startsWith(".") && !r.patron)
                continue;
            const ya = out.get(obj);
            if (!ya) {
                out.set(obj, { regla: r, reqs: [...r.requisitos], orden: [...r.soloOrden] });
                continue;
            }
            for (const q of r.requisitos)
                if (!ya.reqs.includes(q))
                    ya.reqs.push(q);
            for (const q of r.soloOrden)
                if (!ya.orden.includes(q))
                    ya.orden.push(q);
            if (ya.regla.receta.length === 0 && r.receta.length > 0)
                ya.regla = r;
        }
    }
    return out;
}
export interface OpcionesRol {
    ficheros?: readonly string[];
}
export function diagnosticar(mk: MakefileLeido, opts: OpcionesRol = {}): Diagnostico {
    const enDisco = new Set(opts.ficheros ?? []);
    const porObjetivo = reglasPorObjetivo(mk);
    const nombresConReceta = new Set([...porObjetivo.entries()].filter(([, v]) => v.regla.receta.length > 0).map(([k]) => k));
    const objetivos: ObjetivoClasificado[] = [];
    for (const [nombre, { regla, reqs }] of porObjetivo) {
        const senales: Senal[] = [];
        let rol: Rol | null = null;
        const decide = (r: Rol, texto: string) => {
            senales.push({ hacia: r, texto, decisiva: rol === null });
            if (rol === null)
                rol = r;
        };
        if (regla.patron)
            decide("fichero", "es una regla de patr\u00F3n: existe para producir ficheros");
        if (mk.phony.has(nombre))
            decide("accion", "declarado en `.PHONY` por el propio autor");
        if (nombre.includes("/"))
            decide("fichero", "el nombre lleva una ruta");
        if (EXT_ARTEFACTO.test(nombre))
            decide("fichero", "el nombre tiene extensi\u00F3n de artefacto");
        const expandirLinea = (t: string) => {
            try {
                return expandir(t, { vars: mk.vars, ficheros: opts.ficheros });
            }
            catch {
                return t;
            }
        };
        const crea = recetaCreaElObjetivo(nombre, regla.receta, expandirLinea);
        if (crea)
            decide("fichero", crea);
        if (enDisco.has(nombre))
            decide("fichero", "ya existe un fichero con ese nombre en el proyecto");
        if (nombre.split(/[-_.]/).some(t => VERBOS.has(t.toLowerCase()))) {
            decide("accion", "el nombre es un verbo, no un producto");
        }
        if (rol === null && regla.receta.length === 0 && reqs.length > 0) {
            decide("accion", "no tiene receta: solo agrupa otros objetivos");
        }
        objetivos.push({
            nombre,
            rol: rol ?? "dudoso",
            linea: regla.linea,
            senales,
            dependencias: reqs.filter(q => nombresConReceta.has(q) || porObjetivo.has(q)),
            fuentes: reqs.filter(q => !porObjetivo.has(q)),
            receta: regla.receta,
            patron: regla.patron,
        });
    }
    objetivos.sort((a, b) => a.linea - b.linea || a.nombre.localeCompare(b.nombre));
    const ficheros = objetivos.filter(o => o.rol === "fichero").length;
    const acciones = objetivos.filter(o => o.rol === "accion").length;
    const dudosos = objetivos.filter(o => o.rol === "dudoso").length;
    let veredicto: Veredicto = "vacio";
    if (objetivos.length > 0) {
        if (ficheros === 0)
            veredicto = "lanzador";
        else if (acciones === 0)
            veredicto = "build";
        else
            veredicto = "mixto";
    }
    return { objetivos, ficheros, acciones, dudosos, veredicto, sePierde: quePierdes(mk, objetivos), noFiable: mk.noFiable };
}
function quePierdes(mk: MakefileLeido, objetivos: readonly ObjetivoClasificado[]): string[] {
    const out: string[] = [];
    const patrones = objetivos.filter(o => o.patron).length;
    const conFuentes = objetivos.filter(o => o.rol === "fichero" && o.fuentes.length > 0).length;
    if (patrones > 0) {
        out.push(`${patrones} regla${patrones > 1 ? "s" : ""} de patrón (\`%.o: %.c\`): ni just ni npm tienen nada equivalente.`);
    }
    if (conFuentes > 0) {
        out.push(`${conFuentes} objetivo${conFuentes > 1 ? "s" : ""} de fichero con fuentes: hoy se saltan si nada cambió.`);
    }
    const soloOrden = mk.reglas.filter(r => r.soloOrden.length > 0).length;
    if (soloOrden > 0) {
        out.push(`${soloOrden} requisito${soloOrden > 1 ? "s" : ""} de solo orden (con \`|\`): tienen que existir pero no fuerzan reconstrucción.`);
    }
    if (mk.reglas.some(r => r.receta.some(l => /\$\(MAKE\)|\bmake\b/.test(l.texto)))) {
        out.push("Hay make recursivo (`$(MAKE) -C \u2026`): la conversi\u00F3n no baja a los subdirectorios.");
    }
    if (out.length === 0) {
        out.push("Nada medible: este fichero no usa fechas, ni grafo, ni patrones. Es la definici\u00F3n de lanzador.");
    }
    return out;
}
export type Destino = "just" | "task" | "npm";
export interface Omitido {
    nombre: string;
    porque: string;
}
export interface Conversion {
    destino: Destino;
    nombreFichero: string;
    texto: string;
    convertidos: string[];
    omitidos: Omitido[];
    avisos: string[];
}
const CICLO_NPM = new Set([
    "preinstall",
    "install",
    "postinstall",
    "prepublish",
    "prepublishOnly",
    "prepare",
    "prepack",
    "pack",
    "postpack",
    "publish",
    "postpublish",
    "start",
    "stop",
    "restart",
    "test",
    "version",
]);
const NOMBRE_JUST = /^[a-zA-Z_][a-zA-Z0-9_-]*$/;
interface CtxTraduce {
    destino: Destino;
    objetivo: string;
    fuentes: readonly string[];
    vars: TablaVars;
    usadas: Set<string>;
    avisos: Set<string>;
}
function refVar(nombre: string, ctx: CtxTraduce): string {
    ctx.usadas.add(nombre);
    const limpio = nombre.replace(/[^A-Za-z0-9_]/g, "_");
    if (limpio !== nombre)
        ctx.avisos.add(`La variable \`${nombre}\` se ha renombrado a \`${limpio}\`: el destino no admite ese carácter.`);
    return ctx.destino === "task" ? `{{.${limpio}}}` : `{{${limpio}}}`;
}
function traducirLinea(texto: string, ctx: CtxTraduce): string | null {
    let out = "";
    for (let i = 0; i < texto.length; i++) {
        const c = texto[i];
        if (c === "{" && texto[i + 1] === "{" && ctx.destino !== "npm") {
            out += ctx.destino === "just" ? "{{{{" : "{{\"{{\"}}";
            ctx.avisos.add("Hab\u00EDa `{{\u2026}}` en una receta (un `--format` de docker o kubectl, casi seguro). Se ha escapado: en just y en task esas llaves son interpolaci\u00F3n.");
            i++;
            continue;
        }
        if (c !== "$") {
            out += c;
            continue;
        }
        const sig = texto[i + 1];
        if (sig === undefined) {
            out += c;
            continue;
        }
        if (sig === "$") {
            out += "$";
            i++;
            continue;
        }
        if (sig === "(" || sig === "{") {
            const cierre = sig === "(" ? ")" : "}";
            let nivel = 0, fin = -1;
            for (let j = i + 1; j < texto.length; j++) {
                if (texto[j] === sig)
                    nivel++;
                else if (texto[j] === cierre) {
                    nivel--;
                    if (nivel === 0) {
                        fin = j;
                        break;
                    }
                }
            }
            if (fin < 0) {
                out += c;
                continue;
            }
            const interior = texto.slice(i + 2, fin);
            i = fin;
            const auto = automatica(interior, ctx);
            if (auto !== undefined) {
                if (auto === null)
                    return null;
                out += auto;
                continue;
            }
            if (!/^[A-Za-z_][A-Za-z0-9_.-]*$/.test(interior))
                return null;
            out += ctx.destino === "npm" ? valorLiteral(interior, ctx) : refVar(interior, ctx);
            continue;
        }
        const auto = automatica(sig, ctx);
        if (auto !== undefined) {
            if (auto === null)
                return null;
            out += auto;
            i++;
            continue;
        }
        out += ctx.destino === "npm" ? valorLiteral(sig, ctx) : refVar(sig, ctx);
        i++;
    }
    return out;
}
function automatica(nombre: string, ctx: CtxTraduce): string | null | undefined {
    if (nombre === "@")
        return ctx.objetivo;
    if (nombre === "<")
        return ctx.fuentes[0] ?? "";
    if (nombre === "^" || nombre === "+")
        return ctx.fuentes.join(" ");
    if (["?", "*", "|", "@D", "@F", "<D", "<F", "^D", "^F", "*D", "*F"].includes(nombre))
        return null;
    return undefined;
}
function valorLiteral(nombre: string, ctx: CtxTraduce): string {
    const def = ctx.vars.get(nombre);
    if (!def)
        return "";
    const cmd = comandoShell(def);
    if (cmd) {
        ctx.avisos.add(`\`${nombre}\` venía de un \`$(shell …)\`: se ha traducido a la sustitución de comandos del shell, que en un script de npm hace lo mismo.`);
        return `$(${cmd})`;
    }
    ctx.avisos.add(`Los scripts de npm no tienen variables: los valores (\`${nombre}\`…) se han escrito ya resueltos, así que no se pueden cambiar desde la línea de órdenes.`);
    return def.sabor === "simple" ? def.valor : expandir(def.valor, { vars: ctx.vars });
}
export function convertir(mk: MakefileLeido, diag: Diagnostico, destino: Destino): Conversion {
    const convertidos: string[] = [];
    const omitidos: Omitido[] = [];
    const avisos = new Set<string>();
    const usadas = new Set<string>();
    interface Listo {
        nombre: string;
        alias: string;
        obj: ObjetivoClasificado;
        lineas: string[];
    }
    const listos: Listo[] = [];
    for (const o of diag.objetivos) {
        if (o.patron) {
            omitidos.push({ nombre: o.nombre, porque: "es una regla de patr\u00F3n: el destino no tiene ese concepto" });
            continue;
        }
        if (o.rol === "fichero" && destino !== "task") {
            omitidos.push({ nombre: o.nombre, porque: "es un objetivo de fichero: sin fechas se reconstruir\u00EDa siempre, y eso es justo lo que hoy te ahorra make" });
            continue;
        }
        let alias = o.nombre;
        if (destino === "just" && !NOMBRE_JUST.test(alias)) {
            alias = alias.replace(/[^a-zA-Z0-9_-]/g, "-");
            if (!NOMBRE_JUST.test(alias)) {
                omitidos.push({ nombre: o.nombre, porque: "el nombre no vale como receta de just" });
                continue;
            }
            avisos.add(`\`${o.nombre}\` se ha renombrado a \`${alias}\`: just no admite ese nombre.`);
        }
        if (destino === "npm" && CICLO_NPM.has(alias)) {
            avisos.add(`\`${alias}\` es un nombre del ciclo de vida de npm: npm lo ejecutará él solo (\`npm ${alias}\`, y algunos hasta en cada \`npm install\`). Renómbralo si no quieres eso.`);
        }
        const ctx: CtxTraduce = { destino, objetivo: o.nombre, fuentes: o.fuentes, vars: mk.vars, usadas, avisos };
        const lineas: string[] = [];
        let roto: string | null = null;
        for (const l of o.receta) {
            const t = traducirLinea(l.texto, ctx);
            if (t === null) {
                roto = `la receta usa una variable automática o una función de make sin equivalente (línea ${l.linea})`;
                break;
            }
            lineas.push(prefijos(t, l, destino, avisos));
        }
        if (roto) {
            omitidos.push({ nombre: o.nombre, porque: roto });
            continue;
        }
        listos.push({ nombre: o.nombre, alias, obj: o, lineas });
        convertidos.push(o.nombre);
    }
    for (let cambio = true; cambio;) {
        cambio = false;
        const vivos = new Set(listos.map(l => l.nombre));
        for (let i = listos.length - 1; i >= 0; i--) {
            const caido = listos[i].obj.dependencias.find(d => !vivos.has(d));
            if (caido === undefined)
                continue;
            omitidos.push({ nombre: listos[i].nombre, porque: `depende de \`${caido}\`, que tampoco se ha podido convertir: traducirlo dejaría una receta que no hace nada y no falla` });
            listos.splice(i, 1);
            cambio = true;
        }
    }
    convertidos.length = 0;
    convertidos.push(...listos.map(l => l.nombre));
    const alias = new Map(listos.map(l => [l.nombre, l.alias]));
    const texto = destino === "just" ? escribirJust(mk, listos, alias, usadas, avisos)
        : destino === "task" ? escribirTask(mk, listos, alias, usadas, avisos)
            : escribirNpm(listos, alias, avisos);
    return {
        destino,
        nombreFichero: destino === "just" ? "justfile" : destino === "task" ? "Taskfile.yml" : "package.json (scripts)",
        texto,
        convertidos,
        omitidos,
        avisos: [...avisos],
    };
}
function prefijos(texto: string, l: LineaReceta, destino: Destino, avisos: Set<string>): string {
    if (destino === "just")
        return (l.ignoraError ? "-" : "") + (l.silenciosa ? "@" : "") + texto;
    if (destino === "npm") {
        if (l.silenciosa)
            avisos.add("Los scripts de npm imprimen siempre lo que ejecutan: el `@` de las recetas calladas no tiene equivalente.");
        return l.ignoraError ? `{ ${texto} ; } || true` : texto;
    }
    return texto;
}
function citarJust(v: string): string {
    return `'${v.replace(/'/g, "'\\''")}'`;
}
function comandoShell(def: DefVar): string | null {
    const crudo = (def.crudo ?? "").trim();
    const m = /^\$\((?:shell)\s+([\s\S]+)\)$/.exec(crudo);
    if (!m)
        return null;
    const cmd = m[1].trim();
    return cmd.includes("$(") || cmd.includes("${") ? null : cmd;
}
function escribirJust(mk: MakefileLeido, listos: {
    nombre: string;
    alias: string;
    obj: ObjetivoClasificado;
    lineas: string[];
}[], alias: Map<string, string>, usadas: Set<string>, avisos: Set<string>): string {
    const out: string[] = ["# Generado desde un Makefile por Jarroba Tools \u00B7 /project", ""];
    for (const nombre of usadas) {
        const def = mk.vars.get(nombre);
        if (!def)
            continue;
        const limpio = nombre.replace(/[^A-Za-z0-9_]/g, "_");
        const cmd = comandoShell(def);
        out.push(cmd
            ? `${limpio} := \`${cmd}\``
            : `${limpio} := ${citarJust(def.sabor === "simple" ? def.valor : expandir(def.valor, { vars: mk.vars }))}`);
    }
    if (usadas.size > 0)
        out.push("");
    if (listos.length > 0)
        out.push("default:", `    @just --list`, "");
    for (const l of listos) {
        const deps = l.obj.dependencias.map(d => alias.get(d)).filter((d): d is string => !!d);
        out.push(`${l.alias}:${deps.length ? " " + deps.join(" ") : ""}`);
        if (l.lineas.length === 0)
            out.push("    @true");
        for (const linea of l.lineas)
            out.push("    " + linea);
        out.push("");
    }
    if (listos.some(l => l.lineas.length > 1)) {
        avisos.add("Como en make, cada l\u00EDnea de una receta de just corre en SU shell: un `cd` no llega a la l\u00EDnea siguiente. Si lo necesitas, pon la receta con shebang (`#!/usr/bin/env bash`).");
    }
    return out.join("\n").replace(/\n+$/, "\n");
}
function citarYaml(v: string): string {
    return `'${v.replace(/'/g, "''")}'`;
}
function escribirTask(mk: MakefileLeido, listos: {
    nombre: string;
    alias: string;
    obj: ObjetivoClasificado;
    lineas: string[];
}[], alias: Map<string, string>, usadas: Set<string>, avisos: Set<string>): string {
    const out: string[] = ["version: '3'", "", "# Generado desde un Makefile por Jarroba Tools \u00B7 /project"];
    if (usadas.size > 0) {
        out.push("", "vars:");
        for (const nombre of usadas) {
            const def = mk.vars.get(nombre);
            if (!def)
                continue;
            const limpio = nombre.replace(/[^A-Za-z0-9_]/g, "_");
            const cmd = comandoShell(def);
            out.push(cmd
                ? `  ${limpio}:\n    sh: ${citarYaml(cmd)}`
                : `  ${limpio}: ${citarYaml(def.sabor === "simple" ? def.valor : expandir(def.valor, { vars: mk.vars }))}`);
        }
    }
    out.push("", "tasks:");
    for (const l of listos) {
        out.push(`  ${l.alias}:`);
        if (l.obj.rol === "fichero") {
            if (l.obj.fuentes.length)
                out.push(`    sources: [${l.obj.fuentes.map(citarYaml).join(", ")}]`);
            out.push(`    generates: [${citarYaml(l.nombre)}]`);
        }
        const deps = l.obj.dependencias.map(d => alias.get(d)).filter((d): d is string => !!d);
        if (l.obj.receta.every(r => r.silenciosa) && l.obj.receta.length > 0)
            out.push("    silent: true");
        out.push("    cmds:");
        for (const d of deps)
            out.push(`      - task: ${d}`);
        l.obj.receta.forEach((r, i) => {
            const linea = l.lineas[i];
            if (linea === undefined)
                return;
            if (r.ignoraError) {
                out.push(`      - cmd: ${citarYaml(linea)}`, "        ignore_error: true");
            }
            else
                out.push(`      - ${citarYaml(linea)}`);
        });
        if (deps.length === 0 && l.lineas.length === 0)
            out.push("      - \"true\"");
    }
    if (listos.some(l => l.obj.dependencias.length > 0)) {
        avisos.add("Las dependencias se han puesto como `- task:` dentro de `cmds`, no en `deps`: `deps` corre en PARALELO y los requisitos de make, sin `-j`, van en orden.");
    }
    return out.join("\n") + "\n";
}
function escribirNpm(listos: {
    nombre: string;
    alias: string;
    obj: ObjetivoClasificado;
    lineas: string[];
}[], alias: Map<string, string>, avisos: Set<string>): string {
    const pares: string[] = [];
    for (const l of listos) {
        const deps = l.obj.dependencias.map(d => alias.get(d)).filter((d): d is string => !!d).map(d => `npm run ${d}`);
        const cuerpo = [...deps, ...l.lineas].join(" && ");
        pares.push(`    ${JSON.stringify(l.alias)}: ${JSON.stringify(cuerpo || "true")}`);
    }
    if (listos.some(l => l.lineas.length > 1)) {
        avisos.add("Las l\u00EDneas de cada receta se han unido con `&&`, as\u00ED que aqu\u00ED S\u00CD comparten shell: un `cd` ahora s\u00ED llega a la siguiente. Es distinto de make, y a veces es lo que quer\u00EDas.");
    }
    return ["  \"scripts\": {", pares.join(",\n"), "  }"].join("\n") + "\n";
}
