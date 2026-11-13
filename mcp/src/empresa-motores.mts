import festivosCaptura from "../../public/datos/festivos/2026-10-26.json";
import { calendarioDeCentro, type AvisoCalendario, type HorarioSemanal } from "../../src/app/services/jornada/calendario";
import { revisarTexto, type Incumplimiento, type ErrorLectura } from "../../src/app/services/jornada/cuadrante";
import { normalizar, preverExtracto, type Periodo } from "../../src/app/services/tesoreria/prevision";
import type { DatosFestivos } from "../../src/app/services/festivos-datos";
export const FESTIVOS_FICHERO = "2026-10-26.json";
const FESTIVOS = festivosCaptura as unknown as DatosFestivos & {
    paises: {
        ES: {
            regiones: Record<string, string>;
            boe?: Record<string, string>;
        };
    };
};
export const REGIONES_ES = Object.keys(FESTIVOS.paises.ES.regiones) as [
    string,
    ...string[]
];
const AVISO_CAL: {
    [K in AvisoCalendario["que"]]: (a: Extract<AvisoCalendario, {
        que: K;
    }>) => {
        code: string;
        detail: string;
    };
} = {
    "locales-no-dos": (a) => ({ code: "local-holidays-not-two", detail: `${a.n} local holiday(s) given: each municipality has two a year (ET art. 37.2).` }),
    "cierres-mas-que-vacaciones": (a) => ({ code: "closures-exceed-vacation", detail: `${a.cierres} closure day(s) and only ${a.vacaciones} vacation day(s): closures count as everyone's vacation, so the extra days are paid leave or must be recovered by agreement.` }),
    "local-fuera-de-anio": (a) => ({ code: "local-holiday-outside-year", detail: `The local holiday ${a.fecha} is not in the year being calculated.` }),
    "jornada-semanal-mas-de-40": (a) => ({ code: "weekly-hours-above-40", detail: `${a.horas} hours a week: the legal maximum is 40 on average, computed over the year (ET art. 34.1).` }),
    "dia-mas-de-9": (a) => ({ code: "day-above-9-hours", detail: `${a.horas} ordinary hours on weekday ${a.semana} (0 = Monday): the limit is 9 unless the collective agreement says otherwise (ET art. 34.3).` }),
};
export interface EntradaCalendario {
    year: number;
    region?: string;
    weeklyHours: HorarioSemanal;
    localHolidays: {
        date: string;
        name: string;
    }[];
    summerHours?: {
        from: string;
        to: string;
        weeklyHours: HorarioSemanal;
    };
    closures: string[];
    vacation: {
        days: number;
        type: "working" | "calendar";
    };
    annualHours?: number;
}
export function workCalendar(e: EntradaCalendario) {
    const r = calendarioDeCentro({
        anio: e.year,
        region: e.region,
        horario: e.weeklyHours,
        locales: e.localHolidays.map((l) => ({ fecha: l.date, nombre: l.name })),
        intensiva: e.summerHours ? { desde: e.summerHours.from, hasta: e.summerHours.to, horario: e.summerHours.weeklyHours } : null,
        cierres: e.closures,
        vacaciones: { dias: e.vacation.days, tipo: e.vacation.type === "working" ? "laborables" : "naturales" },
        jornadaAnual: e.annualHours ?? null,
    }, FESTIVOS);
    return {
        year: e.year,
        region: e.region ? `${e.region} (${FESTIVOS.paises.ES.regiones[e.region]})` : "national holidays only",
        officialHolidaysLoaded: r.festivosCargados,
        workingDays: r.diasLaborables,
        grossHours: r.horasBrutas,
        vacationWorkingDays: r.vacacionesLaborables,
        vacationHours: r.horasVacaciones,
        closureHours: r.horasCierres,
        effectiveHours: r.horasEfectivas,
        averageHoursPerDay: r.mediaHorasDia,
        ...(r.diferencia !== null ? {
            annualHours: e.annualHours,
            difference: r.diferencia,
            ...(r.diasAjuste !== null ? { adjustmentDays: r.diasAjuste } : {}),
            ...(r.minutosMasAlDia !== null ? { extraMinutesPerDay: r.minutosMasAlDia } : {}),
        } : {}),
        holidaysOnWorkingDays: r.festivosEnLaborable,
        holidaysOnRestDays: r.festivosEnDescanso,
        closureDays: r.cierres,
        holidays: r.dias.filter((d) => d.festivo).map((d) => ({ date: d.fecha, name: d.festivo, ...(d.local ? { local: true } : {}), onWorkingDay: e.weeklyHours[d.semana] > 0 })),
        warnings: r.avisos.map((a) => (AVISO_CAL[a.que] as (x: typeof a) => {
            code: string;
            detail: string;
        })(a)),
        notes: [
            `Official holidays: national${e.region ? ` and ${e.region}` : " only (pass region for the regional ones)"}, from the BOE${FESTIVOS.paises.ES.boe?.[e.year] ? ` (${FESTIVOS.paises.ES.boe[e.year]})` : ""}; capture ${FESTIVOS_FICHERO.replace(".json", "")}. The two local ones are yours to give: there is no single official source for the ~8,000 municipalities.`,
            "difference = effectiveHours \u2212 annualHours: positive means hours above the agreement (adjustmentDays to give back), negative means hours missing (extraMinutesPerDay to reach it).",
        ],
    };
}
const ERROR_CUAD: Record<ErrorLectura["que"], string> = {
    vacio: "The rota is empty: paste at least a header row of dates and one row per person.",
    "sin-fechas": "The first row must carry the dates (or day numbers) of the columns.",
    fecha: "A column header is not a date or day number.",
    "fechas-no-seguidas": "The dates of the columns are not consecutive days.",
};
type Inc<K extends Incumplimiento["regla"]> = Extract<Incumplimiento, {
    regla: K;
}>;
const INCUMPLIMIENTO: {
    [K in Incumplimiento["regla"]]: (i: Inc<K>) => Record<string, unknown>;
} = {
    "descanso-entre-jornadas": (i) => ({ rule: "rest-between-shifts", article: "ET art. 34.3", date: i.fecha, restHours: i.horas }),
    "horas-dia": (i) => ({ rule: "daily-hours", article: "ET art. 34.3", date: i.fecha, hours: i.horas }),
    "descanso-semanal": (i) => ({ rule: "weekly-rest", article: "ET art. 37.1", from: i.desde, to: i.hasta, restBlocks: i.bloques, required: i.necesarios, longestRestHours: i.mayorHoras }),
    nocturno: (i) => ({ rule: "night-work-average", article: "ET art. 36.1", from: i.desde, to: i.hasta, averageHours: i.promedio }),
    "menor-nocturno": (i) => ({ rule: "minor-night-work", article: "ET art. 6.2", date: i.fecha, nightHours: i.horas }),
    "menor-horas-extra": (i) => ({ rule: "minor-overtime", article: "ET art. 6.3", overtimeHours: i.horas }),
    "horas-extra-tope": (i) => ({ rule: "overtime-cap", article: "ET art. 35.2", overtimeHours: i.horas, capForThisPeriod: i.tope }),
};
const incumplimientoEn = (i: Incumplimiento) => (INCUMPLIMIENTO[i.regla] as (x: Incumplimiento) => Record<string, unknown>)(i);
export interface EntradaCuadrante {
    rota: string;
    year: number;
    month: number;
    shifts?: Record<string, string>;
    rules?: {
        restBetweenShifts?: number;
        maxDailyHours?: number;
        weeklyRest?: number;
        restPeriodDays?: number;
        maxNightAverage?: number;
    };
    people?: Record<string, {
        weeklyHours?: number;
        minor?: boolean;
    }>;
}
export function shiftValidate(e: EntradaCuadrante) {
    const x = e.rules ?? {};
    const r = revisarTexto(e.rota, {
        anio: e.year,
        mes: e.month,
        turnos: e.shifts,
        personas: e.people && Object.fromEntries(Object.entries(e.people).map(([n, d]) => [n, { horasSemana: d.weeklyHours, menor: d.minor }])),
        reglas: Object.fromEntries(Object.entries({
            descansoEntreJornadas: x.restBetweenShifts,
            maxHorasDia: x.maxDailyHours,
            descansoSemanal: x.weeklyRest,
            periodoDescanso: x.restPeriodDays,
            maxPromedioNocturno: x.maxNightAverage,
        }).filter(([, v]) => v !== undefined)),
    });
    if ("error" in r)
        return { error: `${ERROR_CUAD[r.error.que]}${"texto" in r.error ? ` ("${r.error.texto}")` : ""}` };
    const g = r.reglas;
    return {
        days: r.revision.dias.length,
        rules: { restBetweenShiftsHours: g.descansoEntreJornadas, maxDailyHours: g.maxHorasDia, weeklyRestHours: g.descansoSemanal, restPeriodDays: g.periodoDescanso, maxNightAverageHours: g.maxPromedioNocturno },
        people: r.revision.personas.map((p) => ({
            name: p.nombre,
            hours: p.horas,
            daysWorked: p.diasTrabajados,
            nightHours: p.horasNocturnas,
            nightWorker: p.nocturno,
            weeklyAverage: p.mediaSemanal,
            ...(p.menor ? { minor: true } : {}),
            ...(p.horasExtra !== null ? { overtimeHours: p.horasExtra } : {}),
            breaches: p.incumplimientos.map(incumplimientoEn),
        })),
        breaches: r.revision.personas.reduce((n, p) => n + p.incumplimientos.length, 0),
        unknownShifts: r.revision.avisos.map((a) => ({ person: a.persona, date: a.fecha, cell: a.texto })),
        notes: [
            "Checked against the Estatuto de los Trabajadores: 12 h between shifts (art. 34.3; some sectors allow 10 with compensation, RD 1561/1995), 9 ordinary hours a day unless the collective agreement says otherwise (34.3), a day and a half of uninterrupted weekly rest, which can be accumulated over up to 14 days (37.1), night workers at most 8 h a day on average over 15 days (36.1); for people marked as minors, no night work (6.2), no overtime (6.3), 8 h a day and 48 h of weekly rest; with a weekly contracted hours, overtime above the 80 a year, prorated (35.2).",
            "weeklyAverage is a reference only: the 40-hour limit is an annual average, and one month of rota is not enough to say it is breached.",
        ],
    };
}
const PERIODO: Record<Periodo, string> = { semana: "weekly", quincena: "fortnightly", mes: "monthly", trimestre: "quarterly" };
const FISCAL: Record<"aeat" | "tgss", string> = { aeat: "tax (AEAT)", tgss: "social security (TGSS)" };
const ERROR_EXT: Record<string, string> = {
    vacio: "The statement is empty.",
    formato: "Not a Norma 43 file nor a CSV with date, description and amount columns.",
    "sin-movimientos": "The statement has no transactions.",
};
export interface EntradaTesoreria {
    statement: string;
    startingBalance?: number;
    minimumBalance?: number;
    includeRest: boolean;
    weeks: number;
}
export function cashForecast(e: EntradaTesoreria) {
    const r = preverExtracto(e.statement, { saldo: e.startingBalance ?? null, minimo: e.minimumBalance, conResto: e.includeRest, semanas: e.weeks });
    if ("error" in r)
        return { error: ERROR_EXT[r.error.que] ?? r.error.que };
    const a = r.analisis;
    const p = r.prevision;
    const sumar = (xs: number[]) => Math.round(xs.reduce((t, x) => t + x, 0) * 100) / 100;
    return {
        format: r.extracto.formato === "n43" ? "Norma 43" : "CSV",
        statementPeriod: { from: a.desde, to: a.hasta, weeks: a.semanasHistoria, transactions: r.extracto.movimientos.length },
        recurringFlows: r.flujos.map((f) => ({
            concept: normalizar(f.concepto),
            every: PERIODO[f.periodo],
            amount: f.importe,
            times: f.veces,
            last: f.ultima,
            next: f.proxima,
            ...(f.variable ? { variable: true } : {}),
            ...(f.fiscal ? { kind: FISCAL[f.fiscal] } : {}),
        })),
        nonRecurringWeekly: e.includeRest ? a.restoSemanal : 0,
        extraordinary: { count: a.extraordinarios.length, total: sumar(a.extraordinarios.map((m) => m.importe)) },
        monthlyAverage: { in: a.entradasMes, out: a.salidasMes },
        ...(p ? {
            startingBalance: p.saldoInicial,
            weeks: p.semanas.map((s) => ({ from: s.desde, to: s.hasta, in: s.entradas, out: s.salidas, balance: s.saldo, items: s.apuntes.length })),
            lowest: { balance: p.minimo.saldo, week: p.minimo.semana + 1 },
            firstNegativeWeek: p.primeraNegativa === null ? null : p.primeraNegativa + 1,
            ...(e.minimumBalance !== undefined ? { firstWeekBelowMinimum: p.primeraBajoMinimo === null ? null : p.primeraBajoMinimo + 1 } : {}),
        } : { forecast: null, why: "No balance: the statement does not carry one. Pass startingBalance." }),
        readWarnings: r.extracto.avisos.map((w) => w.que === "linea-ilegible" ? `Line ${w.linea} could not be read.`
            : w.que === "n43-no-cuadra" ? `The Norma 43 totals do not add up (expected ${w.esperado}, read ${w.leido}).`
                : `The file has ${w.n} accounts: they are read together.`),
        notes: [
            "Recurring flows are detected from the statement (same normalised description and sign, regular dates); tax and social security payments follow their legal calendar. What does not repeat goes into a weekly average (nonRecurringWeekly), without the extraordinary movements.",
            "Descriptions are normalised (lower case, the first words, without numbers, dates or references) and only weekly totals are returned: the statement itself is not repeated.",
        ],
    };
}
