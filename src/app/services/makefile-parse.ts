import { DefVar, DiagMk, TablaVars, CtxExpand, expandir, palabras, casarPatron, } from "./makefile-expand";
export interface LineaReceta {
    texto: string;
    linea: number;
    silenciosa: boolean;
    ignoraError: boolean;
    siempre: boolean;
}
export interface ReglaMk {
    objetivos: string[];
    requisitos: string[];
    soloOrden: string[];
    receta: LineaReceta[];
    linea: number;
    patron: boolean;
    dobleDosPuntos: boolean;
    patronObjetivo?: string;
}
export interface MakefileLeido {
    vars: TablaVars;
    reglas: ReglaMk[];
    phony: Set<string>;
    especiales: Map<string, string[]>;
    objetivoPorDefecto: string | null;
    varsObjetivo: Map<string, DefVar[]>;
    diags: DiagMk[];
    noFiable: boolean;
}
export interface OpcionesLectura {
    ficheros?: readonly string[];
    stubsShell?: Record<string, string>;
    varsLinea?: Record<string, string>;
    contenidoDe?: (ruta: string) => string | null;
}
const ESPECIALES = new Set([
    ".PHONY",
    ".SUFFIXES",
    ".DEFAULT",
    ".PRECIOUS",
    ".INTERMEDIATE",
    ".SECONDARY",
    ".SECONDEXPANSION",
    ".DELETE_ON_ERROR",
    ".IGNORE",
    ".LOW_RESOLUTION_TIME",
    ".SILENT",
    ".EXPORT_ALL_VARIABLES",
    ".NOTPARALLEL",
    ".ONESHELL",
    ".POSIX",
]);
const MAX_INCLUDES = 20;
interface EstadoLectura {
    vars: TablaVars;
    reglas: ReglaMk[];
    phony: Set<string>;
    especiales: Map<string, string[]>;
    varsObjetivo: Map<string, DefVar[]>;
    diags: DiagMk[];
    noFiable: {
        valor: boolean;
    };
    opts: OpcionesLectura;
    objetivoPorDefecto: string | null;
    reglaAbierta: ReglaMk | null;
    profundidadInclude: number;
}
function unirContinuaciones(lineas: string[], i: number): {
    texto: string;
    siguiente: number;
} {
    let texto = lineas[i];
    let j = i;
    while (texto.endsWith("\\") && !texto.endsWith("\\\\") && j + 1 < lineas.length) {
        texto = texto.slice(0, -1) + " " + lineas[j + 1].replace(/^[ \t]+/, "");
        j++;
    }
    return { texto, siguiente: j };
}
function quitarComentario(s: string): string {
    let nivel = 0;
    for (let i = 0; i < s.length; i++) {
        const c = s[i];
        if (c === "\\" && s[i + 1] === "#") {
            i++;
            continue;
        }
        if (c === "(" || c === "{")
            nivel++;
        else if (c === ")" || c === "}")
            nivel--;
        else if (c === "#" && nivel === 0)
            return s.slice(0, i);
    }
    return s;
}
type Operador = "=" | ":=" | "::=" | "?=" | "+=" | "!=";
function buscarAsignacion(s: string): {
    pos: number;
    op: Operador;
} | null {
    let nivel = 0;
    for (let i = 0; i < s.length; i++) {
        const c = s[i];
        if (c === "(" || c === "{") {
            nivel++;
            continue;
        }
        if (c === ")" || c === "}") {
            nivel--;
            continue;
        }
        if (nivel !== 0)
            continue;
        if (c === "?" && s[i + 1] === "=")
            return { pos: i, op: "?=" };
        if (c === "+" && s[i + 1] === "=")
            return { pos: i, op: "+=" };
        if (c === "!" && s[i + 1] === "=")
            return { pos: i, op: "!=" };
        if (c === ":") {
            if (s[i + 1] === "=")
                return { pos: i, op: ":=" };
            if (s[i + 1] === ":" && s[i + 2] === "=")
                return { pos: i, op: "::=" };
            return null;
        }
        if (c === "=")
            return { pos: i, op: "=" };
    }
    return null;
}
function ctxDe(e: EstadoLectura, linea: number): CtxExpand {
    return {
        vars: e.vars,
        ficheros: e.opts.ficheros,
        stubsShell: e.opts.stubsShell,
        linea,
        diags: e.diags,
        marcaNoFiable: e.noFiable,
    };
}
function asignar(e: EstadoLectura, nombre: string, op: Operador, crudo: string, linea: number, origen: DefVar["origen"]): void {
    const previo = e.vars.get(nombre);
    if (previo?.origen === "linea-de-comandos" && origen === "fichero")
        return;
    if (op === "?=") {
        if (previo)
            return;
        e.vars.set(nombre, { nombre, sabor: "recursiva", valor: crudo, crudo, linea, origen });
        return;
    }
    if (op === "+=") {
        if (!previo) {
            e.vars.set(nombre, { nombre, sabor: "recursiva", valor: crudo, crudo, linea, origen });
            return;
        }
        const añadido = previo.sabor === "simple" ? expandir(crudo, ctxDe(e, linea)) : crudo;
        e.vars.set(nombre, {
            ...previo,
            linea,
            valor: previo.valor === "" ? añadido : previo.valor + " " + añadido,
            crudo: previo.crudo ? previo.crudo + " " + crudo : crudo,
        });
        return;
    }
    if (op === "=") {
        e.vars.set(nombre, { nombre, sabor: "recursiva", valor: crudo, crudo, linea, origen });
        return;
    }
    if (op === "!=") {
        const cmd = expandir(crudo, ctxDe(e, linea)).trim();
        const stub = e.opts.stubsShell?.[cmd];
        if (stub === undefined) {
            e.noFiable.valor = true;
            e.diags.push({
                gravedad: "aviso",
                regla: "shell-no-ejecutable",
                linea,
                mensaje: "`" + nombre + " != " + cmd + "` ejecuta un comando: en el navegador no se puede, se queda vac\u00EDo.",
            });
        }
        e.vars.set(nombre, { nombre, sabor: "simple", valor: stub ?? "", crudo: "$(shell " + crudo + ")", linea, origen });
        return;
    }
    e.vars.set(nombre, { nombre, sabor: "simple", valor: expandir(crudo, ctxDe(e, linea)), crudo, linea, origen });
}
function evaluarCondicional(e: EstadoLectura, directiva: string, resto: string, linea: number): boolean {
    const ctx = ctxDe(e, linea);
    if (directiva === "ifdef" || directiva === "ifndef") {
        const nombre = expandir(resto, ctx).trim();
        const def = e.vars.get(nombre);
        const definida = !!def && expandir(def.sabor === "recursiva" ? def.valor : def.valor, ctx) !== "";
        return directiva === "ifdef" ? definida : !definida;
    }
    let a = "", b = "";
    const m = /^\((.*)\)\s*$/.exec(resto.trim());
    if (m) {
        const partes = m[1].split(",");
        a = expandir(partes[0] ?? "", ctx).trim();
        b = expandir(partes.slice(1).join(",") ?? "", ctx).trim();
    }
    else {
        const c = /^(['"])(.*?)\1\s*(['"])(.*?)\3\s*$/.exec(resto.trim());
        if (c) {
            a = expandir(c[2], ctx).trim();
            b = expandir(c[4], ctx).trim();
        }
        else {
            e.diags.push({ gravedad: "error", regla: "condicional-mal-formada", linea, mensaje: "`" + directiva + "` mal formado: se espera `" + directiva + " (a,b)` o `" + directiva + " \"a\" \"b\"`." });
            return false;
        }
    }
    return directiva === "ifeq" ? a === b : a !== b;
}
function leerPrefijos(texto: string, linea: number): LineaReceta {
    let i = 0, silenciosa = false, ignoraError = false, siempre = false;
    while (i < texto.length) {
        const c = texto[i];
        if (c === "@") {
            silenciosa = true;
            i++;
        }
        else if (c === "-") {
            ignoraError = true;
            i++;
        }
        else if (c === "+") {
            siempre = true;
            i++;
        }
        else
            break;
    }
    return { texto: texto.slice(i), linea, silenciosa, ignoraError, siempre };
}
function registrarRegla(e: EstadoLectura, regla: ReglaMk): void {
    const normales: string[] = [];
    for (const t of regla.objetivos) {
        if (t === ".PHONY") {
            for (const p of regla.requisitos)
                e.phony.add(p);
            continue;
        }
        if (ESPECIALES.has(t)) {
            e.especiales.set(t, [...(e.especiales.get(t) ?? []), ...regla.requisitos]);
            continue;
        }
        normales.push(t);
    }
    if (normales.length === 0)
        return;
    regla.objetivos = normales;
    e.reglas.push(regla);
    if (e.objetivoPorDefecto === null && !regla.patron)
        e.objetivoPorDefecto = normales[0];
    e.reglaAbierta = regla;
}
function leerTexto(e: EstadoLectura, texto: string): void {
    const lineas = texto.split("\n");
    const pila: {
        activo: boolean;
        yaTomada: boolean;
        padreActivo: boolean;
    }[] = [];
    const activo = () => pila.length === 0 || pila[pila.length - 1].activo;
    for (let i = 0; i < lineas.length; i++) {
        const cruda = lineas[i];
        const numLinea = i + 1;
        if (cruda.startsWith("\t")) {
            if (!activo())
                continue;
            let cuerpo = cruda.slice(1);
            while (cuerpo.endsWith("\\") && i + 1 < lineas.length) {
                cuerpo = cuerpo.slice(0, -1) + "\n" + lineas[i + 1].replace(/^\t/, "");
                i++;
            }
            if (e.reglaAbierta)
                e.reglaAbierta.receta.push(leerPrefijos(cuerpo, numLinea));
            else if (cuerpo.trim() !== "") {
                e.diags.push({
                    gravedad: "error",
                    regla: "receta-sin-regla",
                    linea: numLinea,
                    mensaje: "L\u00EDnea con tabulador fuera de cualquier regla: make la tratar\u00EDa como comando sin saber de qu\u00E9 objetivo.",
                });
            }
            continue;
        }
        const sinComentario = quitarComentario(cruda);
        if (sinComentario.trim() === "") {
            continue;
        }
        const { texto: linea, siguiente } = unirContinuaciones(lineas, i);
        const limpia = quitarComentario(linea).trim();
        i = siguiente;
        if (limpia === "")
            continue;
        const cond = /^(ifeq|ifneq|ifdef|ifndef)\b\s*([\s\S]*)$/.exec(limpia);
        if (cond) {
            const padreActivo = activo();
            const v = padreActivo ? evaluarCondicional(e, cond[1], cond[2], numLinea) : false;
            pila.push({ activo: padreActivo && v, yaTomada: v, padreActivo });
            continue;
        }
        if (/^else\b/.test(limpia)) {
            const top = pila[pila.length - 1];
            if (!top) {
                e.diags.push({ gravedad: "error", regla: "else-suelto", linea: numLinea, mensaje: "`else` sin un `if` abierto." });
                continue;
            }
            const resto = limpia.replace(/^else\s*/, "");
            const encadenado = /^(ifeq|ifneq|ifdef|ifndef)\b\s*([\s\S]*)$/.exec(resto);
            if (encadenado) {
                const v = top.padreActivo && !top.yaTomada && evaluarCondicional(e, encadenado[1], encadenado[2], numLinea);
                top.activo = v;
                top.yaTomada = top.yaTomada || v;
            }
            else {
                top.activo = top.padreActivo && !top.yaTomada;
                top.yaTomada = true;
            }
            continue;
        }
        if (/^endif\b/.test(limpia)) {
            if (pila.pop() === undefined)
                e.diags.push({ gravedad: "error", regla: "endif-suelto", linea: numLinea, mensaje: "`endif` sin un `if` abierto." });
            continue;
        }
        if (!activo())
            continue;
        const def = /^define\s+([^\s:+?=]+)\s*(:?:?=|\+=|\?=)?\s*$/.exec(limpia);
        if (def) {
            const cuerpo: string[] = [];
            let j = i + 1;
            for (; j < lineas.length && !/^endef\b/.test(lineas[j].trim()); j++)
                cuerpo.push(lineas[j]);
            if (j >= lineas.length)
                e.diags.push({ gravedad: "error", regla: "define-sin-endef", linea: numLinea, mensaje: "`define " + def[1] + "` no se cierra con `endef`." });
            asignar(e, def[1], (def[2] as Operador) || "=", cuerpo.join("\n"), numLinea, "fichero");
            i = j;
            e.reglaAbierta = null;
            continue;
        }
        const inc = /^(-include|sinclude|include)\s+([\s\S]+)$/.exec(limpia);
        if (inc) {
            e.reglaAbierta = null;
            const opcional = inc[1] !== "include";
            for (const ruta of palabras(expandir(inc[2], ctxDe(e, numLinea)))) {
                const contenido = e.opts.contenidoDe?.(ruta) ?? null;
                if (contenido === null) {
                    if (!opcional) {
                        e.diags.push({ gravedad: "error", regla: "include-no-encontrado", linea: numLinea, mensaje: "`include " + ruta + "`: ese fichero no est\u00E1 en el proyecto, y con `include` (sin `-`) make aborta." });
                    }
                    e.noFiable.valor = true;
                    continue;
                }
                if (e.profundidadInclude >= MAX_INCLUDES) {
                    e.diags.push({ gravedad: "error", regla: "include-circular", linea: numLinea, mensaje: "Demasiados `include` anidados: hay ficheros que se incluyen entre s\u00ED." });
                    break;
                }
                e.profundidadInclude++;
                leerTexto(e, contenido);
                e.profundidadInclude--;
            }
            continue;
        }
        if (/^(export|unexport|vpath|undefine)\b/.test(limpia)) {
            const und = /^undefine\s+(\S+)/.exec(limpia);
            if (und) {
                e.vars.delete(und[1]);
                e.reglaAbierta = null;
                continue;
            }
            const exp = /^export\s+(\S+)\s*(:?:?=|\+=|\?=|!=)\s*([\s\S]*)$/.exec(limpia);
            if (exp) {
                asignar(e, exp[1], exp[2] as Operador, exp[3], numLinea, "fichero");
                e.reglaAbierta = null;
                continue;
            }
            e.reglaAbierta = null;
            continue;
        }
        const over = /^override\s+([\s\S]+)$/.exec(limpia);
        const cuerpoLinea = over ? over[1] : limpia;
        const asig = buscarAsignacion(cuerpoLinea);
        const dosPuntos = posicionDosPuntosRegla(cuerpoLinea);
        if (asig && (dosPuntos < 0 || asig.pos <= dosPuntos)) {
            const nombre = cuerpoLinea.slice(0, asig.pos).trim();
            if (!/^[^\s:=#]+$/.test(nombre)) {
                e.diags.push({ gravedad: "error", regla: "nombre-variable-invalido", linea: numLinea, mensaje: "Nombre de variable no v\u00E1lido: `" + nombre + "`." });
                continue;
            }
            asignar(e, nombre, asig.op, cuerpoLinea.slice(asig.pos + asig.op.length).trim(), numLinea, "fichero");
            e.reglaAbierta = null;
            continue;
        }
        if (dosPuntos >= 0) {
            leerRegla(e, cuerpoLinea, dosPuntos, numLinea);
            continue;
        }
        if (/^[ ]+\S/.test(cruda) && e.reglaAbierta) {
            e.diags.push({
                gravedad: "error",
                regla: "receta-con-espacios",
                linea: numLinea,
                mensaje: "Esta l\u00EDnea est\u00E1 indentada con ESPACIOS. Las recetas necesitan un tabulador: make responde `*** missing separator. Stop.` y no dice m\u00E1s.",
            });
            continue;
        }
        e.diags.push({ gravedad: "error", regla: "linea-no-entendida", linea: numLinea, mensaje: "make no sabr\u00EDa qu\u00E9 hacer con esta l\u00EDnea: no es una asignaci\u00F3n, ni una regla, ni una directiva." });
    }
    if (pila.length > 0) {
        e.diags.push({ gravedad: "error", regla: "if-sin-cerrar", linea: lineas.length, mensaje: "Queda(n) " + pila.length + " condicional(es) sin su `endif`." });
    }
}
function posicionDosPuntosRegla(s: string): number {
    let nivel = 0;
    for (let i = 0; i < s.length; i++) {
        const c = s[i];
        if (c === "(" || c === "{")
            nivel++;
        else if (c === ")" || c === "}")
            nivel--;
        else if (c === ":" && nivel === 0) {
            if (s[i + 1] === "=")
                return -1;
            if (s[i + 1] === ":" && s[i + 2] === "=")
                return -1;
            if (i === 1 && /[A-Za-z]/.test(s[0]) && (s[2] === "\\" || s[2] === "/"))
                continue;
            return i;
        }
    }
    return -1;
}
function leerRegla(e: EstadoLectura, linea: string, dosPuntos: number, numLinea: number): void {
    const ctx = ctxDe(e, numLinea);
    const dobleDosPuntos = linea[dosPuntos + 1] === ":";
    const izq = linea.slice(0, dosPuntos);
    let der = linea.slice(dosPuntos + (dobleDosPuntos ? 2 : 1));
    let recetaEnLinea: string | null = null;
    const puntoYComa = der.indexOf(";");
    if (puntoYComa >= 0) {
        recetaEnLinea = der.slice(puntoYComa + 1);
        der = der.slice(0, puntoYComa);
    }
    const objetivos = palabras(expandir(izq, ctx));
    if (objetivos.length === 0) {
        e.diags.push({ gravedad: "error", regla: "regla-sin-objetivo", linea: numLinea, mensaje: "Regla sin objetivo a la izquierda de los dos puntos (\u00BFuna variable que se expandi\u00F3 a vac\u00EDo?)." });
        return;
    }
    const varObj = /^\s*(?:override\s+|export\s+)*([^\s:=]+)\s*(:?:?=|\+=|\?=)\s*([\s\S]*)$/.exec(der);
    if (varObj && posicionDosPuntosRegla(der) < 0) {
        for (const t of objetivos) {
            const lista = e.varsObjetivo.get(t) ?? [];
            lista.push({ nombre: varObj[1], sabor: varObj[2] === "=" ? "recursiva" : "simple", valor: varObj[3].trim(), linea: numLinea, origen: "fichero" });
            e.varsObjetivo.set(t, lista);
        }
        e.reglaAbierta = null;
        return;
    }
    let patronObjetivo: string | undefined;
    const segundos = posicionDosPuntosRegla(der);
    if (segundos >= 0) {
        patronObjetivo = expandir(der.slice(0, segundos), ctx).trim();
        der = der.slice(segundos + 1);
    }
    const derExp = expandir(der, ctx);
    const barra = derExp.indexOf("|");
    const requisitos = palabras(barra >= 0 ? derExp.slice(0, barra) : derExp);
    const soloOrden = barra >= 0 ? palabras(derExp.slice(barra + 1)) : [];
    const esPatron = !patronObjetivo && objetivos.some(t => t.includes("%"));
    if (patronObjetivo) {
        for (const t of objetivos) {
            if (casarPatron(patronObjetivo, t) === null) {
                e.diags.push({ gravedad: "error", regla: "estatica-no-casa", linea: numLinea, mensaje: "El objetivo `" + t + "` no casa con el patr\u00F3n `" + patronObjetivo + "` de su regla est\u00E1tica." });
            }
        }
    }
    const regla: ReglaMk = {
        objetivos,
        requisitos,
        soloOrden,
        receta: [],
        linea: numLinea,
        patron: esPatron,
        dobleDosPuntos,
        ...(patronObjetivo ? { patronObjetivo } : {}),
    };
    registrarRegla(e, regla);
    if (recetaEnLinea !== null && recetaEnLinea.trim() !== "" && e.reglaAbierta) {
        e.reglaAbierta.receta.push(leerPrefijos(recetaEnLinea.trim(), numLinea));
    }
}
export function leerMakefile(texto: string, opts: OpcionesLectura = {}): MakefileLeido {
    const vars: TablaVars = new Map();
    for (const [n, v] of [["CC", "cc"], ["CXX", "g++"], ["AR", "ar"], ["RM", "rm -f"], ["MAKE", "make"], ["SHELL", "/bin/sh"]]) {
        vars.set(n, { nombre: n, sabor: "simple", valor: v, linea: 0, origen: "por-defecto" });
    }
    for (const n of ["CURDIR", "MAKEFILE_LIST", "MAKECMDGOALS", "MAKEFLAGS", "MAKE_VERSION", "MAKE_HOST"]) {
        vars.set(n, { nombre: n, sabor: "simple", valor: "", linea: 0, origen: "por-defecto" });
    }
    for (const [n, v] of Object.entries(opts.varsLinea ?? {})) {
        vars.set(n, { nombre: n, sabor: "simple", valor: v, linea: 0, origen: "linea-de-comandos" });
    }
    const e: EstadoLectura = {
        vars,
        reglas: [],
        phony: new Set(),
        especiales: new Map(),
        varsObjetivo: new Map(),
        diags: [],
        noFiable: { valor: false },
        opts,
        objetivoPorDefecto: null,
        reglaAbierta: null,
        profundidadInclude: 0,
    };
    leerTexto(e, texto);
    const dg = e.vars.get(".DEFAULT_GOAL");
    const forzado = dg ? expandir(dg.sabor === "recursiva" ? dg.valor : dg.valor, ctxDe(e, 0)).trim() : "";
    return {
        vars: e.vars,
        reglas: e.reglas,
        phony: e.phony,
        especiales: e.especiales,
        objetivoPorDefecto: forzado || e.objetivoPorDefecto,
        varsObjetivo: e.varsObjetivo,
        diags: e.diags,
        noFiable: e.noFiable.valor,
    };
}
