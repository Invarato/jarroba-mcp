import { MathMin } from "./calc-eval.service";
type Math = MathMin & {
    fraction(x: unknown): unknown;
    isUnit(x: unknown): boolean;
};
export type Notacion = "auto" | "fijo" | "sig" | "ingenieria" | "exponencial" | "fraccion";
export interface FormatoOpts {
    notacion?: Notacion;
    digitos?: number;
}
export const NOTACION_POR_DEFECTO: Notacion = "auto";
export const DIGITOS_POR_DEFECTO = 14;
const AUTO_EXP_BAJO = -9;
const AUTO_EXP_ALTO = 15;
export function formatear(math: Math, valor: unknown, opts: FormatoOpts = {}): string {
    const notacion = opts.notacion ?? NOTACION_POR_DEFECTO;
    const digitos = acotaDigitos(opts.digitos);
    try {
        if (notacion === "fraccion")
            return comoFraccion(math, valor, digitos);
        return math.format(valor, opcionesMathjs(notacion, digitos) as {
            precision?: number;
        });
    }
    catch {
        try {
            return String(valor);
        }
        catch {
            return "";
        }
    }
}
function acotaDigitos(d: number | undefined): number {
    const n = Math.round(Number(d ?? DIGITOS_POR_DEFECTO));
    if (!Number.isFinite(n))
        return DIGITOS_POR_DEFECTO;
    return Math.max(0, Math.min(21, n));
}
function opcionesMathjs(notacion: Notacion, digitos: number): Record<string, unknown> {
    switch (notacion) {
        case "fijo": return { notation: "fixed", precision: digitos };
        case "sig": return { precision: digitos, lowerExp: AUTO_EXP_BAJO, upperExp: AUTO_EXP_ALTO };
        case "ingenieria": return { notation: "engineering", precision: digitos };
        case "exponencial": return { notation: "exponential", precision: digitos };
        case "auto":
        default: return { precision: digitos, lowerExp: AUTO_EXP_BAJO, upperExp: AUTO_EXP_ALTO };
    }
}
function comoFraccion(math: Math, valor: unknown, digitos: number): string {
    if (typeof valor !== "number" || !Number.isFinite(valor)) {
        return math.format(valor, opcionesMathjs("auto", digitos) as {
            precision?: number;
        });
    }
    const f = math.fraction(valor) as {
        n?: number;
        d?: number;
        s?: number;
    };
    const n = Number(f?.n), d = Number(f?.d), signo = Number(f?.s ?? 1);
    const exacta = Number.isFinite(n) && Number.isFinite(d) && d !== 0 && (signo * n) / d === valor;
    if (!exacta)
        return math.format(valor, opcionesMathjs("auto", digitos) as {
            precision?: number;
        });
    if (d === 1)
        return String(signo * n);
    return math.format(f, { fraction: "ratio" } as {
        precision?: number;
    });
}
export const NOTACIONES: readonly Notacion[] = ["auto", "fijo", "sig", "ingenieria", "exponencial", "fraccion"];
export class CalcFormatService {
    formatear = formatear;
}
