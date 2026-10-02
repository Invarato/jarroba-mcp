import { Injectable } from "@angular/core";
export interface DateBetween {
    totalDays: number;
    weeks: number;
    remainingDays: number;
    years: number;
    months: number;
    days: number;
    totalMonths: number;
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
const MS_DIA = 86400000;
export function diaDe(iso: string): number | null {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((iso ?? "").trim());
    if (!m)
        return null;
    const y = +m[1], mo = +m[2], d = +m[3];
    const t = Date.UTC(y, mo - 1, d);
    const f = new Date(t);
    if (f.getUTCFullYear() !== y || f.getUTCMonth() !== mo - 1 || f.getUTCDate() !== d)
        return null;
    return Math.round(t / MS_DIA);
}
export function isoDe(dia: number): string {
    return new Date(dia * MS_DIA).toISOString().slice(0, 10);
}
export function diaLocal(d: Date): number {
    return Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / MS_DIA);
}
export function diaSemana(dia: number): number {
    return new Date(dia * MS_DIA).getUTCDay();
}
const diasDelMes = (y: number, m: number) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
export function sumarMeses(dia: number, meses: number): number {
    const d = new Date(dia * MS_DIA);
    const total = d.getUTCFullYear() * 12 + d.getUTCMonth() + meses;
    const y = Math.floor(total / 12), m = total - y * 12;
    const dd = Math.min(d.getUTCDate(), diasDelMes(y, m));
    return Math.round(Date.UTC(y, m, dd) / MS_DIA);
}
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
