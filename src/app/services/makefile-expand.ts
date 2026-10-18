export type SaborVar = "recursiva" | "simple";
export interface DefVar {
    nombre: string;
    sabor: SaborVar;
    valor: string;
    linea: number;
    origen: "fichero" | "linea-de-comandos" | "entorno" | "automatica" | "por-defecto";
    crudo?: string;
}
export type TablaVars = Map<string, DefVar>;
export type GravedadMk = "error" | "aviso" | "info";
export type ReglaDiagMk = "expansion-infinita" | "parentesis-sin-cerrar" | "word-indice" | "shell-no-ejecutable" | "error-explicito" | "warning-explicito" | "info-explicito" | "eval-no-soportado" | "condicional-mal-formada" | "receta-sin-regla" | "else-suelto" | "endif-suelto" | "define-sin-endef" | "include-no-encontrado" | "include-circular" | "nombre-variable-invalido" | "receta-con-espacios" | "linea-no-entendida" | "if-sin-cerrar" | "regla-sin-objetivo" | "estatica-no-casa" | "dependencia-circular" | "grafo-demasiado-grande" | "cadena-demasiado-profunda" | "sin-regla-ni-fichero" | "sin-objetivo";
export type DatosMk = Record<string, string | number>;
export interface DiagMk {
    gravedad: GravedadMk;
    regla: ReglaDiagMk;
    datos: DatosMk;
    linea: number;
}
export interface CtxExpand {
    vars: TablaVars;
    auto?: Record<string, string>;
    ficheros?: readonly string[];
    stubsShell?: Record<string, string>;
    linea?: number;
    diags?: DiagMk[];
    marcaNoFiable?: {
        valor: boolean;
    };
}
const MAX_PROFUNDIDAD = 60;
function diag(ctx: CtxExpand, gravedad: GravedadMk, regla: ReglaDiagMk, datos: DatosMk = {}): void {
    ctx.diags?.push({ gravedad, regla, datos, linea: ctx.linea ?? 0 });
}
export function palabras(s: string): string[] {
    return s.split(/\s+/).filter(w => w.length > 0);
}
function globARegex(patron: string): RegExp {
    let re = "";
    for (let i = 0; i < patron.length; i++) {
        const c = patron[i];
        if (c === "*")
            re += "[^/]*";
        else if (c === "?")
            re += "[^/]";
        else if (c === "[") {
            const cierre = patron.indexOf("]", i + 1);
            if (cierre < 0) {
                re += "\\[";
                continue;
            }
            let clase = patron.slice(i + 1, cierre);
            if (clase.startsWith("!"))
                clase = "^" + clase.slice(1);
            re += "[" + clase.replace(/\\/g, "\\\\") + "]";
            i = cierre;
        }
        else
            re += c.replace(/[.+^${}()|[\]\\]/g, "\\$&");
    }
    return new RegExp("^" + re + "$");
}
export function casarPatron(patron: string, texto: string): string | null {
    const pc = patron.indexOf("%");
    if (pc < 0)
        return patron === texto ? "" : null;
    const pre = patron.slice(0, pc);
    const post = patron.slice(pc + 1);
    if (texto.length < pre.length + post.length)
        return null;
    if (!texto.startsWith(pre) || !texto.endsWith(post))
        return null;
    return texto.slice(pre.length, texto.length - post.length);
}
export function aplicarPatron(patron: string, stem: string): string {
    const pc = patron.indexOf("%");
    return pc < 0 ? patron : patron.slice(0, pc) + stem + patron.slice(pc + 1);
}
function buscarCierre(s: string, ini: number): number {
    let nivel = 0;
    for (let i = ini; i < s.length; i++) {
        const c = s[i];
        if (c === "(" || c === "{")
            nivel++;
        else if (c === ")" || c === "}") {
            nivel--;
            if (nivel === 0)
                return i;
        }
    }
    return -1;
}
function partirArgs(s: string): string[] {
    const out: string[] = [];
    let nivel = 0, act = "";
    for (let i = 0; i < s.length; i++) {
        const c = s[i];
        if (c === "(" || c === "{") {
            nivel++;
            act += c;
        }
        else if (c === ")" || c === "}") {
            nivel--;
            act += c;
        }
        else if (c === "," && nivel === 0) {
            out.push(act);
            act = "";
        }
        else
            act += c;
    }
    out.push(act);
    return out;
}
const ARIDAD: Record<string, number> = {
    subst: 3,
    patsubst: 3,
    filter: 2,
    "filter-out": 2,
    findstring: 2,
    word: 2,
    wordlist: 3,
    addprefix: 2,
    addsuffix: 2,
    join: 2,
    foreach: 3,
    if: 3,
    dir: 1,
    notdir: 1,
    suffix: 1,
    basename: 1,
    strip: 1,
    sort: 1,
    words: 1,
    firstword: 1,
    lastword: 1,
    wildcard: 1,
    shell: 1,
    error: 1,
    warning: 1,
    info: 1,
    value: 1,
    origin: 1,
    abspath: 1,
    realpath: 1,
};
function recortarArgs(args: string[], n: number): string[] {
    if (args.length <= n)
        return args;
    return [...args.slice(0, n - 1), args.slice(n - 1).join(",")];
}
export function expandir(texto: string, ctx: CtxExpand, prof = 0): string {
    if (prof > MAX_PROFUNDIDAD) {
        diag(ctx, "error", "expansion-infinita", { max: MAX_PROFUNDIDAD });
        return "";
    }
    let out = "";
    for (let i = 0; i < texto.length; i++) {
        const c = texto[i];
        if (c !== "$") {
            out += c;
            continue;
        }
        const sig = texto[i + 1];
        if (sig === undefined) {
            out += "$";
            break;
        }
        if (sig === "$") {
            out += "$";
            i++;
            continue;
        }
        if (sig === "(" || sig === "{") {
            const cierre = buscarCierre(texto, i + 1);
            if (cierre < 0) {
                diag(ctx, "error", "parentesis-sin-cerrar");
                out += texto.slice(i);
                break;
            }
            out += evaluarRef(texto.slice(i + 2, cierre), ctx, prof);
            i = cierre;
            continue;
        }
        out += valorDe(sig, ctx, prof);
        i++;
    }
    return out;
}
function evaluarRef(interior: string, ctx: CtxExpand, prof: number): string {
    const m = /^([A-Za-z][A-Za-z0-9-]*)\s([\s\S]*)$/.exec(interior);
    if (m && (m[1] in ARIDAD || m[1] === "call" || m[1] === "and" || m[1] === "or" || m[1] === "eval")) {
        return llamarFuncion(m[1], m[2], ctx, prof);
    }
    const dosp = interior.indexOf(":");
    if (dosp > 0) {
        const igual = interior.indexOf("=", dosp);
        if (igual > dosp) {
            const nombre = expandir(interior.slice(0, dosp), ctx, prof + 1).trim();
            const de = expandir(interior.slice(dosp + 1, igual), ctx, prof + 1);
            const a = expandir(interior.slice(igual + 1), ctx, prof + 1);
            const valor = valorDe(nombre, ctx, prof);
            const pDe = de.includes("%") ? de : "%" + de;
            const pA = a.includes("%") ? a : "%" + a;
            return palabras(valor)
                .map(w => { const st = casarPatron(pDe, w); return st === null ? w : aplicarPatron(pA, st); })
                .join(" ");
        }
    }
    const nombre = expandir(interior, ctx, prof + 1).trim();
    return valorDe(nombre, ctx, prof);
}
function valorDe(nombre: string, ctx: CtxExpand, prof: number): string {
    const auto = ctx.auto?.[nombre];
    if (auto !== undefined)
        return auto;
    if (nombre.length === 2 && (nombre[1] === "D" || nombre[1] === "F")) {
        const base = ctx.auto?.[nombre[0]];
        if (base !== undefined) {
            return palabras(base).map(w => nombre[1] === "D" ? dirDe(w) : baseDe(w)).join(" ");
        }
    }
    const def = ctx.vars.get(nombre);
    if (!def)
        return "";
    return def.sabor === "recursiva" ? expandir(def.valor, ctx, prof + 1) : def.valor;
}
function dirDe(w: string): string { const i = w.lastIndexOf("/"); return i < 0 ? "./" : w.slice(0, i + 1); }
function baseDe(w: string): string { const i = w.lastIndexOf("/"); return i < 0 ? w : w.slice(i + 1); }
function llamarFuncion(nombre: string, resto: string, ctx: CtxExpand, prof: number): string {
    const p = prof + 1;
    const crudos = partirArgs(resto);
    const ar = ARIDAD[nombre];
    const args = ar ? recortarArgs(crudos, ar) : crudos;
    const ex = (n: number) => expandir(args[n] ?? "", ctx, p);
    switch (nombre) {
        case "subst": {
            const de = ex(0);
            return de === "" ? ex(2) : ex(2).split(de).join(ex(1));
        }
        case "patsubst": {
            const de = ex(0), a = ex(1);
            return palabras(ex(2)).map(w => { const st = casarPatron(de, w); return st === null ? w : aplicarPatron(a, st); }).join(" ");
        }
        case "strip": return palabras(ex(0)).join(" ");
        case "findstring": return ex(1).includes(ex(0)) ? ex(0) : "";
        case "filter": {
            const pats = palabras(ex(0));
            return palabras(ex(1)).filter(w => pats.some(pt => casarPatron(pt, w) !== null)).join(" ");
        }
        case "filter-out": {
            const pats = palabras(ex(0));
            return palabras(ex(1)).filter(w => !pats.some(pt => casarPatron(pt, w) !== null)).join(" ");
        }
        case "sort": return [...new Set(palabras(ex(0)))].sort().join(" ");
        case "words": return String(palabras(ex(0)).length);
        case "word": {
            const n = parseInt(ex(0).trim(), 10);
            if (!Number.isFinite(n) || n < 1) {
                diag(ctx, "error", "word-indice");
                return "";
            }
            return palabras(ex(1))[n - 1] ?? "";
        }
        case "wordlist": {
            const a = parseInt(ex(0).trim(), 10), b = parseInt(ex(1).trim(), 10);
            if (!Number.isFinite(a) || !Number.isFinite(b) || a < 1)
                return "";
            return palabras(ex(2)).slice(a - 1, b).join(" ");
        }
        case "firstword": return palabras(ex(0))[0] ?? "";
        case "lastword": {
            const w = palabras(ex(0));
            return w[w.length - 1] ?? "";
        }
        case "dir": return palabras(ex(0)).map(dirDe).join(" ");
        case "notdir": return palabras(ex(0)).map(baseDe).join(" ");
        case "suffix": return palabras(ex(0)).map(w => { const b = baseDe(w); const i = b.lastIndexOf("."); return i <= 0 ? "" : b.slice(i); }).filter(x => x).join(" ");
        case "basename": return palabras(ex(0)).map(w => { const b = baseDe(w); const i = b.lastIndexOf("."); return i <= 0 ? w : w.slice(0, w.length - (b.length - i)); }).join(" ");
        case "addsuffix": {
            const s = ex(0);
            return palabras(ex(1)).map(w => w + s).join(" ");
        }
        case "addprefix": {
            const s = ex(0);
            return palabras(ex(1)).map(w => s + w).join(" ");
        }
        case "join": {
            const a = palabras(ex(0)), b = palabras(ex(1));
            const n = Math.max(a.length, b.length);
            return Array.from({ length: n }, (_, i) => (a[i] ?? "") + (b[i] ?? "")).join(" ");
        }
        case "wildcard": {
            const pats = palabras(ex(0));
            const fich = ctx.ficheros ?? [];
            const res: string[] = [];
            for (const pt of pats) {
                if (!/[*?[]/.test(pt)) {
                    if (fich.includes(pt))
                        res.push(pt);
                    continue;
                }
                const re = globARegex(pt);
                for (const f of fich)
                    if (re.test(f) && !res.includes(f))
                        res.push(f);
            }
            return res.sort().join(" ");
        }
        case "if": {
            const cond = expandir(args[0] ?? "", ctx, p);
            return cond.trim() !== "" ? expandir(args[1] ?? "", ctx, p) : expandir(args[2] ?? "", ctx, p);
        }
        case "or": {
            for (const a of crudos) {
                const v = expandir(a, ctx, p);
                if (v.trim() !== "")
                    return v;
            }
            return "";
        }
        case "and": {
            let ult = "";
            for (const a of crudos) {
                ult = expandir(a, ctx, p);
                if (ult.trim() === "")
                    return "";
            }
            return ult;
        }
        case "foreach": {
            const varN = expandir(args[0] ?? "", ctx, p).trim();
            const lista = palabras(expandir(args[1] ?? "", ctx, p));
            const cuerpo = args[2] ?? "";
            const previo = ctx.vars.get(varN);
            const out: string[] = [];
            for (const w of lista) {
                ctx.vars.set(varN, { nombre: varN, sabor: "simple", valor: w, linea: ctx.linea ?? 0, origen: "automatica" });
                out.push(expandir(cuerpo, ctx, p));
            }
            if (previo)
                ctx.vars.set(varN, previo);
            else
                ctx.vars.delete(varN);
            return out.join(" ");
        }
        case "call": {
            const nomb = expandir(crudos[0] ?? "", ctx, p).trim();
            const def = ctx.vars.get(nomb);
            if (!def)
                return "";
            const salvados: (DefVar | undefined)[] = [];
            for (let k = 1; k < crudos.length && k <= 9; k++) {
                const clave = String(k);
                salvados[k] = ctx.vars.get(clave);
                ctx.vars.set(clave, { nombre: clave, sabor: "simple", valor: expandir(crudos[k], ctx, p), linea: ctx.linea ?? 0, origen: "automatica" });
            }
            const r = expandir(def.valor, ctx, p);
            for (let k = 1; k < crudos.length && k <= 9; k++) {
                const clave = String(k);
                const s = salvados[k];
                if (s)
                    ctx.vars.set(clave, s);
                else
                    ctx.vars.delete(clave);
            }
            return r;
        }
        case "value": {
            const d = ctx.vars.get(ex(0).trim());
            return d ? d.valor : "";
        }
        case "origin": {
            const d = ctx.vars.get(ex(0).trim());
            return d ? d.origen : "undefined";
        }
        case "shell": {
            const cmd = ex(0).trim();
            const stub = ctx.stubsShell?.[cmd];
            if (stub !== undefined)
                return stub;
            if (ctx.marcaNoFiable)
                ctx.marcaNoFiable.valor = true;
            diag(ctx, "aviso", "shell-no-ejecutable", { comando: cmd });
            return "";
        }
        case "error": {
            diag(ctx, "error", "error-explicito", { texto: ex(0).trim() });
            return "";
        }
        case "warning": {
            diag(ctx, "aviso", "warning-explicito", { texto: ex(0).trim() });
            return "";
        }
        case "info": {
            diag(ctx, "info", "info-explicito", { texto: ex(0).trim() });
            return "";
        }
        case "abspath":
        case "realpath": return palabras(ex(0)).join(" ");
        case "eval": {
            if (ctx.marcaNoFiable)
                ctx.marcaNoFiable.valor = true;
            diag(ctx, "aviso", "eval-no-soportado");
            return "";
        }
        default:
            return "";
    }
}
