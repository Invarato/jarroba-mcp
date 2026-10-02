export interface DiagDf {
    gravedad: "error" | "aviso" | "info";
    regla: string;
    linea: number;
    mensaje: string;
}
export interface Instruccion {
    linea: number;
    clave: string;
    argumentos: string;
    banderas: Record<string, string>;
    crudo: string;
    etapa: number;
}
export interface Etapa {
    indice: number;
    nombre: string | null;
    base: string;
    desdeEtapa: number | null;
    instrucciones: Instruccion[];
}
export interface DockerfileLeido {
    instrucciones: Instruccion[];
    etapas: Etapa[];
    diags: DiagDf[];
}
const CLAVES = new Set([
    "FROM",
    "RUN",
    "CMD",
    "LABEL",
    "MAINTAINER",
    "EXPOSE",
    "ENV",
    "ADD",
    "COPY",
    "ENTRYPOINT",
    "VOLUME",
    "USER",
    "WORKDIR",
    "ARG",
    "ONBUILD",
    "STOPSIGNAL",
    "HEALTHCHECK",
    "SHELL",
]);
function extraerBanderas(args: string): {
    banderas: Record<string, string>;
    resto: string;
} {
    const banderas: Record<string, string> = {};
    let resto = args.trimStart();
    for (;;) {
        const m = /^--([A-Za-z][\w-]*)(?:=(\S+))?\s*/.exec(resto);
        if (!m)
            break;
        banderas[m[1]] = m[2] ?? "";
        resto = resto.slice(m[0].length);
    }
    return { banderas, resto: resto.trim() };
}
export function leerDockerfile(texto: string): DockerfileLeido {
    const lineas = texto.split("\n");
    const instrucciones: Instruccion[] = [];
    const etapas: Etapa[] = [];
    const diags: DiagDf[] = [];
    let etapaActual = -1;
    for (let i = 0; i < lineas.length; i++) {
        let cruda = lineas[i].replace(/\r$/, "");
        const numLinea = i + 1;
        if (cruda.trim() === "" || cruda.trimStart().startsWith("#"))
            continue;
        const partes: string[] = [];
        let actual = cruda;
        for (;;) {
            const t = actual.trimEnd();
            if (!t.endsWith("\\") || i + 1 >= lineas.length) {
                partes.push(t);
                break;
            }
            partes.push(t.slice(0, -1));
            i++;
            let sig = lineas[i].replace(/\r$/, "");
            while (sig.trimStart().startsWith("#") && i + 1 < lineas.length) {
                i++;
                sig = lineas[i].replace(/\r$/, "");
            }
            actual = sig.trimStart().startsWith("#") ? "" : sig;
        }
        cruda = partes.join(" ").replace(/\s+/g, " ").trim();
        const m = /^([A-Za-z]+)\s*([\s\S]*)$/.exec(cruda);
        if (!m) {
            diags.push({ gravedad: "error", regla: "linea-no-entendida", linea: numLinea, mensaje: "Docker no sabr\u00EDa qu\u00E9 hacer con esta l\u00EDnea." });
            continue;
        }
        const clave = m[1].toUpperCase();
        if (!CLAVES.has(clave)) {
            diags.push({ gravedad: "error", regla: "instruccion-desconocida", linea: numLinea, mensaje: "`" + m[1] + "` no es una instrucci\u00F3n de Dockerfile." });
            continue;
        }
        const { banderas, resto } = extraerBanderas(m[2]);
        if (clave === "FROM") {
            const f = /^(\S+)(?:\s+[Aa][Ss]\s+(\S+))?$/.exec(resto);
            const base = f?.[1] ?? resto;
            const nombre = f?.[2] ?? null;
            const desdeEtapa = etapas.findIndex(e => e.nombre === base);
            etapaActual = etapas.length;
            etapas.push({ indice: etapaActual, nombre, base, desdeEtapa: desdeEtapa >= 0 ? desdeEtapa : null, instrucciones: [] });
        }
        else if (etapaActual < 0 && clave !== "ARG") {
            diags.push({ gravedad: "error", regla: "antes-del-from", linea: numLinea, mensaje: "`" + clave + "` aparece antes del primer `FROM`: Docker solo admite `ARG` ah\u00ED." });
            continue;
        }
        const ins: Instruccion = { linea: numLinea, clave, argumentos: resto, banderas, crudo: cruda, etapa: Math.max(etapaActual, 0) };
        instrucciones.push(ins);
        if (etapaActual >= 0)
            etapas[etapaActual].instrucciones.push(ins);
    }
    if (etapas.length === 0 && instrucciones.length > 0) {
        diags.push({ gravedad: "error", regla: "sin-from", linea: 1, mensaje: "El Dockerfile no tiene ning\u00FAn `FROM`: no hay imagen de la que partir." });
    }
    return { instrucciones, etapas, diags };
}
export function origenesYDestino(args: string): {
    origenes: string[];
    destino: string;
} {
    const t = args.trim();
    if (t.startsWith("[")) {
        try {
            const arr = JSON.parse(t) as unknown;
            if (Array.isArray(arr) && arr.every(x => typeof x === "string") && arr.length >= 2) {
                return { origenes: arr.slice(0, -1) as string[], destino: arr[arr.length - 1] as string };
            }
        }
        catch { }
    }
    const trozos = t.split(/\s+/).filter(Boolean);
    if (trozos.length < 2)
        return { origenes: trozos, destino: "" };
    return { origenes: trozos.slice(0, -1), destino: trozos[trozos.length - 1] };
}
function origenARegex(origen: string): RegExp {
    let p = origen.replace(/^\.\//, "");
    if (p === "." || p === "./" || p === "")
        return /^.*$/;
    p = p.replace(/\/+$/, "");
    let re = "";
    for (let i = 0; i < p.length; i++) {
        const c = p[i];
        if (c === "*") {
            if (p[i + 1] === "*") {
                re += ".*";
                i++;
            }
            else
                re += "[^/]*";
        }
        else if (c === "?")
            re += "[^/]";
        else
            re += c.replace(/[.+^${}()|[\]\\]/g, "\\$&");
    }
    return new RegExp("^" + re + "(?:/.*)?$");
}
export function ficherosDeCopia(args: string, contexto: readonly string[]): string[] {
    const { origenes } = origenesYDestino(args);
    const out = new Set<string>();
    for (const o of origenes) {
        if (/^https?:\/\//.test(o))
            continue;
        const re = origenARegex(o);
        for (const f of contexto)
            if (re.test(f))
                out.add(f);
    }
    return [...out].sort();
}
export type MotivoCapa = "cacheada" | "fichero-cambiado" | "capa-anterior" | "etapa-anterior";
export interface Capa {
    instruccion: Instruccion;
    aporta: string[];
    culpables: string[];
    rehecha: boolean;
    motivo: MotivoCapa;
}
export interface FicheroContexto {
    ruta: string;
    mtime: number;
}
export interface Simulacion {
    capas: Capa[];
    rehechas: number;
    total: number;
    primeraRehecha: Instruccion | null;
    runsRehechos: Instruccion[];
}
export function simularCache(df: DockerfileLeido, contexto: readonly FicheroContexto[], tUltimaConstruccion: number): Simulacion {
    const rutas = contexto.map(f => f.ruta);
    const cambiado = (r: string) => (contexto.find(f => f.ruta === r)?.mtime ?? 0) > tUltimaConstruccion;
    const capas: Capa[] = [];
    const rotaEtapa = new Map<number, boolean>();
    for (const ins of df.instrucciones) {
        const etapa = ins.etapa;
        let aporta: string[] = [];
        let culpables: string[] = [];
        let rehecha = false;
        let motivo: MotivoCapa = "cacheada";
        const padre = df.etapas[etapa]?.desdeEtapa ?? null;
        if (ins.clave === "FROM" && padre !== null && rotaEtapa.get(padre)) {
            rehecha = true;
            motivo = "etapa-anterior";
        }
        if (rotaEtapa.get(etapa)) {
            rehecha = true;
            motivo = "capa-anterior";
        }
        if (!rehecha && (ins.clave === "COPY" || ins.clave === "ADD")) {
            const desde = ins.banderas["from"];
            if (desde !== undefined) {
                const idx = df.etapas.findIndex(e => e.nombre === desde || String(e.indice) === desde);
                if (idx >= 0 && rotaEtapa.get(idx)) {
                    rehecha = true;
                    motivo = "etapa-anterior";
                }
            }
            else {
                aporta = ficherosDeCopia(ins.argumentos, rutas);
                culpables = aporta.filter(cambiado);
                if (culpables.length > 0) {
                    rehecha = true;
                    motivo = "fichero-cambiado";
                }
            }
        }
        if (rehecha)
            rotaEtapa.set(etapa, true);
        capas.push({ instruccion: ins, aporta, culpables, rehecha, motivo });
    }
    const rehechas = capas.filter(c => c.rehecha);
    return {
        capas,
        rehechas: rehechas.length,
        total: capas.length,
        primeraRehecha: rehechas[0]?.instruccion ?? null,
        runsRehechos: rehechas.filter(c => c.instruccion.clave === "RUN").map(c => c.instruccion),
    };
}
export interface AvisoDf {
    regla: string;
    gravedad: "error" | "aviso" | "info";
    linea: number;
    que: string;
    como: string;
    arreglo: string;
}
const INSTALADORES: {
    re: RegExp;
    manifiesto: string;
}[] = [
    { re: /\bnpm\s+(ci|install|i)\b/, manifiesto: "package.json package-lock.json" },
    { re: /\byarn\s+(install)?\b/, manifiesto: "package.json yarn.lock" },
    { re: /\bpnpm\s+(i|install)\b/, manifiesto: "package.json pnpm-lock.yaml" },
    { re: /\bpip3?\s+install\b/, manifiesto: "requirements.txt" },
    { re: /\bpoetry\s+install\b/, manifiesto: "pyproject.toml poetry.lock" },
    { re: /\bbundle\s+install\b/, manifiesto: "Gemfile Gemfile.lock" },
    { re: /\bgo\s+mod\s+download\b/, manifiesto: "go.mod go.sum" },
    { re: /\bcargo\s+(build|fetch)\b/, manifiesto: "Cargo.toml Cargo.lock" },
    { re: /\bmvn\b[^|]*\bdependency:go-offline\b/, manifiesto: "pom.xml" },
    { re: /\bcomposer\s+install\b/, manifiesto: "composer.json composer.lock" },
];
function esCopiaAmplia(origenes: string[]): boolean {
    return origenes.some(o => {
        const p = o.replace(/^\.\//, "").replace(/\/+$/, "");
        return p === "" || p === "." || p === "*" || p === "**";
    });
}
export function revisarDockerfile(df: DockerfileLeido, contexto: readonly string[] = []): AvisoDf[] {
    const out: AvisoDf[] = [];
    for (const d of df.diags) {
        if (d.gravedad === "error") {
            out.push({ regla: d.regla, gravedad: "error", linea: d.linea, que: d.mensaje, como: "El build falla al leer el fichero.", arreglo: "Corrige la l\u00EDnea se\u00F1alada." });
        }
    }
    for (const etapa of df.etapas) {
        const ins = etapa.instrucciones;
        for (let i = 0; i < ins.length; i++) {
            const a = ins[i];
            if (a.clave !== "COPY" && a.clave !== "ADD")
                continue;
            if (a.banderas["from"] !== undefined)
                continue;
            const { origenes } = origenesYDestino(a.argumentos);
            if (esCopiaAmplia(origenes)) {
                for (let j = i + 1; j < ins.length; j++) {
                    if (ins[j].clave !== "RUN")
                        continue;
                    const inst = INSTALADORES.find(x => x.re.test(ins[j].argumentos));
                    if (!inst)
                        continue;
                    out.push({
                        regla: "copia-amplia-antes-de-instalar",
                        gravedad: "aviso",
                        linea: a.linea,
                        que: "Se copia todo el proyecto (l\u00EDnea " + a.linea + ") ANTES de instalar dependencias (l\u00EDnea " + ins[j].linea + ").",
                        como: "Docker invalida una capa y con ella TODAS las siguientes. Como este `COPY` cambia cada vez que tocas una l\u00EDnea de c\u00F3digo, la instalaci\u00F3n de dependencias se repite entera en cada build, aunque las dependencias no hayan cambiado. Es la causa m\u00E1s com\u00FAn de \u00ABmi build de Docker tarda much\u00EDsimo\u00BB.",
                        arreglo: "Copia primero solo el manifiesto (`COPY " + inst.manifiesto + " ./`), luego el `RUN` que instala, y DESPU\u00C9S el `COPY` del resto. As\u00ED la instalaci\u00F3n solo se rehace cuando cambia el manifiesto.",
                    });
                    break;
                }
            }
            if (contexto.length > 0) {
                const traidos = ficherosDeCopia(a.argumentos, contexto);
                if (traidos.length === 0 && !origenes.some(o => /^https?:\/\//.test(o))) {
                    out.push({
                        regla: "copia-sin-origen",
                        gravedad: "error",
                        linea: a.linea,
                        que: "`" + a.crudo + "` no trae ning\u00FAn fichero del contexto.",
                        como: "Docker aborta con \u00ABno source files were specified\u00BB o \u00ABfile not found\u00BB. Suele pasar cuando el fichero existe en tu disco pero el `.dockerignore` lo deja fuera del contexto \u2014 y entonces el error no cuadra con lo que ves en la carpeta.",
                        arreglo: "Comprueba la ruta y mira la pesta\u00F1a de ignorados: puede que una regla lo est\u00E9 excluyendo del contexto.",
                    });
                }
            }
        }
        for (let i = 0; i < ins.length; i++) {
            if (ins[i].clave !== "RUN")
                continue;
            if (!/\bapt-get\s+update\b/.test(ins[i].argumentos))
                continue;
            if (/\bapt-get\s+(-[^\s]+\s+)*install\b/.test(ins[i].argumentos))
                continue;
            const luego = ins.slice(i + 1).find(x => x.clave === "RUN" && /\bapt-get\s+(-[^\s]+\s+)*install\b/.test(x.argumentos));
            if (!luego)
                continue;
            out.push({
                regla: "apt-update-separado",
                gravedad: "aviso",
                linea: ins[i].linea,
                que: "`apt-get update` (l\u00EDnea " + ins[i].linea + ") va en un `RUN` distinto del `apt-get install` (l\u00EDnea " + luego.linea + ").",
                como: "Docker cachea el `update` por su TEXTO, que no cambia nunca. Al a\u00F1adir un paquete al `install`, esa capa se rehace pero el `update` sale de la cach\u00E9: se instalan versiones seg\u00FAn un \u00EDndice de paquetes de hace meses. Es un fallo silencioso y dif\u00EDcil de reproducir, porque depende de qu\u00E9 haya cacheado la m\u00E1quina.",
                arreglo: "Junta los dos en un solo `RUN` con `&&`.",
            });
            break;
        }
        const from = ins.find(x => x.clave === "FROM");
        if (from && (!from.argumentos.includes(":") || /:latest\b/.test(from.argumentos))) {
            const base = from.argumentos.split(/\s+/)[0];
            if (!df.etapas.some(e => e.nombre === base)) {
                out.push({
                    regla: "base-sin-fijar",
                    gravedad: "info",
                    linea: from.linea,
                    que: "`" + base + "` no fija una versi\u00F3n concreta.",
                    como: "La cach\u00E9 local sigue dando por buena la imagen vieja mientras el registro ya sirve otra: tu m\u00E1quina y el CI construyen cosas distintas a partir del mismo Dockerfile, y no hay nada en el fichero que lo delate.",
                    arreglo: "Fija la etiqueta (`" + base + ":1.2.3`) o, mejor, el digest (`" + base + "@sha256:\u2026`).",
                });
            }
        }
    }
    return out.sort((a, b) => a.linea - b.linea || a.regla.localeCompare(b.regla));
}
