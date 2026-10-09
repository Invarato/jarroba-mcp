import { KW_25C, balanceCarga, fracciones, phExacto, type Disolucion, type SistemaAcido } from "./ph";
export type AnionSal = {
    tipo: "ion";
    ion: string;
    carga: number;
} | {
    tipo: "sistema";
    id: string;
    pKa: number[];
    carga0: number;
} | {
    tipo: "oh";
};
export interface Sal {
    pKs: number;
    cation: string;
    zc: number;
    m: number;
    n: number;
    anion: AnionSal;
}
export interface ResultadoSolubilidad {
    pH: number;
    s: number;
    M: number;
    A: number;
}
const cargaAnion = (a: AnionSal) => a.tipo === "ion" ? a.carga : a.tipo === "oh" ? -1 : a.carga0 - a.pKa.length;
export function ionesDelVaso(d: Disolucion, sal: Sal): {
    M0: number;
    A0: number;
} {
    const M0 = d.iones?.[sal.cation] ?? 0;
    const a = sal.anion;
    const A0 = a.tipo === "ion" ? d.iones?.[a.ion] ?? 0
        : a.tipo === "sistema" ? d.sistemas.filter(x => x.nombre === a.id).reduce((s, x) => s + x.C, 0)
            : 0;
    return { M0, A0 };
}
function alfaLibre(a: AnionSal, pH: number): number {
    return a.tipo === "sistema" ? fracciones(a.pKa, pH)[a.pKa.length] : 1;
}
function anionLibre(a: AnionSal, pH: number, total: number, Kw: number): number {
    return a.tipo === "oh" ? Kw / 10 ** -pH : alfaLibre(a, pH) * total;
}
export function logQ(d: Disolucion, sal: Sal, Kw = KW_25C): number {
    const { M0, A0 } = ionesDelVaso(d, sal);
    const pH = phExacto(d, Kw).pH;
    const A = anionLibre(sal.anion, pH, A0, Kw);
    return M0 > 0 && A > 0 ? sal.m * Math.log10(M0) + sal.n * Math.log10(A) : -Infinity;
}
export function solubilidadAPH(sal: Sal, pH: number, M0 = 0, A0 = 0, Kw = KW_25C): number {
    const lnKs = -sal.pKs * Math.LN10;
    const g = (s: number) => {
        const M = M0 + sal.m * s;
        const A = anionLibre(sal.anion, pH, A0 + sal.n * s, Kw);
        return M > 0 && A > 0 ? sal.m * Math.log(M) + sal.n * Math.log(A) - lnKs : -Infinity;
    };
    let lo = -Math.min(M0 / sal.m, sal.anion.tipo === "oh" ? Infinity : A0 / sal.n);
    let hi = 100;
    if (g(hi) < 0)
        return hi;
    for (let k = 0; k < 300 && hi - lo > Math.max(1e-300, Math.abs(hi) * 1e-15); k++) {
        const mid = (lo + hi) / 2;
        if (g(mid) < 0)
            lo = mid;
        else
            hi = mid;
    }
    return (lo + hi) / 2;
}
function conSal(d: Disolucion, sal: Sal, s: number): Disolucion {
    const a = sal.anion;
    const iones = { ...(d.iones ?? {}) };
    iones[sal.cation] = (iones[sal.cation] ?? 0) + sal.m * s;
    let espectadores = d.espectadores + sal.zc * sal.m * s;
    let sistemas = d.sistemas;
    if (a.tipo === "ion") {
        iones[a.ion] = (iones[a.ion] ?? 0) + sal.n * s;
        espectadores += a.carga * sal.n * s;
    }
    else if (a.tipo === "sistema") {
        const ya = d.sistemas.find(x => x.nombre === a.id);
        sistemas = ya
            ? d.sistemas.map(x => x === ya ? { ...x, C: x.C + sal.n * s } : x)
            : [...d.sistemas, { C: sal.n * s, pKa: a.pKa, carga0: a.carga0, nombre: a.id } as SistemaAcido];
    }
    return { sistemas, espectadores, iones };
}
export function equilibrioConSolido(d: Disolucion, sal: Sal, Kw = KW_25C): ResultadoSolubilidad {
    const { M0, A0 } = ionesDelVaso(d, sal);
    const f = (pH: number) => {
        const s = solubilidadAPH(sal, pH, M0, A0, Kw);
        return { s, b: balanceCarga(conSal(d, sal, s), pH, Kw) };
    };
    let a = -1, fa = f(a).b, b = a;
    for (let pH = -0.95; pH <= 15.0001; pH += 0.05) {
        const fb = f(pH).b;
        if (Math.sign(fb) !== Math.sign(fa)) {
            b = pH;
            break;
        }
        a = pH;
        fa = fb;
    }
    for (let k = 0; k < 100 && b - a > 1e-12; k++) {
        const m = (a + b) / 2, fm = f(m).b;
        if (Math.sign(fm) === Math.sign(fa)) {
            a = m;
            fa = fm;
        }
        else
            b = m;
    }
    const pH = (a + b) / 2, { s } = f(pH);
    return { pH, s, M: M0 + sal.m * s, A: anionLibre(sal.anion, pH, A0 + sal.n * s, Kw) };
}
export function precipitacion(d: Disolucion, sal: Sal, conSolido: boolean, Kw = KW_25C): {
    logQ: number;
    precipita: boolean;
    equilibrio: ResultadoSolubilidad | null;
} {
    const lq = logQ(d, sal, Kw);
    const precipita = lq > -sal.pKs;
    return { logQ: lq, precipita, equilibrio: precipita || conSolido ? equilibrioConSolido(d, sal, Kw) : null };
}
export function solubilidadLibro(sal: Sal, M0 = 0, A0 = 0): {
    metodo: "agua" | "ion-comun-cation" | "ion-comun-anion" | "sin-formula";
    s: number;
} {
    const Ks = 10 ** -sal.pKs, { m, n } = sal;
    if (M0 > 0 && A0 > 0)
        return { metodo: "sin-formula", s: NaN };
    if (M0 > 0)
        return { metodo: "ion-comun-cation", s: (Ks / M0 ** m) ** (1 / n) / n };
    if (A0 > 0)
        return { metodo: "ion-comun-anion", s: (Ks / A0 ** n) ** (1 / m) / m };
    return { metodo: "agua", s: (Ks / (m ** m * n ** n)) ** (1 / (m + n)) };
}
export { cargaAnion };
