export type ModoIgnore = "git" | "docker";
export interface ReglaIgnore {
    linea: number;
    crudo: string;
    patron: string;
    negada: boolean;
    soloDirectorios: boolean;
    anclada: boolean;
    re: RegExp;
}
export interface Decision {
    ruta: string;
    esDirectorio: boolean;
    ignorado: boolean;
    regla: ReglaIgnore | null;
    bloqueadoPor: {
        ancestro: string;
        regla: ReglaIgnore;
    } | null;
}
export interface Divergencia {
    ruta: string;
    ignoradoGit: boolean;
    ignoradoDocker: boolean;
    explicacion: string;
}
function recortarFinal(s: string): string {
    let fin = s.length;
    while (fin > 0 && (s[fin - 1] === " " || s[fin - 1] === "\t")) {
        let barras = 0;
        for (let k = fin - 2; k >= 0 && s[k] === "\\"; k--)
            barras++;
        if (barras % 2 === 1)
            break;
        fin--;
    }
    return s.slice(0, fin);
}
function segmentoARegex(seg: string): string {
    let re = "";
    for (let i = 0; i < seg.length; i++) {
        const c = seg[i];
        if (c === "\\" && i + 1 < seg.length) {
            re += seg[i + 1].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            i++;
        }
        else if (c === "*")
            re += "[^/]*";
        else if (c === "?")
            re += "[^/]";
        else if (c === "[") {
            const cierre = seg.indexOf("]", i + 1);
            if (cierre < 0) {
                re += "\\[";
                continue;
            }
            let clase = seg.slice(i + 1, cierre);
            if (clase.startsWith("!"))
                clase = "^" + clase.slice(1);
            re += "[" + clase.replace(/\\/g, "\\\\") + "]";
            i = cierre;
        }
        else
            re += c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }
    return re;
}
function patronARegex(patron: string, anclada: boolean): RegExp {
    const segs = patron.split("/");
    let re = "";
    for (let i = 0; i < segs.length; i++) {
        const s = segs[i];
        const ultimo = i === segs.length - 1;
        if (s === "**") {
            re += ultimo ? ".*" : "(?:[^/]+/)*";
            continue;
        }
        re += segmentoARegex(s) + (ultimo ? "" : "/");
    }
    return new RegExp("^" + (anclada ? "" : "(?:.*/)?") + re + "$");
}
export function leerReglas(texto: string, modo: ModoIgnore): ReglaIgnore[] {
    const out: ReglaIgnore[] = [];
    const lineas = texto.split("\n");
    for (let i = 0; i < lineas.length; i++) {
        const crudo = lineas[i];
        let s = recortarFinal(crudo.replace(/\r$/, ""));
        if (s.trim() === "")
            continue;
        if (s.startsWith("#"))
            continue;
        if (s.startsWith("\\#"))
            s = s.slice(1);
        let negada = false;
        if (s.startsWith("!")) {
            negada = true;
            s = s.slice(1);
        }
        else if (s.startsWith("\\!"))
            s = s.slice(1);
        if (s === "")
            continue;
        let soloDirectorios = false;
        if (s.endsWith("/") && s !== "/") {
            soloDirectorios = true;
            s = s.slice(0, -1);
        }
        let anclada: boolean;
        if (modo === "docker") {
            s = s.replace(/^\/+/, "");
            anclada = true;
            soloDirectorios = false;
        }
        else {
            if (s.startsWith("/")) {
                s = s.slice(1);
                anclada = true;
            }
            else
                anclada = s.includes("/");
        }
        if (s === "")
            continue;
        out.push({ linea: i + 1, crudo, patron: s, negada, soloDirectorios, anclada, re: patronARegex(s, anclada) });
    }
    return out;
}
function casa(r: ReglaIgnore, ruta: string, esDir: boolean): boolean {
    if (r.soloDirectorios && !esDir)
        return false;
    return r.re.test(ruta);
}
function ultimaCoincidencia(reglas: readonly ReglaIgnore[], ruta: string, esDir: boolean): ReglaIgnore | null {
    let ult: ReglaIgnore | null = null;
    for (const r of reglas)
        if (casa(r, ruta, esDir))
            ult = r;
    return ult;
}
function ancestros(ruta: string): string[] {
    const partes = ruta.split("/");
    const out: string[] = [];
    for (let i = 1; i < partes.length; i++)
        out.push(partes.slice(0, i).join("/"));
    return out;
}
export function decidir(reglas: readonly ReglaIgnore[], ruta: string, esDirectorio: boolean, modo: ModoIgnore): Decision {
    const base: Decision = { ruta, esDirectorio, ignorado: false, regla: null, bloqueadoPor: null };
    if (modo === "git") {
        for (const anc of ancestros(ruta)) {
            const r = ultimaCoincidencia(reglas, anc, true);
            if (r && !r.negada) {
                return { ...base, ignorado: true, regla: r, bloqueadoPor: { ancestro: anc, regla: r } };
            }
        }
        const propia = ultimaCoincidencia(reglas, ruta, esDirectorio);
        return { ...base, ignorado: !!propia && !propia.negada, regla: propia };
    }
    const propia = ultimaCoincidencia(reglas, ruta, esDirectorio);
    if (propia)
        return { ...base, ignorado: !propia.negada, regla: propia };
    for (const anc of [...ancestros(ruta)].reverse()) {
        const r = ultimaCoincidencia(reglas, anc, true);
        if (r)
            return { ...base, ignorado: !r.negada, regla: r, bloqueadoPor: r.negada ? null : { ancestro: anc, regla: r } };
    }
    return base;
}
export function decidirTodas(reglas: readonly ReglaIgnore[], rutas: readonly string[], directorios: ReadonlySet<string>, modo: ModoIgnore): Decision[] {
    return rutas.map(r => decidir(reglas, r, directorios.has(r), modo));
}
export function comparar(texto: string, rutas: readonly string[], directorios: ReadonlySet<string>): Divergencia[] {
    const rg = leerReglas(texto, "git");
    const rd = leerReglas(texto, "docker");
    const out: Divergencia[] = [];
    for (const ruta of rutas) {
        const esDir = directorios.has(ruta);
        const g = decidir(rg, ruta, esDir, "git");
        const d = decidir(rd, ruta, esDir, "docker");
        if (g.ignorado === d.ignorado)
            continue;
        let explicacion: string;
        if (g.ignorado && !d.ignorado && g.bloqueadoPor && d.regla?.negada) {
            explicacion = "Es la excepci\u00F3n `" + d.regla.crudo.trim() + "` (l\u00EDnea " + d.regla.linea + "): Docker la aplica y git NO, "
                + "porque para git la carpeta `" + g.bloqueadoPor.ancestro + "` ya est\u00E1 excluida (l\u00EDnea " + g.bloqueadoPor.regla.linea + ") "
                + "y no entra en carpetas excluidas. Para que git tambi\u00E9n lo rescate, excluye el contenido "
                + "(`" + g.bloqueadoPor.ancestro + "/*`) en vez de la carpeta.";
        }
        else if (g.ignorado && !d.ignorado && g.regla && !g.regla.anclada) {
            explicacion = "La regla de la l\u00EDnea " + g.regla.linea + " (`" + g.regla.crudo.trim() + "`) no lleva barras: git la aplica a cualquier "
                + "profundidad, pero Docker solo la aplica en la ra\u00EDz. En el contexto de build esto ENTRA. "
                + "Se arregla escribiendo `**/" + g.regla.patron + "`.";
        }
        else if (g.ignorado && !d.ignorado) {
            explicacion = "Git lo deja fuera y Docker lo mete: revisa la regla de la l\u00EDnea " + (g.regla?.linea ?? 0) + ".";
        }
        else {
            const r = d.regla;
            explicacion = "Docker lo deja fuera y git lo mete"
                + (r ? " (regla de la l\u00EDnea " + r.linea + ": `" + r.crudo.trim() + "`)" : "")
                + ". Suele pasar cuando en git la ruta se salva por un `!` que Docker no aplica igual.";
        }
        out.push({ ruta, ignoradoGit: g.ignorado, ignoradoDocker: d.ignorado, explicacion });
    }
    return out;
}
export interface AvisoIgnore {
    regla: string;
    gravedad: "error" | "aviso" | "info";
    linea: number;
    que: string;
    como: string;
    arreglo: string;
}
export function revisarIgnore(texto: string, modo: ModoIgnore, rutas: readonly string[] = [], directorios: ReadonlySet<string> = new Set()): AvisoIgnore[] {
    const reglas = leerReglas(texto, modo);
    const out: AvisoIgnore[] = [];
    for (let i = 0; i < reglas.length; i++) {
        const r = reglas[i];
        if (modo === "git" && r.negada) {
            const rescatadas = rutas.filter(p => casa(r, p, directorios.has(p)));
            const bloqueadas = rescatadas.filter(p => decidir(reglas, p, directorios.has(p), "git").bloqueadoPor !== null);
            if (rescatadas.length > 0 && bloqueadas.length === rescatadas.length) {
                const ej = decidir(reglas, bloqueadas[0], directorios.has(bloqueadas[0]), "git").bloqueadoPor!;
                out.push({
                    regla: "reinclusion-bloqueada",
                    gravedad: "error",
                    linea: r.linea,
                    que: "Esta excepci\u00F3n no hace nada: `" + r.crudo.trim() + "`.",
                    como: "El directorio `" + ej.ancestro + "` ya est\u00E1 excluido por la l\u00EDnea " + ej.regla.linea + ". Git NO entra en un directorio excluido \u2014lo dice su documentaci\u00F3n: no los lista por rendimiento\u2014, as\u00ED que las reglas sobre lo que hay dentro no tienen efecto, se escriban donde se escriban. Es la causa n\u00FAmero uno de \u00ABmi `!` no funciona\u00BB.",
                    arreglo: "Excluye el CONTENIDO en vez del directorio (`" + ej.ancestro + "/*` en lugar de `" + ej.ancestro + "`) y entonces la excepci\u00F3n s\u00ED entra.",
                });
            }
        }
        for (let j = i + 1; j < reglas.length; j++) {
            const s = reglas[j];
            if (s.negada === r.negada)
                continue;
            if (s.patron === r.patron && s.soloDirectorios === r.soloDirectorios && s.anclada === r.anclada) {
                out.push({
                    regla: "regla-anulada",
                    gravedad: "aviso",
                    linea: r.linea,
                    que: "La l\u00EDnea " + r.linea + " (`" + r.crudo.trim() + "`) queda anulada por la " + s.linea + " (`" + s.crudo.trim() + "`).",
                    como: "En los dos formatos manda la \u00DALTIMA regla que casa, as\u00ED que la de arriba no llega a decidir nunca.",
                    arreglo: "Borra una de las dos, o c\u00E1mbialas de orden si lo que quer\u00EDas era lo contrario.",
                });
                break;
            }
        }
        if (modo === "docker" && !r.patron.includes("/") && !r.patron.startsWith("**")) {
            out.push({
                regla: "docker-solo-raiz",
                gravedad: "aviso",
                linea: r.linea,
                que: "`" + r.patron + "` solo casa en la RA\u00CDZ del contexto, no a cualquier profundidad.",
                como: "Es la diferencia grande con `.gitignore`, y el error n\u00FAmero uno al copiar uno en el otro: en git un patr\u00F3n sin barras se ancla con un `**/` impl\u00EDcito, y en Docker no. Un `" + r.patron + "` anidado ENTRA en el contexto de build, engord\u00E1ndolo y a veces filtrando lo que cre\u00EDas dejar fuera.",
                arreglo: "Escribe `**/" + r.patron + "` si lo quieres a cualquier profundidad.",
            });
        }
        if (rutas.length > 0 && !rutas.some(p => casa(r, p, directorios.has(p)))) {
            out.push({
                regla: "regla-sin-efecto",
                gravedad: "info",
                linea: r.linea,
                que: "`" + r.crudo.trim() + "` no casa con ning\u00FAn fichero del proyecto.",
                como: "No rompe nada, pero o sobra o tiene una errata \u2014 y una regla que nadie comprueba se queda ah\u00ED para siempre dando falsa sensaci\u00F3n de estar cubierto.",
                arreglo: "Compru\u00E9bala contra el \u00E1rbol de la izquierda; si es para ficheros que a\u00FAn no existen, ignora este aviso.",
            });
        }
    }
    return out.sort((a, b) => a.linea - b.linea || a.regla.localeCompare(b.regla));
}
