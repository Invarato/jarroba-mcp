import { jStat } from "jstat";
import { chiSquareGof, chiSquareIndep } from "./inference";
export interface Brazo {
    n: number;
    x: number;
}
export interface Intervalo {
    lo: number;
    hi: number;
}
export type AvisoAb = "recuentos-bajos" | "lift-indefinido" | "srm";
export interface AnalisisAb {
    pA: number;
    pB: number;
    diff: number;
    diffIc: Intervalo;
    lift: number | null;
    liftIc: Intervalo | null;
    z: number;
    pZ: number;
    pFisher: number | null;
    metodo: "z" | "fisher";
    p: number;
    alfa: number;
    significativo: boolean;
    ganador: "A" | "B" | null;
    avisos: AvisoAb[];
}
const zDe = (conf: number) => jStat.normal.inv(1 - (1 - conf) / 2, 0, 1);
export function wilson(x: number, n: number, conf = 0.95): Intervalo {
    if (n <= 0)
        return { lo: 0, hi: 1 };
    const z = zDe(conf), p = x / n, z2 = z * z;
    const centro = (p + z2 / (2 * n)) / (1 + z2 / n);
    const radio = (z / (1 + z2 / n)) * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n));
    return { lo: Math.max(0, centro - radio), hi: Math.min(1, centro + radio) };
}
export function newcombe(a: Brazo, b: Brazo, conf = 0.95): Intervalo {
    const pA = a.x / a.n, pB = b.x / b.n, d = pB - pA;
    const wa = wilson(a.x, a.n, conf), wb = wilson(b.x, b.n, conf);
    return {
        lo: d - Math.sqrt((pB - wb.lo) ** 2 + (wa.hi - pA) ** 2),
        hi: d + Math.sqrt((wb.hi - pB) ** 2 + (pA - wa.lo) ** 2),
    };
}
export function cocienteIc(a: Brazo, b: Brazo, conf = 0.95): Intervalo | null {
    if (a.x === 0 || b.x === 0)
        return null;
    const r = (b.x / b.n) / (a.x / a.n);
    const se = Math.sqrt(1 / b.x - 1 / b.n + 1 / a.x - 1 / a.n);
    const z = zDe(conf);
    return { lo: r * Math.exp(-z * se), hi: r * Math.exp(z * se) };
}
export function zAgrupado(a: Brazo, b: Brazo): {
    z: number;
    p: number;
} {
    const pA = a.x / a.n, pB = b.x / b.n, pp = (a.x + b.x) / (a.n + b.n);
    const se = Math.sqrt(pp * (1 - pp) * (1 / a.n + 1 / b.n));
    if (se === 0)
        return { z: 0, p: 1 };
    const z = (pB - pA) / se;
    return { z, p: Math.min(1, 2 * (1 - jStat.normal.cdf(Math.abs(z), 0, 1))) };
}
const lchoose = (n: number, k: number) => jStat.gammaln(n + 1) - jStat.gammaln(k + 1) - jStat.gammaln(n - k + 1);
export const MAX_SOPORTE_FISHER = 2000000;
export function fisherBilateral(a: Brazo, b: Brazo): number | null {
    const N = a.n + b.n, K = a.x + b.x, m = b.n;
    const lo = Math.max(0, m - (N - K)), hi = Math.min(m, K);
    if (hi - lo > MAX_SOPORTE_FISHER)
        return null;
    const base = lchoose(N, m);
    const logp = (x: number) => lchoose(K, x) + lchoose(N - K, m - x) - base;
    const obs = logp(b.x) + Math.log1p(1e-7);
    let p = 0;
    for (let x = lo; x <= hi; x++) {
        const l = logp(x);
        if (l <= obs)
            p += Math.exp(l);
    }
    return Math.min(1, p);
}
export function recuentosBajos(a: Brazo, b: Brazo): boolean {
    const N = a.n + b.n, K = a.x + b.x;
    const esperados = [a.n * K / N, a.n * (N - K) / N, b.n * K / N, b.n * (N - K) / N];
    const bordes = [a.x, a.n - a.x, b.x, b.n - b.x].some((c) => c === 0);
    return bordes || esperados.some((e) => e < 5);
}
export function brazoValido(b: Brazo): boolean {
    return Number.isInteger(b.n) && Number.isInteger(b.x) && b.n >= 1 && b.x >= 0 && b.x <= b.n;
}
export function analizar(a: Brazo, b: Brazo, alfa = 0.05, conf = 1 - alfa): AnalisisAb | null {
    if (!brazoValido(a) || !brazoValido(b) || !(alfa > 0 && alfa < 1))
        return null;
    const pA = a.x / a.n, pB = b.x / b.n;
    const { z, p: pZ } = zAgrupado(a, b);
    const bajos = recuentosBajos(a, b);
    const pFisher = bajos || a.n + b.n <= 10000 ? fisherBilateral(a, b) : null;
    const metodo: "z" | "fisher" = bajos && pFisher !== null ? "fisher" : "z";
    const p = metodo === "fisher" ? pFisher! : pZ;
    const significativo = p < alfa;
    const avisos: AvisoAb[] = [];
    if (bajos)
        avisos.push("recuentos-bajos");
    if (pA === 0)
        avisos.push("lift-indefinido");
    return {
        pA,
        pB,
        diff: pB - pA,
        diffIc: newcombe(a, b, conf),
        lift: pA === 0 ? null : (pB - pA) / pA,
        liftIc: (() => { const r = cocienteIc(a, b, conf); return r && { lo: r.lo - 1, hi: r.hi - 1 }; })(),
        z,
        pZ,
        pFisher,
        metodo,
        p,
        alfa,
        significativo,
        ganador: significativo && pB !== pA ? (pB > pA ? "B" : "A") : null,
        avisos,
    };
}
export interface Srm {
    chi2: number;
    p: number;
    descuadrado: boolean;
    esperados: number[];
}
export const UMBRAL_SRM = 0.001;
export function srm(observados: number[], reparto: number[]): Srm | null {
    const total = observados.reduce((s, v) => s + v, 0);
    const sumaR = reparto.reduce((s, v) => s + v, 0);
    if (observados.length !== reparto.length || observados.length < 2 || total <= 0 || !(sumaR > 0)
        || reparto.some((r) => !(r > 0)))
        return null;
    const esperados = reparto.map((r) => (total * r) / sumaR);
    const { chi2, p } = chiSquareGof(observados, esperados);
    return { chi2, p, descuadrado: p < UMBRAL_SRM, esperados };
}
export function potencia(nPorBrazo: number, p1: number, p2: number, alfa = 0.05): number {
    const q1 = 1 - p1, q2 = 1 - p2, d = Math.abs(p1 - p2);
    const qu = jStat.normal.inv(1 - alfa / 2, 0, 1);
    const sd0 = Math.sqrt(((p1 + p2) * (q1 + q2)) / 2), sd1 = Math.sqrt(p1 * q1 + p2 * q2);
    const r = Math.sqrt(nPorBrazo);
    return jStat.normal.cdf((r * d - qu * sd0) / sd1, 0, 1) + jStat.normal.cdf((-r * d - qu * sd0) / sd1, 0, 1);
}
export function muestraPorBrazo(p1: number, p2: number, potenciaObjetivo = 0.8, alfa = 0.05): number | null {
    if (!(p1 > 0 && p1 < 1 && p2 > 0 && p2 < 1) || p1 === p2)
        return null;
    if (!(potenciaObjetivo > alfa && potenciaObjetivo < 1))
        return null;
    let lo = 2, hi = 1000000000000;
    if (potencia(hi, p1, p2, alfa) < potenciaObjetivo)
        return null;
    for (let i = 0; i < 200 && hi / lo > 1 + 1e-12; i++) {
        const mid = Math.sqrt(lo * hi);
        if (potencia(mid, p1, p2, alfa) < potenciaObjetivo)
            lo = mid;
        else
            hi = mid;
    }
    return hi;
}
export function mdeRelativo(p1: number, nPorBrazo: number, potenciaObjetivo = 0.8, alfa = 0.05): number | null {
    if (!(p1 > 0 && p1 < 1) || !(nPorBrazo >= 2))
        return null;
    let lo = 1e-9, hi = (1 - p1) / p1 - 1e-9;
    if (!(hi > lo) || potencia(nPorBrazo, p1, p1 * (1 + hi), alfa) < potenciaObjetivo)
        return null;
    for (let i = 0; i < 200; i++) {
        const mid = (lo + hi) / 2;
        if (potencia(nPorBrazo, p1, p1 * (1 + mid), alfa) < potenciaObjetivo)
            lo = mid;
        else
            hi = mid;
    }
    return hi;
}
export interface Duracion {
    dias: number;
    semanas: number;
    diasRedondeados: number;
}
export function duracion(nPorBrazo: number, visitasDia: number, fraccionEnExperimento = 1, brazos = 2): Duracion | null {
    if (!(nPorBrazo > 0 && visitasDia > 0 && fraccionEnExperimento > 0 && fraccionEnExperimento <= 1 && brazos >= 2))
        return null;
    const dias = Math.ceil((Math.ceil(nPorBrazo) * brazos) / (visitasDia * fraccionEnExperimento));
    const semanas = Math.max(1, Math.ceil(dias / 7));
    return { dias, semanas, diasRedondeados: semanas * 7 };
}
export type Correccion = "holm" | "bh";
export function ajustarP(ps: number[], metodo: Correccion): number[] {
    const m = ps.length;
    const orden = ps.map((p, i) => [p, i] as const).sort((a, b) => a[0] - b[0]);
    const out = new Array<number>(m);
    if (metodo === "holm") {
        let max = 0;
        orden.forEach(([p, i], k) => { max = Math.max(max, Math.min(1, (m - k) * p)); out[i] = max; });
    }
    else {
        let min = 1;
        for (let k = m - 1; k >= 0; k--) {
            const [p, i] = orden[k];
            min = Math.min(min, (m * p) / (k + 1));
            out[i] = Math.min(1, min);
        }
    }
    return out;
}
export interface ComparacionAbn {
    variante: number;
    analisis: AnalisisAb;
    pAjustado: number;
    significativo: boolean;
}
export interface AnalisisAbn {
    global: {
        chi2: number;
        p: number;
        gl: number;
    };
    comparaciones: ComparacionAbn[];
    correccion: Correccion;
    alfa: number;
}
export function analizarAbn(brazos: Brazo[], control = 0, correccion: Correccion = "holm", alfa = 0.05): AnalisisAbn | null {
    if (brazos.length < 2 || !brazos.every(brazoValido) || control < 0 || control >= brazos.length)
        return null;
    const tabla = brazos.map((b) => [b.x, b.n - b.x]);
    const g = chiSquareIndep(tabla);
    const crudas = brazos
        .map((b, i) => ({ i, a: i === control ? null : analizar(brazos[control], b, alfa) }))
        .filter((c): c is {
        i: number;
        a: AnalisisAb;
    } => c.a !== null);
    const aj = ajustarP(crudas.map((c) => c.a.p), correccion);
    return {
        global: { chi2: g.chi2, p: g.p, gl: brazos.length - 1 },
        comparaciones: crudas.map((c, k) => ({ variante: c.i, analisis: c.a, pAjustado: aj[k], significativo: aj[k] < alfa })),
        correccion,
        alfa,
    };
}
export function probBMejor(a: Brazo, b: Brazo): number | null {
    if (!brazoValido(a) || !brazoValido(b))
        return null;
    const aA = 1 + a.x, bA = 1 + a.n - a.x, aB = 1 + b.x, bB = 1 + b.n - b.x;
    const lbeta = (x: number, y: number) => jStat.gammaln(x) + jStat.gammaln(y) - jStat.gammaln(x + y);
    let total = 0;
    for (let i = 0; i < aB; i++) {
        total += Math.exp(lbeta(aA + i, bA + bB) - Math.log(bB + i) - lbeta(1 + i, bB) - lbeta(aA, bA));
    }
    return Math.min(1, Math.max(0, total));
}
export function intervaloCreible(b: Brazo, conf = 0.95): Intervalo {
    const a0 = 1 + b.x, b0 = 1 + b.n - b.x, cola = (1 - conf) / 2;
    return { lo: jStat.beta.inv(cola, a0, b0), hi: jStat.beta.inv(1 - cola, a0, b0) };
}
