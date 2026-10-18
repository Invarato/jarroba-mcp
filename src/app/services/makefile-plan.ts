import { DiagMk, TablaVars, DefVar, expandir, palabras, casarPatron, aplicarPatron } from "./makefile-expand";
import { MakefileLeido, ReglaMk } from "./makefile-parse";
export interface FicheroVirtual {
    ruta: string;
    mtime: number;
}
export type Veredicto = "phony" | "no-existe" | "requisito-rehecho" | "requisito-nuevo" | "forzado" | "al-dia" | "fuente" | "sin-regla";
export interface NodoPlan {
    objetivo: string;
    origenRegla: "explicita" | "estatica" | "patron" | "ninguna";
    reglaLinea: number | null;
    stem: string | null;
    veredicto: Veredicto;
    culpables: string[];
    requisitos: string[];
    soloOrden: string[];
    receta: string[];
    mtimeAntes: number | null;
    mtimeDespues: number | null;
    seReconstruye: boolean;
    hijos: string[];
    sinReceta: boolean;
}
export interface AvisoCarrera {
    a: string;
    b: string;
    ficheroImplicado: string;
}
export interface Plan {
    objetivosPedidos: string[];
    nodos: Map<string, NodoPlan>;
    orden: string[];
    ondas: string[][];
    ciclos: string[][];
    carreras: AvisoCarrera[];
    diags: DiagMk[];
    noFiable: boolean;
}
export interface OpcionesPlan {
    objetivos?: string[];
    forzarTodo?: boolean;
    suponerNuevos?: string[];
    stubsShell?: Record<string, string>;
}
const MAX_NODOS = 5000;
const MAX_PROFUNDIDAD = 400;
interface Estado {
    mk: MakefileLeido;
    fechas: Map<string, number>;
    nodos: Map<string, NodoPlan>;
    enCurso: string[];
    ciclos: string[][];
    orden: string[];
    diags: DiagMk[];
    reloj: number;
    opts: OpcionesPlan;
    noFiable: {
        valor: boolean;
    };
    visitados: number;
}
function reglaExplicita(mk: MakefileLeido, objetivo: string): ReglaMk | null {
    let sinReceta: ReglaMk | null = null;
    for (const r of mk.reglas) {
        if (r.patron || !r.objetivos.includes(objetivo))
            continue;
        if (r.receta.length > 0)
            return r;
        sinReceta = sinReceta ?? r;
    }
    return sinReceta;
}
function requisitosExtra(mk: MakefileLeido, objetivo: string, principal: ReglaMk | null): string[] {
    const out: string[] = [];
    for (const r of mk.reglas) {
        if (r.patron || r === principal || !r.objetivos.includes(objetivo))
            continue;
        out.push(...r.requisitos);
    }
    return out;
}
function reglaPatron(e: Estado, objetivo: string): {
    regla: ReglaMk;
    stem: string;
} | null {
    const candidatas: {
        regla: ReglaMk;
        stem: string;
    }[] = [];
    for (const r of e.mk.reglas) {
        if (!r.patron)
            continue;
        for (const pat of r.objetivos) {
            const stem = casarPatron(pat, objetivo);
            if (stem !== null) {
                candidatas.push({ regla: r, stem });
                break;
            }
        }
    }
    for (const c of candidatas) {
        const reqs = c.regla.requisitos.map(p => aplicarPatron(p, c.stem));
        const viables = reqs.every(p => e.fechas.has(p) || reglaExplicita(e.mk, p) !== null);
        if (viables)
            return c;
    }
    return null;
}
function automaticas(objetivo: string, reqs: string[], soloOrden: string[], stem: string | null, nuevos: string[]): Record<string, string> {
    const unicos = [...new Set(reqs)];
    return {
        "@": objetivo,
        "<": reqs[0] ?? "",
        "^": unicos.join(" "),
        "+": reqs.join(" "),
        "?": nuevos.join(" "),
        "*": stem ?? "",
        "|": soloOrden.join(" "),
    };
}
function conVarsObjetivo(base: TablaVars, extra: DefVar[]): TablaVars {
    if (extra.length === 0)
        return base;
    const t: TablaVars = new Map(base);
    for (const d of extra)
        t.set(d.nombre, d);
    return t;
}
function actualizar(e: Estado, objetivo: string, varsHeredadas: DefVar[]): NodoPlan | null {
    const ya = e.nodos.get(objetivo);
    if (ya)
        return ya;
    const ciclo = e.enCurso.indexOf(objetivo);
    if (ciclo >= 0) {
        const cadena = [...e.enCurso.slice(ciclo), objetivo];
        e.ciclos.push(cadena);
        e.diags.push({
            gravedad: "error",
            regla: "dependencia-circular",
            linea: 0,
            datos: { cadena: cadena.join(" \u2192 ") },
        });
        return null;
    }
    if (++e.visitados > MAX_NODOS) {
        e.diags.push({ gravedad: "error", regla: "grafo-demasiado-grande", linea: 0, datos: { max: MAX_NODOS } });
        return null;
    }
    if (e.enCurso.length >= MAX_PROFUNDIDAD) {
        e.diags.push({
            gravedad: "error",
            regla: "cadena-demasiado-profunda",
            linea: 0,
            datos: { max: MAX_PROFUNDIDAD, objetivo },
        });
        return null;
    }
    e.enCurso.push(objetivo);
    const explicita = reglaExplicita(e.mk, objetivo);
    const patron = explicita ? null : reglaPatron(e, objetivo);
    const regla = explicita ?? patron?.regla ?? null;
    const stem = patron?.stem ?? null;
    const origenRegla: NodoPlan["origenRegla"] = explicita ? (explicita.patronObjetivo ? "estatica" : "explicita") : patron ? "patron" : "ninguna";
    const stemEfectivo = stem ?? (explicita?.patronObjetivo ? casarPatron(explicita.patronObjetivo, objetivo) : null);
    const sustituir = (p: string) => (stemEfectivo !== null && p.includes("%")) ? aplicarPatron(p, stemEfectivo) : p;
    const requisitos = [
        ...(regla?.requisitos ?? []).map(sustituir),
        ...requisitosExtra(e.mk, objetivo, explicita).map(sustituir),
    ];
    const soloOrden = (regla?.soloOrden ?? []).map(sustituir);
    const varsAqui = [...varsHeredadas, ...(e.mk.varsObjetivo.get(objetivo) ?? [])];
    const hijos: string[] = [];
    for (const p of requisitos) {
        actualizar(e, p, varsAqui);
        hijos.push(p);
    }
    for (const p of soloOrden) {
        actualizar(e, p, varsAqui);
        hijos.push(p);
    }
    e.enCurso.pop();
    const esPhony = e.mk.phony.has(objetivo);
    const mtimeAntes = e.fechas.get(objetivo) ?? null;
    const forzado = !!e.opts.forzarTodo;
    const supuesto = e.opts.suponerNuevos?.includes(objetivo) ?? false;
    let veredicto: Veredicto;
    const culpables: string[] = [];
    const nodosReq = requisitos.map(p => e.nodos.get(p)).filter((n): n is NodoPlan => !!n);
    const rehechos = nodosReq.filter(n => n.seReconstruye).map(n => n.objetivo);
    const masNuevos = mtimeAntes === null ? [] : requisitos.filter(p => {
        if (e.opts.suponerNuevos?.includes(p))
            return true;
        const t = e.fechas.get(p);
        return t !== undefined && t > mtimeAntes;
    });
    if (!regla && mtimeAntes === null) {
        veredicto = "sin-regla";
        e.diags.push({
            gravedad: "error",
            regla: "sin-regla-ni-fichero",
            linea: 0,
            datos: { objetivo },
        });
    }
    else if (!regla) {
        veredicto = "fuente";
    }
    else if (forzado) {
        veredicto = "forzado";
    }
    else if (esPhony) {
        veredicto = "phony";
    }
    else if (mtimeAntes === null) {
        veredicto = "no-existe";
    }
    else if (rehechos.length > 0) {
        veredicto = "requisito-rehecho";
        culpables.push(...rehechos);
    }
    else if (supuesto) {
        veredicto = "forzado";
    }
    else if (masNuevos.length > 0) {
        veredicto = "requisito-nuevo";
        culpables.push(...masNuevos);
    }
    else {
        veredicto = "al-dia";
    }
    const seReconstruye = veredicto === "phony" || veredicto === "no-existe"
        || veredicto === "requisito-rehecho" || veredicto === "requisito-nuevo" || veredicto === "forzado";
    const nuevosParaSigno = mtimeAntes === null ? requisitos : [...new Set([...masNuevos, ...rehechos])];
    const receta: string[] = [];
    if (regla && seReconstruye) {
        const vars = conVarsObjetivo(e.mk.vars, varsAqui);
        const auto = automaticas(objetivo, requisitos, soloOrden, stemEfectivo, nuevosParaSigno);
        for (const l of regla.receta) {
            receta.push(expandir(l.texto, {
                vars,
                auto,
                ficheros: [...e.fechas.keys()],
                stubsShell: e.opts.stubsShell,
                linea: l.linea,
                diags: e.diags,
                marcaNoFiable: e.noFiable,
            }));
        }
    }
    const sinReceta = !regla || regla.receta.length === 0;
    let mtimeDespues = mtimeAntes;
    if (seReconstruye && !sinReceta) {
        mtimeDespues = e.reloj++;
        e.fechas.set(objetivo, mtimeDespues);
        e.orden.push(objetivo);
    }
    const nodo: NodoPlan = {
        objetivo,
        origenRegla,
        reglaLinea: regla?.linea ?? null,
        stem: stemEfectivo,
        veredicto,
        culpables,
        requisitos,
        soloOrden,
        receta,
        mtimeAntes,
        mtimeDespues,
        seReconstruye,
        hijos,
        sinReceta,
    };
    e.nodos.set(objetivo, nodo);
    return nodo;
}
function calcularOndas(nodos: Map<string, NodoPlan>, orden: string[]): string[][] {
    const nivel = new Map<string, number>();
    const ondas: string[][] = [];
    for (const t of orden) {
        const n = nodos.get(t)!;
        let max = -1;
        for (const h of [...n.requisitos, ...n.soloOrden]) {
            const l = nivel.get(h);
            if (l !== undefined)
                max = Math.max(max, l);
        }
        const mio = max + 1;
        nivel.set(t, mio);
        (ondas[mio] ??= []).push(t);
    }
    return ondas.filter(o => o && o.length > 0);
}
function detectarCarreras(nodos: Map<string, NodoPlan>, ondas: string[][]): AvisoCarrera[] {
    const out: AvisoCarrera[] = [];
    for (const onda of ondas) {
        if (onda.length < 2)
            continue;
        for (const a of onda) {
            const na = nodos.get(a)!;
            const declarados = new Set([...na.requisitos, ...na.soloOrden]);
            for (const b of onda) {
                if (a === b || declarados.has(b))
                    continue;
                const nb = nodos.get(b)!;
                if (!nb.seReconstruye || nb.sinReceta)
                    continue;
                const menciona = na.receta.some(l => palabras(l).some(w => w === b || w.endsWith("/" + b)));
                if (!menciona)
                    continue;
                out.push({
                    a,
                    b,
                    ficheroImplicado: b,
                });
            }
        }
    }
    return out;
}
export function planificar(mk: MakefileLeido, ficheros: readonly FicheroVirtual[], opts: OpcionesPlan = {}): Plan {
    const fechas = new Map<string, number>();
    for (const f of ficheros)
        fechas.set(f.ruta, f.mtime);
    for (const r of opts.suponerNuevos ?? [])
        if (fechas.has(r))
            fechas.set(r, Number.MAX_SAFE_INTEGER - 1);
    const pedidos = (opts.objetivos && opts.objetivos.length > 0)
        ? opts.objetivos
        : (mk.objetivoPorDefecto ? [mk.objetivoPorDefecto] : []);
    const e: Estado = {
        mk,
        fechas,
        nodos: new Map(),
        enCurso: [],
        ciclos: [],
        orden: [],
        diags: [],
        reloj: Math.max(0, ...fechas.values()) + 1,
        opts,
        noFiable: { valor: mk.noFiable },
        visitados: 0,
    };
    if (pedidos.length === 0) {
        e.diags.push({ gravedad: "error", regla: "sin-objetivo", linea: 0, datos: {} });
    }
    for (const t of pedidos)
        actualizar(e, t, []);
    const ondas = calcularOndas(e.nodos, e.orden);
    return {
        objetivosPedidos: pedidos,
        nodos: e.nodos,
        orden: e.orden,
        ondas,
        ciclos: e.ciclos,
        carreras: detectarCarreras(e.nodos, ondas),
        diags: e.diags,
        noFiable: e.noFiable.valor,
    };
}
