import { diaDe, isoDe, diaLocal, sumarMeses } from "./date-calc.service";
import { CalendarioHabil, sumarHabiles, contarHabiles } from "./dias-habiles.service";
export class Fecha {
    readonly isFecha = true;
    constructor(readonly dia: number) { }
    toString(): string { return isoDe(this.dia); }
    valueOf(): string { return isoDe(this.dia); }
}
export const esFecha = (x: unknown): x is Fecha => !!x && (x as Fecha).isFecha === true;
interface UnidadMath {
    equalBase(u: unknown): boolean;
    toNumber(unidad: string): number;
    units: {
        unit: {
            name: string;
        };
    }[];
}
interface MathFechas {
    typed: ((nombre: string, firmas: Record<string, (...a: never[]) => unknown>) => unknown) & {
        addType(t: {
            name: string;
            test(x: unknown): boolean;
        }): void;
    };
    import(o: Record<string, unknown>, opts?: {
        override?: boolean;
    }): void;
    createUnit(nombre: string, def?: unknown, opts?: unknown): unknown;
    unit(v: number | string, u?: string): UnidadMath;
    unaryMinus(x: unknown): unknown;
    add(a: unknown, b: unknown): unknown;
}
const MESES = new Set(["month", "months", "mes", "meses"]);
const ANIOS = new Set(["year", "years", "anio", "anios"]);
export function registraFechas(math: unknown, cal: CalendarioHabil | null, hoy: () => Date = () => new Date()): void {
    const m = math as MathFechas;
    if ((m as unknown as {
        __fechas?: boolean;
    }).__fechas)
        return;
    (m as unknown as {
        __fechas?: boolean;
    }).__fechas = true;
    const calendario: CalendarioHabil = cal ?? { finde: [0, 6], festivos: new Map() };
    m.typed.addType({ name: "Fecha", test: esFecha });
    m.createUnit("dia", { definition: "1 day", aliases: ["dias"] });
    m.createUnit("semana", { definition: "1 week", aliases: ["semanas"] });
    m.createUnit("mes", { definition: "1 month", aliases: ["meses"] });
    m.createUnit("anio", { definition: "1 year", aliases: ["anios"] });
    m.createUnit("workday", { aliases: ["workdays", "laborable", "laborables"] });
    const LABORABLE = m.unit(1, "workday");
    const DIA = m.unit(1, "day");
    const suma = (f: Fecha, u: UnidadMath): Fecha => {
        if (u.equalBase(LABORABLE)) {
            const n = u.toNumber("workday");
            if (!Number.isInteger(n))
                throw new Error("Los d\u00EDas laborables tienen que ser enteros");
            const r = sumarHabiles(f.dia, n, calendario);
            if (!r)
                throw new Error("Con ese calendario no hay d\u00EDas laborables");
            return new Fecha(r.dia);
        }
        if (!u.equalBase(DIA))
            throw new Error("A una fecha solo se le puede sumar tiempo (d\u00EDas, semanas, meses, a\u00F1os) o laborables");
        const nombre = u.units[0]?.unit.name ?? "";
        if (MESES.has(nombre) || ANIOS.has(nombre)) {
            const n = u.toNumber(nombre);
            if (!Number.isInteger(n))
                throw new Error("Los meses y los a\u00F1os tienen que ser enteros");
            return new Fecha(sumarMeses(f.dia, ANIOS.has(nombre) ? n * 12 : n));
        }
        const dias = u.toNumber("day");
        if (!Number.isInteger(Math.round(dias * 1000000000) / 1000000000))
            throw new Error("A una fecha solo se le suman d\u00EDas enteros");
        return new Fecha(f.dia + Math.round(dias));
    };
    const date = (s: string) => {
        const d = diaDe(String(s));
        if (d === null)
            throw new Error(`«${s}» no es una fecha válida (AAAA-MM-DD)`);
        return new Fecha(d);
    };
    const today = () => new Fecha(diaLocal(hoy()));
    m.import({
        date,
        today,
        hoy: today,
        networkdays: m.typed("networkdays", {
            "Fecha, Fecha": (a: Fecha, b: Fecha) => {
                const r = contarHabiles(a.dia, b.dia, calendario);
                if (!r)
                    throw new Error("Con ese calendario no hay d\u00EDas laborables");
                return m.unit(a.dia <= b.dia ? r.habiles : -r.habiles, "workday");
            },
        }),
        add: m.typed("add", {
            "Fecha, Unit": (f: Fecha, u: UnidadMath) => suma(f, u),
            "Unit, Fecha": (u: UnidadMath, f: Fecha) => suma(f, u),
        }),
        subtract: m.typed("subtract", {
            "Fecha, Fecha": (a: Fecha, b: Fecha) => m.unit(a.dia - b.dia, "day"),
            "Fecha, Unit": (f: Fecha, u: UnidadMath) => suma(f, m.unaryMinus(u) as UnidadMath),
        }),
    }, { override: false });
}
export function prepararFechas(linea: string): string {
    return linea.split(/("[^"]*")/).map((trozo, i) => {
        if (i % 2 === 1)
            return trozo;
        return trozo
            .replace(/(?<![\w.])(\d{4}-\d{2}-\d{2})(?![\w.])/g, (t) => `date("${t}")`)
            .replace(/\bdías\b/g, "dias").replace(/\bdía\b/g, "dia")
            .replace(/\baños\b/g, "anios").replace(/\baño\b/g, "anio");
    }).join("");
}
export function usaFechas(texto: string): boolean {
    return /(?<![\w.])\d{4}-\d{2}-\d{2}(?![\w.])|\b(date|today|hoy|networkdays)\s*\(|\blaborables?\b|\bworkdays?\b/.test(texto);
}
export interface DeclaracionFestivos {
    pais: string;
    regiones: string[];
}
export function festivosDeHoja(texto: string): DeclaracionFestivos | null {
    const m = /^\s*#\s*@festivos\s+([A-Z]{2})((?:-[A-Z0-9]{1,3})?(?:[\s,]+[A-Z]{2}-[A-Z0-9]{1,3})*)\s*$/m.exec(texto ?? "");
    if (!m)
        return null;
    const pais = m[1];
    const resto = (m[2] ?? "").trim();
    const regiones = resto ? (resto.startsWith("-") ? [pais + resto.split(/[\s,]+/)[0], ...resto.split(/[\s,]+/).slice(1)] : resto.split(/[\s,]+/)) : [];
    return { pais, regiones: regiones.filter(Boolean) };
}
