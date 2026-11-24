import { ErrorExtracto, Extracto, Movimiento, leerExtracto } from "./extracto";
export type Periodo = "semana" | "quincena" | "mes" | "trimestre";
export interface Flujo {
    id: string;
    concepto: string;
    periodo: Periodo;
    importe: number;
    veces: number;
    ultima: string;
    proxima: string;
    variable: boolean;
    fiscal?: "aeat" | "tgss";
    activo: boolean;
}
export interface FlujoManual {
    id: string;
    concepto: string;
    importe: number;
    fecha: string;
    repetir: "no" | "mes";
    alPrimerDia?: boolean;
}
export interface Analisis {
    flujos: Flujo[];
    restoSemanal: number;
    semanasHistoria: number;
    extraordinarios: Movimiento[];
    desde: string;
    hasta: string;
    entradasMes: number;
    salidasMes: number;
}
export interface Semana {
    desde: string;
    hasta: string;
    entradas: number;
    salidas: number;
    saldo: number;
    apuntes: {
        concepto: string;
        importe: number;
        fecha: string;
    }[];
}
export interface Prevision {
    semanas: Semana[];
    saldoInicial: number;
    minimo: {
        saldo: number;
        semana: number;
    };
    primeraNegativa: number | null;
    primeraBajoMinimo: number | null;
}
const DIA = 86400000;
const r2 = (x: number) => Math.round(x * 100) / 100;
const diaDe = (iso: string) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))) / DIA;
const isoDe = (d: number) => new Date(d * DIA).toISOString().slice(0, 10);
const mediana = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const AEAT = /\b(aeat|agencia\s+(estatal\s+de\s+administraci[oó]n\s+)?tributaria|hacienda|impuestos?|modelo\s*\d{3}|mod\.?\s*(303|111|115|130|202|200|349|390))\b/i;
const TGSS = /\b(tgss|tesorer[ií]a\s+general|seguridad\s+social|seg\.?\s*soc|cotizaci[oó]n|cuota\s+aut[oó]nomos|reta)\b/i;
export function normalizar(concepto: string): string {
    return concepto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
        .replace(/\b\d{1,2}[/.-]\d{1,2}([/.-]\d{2,4})?\b/g, " ")
        .replace(/\b(ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)[a-z]*\b/g, " ")
        .replace(/[^a-z\s]/g, " ")
        .split(/\s+/).filter((w) => w.length >= 3).slice(0, 4).join(" ");
}
function periodoDe(intervalo: number): Periodo | null {
    if (intervalo >= 5 && intervalo <= 9)
        return "semana";
    if (intervalo >= 12 && intervalo <= 17)
        return "quincena";
    if (intervalo >= 25 && intervalo <= 36)
        return "mes";
    if (intervalo >= 80 && intervalo <= 100)
        return "trimestre";
    return null;
}
function sumarMeses(iso: string, n: number): string {
    const [a, m, d] = [Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))];
    const ultimo = new Date(Date.UTC(a, m + n + 1, 0)).getUTCDate();
    return isoDe(Date.UTC(a, m + n, Math.min(d, ultimo)) / DIA);
}
export function siguiente(iso: string, p: Periodo): string {
    if (p === "semana")
        return isoDe(diaDe(iso) + 7);
    if (p === "quincena")
        return isoDe(diaDe(iso) + 14);
    return sumarMeses(iso, p === "mes" ? 1 : 3);
}
export function proximoPlazoAeat(despuesDe: string): string {
    const a = Number(despuesDe.slice(0, 4));
    const plazos = [`${a}-01-30`, `${a}-04-20`, `${a}-07-20`, `${a}-10-20`, `${a + 1}-01-30`];
    return plazos.find((p) => p > despuesDe)!;
}
export function ultimoHabil(despuesDe: string): string {
    let a = Number(despuesDe.slice(0, 4)), m = Number(despuesDe.slice(5, 7));
    for (;;) {
        let d = Date.UTC(a, m, 0) / DIA;
        while ([0, 6].includes(new Date(d * DIA).getUTCDay()))
            d--;
        if (isoDe(d) > despuesDe)
            return isoDe(d);
        m++;
        if (m > 12) {
            m = 1;
            a++;
        }
    }
}
export function analizar(movs: Movimiento[]): Analisis {
    const ordenados = [...movs].sort((a, b) => a.fecha.localeCompare(b.fecha));
    const desde = ordenados[0]?.fecha ?? "", hasta = ordenados[ordenados.length - 1]?.fecha ?? "";
    const grupos = new Map<string, Movimiento[]>();
    for (const m of ordenados) {
        if (!m.importe)
            continue;
        const fiscal = AEAT.test(m.concepto) ? "aeat" : TGSS.test(m.concepto) ? "tgss" : "";
        const k = `${m.importe > 0 ? "+" : "-"}${fiscal ? `#${fiscal} ` : ""}${normalizar(m.concepto)}`;
        if (k.length < 3)
            continue;
        grupos.set(k, [...(grupos.get(k) ?? []), m]);
    }
    const flujos: Flujo[] = [];
    const recurrentes = new Set<Movimiento>();
    for (const [id, ms] of grupos) {
        const fiscal = id.includes("#aeat") ? "aeat" as const : id.includes("#tgss") ? "tgss" as const : undefined;
        const porDia = new Map<string, number>();
        for (const m of ms)
            porDia.set(m.fecha, (porDia.get(m.fecha) ?? 0) + m.importe);
        const fechas = [...porDia.keys()].sort();
        const importes = fechas.map((f) => porDia.get(f)!);
        let periodo: Periodo | null = null;
        if (fiscal === "aeat")
            periodo = "trimestre";
        else if (fiscal === "tgss")
            periodo = "mes";
        else if (fechas.length >= 3 || (fechas.length === 2 && periodoDe(diaDe(fechas[1]) - diaDe(fechas[0])) === "trimestre")) {
            const intervalos = fechas.slice(1).map((f, i) => diaDe(f) - diaDe(fechas[i]));
            const p = periodoDe(mediana(intervalos));
            if (p && intervalos.filter((x) => periodoDe(x) === p).length >= Math.ceil(intervalos.length * 0.7))
                periodo = p;
        }
        if (!periodo)
            continue;
        const ultimos = importes.slice(-3);
        const importe = r2(mediana(ultimos));
        const variable = ultimos.some((x) => Math.abs(x - importe) > Math.abs(importe) * 0.1);
        const ultima = fechas[fechas.length - 1];
        let proxima = fiscal === "aeat" ? proximoPlazoAeat(ultima) : fiscal === "tgss" ? ultimoHabil(ultima) : siguiente(ultima, periodo);
        while (proxima <= hasta)
            proxima = fiscal === "aeat" ? proximoPlazoAeat(proxima) : fiscal === "tgss" ? ultimoHabil(proxima) : siguiente(proxima, periodo);
        ms.forEach((m) => recurrentes.add(m));
        const ultimoMov = ms[ms.length - 1];
        flujos.push({ id, concepto: ultimoMov.concepto, periodo, importe, veces: fechas.length, ultima, proxima, variable, ...(fiscal ? { fiscal } : {}), activo: true });
    }
    flujos.sort((a, b) => Math.abs(b.importe) - Math.abs(a.importe));
    const resto = ordenados.filter((m) => !recurrentes.has(m));
    const medAbs = ordenados.length >= 5 ? mediana(ordenados.map((m) => Math.abs(m.importe))) : 0;
    const extraordinarios = resto.filter((m) => medAbs > 0 && Math.abs(m.importe) > medAbs * 5);
    const normales = resto.filter((m) => !extraordinarios.includes(m));
    const dias = desde ? diaDe(hasta) - diaDe(desde) + 1 : 0;
    const semanasHistoria = Math.max(1, dias / 7);
    const meses = Math.max(1, dias / 30.44);
    return {
        flujos,
        extraordinarios,
        desde,
        hasta,
        semanasHistoria: r2(semanasHistoria),
        restoSemanal: r2(normales.reduce((s, m) => s + m.importe, 0) / semanasHistoria),
        entradasMes: r2(ordenados.filter((m) => m.importe > 0 && !extraordinarios.includes(m)).reduce((s, m) => s + m.importe, 0) / meses),
        salidasMes: r2(-ordenados.filter((m) => m.importe < 0 && !extraordinarios.includes(m)).reduce((s, m) => s + m.importe, 0) / meses),
    };
}
export function prever(saldoInicial: number, inicio: string, flujos: Flujo[], manuales: FlujoManual[], opciones: {
    resto: number;
    minimo?: number;
    semanas?: number;
}): Prevision {
    const n = opciones.semanas ?? 13;
    const d0 = diaDe(inicio) + 1;
    const fin = isoDe(d0 + n * 7 - 1);
    const apuntes: {
        concepto: string;
        importe: number;
        fecha: string;
    }[] = [];
    const primero = isoDe(d0);
    for (const f of flujos.filter((x) => x.activo)) {
        const sig = (fecha: string) => (f.fiscal === "aeat" ? proximoPlazoAeat(fecha) : f.fiscal === "tgss" ? ultimoHabil(fecha) : siguiente(fecha, f.periodo));
        let fecha = f.proxima;
        if (fecha < primero) {
            apuntes.push({ concepto: f.concepto, importe: f.importe, fecha: primero });
            while (fecha < primero)
                fecha = sig(fecha);
        }
        for (let k = 0; fecha <= fin && k < 200; k++) {
            apuntes.push({ concepto: f.concepto, importe: f.importe, fecha });
            fecha = sig(fecha);
        }
    }
    for (const m of manuales) {
        if (m.alPrimerDia && m.repetir === "no" && m.fecha < primero) {
            apuntes.push({ concepto: m.concepto, importe: m.importe, fecha: primero });
            continue;
        }
        for (let fecha = m.fecha, k = 0; fecha <= fin && k < 200; k++) {
            if (fecha >= isoDe(d0))
                apuntes.push({ concepto: m.concepto, importe: m.importe, fecha });
            if (m.repetir === "no")
                break;
            fecha = sumarMeses(fecha, 1);
        }
    }
    const semanas: Semana[] = [];
    let saldo = saldoInicial;
    for (let i = 0; i < n; i++) {
        const desde = isoDe(d0 + i * 7), hasta = isoDe(d0 + i * 7 + 6);
        const estas = apuntes.filter((a) => a.fecha >= desde && a.fecha <= hasta).sort((a, b) => a.fecha.localeCompare(b.fecha));
        const conResto = opciones.resto ? [...estas, { concepto: "", importe: opciones.resto, fecha: hasta }] : estas;
        const entradas = r2(conResto.filter((a) => a.importe > 0).reduce((s, a) => s + a.importe, 0));
        const salidas = r2(-conResto.filter((a) => a.importe < 0).reduce((s, a) => s + a.importe, 0));
        saldo = r2(saldo + entradas - salidas);
        semanas.push({ desde, hasta, entradas, salidas, saldo, apuntes: estas });
    }
    const minimo = semanas.reduce((m, s, i) => (s.saldo < m.saldo ? { saldo: s.saldo, semana: i } : m), { saldo: Infinity, semana: -1 });
    const neg = semanas.findIndex((s) => s.saldo < 0);
    const bajo = opciones.minimo !== undefined ? semanas.findIndex((s) => s.saldo < opciones.minimo!) : -1;
    return { semanas, saldoInicial, minimo, primeraNegativa: neg >= 0 ? neg : null, primeraBajoMinimo: bajo >= 0 ? bajo : null };
}
export interface OpcionesPrevision {
    saldo?: number | null;
    minimo?: number;
    conResto?: boolean;
    cambios?: Record<string, {
        activo?: boolean;
        importe?: number;
    }>;
    manuales?: FlujoManual[];
    semanas?: number;
}
export function preverExtracto(texto: string, o: OpcionesPrevision = {}): {
    extracto: Extracto;
    analisis: Analisis;
    flujos: Flujo[];
    saldo: number | null;
    prevision: Prevision | null;
} | {
    error: ErrorExtracto;
} {
    const ex = leerExtracto(texto);
    if (!("movimientos" in ex))
        return { error: ex };
    const analisis = analizar(ex.movimientos);
    const flujos = analisis.flujos.map((f) => ({ ...f, ...o.cambios?.[f.id] }));
    const saldo = o.saldo ?? ex.saldoFinal;
    const prevision = saldo === null ? null
        : prever(saldo, analisis.hasta, flujos, o.manuales ?? [], { resto: o.conResto === false ? 0 : analisis.restoSemanal, minimo: o.minimo, semanas: o.semanas });
    return { extracto: ex, analisis, flujos, saldo, prevision };
}
