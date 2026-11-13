import ipcCaptura from "../../public/datos/ipc/2026-10-17.json";
import { mesMas, simularPension, type ResultadoSistema } from "../../src/app/services/nomina/pension";
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
    const sim = simularPension({
        hechoCausante: e.retirementMonth,
        bases: e.bases,
        futuro: e.untilRetirement === "last-base" ? "ultima" : "nada",
        lagunasMejoradas: e.improvedGaps,
        dias: e.daysContributed ?? null,
        ipc: IPC,
    });
    const el = sim.r.elegido;
    const ultimoIpc = Object.keys(IPC.indice).sort().at(-1)!;
    const warnings: {
        code: string;
        detail: string;
    }[] = [];
    if (sim.desconocidos.length)
        warnings.push({ code: "unknown-months", detail: `The calculation needs bases from ${sim.desconocidos[0]}; ${sim.desconocidos.length} month(s) are not in the input and count as 0. A month with no contribution must be given as null, not left out.` });
    if (sim.supuestos.length)
        warnings.push({ code: "assumed-until-retirement", detail: e.untilRetirement === "last-base"
                ? `From ${mesMas(sim.ultimoInforme, 1)} to ${mesMas(e.retirementMonth, -1)} it assumes contributions at the last base (${sim.ultimaBase ?? 0} EUR).`
                : `From ${mesMas(sim.ultimoInforme, 1)} to ${mesMas(e.retirementMonth, -1)} it assumes no contributions: they are gaps.` });
    if (sim.ipcSupuesto)
        warnings.push({ code: "assumed-cpi", detail: `The CPI for ${sim.referencia} is not published yet: the last one (${sim.ipcSupuesto}) is used, as if prices stopped rising.` });
    if (sim.minimaSupuesta)
        warnings.push({ code: "assumed-minimum-base", detail: `Gaps after ${sim.minimaSupuesta.mes} use the last published minimum base (${sim.minimaSupuesta.base} EUR).` });
    if (sim.faltanDatos)
        warnings.push({ code: "missing-data", detail: "CPI or minimum base is missing for some very old month: the result is not reliable." });
    if (sim.ipcReconstruido)
        warnings.push({ code: "cpi-reconstructed", detail: "CPI before 2002 is reconstructed from the official annual variation (INE does not publish the linked series earlier): it may differ by 0.5-0.8 % from what Social Security uses for those months." });
    return {
        retirementMonth: e.retirementMonth,
        referenceMonth: sim.referencia,
        systems: sim.r.sistemas.map((s) => ({
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
        gaps: { total: sim.lagunas.total, at100: sim.lagunas.al100, at80: sim.lagunas.al80, at50: sim.lagunas.al50 },
        ...(sim.porcentaje !== null ? { monthsContributed: sim.meses, percentage: sim.porcentaje, monthlyPension: sim.pension } : {}),
        warnings,
        notes: [
            "Regulatory base and percentage only: no early or late retirement coefficients, and no minimum or maximum pension caps. The pension is paid in 14 instalments a year.",
            `CPI: INE linked series, capture ${IPC_CAPTURA.replace(".json", "")}; last month ${ultimoIpc}.`,
        ],
    };
}
