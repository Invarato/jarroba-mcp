import { LogEvent, LogLevel } from "./log-parse.service";
import { LogPattern } from "./log-patterns.service";
const CUBOS = 60;
const MIN_CUBOS_BASE = 4;
const ANCHOS = [1000, 5000, 15000, 30000, 60000, 300000, 900000, 1800000, 3600000, 6 * 3600000, 12 * 3600000, 24 * 3600000];
export interface Trend {
    patternId: number;
    template: string;
    level: LogLevel | null;
    buckets: number[];
    baseline: number;
    spike: {
        bucket: number;
        at: number;
        count: number;
        ratio: number;
    } | null;
    novel: boolean;
    silenced: boolean;
    firstTs: number;
    lastTs: number;
}
export interface TrendReport {
    from: number;
    bucketMs: number;
    count: number;
    total: number[];
    trends: Trend[];
    undated: number;
}
export interface TrendOpts {
    bucketMs?: number;
    minRatio?: number;
    minCount?: number;
}
export function pickBucket(spanMs: number): number {
    if (!(spanMs > 0))
        return 1000;
    const ideal = spanMs / CUBOS;
    return ANCHOS.find(a => a >= ideal) ?? ANCHOS[ANCHOS.length - 1];
}
function mediana(xs: number[]): number {
    if (!xs.length)
        return 0;
    const s = [...xs].sort((a, b) => a - b);
    const m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
export function trends(events: LogEvent[], patterns: LogPattern[], opts: TrendOpts = {}): TrendReport {
    const minRatio = opts.minRatio ?? 4;
    const minCount = opts.minCount ?? 5;
    const conFecha = events.filter(e => e.ts != null);
    const undated = events.length - conFecha.length;
    if (conFecha.length < 2) {
        return { from: 0, bucketMs: 0, count: 0, total: [], trends: [], undated };
    }
    let min = Infinity, max = -Infinity;
    for (const e of conFecha) {
        const t = e.ts!;
        if (t < min)
            min = t;
        if (t > max)
            max = t;
    }
    const bucketMs = opts.bucketMs && opts.bucketMs > 0 ? opts.bucketMs : pickBucket(max - min);
    const n = Math.max(1, Math.floor((max - min) / bucketMs) + 1);
    const cubo = (ts: number) => Math.min(n - 1, Math.floor((ts - min) / bucketMs));
    const total = new Array<number>(n).fill(0);
    for (const e of conFecha)
        total[cubo(e.ts!)]++;
    const salida: Trend[] = [];
    for (const p of patterns) {
        if (p.overflow)
            continue;
        const buckets = new Array<number>(n).fill(0);
        let primero = Infinity, ultimo = -Infinity, situados = 0;
        for (const i of p.occurrences) {
            const ts = events[i]?.ts;
            if (ts == null)
                continue;
            buckets[cubo(ts)]++;
            situados++;
            if (ts < primero)
                primero = ts;
            if (ts > ultimo)
                ultimo = ts;
        }
        if (!situados)
            continue;
        const desde = cubo(primero), hasta = cubo(ultimo);
        const vividos = buckets.slice(desde, hasta + 1);
        const baseline = vividos.length >= MIN_CUBOS_BASE ? mediana(vividos) : 0;
        let spike: Trend["spike"] = null;
        const ref = Math.max(baseline, 1);
        for (let b = desde; b <= hasta; b++) {
            const c = buckets[b];
            if (c < minCount)
                continue;
            const ratio = c / ref;
            if (ratio >= minRatio && (!spike || ratio > spike.ratio)) {
                spike = { bucket: b, at: min + b * bucketMs, count: c, ratio };
            }
        }
        const conHistoria = vividos.length >= MIN_CUBOS_BASE;
        const arranque = Math.floor(n / 4);
        const novel = conHistoria && n >= 8 && desde > arranque && situados >= 3;
        const presencia = vividos.filter(c => c > 0).length / Math.max(1, vividos.length);
        const silenced = conHistoria && n >= 8 && hasta < n - Math.max(2, Math.floor(n / 4))
            && situados >= 3 && presencia >= 0.5;
        salida.push({
            patternId: p.id,
            template: p.template,
            level: p.level,
            buckets,
            baseline,
            spike,
            novel,
            silenced,
            firstTs: primero,
            lastTs: ultimo,
        });
    }
    salida.sort((a, b) => (b.spike?.ratio ?? 0) - (a.spike?.ratio ?? 0)
        || Number(b.novel) - Number(a.novel)
        || Number(b.silenced) - Number(a.silenced)
        || b.buckets.reduce((x, y) => x + y, 0) - a.buckets.reduce((x, y) => x + y, 0));
    return { from: min, bucketMs, count: n, total, trends: salida, undated };
}
export function notable(r: TrendReport): Trend[] {
    return r.trends.filter(t => t.spike || t.novel || t.silenced);
}
export interface Coincidence {
    patternId: number;
    template: string;
    level: LogLevel | null;
    inWindow: number;
    expected: number;
    lift: number;
    share: number;
    firstOffsetMs: number;
}
export interface AroundOpts {
    minCount?: number;
    minLift?: number;
    minShare?: number;
}
export function around(events: LogEvent[], patterns: LogPattern[], atMs: number, radiusMs: number, opts: AroundOpts = {}): Coincidence[] {
    const minCount = opts.minCount ?? 3;
    const minLift = opts.minLift ?? 2;
    const minShare = opts.minShare ?? 0.2;
    const desde = atMs - radiusMs, hasta = atMs + radiusMs;
    let min = Infinity, max = -Infinity;
    for (const e of events) {
        const t = e.ts;
        if (t == null)
            continue;
        if (t < min)
            min = t;
        if (t > max)
            max = t;
    }
    if (!(max > min))
        return [];
    const dentroMs = Math.min(hasta, max) - Math.max(desde, min);
    const fueraMs = (max - min) - Math.max(0, dentroMs);
    if (!(dentroMs > 0) || !(fueraMs > 0))
        return [];
    const salida: Coincidence[] = [];
    for (const p of patterns) {
        if (p.overflow)
            continue;
        let dentro = 0, fuera = 0, primero = Infinity;
        for (const i of p.occurrences) {
            const ts = events[i]?.ts;
            if (ts == null)
                continue;
            if (ts >= desde && ts <= hasta) {
                dentro++;
                if (ts < primero)
                    primero = ts;
            }
            else
                fuera++;
        }
        if (dentro < minCount)
            continue;
        const expected = (fuera / fueraMs) * dentroMs;
        const lift = expected > 0 ? dentro / expected : Infinity;
        if (lift < minLift)
            continue;
        const share = dentro / (dentro + fuera);
        if (share < minShare)
            continue;
        salida.push({
            patternId: p.id,
            template: p.template,
            level: p.level,
            inWindow: dentro,
            expected,
            lift,
            share,
            firstOffsetMs: primero - atMs,
        });
    }
    return salida.sort((a, b) => Number(a.firstOffsetMs >= 0) - Number(b.firstOffsetMs >= 0)
        || b.lift - a.lift
        || b.inWindow - a.inWindow);
}
