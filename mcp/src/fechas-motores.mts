import festivosCaptura from "../../public/datos/festivos/2026-10-26.json";
import { calcularPlazo, contarHabiles, sumarHabiles, type CalendarioHabil, type DiaTraza, } from "../../src/app/services/dias-habiles";
import { aniosSinDatos, festivosDe, type DatosFestivos } from "../../src/app/services/festivos-datos";
import { diaDe, isoDe } from "../../src/app/shared/dias";
export const FESTIVOS_FICHERO = "2026-10-26.json";
const FESTIVOS = festivosCaptura as unknown as DatosFestivos;
const DIAS_EN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const diaSemana = (d: number) => DIAS_EN[new Date(d * 86400000).getUTCDay()];
const conDia = (d: number) => ({ date: isoDe(d), weekday: diaSemana(d) });
export const PAISES = Object.keys(FESTIVOS.paises);
export interface ErrorFechas {
    error: string;
}
function calendario(pais: string, regiones: readonly string[], extra: readonly string[], finde: readonly number[] = [0, 6]): {
    cal: CalendarioHabil;
} | ErrorFechas {
    const p = FESTIVOS.paises[pais];
    if (!p)
        return { error: `Unknown country "${pais}". One of: ${PAISES.join(", ")}.` };
    for (const r of regiones)
        if (!p.regiones[r]) {
            const lista = Object.keys(p.regiones);
            return { error: lista.length ? `Unknown region "${r}" for ${pais}. One of: ${lista.join(", ")}.` : `${pais} has no regional holidays here: leave region out.` };
        }
    const festivos = festivosDe(FESTIVOS, pais, regiones);
    for (const f of extra) {
        const d = diaDe(f);
        if (d === null)
            return { error: `"${f}" is not a date (YYYY-MM-DD).` };
        if (!festivos.has(d))
            festivos.set(d, "holiday given by the caller");
    }
    return { cal: { finde, festivos } };
}
function avisoAnios(pais: string, desde: number, hasta: number): string[] {
    const y0 = Number(isoDe(Math.min(desde, hasta)).slice(0, 4)), y1 = Number(isoDe(Math.max(desde, hasta)).slice(0, 4));
    const faltan = aniosSinDatos(FESTIVOS, pais, y0, y1);
    return faltan.length
        ? [`The official holidays of ${faltan.join(", ")} are not loaded for ${pais}: those days were counted as ordinary. Pass them in "holidays".`]
        : [];
}
const MOTIVO_EN: Record<string, string> = { finde: "weekend", festivo: "holiday", regla: "court rule" };
const REGLA_EN: Record<string, string> = { agosto: "August (LOPJ art. 183)", navidad: "24 December \u2013 6 January (LOPJ art. 183)" };
const saltado = (t: DiaTraza) => ({ ...conDia(t.dia), reason: MOTIVO_EN[t.motivo ?? ""] ?? t.motivo, name: t.motivo === "regla" ? REGLA_EN[t.detalle ?? ""] ?? t.detalle : t.detalle });
export interface ArgsDiasLaborables {
    from: string;
    to?: string;
    add?: number;
    country: string;
    region?: string;
    holidays?: string[];
    weekend?: number[];
    includeStart?: boolean;
    includeEnd?: boolean;
}
export function diasLaborables(a: ArgsDiasLaborables) {
    const desde = diaDe(a.from);
    if (desde === null)
        return { error: `"${a.from}" is not a date (YYYY-MM-DD).` };
    if ((a.to === undefined) === (a.add === undefined))
        return { error: "Give either \"to\" (count working days) or \"add\" (move N working days), not both." };
    const c = calendario(a.country, a.region ? [a.region] : [], a.holidays ?? [], a.weekend ?? [0, 6]);
    if ("error" in c)
        return c;
    const lugar = a.region ? `${FESTIVOS.paises[a.country].regiones[a.region]} (${a.country})` : FESTIVOS.paises[a.country].nombre;
    const fuente = `${FESTIVOS.paises[a.country].fuente}, snapshot ${FESTIVOS.generado ?? FESTIVOS_FICHERO}`;
    if (a.to !== undefined) {
        const hasta = diaDe(a.to);
        if (hasta === null)
            return { error: `"${a.to}" is not a date (YYYY-MM-DD).` };
        const incluirInicio = a.includeStart ?? true, incluirFin = a.includeEnd ?? true;
        const r = contarHabiles(desde, hasta, c.cal, { incluirInicio, incluirFin });
        if (!r)
            return { error: "Range too long (over 100 years) or no working day in the week." };
        return {
            mode: "count",
            place: lugar,
            from: conDia(Math.min(desde, hasta)),
            to: conDia(Math.max(desde, hasta)),
            includeStart: incluirInicio,
            includeEnd: incluirFin,
            workingDays: r.habiles,
            calendarDays: r.naturales,
            weekendDays: r.finde,
            holidays: r.festivos,
            holidaysOnWorkingDays: r.saltados.map(saltado),
            holidaySource: fuente,
            warnings: avisoAnios(a.country, desde, hasta),
        };
    }
    if (!Number.isInteger(a.add))
        return { error: "\"add\" must be a whole number of working days (negative = backwards)." };
    const r = sumarHabiles(desde, a.add!, c.cal);
    if (!r)
        return { error: "Too far (over 100 years) or no working day in the week." };
    return {
        mode: "add",
        place: lugar,
        from: conDia(desde),
        add: a.add,
        result: conDia(r.dia),
        countingRule: "Counting starts the day AFTER \"from\" (the day before, when going backwards).",
        skipped: r.traza.filter(t => !t.cuenta).map(saltado),
        holidaySource: fuente,
        warnings: avisoAnios(a.country, desde, r.dia),
    };
}
export interface ArgsPlazoLegal {
    notified: string;
    amount: number;
    unit: "days" | "months" | "years";
    regime: "administrative" | "judicial";
    region?: string;
    secondRegion?: string;
    localHolidays?: string[];
    urgent?: boolean;
}
export function plazoLegal(a: ArgsPlazoLegal) {
    const notif = diaDe(a.notified);
    if (notif === null)
        return { error: `"${a.notified}" is not a date (YYYY-MM-DD).` };
    const regiones = [a.region, a.secondRegion].filter((r): r is string => !!r);
    const c = calendario("ES", regiones, a.localHolidays ?? []);
    if ("error" in c)
        return c;
    const unidad = a.unit === "days" ? "dias" : a.unit === "months" ? "meses" : "anios";
    const r = calcularPlazo(notif, a.amount, unidad, a.regime === "judicial" ? "judicial" : "administrativo", c.cal, !!a.urgent);
    if (!r)
        return { error: "\"amount\" must be a positive whole number." };
    const reglas: string[] = [];
    if (a.regime === "administrative") {
        reglas.push(a.unit === "days"
            ? "Ley 39/2015, art. 30.2: business days exclude Saturdays, Sundays and public holidays; counting starts the day after notification."
            : "Ley 39/2015, art. 30.4: months/years run from date to date starting the day after notification; if that day does not exist in the final month, the last day of that month.");
        reglas.push("Art. 30.5: a deadline ending on a non-business day moves to the next business day.");
        if (regiones.length === 2)
            reglas.push("Art. 30.6: a holiday in EITHER the person's region or the authority's region is non-business (both regions applied).");
    }
    else {
        reglas.push("LOPJ art. 182 and LEC art. 130: Saturdays, Sundays and national, regional and local holidays are non-business.");
        reglas.push(a.urgent
            ? "Urgent proceedings: August and 24 December \u2013 6 January DO count (LOPJ art. 183, exception)."
            : "LOPJ art. 183 (as amended by LO 1/2025): August and 24 December \u2013 6 January are non-business days.");
        reglas.push(a.unit === "days" ? "LEC art. 133: counting starts the day after notification." : "LEC art. 133.3: months/years from date to date; if the end is non-business, the next business day.");
        reglas.push("LEC art. 135: a filing due on the last day is still admitted until 15:00 of the next business day (\"filingUntil15h\").");
    }
    const avisos = avisoAnios("ES", notif, r.vence);
    if (!(a.localHolidays ?? []).length)
        avisos.push("Local (municipal) holidays are not included: there is no single official source. Pass them in \"localHolidays\" if the deadline crosses one.");
    return {
        regime: a.regime,
        notified: conDia(notif),
        amount: a.amount,
        unit: a.unit,
        regions: regiones.map(rg => `${FESTIVOS.paises["ES"].regiones[rg]} (${rg})`),
        lastDay: conDia(r.vence),
        ...(r.bruto !== r.vence ? { wouldEndOn: conDia(r.bruto), extendedOver: r.prorroga.map(saltado) } : {}),
        ...(r.margen15h !== undefined ? { filingUntil15h: conDia(r.margen15h) } : {}),
        ...(r.traza.length ? { skipped: r.traza.filter(t => !t.cuenta).map(saltado) } : {}),
        rules: reglas,
        holidaySource: `${FESTIVOS.paises["ES"].fuente} (BOE), snapshot ${FESTIVOS.generado ?? FESTIVOS_FICHERO}`,
        warnings: avisos,
    };
}
export const REGIONES = Object.fromEntries(PAISES.map(p => [p, Object.keys(FESTIVOS.paises[p].regiones)]));
