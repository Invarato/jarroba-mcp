import type { AvisoDf, ReglaAvisoDf } from "../../src/app/services/dockerfile";
import type { DiagMk, ReglaDiagMk } from "../../src/app/services/makefile-expand";
import type { Hallazgo as HallazgoMk, ReglaLintPropia } from "../../src/app/services/makefile-lint";
import type { AvisoCarrera } from "../../src/app/services/makefile-plan";
import type { AvisoIgnore, ReglaAvisoIgnore, Divergencia, CausaDivergencia } from "../../src/app/services/ignore-rules";
import type { MotivoSenal, Perdida, Omitido, MotivoOmitido, AvisoConv, TipoAvisoConv } from "../../src/app/services/makefile-rol";
type Datos = Record<string, string | number>;
const s = (d: Datos, k: string) => String(d[k] ?? "");
export interface AvisoEn {
    what: string;
    howItBreaks: string;
    fix: string;
}
const LEER = { howItBreaks: "The build fails while reading the file.", fix: "Fix the line pointed out." };
const DF_EN: Record<ReglaAvisoDf, (d: Datos, linea: number) => AvisoEn> = {
    "linea-no-entendida": () => ({ what: "Docker would not know what to do with this line.", ...LEER }),
    "instruccion-desconocida": d => ({ what: `\`${s(d, "instruccion")}\` is not a Dockerfile instruction.`, ...LEER }),
    "antes-del-from": d => ({ what: `\`${s(d, "instruccion")}\` appears before the first \`FROM\`: Docker only allows \`ARG\` there.`, ...LEER }),
    "sin-from": () => ({ what: "The Dockerfile has no `FROM`: there is no image to start from.", ...LEER }),
    "copia-amplia-antes-de-instalar": (d, l) => ({
        what: `The whole project is copied (line ${l}) BEFORE installing dependencies (line ${s(d, "lineaInstala")}).`,
        howItBreaks: "Docker invalidates a layer and EVERY layer after it. Since this `COPY` changes every time you touch a line of code, the dependency install is repeated in full on every build, even when the dependencies did not change. It is the most common cause of \"my Docker build takes forever\".",
        fix: `Copy only the manifest first (\`COPY ${s(d, "manifiesto")} ./\`), then the \`RUN\` that installs, and AFTER that the \`COPY\` of the rest. The install is then redone only when the manifest changes.`,
    }),
    "copia-sin-origen": d => ({
        what: `\`${s(d, "instruccion")}\` does not bring any file from the context.`,
        howItBreaks: "Docker aborts with \"no source files were specified\" or \"file not found\". It usually happens when the file exists on your disk but the `.dockerignore` leaves it out of the context \u2014 so the error does not match what you see in the folder.",
        fix: "Check the path and look at the .dockerignore: a rule may be excluding it from the context.",
    }),
    "apt-update-separado": (d, l) => ({
        what: `\`apt-get update\` (line ${l}) is in a different \`RUN\` from \`apt-get install\` (line ${s(d, "lineaInstall")}).`,
        howItBreaks: "Docker caches the `update` by its TEXT, which never changes. When you add a package to the `install`, that layer is rebuilt but the `update` comes from cache: versions get installed from a package index that is months old. A silent failure that is hard to reproduce, because it depends on what the machine has cached.",
        fix: "Put both in a single `RUN` with `&&`.",
    }),
    "base-sin-fijar": d => ({
        what: `\`${s(d, "base")}\` does not pin a specific version.`,
        howItBreaks: "The local cache keeps trusting the old image while the registry already serves a different one: your machine and CI build different things from the same Dockerfile, and nothing in the file shows it.",
        fix: `Pin the tag (\`${s(d, "base")}:1.2.3\`) or, better, the digest (\`${s(d, "base")}@sha256:…\`).`,
    }),
};
export function avisoDfEn(a: AvisoDf): AvisoEn {
    return DF_EN[a.regla](a.datos, a.linea);
}
const DIAG_MK_EN: Record<ReglaDiagMk, (d: Datos) => string> = {
    "expansion-infinita": d => `Expansion went deeper than ${s(d, "max")} levels: a variable references itself.`,
    "parentesis-sin-cerrar": () => "A `$(\u2026)` reference is missing its closing parenthesis.",
    "word-indice": () => "`$(word n,\u2026)` needs an index greater than zero.",
    "shell-no-ejecutable": d => d["variable"] !== undefined
        ? `\`${s(d, "variable")} != ${s(d, "comando")}\` runs a command: not possible in the simulator, it stays empty.`
        : `\`$(shell ${s(d, "comando")})\` cannot run in the simulator: it expands to empty. Give it a value to simulate with it.`,
    "error-explicito": d => `$(error) from the Makefile itself: ${s(d, "texto")}`,
    "warning-explicito": d => `$(warning) from the Makefile itself: ${s(d, "texto")}`,
    "info-explicito": d => s(d, "texto"),
    "eval-no-soportado": () => "`$(eval \u2026)` creates rules or variables on the fly; the simulator does not apply it, so whatever depends on it will not show up.",
    "condicional-mal-formada": d => `Malformed \`${s(d, "directiva")}\`: expected \`${s(d, "directiva")} (a,b)\` or \`${s(d, "directiva")} "a" "b"\`.`,
    "receta-sin-regla": () => "A tab-indented line outside any rule: make would treat it as a command without knowing for which target.",
    "else-suelto": () => "`else` without an open `if`.",
    "endif-suelto": () => "`endif` without an open `if`.",
    "define-sin-endef": d => `\`define ${s(d, "nombre")}\` is not closed with \`endef\`.`,
    "include-no-encontrado": d => `\`include ${s(d, "ruta")}\`: that file is not in the project, and with \`include\` (no \`-\`) make aborts.`,
    "include-circular": () => "Too many nested `include`s: some files include each other.",
    "nombre-variable-invalido": d => `Invalid variable name: \`${s(d, "nombre")}\`.`,
    "receta-con-espacios": () => "This line is indented with SPACES. Recipes need a tab: make answers `*** missing separator. Stop.` and says nothing else.",
    "linea-no-entendida": () => "make would not know what to do with this line: it is not an assignment, a rule or a directive.",
    "if-sin-cerrar": d => `${s(d, "n")} conditional(s) left without their \`endif\`.`,
    "regla-sin-objetivo": () => "A rule with no target left of the colon (a variable that expanded to empty?).",
    "estatica-no-casa": d => `Target \`${s(d, "objetivo")}\` does not match the pattern \`${s(d, "patron")}\` of its static rule.`,
    "dependencia-circular": d => `Circular dependency: ${s(d, "cadena")}. make drops it and the result is no longer reliable.`,
    "grafo-demasiado-grande": d => `The graph has more than ${s(d, "max")} targets: the simulation stops here.`,
    "cadena-demasiado-profunda": d => `There is a chain of more than ${s(d, "max")} dependencies (…→ ${s(d, "objetivo")}): the simulation stops there.`,
    "sin-regla-ni-fichero": d => `\`${s(d, "objetivo")}\`: the file does not exist and no rule knows how to build it. make says "No rule to make target".`,
    "sin-objetivo": () => "There is no target to build: the Makefile declares no rule.",
};
export function diagMkEn(d: Pick<DiagMk, "regla" | "datos">): string {
    return DIAG_MK_EN[d.regla](d.datos);
}
export function carreraEn(c: AvisoCarrera): string {
    return `The recipe of \`${c.a}\` uses \`${c.b}\` but does not declare it as a prerequisite. Serially it works by luck of the order; with \`make -j\` both start at the same time and \`${c.a}\` may read a half-written \`${c.b}\`.`;
}
const LIMITE = { howItBreaks: "Not a bug in your Makefile: it is a limit of simulating it.", fix: "Give it a value by hand if you want the simulation to count on it." };
const LECTURA = { howItBreaks: "make aborts reading the file.", fix: "Fix the line pointed out." };
const LINT_EN: Record<ReglaLintPropia, (d: Datos) => AvisoEn> = {
    "objetivo-duplicado": d => ({
        what: `Target \`${s(d, "objetivo")}\` has a recipe in two places (lines ${s(d, "primera")} and ${s(d, "segunda")}).`,
        howItBreaks: "make warns \"overriding recipe\" and keeps ONLY the last one: the first recipe stops running without anyone noticing.",
        fix: "Merge both recipes into one rule, or use `::` if you really want both to run.",
    }),
    "phony-no-declarado": d => ({
        what: `\`${s(d, "objetivo")}\` is an action, not a file, and it is not in \`.PHONY\`.`,
        howItBreaks: `The day a file called \`${s(d, "objetivo")}\` appears in the folder, make will say "\`${s(d, "objetivo")}\` is up to date" and run NOTHING. It is the bug that makes \`make clean\` stop cleaning.`,
        fix: `Add \`.PHONY: ${s(d, "objetivo")}\`.`,
    }),
    "phony-con-fichero-real": d => ({
        what: `There is a file called \`${s(d, "objetivo")}\` and the target is declared \`.PHONY\`.`,
        howItBreaks: "The recipe always runs and never looks at that file. If the file was the result, nothing is being cached.",
        fix: `If \`${s(d, "objetivo")}\` produces that file, remove it from \`.PHONY\`; otherwise, rename the file.`,
    }),
    "receta-larga": d => ({
        what: `The recipe of \`${s(d, "objetivo")}\` has ${s(d, "lineas")} lines (the limit set is ${s(d, "max")}).`,
        howItBreaks: "Each line is a separate shell, so a long recipe is hard to debug: you cannot see the intermediate state.",
        fix: "Split the target into several, or move the body into a named script.",
    }),
    "phony-esperado-ausente": d => ({
        what: `There is no \`${s(d, "objetivo")}\` target.`,
        howItBreaks: `Whoever is new to the project will try \`make ${s(d, "objetivo")}\` first, because it is the convention.`,
        fix: `Add a \`${s(d, "objetivo")}\` target, even if it only calls another one.`,
    }),
    "shell-en-recursiva": d => ({
        what: `\`${s(d, "nombre")}\` is declared with \`=\` and contains a \`$(shell …)\`.`,
        howItBreaks: `A \`=\` variable is expanded ON EVERY USE, so the command runs once for every place where \`$(${s(d, "nombre")})\` appears — sometimes dozens, on every make invocation. One of the typical causes of "my make is so slow".`,
        fix: `Change it to \`${s(d, "nombre")} := $(shell …)\`, which runs it only once.`,
    }),
    "cd-no-persiste": () => ({
        what: "This line does `cd` and the next one expects to be in that directory.",
        howItBreaks: "make runs EACH recipe line in a new shell: the `cd` dies when the line ends and the next one runs in the original folder. It usually fails silently, touching the wrong file.",
        fix: "Join both lines with `&&` (`cd sub && make`), or use `$(MAKE) -C sub`.",
    }),
    "rm-rf-sobre-variable": d => ({
        what: `\`rm -rf\` on \`${s(d, "ruta")}\`: there is a slash AFTER the variable.`,
        howItBreaks: `If \`${s(d, "variable")}\` expands to empty — a typo in the name is enough, and make expands any missing variable to empty WITHOUT warning — the command becomes \`rm -rf /${s(d, "resto")}\`. Without the slash it would be harmless; with it, it is not.`,
        fix: `Remove the trailing slash (\`rm -rf ${s(d, "variable")}\`, which already deletes the whole directory) or add a guard: \`test -n "${s(d, "variable")}" && rm -rf ${s(d, "ruta")}\`.`,
    }),
    "make-recursivo": () => ({
        what: "This recipe calls another make (recursive make).",
        howItBreaks: "The make above does not see the graph of the one below: it cannot properly decide what needs rebuilding, and with `-j` both levels hand out jobs without coordinating. The simulator cannot follow it either: whatever happens in there does not appear in the plan.",
        fix: "If you can, include the sub-Makefiles with `include` instead of invoking them. If not, at least use `$(MAKE)` so flags are propagated.",
    }),
    "tuberia-sin-pipefail": d => ({
        what: s(d, "shell")
            ? `There is a pipeline and the shell has no \`pipefail\` (SHELL = ${s(d, "shell")}).`
            : "There is a pipeline and the shell has no `pipefail`.",
        howItBreaks: "In a pipeline the shell returns the exit code of the LAST command. If the first one fails, `make` takes it as fine and carries on: the build goes green with half a result. Especially treacherous with `| tee build.log`.",
        fix: "Add `SHELL := /bin/bash` and `.SHELLFLAGS := -eu -o pipefail -c` at the top.",
    }),
    "variable-no-definida": d => d["deShell"]
        ? {
            what: `\`${s(d, "referencia")}\` is not a variable of this Makefile.`,
            howItBreaks: "make eats it BEFORE the shell sees it and replaces it with EMPTY, without warning. If you meant a shell variable (or a `$(command)`), the shell gets the line with a gap where the value was.",
            fix: `Double the dollar: \`$${s(d, "referencia")}\`. make then passes a \`$\` through and the shell gets \`${s(d, "referencia")}\`.`,
        }
        : {
            what: `\`${s(d, "referencia")}\` is not a variable of this Makefile.`,
            howItBreaks: "make expands any missing variable to empty, without warning. The line reaches the shell with a gap where the value should be.",
            fix: "Define it, or check whether the name has a typo.",
        },
    "sin-delete-on-error": () => ({
        what: "`.DELETE_ON_ERROR:` is missing and some targets are files.",
        howItBreaks: "If a recipe fails HALF-WAY through writing the file, make leaves it there. Since it exists and is newer than its sources, the next `make` takes it as good and carries on with a corrupt file \u2014 forever, until someone runs `clean`. The least known make failure and the most expensive one.",
        fix: "Add a `.DELETE_ON_ERROR:` line at the top of the Makefile.",
    }),
};
export function hallazgoMkEn(h: HallazgoMk): AvisoEn {
    if (h.regla === "receta-con-espacios") {
        return {
            what: "Recipe indented with spaces instead of a tab.",
            howItBreaks: "make answers `*** missing separator. Stop.` and says nothing else. Both files look IDENTICAL on screen, which is what makes this bug so costly.",
            fix: "Replace the spaces at the start of the line with a tab.",
        };
    }
    if (h.regla === "shell-no-ejecutable" || h.regla === "eval-no-soportado") {
        return { what: diagMkEn({ regla: h.regla, datos: h.datos }), ...LIMITE };
    }
    if (h.regla in DIAG_MK_EN)
        return { what: diagMkEn({ regla: h.regla as ReglaDiagMk, datos: h.datos }), ...LECTURA };
    return LINT_EN[h.regla as ReglaLintPropia](h.datos);
}
const DIVERGENCIA_EN: Record<CausaDivergencia, (d: Datos) => string> = {
    "excepcion-bloqueada-en-git": d => `It is the exception \`${s(d, "excepcion")}\` (line ${s(d, "linea")}): Docker applies it and git does NOT, because for git the folder \`${s(d, "ancestro")}\` is already excluded (line ${s(d, "lineaAncestro")}) and git does not enter excluded folders. For git to rescue it too, exclude the contents (\`${s(d, "ancestro")}/*\`) instead of the folder.`,
    "regla-sin-barras": d => `The rule on line ${s(d, "linea")} (\`${s(d, "regla")}\`) has no slashes: git applies it at any depth, but Docker only at the root. In the build context this gets IN. Fix it by writing \`**/${s(d, "patron")}\`.`,
    "fuera-en-git": d => `Git leaves it out and Docker brings it in: check the rule on line ${s(d, "linea")}.`,
    "fuera-en-docker": d => d["regla"] !== undefined
        ? `Docker leaves it out and git brings it in (rule on line ${s(d, "linea")}: \`${s(d, "regla")}\`). It usually happens when git rescues the path with a \`!\` that Docker does not apply the same way.`
        : "Docker leaves it out and git brings it in. It usually happens when git rescues the path with a `!` that Docker does not apply the same way.",
};
export function divergenciaEn(v: Pick<Divergencia, "causa" | "datos">): string {
    return DIVERGENCIA_EN[v.causa](v.datos);
}
const IGNORE_EN: Record<ReglaAvisoIgnore, (d: Datos, linea: number) => AvisoEn> = {
    "reinclusion-bloqueada": d => ({
        what: `This exception does nothing: \`${s(d, "excepcion")}\`.`,
        howItBreaks: `The directory \`${s(d, "ancestro")}\` is already excluded by line ${s(d, "lineaAncestro")}. Git does NOT enter an excluded directory — its documentation says so: it does not list them, for performance — so rules about what is inside have no effect, wherever they are written. The number one cause of "my \`!\` does not work".`,
        fix: `Exclude the CONTENTS instead of the directory (\`${s(d, "ancestro")}/*\` instead of \`${s(d, "ancestro")}\`) and then the exception does apply.`,
    }),
    "regla-anulada": (d, l) => ({
        what: `Line ${l} (\`${s(d, "regla")}\`) is overridden by line ${s(d, "lineaQueAnula")} (\`${s(d, "anula")}\`).`,
        howItBreaks: "In both formats the LAST matching rule wins, so the one above never gets to decide.",
        fix: "Delete one of the two, or swap their order if you meant the opposite.",
    }),
    "docker-solo-raiz": d => ({
        what: `\`${s(d, "patron")}\` only matches at the ROOT of the context, not at any depth.`,
        howItBreaks: `It is the big difference from \`.gitignore\`, and the number one mistake when copying one into the other: in git a pattern without slashes is anchored with an implicit \`**/\`, and in Docker it is not. A nested \`${s(d, "patron")}\` gets INTO the build context, bloating it and sometimes leaking what you thought you were leaving out.`,
        fix: `Write \`**/${s(d, "patron")}\` if you want it at any depth.`,
    }),
    "regla-sin-efecto": d => ({
        what: `\`${s(d, "regla")}\` does not match any file in the project.`,
        howItBreaks: "It breaks nothing, but either it is unnecessary or it has a typo \u2014 and a rule nobody checks stays there forever, giving a false sense of being covered.",
        fix: "Check it against the project tree; if it is for files that do not exist yet, ignore this warning.",
    }),
};
export function avisoIgnoreEn(a: AvisoIgnore): AvisoEn {
    return IGNORE_EN[a.regla](a.datos, a.linea);
}
const SENAL_EN: Record<MotivoSenal, (objetivo: string) => string> = {
    patron: () => "it is a pattern rule: it exists to produce files",
    phony: () => "declared in `.PHONY` by the author",
    ruta: () => "the name contains a path",
    extension: () => "the name has an artifact extension",
    automaticas: () => "$@ / $< / $^: the recipe works with the target as a file",
    escribe: o => `the recipe writes to \`${o}\``,
    crea: o => `the recipe creates \`${o}\``,
    "en-disco": () => "a file with that name already exists in the project",
    verbo: () => "the name is a verb, not a product",
    agrupa: () => "it has no recipe: it only groups other targets",
};
export const senalEn = (motivo: MotivoSenal, objetivo: string): string => SENAL_EN[motivo](objetivo);
const PERDIDA_EN: Record<Perdida["tipo"], (n: number) => string> = {
    patrones: n => `${n} pattern rule${n === 1 ? "" : "s"} (\`%.o: %.c\`): neither just nor npm has anything equivalent.`,
    fuentes: n => `${n} file target${n === 1 ? "" : "s"} with sources: today ${n === 1 ? "it is" : "they are"} skipped if nothing changed.`,
    "solo-orden": n => `${n} order-only prerequisite${n === 1 ? "" : "s"} (with \`|\`): ${n === 1 ? "it has" : "they have"} to exist but do not force a rebuild.`,
    recursivo: () => "There is recursive make (`$(MAKE) -C \u2026`): the conversion does not go down into subdirectories.",
    nada: () => "Nothing measurable: this file uses no dates, no graph and no patterns. That is the definition of a launcher.",
};
export const perdidaEn = (p: Perdida): string => PERDIDA_EN[p.tipo](p.n);
const OMITIDO_EN: Record<MotivoOmitido, (d: Datos) => string> = {
    patron: () => "it is a pattern rule: the target tool has no such concept",
    fichero: () => "it is a file target: without dates it would always rebuild, and that is exactly what make saves you today",
    "nombre-just": () => "the name is not valid as a just recipe",
    automatica: d => `the recipe uses an automatic variable or a make function with no equivalent (line ${s(d, "linea")})`,
    dependencia: d => `it depends on \`${s(d, "caido")}\`, which could not be converted either: translating it would leave a recipe that does nothing and does not fail`,
};
export const omitidoEn = (o: Omitido): string => OMITIDO_EN[o.motivo](o.datos);
const AVISO_CONV_EN: Record<TipoAvisoConv, (d: Datos) => string> = {
    "variable-renombrada": d => `The variable \`${s(d, "nombre")}\` was renamed to \`${s(d, "limpio")}\`: the target does not allow that character.`,
    llaves: () => "There was `{{\u2026}}` in a recipe (almost certainly a docker or kubectl `--format`). It was escaped: in just and task those braces are interpolation.",
    "shell-npm": d => `\`${s(d, "nombre")}\` came from a \`$(shell …)\`: it was translated into the shell's own command substitution, which does the same in an npm script.`,
    "npm-sin-variables": d => `npm scripts have no variables: the values (\`${s(d, "nombre")}\`…) were written already resolved, so they cannot be changed from the command line.`,
    "renombrado-just": d => `\`${s(d, "nombre")}\` was renamed to \`${s(d, "alias")}\`: just does not allow that name.`,
    "ciclo-npm": d => `\`${s(d, "alias")}\` is an npm lifecycle name: npm will run it by itself (\`npm ${s(d, "alias")}\`, and some even on every \`npm install\`). Rename it if you do not want that.`,
    "npm-callado": () => "npm scripts always print what they run: the `@` of silent recipes has no equivalent.",
    "just-cd": () => "As in make, each line of a just recipe runs in ITS OWN shell: a `cd` does not reach the next line. If you need it, give the recipe a shebang (`#!/usr/bin/env bash`).",
    "task-deps": () => "Dependencies were written as `- task:` inside `cmds`, not in `deps`: `deps` runs in PARALLEL, and make prerequisites, without `-j`, run in order.",
    "npm-and": () => "Each recipe's lines were joined with `&&`, so here they DO share a shell: a `cd` now reaches the next line. This differs from make, and sometimes it is what you wanted.",
};
export const avisoConvEn = (a: AvisoConv): string => AVISO_CONV_EN[a.tipo](a.datos);
