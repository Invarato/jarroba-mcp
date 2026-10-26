import type { PlanMaven, PasoPlan } from "./maven-plan";
export interface GoalDelLog {
    clave: string;
    version: string;
    bifurcado: boolean;
}
export interface LogMaven {
    modulos: {
        artefacto: string;
        goals: GoalDelLog[];
    }[];
    resultado: "ok" | "fallo" | "";
}
const MAX_TEXTO = 5000000;
export function leerLogMaven(texto: string): LogMaven {
    const t = (typeof texto === "string" ? texto.slice(0, MAX_TEXTO) : "").replace(/\x1b\[[0-9;]*m/g, "");
    const porArtefacto = new Map<string, GoalDelLog[]>();
    const dentro = new Set<string>();
    for (const linea of t.split(/\r?\n/)) {
        const ini = /^(?:\[\w+\]\s*)?>>> \S+ .* @ ([\w.-]+) >>>\s*$/.exec(linea);
        if (ini) {
            dentro.add(ini[1]);
            continue;
        }
        const fin = /^(?:\[\w+\]\s*)?<<< \S+ .* @ ([\w.-]+) <<<\s*$/.exec(linea);
        if (fin) {
            dentro.delete(fin[1]);
            continue;
        }
        const m = /^(?:\[\w+\]\s*)?--- ([\w.-]+):([^:\s]+):([\w-]+) \(([^)]+)\) @ ([\w.-]+) ---\s*$/.exec(linea);
        if (!m)
            continue;
        const l = porArtefacto.get(m[5]) ?? [];
        l.push({ clave: `${m[1]}:${m[3]} (${m[4]})`, version: m[2], bifurcado: dentro.has(m[5]) });
        porArtefacto.set(m[5], l);
    }
    const resultado = /BUILD FAILURE/.test(t) ? "fallo" : /BUILD SUCCESS/.test(t) ? "ok" : "";
    return { modulos: [...porArtefacto].map(([artefacto, goals]) => ({ artefacto, goals })), resultado };
}
export interface ComparacionModulo {
    artefacto: string;
    igual: boolean;
    soloEnLog: {
        clave: string;
        version: string;
        despuesDe: string;
        desconocido: boolean;
    }[];
    soloEnPlan: string[];
    otroOrden: boolean;
}
export interface ComparacionLog {
    modulos: ComparacionModulo[];
    soloEnLog: string[];
    soloEnPlan: string[];
    resultado: LogMaven["resultado"];
    vacio: boolean;
}
function claves(pasos: PasoPlan[]): string[] {
    return pasos.flatMap(p => [...(p.bifurca && !p.bifurca.omitida ? claves(p.bifurca.pasos) : []), `${p.prefijo}:${p.goal} (${p.ejecucion})`]);
}
function resta<T, U>(a: T[], b: U[], k: (x: T) => string, kb: (x: U) => string): T[] {
    const n = new Map<string, number>();
    for (const x of b)
        n.set(kb(x), (n.get(kb(x)) ?? 0) + 1);
    return a.filter(x => { const c = n.get(k(x)) ?? 0; if (c > 0) {
        n.set(k(x), c - 1);
        return false;
    } return true; });
}
export function compararConLog(plan: PlanMaven, texto: string): ComparacionLog {
    const log = leerLogMaven(texto);
    const delPlan = new Map(plan.reactor.map(m => [m.ga.split(":")[1], m] as const));
    const modulos: ComparacionModulo[] = [];
    for (const { artefacto, goals } of log.modulos) {
        const m = delPlan.get(artefacto);
        if (!m)
            continue;
        const esperado = claves(m.pasos);
        const real = goals.map(g => g.clave);
        const dudosos = new Set(m.noEjecuta.filter(n => n.motivo === "plugin-desconocido" || n.motivo === "goal-desconocido")
            .map(n => `${n.goal} (${n.ejecucion})`));
        const soloEnLog = resta(goals.map((g, i) => ({ ...g, i })), esperado, g => g.clave, x => x)
            .map(g => ({
            clave: g.clave,
            version: g.version,
            despuesDe: g.i > 0 ? goals[g.i - 1].clave : "",
            desconocido: dudosos.has(g.clave.split(":").slice(1).join(":")),
        }));
        const soloEnPlan = resta(esperado, real, x => x, x => x);
        const otroOrden = !soloEnLog.length && !soloEnPlan.length && esperado.join("\n") !== real.join("\n");
        modulos.push({ artefacto, igual: !soloEnLog.length && !soloEnPlan.length && !otroOrden, soloEnLog, soloEnPlan, otroOrden });
    }
    const enLog = new Set(log.modulos.map(m => m.artefacto));
    return {
        modulos,
        soloEnLog: log.modulos.map(m => m.artefacto).filter(a => !delPlan.has(a)),
        soloEnPlan: plan.reactor.filter(m => m.pasos.length && !enLog.has(m.ga.split(":")[1])).map(m => m.ga.split(":")[1]),
        resultado: log.resultado,
        vacio: !log.modulos.length,
    };
}
