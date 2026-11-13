export type Modelo = "naive" | "snaive" | "hw" | "arima";
export interface Prevision {
    modelo: Modelo;
    media: number[];
    inferior: number[];
    superior: number[];
    sigma: number;
    residuos: number[];
    ajustados: number[];
    parametros: Record<string, number>;
    k: number;
    aicc: number | null;
    avisos: string[];
}
export interface OpcionesHW {
    m: number;
    tendencia?: boolean;
    estacional?: boolean;
}
export interface OpcionesArima {
    p: number;
    d: number;
    q: number;
    P?: number;
    D?: number;
    Q?: number;
    m?: number;
}
export function cuantilNormal(p: number): number {
    if (!(p > 0 && p < 1))
        return p <= 0 ? -Infinity : Infinity;
    const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
    const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
    const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
    const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
    const pl = 0.02425;
    if (p < pl) {
        const q = Math.sqrt(-2 * Math.log(p));
        return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    }
    if (p > 1 - pl)
        return -cuantilNormal(1 - p);
    const q = p - 0.5, r = q * q;
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}
export function zDeNivel(nivel: number): number {
    return cuantilNormal(0.5 + nivel / 2);
}
function media(v: readonly number[]): number { return v.reduce((s, x) => s + x, 0) / (v.length || 1); }
function desv(v: readonly number[]): number {
    const m = media(v);
    return Math.sqrt(v.reduce((s, x) => s + (x - m) ** 2, 0) / Math.max(1, v.length - 1));
}
const finitos = (v: readonly number[]) => v.filter(Number.isFinite);
export function nelderMead(f: (x: number[]) => number, x0: number[], opt: {
    maxIter?: number;
    tol?: number;
    paso?: number;
} = {}): {
    x: number[];
    fx: number;
    iter: number;
} {
    const n = x0.length;
    const maxIter = opt.maxIter ?? 200 * n, tol = opt.tol ?? 1e-8, paso = opt.paso ?? 0.3;
    const seguro = (x: number[]) => { const v = f(x); return Number.isFinite(v) ? v : 1e+300; };
    let pts: {
        x: number[];
        fx: number;
    }[] = [{ x: x0.slice(), fx: seguro(x0) }];
    for (let i = 0; i < n; i++) {
        const x = x0.slice();
        x[i] += paso;
        pts.push({ x, fx: seguro(x) });
    }
    let iter = 0;
    for (; iter < maxIter; iter++) {
        pts.sort((a, b) => a.fx - b.fx);
        if (Math.abs(pts[n].fx - pts[0].fx) <= tol * (1 + Math.abs(pts[0].fx)))
            break;
        const c = new Array<number>(n).fill(0);
        for (let i = 0; i < n; i++)
            for (let j = 0; j < n; j++)
                c[j] += pts[i].x[j] / n;
        const mover = (k: number) => c.map((cj, j) => cj + k * (pts[n].x[j] - cj));
        const xr = mover(-1), fr = seguro(xr);
        if (fr < pts[0].fx) {
            const xe = mover(-2), fe = seguro(xe);
            pts[n] = fe < fr ? { x: xe, fx: fe } : { x: xr, fx: fr };
        }
        else if (fr < pts[n - 1].fx) {
            pts[n] = { x: xr, fx: fr };
        }
        else {
            const xc = fr < pts[n].fx ? mover(-0.5) : mover(0.5), fc = seguro(xc);
            if (fc < Math.min(fr, pts[n].fx))
                pts[n] = { x: xc, fx: fc };
            else {
                for (let i = 1; i <= n; i++) {
                    const x = pts[i].x.map((xj, j) => pts[0].x[j] + 0.5 * (xj - pts[0].x[j]));
                    pts[i] = { x, fx: seguro(x) };
                }
            }
        }
    }
    pts.sort((a, b) => a.fx - b.fx);
    return { x: pts[0].x, fx: pts[0].fx, iter };
}
const sigm = (x: number) => 1 / (1 + Math.exp(-x));
function intervalo(media_: number[], sdPaso: number[], nivel: number): {
    inferior: number[];
    superior: number[];
} {
    const z = zDeNivel(nivel);
    return { inferior: media_.map((m, i) => m - z * sdPaso[i]), superior: media_.map((m, i) => m + z * sdPaso[i]) };
}
export function ingenuo(y: readonly number[], h: number, nivel: number): Prevision {
    const n = y.length;
    const ajustados = y.map((_, t) => (t === 0 ? NaN : y[t - 1]));
    const residuos = y.map((v, t) => (t === 0 ? NaN : v - y[t - 1]));
    const s2 = finitos(residuos).reduce((s, r) => s + r * r, 0) / Math.max(1, n - 1);
    const sg = Math.sqrt(s2);
    const med = Array.from({ length: h }, () => y[n - 1]);
    const sd = Array.from({ length: h }, (_, i) => sg * Math.sqrt(i + 1));
    return { modelo: "naive", media: med, ...intervalo(med, sd, nivel), sigma: sg, residuos, ajustados, parametros: {}, k: 0, aicc: null, avisos: [] };
}
export function ingenuoEstacional(y: readonly number[], h: number, nivel: number, m: number): Prevision {
    if (m <= 1 || y.length <= m)
        return { ...ingenuo(y, h, nivel), modelo: "snaive" };
    const n = y.length;
    const ajustados = y.map((_, t) => (t < m ? NaN : y[t - m]));
    const residuos = y.map((v, t) => (t < m ? NaN : v - y[t - m]));
    const s2 = finitos(residuos).reduce((s, r) => s + r * r, 0) / Math.max(1, n - m);
    const sg = Math.sqrt(s2);
    const med = Array.from({ length: h }, (_, i) => y[n - m + (i % m)]);
    const sd = Array.from({ length: h }, (_, i) => sg * Math.sqrt(Math.floor(i / m) + 1));
    return { modelo: "snaive", media: med, ...intervalo(med, sd, nivel), sigma: sg, residuos, ajustados, parametros: { m }, k: 0, aicc: null, avisos: [] };
}
interface EstadoHW {
    l: number;
    b: number;
    s: number[];
    sse: number;
    res: number[];
    aj: number[];
}
function pasadaHW(y: readonly number[], a: number, bb: number, g: number, m: number, tend: boolean, est: boolean, l0: number, b0: number, s0: number[]): EstadoHW {
    let l = l0, b = b0;
    const s = s0.slice();
    const res: number[] = [], aj: number[] = [];
    let sse = 0;
    for (let t = 0; t < y.length; t++) {
        const si = est ? s[t % m] : 0;
        const pred = l + (tend ? b : 0) + si;
        const e = y[t] - pred;
        aj.push(pred);
        res.push(e);
        sse += e * e;
        l += (tend ? b : 0) + a * e;
        if (tend)
            b += a * bb * e;
        if (est)
            s[t % m] = si + g * (1 - a) * e;
    }
    return { l, b, s, sse, res, aj };
}
export function holtWinters(y: readonly number[], h: number, nivel: number, o: OpcionesHW): Prevision {
    const n = y.length;
    const avisos: string[] = [];
    let m = Math.max(1, Math.round(o.m));
    let est = (o.estacional ?? true) && m > 1;
    if (est && n < 2 * m) {
        est = false;
        avisos.push("hw.sin-estacion");
    }
    if (!est)
        m = 1;
    const tend = o.tendencia ?? true;
    const base = est ? m : Math.min(n, 4);
    const l0 = est ? media(y.slice(0, m)) : y[0];
    const b0 = !tend ? 0 : est ? (media(y.slice(m, 2 * m)) - media(y.slice(0, m))) / m : (n > 1 ? (y[Math.min(n - 1, base - 1)] - y[0]) / Math.max(1, Math.min(n - 1, base - 1)) : 0);
    const s0 = est ? y.slice(0, m).map(v => v - l0) : [0];
    const pasos = (x: number[]) => {
        const a = sigm(x[0]);
        let i = 1;
        const bb = tend ? sigm(x[i++]) : 0;
        const g = est ? sigm(x[i++]) : 0;
        return { a, bb, g };
    };
    const dim = 1 + (tend ? 1 : 0) + (est ? 1 : 0);
    const ini = [-0.8, ...(tend ? [-2] : []), ...(est ? [-2] : [])];
    const obj = (x: number[]) => { const p = pasos(x); return pasadaHW(y, p.a, p.bb, p.g, m, tend, est, l0, b0, s0).sse; };
    const ajuste = nelderMead(obj, ini.slice(0, dim), { maxIter: 300 * dim, paso: 1 });
    const { a, bb, g } = pasos(ajuste.x);
    const st = pasadaHW(y, a, bb, g, m, tend, est, l0, b0, s0);
    const k = dim + (est ? m : 0) + 1 + (tend ? 1 : 0);
    const sigma = Math.sqrt(st.sse / Math.max(1, n - dim));
    const med = Array.from({ length: h }, (_, i) => st.l + (tend ? (i + 1) * st.b : 0) + (est ? st.s[(n + i) % m] : 0));
    const sd = Array.from({ length: h }, (_, i) => {
        let v = 1;
        for (let j = 1; j <= i; j++) {
            const c = a * (1 + (tend ? j * bb : 0)) + (est && j % m === 0 ? g * (1 - a) : 0);
            v += c * c;
        }
        return sigma * Math.sqrt(v);
    });
    const aicc = n > k + 1 ? n * Math.log(Math.max(st.sse / n, 1e-300)) + 2 * k + (2 * k * (k + 1)) / (n - k - 1) : null;
    if (a > 0.98)
        avisos.push("hw.alpha-alto");
    const parametros: Record<string, number> = { alpha: a };
    if (tend)
        parametros["beta"] = bb;
    if (est)
        parametros["gamma"] = g;
    return { modelo: "hw", media: med, ...intervalo(med, sd, nivel), sigma, residuos: st.res, ajustados: st.aj, parametros, k, aicc, avisos };
}
function polyMul(a: readonly number[], b: readonly number[]): number[] {
    const r = new Array<number>(a.length + b.length - 1).fill(0);
    for (let i = 0; i < a.length; i++)
        for (let j = 0; j < b.length; j++)
            r[i + j] += a[i] * b[j];
    return r;
}
function polyEstacional(c: readonly number[], m: number): number[] {
    const r = new Array<number>(c.length * m + 1).fill(0);
    r[0] = 1;
    c.forEach((v, i) => { r[(i + 1) * m] = v; });
    return r;
}
function parcialesACoef(x: readonly number[]): number[] {
    const r = x.map(Math.tanh);
    let phi: number[] = [];
    for (let k = 0; k < r.length; k++) {
        const nuevo = phi.map((v, j) => v - r[k] * phi[k - 1 - j]);
        nuevo.push(r[k]);
        phi = nuevo;
    }
    return phi;
}
interface ModeloArima {
    A: number[];
    T: number[];
    mu: number;
    res: number[];
    css: number;
    nUtil: number;
}
function armarArima(z: readonly number[], phi: number[], theta: number[], Phi: number[], Theta: number[], d: number, D: number, m: number, mu: number, kappa: number): ModeloArima {
    let A: number[] = [1, ...phi.map(v => -v)];
    if (Phi.length)
        A = polyMul(A, polyEstacional(Phi.map(v => -v), m));
    for (let i = 0; i < d; i++)
        A = polyMul(A, [1, -1]);
    for (let i = 0; i < D; i++)
        A = polyMul(A, polyEstacional([-1], m));
    let T: number[] = [1, ...theta];
    if (Theta.length)
        T = polyMul(T, polyEstacional(Theta, m));
    const n = z.length, p = A.length - 1, q = T.length - 1;
    const w = z.map(v => v - mu);
    const res = new Array<number>(n).fill(NaN);
    let css = 0, nUtil = 0;
    for (let t = p; t < n; t++) {
        let e = 0;
        for (let i = 0; i <= p; i++)
            e += A[i] * w[t - i];
        e -= kappa;
        for (let j = 1; j <= q; j++) {
            const prev = t - j;
            if (prev >= p && Number.isFinite(res[prev]))
                e -= T[j] * res[prev];
        }
        res[t] = e;
        css += e * e;
        nUtil++;
    }
    return { A, T, mu, res, css, nUtil };
}
export function arima(y: readonly number[], h: number, nivel: number, o: OpcionesArima): Prevision {
    const n = y.length;
    const p = o.p, d = o.d, q = o.q, P = o.P ?? 0, D = o.D ?? 0, Q = o.Q ?? 0, m = Math.max(1, Math.round(o.m ?? 1));
    const avisos: string[] = [];
    const usaEst = (P + D + Q) > 0 && m > 1;
    const PP = usaEst ? P : 0, DD = usaEst ? D : 0, QQ = usaEst ? Q : 0;
    const mm = usaEst ? m : 1;
    const ordenMax = p + PP * mm + d + DD * mm;
    if (n < ordenMax + 5) {
        return { ...ingenuo(y, h, nivel), modelo: "arima", avisos: ["arima.pocos-datos"] };
    }
    const mu0 = media(y), sc = desv(y) || 1;
    const z = y.map(v => (v - mu0) / sc);
    const conMedia = d + DD === 0;
    const conDeriva = d + DD === 1;
    const dim = p + q + PP + QQ + (conMedia || conDeriva ? 1 : 0);
    const trocear = (x: number[]) => {
        let i = 0;
        const phi = parcialesACoef(x.slice(i, i += p));
        const theta = parcialesACoef(x.slice(i, i += q)).map(v => -v);
        const Phi = parcialesACoef(x.slice(i, i += PP));
        const Theta = parcialesACoef(x.slice(i, i += QQ)).map(v => -v);
        const mu = conMedia ? x[i] : 0;
        const kappa = conDeriva ? x[i] : 0;
        return { phi, theta, Phi, Theta, mu, kappa };
    };
    const construir = (x: number[]) => { const c = trocear(x); return armarArima(z, c.phi, c.theta, c.Phi, c.Theta, d, DD, mm, c.mu, c.kappa); };
    let x = new Array<number>(dim).fill(0);
    if (dim > 0) {
        x = nelderMead(v => { const r = construir(v); return r.nUtil > 0 ? r.css : Infinity; }, x, { maxIter: 300 * dim, paso: 0.4 }).x;
    }
    const c = trocear(x);
    const mod = armarArima(z, c.phi, c.theta, c.Phi, c.Theta, d, DD, mm, c.mu, c.kappa);
    const { A, T } = mod;
    const pA = A.length - 1, qT = T.length - 1;
    const sigmaZ = Math.sqrt(mod.css / Math.max(1, mod.nUtil));
    const w = z.map(v => v - c.mu);
    const e = mod.res.map(v => (Number.isFinite(v) ? v : 0));
    const wf = w.slice(), ef = e.slice();
    for (let i = 0; i < h; i++) {
        const t = n + i;
        let v = 0;
        for (let k = 1; k <= pA; k++)
            v -= A[k] * wf[t - k];
        for (let k = 1; k <= qT; k++)
            v += T[k] * ef[t - k];
        v += c.kappa;
        wf.push(v);
        ef.push(0);
    }
    const medZ = wf.slice(n).map(v => v + c.mu);
    const psi: number[] = [1];
    for (let k = 1; k < h; k++) {
        let v = k <= qT ? T[k] : 0;
        for (let i = 1; i <= Math.min(k, pA); i++)
            v -= A[i] * psi[k - i];
        psi.push(v);
    }
    let acum = 0;
    const sdZ = psi.map(v => { acum += v * v; return sigmaZ * Math.sqrt(acum); });
    const med = medZ.map(v => v * sc + mu0);
    const sd = sdZ.map(v => v * sc);
    const ajustados = y.map((v, t) => (Number.isFinite(mod.res[t]) ? v - mod.res[t] * sc : NaN));
    const residuos = mod.res.map(v => (Number.isFinite(v) ? v * sc : NaN));
    const k = dim + 1;
    const nn = mod.nUtil;
    const aicc = nn > k + 1 ? nn * Math.log(Math.max(mod.css / nn, 1e-300) * sc * sc) + 2 * k + (2 * k * (k + 1)) / (nn - k - 1) : null;
    const parametros: Record<string, number> = {};
    c.phi.forEach((v, i) => { parametros[`phi${i + 1}`] = v; });
    c.theta.forEach((v, i) => { parametros[`theta${i + 1}`] = v; });
    c.Phi.forEach((v, i) => { parametros[`Phi${i + 1}`] = v; });
    c.Theta.forEach((v, i) => { parametros[`Theta${i + 1}`] = v; });
    if (conMedia)
        parametros["media"] = c.mu * sc + mu0;
    if (conDeriva) {
        const ar1 = (1 - c.phi.reduce((s, v) => s + v, 0)) * (1 - c.Phi.reduce((s, v) => s + v, 0));
        parametros["deriva"] = ar1 !== 0 ? (c.kappa / ar1) * sc : 0;
    }
    if (Object.entries(parametros).some(([nombre, v]) => nombre !== "media" && nombre !== "deriva" && Math.abs(v) > 0.97))
        avisos.push("arima.raiz-cerca-de-1");
    return { modelo: "arima", media: med, ...intervalo(med, sd, nivel), sigma: sigmaZ * sc, residuos, ajustados, parametros, k, aicc, avisos };
}
export function etiquetaArima(o: OpcionesArima): string {
    const est = (o.P ?? 0) + (o.D ?? 0) + (o.Q ?? 0) > 0 && (o.m ?? 1) > 1;
    return `ARIMA(${o.p},${o.d},${o.q})` + (est ? `(${o.P ?? 0},${o.D ?? 0},${o.Q ?? 0})[${o.m}]` : "");
}
export interface ConfigModelo {
    modelo: Modelo;
    m: number;
    hw?: {
        tendencia?: boolean;
        estacional?: boolean;
    };
    arima?: OpcionesArima;
}
export function prever(y: readonly number[], h: number, nivel: number, cfg: ConfigModelo): Prevision {
    switch (cfg.modelo) {
        case "naive": return ingenuo(y, h, nivel);
        case "snaive": return ingenuoEstacional(y, h, nivel, cfg.m);
        case "hw": return holtWinters(y, h, nivel, { m: cfg.m, ...cfg.hw });
        case "arima": return arima(y, h, nivel, { m: cfg.m, ...(cfg.arima ?? { p: 1, d: 1, q: 1 }) });
    }
}
function diferenciar(v: readonly number[], lag: number): number[] {
    return v.slice(lag).map((x, i) => x - v[i]);
}
const varianza = (v: readonly number[]) => { const s = desv(v); return s * s; };
export function eligeDiferencias(y: readonly number[], m: number): {
    d: number;
    D: number;
} {
    let v: number[] = y.slice();
    let D = 0, d = 0;
    if (m > 1 && y.length >= 3 * m) {
        const w = diferenciar(v, m);
        if (varianza(w) < 0.9 * varianza(v)) {
            v = w;
            D = 1;
        }
    }
    for (; d < 2 && v.length > 10; d++) {
        const w = diferenciar(v, 1);
        if (varianza(w) < 0.9 * varianza(v))
            v = w;
        else
            break;
    }
    return { d, D };
}
export function arimaAuto(y: readonly number[], h: number, nivel: number, m: number): {
    opciones: OpcionesArima;
    prevision: Prevision;
} {
    const { d, D } = eligeDiferencias(y, m);
    const estacional = m > 1 && D > 0;
    let mejor: {
        opciones: OpcionesArima;
        prevision: Prevision;
    } | null = null;
    for (let p = 0; p <= 2; p++)
        for (let q = 0; q <= 2; q++)
            for (let P = 0; P <= (estacional ? 1 : 0); P++)
                for (let Q = 0; Q <= (estacional ? 1 : 0); Q++) {
                    const opciones: OpcionesArima = { p, d, q, P, D: estacional ? D : 0, Q, m };
                    const prevision = arima(y, h, nivel, opciones);
                    if (prevision.aicc === null || prevision.avisos.includes("arima.pocos-datos"))
                        continue;
                    if (!mejor || (mejor.prevision.aicc !== null && prevision.aicc < mejor.prevision.aicc))
                        mejor = { opciones, prevision };
                }
    if (mejor)
        return mejor;
    const opciones: OpcionesArima = { p: 0, d: 1, q: 0, m };
    return { opciones, prevision: arima(y, h, nivel, opciones) };
}
