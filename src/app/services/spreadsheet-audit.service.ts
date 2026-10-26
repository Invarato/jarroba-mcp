import * as XLSX from "xlsx";
import FormulaParser, { FormulaError } from "fast-formula-parser";
import { PARCHES_SPREADSHEET_AUDIT } from "./spreadsheet-audit-patches";
export type EstadoCelda = "ok" | "divergencia" | "ciclo" | "no-soportada" | "error";
export interface CeldaAuditada {
    hoja: string;
    direccion: string;
    formula: string;
    valorGuardado: string | number | boolean | null;
    valorRecalculado: string | number | boolean | null;
    estado: EstadoCelda;
    detalle?: string;
}
export interface ResumenAuditoria {
    hojas: string[];
    totalFormulas: number;
    celdas: CeldaAuditada[];
    truncado: boolean;
    dependencias: Map<string, Set<string>>;
    ciclos: string[][];
}
export interface NodoGrafo {
    clave: string;
    hoja: string;
    direccion: string;
    etiqueta: string;
}
export interface AristaGrafo {
    de: string;
    a: string;
}
export interface GrafoDependencias {
    nodos: NodoGrafo[];
    aristas: AristaGrafo[];
    enCiclo: Set<string>;
}
export const LIMITE_FORMULAS = 20000;
const ERRORES_EXCEL: Record<string, FormulaError> = {
    "#NULL!": FormulaError.NULL,
    "#DIV/0!": FormulaError.DIV0,
    "#VALUE!": FormulaError.VALUE,
    "#REF!": FormulaError.REF,
    "#NAME?": FormulaError.NAME,
    "#NUM!": FormulaError.NUM,
    "#N/A": FormulaError.NA,
};
type ValorPlano = string | number | boolean | null;
export function normalizar(v: unknown): ValorPlano {
    if (v instanceof FormulaError)
        return v.error;
    if (v === null || v === undefined)
        return null;
    if (typeof v === "number" || typeof v === "string" || typeof v === "boolean")
        return v;
    if (Array.isArray(v))
        return normalizar((v as unknown[][])[0]?.[0]);
    return String(v);
}
export function equivalentes(a: ValorPlano, b: ValorPlano): boolean {
    if (typeof a === "number" && typeof b === "number") {
        if (Number.isNaN(a) && Number.isNaN(b))
            return true;
        return Math.abs(a - b) <= Math.max(1e-9, Math.abs(a) * 1e-9);
    }
    return a === b;
}
function valorLiteral(cell: XLSX.CellObject | undefined): ValorPlano | FormulaError {
    if (!cell || cell.t === "z")
        return null;
    if (cell.t === "e")
        return ERRORES_EXCEL[cell.w ?? ""] ?? FormulaError.VALUE;
    if (cell.t === "n" || cell.t === "b")
        return cell.v as number | boolean;
    if (cell.t === "d")
        return cell.v instanceof Date ? cell.v.getTime() : (cell.v as number);
    return (cell.v as string) ?? null;
}
export function auditarWorkbook(wb: XLSX.WorkBook): ResumenAuditoria {
    const rangos = new Map<string, XLSX.Range>();
    for (const hoja of wb.SheetNames) {
        const ref = wb.Sheets[hoja]["!ref"];
        rangos.set(hoja, ref ? XLSX.utils.decode_range(ref) : { s: { r: 0, c: 0 }, e: { r: 0, c: 0 } });
    }
    const resueltas = new Map<string, ValorPlano | FormulaError>();
    const pilaEnCurso: string[] = [];
    const enCiclo = new Set<string>();
    const ciclosDetectados: string[][] = [];
    const dependeDe = new Map<string, Set<string>>();
    const noSoportada = new Map<string, string>();
    const erroresGenerales = new Map<string, string>();
    const clave = (hoja: string, addr: string) => `${hoja}!${addr}`;
    const parser = new FormulaParser({
        functions: PARCHES_SPREADSHEET_AUDIT,
        onCell: ({ sheet, row, col }) => {
            const v = valorDe(sheet, row, col);
            return v instanceof FormulaError ? v : v;
        },
        onRange: ({ sheet, from, to }) => {
            const r = rangos.get(sheet);
            const finR = r ? Math.min(to.row, r.e.r + 1) : to.row;
            const finC = r ? Math.min(to.col, r.e.c + 1) : to.col;
            const out: (ValorPlano | FormulaError)[][] = [];
            for (let row = from.row; row <= finR; row++) {
                const fila: (ValorPlano | FormulaError)[] = [];
                for (let col = from.col; col <= finC; col++)
                    fila.push(valorDe(sheet, row, col));
                out.push(fila);
            }
            return out;
        },
    });
    function valorDe(hoja: string, row: number, col: number): ValorPlano | FormulaError {
        const addr = XLSX.utils.encode_cell({ r: row - 1, c: col - 1 });
        const k = clave(hoja, addr);
        const solicitante = pilaEnCurso[pilaEnCurso.length - 1];
        if (solicitante !== undefined && solicitante !== k) {
            let s = dependeDe.get(solicitante);
            if (!s)
                dependeDe.set(solicitante, s = new Set());
            s.add(k);
        }
        if (resueltas.has(k))
            return resueltas.get(k)!;
        const i = pilaEnCurso.indexOf(k);
        if (i !== -1) {
            const anillo = pilaEnCurso.slice(i);
            for (const c of anillo)
                enCiclo.add(c);
            ciclosDetectados.push(anillo);
            return 0;
        }
        const ws = wb.Sheets[hoja];
        const cell = ws ? (ws[addr] as XLSX.CellObject | undefined) : undefined;
        if (!cell?.f) {
            const v = valorLiteral(cell);
            resueltas.set(k, v);
            return v;
        }
        pilaEnCurso.push(k);
        let resultado: ValorPlano | FormulaError;
        try {
            const r = parser.parse(cell.f, { row, col, sheet: hoja });
            resultado = r instanceof FormulaError ? r : normalizar(r);
        }
        catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            const m = /Function (\w+(?:\.\w+)?) is not implemented/i.exec(msg);
            if (m) {
                noSoportada.set(k, m[1]);
                resultado = null;
            }
            else if (e instanceof FormulaError) {
                resultado = e;
            }
            else {
                erroresGenerales.set(k, msg);
                resultado = null;
            }
        }
        finally {
            pilaEnCurso.pop();
        }
        resueltas.set(k, resultado);
        return resultado;
    }
    const objetivos: {
        hoja: string;
        row: number;
        col: number;
        direccion: string;
        cell: XLSX.CellObject;
    }[] = [];
    for (const hoja of wb.SheetNames) {
        const ws = wb.Sheets[hoja];
        for (const addr of Object.keys(ws)) {
            if (addr.startsWith("!"))
                continue;
            const cell = ws[addr] as XLSX.CellObject;
            if (!cell?.f)
                continue;
            const { r, c } = XLSX.utils.decode_cell(addr);
            objetivos.push({ hoja, row: r + 1, col: c + 1, direccion: addr, cell });
            if (objetivos.length >= LIMITE_FORMULAS)
                break;
        }
        if (objetivos.length >= LIMITE_FORMULAS)
            break;
    }
    const truncado = objetivos.length >= LIMITE_FORMULAS;
    const celdas: CeldaAuditada[] = objetivos.map(({ hoja, row, col, direccion, cell }) => {
        const k = clave(hoja, direccion);
        const guardado = normalizar(valorLiteral(cell));
        const recalculado = valorDe(hoja, row, col);
        let estado: EstadoCelda = "ok";
        let detalle: string | undefined;
        if (noSoportada.has(k)) {
            estado = "no-soportada";
            detalle = noSoportada.get(k);
        }
        else if (erroresGenerales.has(k)) {
            estado = "error";
            detalle = erroresGenerales.get(k);
        }
        else if (enCiclo.has(k)) {
            estado = "ciclo";
        }
        else if (!equivalentes(guardado, normalizar(recalculado))) {
            estado = "divergencia";
        }
        return {
            hoja,
            direccion,
            formula: cell.f!,
            valorGuardado: guardado,
            valorRecalculado: estado === "no-soportada" || estado === "error" ? null : normalizar(recalculado),
            estado,
            detalle,
        };
    });
    return {
        hojas: wb.SheetNames,
        totalFormulas: celdas.length,
        celdas,
        truncado,
        dependencias: dependeDe,
        ciclos: ciclosDetectados,
    };
}
export function grafoDeHallazgo(claveCelda: string, resumen: ResumenAuditoria, profundidad = 2): GrafoDependencias {
    const anillo = resumen.ciclos.find(c => c.includes(claveCelda));
    const nodos = new Set<string>();
    const aristas: AristaGrafo[] = [];
    const clavesAristas = new Set<string>();
    const anadeArista = (de: string, a: string) => {
        const k = `${de}→${a}`;
        if (clavesAristas.has(k))
            return;
        clavesAristas.add(k);
        aristas.push({ de, a });
    };
    if (anillo) {
        for (const c of anillo)
            nodos.add(c);
        for (let i = 0; i < anillo.length; i++) {
            anadeArista(anillo[i], anillo[(i + 1) % anillo.length]);
        }
    }
    else {
        const dependeQueDeEsta = new Map<string, Set<string>>();
        for (const [de, as] of resumen.dependencias) {
            for (const a of as) {
                let s = dependeQueDeEsta.get(a);
                if (!s)
                    dependeQueDeEsta.set(a, s = new Set());
                s.add(de);
            }
        }
        nodos.add(claveCelda);
        let frontera = [claveCelda];
        for (let nivel = 0; nivel < profundidad && frontera.length; nivel++) {
            const siguiente: string[] = [];
            for (const k of frontera) {
                for (const dep of resumen.dependencias.get(k) ?? []) {
                    anadeArista(k, dep);
                    if (!nodos.has(dep)) {
                        nodos.add(dep);
                        siguiente.push(dep);
                    }
                }
            }
            frontera = siguiente;
        }
        frontera = [claveCelda];
        for (let nivel = 0; nivel < profundidad && frontera.length; nivel++) {
            const siguiente: string[] = [];
            for (const k of frontera) {
                for (const dep of dependeQueDeEsta.get(k) ?? []) {
                    anadeArista(dep, k);
                    if (!nodos.has(dep)) {
                        nodos.add(dep);
                        siguiente.push(dep);
                    }
                }
            }
            frontera = siguiente;
        }
    }
    const nodosGrafo: NodoGrafo[] = [...nodos].map(k => {
        const i = k.indexOf("!");
        const hoja = i === -1 ? "" : k.slice(0, i);
        const direccion = i === -1 ? k : k.slice(i + 1);
        return { clave: k, hoja, direccion, etiqueta: direccion };
    });
    return { nodos: nodosGrafo, aristas, enCiclo: anillo ? new Set(anillo) : new Set() };
}
export function pareceHojaDeCalculo(datos: ArrayBuffer): boolean {
    const b = new Uint8Array(datos, 0, Math.min(8, datos.byteLength));
    const zip = b[0] === 80 && b[1] === 75 && (b[2] === 3 || b[2] === 5 || b[2] === 7);
    const ole2 = b[0] === 208 && b[1] === 207 && b[2] === 17 && b[3] === 224 && b[4] === 161 && b[5] === 177 && b[6] === 26 && b[7] === 225;
    return zip || ole2;
}
export function auditarArchivo(datos: ArrayBuffer): ResumenAuditoria | null {
    if (!pareceHojaDeCalculo(datos))
        return null;
    try {
        const wb = XLSX.read(datos, { type: "array", cellFormula: true });
        return auditarWorkbook(wb);
    }
    catch {
        return null;
    }
}
