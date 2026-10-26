import ipcCaptura from "../../public/datos/ipc/2026-10-17.json";
import { calcularBaseReguladora, mesMas, mesesDeDias, porcentajePorMeses, type ResultadoSistema, } from "../../src/app/services/nomina/pension";
import { baseMinimaLagunas, ultimaBaseMinima } from "../../src/app/services/nomina/pension-datos";
export const IPC_CAPTURA = "2026-10-17.json";
const IPC = ipcCaptura as {
    indice: Record<string, number>;
    reconstruidos?: {
        hasta?: string;
    };
};
export interface EntradaPension {
    retirementMonth: string;
    bases: Record<string, number | null>;
    untilRetirement: "last-base" | "no-contributions";
    daysContributed?: number;
    improvedGaps: boolean;
}
const SISTEMA: Record<ResultadoSistema["sistema"]["id"], string> = { nuevo: "new", anterior: "previous" };
export function pensionBase(e: EntradaPension) {
    const conocidos = Object.keys(e.bases).sort();
    const ultimoInforme = conocidos.at(-1)!;
    const ultimaBase = [...conocidos].reverse().map((m) => e.bases[m]).find((b) => typeof b === "number" && b > 0) ?? null;
    const bases = { ...e.bases };
    const supuestos = new Set<string>();
    let mesesFuturos = 0;
    for (let m = mesMas(ultimoInforme, 1); m < e.retirementMonth; m = mesMas(m, 1)) {
        bases[m] = e.untilRetirement === "last-base" ? ultimaBase : null;
        supuestos.add(m);
        if (e.untilRetirement === "last-base")
            mesesFuturos++;
    }
    const ultimoIpc = Object.keys(IPC.indice).sort().at(-1)!;
    const minima = ultimaBaseMinima();
    let ipcSupuesto = false, minimaSupuesta = false;
    const r = calcularBaseReguladora({
        hechoCausante: e.retirementMonth,
        bases,
        supuestos,
        lagunasMejoradas: e.improvedGaps,
        ipc: (m) => {
            if (IPC.indice[m] !== undefined)
                return IPC.indice[m];
            if (m > ultimoIpc) {
                ipcSupuesto = true;
                return IPC.indice[ultimoIpc];
            }
            return null;
        },
        baseMinima: (m) => {
            const x = baseMinimaLagunas(m);
            if (x !== null)
                return x;
            if (minima && m > minima.mes) {
                minimaSupuesta = true;
                return minima.base;
            }
            return null;
        },
    });
    const el = r.elegido;
    const gaps = { total: 0, at100: 0, at80: 0, at50: 0 };
    for (const m of el.meses)
        if (m.laguna) {
            gaps.total++;
            gaps[m.laguna === "100" ? "at100" : m.laguna === "80" ? "at80" : "at50"]++;
        }
    const meses = e.daysContributed !== undefined ? mesesDeDias(e.daysContributed) + mesesFuturos : null;
    const pct = meses !== null ? porcentajePorMeses(meses, Number(e.retirementMonth.slice(0, 4))) : null;
    const warnings: {
        code: string;
        detail: string;
    }[] = [];
    const desconocidos = el.faltan.filter((x) => x.que === "base").map((x) => x.mes).sort();
    if (desconocidos.length)
        warnings.push({ code: "unknown-months", detail: `The calculation needs bases from ${desconocidos[0]}; ${desconocidos.length} month(s) are not in the input and count as 0. A month with no contribution must be given as null, not left out.` });
    if (supuestos.size)
        warnings.push({ code: "assumed-until-retirement", detail: e.untilRetirement === "last-base"
                ? `From ${mesMas(ultimoInforme, 1)} to ${mesMas(e.retirementMonth, -1)} it assumes contributions at the last base (${ultimaBase ?? 0} EUR).`
                : `From ${mesMas(ultimoInforme, 1)} to ${mesMas(e.retirementMonth, -1)} it assumes no contributions: they are gaps.` });
    if (ipcSupuesto)
        warnings.push({ code: "assumed-cpi", detail: `The CPI for ${mesMas(e.retirementMonth, -25)} is not published yet: the last one (${ultimoIpc}) is used, as if prices stopped rising.` });
    if (minimaSupuesta && minima)
        warnings.push({ code: "assumed-minimum-base", detail: `Gaps after ${minima.mes} use the last published minimum base (${minima.base} EUR).` });
    if (el.faltan.some((x) => x.que === "ipc" || x.que === "base-minima"))
        warnings.push({ code: "missing-data", detail: "CPI or minimum base is missing for some very old month: the result is not reliable." });
    if (IPC.reconstruidos?.hasta && el.meses.some((m) => m.mes <= IPC.reconstruidos!.hasta!))
        warnings.push({ code: "cpi-reconstructed", detail: "CPI before 2002 is reconstructed from the official annual variation (INE does not publish the linked series earlier): it may differ by 0.5-0.8 % from what Social Security uses for those months." });
    return {
        retirementMonth: e.retirementMonth,
        referenceMonth: mesMas(e.retirementMonth, -25),
        systems: r.sistemas.map((s) => ({
            id: SISTEMA[s.sistema.id],
            months: s.sistema.meses,
            best: s.sistema.mejores,
            divisor: s.sistema.divisor,
            legalBasis: s.sistema.fuente,
            sumOfChosenBases: s.suma,
            regulatoryBase: s.baseReguladora,
        })),
        chosen: SISTEMA[el.sistema.id],
        regulatoryBase: el.baseReguladora,
        gaps,
        ...(pct !== null ? {
            monthsContributed: meses,
            percentage: pct,
            monthlyPension: pct ? Math.round(el.baseReguladora * pct) / 100 : 0,
        } : {}),
        warnings,
        notes: [
            "Regulatory base and percentage only: no early or late retirement coefficients, and no minimum or maximum pension caps. The pension is paid in 14 instalments a year.",
            `CPI: INE linked series, capture ${IPC_CAPTURA.replace(".json", "")}; last month ${ultimoIpc}.`,
        ],
    };
}
