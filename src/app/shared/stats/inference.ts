import { jStat } from "jstat";
export const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
const svar = (a: number[]) => { const m = mean(a); return a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1); };
export const sd = (a: number[]) => Math.sqrt(svar(a));
export function median(a: number[]): number { const s = [...a].sort((x, y) => x - y), n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; }
export interface CI {
    estimate: number;
    lo: number;
    hi: number;
    se: number;
    df: number;
    conf: number;
}
export function ciMean(data: number[], conf = 0.95): CI {
    const n = data.length, m = mean(data), se = Math.sqrt(svar(data) / n), df = n - 1;
    const tc = jStat.studentt.inv(1 - (1 - conf) / 2, df);
    return { estimate: m, lo: m - tc * se, hi: m + tc * se, se, df, conf };
}
export function ciProp(x: number, n: number, conf = 0.95): CI {
    const p = x / n, se = Math.sqrt(p * (1 - p) / n), zc = jStat.normal.inv(1 - (1 - conf) / 2, 0, 1);
    return { estimate: p, lo: Math.max(0, p - zc * se), hi: Math.min(1, p + zc * se), se, df: Infinity, conf };
}
export interface TTest {
    t: number;
    df: number;
    p: number;
    meanDiff: number;
    ci: [
        number,
        number
    ];
}
export function oneSampleT(data: number[], mu0: number, conf = 0.95): TTest {
    const n = data.length, m = mean(data), se = Math.sqrt(svar(data) / n), df = n - 1;
    const t = (m - mu0) / se, p = 2 * (1 - jStat.studentt.cdf(Math.abs(t), df));
    const tc = jStat.studentt.inv(1 - (1 - conf) / 2, df);
    return { t, df, p, meanDiff: m - mu0, ci: [m - tc * se, m + tc * se] };
}
export function twoSampleT(a: number[], b: number[], welch = true, conf = 0.95): TTest {
    const na = a.length, nb = b.length, ma = mean(a), mb = mean(b), va = svar(a), vb = svar(b);
    let se: number, df: number;
    if (welch) {
        se = Math.sqrt(va / na + vb / nb);
        df = (va / na + vb / nb) ** 2 / ((va / na) ** 2 / (na - 1) + (vb / nb) ** 2 / (nb - 1));
    }
    else {
        const sp2 = ((na - 1) * va + (nb - 1) * vb) / (na + nb - 2);
        se = Math.sqrt(sp2 * (1 / na + 1 / nb));
        df = na + nb - 2;
    }
    const diff = ma - mb, t = diff / se, p = 2 * (1 - jStat.studentt.cdf(Math.abs(t), df));
    const tc = jStat.studentt.inv(1 - (1 - conf) / 2, df);
    return { t, df, p, meanDiff: diff, ci: [diff - tc * se, diff + tc * se] };
}
export function pairedT(a: number[], b: number[], conf = 0.95): TTest {
    const d = a.map((v, i) => v - b[i]);
    const r = oneSampleT(d, 0, conf);
    return { ...r, meanDiff: mean(d) };
}
export interface Anova {
    f: number;
    df1: number;
    df2: number;
    p: number;
}
export function anova1(groups: number[][]): Anova {
    const k = groups.length, all = groups.flat(), N = all.length, gm = mean(all);
    let ssb = 0, ssw = 0;
    for (const g of groups) {
        const m = mean(g);
        ssb += g.length * (m - gm) ** 2;
        for (const v of g)
            ssw += (v - m) ** 2;
    }
    const df1 = k - 1, df2 = N - k, f = (ssb / df1) / (ssw / df2);
    return { f, df1, df2, p: 1 - jStat.centralF.cdf(f, df1, df2) };
}
export interface ChiSq {
    chi2: number;
    df: number;
    p: number;
    expected?: number[][];
}
export function chiSquareGof(observed: number[], expected: number[]): ChiSq {
    const chi2 = observed.reduce((s, o, i) => s + (o - expected[i]) ** 2 / expected[i], 0);
    const df = observed.length - 1;
    return { chi2, df, p: 1 - jStat.chisquare.cdf(chi2, df) };
}
export function chiSquareIndep(table: number[][]): ChiSq {
    const rows = table.length, cols = table[0].length;
    const rowSum = table.map(r => r.reduce((s, v) => s + v, 0));
    const colSum = Array.from({ length: cols }, (_, j) => table.reduce((s, r) => s + r[j], 0));
    const total = rowSum.reduce((s, v) => s + v, 0);
    const expected = table.map((_, i) => Array.from({ length: cols }, (_, j) => rowSum[i] * colSum[j] / total));
    let chi2 = 0;
    for (let i = 0; i < rows; i++)
        for (let j = 0; j < cols; j++)
            chi2 += (table[i][j] - expected[i][j]) ** 2 / expected[i][j];
    const df = (rows - 1) * (cols - 1);
    return { chi2, df, p: 1 - jStat.chisquare.cdf(chi2, df), expected };
}
export interface Corr {
    r: number;
    t: number;
    df: number;
    p: number;
    ci?: [
        number,
        number
    ];
}
export function pearson(x: number[], y: number[], conf = 0.95): Corr {
    const n = x.length, r = jStat.corrcoeff(x, y), df = n - 2;
    const t = r * Math.sqrt(df / (1 - r * r)), p = 2 * (1 - jStat.studentt.cdf(Math.abs(t), df));
    const z = 0.5 * Math.log((1 + r) / (1 - r)), sz = 1 / Math.sqrt(n - 3), zc = jStat.normal.inv(1 - (1 - conf) / 2, 0, 1);
    const lo = Math.tanh(z - zc * sz), hi = Math.tanh(z + zc * sz);
    return { r, t, df, p, ci: [lo, hi] };
}
export function spearman(x: number[], y: number[]): Corr {
    const rho = jStat.spearmancoeff(x, y), n = x.length, df = n - 2;
    const t = rho * Math.sqrt(df / (1 - rho * rho)), p = 2 * (1 - jStat.studentt.cdf(Math.abs(t), df));
    return { r: rho, t, df, p };
}
export function permutationTest(a: number[], b: number[], B: number, rng: () => number): {
    observed: number;
    p: number;
} {
    const observed = Math.abs(mean(a) - mean(b));
    const pool = [...a, ...b], na = a.length;
    let count = 0;
    for (let it = 0; it < B; it++) {
        for (let i = pool.length - 1; i > 0; i--) {
            const j = Math.floor(rng() * (i + 1));
            [pool[i], pool[j]] = [pool[j], pool[i]];
        }
        const ma = mean(pool.slice(0, na)), mb = mean(pool.slice(na));
        if (Math.abs(ma - mb) >= observed - 1e-12)
            count++;
    }
    return { observed, p: (count + 1) / (B + 1) };
}
export interface PropTest {
    z: number;
    p: number;
    estimate: number;
    ci: [
        number,
        number
    ];
}
export function oneProportionZ(x: number, n: number, p0: number, conf = 0.95): PropTest {
    const ph = x / n, se0 = Math.sqrt(p0 * (1 - p0) / n), z = (ph - p0) / se0;
    const p = 2 * (1 - jStat.normal.cdf(Math.abs(z), 0, 1));
    const zc = jStat.normal.inv(1 - (1 - conf) / 2, 0, 1), se = Math.sqrt(ph * (1 - ph) / n);
    return { z, p, estimate: ph, ci: [Math.max(0, ph - zc * se), Math.min(1, ph + zc * se)] };
}
export interface Prop2Test {
    z: number;
    p: number;
    diff: number;
    ci: [
        number,
        number
    ];
    p1: number;
    p2: number;
}
export function twoProportionZ(x1: number, n1: number, x2: number, n2: number, conf = 0.95): Prop2Test {
    const p1 = x1 / n1, p2 = x2 / n2, pp = (x1 + x2) / (n1 + n2);
    const se = Math.sqrt(pp * (1 - pp) * (1 / n1 + 1 / n2)), z = (p1 - p2) / se;
    const p = 2 * (1 - jStat.normal.cdf(Math.abs(z), 0, 1));
    const zc = jStat.normal.inv(1 - (1 - conf) / 2, 0, 1), seD = Math.sqrt(p1 * (1 - p1) / n1 + p2 * (1 - p2) / n2);
    return { z, p, diff: p1 - p2, ci: [p1 - p2 - zc * seD, p1 - p2 + zc * seD], p1, p2 };
}
export function correlationMatrix(cols: number[][], method: "pearson" | "spearman" = "pearson"): number[][] {
    const k = cols.length;
    return Array.from({ length: k }, (_, i) => Array.from({ length: k }, (_, j) => i === j ? 1 : method === "pearson" ? jStat.corrcoeff(cols[i], cols[j]) : jStat.spearmancoeff(cols[i], cols[j])));
}
export interface Bootstrap {
    estimate: number;
    ci: [
        number,
        number
    ];
    se: number;
    dist: number[];
}
export function bootstrap(B: number, conf: number, drawStat: () => number, point: number): Bootstrap {
    const dist = new Array<number>(B);
    for (let b = 0; b < B; b++)
        dist[b] = drawStat();
    dist.sort((x, y) => x - y);
    const q = (t: number) => dist[Math.min(B - 1, Math.max(0, Math.floor(t * B)))];
    const m = dist.reduce((a, v) => a + v, 0) / B;
    const se = Math.sqrt(dist.reduce((a, v) => a + (v - m) ** 2, 0) / (B - 1));
    return { estimate: point, ci: [q((1 - conf) / 2), q((1 + conf) / 2)], se, dist };
}
export function resample(data: number[], rng: () => number): number[] {
    const n = data.length, s = new Array<number>(n);
    for (let i = 0; i < n; i++)
        s[i] = data[(rng() * n) | 0];
    return s;
}
export function logLikelihood(data: number[], logpdf: (x: number) => number): number {
    let ll = 0;
    for (const x of data) {
        const l = logpdf(x);
        if (!Number.isFinite(l))
            return -Infinity;
        ll += l;
    }
    return ll;
}
export function assumptions(a: number[], b?: number[]): {
    normalA: boolean;
    normalB?: boolean;
    outliersA: number;
    outliersB?: number;
    varRatio?: number;
    equalVar?: boolean;
} {
    const out = (d: number[]) => { const s = [...d].sort((x, y) => x - y), n = s.length; const q1 = s[Math.floor(n * 0.25)], q3 = s[Math.floor(n * 0.75)], iqr = q3 - q1; return d.filter(v => v < q1 - 1.5 * iqr || v > q3 + 1.5 * iqr).length; };
    const r: {
        normalA: boolean;
        normalB?: boolean;
        outliersA: number;
        outliersB?: number;
        varRatio?: number;
        equalVar?: boolean;
    } = { normalA: normalityHint(a).ok, outliersA: out(a) };
    if (b && b.length > 1) {
        r.normalB = normalityHint(b).ok;
        r.outliersB = out(b);
        const va = svar(a), vb = svar(b);
        r.varRatio = Math.max(va, vb) / Math.min(va, vb);
        r.equalVar = r.varRatio < 3;
    }
    return r;
}
export function normalityHint(data: number[]): {
    ok: boolean;
    skew: number;
    kurt: number;
} {
    const m = mean(data), n = data.length;
    let m2 = 0, m3 = 0, m4 = 0;
    for (const v of data) {
        const d = v - m, d2 = d * d;
        m2 += d2;
        m3 += d2 * d;
        m4 += d2 * d2;
    }
    const skew = (m3 / n) / Math.pow(m2 / n, 1.5), kurt = (m4 / n) / Math.pow(m2 / n, 2) - 3;
    return { ok: Math.abs(skew) < 1 && Math.abs(kurt) < 1.5, skew, kurt };
}
