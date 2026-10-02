import { jStat } from "jstat";
import { mulberry32 } from "./rng";
export type ReglaParada = "ingenua" | "pocock" | "obf";
const phi = (x: number) => Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
function probContinuar(b: number[], puntos = 101): number {
    let xs: number[] = [], f: number[] = [];
    for (let k = 0; k < b.length; k++) {
        const lim = b[k] * Math.sqrt(k + 1);
        const n = puntos % 2 ? puntos : puntos + 1, h = (2 * lim) / (n - 1);
        const nx = Array.from({ length: n }, (_, i) => -lim + i * h);
        const nf = k === 0
            ? nx.map(phi)
            : nx.map((s) => {
                const hp = xs[1] - xs[0];
                let acc = 0;
                for (let i = 0; i < xs.length; i++) {
                    const w = i === 0 || i === xs.length - 1 ? 1 : i % 2 ? 4 : 2;
                    acc += w * f[i] * phi(s - xs[i]);
                }
                return (acc * hp) / 3;
            });
        xs = nx;
        f = nf;
    }
    const h = xs[1] - xs[0];
    let total = 0;
    for (let i = 0; i < xs.length; i++)
        total += (i === 0 || i === xs.length - 1 ? 1 : i % 2 ? 4 : 2) * f[i];
    return (total * h) / 3;
}
const forma = (tipo: "pocock" | "obf", K: number, C: number) => Array.from({ length: K }, (_, k) => (tipo === "pocock" ? C : C * Math.sqrt(K / (k + 1))));
export function fronterasSecuenciales(K: number, alfa = 0.05, tipo: "pocock" | "obf" = "obf"): number[] | null {
    if (!Number.isInteger(K) || K < 1 || K > 50 || !(alfa > 0 && alfa < 1))
        return null;
    const clave = `${tipo}|${K}|${alfa}`;
    const hecha = CACHE_FRONTERAS.get(clave);
    if (hecha)
        return [...hecha];
    const z1 = jStat.normal.inv(1 - alfa / 2, 0, 1);
    let C = z1;
    if (K > 1) {
        let lo = z1, hi = z1 + 3;
        for (let i = 0; i < 40; i++) {
            const mid = (lo + hi) / 2;
            if (1 - probContinuar(forma(tipo, K, mid)) > alfa)
                lo = mid;
            else
                hi = mid;
        }
        C = (lo + hi) / 2;
    }
    const b = forma(tipo, K, C);
    CACHE_FRONTERAS.set(clave, b);
    return [...b];
}
const CACHE_FRONTERAS = new Map<string, number[]>();
function binomial(n: number, p: number, u: () => number): number {
    if (n <= 0 || p <= 0)
        return 0;
    if (p >= 1)
        return n;
    const media = n * p;
    if (media < 30 || n * (1 - p) < 30) {
        const lq = Math.log(1 - p);
        let x = 0, pos = 0;
        for (;;) {
            pos += Math.floor(Math.log(1 - u()) / lq) + 1;
            if (pos > n)
                return x;
            x++;
        }
    }
    const z = Math.sqrt(-2 * Math.log(1 - u())) * Math.cos(2 * Math.PI * u());
    return Math.min(n, Math.max(0, Math.round(media + z * Math.sqrt(media * (1 - p)))));
}
export interface ParametrosMiradas {
    p: number;
    pB?: number;
    nPorBrazo: number;
    miradas: number;
    regla: ReglaParada;
    alfa?: number;
    simulaciones?: number;
    semilla?: number;
}
export interface ResultadoMiradas {
    tasaRechazo: number;
    errorMc: number;
    acumulado: number[];
    fronteras: number[];
    simulaciones: number;
}
export const MAX_SIMULACIONES = 50000;
export function simularMiradas(par: ParametrosMiradas): ResultadoMiradas | null {
    const { p, nPorBrazo, miradas: K, regla } = par;
    const pB = par.pB ?? p, alfa = par.alfa ?? 0.05;
    const sims = Math.min(par.simulaciones ?? 5000, MAX_SIMULACIONES);
    if (!(p > 0 && p < 1 && pB > 0 && pB < 1) || !Number.isInteger(nPorBrazo) || nPorBrazo < 10
        || !Number.isInteger(K) || K < 1 || K > 100 || K > nPorBrazo || !(sims >= 100))
        return null;
    const fronteras = regla === "ingenua"
        ? Array.from({ length: K }, () => jStat.normal.inv(1 - alfa / 2, 0, 1))
        : fronterasSecuenciales(K, alfa, regla);
    if (!fronteras)
        return null;
    const cortes = Array.from({ length: K }, (_, k) => Math.round((nPorBrazo * (k + 1)) / K));
    const u = mulberry32(par.semilla ?? 20260926);
    const paradasEn = new Array<number>(K).fill(0);
    for (let s = 0; s < sims; s++) {
        let xa = 0, xb = 0, prev = 0;
        for (let k = 0; k < K; k++) {
            const inc = cortes[k] - prev;
            prev = cortes[k];
            xa += binomial(inc, p, u);
            xb += binomial(inc, pB, u);
            const n = cortes[k], pp = (xa + xb) / (2 * n);
            const se = Math.sqrt(pp * (1 - pp) * (2 / n));
            if (se > 0 && Math.abs((xb - xa) / n / se) >= fronteras[k]) {
                paradasEn[k]++;
                break;
            }
        }
    }
    const acumulado: number[] = [];
    let acc = 0;
    for (const c of paradasEn) {
        acc += c;
        acumulado.push(acc / sims);
    }
    const tasa = acc / sims;
    return { tasaRechazo: tasa, errorMc: Math.sqrt((tasa * (1 - tasa)) / sims), acumulado, fronteras, simulaciones: sims };
}
export function gastoAlfa(t: number, alfa: number, tipo: "pocock" | "obf"): number {
    if (t <= 0)
        return 0;
    if (t >= 1)
        return alfa;
    return tipo === "obf"
        ? 2 * (2 - 2 * jStat.normal.cdf(jStat.normal.inv(1 - alfa / 4, 0, 1) / Math.sqrt(t), 0, 1))
        : alfa * Math.log(1 + (Math.E - 1) * t);
}
export const FRONTERA_MAX = 8;
export function fronterasGastoAlfa(tiempos: number[], alfa = 0.05, tipo: "pocock" | "obf" = "obf", puntos = 101): number[] | null {
    if (!tiempos.length || tiempos.length > 200 || !(alfa > 0 && alfa < 1))
        return null;
    if (tiempos.some((t, i) => !(t > 0 && t <= 1) || (i > 0 && !(t > tiempos[i - 1]))))
        return null;
    const n = puntos % 2 ? puntos : puntos + 1;
    const simpson = (i: number) => (i === 0 || i === n - 1 ? 1 : i % 2 ? 4 : 2);
    const fronteras: number[] = [];
    let xs: number[] = [], f: number[] = [], tPrev = 0, gastado = 0;
    for (const t of tiempos) {
        const objetivo = gastoAlfa(t, alfa, tipo) - gastado;
        const d = t - tPrev, sd = Math.sqrt(d);
        const cruza = (c: number): number => {
            if (!xs.length)
                return 2 * (1 - jStat.normal.cdf(c / sd, 0, 1));
            const h = xs[1] - xs[0];
            let acc = 0;
            for (let i = 0; i < n; i++) {
                acc += simpson(i) * f[i] * (jStat.normal.cdf((-c - xs[i]) / sd, 0, 1) + 1 - jStat.normal.cdf((c - xs[i]) / sd, 0, 1));
            }
            return (acc * h) / 3;
        };
        const raiz = Math.sqrt(t);
        let z: number;
        if (!(objetivo > 1e-12) || cruza(FRONTERA_MAX * raiz) >= objetivo)
            z = FRONTERA_MAX;
        else {
            let lo = 0, hi = FRONTERA_MAX;
            for (let i = 0; i < 50; i++) {
                const mid = (lo + hi) / 2;
                if (cruza(mid * raiz) > objetivo)
                    lo = mid;
                else
                    hi = mid;
            }
            z = (lo + hi) / 2;
        }
        fronteras.push(z);
        gastado += cruza(z * raiz);
        const lim = z * raiz, h = (2 * lim) / (n - 1);
        const nx = Array.from({ length: n }, (_, i) => -lim + i * h);
        const nf = nx.map((s) => {
            if (!xs.length)
                return phi(s / sd) / sd;
            const hp = xs[1] - xs[0];
            let acc = 0;
            for (let i = 0; i < n; i++)
                acc += simpson(i) * f[i] * phi((s - xs[i]) / sd);
            return (acc * hp) / (3 * sd);
        });
        xs = nx;
        f = nf;
        tPrev = t;
    }
    return fronteras;
}
