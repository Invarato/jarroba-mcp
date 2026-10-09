import { KW_25C, phExacto, type Disolucion } from "./ph";
export type MetodoLibro = "agua" | "fuerte-acido" | "fuerte-base" | "debil-acido" | "debil-base" | "anfotero" | "tampon" | "mezcla-fuerte" | "mezcla-mas-fuerte";
export interface AproximacionLibro {
    metodo: MetodoLibro;
    pH: number;
    pKa: number[];
    regla: {
        id: "cinco-por-ciento" | "agua-despreciable" | "tampon" | "anfotero-concentrado";
        valor: number;
        cumple: boolean;
    } | null;
    error: number;
}
const r = (x: number) => Math.round(x * 1000000000) / 1000000000;
export function aproximacionLibro(d: Disolucion, Kw = KW_25C): AproximacionLibro | null {
    const exacto = phExacto(d, Kw).pH;
    const pKw = -Math.log10(Kw);
    const fuerte = (exceso: number, metodo: MetodoLibro, pKa: number[] = []): AproximacionLibro => {
        const pH = exceso > 0 ? pKw + Math.log10(exceso) : -Math.log10(-exceso);
        const c = Math.abs(exceso);
        return { metodo, pH, pKa, regla: { id: "agua-despreciable", valor: c, cumple: c >= 0.000001 }, error: pH - exacto };
    };
    if (d.sistemas.length === 0) {
        if (Math.abs(d.espectadores) < 1e-15)
            return { metodo: "agua", pH: pKw / 2, pKa: [], regla: null, error: pKw / 2 - exacto };
        return fuerte(d.espectadores, d.espectadores < 0 ? "fuerte-acido" : "fuerte-base");
    }
    if (d.sistemas.length > 1) {
        const sumaZ0 = d.sistemas.reduce((a, x) => a + x.C * x.carga0, 0);
        const sumaZn = d.sistemas.reduce((a, x) => a + x.C * (x.carga0 - x.pKa.length), 0);
        if (d.espectadores + sumaZ0 < -1e-15)
            return { ...fuerte(d.espectadores + sumaZ0, "mezcla-fuerte"), regla: null };
        if (d.espectadores + sumaZn > 1e-15)
            return { ...fuerte(d.espectadores + sumaZn, "mezcla-fuerte"), regla: null };
        const neutros = d.sistemas.every(x => x.carga0 === 0) && Math.abs(d.espectadores) < 1e-15;
        if (!neutros)
            return null;
        const masFuerte = [...d.sistemas].sort((a, b) => a.pKa[0] - b.pKa[0])[0];
        const sub = aproximacionLibro({ sistemas: [masFuerte], espectadores: 0 }, Kw)!;
        return { ...sub, metodo: "mezcla-mas-fuerte", regla: null, error: sub.pH - exacto };
    }
    const s = d.sistemas[0], n = s.pKa.length;
    const dd = r(s.carga0 + d.espectadores / s.C);
    if (dd < 0)
        return fuerte(dd * s.C, "mezcla-fuerte", s.pKa);
    if (dd > n)
        return fuerte((dd - n) * s.C, "mezcla-fuerte", s.pKa);
    if (dd === 0) {
        const pH = (s.pKa[0] - Math.log10(s.C)) / 2;
        const x = 10 ** -pH;
        return { metodo: "debil-acido", pH, pKa: [s.pKa[0]], regla: { id: "cinco-por-ciento", valor: x / s.C, cumple: x / s.C < 0.05 }, error: pH - exacto };
    }
    if (dd === n) {
        const pKb = pKw - s.pKa[n - 1];
        const pOH = (pKb - Math.log10(s.C)) / 2, pH = pKw - pOH;
        const x = 10 ** -pOH;
        return { metodo: "debil-base", pH, pKa: [s.pKa[n - 1]], regla: { id: "cinco-por-ciento", valor: x / s.C, cumple: x / s.C < 0.05 }, error: pH - exacto };
    }
    if (Number.isInteger(dd)) {
        const k = dd;
        const pH = (s.pKa[k - 1] + s.pKa[k]) / 2;
        const ka1 = 10 ** -s.pKa[k - 1];
        return { metodo: "anfotero", pH, pKa: [s.pKa[k - 1], s.pKa[k]], regla: { id: "anfotero-concentrado", valor: s.C / ka1, cumple: s.C / ka1 > 100 }, error: pH - exacto };
    }
    const k = Math.floor(dd);
    const fBase = dd - k;
    const pH = s.pKa[k] + Math.log10(fBase / (1 - fBase));
    const h = 10 ** -pH, oh = Kw / h, cMin = s.C * Math.min(fBase, 1 - fBase);
    const valor = cMin / Math.max(h, oh);
    return { metodo: "tampon", pH, pKa: [s.pKa[k]], regla: { id: "tampon", valor, cumple: valor > 100 && fBase >= 1 / 11 && fBase <= 10 / 11 }, error: pH - exacto };
}
