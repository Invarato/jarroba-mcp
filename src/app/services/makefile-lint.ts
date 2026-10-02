import { palabras } from "./makefile-expand";
import { MakefileLeido, LineaReceta, ReglaMk } from "./makefile-parse";
export type GravedadLint = "error" | "aviso" | "info";
export interface Hallazgo {
    regla: string;
    gravedad: GravedadLint;
    linea: number;
    que: string;
    como: string;
    arreglo: string;
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
        if (d.regla === "receta-con-espacios") {
            out.push({
                regla: d.regla,
                gravedad: "error",
                linea: d.linea,
                que: "Receta indentada con espacios en vez de un tabulador.",
                como: "make responde `*** missing separator. Stop.` y no dice nada m\u00E1s. Los dos ficheros se ven IGUAL en pantalla, que es lo que hace que este fallo cueste tanto.",
                arreglo: "Sustituye los espacios del principio de la l\u00EDnea por un tabulador.",
            });
        }
        else if (d.gravedad === "error") {
            out.push({
                regla: d.regla,
                gravedad: "error",
                linea: d.linea,
                que: d.mensaje,
                como: "make aborta la lectura del fichero.",
                arreglo: "Corrige la l\u00EDnea se\u00F1alada.",
            });
        }
        else if (d.regla === "shell-no-ejecutable" || d.regla === "eval-no-soportado") {
            out.push({
                regla: d.regla,
                gravedad: "info",
                linea: d.linea,
                que: d.mensaje,
                como: "No es un fallo de tu Makefile: es un l\u00EDmite de simular en el navegador.",
                arreglo: "Dale el valor a mano si quieres que la simulaci\u00F3n cuente con \u00E9l.",
            });
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
                que: "El objetivo `" + objetivo + "` tiene receta en dos sitios (l\u00EDneas " + reglas.map(r => r.linea).join(" y ") + ").",
                como: "make avisa \u00ABoverriding recipe\u00BB y se queda SOLO con la \u00FAltima: la primera receta deja de ejecutarse sin que nadie lo note.",
                arreglo: "Junta las dos recetas en una regla, o usa `::` si de verdad quieres que se ejecuten las dos.",
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
                    que: "`" + objetivo + "` es una acci\u00F3n, no un fichero, y no est\u00E1 en `.PHONY`.",
                    como: "El d\u00EDa que aparezca un fichero llamado `" + objetivo + "` en la carpeta, make dir\u00E1 \u00AB`" + objetivo + "` is up to date\u00BB y NO ejecutar\u00E1 nada. Es el fallo que hace que `make clean` deje de limpiar.",
                    arreglo: "A\u00F1ade `.PHONY: " + objetivo + "`.",
                });
            }
            if (declarado && esFichero(opts, objetivo)) {
                out.push({
                    regla: "phony-con-fichero-real",
                    gravedad: "info",
                    linea: r.linea,
                    que: "Existe un fichero llamado `" + objetivo + "` y el objetivo est\u00E1 declarado `.PHONY`.",
                    como: "La receta se ejecuta siempre y nunca mira ese fichero. Si el fichero era el resultado, no se est\u00E1 cacheando nada.",
                    arreglo: "Si `" + objetivo + "` produce ese fichero, qu\u00EDtalo de `.PHONY`; si no, renombra el fichero.",
                });
            }
            if (r.receta.length > maxReceta) {
                out.push({
                    regla: "receta-larga",
                    gravedad: "info",
                    linea: r.linea,
                    que: "La receta de `" + objetivo + "` tiene " + r.receta.length + " l\u00EDneas (el l\u00EDmite puesto son " + maxReceta + ").",
                    como: "Cada l\u00EDnea es un shell distinto, as\u00ED que una receta larga es dif\u00EDcil de depurar: no puedes ver el estado intermedio.",
                    arreglo: "Parte el objetivo en varios, o mueve el cuerpo a un script con nombre.",
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
                que: "No hay objetivo `" + esperado + "`.",
                como: "Quien llegue nuevo al proyecto probar\u00E1 `make " + esperado + "` antes que nada, porque es la convenci\u00F3n.",
                arreglo: "A\u00F1ade un objetivo `" + esperado + "`, aunque solo llame a otro.",
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
                que: "`" + nombre + "` se declara con `=` y contiene un `$(shell \u2026)`.",
                como: "Una variable `=` se expande EN CADA USO, as\u00ED que el comando se ejecuta una vez por cada sitio donde aparezca `$(" + nombre + ")` \u2014 a veces decenas, en cada invocaci\u00F3n de make. Es una de las causas t\u00EDpicas de \u00ABmi make va lent\u00EDsimo\u00BB.",
                arreglo: "C\u00E1mbiala a `" + nombre + " := $(shell \u2026)`, que lo ejecuta una sola vez.",
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
                    que: "Esta l\u00EDnea hace `cd` y la siguiente cuenta con estar en ese directorio.",
                    como: "make lanza CADA l\u00EDnea de receta en un shell nuevo: el `cd` muere al acabar la l\u00EDnea y la siguiente se ejecuta en la carpeta original. Suele fallar en silencio, tocando el fichero equivocado.",
                    arreglo: "Junta las dos l\u00EDneas con `&&` (`cd sub && make`), o usa `$(MAKE) -C sub`.",
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
                        que: "`rm -rf` sobre `" + w + "`: hay una barra DESPU\u00C9S de la variable.",
                        como: "Si `" + m[1] + "` se expande a vac\u00EDo \u2014una errata en el nombre basta, y make expande a vac\u00EDo cualquier variable que no exista SIN avisar\u2014, el comando se convierte en `rm -rf /" + m[2] + "`. Sin la barra ser\u00EDa inocuo; con ella, no.",
                        arreglo: "Quita la barra final (`rm -rf " + m[1] + "`, que ya borra el directorio entero) o pon una barrera: `test -n \"" + m[1] + "\" && rm -rf " + w + "`.",
                    });
                }
            }
            if (/\$\(MAKE\)|\bmake\s+-C\b/.test(txt)) {
                out.push({
                    regla: "make-recursivo",
                    gravedad: "info",
                    linea: l.linea,
                    que: "Esta receta llama a otro make (make recursivo).",
                    como: "El make de arriba no ve el grafo del de abajo: no puede decidir bien qu\u00E9 hace falta reconstruir, y con `-j` los dos niveles reparten trabajos sin coordinarse. El simulador tampoco puede seguirlo: lo que pase ah\u00ED dentro no aparece en el plan.",
                    arreglo: "Si puedes, incluye los sub-Makefiles con `include` en vez de invocarlos. Si no, al menos usa `$(MAKE)` (ya lo haces) para que se propaguen los flags.",
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
                        que: "Hay una tuber\u00EDa y el shell no tiene `pipefail`" + (shell ? " (SHELL = " + shell + ")" : "") + ".",
                        como: "En una tuber\u00EDa, el shell devuelve el c\u00F3digo del \u00DALTIMO comando. Si el primero falla, `make` lo da por bueno y sigue: el build sale verde con el resultado a medias. Es especialmente traicionero con `| tee registro.log`.",
                        arreglo: "A\u00F1ade arriba `SHELL := /bin/bash` y `.SHELLFLAGS := -eu -o pipefail -c`.",
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
                    que: "`" + ref.cruda + "` no es una variable de este Makefile.",
                    como: pareceShell
                        ? "make se la come ANTES de que el shell la vea y la sustituye por VAC\u00CDO, sin avisar. Si quer\u00EDas una variable del shell (o un `$(comando)`), el shell recibe la l\u00EDnea con un hueco donde iba el valor."
                        : "make expande a vac\u00EDo cualquier variable que no exista, sin avisar. La l\u00EDnea llega al shell con un hueco donde deber\u00EDa ir el valor.",
                    arreglo: pareceShell
                        ? "Dobla el d\u00F3lar: `$" + ref.cruda + "`. As\u00ED make deja pasar un `$` y el shell recibe `" + ref.cruda + "`."
                        : "Def\u00EDnela, o revisa si es una errata del nombre.",
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
            que: "Falta `.DELETE_ON_ERROR:` y hay objetivos que son ficheros.",
            como: "Si una receta falla A MEDIO ESCRIBIR el fichero, make lo deja ah\u00ED. Como existe y es m\u00E1s nuevo que sus fuentes, el siguiente `make` lo da por bueno y sigue con un fichero corrupto \u2014 para siempre, hasta que alguien haga `clean`. Es el fallo de make que menos gente conoce y el que m\u00E1s caro sale.",
            arreglo: "A\u00F1ade una l\u00EDnea `.DELETE_ON_ERROR:` al principio del Makefile.",
        });
    }
    return out.sort((a, b) => a.linea - b.linea || a.regla.localeCompare(b.regla));
}
