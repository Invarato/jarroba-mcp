import { preverConCalendario } from "./forecast-calendario";
import { ConfigModelo, prever } from "./forecast-modelos";
export interface OpcionesBacktest {
    h: number;
    nivel: number;
    inicial: number;
    paso?: number;
    maxOrigenes?: number;
    m: number;
    festivos?: readonly number[];
}
export interface PuntoBacktest {
    origen: number;
    paso: number;
    real: number;
    prediccion: number;
    inferior: number;
    superior: number;
}
export interface PorHorizonte {
    h: number;
    mae: number;
    cobertura: number;
    n: number;
}
export interface ResultadoBacktest {
    etiqueta: string;
    config: ConfigModelo;
    origenes: number;
    mae: number;
    rmse: number;
    mape: number | null;
    mapeAviso: boolean;
    mase: number | null;
    cobertura: number;
    anchoMedio: number;
    porHorizonte: PorHorizonte[];
    puntos: PuntoBacktest[];
    avisos: string[];
}
export function origenesBacktest(n: number, o: Pick<OpcionesBacktest, "h" | "inicial" | "paso" | "maxOrigenes">): number[] {
    const ultimo = n - o.h;
    if (ultimo < o.inicial)
        return [];
    const total = ultimo - o.inicial + 1;
    const tope = Math.max(1, o.maxOrigenes ?? 24);
    const paso = Math.max(1, o.paso ?? 1, Math.ceil(total / tope));
    const out: number[] = [];
    for (let t = o.inicial; t <= ultimo; t += paso)
        out.push(t);
    if (out[out.length - 1] !== ultimo)
        out.push(ultimo);
    return out;
}
export function escalaMase(y: readonly number[], m: number): number {
    const lag = m > 1 && y.length > m ? m : 1;
    let s = 0, c = 0;
    for (let i = lag; i < y.length; i++) {
        s += Math.abs(y[i] - y[i - lag]);
        c++;
    }
    return c ? s / c : 0;
}
export function etiquetaConfig(c: ConfigModelo): string {
    switch (c.modelo) {
        case "naive": return "Naive";
        case "snaive": return "Seasonal naive";
        case "hw": return `Holt-Winters${c.hw?.tendencia === false ? " (sin tendencia)" : ""}${c.hw?.estacional === false ? " (sin estaci\u00F3n)" : ""}`;
        case "arima": {
            const a = c.arima ?? { p: 1, d: 1, q: 1 };
            const est = (a.P ?? 0) + (a.D ?? 0) + (a.Q ?? 0) > 0 && c.m > 1;
            return `ARIMA(${a.p},${a.d},${a.q})` + (est ? `(${a.P ?? 0},${a.D ?? 0},${a.Q ?? 0})[${c.m}]` : "");
        }
    }
}
export function backtest(y: readonly number[], cfg: ConfigModelo, o: OpcionesBacktest): ResultadoBacktest {
    const origenes = origenesBacktest(y.length, o);
    const puntos: PuntoBacktest[] = [];
    const mases: number[] = [];
    const avisos = new Set<string>();
    for (const t of origenes) {
        const train = y.slice(0, t);
        const p = o.festivos
            ? preverConCalendario(train, o.festivos.slice(0, t), o.festivos.slice(t, t + o.h), o.h, o.nivel, cfg).prevision
            : prever(train, o.h, o.nivel, cfg);
        p.avisos.forEach(a => avisos.add(a));
        let sumAbs = 0;
        for (let i = 0; i < o.h; i++) {
            const real = y[t + i];
            puntos.push({ origen: t, paso: i + 1, real, prediccion: p.media[i], inferior: p.inferior[i], superior: p.superior[i] });
            sumAbs += Math.abs(real - p.media[i]);
        }
        const esc = escalaMase(train, o.m);
        if (esc > 0)
            mases.push(sumAbs / o.h / esc);
    }
    const n = puntos.length;
    const prom = (f: (p: PuntoBacktest) => number) => (n ? puntos.reduce((s, p) => s + f(p), 0) / n : NaN);
    const mae = prom(p => Math.abs(p.real - p.prediccion));
    const rmse = Math.sqrt(prom(p => (p.real - p.prediccion) ** 2));
    const absMedio = n ? puntos.reduce((s, p) => s + Math.abs(p.real), 0) / n : 0;
    const hayCeros = puntos.some(p => p.real === 0);
    const casiNulo = puntos.some(p => Math.abs(p.real) < 0.05 * absMedio);
    const mape = hayCeros ? null : prom(p => Math.abs((p.real - p.prediccion) / p.real)) * 100;
    const cobertura = prom(p => (p.real >= p.inferior && p.real <= p.superior ? 1 : 0));
    const anchoMedio = prom(p => p.superior - p.inferior);
    const porHorizonte: PorHorizonte[] = [];
    for (let i = 1; i <= o.h; i++) {
        const pts = puntos.filter(p => p.paso === i);
        if (!pts.length)
            continue;
        porHorizonte.push({
            h: i,
            mae: pts.reduce((s, p) => s + Math.abs(p.real - p.prediccion), 0) / pts.length,
            cobertura: pts.filter(p => p.real >= p.inferior && p.real <= p.superior).length / pts.length,
            n: pts.length,
        });
    }
    return {
        etiqueta: etiquetaConfig(cfg),
        config: cfg,
        origenes: origenes.length,
        mae,
        rmse,
        mape,
        mapeAviso: hayCeros || casiNulo,
        mase: mases.length ? mases.reduce((s, v) => s + v, 0) / mases.length : null,
        cobertura,
        anchoMedio,
        porHorizonte,
        puntos,
        avisos: [...avisos],
    };
}
export interface Comparativa {
    resultados: ResultadoBacktest[];
    base: ResultadoBacktest | null;
    mejoraSobreBase: Map<string, number>;
}
export function comparar(y: readonly number[], cfgs: ConfigModelo[], o: OpcionesBacktest): Comparativa {
    const claves = new Set(cfgs.map(c => etiquetaConfig(c)));
    const todos = [...cfgs];
    const m = o.m;
    if (!claves.has("Naive"))
        todos.unshift({ modelo: "naive", m });
    if (m > 1 && !claves.has("Seasonal naive"))
        todos.unshift({ modelo: "snaive", m });
    const resultados = todos.map(c => backtest(y, c, o));
    const bases = resultados.filter(r => r.config.modelo === "naive" || r.config.modelo === "snaive");
    const base = bases.length ? bases.reduce((a, b) => (b.mae < a.mae ? b : a)) : null;
    const mejoraSobreBase = new Map<string, number>();
    if (base)
        for (const r of resultados)
            mejoraSobreBase.set(r.etiqueta, 1 - r.mae / base.mae);
    return { resultados, base, mejoraSobreBase };
}
export function anomalias(residuos: readonly number[], sigma: number, z: number): number[] {
    const out: number[] = [];
    residuos.forEach((r, i) => { if (Number.isFinite(r) && sigma > 0 && Math.abs(r) > z * sigma)
        out.push(i); });
    return out;
}
export function cambioDeNivel(residuos: readonly number[], sigma: number, desde = 0, k = 0.5, umbral = 8): number | null {
    if (!(sigma > 0))
        return null;
    let sp = 0, sn = 0;
    for (let i = Math.max(0, desde); i < residuos.length; i++) {
        const r = residuos[i];
        if (!Number.isFinite(r))
            continue;
        const zi = r / sigma;
        sp = Math.max(0, sp + zi - k);
        sn = Math.max(0, sn - zi - k);
        if (sp > umbral || sn > umbral)
            return i;
    }
    return null;
}
