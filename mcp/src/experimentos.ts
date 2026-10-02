import type { AnalisisAb, AvisoAb, AnalisisAbn, Srm } from "../../src/app/shared/stats/ab";
import type { ResultadoDatos, MotivoFallo } from "../../src/app/shared/dora/desde-datos";
import type { ClasificacionAnyo, ResultadoMetrica, Percentil2025 } from "../../src/app/shared/dora/clasificar";
export const AVISO_AB: Record<AvisoAb, string> = {
    "recuentos-bajos": "low-counts-fisher-exact-used",
    "lift-indefinido": "relative-lift-undefined-control-rate-is-zero",
    srm: "sample-ratio-mismatch",
};
const r4 = (x: number | null | undefined) => (x == null || !Number.isFinite(x) ? x ?? null : Math.round(x * 10000) / 10000);
const ic = (i: {
    lo: number;
    hi: number;
} | null) => (i ? [r4(i.lo), r4(i.hi)] : null);
export function comparacionEn(a: AnalisisAb, control: string, variante: string) {
    return {
        control,
        variant: variante,
        rates: { [control]: r4(a.pA), [variante]: r4(a.pB) },
        absoluteDifference: r4(a.diff),
        absoluteDifferenceCI: ic(a.diffIc),
        relativeLift: r4(a.lift),
        relativeLiftCI: ic(a.liftIc),
        test: a.metodo === "fisher" ? "fisher-exact" : "two-proportion-z",
        z: r4(a.z),
        pValue: a.p,
        pValueFisher: a.pFisher,
        significant: a.significativo,
        winner: a.ganador === "A" ? control : a.ganador === "B" ? variante : null,
        warnings: a.avisos.map((w) => AVISO_AB[w]),
    };
}
export const srmEn = (s: Srm) => ({
    chiSquare: r4(s.chi2),
    pValue: s.p,
    mismatch: s.descuadrado,
    expectedVisitors: s.esperados.map((x) => r4(x)),
});
export function multiEn(a: AnalisisAbn, nombres: string[], control: number) {
    return {
        omnibus: { chiSquare: r4(a.global.chi2), pValue: a.global.p, degreesOfFreedom: a.global.gl },
        correction: a.correccion === "holm" ? "holm (family-wise error)" : "benjamini-hochberg (false discovery rate)",
        comparisons: a.comparaciones.map((c) => ({
            ...comparacionEn(c.analisis, nombres[control], nombres[c.variante]),
            adjustedPValue: c.pAjustado,
            significant: c.significativo,
        })),
    };
}
export const MOTIVO_FALLO: Record<MotivoFallo, string> = {
    "arreglo-siguiente": "next-deploy-is-a-fix",
    incidente: "overlaps-an-incident",
    "vuelve-a-sha": "redeploys-an-earlier-commit",
};
const METRICA: Record<string, string> = {
    frecuencia: "deploymentFrequency",
    lead: "leadTimeForChanges",
    recuperacion: "timeToRestore",
    cfr: "changeFailureRate",
    rework: "reworkRate",
};
function nivelEn(r: ResultadoMetrica) {
    switch (r.tipo) {
        case "nivel": return { level: r.nivel, approximate: r.aproximado || undefined };
        case "ambiguo": return { ambiguousBetween: r.niveles, approximate: r.aproximado || undefined };
        case "entre-bandas": return { level: null, note: "falls between that report's bands" };
        case "sin-dato": return { level: null, note: "no data for this metric" };
    }
}
export function doraEn(d: ResultadoDatos, historico: ClasificacionAnyo[], p2025: Partial<Record<string, Percentil2025>>, sinArreglo: number) {
    const fallidos = d.despliegues.filter((x) => x.fallido);
    return {
        period: { days: d.dias, deployments: d.despliegues.length, duplicatesIgnored: d.duplicados, unattributedCommits: d.commitsSinAtribuir },
        metrics: {
            deploymentsPerDay: r4(d.desplieguesDia),
            daysWithDeployPerWeek: r4(d.diasConDespliegueSemana),
            leadTimeHours: r4(d.leadHoras),
            timeToRestoreHours: r4(d.recuperacionHoras),
            changeFailureRate: r4(d.cfr),
            reworkRate: r4(d.rework),
        },
        failedDeployments: fallidos.slice(0, 50).map((x) => ({
            date: x.fecha.toISOString(),
            sha: x.sha,
            title: x.titulo,
            reason: MOTIVO_FALLO[x.fallido!],
            restoredAfterHours: r4(x.recuperacionHoras),
        })),
        classificationByReport: historico.map((c) => ({
            report: c.anyo,
            byMetric: Object.fromEntries(Object.entries(c.porMetrica).map(([k, v]) => [METRICA[k] ?? k, nivelEn(v)])),
            overall: c.global && { levels: c.global.niveles, agreeingMetrics: c.global.coinciden, of: c.global.de },
        })),
        percentile2025: Object.fromEntries(Object.entries(p2025).map(([k, v]) => [METRICA[k] ?? k, v && { topPercent: v.top }])),
        note: sinArreglo
            ? "Without a git log, lead time is not computed and failures are inferred from deploy order only."
            : undefined,
    };
}
