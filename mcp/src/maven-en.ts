import type { CodigoAviso, MotivoNoEjecuta, OrigenPaso, PerfilEvaluado } from "../../src/app/services/maven-plan";
import type { ReglaRevision } from "../../src/app/services/maven-revision";
type Datos = Record<string, string>;
const s = (d: Datos, k: string) => String(d[k] ?? "");
export const AVISO_MAVEN_EN: Record<CodigoAviso, (d: Datos) => string> = {
    "sin-poms": () => "There is no pom.xml to read.",
    "sin-tareas": () => "The command asks for no phase and no goal (try \"mvn clean package\").",
    "extension-desconocida": d => `${s(d, "ga")} is loaded with <extensions>true</extensions> and is not in our data: it may change the lifecycle, and that is not reflected here.`,
    "padre-desconocido": d => `The parent ${s(d, "ga")} ${s(d, "version")} is not known: whatever it adds is missing from the plan. Pass its pom too if it is yours.`,
    "padre-aproximado": d => `No exact copy of the parent ${s(d, "ga")} ${s(d, "version")}: the closest one (${s(d, "desde")}–${s(d, "hasta")}) is used.`,
    "modulo-no-cargado": d => `Module "${s(d, "modulo")}" is declared but its pom (${s(d, "ruta")}) was not provided.`,
    "tarea-desconocida": d => `"${s(d, "tarea")}" is not a Maven phase: Maven would stop with "Unknown lifecycle phase".`,
    "tarea-solo-maven-4": d => `"${s(d, "tarea")}" is a new Maven 4 phase that is not modelled yet.`,
    "prefijo-desconocido": d => `Unknown plugin for "${s(d, "tarea")}": it is neither in the pom nor among the known plugins.`,
    "packaging-desconocido": d => `Packaging "${s(d, "packaging")}" is not a Maven one: some plugin with <extensions> brings it, and what it binds is unknown.`,
    "perfil-no-existe": d => `Profile "${s(d, "perfil")}" is not in any pom.`,
    "pl-no-encontrado": d => `"${s(d, "seleccion")}" matches no module: Maven would stop with "Could not find the selected project".`,
    "integration-test-sin-post": () => "You ask for integration-test and there are goals in post-integration-test: in Maven 3 they do NOT run, so whatever was started for the tests stays running. Ask for verify.",
    "post-clean-maven-4": () => "In Maven 4, clean also runs what is bound to post-clean (after:clean). In Maven 3 it does not.",
    "subprojects-en-maven-3": d => `${s(d, "modulo")} uses <subprojects>, which is Maven 4: Maven 3 does not see those modules.`,
    "prioridad-en-maven-3": d => `"${s(d, "fase")}" carries a priority in brackets, which only Maven 4 understands: in Maven 3 that goal does not run.`,
};
export const NO_CORRE_EN: Record<MotivoNoEjecuta, string> = {
    "fase-none": "switched off on purpose with <phase>none</phase>",
    "fase-inexistente": "bound to a phase that does not exist; Maven 3 ignores it silently (a typo?)",
    "sin-fase": "neither the pom nor the plugin gives it a phase: it only runs when invoked by hand",
    "plugin-desconocido": "no <phase> and the plugin is not in our data: its phase is unknown",
    "goal-desconocido": "this goal does not exist in the latest version of the plugin",
};
export const PERFIL_EN: Record<PerfilEvaluado["porque"], string> = {
    "cli": "activated with -P",
    "cli-desactivado": "deactivated with -P!",
    "por-defecto": "active by default",
    "por-defecto-anulado": "activeByDefault, switched off because another profile of the same pom is active",
    "propiedad": "activated by a property",
    "jdk": "activated by the Java version",
    "packaging": "activated by the packaging",
    "fichero": "activated because a file exists (or is missing)",
    "no-cumple": "its activation condition is not met",
    "sin-activacion": "only with -P",
    "dudoso-os": "depends on the operating system: assumed off",
    "dudoso-fichero": "depends on a file that was not provided: assumed off",
};
export function origenEn(o: OrigenPaso): string {
    switch (o.tipo) {
        case "packaging": return o.plugin ? `bound by packaging "${o.packaging}", defined by ${o.plugin} (<extensions>)` : `bound by default for packaging "${o.packaging}"`;
        case "pom": return `${o.perfil ? `profile "${o.perfil}" of ` : ""}${o.ruta}${o.linea ? `:${o.linea}` : ""}`;
        case "padre": return `${o.perfil ? `profile "${o.perfil}" of ` : ""}parent ${o.ga} ${o.version}${o.aproximado ? ` (approximate: data of ${o.desde}–${o.hasta})` : ""}`;
        case "cli": return "invoked on the command line";
    }
}
export const REVISION_EN: Record<ReglaRevision, (d: Datos) => string> = {
    "plugin-duplicado": d => `${s(d, "ga")} is declared twice (first at line ${s(d, "primera")}). Maven 3.9 only warned; Maven 3.10 and 4 fail the build.`,
    "dependencia-duplicada": d => `Dependency ${s(d, "ga")} is declared twice (first at line ${s(d, "primera")}). Maven 3.9 only warned; Maven 3.10 and 4 fail the build.`,
    "sin-version-super-pom": d => `${s(d, "ga")} has no version. With Maven 3.9 it was ${s(d, "version39")}, pinned by the Super POM; Maven 3.10 pins nothing and uses the latest release, so the build changes without you touching it.`,
    "sin-version-ultima": d => `${s(d, "ga")} has no version and nothing pins it: Maven uses the latest release, so two builds of the same commit may differ.`,
    "sin-version-ciclo": d => `${s(d, "ga")} has no version: it uses the one bundled with your Maven version, so it changes when Maven changes.`,
    "version-distinta-modulos": d => `${s(d, "ga")} has different versions in ${s(d, "modulos")} modules (${s(d, "versiones")}): ${s(d, "donde")}. Put it once in the parent's dependencyManagement.`,
    "version-repetida-modulos": d => `${s(d, "ga")} repeats version ${s(d, "versiones")} in ${s(d, "modulos")} modules: ${s(d, "donde")}. Put it once in the parent's dependencyManagement.`,
};
