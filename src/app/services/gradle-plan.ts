export type EstadoTarea = "ejecutada" | "UP-TO-DATE" | "NO-SOURCE" | "FROM-CACHE" | "SKIPPED" | "FAILED";
export interface TareaGradle {
    ruta: string;
    proyecto: string;
    nombre: string;
    estado: EstadoTarea;
    maven?: string;
    agrupa?: boolean;
}
export interface PlanGradle {
    tipo: "dry-run" | "build" | "vacio";
    tareas: TareaGradle[];
    proyectos: string[];
    resultado: "ok" | "fallo" | "";
}
export const EQUIVALENTES: Readonly<Record<string, string>> = {
    clean: "clean",
    compileJava: "compile",
    compileKotlin: "compile",
    compileGroovy: "compile",
    compileScala: "compile",
    processResources: "process-resources",
    classes: "compile",
    compileTestJava: "test-compile",
    compileTestKotlin: "test-compile",
    compileTestGroovy: "test-compile",
    processTestResources: "process-test-resources",
    testClasses: "test-compile",
    test: "test",
    jar: "package",
    war: "package",
    ear: "package",
    bootJar: "package (spring-boot:repackage)",
    bootWar: "package (spring-boot:repackage)",
    assemble: "package",
    check: "verify",
    build: "verify",
    javadoc: "javadoc:javadoc",
    javadocJar: "javadoc:jar",
    sourcesJar: "source:jar",
    publishToMavenLocal: "install",
    publish: "deploy",
    jacocoTestReport: "jacoco:report",
    jacocoTestCoverageVerification: "jacoco:check",
    checkstyleMain: "checkstyle:check",
    checkstyleTest: "checkstyle:check",
    pmdMain: "pmd:check",
    spotbugsMain: "spotbugs:check",
    spotlessCheck: "spotless:check",
    spotlessApply: "spotless:apply",
    bootRun: "spring-boot:run",
    run: "exec:java",
    bootBuildImage: "spring-boot:build-image",
    bootBuildInfo: "spring-boot:build-info",
    processAot: "spring-boot:process-aot",
    processTestAot: "spring-boot:process-test-aot",
    nativeCompile: "native:compile",
    integrationTest: "integration-test (failsafe)",
    dependencies: "dependency:tree",
};
export const AGRUPADORAS = new Set(["classes", "testClasses", "assemble", "check", "build"]);
const MAX_TEXTO = 2000000;
const ESTADOS = new Set(["UP-TO-DATE", "NO-SOURCE", "FROM-CACHE", "SKIPPED", "FAILED"]);
export function leerPlanGradle(texto: string): PlanGradle {
    const t = typeof texto === "string" ? texto.slice(0, MAX_TEXTO) : "";
    const tareas: TareaGradle[] = [];
    for (const bruta of t.split(/\r?\n/)) {
        const linea = bruta.trim();
        const m = /^(?:> Task )?(:[\w.:-]*[\w-])(?:\s+([A-Z-]+))?\s*$/.exec(linea);
        if (!m)
            continue;
        const conTask = linea.startsWith("> Task ");
        const estadoTxt = m[2] ?? "";
        if (!conTask && !estadoTxt)
            continue;
        if (estadoTxt && !ESTADOS.has(estadoTxt))
            continue;
        const ruta = m[1];
        const i = ruta.lastIndexOf(":");
        const nombre = ruta.slice(i + 1);
        const proyecto = i <= 0 ? ":" : ruta.slice(0, i);
        tareas.push({
            ruta,
            proyecto,
            nombre,
            estado: (estadoTxt || "ejecutada") as EstadoTarea,
            maven: EQUIVALENTES[nombre],
            ...(AGRUPADORAS.has(nombre) ? { agrupa: true } : {}),
        });
    }
    const proyectos = [...new Set(tareas.map(x => x.proyecto))];
    const tipo = !tareas.length ? "vacio" : tareas.every(x => x.estado === "SKIPPED") ? "dry-run" : "build";
    const resultado = /BUILD FAILED/.test(t) ? "fallo" : /BUILD SUCCESSFUL/.test(t) ? "ok" : "";
    return { tipo, tareas, proyectos, resultado };
}
export function pareceSalidaGradle(texto: string): boolean {
    return leerPlanGradle(texto).tareas.length > 0;
}
