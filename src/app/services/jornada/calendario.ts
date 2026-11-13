import { diaDe, isoDe } from "../../shared/dias";
import { DatosFestivos, festivosDe } from "../festivos-datos";
export type HorarioSemanal = [
    number,
    number,
    number,
    number,
    number,
    number,
    number
];
export interface ConfigCalendario {
    anio: number;
    festivosOficiales: Map<number, string>;
    locales: {
        fecha: string;
        nombre: string;
    }[];
    horario: HorarioSemanal;
    intensiva?: {
        desde: string;
        hasta: string;
        horario: HorarioSemanal;
    } | null;
    cierres: string[];
    vacaciones: {
        dias: number;
        tipo: "laborables" | "naturales";
    };
    jornadaAnual: number | null;
}
export type TipoDia = "laborable" | "descanso" | "festivo" | "cierre";
export interface DiaCalendario {
    dia: number;
    fecha: string;
    semana: number;
    tipo: TipoDia;
    horas: number;
    festivo?: string;
    local?: true;
    intensiva?: true;
}
export interface ResultadoCalendario {
    dias: DiaCalendario[];
    diasLaborables: number;
    horasBrutas: number;
    vacacionesLaborables: number;
    horasVacaciones: number;
    horasCierres: number;
    horasEfectivas: number;
    mediaHorasDia: number;
    diferencia: number | null;
    diasAjuste: number | null;
    minutosMasAlDia: number | null;
    festivosEnLaborable: number;
    festivosEnDescanso: number;
    cierres: number;
    avisos: AvisoCalendario[];
}
export type AvisoCalendario = {
    que: "locales-no-dos";
    n: number;
} | {
    que: "cierres-mas-que-vacaciones";
    cierres: number;
    vacaciones: number;
} | {
    que: "local-fuera-de-anio";
    fecha: string;
} | {
    que: "jornada-semanal-mas-de-40";
    horas: number;
} | {
    que: "dia-mas-de-9";
    semana: number;
    horas: number;
};
const r2 = (x: number) => Math.round(x * 100) / 100;
function enTramo(mmdd: string, desde: string, hasta: string): boolean {
    return desde <= hasta ? mmdd >= desde && mmdd <= hasta : mmdd >= desde || mmdd <= hasta;
}
export function calcularCalendario(c: ConfigCalendario): ResultadoCalendario {
    const avisos: AvisoCalendario[] = [];
    const locales = new Map<number, string>();
    for (const l of c.locales) {
        const d = diaDe(l.fecha);
        if (d === null)
            continue;
        if (!l.fecha.startsWith(`${c.anio}-`)) {
            avisos.push({ que: "local-fuera-de-anio", fecha: l.fecha });
            continue;
        }
        locales.set(d, l.nombre || l.fecha);
    }
    if (locales.size !== 2)
        avisos.push({ que: "locales-no-dos", n: locales.size });
    const cierres = new Set(c.cierres.filter((f) => f.startsWith(`${c.anio}-`)).map((f) => diaDe(f)).filter((d): d is number => d !== null));
    const inicio = diaDe(`${c.anio}-01-01`)!, fin = diaDe(`${c.anio}-12-31`)!;
    const dias: DiaCalendario[] = [];
    let diasLaborables = 0, horasBrutas = 0, horasCierres = 0, festivosEnLaborable = 0, festivosEnDescanso = 0, nCierres = 0;
    for (let d = inicio; d <= fin; d++) {
        const fecha = isoDe(d);
        const semana = (new Date(d * 86400000).getUTCDay() + 6) % 7;
        const intensiva = !!c.intensiva && enTramo(fecha.slice(5), c.intensiva.desde, c.intensiva.hasta);
        const horasHorario = (intensiva ? c.intensiva!.horario : c.horario)[semana] || 0;
        const festivo = locales.get(d) ?? c.festivosOficiales.get(d);
        const base = { dia: d, fecha, semana, ...(intensiva ? { intensiva: true as const } : {}) };
        if (festivo) {
            if (horasHorario > 0)
                festivosEnLaborable++;
            else
                festivosEnDescanso++;
            dias.push({ ...base, tipo: "festivo", horas: 0, festivo, ...(locales.has(d) ? { local: true as const } : {}) });
        }
        else if (horasHorario <= 0) {
            dias.push({ ...base, tipo: "descanso", horas: 0 });
        }
        else {
            diasLaborables++;
            horasBrutas += horasHorario;
            if (cierres.has(d)) {
                nCierres++;
                horasCierres += horasHorario;
                dias.push({ ...base, tipo: "cierre", horas: horasHorario });
            }
            else
                dias.push({ ...base, tipo: "laborable", horas: horasHorario });
        }
    }
    const mediaHorasDia = diasLaborables ? horasBrutas / diasLaborables : 0;
    const diasSemana = c.horario.filter((h) => h > 0).length;
    const vacacionesLaborables = c.vacaciones.tipo === "laborables" ? c.vacaciones.dias : r2((c.vacaciones.dias * diasSemana) / 7);
    if (nCierres > vacacionesLaborables)
        avisos.push({ que: "cierres-mas-que-vacaciones", cierres: nCierres, vacaciones: vacacionesLaborables });
    const horasVacaciones = r2(Math.max(vacacionesLaborables * mediaHorasDia, horasCierres));
    const horasEfectivas = r2(horasBrutas - horasVacaciones);
    const diferencia = c.jornadaAnual !== null && c.jornadaAnual > 0 ? r2(horasEfectivas - c.jornadaAnual) : null;
    const diasTrabajo = diasLaborables - Math.max(vacacionesLaborables, nCierres);
    const semanal = c.horario.reduce((s, h) => s + h, 0);
    if (semanal > 40)
        avisos.push({ que: "jornada-semanal-mas-de-40", horas: semanal });
    c.horario.forEach((h, i) => { if (h > 9)
        avisos.push({ que: "dia-mas-de-9", semana: i, horas: h }); });
    return {
        dias,
        diasLaborables,
        horasBrutas: r2(horasBrutas),
        vacacionesLaborables,
        horasVacaciones,
        horasCierres: r2(horasCierres),
        horasEfectivas,
        mediaHorasDia: r2(mediaHorasDia),
        diferencia,
        diasAjuste: diferencia !== null && diferencia > 0 && mediaHorasDia > 0 ? r2(diferencia / mediaHorasDia) : null,
        minutosMasAlDia: diferencia !== null && diferencia < 0 && diasTrabajo > 0 ? Math.ceil((-diferencia * 60) / diasTrabajo) : null,
        festivosEnLaborable,
        festivosEnDescanso,
        cierres: nCierres,
        avisos,
    };
}
export function calendarioDeCentro(c: Omit<ConfigCalendario, "festivosOficiales"> & {
    region?: string;
}, datos: DatosFestivos | null): ResultadoCalendario & {
    festivosCargados: boolean;
} {
    const { region, ...resto } = c;
    return {
        ...calcularCalendario({ ...resto, festivosOficiales: festivosDe(datos, "ES", region ? [region] : []) }),
        festivosCargados: (datos?.paises["ES"]?.anios ?? []).includes(c.anio),
    };
}
