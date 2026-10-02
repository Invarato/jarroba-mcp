import { MathMin, ModoSimbolos, Rareza, Veredicto, cribar, clasificar, freeVars, simbolosUnidad, funcionTapaUnidad, normalizaAlias, } from "./calc-eval.service";
import { formatear as formateaValor, FormatoOpts } from "./calc-format.service";
import { esFecha, prepararFechas } from "./calc-fechas.service";
type Math = MathMin & {
    parser(): Parser;
    Unit: {
        isValuelessUnit(n: string): boolean;
    };
    isUnit(x: unknown): boolean;
    unit(s: string): unknown;
    fraction(x: unknown): unknown;
};
interface Parser {
    evaluate(expr: string): unknown;
    get(nombre: string): unknown;
    set(nombre: string, valor: unknown): void;
    getAll(): Record<string, unknown>;
}
export interface LineaHoja {
    tipo: "vacia" | "comentario" | "valor" | "asignacion" | "error";
    texto: string;
    valor?: unknown;
    nombre?: string;
    mensaje?: string;
    fallo?: "cota" | "sintaxis" | "funcion-unidad";
    tapada?: {
        simbolo: string;
        alternativa?: string;
    };
    cota?: Veredicto;
    rareza?: Rareza;
    aviso?: "unidad-tapada";
    simbolo?: string;
}
export interface HojaOpts {
    modo?: ModoSimbolos;
    formato?: FormatoOpts;
    precision?: number;
    maxLineas?: number;
    fechas?: boolean;
    formatoFecha?: (dia: number) => string;
    formatoDias?: (n: number, tipo: "day" | "workday") => string;
}
export const MAX_LINEAS = 5000;
const esVacia = (l: string) => l.trim() === "";
const esComentario = (l: string) => l.trim().startsWith("#");
function nombreAsignado(linea: string): string | null {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=(?!=)/.exec(linea);
    return m ? m[1] : null;
}
export function evaluarHoja(math: Math, texto: string, opts: HojaOpts = {}): LineaHoja[] {
    const formato: FormatoOpts = opts.formato ?? (opts.precision !== undefined ? { digitos: opts.precision } : {});
    const tope = Math.min(opts.maxLineas ?? MAX_LINEAS, MAX_LINEAS);
    const lineas = (texto ?? "").split("\n");
    const out: LineaHoja[] = [];
    let parser: Parser | null = null;
    try {
        parser = math.parser();
    }
    catch {
        parser = null;
    }
    for (let i = 0; i < lineas.length; i++) {
        const linea = opts.fechas ? prepararFechas(lineas[i]) : lineas[i];
        if (i >= tope) {
            out.push({ tipo: "vacia", texto: "" });
            continue;
        }
        if (esVacia(linea)) {
            out.push({ tipo: "vacia", texto: "" });
            continue;
        }
        if (esComentario(linea)) {
            out.push({ tipo: "comentario", texto: "" });
            continue;
        }
        const nombre = nombreAsignado(linea);
        const esAsignacion = nombre !== null;
        const aviso = avisoUnidadTapada(math, nombre);
        const v = cribar(math, linea);
        if (!v.ok) {
            out.push({ tipo: "error", texto: "", fallo: "cota", cota: v, nombre: nombre ?? undefined, ...aviso });
            continue;
        }
        if (!parser) {
            out.push({ tipo: "error", texto: "", fallo: "sintaxis", mensaje: "no parser" });
            continue;
        }
        const guardado = esAsignacion ? null : protegeUnidades(math, parser, linea);
        try {
            const valor = parser.evaluate(normalizaAlias(math, linea));
            if (valor === undefined) {
                restaura(parser, guardado);
                out.push({ tipo: "comentario", texto: "", ...aviso });
                continue;
            }
            restaura(parser, guardado);
            try {
                parser.set("ans", valor);
            }
            catch { }
            const rareza = clasificar(math, valor) ?? undefined;
            out.push({
                tipo: nombre ? "asignacion" : "valor",
                texto: esFecha(valor) ? (opts.formatoFecha?.(valor.dia) ?? valor.toString())
                    : (diasSueltos(math, valor, opts.formatoDias) ?? formatear(math, valor, formato)),
                valor,
                nombre: nombre ?? undefined,
                rareza,
                ...aviso,
            });
        }
        catch (e: unknown) {
            restaura(parser, guardado);
            let ambito: Record<string, unknown> = {};
            try {
                ambito = (parser as unknown as {
                    getAll?(): Record<string, unknown>;
                }).getAll?.() ?? {};
            }
            catch { }
            const tapada = funcionTapaUnidad(math, linea, ambito);
            out.push({
                tipo: "error",
                texto: "",
                fallo: tapada ? "funcion-unidad" : "sintaxis",
                ...(tapada ? { tapada } : { mensaje: e instanceof Error ? e.message : String(e) }),
                nombre: nombre ?? undefined,
                ...aviso,
            });
        }
    }
    return out;
}
export interface Moneda {
    codigo: string;
    tasa?: number;
    base?: string;
}
const RE_MONEDA = /^\s*#\s*@moneda\s+([A-Za-z][A-Za-z0-9_]*)\s*(?:=\s*([0-9]*\.?[0-9]+)\s+([A-Za-z][A-Za-z0-9_]*)\s*)?$/;
export function monedasDeHoja(texto: string): Moneda[] {
    const out: Moneda[] = [];
    for (const l of (texto ?? "").split("\n")) {
        const m = RE_MONEDA.exec(l);
        if (!m)
            continue;
        if (m[2] && m[3])
            out.push({ codigo: m[1], tasa: Number(m[2]), base: m[3] });
        else
            out.push({ codigo: m[1] });
    }
    return out;
}
export function firmaMonedas(monedas: readonly Moneda[]): string {
    return monedas.map(m => `${m.codigo}=${m.tasa ?? ""}${m.base ?? ""}`).join("|");
}
export type MotivoMoneda = "repetida-distinta" | "nombre-ocupado" | "base-desconocida";
export interface MonedaFallida {
    codigo: string;
    motivo: MotivoMoneda;
}
export function registraMonedas(math: Math, monedas: readonly Moneda[]): MonedaFallida[] {
    const fallidas: MonedaFallida[] = [];
    const crear = (math as unknown as {
        createUnit(n: string, def?: string): unknown;
    }).createUnit;
    if (typeof crear !== "function")
        return monedas.map(m => ({ codigo: m.codigo, motivo: "nombre-ocupado" as const }));
    const vistas = new Map<string, string>();
    const efectivas: Moneda[] = [];
    for (const m of monedas) {
        const def = `${m.tasa ?? ""}|${m.base ?? ""}`;
        const previa = vistas.get(m.codigo);
        if (previa === undefined) {
            vistas.set(m.codigo, def);
            efectivas.push(m);
            continue;
        }
        if (previa !== def)
            fallidas.push({ codigo: m.codigo, motivo: "repetida-distinta" });
    }
    const declaradas = new Set(efectivas.map(m => m.codigo));
    for (const paso of [0, 1]) {
        for (const m of efectivas) {
            const esBase = m.tasa === undefined;
            if ((paso === 0) !== esBase)
                continue;
            if (!esBase && m.base && !declaradas.has(m.base) && !conoce(math, m.base)) {
                fallidas.push({ codigo: m.codigo, motivo: "base-desconocida" });
                continue;
            }
            try {
                if (esBase)
                    crear.call(math, m.codigo);
                else
                    crear.call(math, m.codigo, `${m.tasa} ${m.base}`);
            }
            catch {
                fallidas.push({ codigo: m.codigo, motivo: "nombre-ocupado" });
            }
        }
    }
    return fallidas;
}
function conoce(math: Math, nombre: string): boolean {
    try {
        return !!(math as unknown as {
            Unit: {
                isValuelessUnit(n: string): boolean;
            };
        }).Unit.isValuelessUnit(nombre);
    }
    catch {
        return false;
    }
}
function protegeUnidades(math: Math, parser: Parser, linea: string): Map<string, unknown> | null {
    let todas: Record<string, unknown>;
    try {
        todas = parser.getAll();
    }
    catch {
        return null;
    }
    let copia: Map<string, unknown> | null = null;
    for (const nombre of Object.keys(todas)) {
        if (!new RegExp(`\\b${nombre}\\b`).test(linea))
            continue;
        const v = todas[nombre];
        try {
            if (!math.isUnit(v))
                continue;
            const texto = (v as {
                toString(): string;
            }).toString();
            (copia ??= new Map()).set(nombre, math.unit(texto));
        }
        catch { }
    }
    return copia;
}
function restaura(parser: Parser, guardado: Map<string, unknown> | null): void {
    if (!guardado)
        return;
    for (const [nombre, valor] of guardado) {
        try {
            parser.set(nombre, valor);
        }
        catch { }
    }
}
function avisoUnidadTapada(math: Math, nombre: string | null): {
    aviso?: "unidad-tapada";
    simbolo?: string;
} {
    if (!nombre)
        return {};
    try {
        if (math.Unit.isValuelessUnit(nombre))
            return { aviso: "unidad-tapada", simbolo: nombre };
    }
    catch { }
    return {};
}
function diasSueltos(math: Math, valor: unknown, f: HojaOpts["formatoDias"]): string | null {
    if (!f || !math.isUnit(valor))
        return null;
    const u = valor as {
        units?: {
            unit: {
                name: string;
            };
            power: number;
        }[];
        toNumber(n: string): number;
    };
    if (u.units?.length !== 1 || u.units[0].power !== 1)
        return null;
    const nombre = u.units[0].unit.name;
    const tipo = nombre === "day" || nombre === "days" ? "day" : nombre === "workday" ? "workday" : null;
    if (!tipo)
        return null;
    const n = u.toNumber(nombre);
    return Number.isInteger(n) ? f(n, tipo) : null;
}
function formatear(math: Math, valor: unknown, formato: FormatoOpts): string {
    return formateaValor(math, valor, formato);
}
export function variablesDeHoja(resultados: readonly LineaHoja[]): string[] {
    const out: string[] = [];
    for (const r of resultados)
        if (r.nombre && !out.includes(r.nombre))
            out.push(r.nombre);
    return out;
}
export interface ResumenHoja {
    valores: number;
    errores: number;
    avisos: number;
}
export function resumirHoja(resultados: readonly LineaHoja[]): ResumenHoja {
    let valores = 0, errores = 0, avisos = 0;
    for (const r of resultados) {
        if (r.tipo === "valor" || r.tipo === "asignacion")
            valores++;
        if (r.tipo === "error")
            errores++;
        if (r.aviso)
            avisos++;
    }
    return { valores, errores, avisos };
}
export function hojaAMarkdown(texto: string, resultados: readonly LineaHoja[]): string {
    const lineas = (texto ?? "").split("\n");
    const out: string[] = [];
    let enTabla = false;
    const cerrar = () => { if (enTabla) {
        out.push("");
        enTabla = false;
    } };
    for (let i = 0; i < lineas.length; i++) {
        const l = lineas[i], r = resultados[i];
        if (!r || r.tipo === "vacia") {
            cerrar();
            continue;
        }
        if (r.tipo === "comentario") {
            cerrar();
            out.push(l.trim().replace(/^#+\s*/, "**") + "**");
            continue;
        }
        if (!enTabla) {
            out.push("| | |", "|---|---:|");
            enTabla = true;
        }
        const celda = (s: string) => s.replace(/\|/g, "\\|").trim();
        out.push(`| \`${celda(l)}\` | ${r.tipo === "error" ? "\u26A0" : celda(r.texto)} |`);
    }
    return out.join("\n");
}
export class CalcSheetService {
    evaluarHoja = evaluarHoja;
    variablesDeHoja = variablesDeHoja;
    resumirHoja = resumirHoja;
    hojaAMarkdown = hojaAMarkdown;
}
export { freeVars, simbolosUnidad };
export type { ModoSimbolos, Rareza };
