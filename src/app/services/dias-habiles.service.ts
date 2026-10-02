import { Injectable } from "@angular/core";
import { diaSemana, isoDe, sumarMeses } from "./date-calc.service";
export type MotivoInhabil = "finde" | "festivo" | "regla";
export interface CalendarioHabil {
    finde: readonly number[];
    festivos: ReadonlyMap<number, string>;
    regla?: (dia: number) => string | null;
}
export interface DiaTraza {
    dia: number;
    cuenta: boolean;
    motivo?: MotivoInhabil;
    detalle?: string;
    n?: number;
}
export interface ResultadoContar {
    habiles: number;
    naturales: number;
    finde: number;
    festivos: number;
    regla: number;
    saltados: DiaTraza[];
}
export interface ResultadoSumar {
    dia: number;
    traza: DiaTraza[];
}
export const MAX_RECORRIDO = 36600;
export function calendarioViable(cal: CalendarioHabil): boolean {
    return new Set(cal.finde.filter(d => d >= 0 && d <= 6)).size < 7;
}
export function motivoInhabil(dia: number, cal: CalendarioHabil): {
    motivo: MotivoInhabil;
    detalle?: string;
} | null {
    const fest = cal.festivos.get(dia);
    if (cal.finde.includes(diaSemana(dia)))
        return fest ? { motivo: "finde", detalle: fest } : { motivo: "finde" };
    if (fest !== undefined)
        return { motivo: "festivo", detalle: fest };
    const r = cal.regla?.(dia);
    if (r)
        return { motivo: "regla", detalle: r };
    return null;
}
export function contarHabiles(a: number, b: number, cal: CalendarioHabil, opts: {
    incluirInicio?: boolean;
    incluirFin?: boolean;
} = {}): ResultadoContar | null {
    if (!calendarioViable(cal))
        return null;
    const ini = Math.min(a, b), fin = Math.max(a, b);
    if (fin - ini > MAX_RECORRIDO)
        return null;
    const desde = opts.incluirInicio ? ini : ini + 1;
    const hasta = opts.incluirFin === false ? fin - 1 : fin;
    const r: ResultadoContar = { habiles: 0, naturales: 0, finde: 0, festivos: 0, regla: 0, saltados: [] };
    for (let d = desde; d <= hasta; d++) {
        r.naturales++;
        const m = motivoInhabil(d, cal);
        if (!m) {
            r.habiles++;
            continue;
        }
        if (m.motivo === "finde")
            r.finde++;
        else {
            if (m.motivo === "festivo")
                r.festivos++;
            else
                r.regla++;
            r.saltados.push({ dia: d, cuenta: false, ...m });
        }
    }
    return r;
}
export function sumarHabiles(desde: number, n: number, cal: CalendarioHabil): ResultadoSumar | null {
    if (!Number.isInteger(n) || !calendarioViable(cal))
        return null;
    if (n === 0)
        return { dia: desde, traza: [] };
    const paso = n > 0 ? 1 : -1;
    const traza: DiaTraza[] = [];
    let d = desde, cuenta = 0;
    while (cuenta < Math.abs(n)) {
        d += paso;
        if (Math.abs(d - desde) > MAX_RECORRIDO)
            return null;
        const m = motivoInhabil(d, cal);
        if (m)
            traza.push({ dia: d, cuenta: false, ...m });
        else {
            cuenta++;
            traza.push({ dia: d, cuenta: true, n: cuenta });
        }
    }
    return { dia: d, traza };
}
export function siguienteHabil(dia: number, cal: CalendarioHabil): {
    dia: number;
    saltados: DiaTraza[];
} | null {
    if (!calendarioViable(cal))
        return null;
    const saltados: DiaTraza[] = [];
    let d = dia;
    for (let i = 0; i <= MAX_RECORRIDO; i++, d++) {
        const m = motivoInhabil(d, cal);
        if (!m)
            return { dia: d, saltados };
        saltados.push({ dia: d, cuenta: false, ...m });
    }
    return null;
}
export function leerFestivosManuales(texto: string, diaDe: (iso: string) => number | null): {
    festivos: Map<number, string>;
    errores: number[];
} {
    const festivos = new Map<number, string>();
    const errores: number[] = [];
    (texto ?? "").split("\n").forEach((raw, i) => {
        const linea = raw.replace(/#.*$/, "").trim();
        if (!linea)
            return;
        const m = /^(\d{4}-\d{2}-\d{2})\s*(.*)$/.exec(linea);
        const d = m ? diaDe(m[1]) : null;
        if (d === null) {
            errores.push(i + 1);
            return;
        }
        festivos.set(d, m![2].trim());
    });
    return { festivos, errores };
}
export type Regimen = "administrativo" | "judicial";
export type UnidadPlazo = "dias" | "meses" | "anios";
export type ReglaJudicial = "agosto" | "navidad";
export function reglaJudicial(dia: number): ReglaJudicial | null {
    const iso = isoDe(dia), mes = +iso.slice(5, 7), d = +iso.slice(8, 10);
    if (mes === 8)
        return "agosto";
    if ((mes === 12 && d >= 24) || (mes === 1 && d <= 6))
        return "navidad";
    return null;
}
export interface ResultadoPlazo {
    vence: number;
    bruto: number;
    prorroga: DiaTraza[];
    traza: DiaTraza[];
    margen15h?: number;
}
export function calcularPlazo(notificacion: number, n: number, unidad: UnidadPlazo, regimen: Regimen, cal: CalendarioHabil, urgente = false): ResultadoPlazo | null {
    if (!Number.isInteger(n) || n <= 0)
        return null;
    const calR: CalendarioHabil = regimen === "judicial" && !urgente ? { ...cal, regla: reglaJudicial } : cal;
    let vence: number, bruto: number, traza: DiaTraza[] = [], prorroga: DiaTraza[] = [];
    if (unidad === "dias") {
        const r = sumarHabiles(notificacion, n, calR);
        if (!r)
            return null;
        vence = bruto = r.dia;
        traza = r.traza;
    }
    else {
        bruto = sumarMeses(notificacion, unidad === "anios" ? n * 12 : n);
        const s = siguienteHabil(bruto, calR);
        if (!s)
            return null;
        vence = s.dia;
        prorroga = s.saltados;
    }
    const res: ResultadoPlazo = { vence, bruto, prorroga, traza };
    if (regimen === "judicial") {
        const s = siguienteHabil(vence + 1, calR);
        if (s)
            res.margen15h = s.dia;
    }
    return res;
}
@Injectable({ providedIn: "root" })
export class DiasHabilesService {
    contar = contarHabiles;
    sumar = sumarHabiles;
    siguiente = siguienteHabil;
}
