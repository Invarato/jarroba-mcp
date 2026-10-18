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
export type CausaDivergencia = "excepcion-bloqueada-en-git" | "regla-sin-barras" | "fuera-en-git" | "fuera-en-docker";
export type DatosIgnore = Record<string, string | number>;
export interface Divergencia {
    ruta: string;
    ignoradoGit: boolean;
    ignoradoDocker: boolean;
    causa: CausaDivergencia;
    datos: DatosIgnore;
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
        let causa: CausaDivergencia;
        let datos: DatosIgnore;
        if (g.ignorado && !d.ignorado && g.bloqueadoPor && d.regla?.negada) {
            causa = "excepcion-bloqueada-en-git";
            datos = { excepcion: d.regla.crudo.trim(), linea: d.regla.linea, ancestro: g.bloqueadoPor.ancestro, lineaAncestro: g.bloqueadoPor.regla.linea };
        }
        else if (g.ignorado && !d.ignorado && g.regla && !g.regla.anclada) {
            causa = "regla-sin-barras";
            datos = { linea: g.regla.linea, regla: g.regla.crudo.trim(), patron: g.regla.patron };
        }
        else if (g.ignorado && !d.ignorado) {
            causa = "fuera-en-git";
            datos = { linea: g.regla?.linea ?? 0 };
        }
        else {
            causa = "fuera-en-docker";
            datos = d.regla ? { linea: d.regla.linea, regla: d.regla.crudo.trim() } : {};
        }
        out.push({ ruta, ignoradoGit: g.ignorado, ignoradoDocker: d.ignorado, causa, datos });
    }
    return out;
}
export type ReglaAvisoIgnore = "reinclusion-bloqueada" | "regla-anulada" | "docker-solo-raiz" | "regla-sin-efecto";
export interface AvisoIgnore {
    regla: ReglaAvisoIgnore;
    gravedad: "error" | "aviso" | "info";
    linea: number;
    datos: DatosIgnore;
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
                    datos: { excepcion: r.crudo.trim(), ancestro: ej.ancestro, lineaAncestro: ej.regla.linea },
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
                    datos: { regla: r.crudo.trim(), lineaQueAnula: s.linea, anula: s.crudo.trim() },
                });
                break;
            }
        }
        if (modo === "docker" && !r.patron.includes("/") && !r.patron.startsWith("**")) {
            out.push({
                regla: "docker-solo-raiz",
                gravedad: "aviso",
                linea: r.linea,
                datos: { patron: r.patron },
            });
        }
        if (rutas.length > 0 && !rutas.some(p => casa(r, p, directorios.has(p)))) {
            out.push({
                regla: "regla-sin-efecto",
                gravedad: "info",
                linea: r.linea,
                datos: { regla: r.crudo.trim() },
            });
        }
    }
    return out.sort((a, b) => a.linea - b.linea || a.regla.localeCompare(b.regla));
}
