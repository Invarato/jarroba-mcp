export interface Formula {
    atomos: Map<string, number>;
    carga: number;
}
export class FormulaInvalida extends Error {
    constructor(readonly formula: string, motivo: string) { super(`${formula}: ${motivo}`); }
}
const SUB = "\u2080\u2081\u2082\u2083\u2084\u2085\u2086\u2087\u2088\u2089", SUP = "\u2070\u00B9\u00B2\u00B3\u2074\u2075\u2076\u2077\u2078\u2079";
function normalizar(f: string): string {
    let s = f.trim().replace(/\s+/g, "");
    s = s.replace(/[₀-₉]/g, c => String(SUB.indexOf(c)));
    const sup = s.match(/([⁰-⁹¹²³]*)([⁺⁻])$/);
    if (sup) {
        const num = [...sup[1]].map(c => String(SUP.indexOf(c))).join("");
        s = s.slice(0, s.length - sup[0].length) + `{${num}${sup[2] === "\u207A" ? "+" : "-"}}`;
    }
    return s;
}
export function parseFormula(entrada: string): Formula {
    const s = normalizar(entrada);
    if (!s)
        throw new FormulaInvalida(entrada, "vac\u00EDa");
    if (s === "e" || s === "e{-}")
        return { atomos: new Map(), carga: -1 };
    let cuerpo = s, carga = 0;
    const mc = s.match(/\{(\d*)([+-])\}$/);
    if (mc) {
        carga = (mc[1] ? Number(mc[1]) : 1) * (mc[2] === "+" ? 1 : -1);
        cuerpo = s.slice(0, s.length - mc[0].length);
    }
    if (/[{}]/.test(cuerpo))
        throw new FormulaInvalida(entrada, "la carga va al final, entre llaves");
    const atomos = new Map<string, number>();
    for (const parte of cuerpo.split(/[·*.]/)) {
        const m = parte.match(/^(\d*)(.*)$/)!;
        if (!m[2])
            throw new FormulaInvalida(entrada, "parte vac\u00EDa");
        sumar(atomos, grupo(m[2], entrada), m[1] ? Number(m[1]) : 1);
    }
    return { atomos, carga };
}
function sumar(a: Map<string, number>, b: Map<string, number>, k: number): void {
    for (const [el, n] of b)
        a.set(el, (a.get(el) ?? 0) + n * k);
}
function grupo(s: string, original: string): Map<string, number> {
    const pila: Map<string, number>[] = [new Map()];
    const cierres: string[] = [];
    let i = 0;
    const numero = (): number => {
        const m = s.slice(i).match(/^\d+/);
        if (!m)
            return 1;
        i += m[0].length;
        const n = Number(m[0]);
        if (n === 0)
            throw new FormulaInvalida(original, "sub\u00EDndice 0");
        return n;
    };
    while (i < s.length) {
        const c = s[i];
        if (c === "(" || c === "[") {
            pila.push(new Map());
            cierres.push(c === "(" ? ")" : "]");
            i++;
            continue;
        }
        if (c === ")" || c === "]") {
            if (cierres.pop() !== c)
                throw new FormulaInvalida(original, "par\u00E9ntesis sin pareja");
            i++;
            const dentro = pila.pop()!;
            sumar(pila[pila.length - 1], dentro, numero());
            continue;
        }
        const m = s.slice(i).match(/^[A-Z][a-z]?/);
        if (!m)
            throw new FormulaInvalida(original, `no entiendo «${s.slice(i, i + 3)}»`);
        i += m[0].length;
        const n = numero();
        const actual = pila[pila.length - 1];
        actual.set(m[0], (actual.get(m[0]) ?? 0) + n);
    }
    if (cierres.length)
        throw new FormulaInvalida(original, "par\u00E9ntesis sin cerrar");
    return pila[0];
}
export function formulaBonita(f: string): string {
    return f.replace(/\{(\d*)([+-])\}$/, (_, n: string, sg: string) => [...n].map(c => SUP[Number(c)]).join("") + (sg === "+" ? "\u207A" : "\u207B"))
        .replace(/(?<=[A-Za-z)\]])\d+/g, d => [...d].map(c => SUB[Number(c)]).join(""));
}
