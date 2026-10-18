export type Stack = "generico" | "node" | "python" | "go" | "rust" | "c" | "maven" | "gradle";
export interface OpcionesGen {
    stack: Stack;
    conLogs: boolean;
    conHelp: boolean;
    conDocker: boolean;
    nombreProyecto: string;
}
export const OPCIONES_POR_DEFECTO: OpcionesGen = {
    stack: "node",
    conLogs: true,
    conHelp: true,
    conDocker: false,
    nombreProyecto: "mi-proyecto",
};
interface Receta {
    nombre: string;
    ayuda: string;
    lineas: string[];
    phony: boolean;
    requisitos?: string;
}
function recetasDeStack(s: Stack): Receta[] {
    switch (s) {
        case "node": return [
            { nombre: "install", ayuda: "Installs the dependencies exactly as the lock file says", phony: true, lineas: ["npm ci"] },
            { nombre: "build", ayuda: "Builds the project", phony: true, lineas: ["npm run build"] },
            { nombre: "test", ayuda: "Runs the tests", phony: true, lineas: ["npm test"] },
            { nombre: "lint", ayuda: "Checks the style", phony: true, lineas: ["npm run lint"] },
            { nombre: "clean", ayuda: "Removes what was built", phony: true, lineas: ["rm -rf dist node_modules/.cache"] },
        ];
        case "python": return [
            { nombre: "install", ayuda: "Installs the dependencies in the current environment", phony: true, lineas: ["pip install -r requirements.txt"] },
            { nombre: "build", ayuda: "Packages the project", phony: true, lineas: ["python -m build"] },
            { nombre: "test", ayuda: "Runs the tests", phony: true, lineas: ["pytest -q"] },
            { nombre: "lint", ayuda: "Checks the style", phony: true, lineas: ["ruff check ."] },
            { nombre: "clean", ayuda: "Removes what was built and the caches", phony: true, lineas: ["rm -rf dist build .pytest_cache", "find . -name __pycache__ -type d -prune -exec rm -rf {} +"] },
        ];
        case "go": return [
            { nombre: "install", ayuda: "Downloads the modules", phony: true, lineas: ["go mod download"] },
            { nombre: "build", ayuda: "Builds the binary", phony: true, lineas: ["go build -o bin/$(NOMBRE) ./..."] },
            { nombre: "test", ayuda: "Runs the tests", phony: true, lineas: ["go test ./..."] },
            { nombre: "lint", ayuda: "Checks the style", phony: true, lineas: ["go vet ./..."] },
            { nombre: "clean", ayuda: "Removes what was built", phony: true, lineas: ["rm -rf bin"] },
        ];
        case "rust": return [
            { nombre: "install", ayuda: "Downloads the dependencies", phony: true, lineas: ["cargo fetch"] },
            { nombre: "build", ayuda: "Builds in release mode", phony: true, lineas: ["cargo build --release"] },
            { nombre: "test", ayuda: "Runs the tests", phony: true, lineas: ["cargo test"] },
            { nombre: "lint", ayuda: "Checks the style", phony: true, lineas: ["cargo clippy -- -D warnings"] },
            { nombre: "clean", ayuda: "Removes what was built", phony: true, lineas: ["cargo clean"] },
        ];
        case "maven": return [
            { nombre: "install", ayuda: "Downloads the dependencies", phony: true, lineas: ["$(MVN) -B dependency:go-offline"] },
            { nombre: "build", ayuda: "Packages the project without running the tests", phony: true, lineas: ["$(MVN) -B package -DskipTests"] },
            { nombre: "test", ayuda: "Runs the tests", phony: true, lineas: ["$(MVN) -B test"] },
            { nombre: "lint", ayuda: "Runs the whole verification (tests and checks)", phony: true, lineas: ["$(MVN) -B verify"] },
            { nombre: "clean", ayuda: "Removes what was built", phony: true, lineas: ["$(MVN) -B clean"] },
        ];
        case "gradle": return [
            { nombre: "install", ayuda: "Downloads the dependencies", phony: true, lineas: ["$(GRADLE) dependencies"] },
            { nombre: "build", ayuda: "Builds the project without running the tests", phony: true, lineas: ["$(GRADLE) assemble"] },
            { nombre: "test", ayuda: "Runs the tests", phony: true, lineas: ["$(GRADLE) test"] },
            { nombre: "lint", ayuda: "Runs the checks without the tests", phony: true, lineas: ["$(GRADLE) check -x test"] },
            { nombre: "clean", ayuda: "Removes what was built", phony: true, lineas: ["$(GRADLE) clean"] },
        ];
        case "c": return [
            { nombre: "build", ayuda: "Builds the binary", phony: true, requisitos: "$(OUT)/$(NOMBRE)", lineas: [] },
            { nombre: "test", ayuda: "Runs the tests", phony: true, lineas: ["./$(OUT)/$(NOMBRE) --test"] },
            { nombre: "clean", ayuda: "Removes what was built", phony: true, lineas: ["rm -rf $(OUT)"] },
        ];
        default: return [
            { nombre: "build", ayuda: "Builds the project", phony: true, lineas: ["echo \"TODO: put the build command here\""] },
            { nombre: "test", ayuda: "Runs the tests", phony: true, lineas: ["echo \"TODO: put the test command here\""] },
            { nombre: "clean", ayuda: "Removes what was built", phony: true, lineas: ["rm -rf $(OUT)"] },
        ];
    }
}
function reglasFichero(s: Stack): string[] {
    if (s !== "c")
        return [];
    return [
        "$(OUT)/$(NOMBRE): $(OBJS) | $(OUT)",
        "\t$(CC) $(CFLAGS) -o $@ $^",
        "",
        "$(OUT)/%.o: src/%.c | $(OUT)",
        "\t$(CC) $(CFLAGS) -c $< -o $@",
        "",
        "$(OUT):",
        "\tmkdir -p $(OUT)",
    ];
}
export function generarMakefile(o: OpcionesGen): string {
    const nombre = (o.nombreProyecto || "mi-proyecto").trim().replace(/\s+/g, "-") || "mi-proyecto";
    const L: string[] = [];
    const phony: string[] = [];
    L.push("# Makefile for " + nombre + " \u2014 generated with Jarroba Tools");
    L.push("");
    L.push("# A failed run does NOT leave the file written: without this, the next make considers it");
    L.push("# good forever just because it exists and is newer than its sources.");
    L.push(".DELETE_ON_ERROR:");
    L.push("");
    L.push("# bash with `-e` (stop at the first failure), `-u` (an undefined variable is an error) and");
    L.push("# `pipefail` (a pipeline is as good as its worst exit code, not just the last command).");
    L.push("SHELL := /bin/bash");
    L.push(".SHELLFLAGS := -eu -o pipefail -c");
    L.push("");
    if (o.conHelp) {
        L.push("# Plain `make` shows the help instead of building something by surprise.");
        L.push(".DEFAULT_GOAL := help");
        L.push("");
    }
    L.push("NOMBRE := " + nombre);
    L.push("OUT := build");
    if (o.stack === "c") {
        L.push("CFLAGS := -Wall -Wextra -O2");
        L.push("SRCS := $(wildcard src/*.c)");
        L.push("OBJS := $(SRCS:src/%.c=$(OUT)/%.o)");
    }
    if (o.stack === "maven") {
        L.push("# The project wrapper if there is one (it pins the Maven version), the installed mvn if not.");
        L.push("MVN := $(if $(wildcard ./mvnw),./mvnw,mvn)");
    }
    if (o.stack === "gradle") {
        L.push("# The project wrapper if there is one (it pins the Gradle version), the installed gradle if not.");
        L.push("GRADLE := $(if $(wildcard ./gradlew),./gradlew,gradle)");
    }
    if (o.conDocker) {
        L.push("IMAGEN := $(NOMBRE)");
        L.push("# `:=` and not `=`: with `=`, this command would run ONCE PER EACH use of $(TAG).");
        L.push("TAG := $(shell git rev-parse --short HEAD)");
    }
    if (o.conLogs) {
        L.push("");
        L.push("# Logging: each run leaves its own file with the time in the name.");
        L.push("LOGS := logs");
        L.push("SELLO := $(shell date +%Y%m%d-%H%M%S)");
    }
    L.push("");
    const recetas = recetasDeStack(o.stack);
    const cadena = recetas.filter(r => ["install", "build"].includes(r.nombre)).map(r => r.nombre);
    L.push("all: " + (cadena.length ? cadena.join(" ") : "build") + "  ## Installs and builds everything");
    phony.push("all");
    L.push("");
    for (const r of recetas) {
        const registra = o.conLogs && r.lineas.length > 0 && envolver(r.lineas[0], o, r.nombre) !== r.lineas[0];
        const reqs = [r.requisitos, registra ? "| $(LOGS)" : ""].filter(Boolean).join(" ");
        L.push(r.nombre + ":" + (reqs ? " " + reqs : "") + "  ## " + r.ayuda);
        for (const linea of r.lineas)
            L.push("\t" + envolver(linea, o, r.nombre));
        if (r.phony)
            phony.push(r.nombre);
        L.push("");
    }
    const ficheros = reglasFichero(o.stack);
    if (ficheros.length) {
        L.push(...ficheros);
        L.push("");
    }
    if (o.conDocker) {
        L.push("image:  ## Builds the Docker image");
        L.push("\tdocker build -t $(IMAGEN):$(TAG) .");
        L.push("");
        L.push("push:  ## Pushes the image to the registry");
        L.push("\tdocker push $(IMAGEN):$(TAG)");
        L.push("");
        phony.push("image", "push");
    }
    if (o.conLogs) {
        L.push("$(LOGS):");
        L.push("\tmkdir -p $(LOGS)");
        L.push("");
    }
    if (o.conHelp) {
        L.push("help:  ## Shows this help");
        L.push("\t@grep -hE '^[a-zA-Z0-9_-]+:.*?## ' $(MAKEFILE_LIST) \\");
        L.push("\t\t| awk 'BEGIN {FS = \":.*?## \"}; {printf \"  \\033[36m%-12s\\033[0m %s\\n\", $$1, $$2}'");
        L.push("");
        phony.push("help");
    }
    L.push(".PHONY: " + [...new Set(phony)].join(" "));
    if (o.conLogs) {
        L.push("");
        L.push("# With `make -j`, add --output-sync=target or the output of two targets running at the");
        L.push("# same time gets interleaved line by line and nobody can read the log:");
        L.push("#     make -j4 --output-sync=target all");
    }
    return L.join("\n") + "\n";
}
function envolver(comando: string, o: OpcionesGen, objetivo: string): string {
    if (!o.conLogs)
        return comando;
    if (["clean"].includes(objetivo))
        return comando;
    return comando + " 2>&1 | tee $(LOGS)/" + objetivo + "-$(SELLO).log";
}
export function objetivosGenerados(o: OpcionesGen): string[] {
    const out = ["all", ...recetasDeStack(o.stack).map(r => r.nombre)];
    if (o.conDocker)
        out.push("image", "push");
    if (o.conHelp)
        out.push("help");
    return out;
}
export interface ProyectoDetectado {
    stack: Stack;
    porque: string;
}
export function detectarStack(rutas: string[]): ProyectoDetectado {
    const rs = (Array.isArray(rutas) ? rutas : []).filter((r): r is string => typeof r === "string");
    const raiz = new Set(rs.filter(r => !r.includes("/")));
    const MARCAS: [
        string,
        Stack
    ][] = [
        ["pom.xml", "maven"],
        ["build.gradle", "gradle"],
        ["build.gradle.kts", "gradle"],
        ["go.mod", "go"],
        ["Cargo.toml", "rust"],
        ["pyproject.toml", "python"],
        ["setup.py", "python"],
        ["requirements.txt", "python"],
        ["package.json", "node"],
    ];
    for (const [fichero, stack] of MARCAS)
        if (raiz.has(fichero))
            return { stack, porque: fichero };
    if (rs.some(r => /^src\/[^/]+\.c$/.test(r)))
        return { stack: "c", porque: "src/*.c" };
    return { stack: "generico", porque: "" };
}
