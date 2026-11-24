import { diaDe, isoDe } from "../../shared/dias";
import { partirCsv } from "../tesoreria/extracto";
export type TipoFactura = "emitida" | "recibida";
export interface Factura {
    linea: number;
    tipo: TipoFactura;
    numero: string;
    tercero: string;
    fecha: string;
    recepcion?: string;
    vencimiento: string;
    vencimientoSupuesto: boolean;
    pago?: string;
    importe: number;
    pendiente?: number;
}
export type MotivoError = "columnas" | "tipo" | "fecha" | "importe";
export interface LecturaFacturas {
    facturas: Factura[];
    errores: {
        linea: number;
        motivo: MotivoError;
    }[];
    columnas: string[];
    sinVencimiento: number;
}
export const PLAZO_LEGAL_DIAS = 30;
export const PLAZO_MAXIMO_DIAS = 60;
const sinAcentos = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const COLUMNAS = {
    tipo: /^(tipo|type|clase|emitida.?recibida)$/,
    numero: /^(n(umero|º|o|°)?\.?\s*(de\s*)?(factura)?|factura|num\.?\s*factura|invoice\s*(no|number|#|num)?\.?|n\.?\s*doc(umento)?|documento|referencia|ref)$/,
    tercero: /^(tercero|cliente|proveedor|acreedor|deudor|razon social|nombre|contacto|empresa|customer|client|supplier|vendor|contact|name|party)$/,
    vencimiento: /(vencimiento|^vto\.?$|^f\.?\s*vto\.?$|due\s*date|^due$|fecha\s*limite)/,
    pago: /(fecha\s*(de\s*)?(cobro|pago)|cobrad[ao]\s*el|pagad[ao]\s*el|^cobro$|^pago$|paid\s*(on|date)?|payment\s*date|date\s*paid)/,
    recepcion: /(^recepcion$|fecha\s*(de\s*)?(recepcion|entrega|prestacion|servicio|operacion)|delivery\s*date|service\s*date|received\s*(on|date))/,
    pendiente: /^(pendiente|importe pendiente|saldo|saldo pendiente|por cobrar|por pagar|amount due|balance|outstanding|due amount)$/,
    total: /^(total|importe|importe total|total factura|total \(?eur\)?|amount|total amount|gross|importe \(?eur\)?)$/,
    base: /^(base|base imponible|subtotal|net|net amount)$/,
    iva: /^(iva|% ?iva|tipo iva|iva ?%|vat ?%|vat rate)$/,
    retencion: /^(retencion|retencion ?%|% ?retencion|% ?irpf|irpf ?%|withholding ?%)$/,
    fecha: /(fecha|date|emision|issued)/,
};
type Columna = keyof typeof COLUMNAS;
export function leerFecha(t: string): string | null {
    const s = (t ?? "").trim().replace(/^"|"$/g, "");
    if (!s)
        return null;
    let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
    let a: number, mes: number, d: number;
    if (m)
        [a, mes, d] = [+m[1], +m[2], +m[3]];
    else if ((m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})\b/.exec(s)))
        [d, mes, a] = [+m[1], +m[2], m[3].length === 2 ? 2000 + +m[3] : +m[3]];
    else
        return null;
    const iso = `${a}-${String(mes).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    return diaDe(iso) === null ? null : iso;
}
export function leerImporteFactura(t: string): number | null {
    let s = (t ?? "").trim().replace(/^"|"$/g, "").replace(/\s|€|eur$/gi, "");
    if (!s)
        return null;
    let neg = false;
    if (/^\(.*\)$/.test(s)) {
        neg = true;
        s = s.slice(1, -1);
    }
    if (s.startsWith("-")) {
        neg = !neg;
        s = s.slice(1);
    }
    const ult = Math.max(s.lastIndexOf(","), s.lastIndexOf("."));
    if (ult >= 0 && /^\d{1,2}$/.test(s.slice(ult + 1)))
        s = s.slice(0, ult).replace(/[.,]/g, "") + "." + s.slice(ult + 1);
    else
        s = s.replace(/[.,]/g, "");
    if (!/^\d+(\.\d+)?$/.test(s))
        return null;
    const n = Number(s);
    return neg ? -n : n;
}
const ES_EMITIDA = /^(emitid|ingreso|venta|cliente|income|sale|issued|invoice|receivable|e$)/;
const ES_RECIBIDA = /^(recibid|gasto|compra|proveedor|expense|purchase|bill|received|payable|r$)/;
export function leerFacturas(texto: string, tipoPorDefecto: TipoFactura = "emitida", plazoLegal = PLAZO_LEGAL_DIAS): LecturaFacturas {
    const res: LecturaFacturas = { facturas: [], errores: [], columnas: [], sinVencimiento: 0 };
    const lineas = (texto ?? "").replace(/^﻿/, "").split(/\r?\n/).map((l, i) => ({ l, i: i + 1 })).filter((x) => x.l.trim());
    if (lineas.length < 2)
        return res;
    const primera = lineas[0].l;
    const sep = primera.includes("\t") ? "\t" : (primera.split(";").length > primera.split(",").length ? ";" : ",");
    const cab = partirCsv(primera, sep).map((h) => sinAcentos(h.replace(/^"|"$/g, "")));
    const col: Partial<Record<Columna, number>> = {};
    const usada = new Set<number>();
    for (const k of Object.keys(COLUMNAS) as Columna[]) {
        const i = cab.findIndex((h, j) => !usada.has(j) && COLUMNAS[k].test(h));
        if (i >= 0) {
            col[k] = i;
            usada.add(i);
        }
    }
    res.columnas = (Object.keys(col) as Columna[]);
    if (col.fecha === undefined || (col.total === undefined && col.base === undefined)) {
        res.errores.push({ linea: lineas[0].i, motivo: "columnas" });
        return res;
    }
    for (const { l, i } of lineas.slice(1)) {
        const c = partirCsv(l, sep);
        const get = (k: Columna) => (col[k] !== undefined ? (c[col[k]!] ?? "").replace(/^"|"$/g, "").trim() : "");
        let tipo: TipoFactura = tipoPorDefecto;
        if (col.tipo !== undefined) {
            const t = sinAcentos(get("tipo"));
            if (ES_EMITIDA.test(t))
                tipo = "emitida";
            else if (ES_RECIBIDA.test(t))
                tipo = "recibida";
            else {
                res.errores.push({ linea: i, motivo: "tipo" });
                continue;
            }
        }
        const fecha = leerFecha(get("fecha"));
        if (!fecha) {
            res.errores.push({ linea: i, motivo: "fecha" });
            continue;
        }
        let importe: number | null;
        if (col.total !== undefined && get("total"))
            importe = leerImporteFactura(get("total"));
        else {
            const base = leerImporteFactura(get("base"));
            const iva = get("iva") ? leerImporteFactura(get("iva").replace("%", "")) : 0;
            const ret = get("retencion") ? leerImporteFactura(get("retencion").replace("%", "")) : 0;
            importe = base === null || iva === null || ret === null ? null : Math.round(base * (1 + iva / 100 - ret / 100) * 100) / 100;
        }
        if (importe === null || !Number.isFinite(importe)) {
            res.errores.push({ linea: i, motivo: "importe" });
            continue;
        }
        const recepcion = leerFecha(get("recepcion")) ?? undefined;
        const pago = leerFecha(get("pago")) ?? undefined;
        let vencimiento = leerFecha(get("vencimiento"));
        const vencimientoSupuesto = !vencimiento;
        if (!vencimiento) {
            vencimiento = isoDe(diaDe(recepcion ?? fecha)! + plazoLegal);
            res.sinVencimiento++;
        }
        const pend = get("pendiente") ? leerImporteFactura(get("pendiente")) : null;
        res.facturas.push({
            linea: i,
            tipo,
            numero: get("numero"),
            tercero: get("tercero"),
            fecha,
            ...(recepcion ? { recepcion } : {}),
            vencimiento,
            vencimientoSupuesto,
            ...(pago ? { pago } : {}),
            importe,
            ...(pend !== null && Number.isFinite(pend) ? { pendiente: pend } : {}),
        });
    }
    return res;
}
export function dias(a: string, b: string): number {
    return diaDe(b)! - diaDe(a)!;
}
export function pendienteEn(f: Factura, corte: string): number {
    if (f.fecha > corte)
        return 0;
    if (f.pago && f.pago <= corte)
        return 0;
    if (f.pendiente !== undefined && !f.pago)
        return f.pendiente;
    return f.importe;
}
