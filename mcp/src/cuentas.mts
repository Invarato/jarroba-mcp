import { comprobarTexto, formatear, type Decimal, type EstadoComprobacion } from "../../src/app/services/comprobar-calculo";
const ESTADO: Record<EstadoComprobacion, string> = { ok: "correct", redondeo: "rounded", mal: "wrong", nolei: "unreadable" };
const DECIMAL: Record<Decimal, string> = { coma: "comma", punto: "point" };
export interface EntradaCuentas {
    text: string;
    decimal: "auto" | "comma" | "point";
}
export function cuentas(e: EntradaCuentas) {
    const forzar: Decimal | undefined = e.decimal === "comma" ? "coma" : e.decimal === "point" ? "punto" : undefined;
    const r = comprobarTexto(e.text, "punto", forzar);
    const inicios = [0];
    for (let i = 0; i < e.text.length; i++)
        if (e.text[i] === "\n")
            inicios.push(i + 1);
    const linea = (pos: number) => { let lo = 0, hi = inicios.length - 1; while (lo < hi) {
        const m = (lo + hi + 1) >> 1;
        if (inicios[m] <= pos)
            lo = m;
        else
            hi = m - 1;
    } return lo + 1; };
    const checks = r.comprobaciones.map((c) => ({
        line: linea(c.desde),
        written: `${c.izquierda} ${c.aproximado ? "\u2248" : "="} ${c.derecha}`,
        status: ESTADO[c.estado],
        ...(c.estado === "nolei" ? {} : { leftValue: c.valorIzq, rightValue: c.valorDer, expression: c.expresion }),
        ...(c.estado === "mal" ? { shouldBe: formatear(c.valorIzq, c.decimales, r.decimal) } : {}),
    }));
    const cuenta = (s: EstadoComprobacion) => r.comprobaciones.filter((c) => c.estado === s).length;
    return {
        decimalSeparator: DECIMAL[r.decimal],
        decimalSeparatorChosenBy: forzar ? "given" : "detected from the numbers in the text (point if nothing tells)",
        summary: { checked: checks.length, correct: cuenta("ok"), rounded: cuenta("redondeo"), wrong: cuenta("mal"), unreadable: cuenta("nolei") },
        checks,
        notes: [
            "Only operations written with digits and symbols and an \"=\" or \"\u2248\" are read (12 \u00D7 3.5 = 42, 15 % of 200 = 30, 1,200 + 21 % = 1,452, \u221A16 = 4, 5\u00B2 = 25); sentences in words are not. An empty list does not mean the text is right: it means nothing was written that way.",
            "\"200 + 21 %\" is 242, as on a calculator or an invoice with VAT. \"\u2248\" tolerates 1 %. \"Rounded\" means the exact value, rounded to the decimals written, gives what is written.",
            "Chains (a = b = c) are checked step by step. The evaluator only knows + \u2212 \u00D7 \u00F7, powers, roots and percentages: nothing in the text is executed.",
        ],
    };
}
