import festivosCaptura from "../../public/datos/festivos/2026-10-26.json";
import { ForecastService, esError, fechaSiguiente, inferirPaso, leerSerie, periodoDe, type ErrorLectura, type ModeloInforme } from "../../src/app/services/forecast.service";
import { anomalias } from "../../src/app/services/forecast-backtest";
import { zDeNivel, type Modelo, type OpcionesArima } from "../../src/app/services/forecast-modelos";
import { aniosSinDatos, festivosDe, type DatosFestivos } from "../../src/app/services/festivos-datos";
import { diaDe } from "../../src/app/shared/dias";
export const FESTIVOS_FICHERO = "2026-10-26.json";
const FESTIVOS = festivosCaptura as unknown as DatosFestivos;
const r4 = (x: number) => (Number.isFinite(x) ? Math.round(x * 10000) / 10000 : null);
export const AVISO: Record<string, string> = {
    "hw.sin-estacion": "Fewer than two full seasons: Holt-Winters was fitted without seasonality.",
    "hw.alpha-alto": "Holt-Winters puts nearly all the weight on the last value: the series behaves like a random walk.",
    "arima.pocos-datos": "Too few data points for these ARIMA orders: the naive forecast is shown instead.",
    "arima.raiz-cerca-de-1": "An ARIMA parameter is stuck near 1: the model is on the edge of non-stationarity; distrust its interval.",
    "datos.recortados": "Very long series: only the last 1,500 observations are used.",
    "bt.serie-corta": "Short series: no backtest, so the interval cannot be checked against reality.",
    "calendario.sin-datos": "No holiday with ordinary days around it to estimate its effect: forecast made without the calendar.",
    "calendario.anios": "The official holidays of some year in the range are not loaded: those days count as ordinary.",
    "calendario.solo-diario": "Holidays need daily dates (one \"date;value\" per day): they were ignored.",
};
const avisoEn = (a: string) => ({ code: a, detail: AVISO[a] ?? a });
const LECTURA: Record<ErrorLectura["error"], string> = {
    vacio: "No data.",
    pocos: "At least 8 observations are needed.",
    numero: "A line is not a number (or mixes \"date;value\" lines with bare values)",
    "fechas-desordenadas": "Dates must go strictly forward",
};
const NOMBRE: Record<Modelo, string> = { naive: "naive", snaive: "seasonal naive", hw: "Holt-Winters", arima: "ARIMA" };
const PARAM: Record<string, string> = { media: "mean", deriva: "drift" };
export interface EntradaForecast {
    data?: string;
    values?: number[];
    dates?: string[];
    horizon?: number;
    season?: number;
    level?: 80 | 95;
    model?: Modelo | "auto";
    arimaOrder?: OpcionesArima;
    holidays?: string[];
    holidayCalendar?: string;
}
function informeModelo(x: ModeloInforme, nivel: number) {
    const bt = x.bt;
    return {
        model: x.clave,
        label: x.etiqueta,
        ...(bt ? {
            backtest: {
                origins: bt.origenes,
                mae: r4(bt.mae),
                rmse: r4(bt.rmse),
                mape: bt.mape === null ? null : r4(bt.mape),
                ...(bt.mapeAviso ? { mapeUnreliable: true } : {}),
                mase: bt.mase === null ? null : r4(bt.mase),
                intervalCoverage: r4(bt.cobertura),
                promisedCoverage: nivel,
                meanIntervalWidth: r4(bt.anchoMedio),
            },
        } : {}),
    };
}
export function prever(e: EntradaForecast) {
    let y: number[], fechas: string[] | null;
    if (e.data !== undefined) {
        const s = leerSerie(e.data);
        if (esError(s))
            return { error: `${LECTURA[s.error]}${s.linea ? ` (line ${s.linea})` : ""}.` };
        y = s.y;
        fechas = s.fechas;
    }
    else {
        y = e.values ?? [];
        fechas = e.dates ?? null;
        if (y.length < 8)
            return { error: LECTURA.pocos };
        if (y.some((v) => !Number.isFinite(v)))
            return { error: "Every value must be a finite number." };
        if (fechas) {
            if (fechas.length !== y.length)
                return { error: `dates has ${fechas.length} items and values ${y.length}: they must match.` };
            const malas = fechas.findIndex((f) => !/^\d{4}-\d{2}(-\d{2})?$/.test(f));
            if (malas >= 0)
                return { error: `dates[${malas}] is not YYYY-MM-DD (or YYYY-MM).` };
            fechas = fechas.map((f) => (f.length === 7 ? `${f}-01` : f));
            for (let i = 1; i < fechas.length; i++)
                if (fechas[i] <= fechas[i - 1])
                    return { error: `${LECTURA["fechas-desordenadas"]} (dates[${i}]).` };
        }
    }
    const paso = fechas ? inferirPaso(fechas) : null;
    const m = Math.max(1, Math.round(e.season ?? periodoDe(paso)));
    const h = Math.max(1, Math.round(e.horizon ?? (m > 1 ? m : 12)));
    const nivel = e.level === 95 ? 0.95 : 0.8;
    const ultima = fechas?.[fechas.length - 1];
    const fechasFuturas = ultima && paso ? Array.from({ length: h }, (_, i) => fechaSiguiente(ultima, paso, i + 1)) : null;
    const extra: string[] = [];
    let festivos: number[] | null = null;
    const pideFestivos = !!(e.holidays?.length || e.holidayCalendar);
    if (pideFestivos && (paso !== "dia" || !fechas || !fechasFuturas))
        extra.push("calendario.solo-diario");
    else if (pideFestivos && fechas && fechasFuturas) {
        const todas = [...fechas, ...fechasFuturas].map((f) => diaDe(f));
        const marcados = new Set<number>();
        for (const f of e.holidays ?? []) {
            const d = diaDe(f);
            if (d !== null)
                marcados.add(d);
        }
        if (e.holidayCalendar) {
            const pais = e.holidayCalendar.slice(0, 2);
            if (!FESTIVOS.paises[pais])
                return { error: `No official holidays for "${pais}". Available: ${Object.keys(FESTIVOS.paises).join(", ")}.` };
            const region = e.holidayCalendar.length > 2 ? e.holidayCalendar : null;
            if (region && !FESTIVOS.paises[pais].regiones[region])
                return { error: `Unknown region "${region}". Available: ${Object.keys(FESTIVOS.paises[pais].regiones).join(", ")}.` };
            for (const d of festivosDe(FESTIVOS, pais, region ? [region] : []).keys())
                marcados.add(d);
            const validos = todas.filter((d): d is number => d !== null);
            if (validos.length && aniosSinDatos(FESTIVOS, pais, Math.min(...validos), Math.max(...validos)).length)
                extra.push("calendario.anios");
        }
        festivos = todas.map((d) => (d !== null && marcados.has(d) ? 1 : 0));
    }
    const svc = new ForecastService();
    const pedido: Modelo = e.model && e.model !== "auto" ? e.model : "hw";
    const inf = svc.informe({ y, m, h, nivel, modelo: pedido, orden: e.arimaOrder ?? null, festivos });
    const elegido = e.model && e.model !== "auto" ? inf.elegido : (inf.mejor ?? inf.elegido);
    const pr = elegido.prevision;
    const desde = y.length - inf.n;
    const anom = elegido === inf.elegido ? inf.anomalias : anomalias(pr.residuos, pr.sigma, zDeNivel(0.99)).map((i) => i + desde);
    const fechaDe = (i: number) => (fechas ? fechas[i] : undefined);
    const avisos = [...new Set([...inf.avisos, ...pr.avisos.filter((a) => !inf.avisos.includes(a)), ...extra])];
    const base = inf.base?.bt, mejor = inf.mejor?.bt;
    const veredicto = inf.veredicto === "sin-backtest"
        ? "No backtest (series too short): nothing says whether any model beats simply repeating the last value."
        : inf.veredicto === "bate"
            ? `${inf.mejor!.etiqueta} beats the best naive baseline (${inf.base!.etiqueta}) by ${Math.round((1 - mejor!.mae / base!.mae) * 100)} % in mean absolute error on the backtest.`
            : `No model beats the naive baseline (${inf.base!.etiqueta}) by more than 3 %: the honest forecast is "the last value" (or the same period last season). The fancy models add nothing here — typical of a random walk.`;
    return {
        observations: inf.n,
        ...(inf.recortada ? { truncatedTo: inf.n } : {}),
        step: paso === "dia" ? "day" : paso === "mes" ? "month" : fechas ? "irregular" : "index",
        season: m,
        horizon: h,
        level: nivel,
        model: {
            model: elegido.clave,
            label: elegido.etiqueta,
            ...(e.model === "auto" || !e.model ? { chosenBy: "lowest backtest MAE" } : {}),
            parameters: Object.fromEntries(Object.entries(pr.parametros).map(([k, v]) => [PARAM[k] ?? k, r4(v)])),
            oneStepSigma: r4(pr.sigma),
            ...(elegido.efecto ? { holidayEffect: { type: elegido.efecto.tipo === "multiplicativo" ? "multiplicative" : "additive", value: r4(elegido.efecto.valor), estimatedFrom: elegido.efecto.n } } : {}),
        },
        forecast: pr.media.map((v, i) => ({
            ...(fechasFuturas ? { date: fechasFuturas[i] } : { step: y.length + i }),
            mean: r4(v),
            lower: r4(pr.inferior[i]),
            upper: r4(pr.superior[i]),
            ...(festivos && festivos[y.length + i] ? { holiday: true } : {}),
        })),
        verdict: veredicto,
        comparison: inf.modelos.map((x) => informeModelo(x, nivel)),
        anomalies: anom.map((i) => ({ index: i, ...(fechaDe(i) ? { date: fechaDe(i) } : {}), value: y[i] })),
        ...(inf.cambioNivel !== null ? { levelShift: { index: inf.cambioNivel, ...(fechaDe(inf.cambioNivel) ? { date: fechaDe(inf.cambioNivel) } : {}), note: "A CUSUM on Holt-Winters residuals crosses its threshold here: the level probably changed, and older data may mislead." } } : {}),
        warnings: avisos.map(avisoEn),
        notes: [
            `Intervals assume normal errors; intervalCoverage is what the ${Math.round(nivel * 100)} % interval actually covered on the backtest (rolling origin, up to 20 origins). Far below the promise ⇒ the interval is too narrow.`,
            ...(e.holidayCalendar ? [`Official holidays from the capture ${FESTIVOS_FICHERO.replace(".json", "")} (${FESTIVOS.paises[e.holidayCalendar.slice(0, 2)]?.fuente ?? ""}).`] : []),
            `The same engine as https://jarroba.com/tools/en/forecast — paste the series there to see the chart. ${NOMBRE[elegido.clave]} was fitted on the whole series.`,
        ],
    };
}
