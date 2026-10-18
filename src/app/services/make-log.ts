import { LogParseService, type LogEvent } from "./log-parse.service";
import { LogPatternsService } from "./log-patterns.service";
import { leerMakefile, type MakefileLeido } from "./makefile-parse";
import { planificar, type Plan, type FicheroVirtual } from "./makefile-plan";
const NOTA_DE_DIAGNOSTICO = /^\S+:\d+(:\d+)?:\s+note:/;
export function INICIO_EVENTO_MAKE_FN(linea: string): boolean {
    if (linea === "" || /^\s/.test(linea))
        return false;
    return !NOTA_DE_DIAGNOSTICO.test(linea);
}
export const INICIO_EVENTO_MAKE = /^(?!\s)(?!\S+:\d+(:\d+)?:\s+note:)./;
export type Confianza = "exacta" | "probable" | "ninguna";
export interface OrdenDelLog {
    lineaLog: number;
    comando: string;
    objetivo: string | null;
    lineaRegla: number | null;
    confianza: Confianza;
}
export interface ErrorDeBuild {
    lineaLog: number;
    texto: string;
    objetivo?: string;
    lineaRegla?: number;
}
export interface DiffContraSimulacion {
    hechos: string[];
    predichos: string[];
    inesperados: string[];
    noVistos: string[];
}
export interface AnalisisMakeLog {
    lineasLog: number;
    eventos: number;
    ordenes: OrdenDelLog[];
    sinAtribuir: number;
    errores: ErrorDeBuild[];
    avisos: number;
    alDiaSegunMake: string[];
    subMakes: string[];
    pareceParalelo: boolean;
    diff: DiffContraSimulacion;
    patrones: {
        plantilla: string;
        veces: number;
    }[];
    tiempos: {
        hayFechas: boolean;
    };
}
const RE_ENTRANDO = /^make(?:\[\d+\])?:\s+Entering directory\s+['"`](.+)['"`]/;
const RE_ERROR = /^make(?:\[\d+\])?:\s+\*\*\*\s+\[(?:(.+?):(\d+):\s*)?(.+?)\]\s+Error\s+(\d+)/;
const RE_AL_DIA = /^make(?:\[\d+\])?:\s+['"`](.+?)['"`]\s+is up to date/;
const RE_NADA = /^make(?:\[\d+\])?:\s+Nothing to be done for\s+['"`](.+?)['"`]/;
const RE_SIN_REGLA = /^make(?:\[\d+\])?:\s+\*\*\*\s+No rule to make target\s+['"`](.+?)['"`]/;
const RE_JOBSERVER = /jobserver|--output-sync|-j\d|\bmake\[\d+\]/;
function normalizar(s: string): string { return s.trim().replace(/\s+/g, " "); }
function recetasDeTodo(mk: MakefileLeido, ficheros: readonly FicheroVirtual[]): Map<string, {
    objetivo: string;
    linea: number | null;
}> {
    const todo = planificar(mk, ficheros, { forzarTodo: true });
    const porComando = new Map<string, {
        objetivo: string;
        linea: number | null;
    }>();
    for (const n of todo.nodos.values()) {
        for (const r of n.receta) {
            const clave = normalizar(r);
            if (clave && !porComando.has(clave))
                porComando.set(clave, { objetivo: n.objetivo, linea: n.reglaLinea });
        }
    }
    return porComando;
}
function objetivosConocidos(mk: MakefileLeido, plan: Plan): string[] {
    const set = new Set<string>();
    for (const r of mk.reglas)
        if (!r.patron)
            for (const t of r.objetivos)
                set.add(t);
    for (const t of plan.nodos.keys())
        set.add(t);
    return [...set].sort((a, b) => b.length - a.length);
}
export interface OpcionesAnalisis {
    makefile: string;
    ficheros?: readonly FicheroVirtual[];
    objetivos?: string[];
}
export function analizarLogDeMake(logTexto: string, opts: OpcionesAnalisis): AnalisisMakeLog {
    const ficheros = opts.ficheros ?? [];
    const mk = leerMakefile(opts.makefile, { ficheros: ficheros.map(f => f.ruta) });
    const plan = planificar(mk, ficheros, { objetivos: opts.objetivos });
    const parseado = new LogParseService().parse(logTexto, { eventStart: INICIO_EVENTO_MAKE });
    const eventos: LogEvent[] = parseado.events;
    const porComando = recetasDeTodo(mk, ficheros);
    const conocidos = objetivosConocidos(mk, plan);
    const ordenes: OrdenDelLog[] = [];
    const errores: ErrorDeBuild[] = [];
    const alDiaSegunMake: string[] = [];
    const subMakes: string[] = [];
    const hechos = new Set<string>();
    let avisos = 0;
    let pareceParalelo = false;
    for (const ev of eventos) {
        const primera = ev.raw.split("\n")[0];
        const texto = primera.trim();
        if (texto === "")
            continue;
        if (RE_JOBSERVER.test(texto))
            pareceParalelo = pareceParalelo || /jobserver|-j\d/.test(texto);
        const ent = RE_ENTRANDO.exec(texto);
        if (ent) {
            if (!subMakes.includes(ent[1]))
                subMakes.push(ent[1]);
            continue;
        }
        const errM = RE_ERROR.exec(texto);
        if (errM) {
            errores.push({
                lineaLog: ev.line,
                texto,
                objetivo: errM[3],
                lineaRegla: errM[2] ? Number(errM[2]) : undefined,
            });
            if (errM[3])
                hechos.add(errM[3]);
            continue;
        }
        const alDia = RE_AL_DIA.exec(texto) ?? RE_NADA.exec(texto);
        if (alDia) {
            if (!alDiaSegunMake.includes(alDia[1]))
                alDiaSegunMake.push(alDia[1]);
            continue;
        }
        const sinRegla = RE_SIN_REGLA.exec(texto);
        if (sinRegla) {
            errores.push({ lineaLog: ev.line, texto, objetivo: sinRegla[1] });
            continue;
        }
        if (ev.level === "warn") {
            avisos++;
            continue;
        }
        if (ev.level === "error") {
            errores.push({ lineaLog: ev.line, texto });
            continue;
        }
        if (/^make(\[\d+\])?:/.test(texto))
            continue;
        const clave = normalizar(texto);
        const exacta = porComando.get(clave);
        if (exacta) {
            ordenes.push({ lineaLog: ev.line, comando: texto, objetivo: exacta.objetivo, lineaRegla: exacta.linea, confianza: "exacta" });
            hechos.add(exacta.objetivo);
            continue;
        }
        const nombrado = conocidos.find(t => t.length > 2 && clave.includes(t));
        if (nombrado) {
            const n = plan.nodos.get(nombrado);
            ordenes.push({ lineaLog: ev.line, comando: texto, objetivo: nombrado, lineaRegla: n?.reglaLinea ?? null, confianza: "probable" });
            hechos.add(nombrado);
            continue;
        }
        ordenes.push({ lineaLog: ev.line, comando: texto, objetivo: null, lineaRegla: null, confianza: "ninguna" });
    }
    const predichos = plan.orden;
    const setPred = new Set(predichos);
    const diff: DiffContraSimulacion = {
        hechos: [...hechos].sort(),
        predichos,
        inesperados: [...hechos].filter(t => !setPred.has(t)).sort(),
        noVistos: predichos.filter(t => !hechos.has(t)),
    };
    const minado = new LogPatternsService().mine(eventos);
    const patrones = minado.patterns
        .slice(0, 12)
        .map(p => ({ plantilla: p.template, veces: p.count }));
    const conFecha = eventos.filter(e => e.ts !== null).length;
    const hayFechas = conFecha > eventos.length / 2;
    return {
        lineasLog: parseado.lines,
        eventos: eventos.length,
        ordenes,
        sinAtribuir: ordenes.filter(o => o.confianza === "ninguna").length,
        errores,
        avisos,
        alDiaSegunMake,
        subMakes,
        pareceParalelo: pareceParalelo || subMakes.length > 1,
        diff,
        patrones,
        tiempos: { hayFechas },
    };
}
