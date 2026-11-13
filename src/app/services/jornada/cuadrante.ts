import { diaDe, isoDe } from "../../shared/dias";
export interface Tramo {
    ini: number;
    fin: number;
}
export type Turnos = Record<string, Tramo[]>;
export const TURNOS_POR_DEFECTO: Record<string, string> = {
    M: "06:00-14:00",
    T: "14:00-22:00",
    N: "22:00-06:00",
    P: "09:00-13:00+16:00-20:00",
    L: "",
    D: "",
    V: "",
};
export interface ReglasCuadrante {
    descansoEntreJornadas: number;
    maxHorasDia: number;
    descansoSemanal: number;
    periodoDescanso: number;
    maxPromedioNocturno: number;
}
export const REGLAS_ET: ReglasCuadrante = { descansoEntreJornadas: 12, maxHorasDia: 9, descansoSemanal: 36, periodoDescanso: 14, maxPromedioNocturno: 8 };
export interface Cuadrante {
    dias: number[];
    personas: {
        nombre: string;
        celdas: string[];
    }[];
}
export type ErrorLectura = {
    que: "vacio";
} | {
    que: "sin-fechas";
} | {
    que: "fecha";
    columna: number;
    texto: string;
} | {
    que: "fechas-no-seguidas";
    columna: number;
};
export type AvisoLectura = {
    que: "turno-desconocido";
    persona: string;
    fecha: string;
    texto: string;
};
export type Incumplimiento = {
    regla: "descanso-entre-jornadas";
    fecha: string;
    horas: number;
} | {
    regla: "horas-dia";
    fecha: string;
    horas: number;
} | {
    regla: "descanso-semanal";
    desde: string;
    hasta: string;
    bloques: number;
    necesarios: number;
    mayorHoras: number;
} | {
    regla: "nocturno";
    desde: string;
    hasta: string;
    promedio: number;
} | {
    regla: "menor-nocturno";
    fecha: string;
    horas: number;
} | {
    regla: "menor-horas-extra";
    horas: number;
} | {
    regla: "horas-extra-tope";
    horas: number;
    tope: number;
};
export interface DatosPersona {
    horasSemana?: number;
    menor?: boolean;
}
export const REGLAS_MENOR = { maxHorasDia: 8, descansoSemanal: 48 };
export interface RevisionPersona {
    nombre: string;
    horas: number;
    diasTrabajados: number;
    horasNocturnas: number;
    nocturno: boolean;
    mediaSemanal: number;
    incumplimientos: Incumplimiento[];
    horasPorDia: number[];
    menor?: true;
    horasExtra: number | null;
}
export interface RevisionCuadrante {
    personas: RevisionPersona[];
    avisos: AvisoLectura[];
    dias: number[];
}
const MIN_DIA = 1440;
const r2 = (x: number) => Math.round(x * 100) / 100;
function leerHora(t: string): number | null {
    const m = /^(\d{1,2})(?:[:.h](\d{2}))?$/.exec(t.trim());
    if (!m)
        return null;
    const h = Number(m[1]), mi = Number(m[2] ?? 0);
    return h <= 24 && mi < 60 ? h * 60 + mi : null;
}
export function leerTramos(texto: string): Tramo[] | null {
    const t = texto.trim();
    if (!t)
        return [];
    const out: Tramo[] = [];
    for (const parte of t.split(/\s*[+/]\s*|\s+y\s+/)) {
        const m = /^(.+?)\s*(?:-|–|a)\s*(.+)$/.exec(parte.trim());
        if (!m)
            return null;
        const ini = leerHora(m[1]), fin = leerHora(m[2]);
        if (ini === null || fin === null || ini === fin)
            return null;
        out.push({ ini, fin: fin > ini ? fin : fin + MIN_DIA });
    }
    return out.sort((a, b) => a.ini - b.ini);
}
export function leerTurnos(dic: Record<string, string>): Turnos {
    const out: Turnos = {};
    for (const [k, v] of Object.entries(dic)) {
        const tr = leerTramos(v);
        if (k.trim() && tr)
            out[k.trim().toUpperCase()] = tr;
    }
    return out;
}
const NO_TRABAJA = /^(-|—|libre|descanso|x)$/i;
function tramosDeCelda(texto: string, turnos: Turnos): Tramo[] | null {
    const t = texto.trim();
    if (!t || NO_TRABAJA.test(t))
        return [];
    const cod = turnos[t.toUpperCase()];
    if (cod)
        return cod;
    return leerTramos(t);
}
function separador(linea: string): string {
    if (linea.includes("\t"))
        return "\t";
    return (linea.split(";").length >= linea.split(",").length) ? ";" : ",";
}
export function leerFecha(t: string, anio: number, mes: number): number | null {
    const s = t.trim().replace(/^[a-záéíóúñ]+\.?\s+/i, "");
    let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (m)
        return diaDe(s);
    m = /^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?$/.exec(s);
    if (m) {
        const y = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : anio;
        return diaDe(`${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`);
    }
    m = /^(\d{1,2})$/.exec(s);
    if (m)
        return diaDe(`${anio}-${String(mes).padStart(2, "0")}-${m[1].padStart(2, "0")}`);
    return null;
}
export function leerCuadrante(texto: string, anio: number, mes: number): {
    cuadrante: Cuadrante;
} | {
    error: ErrorLectura;
} {
    const lineas = texto.replace(/\r/g, "").split("\n").filter((l) => l.trim());
    if (lineas.length < 2)
        return { error: { que: "vacio" } };
    const sep = separador(lineas[0]);
    const cab = lineas[0].split(sep).slice(1);
    while (cab.length && !cab[cab.length - 1].trim())
        cab.pop();
    if (!cab.length)
        return { error: { que: "sin-fechas" } };
    const dias: number[] = [];
    let y = anio, m = mes;
    for (let i = 0; i < cab.length; i++) {
        const soloDia = /^\s*(?:[a-záéíóúñ]+\.?\s+)?\d{1,2}\s*$/i.test(cab[i]);
        let d = leerFecha(cab[i], y, m);
        if (soloDia && d !== null && dias.length && d <= dias[dias.length - 1]) {
            m = m === 12 ? 1 : m + 1;
            if (m === 1)
                y++;
            d = leerFecha(cab[i], y, m);
        }
        if (d === null)
            return { error: { que: "fecha", columna: i + 2, texto: cab[i].trim() } };
        if (dias.length && d !== dias[dias.length - 1] + 1)
            return { error: { que: "fechas-no-seguidas", columna: i + 2 } };
        dias.push(d);
    }
    const personas = lineas.slice(1).map((l) => {
        const c = l.split(sep);
        return { nombre: c[0].trim(), celdas: dias.map((_, i) => (c[i + 1] ?? "").trim()) };
    }).filter((p) => p.nombre || p.celdas.some(Boolean));
    return { cuadrante: { dias, personas } };
}
function minutosNocturnos(a: number, b: number): number {
    let n = 0;
    for (let base = Math.floor(a / MIN_DIA) * MIN_DIA - MIN_DIA; base < b; base += MIN_DIA) {
        for (const [x, y] of [[base, base + 360], [base + 1320, base + MIN_DIA]])
            n += Math.max(0, Math.min(b, y) - Math.max(a, x));
    }
    return n;
}
export const clavePersona = (nombre: string) => nombre.trim().replace(/\s+/g, " ").toLowerCase();
export function revisarCuadrante(c: Cuadrante, turnos: Turnos, reglasComunes: ReglasCuadrante = REGLAS_ET, datos: Record<string, DatosPersona> = {}): RevisionCuadrante {
    const avisos: AvisoLectura[] = [];
    const nDias = c.dias.length;
    const porNombre = new Map(Object.entries(datos).map(([k, v]) => [clavePersona(k), v]));
    const personas = c.personas.map((p): RevisionPersona => {
        const inc: Incumplimiento[] = [];
        const dp = porNombre.get(clavePersona(p.nombre)) ?? {};
        const reglas: ReglasCuadrante = dp.menor
            ? { ...reglasComunes, maxHorasDia: Math.min(reglasComunes.maxHorasDia, REGLAS_MENOR.maxHorasDia), descansoSemanal: Math.max(reglasComunes.descansoSemanal, REGLAS_MENOR.descansoSemanal) }
            : reglasComunes;
        const jornadas: ({
            ini: number;
            fin: number;
            min: number;
            noct: number;
        } | null)[] = p.celdas.map((celda, i) => {
            const tr = tramosDeCelda(celda, turnos);
            if (tr === null) {
                avisos.push({ que: "turno-desconocido", persona: p.nombre, fecha: isoDe(c.dias[i]), texto: celda });
                return null;
            }
            if (!tr.length)
                return null;
            const base = i * MIN_DIA;
            const min = tr.reduce((s, t) => s + t.fin - t.ini, 0);
            const noct = tr.reduce((s, t) => s + minutosNocturnos(base + t.ini, base + t.fin), 0);
            return { ini: base + tr[0].ini, fin: base + Math.max(...tr.map((t) => t.fin)), min, noct };
        });
        const horasPorDia = jornadas.map((j) => (j ? r2(j.min / 60) : 0));
        const trabajadas = jornadas.filter((j): j is NonNullable<typeof j> => !!j);
        jornadas.forEach((j, i) => { if (j && j.min > reglas.maxHorasDia * 60)
            inc.push({ regla: "horas-dia", fecha: isoDe(c.dias[i]), horas: r2(j.min / 60) }); });
        for (let k = 1; k < trabajadas.length; k++) {
            const hueco = trabajadas[k].ini - trabajadas[k - 1].fin;
            if (hueco < reglas.descansoEntreJornadas * 60) {
                inc.push({ regla: "descanso-entre-jornadas", fecha: isoDe(c.dias[0] + Math.floor(trabajadas[k].ini / MIN_DIA)), horas: r2(Math.max(0, hueco) / 60) });
            }
        }
        const bloque = reglas.descansoSemanal * 60;
        const fin = nDias * MIN_DIA;
        const huecos: {
            ini: number;
            fin: number;
        }[] = [];
        let cursor = 0;
        for (const j of trabajadas) {
            if (j.ini > cursor)
                huecos.push({ ini: cursor, fin: j.ini });
            cursor = Math.max(cursor, j.fin);
        }
        if (fin > cursor)
            huecos.push({ ini: cursor, fin });
        const periodos: {
            p0: number;
            p1: number;
            bloques: number;
            mayor: number;
        }[] = [];
        for (let p0 = 0; p0 < nDias; p0 += reglas.periodoDescanso)
            periodos.push({ p0, p1: Math.min(nDias, p0 + reglas.periodoDescanso), bloques: 0, mayor: 0 });
        for (const h of huecos) {
            let repartidos = 0;
            for (const per of periodos) {
                const a = per.p0 * MIN_DIA, b = per.p1 * MIN_DIA;
                const trozo = Math.min(b, h.fin) - Math.max(a, h.ini);
                if (trozo <= 0)
                    continue;
                const n = Math.floor(trozo / bloque);
                per.bloques += n;
                repartidos += n;
                per.mayor = Math.max(per.mayor, h.fin - h.ini);
            }
            const perdidos = Math.floor((h.fin - h.ini) / bloque) - repartidos;
            if (perdidos > 0)
                periodos[Math.min(periodos.length - 1, Math.max(0, Math.floor(h.ini / (reglas.periodoDescanso * MIN_DIA))))].bloques += perdidos;
        }
        for (const per of periodos) {
            const necesarios = Math.floor((per.p1 - per.p0) / 7);
            if (necesarios && per.bloques < necesarios) {
                inc.push({ regla: "descanso-semanal", desde: isoDe(c.dias[per.p0]), hasta: isoDe(c.dias[per.p1 - 1]), bloques: per.bloques, necesarios, mayorHoras: r2(per.mayor / 60) });
            }
        }
        const nocturno = trabajadas.some((j) => j.noct >= 180);
        if (nocturno) {
            for (let p0 = 0; p0 < nDias; p0 += 15) {
                const js = jornadas.slice(p0, p0 + 15).filter((j): j is NonNullable<typeof j> => !!j);
                if (!js.length)
                    continue;
                const promedio = js.reduce((s, j) => s + j.min, 0) / js.length / 60;
                if (promedio > reglas.maxPromedioNocturno) {
                    inc.push({ regla: "nocturno", desde: isoDe(c.dias[p0]), hasta: isoDe(c.dias[Math.min(nDias, p0 + 15) - 1]), promedio: r2(promedio) });
                }
            }
        }
        if (dp.menor)
            jornadas.forEach((j, i) => { if (j && j.noct > 0)
                inc.push({ regla: "menor-nocturno", fecha: isoDe(c.dias[i]), horas: r2(j.noct / 60) }); });
        const horas = r2(trabajadas.reduce((s, j) => s + j.min, 0) / 60);
        let horasExtra: number | null = null;
        if (dp.horasSemana !== undefined && dp.horasSemana >= 0 && nDias) {
            horasExtra = r2(Math.max(0, horas - (dp.horasSemana * nDias) / 7));
            const tope = r2((80 * nDias) / 365);
            if (dp.menor && horasExtra > 0)
                inc.push({ regla: "menor-horas-extra", horas: horasExtra });
            else if (horasExtra > tope)
                inc.push({ regla: "horas-extra-tope", horas: horasExtra, tope });
        }
        return {
            ...(dp.menor ? { menor: true as const } : {}),
            horasExtra,
            nombre: p.nombre,
            horas,
            diasTrabajados: trabajadas.length,
            horasNocturnas: r2(trabajadas.reduce((s, j) => s + j.noct, 0) / 60),
            nocturno,
            mediaSemanal: nDias ? r2((horas * 7) / nDias) : 0,
            incumplimientos: inc.sort((x, y) => ("fecha" in x ? x.fecha : "desde" in x ? x.desde : "~").localeCompare("fecha" in y ? y.fecha : "desde" in y ? y.desde : "~")),
            horasPorDia,
        };
    });
    return { personas, avisos, dias: c.dias };
}
export function revisarTexto(texto: string, o: {
    anio: number;
    mes: number;
    turnos?: Record<string, string>;
    reglas?: Partial<ReglasCuadrante>;
    personas?: Record<string, DatosPersona>;
}): {
    revision: RevisionCuadrante;
    cuadrante: Cuadrante;
    reglas: ReglasCuadrante;
} | {
    error: ErrorLectura;
} {
    const l = leerCuadrante(texto, o.anio, o.mes);
    if ("error" in l)
        return l;
    const reglas = { ...REGLAS_ET, ...o.reglas };
    return { revision: revisarCuadrante(l.cuadrante, leerTurnos(o.turnos ?? TURNOS_POR_DEFECTO), reglas, o.personas), cuadrante: l.cuadrante, reglas };
}
