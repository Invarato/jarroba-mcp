import { Injectable } from "@angular/core";
import { MS_DIA, diaDe, isoDe } from "../shared/dias";
import { diaSemana, diasDelMes, sumarMeses } from "./calendario-dias";
export interface DateBetween {
    totalDays: number;
    weeks: number;
    remainingDays: number;
    years: number;
    months: number;
    days: number;
    totalMonths: number;
    weekendDays: number;
}
export interface DateAge {
    years: number;
    months: number;
    days: number;
    dayOfWeekIndex: number;
    nextBirthdayDays: number;
    totalDays: number;
}
export type UnidadSuma = "days" | "weeks" | "months" | "years";
export interface DateAdd {
    resultDate: string;
    dayOfWeekIndex: number;
}
export { diaDe, isoDe };
export function diaLocal(d: Date): number {
    return Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / MS_DIA);
}
export function hoyHastaFinDeAnio(ahora: Date = new Date()): {
    desde: string;
    hasta: string;
} {
    const hoy = isoDe(diaLocal(ahora));
    const y = Number(hoy.slice(0, 4));
    const fin = `${y}-12-31`;
    return { desde: hoy, hasta: hoy === fin ? `${y + 1}-12-31` : fin };
}
export { diaSemana, sumarMeses } from "./calendario-dias";
function difCalendario(a: number, b: number): {
    years: number;
    months: number;
    days: number;
} {
    const da = new Date(a * MS_DIA), db = new Date(b * MS_DIA);
    let m = (db.getUTCFullYear() - da.getUTCFullYear()) * 12 + (db.getUTCMonth() - da.getUTCMonth());
    if (sumarMeses(a, m) > b)
        m--;
    return { years: Math.floor(m / 12), months: m % 12, days: b - sumarMeses(a, m) };
}
function finesDeSemana(desde: number, n: number): number {
    let total = Math.floor(n / 7) * 2;
    for (let i = n - (n % 7); i < n; i++) {
        const d = diaSemana(desde + i);
        if (d === 0 || d === 6)
            total++;
    }
    return total;
}
@Injectable({ providedIn: "root" })
export class DateCalcService {
    between(from: string, to: string): DateBetween | null {
        const d1 = diaDe(from), d2 = diaDe(to);
        if (d1 === null || d2 === null)
            return null;
        const a = Math.min(d1, d2), b = Math.max(d1, d2);
        const totalDays = b - a;
        const c = difCalendario(a, b);
        return {
            totalDays,
            weeks: Math.floor(totalDays / 7),
            remainingDays: totalDays % 7,
            ...c,
            totalMonths: c.years * 12 + c.months,
            weekendDays: finesDeSemana(a, totalDays),
        };
    }
    age(birthStr: string, today: Date = new Date()): DateAge | null {
        const nac = diaDe(birthStr);
        if (nac === null)
            return null;
        const hoy = diaLocal(today);
        if (nac > hoy)
            return null;
        const c = difCalendario(nac, hoy);
        const n = new Date(nac * MS_DIA), h = new Date(hoy * MS_DIA);
        const cumple = (y: number) => {
            const d = Math.min(n.getUTCDate(), diasDelMes(y, n.getUTCMonth()));
            return Math.round(Date.UTC(y, n.getUTCMonth(), d) / MS_DIA);
        };
        let prox = cumple(h.getUTCFullYear());
        if (prox < hoy)
            prox = cumple(h.getUTCFullYear() + 1);
        return { ...c, dayOfWeekIndex: diaSemana(nac), nextBirthdayDays: prox - hoy, totalDays: hoy - nac };
    }
    add(baseStr: string, n: number, unidad: UnidadSuma): DateAdd | null {
        if (unidad === "days")
            return this.addDays(baseStr, n);
        if (unidad === "weeks")
            return this.addDays(baseStr, n * 7);
        const base = diaDe(baseStr);
        if (base === null || !Number.isInteger(n) || Math.abs(n) > 1000000)
            return null;
        const r = sumarMeses(base, unidad === "years" ? n * 12 : n);
        if (!Number.isFinite(r) || Math.abs(r) > 100000000)
            return null;
        return { resultDate: isoDe(r), dayOfWeekIndex: diaSemana(r) };
    }
    addDays(baseStr: string, days: number): DateAdd | null {
        const base = diaDe(baseStr);
        if (base === null || !Number.isFinite(days) || !Number.isInteger(days))
            return null;
        const r = base + days;
        if (Math.abs(r) > 100000000)
            return null;
        return { resultDate: isoDe(r), dayOfWeekIndex: diaSemana(r) };
    }
}
