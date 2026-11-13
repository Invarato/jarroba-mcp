import { ResultadoBacktest, anomalias, backtest, cambioDeNivel, etiquetaConfig } from "./forecast-backtest";
import { preverConCalendario, EfectoCalendario } from "./forecast-calendario";
import { ConfigModelo, Modelo, OpcionesArima, Prevision, arimaAuto, prever, zDeNivel } from "./forecast-modelos";
import { diaDe, isoDe } from "../shared/dias";
import { sumarMeses } from "./forecast-ejemplos";
export type Nivel = 0.8 | 0.95;
export const MAX_PUNTOS = 1500;
export interface Peticion {
    y: readonly number[];
    m: number;
    h: number;
    nivel: Nivel;
    modelo: Modelo;
    orden?: OpcionesArima | null;
    festivos?: readonly number[] | null;
}
export interface ModeloInforme {
    clave: Modelo;
    etiqueta: string;
    config: ConfigModelo;
    prevision: Prevision;
    efecto: EfectoCalendario | null;
    bt: ResultadoBacktest | null;
}
export interface Informe {
    modelos: ModeloInforme[];
    elegido: ModeloInforme;
    base: ModeloInforme | null;
    mejor: ModeloInforme | null;
    veredicto: "bate" | "no-bate" | "sin-backtest";
    anomalias: number[];
    cambioNivel: number | null;
    avisos: string[];
    n: number;
    recortada: boolean;
}
export interface SerieLeida {
    y: number[];
    fechas: string[] | null;
    error?: undefined;
}
export interface ErrorLectura {
    error: "vacio" | "pocos" | "numero" | "fechas-desordenadas";
    linea?: number;
}
const NUM = /^[-+]?(\d+([.,]\d*)?|[.,]\d+)([eE][-+]?\d+)?$/;
const FECHA = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/;
function aNumero(t: string): number | null {
    const s = t.trim().replace(/^"|"$/g, "");
    if (!NUM.test(s))
        return null;
    const v = Number(s.replace(",", "."));
    return Number.isFinite(v) ? v : null;
}
export function leerSerie(texto: string): SerieLeida | ErrorLectura {
    const lineas = texto.split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith("#"));
    if (!lineas.length)
        return { error: "vacio" };
    const y: number[] = [], fechas: string[] = [];
    let conFechas: boolean | null = null;
    for (let i = 0; i < lineas.length; i++) {
        const suelto = aNumero(lineas[i]);
        if (suelto !== null) {
            if (conFechas === null)
                conFechas = false;
            else if (conFechas)
                return { error: "numero", linea: i + 1 };
            y.push(suelto);
            continue;
        }
        const partes = lineas[i].includes(";") || lineas[i].includes("\t") ? lineas[i].split(/[;\t]/) : lineas[i].split(",");
        const cols = partes.map(p => p.trim());
        const ult = aNumero(cols[cols.length - 1]);
        if (ult === null) {
            if (i === 0)
                continue;
            return { error: "numero", linea: i + 1 };
        }
        const f = cols.length > 1 ? FECHA.exec(cols[0]) : null;
        const tiene = f !== null;
        if (conFechas === null)
            conFechas = tiene;
        else if (conFechas !== tiene)
            return { error: "numero", linea: i + 1 };
        if (f)
            fechas.push(f[3] ? cols[0] : `${f[1]}-${f[2]}-01`);
        y.push(ult);
    }
    if (y.length < 8)
        return { error: "pocos" };
    if (conFechas) {
        for (let i = 1; i < fechas.length; i++)
            if (fechas[i] <= fechas[i - 1])
                return { error: "fechas-desordenadas", linea: i + 1 };
    }
    return { y, fechas: conFechas ? fechas : null };
}
export const esError = (r: SerieLeida | ErrorLectura): r is ErrorLectura => r.error !== undefined;
export function inferirPaso(fechas: readonly string[]): "dia" | "mes" | null {
    if (fechas.length < 3)
        return null;
    const dias = fechas.map(f => diaDe(f));
    if (dias.some(d => d === null))
        return null;
    const difs = dias.slice(1).map((d, i) => (d as number) - (dias[i] as number));
    if (difs.every(d => d === 1))
        return "dia";
    if (difs.every(d => d >= 28 && d <= 31))
        return "mes";
    return null;
}
export function fechaSiguiente(ultima: string, paso: "dia" | "mes", k: number): string {
    if (paso === "mes")
        return sumarMeses(ultima.slice(0, 7) + "-01", k);
    const d = diaDe(ultima);
    return d === null ? ultima : isoDe(d + k);
}
export const periodoDe = (paso: "dia" | "mes" | null) => (paso === "dia" ? 7 : paso === "mes" ? 12 : 1);
export function planBacktest(n: number, h: number, m: number): {
    inicial: number;
} | null {
    const minimo = Math.max(m > 1 ? 3 * m : 12, 12);
    const inicial = Math.max(minimo, Math.ceil(n * 0.4));
    if (n - h >= inicial)
        return { inicial };
    const reducido = Math.max(minimo, n - h - 3);
    return n - h >= reducido && n - h >= minimo ? { inicial: reducido } : null;
}
function elegirConfig(clave: Modelo, y: readonly number[], m: number, h: number, nivel: number, orden: OpcionesArima | null | undefined): ConfigModelo {
    switch (clave) {
        case "naive": return { modelo: "naive", m };
        case "snaive": return { modelo: "snaive", m };
        case "hw": return { modelo: "hw", m };
        case "arima": return { modelo: "arima", m, arima: orden ?? arimaAuto(y, h, nivel, m).opciones };
    }
}
export class ForecastService {
    informe(p: Peticion): Informe {
        const total = p.y.length;
        const recortada = total > MAX_PUNTOS;
        const desde = recortada ? total - MAX_PUNTOS : 0;
        const y = p.y.slice(desde);
        const n = y.length;
        const fest = p.festivos ? p.festivos.slice(desde) : null;
        const m = Math.max(1, Math.round(p.m));
        const h = Math.max(1, Math.round(p.h));
        const avisos: string[] = [];
        if (recortada)
            avisos.push("datos.recortados");
        const claves: Modelo[] = m > 1 ? ["naive", "snaive", "hw", "arima"] : ["naive", "hw", "arima"];
        if (!claves.includes(p.modelo))
            claves.push(p.modelo);
        const plan = planBacktest(n, h, m);
        const festPasado = fest ? fest.slice(0, n) : null;
        const festFuturo = fest ? fest.slice(n, n + h) : null;
        const modelos: ModeloInforme[] = claves.map(clave => {
            const config = elegirConfig(clave, y, m, h, p.nivel, p.orden);
            let prevision: Prevision, efecto: EfectoCalendario | null = null;
            if (festPasado && festFuturo) {
                const r = preverConCalendario(y, festPasado, festFuturo, h, p.nivel, config);
                prevision = r.prevision;
                efecto = r.efecto;
            }
            else {
                prevision = prever(y, h, p.nivel, config);
            }
            const bt = plan ? backtest(y, config, { h, nivel: p.nivel, inicial: plan.inicial, m, maxOrigenes: 20, festivos: fest ?? undefined }) : null;
            return { clave, etiqueta: etiquetaConfig(config), config, prevision, efecto, bt };
        });
        const elegido = modelos.find(x => x.clave === p.modelo) ?? modelos[0];
        const bases = modelos.filter(x => (x.clave === "naive" || x.clave === "snaive") && x.bt);
        const base = bases.length ? bases.reduce((a, b) => ((b.bt as ResultadoBacktest).mae < (a.bt as ResultadoBacktest).mae ? b : a)) : null;
        const conBt = modelos.filter(x => x.bt);
        const mejor = conBt.length ? conBt.reduce((a, b) => ((b.bt as ResultadoBacktest).mae < (a.bt as ResultadoBacktest).mae ? b : a)) : null;
        let veredicto: Informe["veredicto"] = "sin-backtest";
        if (base && plan) {
            const maeBase = (base.bt as ResultadoBacktest).mae;
            const gana = modelos.some(x => x.clave !== "naive" && x.clave !== "snaive" && x.bt && x.bt.mae < 0.97 * maeBase);
            veredicto = gana ? "bate" : "no-bate";
        }
        else
            avisos.push("bt.serie-corta");
        elegido.prevision.avisos.forEach(a => { if (!avisos.includes(a))
            avisos.push(a); });
        if (elegido.efecto === null && fest && !avisos.includes("calendario.sin-datos"))
            avisos.push("calendario.sin-datos");
        const pr = elegido.prevision;
        const calentamiento = Math.max(2 * m, 10);
        const vigia = (modelos.find(x => x.clave === "hw") ?? elegido).prevision;
        const cambio = cambioDeNivel(vigia.residuos, vigia.sigma, calentamiento);
        return {
            modelos,
            elegido,
            base,
            mejor,
            veredicto,
            anomalias: anomalias(pr.residuos, pr.sigma, zDeNivel(0.99)).map(i => i + desde),
            cambioNivel: cambio === null ? null : cambio + desde,
            avisos,
            n,
            recortada,
        };
    }
}
