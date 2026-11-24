import demoraCaptura from "../../public/datos/interes-demora/2026-11-16.json";
import { leerFacturas, type Factura, type MotivoError, type TipoFactura } from "../../src/app/services/cobros/facturas";
import { COSTES_COBRO, interesDemora, loteDemora, type DatosDemora, type Interes } from "../../src/app/services/cobros/demora";
import { TRAMOS, antiguedad, dso, medioCobro, type Tramo } from "../../src/app/services/cobros/antiguedad";
import { diaDe, isoDe } from "../../src/app/shared/dias";
export const DEMORA_FICHERO = "2026-11-16.json";
const DATOS = demoraCaptura as DatosDemora & {
    fuente: string;
    oficial: string;
};
const MOTIVO: Record<MotivoError, string> = {
    columnas: "header: no date column, or neither a total nor a net amount column",
    tipo: "type is neither issued nor received",
    fecha: "invoice date not readable",
    importe: "amount not readable",
};
const COLUMNA: Record<string, string> = {
    tipo: "type",
    numero: "number",
    tercero: "party",
    fecha: "date",
    vencimiento: "due date",
    pago: "payment date",
    recepcion: "delivery date",
    pendiente: "outstanding",
    total: "total",
    base: "net",
    iva: "VAT %",
    retencion: "withholding %",
};
const TRAMO: Record<Tramo, string> = { "al-dia": "not due", "1-30": "1-30", "31-60": "31-60", "61-90": "61-90", "mas-90": "90+" };
const r2 = (n: number) => Math.round(n * 100) / 100;
const tabla = { capturedOn: DATOS.capturado, coversUntil: DATOS.hasta, source: DATOS.fuente };
const tramosEn = (i: Interes) => i.tramos.map((t) => ({ from: t.desde, to: t.hasta, days: t.dias, ratePct: t.tipo, interest: t.interes }));
const supuesto = (dias: number) => (dias > 0 ? [`${dias} day(s) fall after ${DATOS.hasta}, the last half-year whose rate is published in this package: they were computed with the last known rate. Update the package, or check the BOE, for the exact figure.`] : []);
const NOTAS_DEMORA = [
    "Ley 3/2004 (commercial transactions between businesses, and with public administrations): interest accrues automatically from the day after the due date, with no demand needed (art. 5), at the ECB rate + 8 points fixed per calendar half-year (art. 7.2) \u2014 a delay that crosses 1 January or 1 July pays each stretch at its own rate. Days are calendar days over a 365-day year.",
    `Plus a fixed ${COSTES_COBRO} € per overdue invoice for collection costs, without proving them (art. 8.1).`,
    "An estimate, not a claim: the contract may set another rate (never abusive against the creditor, art. 9), and consumers are under different rules.",
];
function lectura(csv: string, tipo: TipoFactura) {
    const l = leerFacturas(csv, tipo);
    if (!l.facturas.length) {
        return { error: l.errores.some((e) => e.motivo === "columnas")
                ? "Could not find the columns: the CSV needs a header with an invoice date and a total (or a net amount, with optional VAT % and withholding %). Due date, payment date, number and customer are recognised by name, in Spanish or English."
                : "No invoice could be read from the CSV." };
    }
    return {
        facturas: l.facturas,
        lectura: {
            invoicesRead: l.facturas.length,
            columnsRecognised: l.columnas.map((c) => COLUMNA[c] ?? c),
            ...(l.sinVencimiento ? { withoutDueDate: `${l.sinVencimiento} invoice(s) had no due date: the legal default of 30 days from the invoice (or delivery) date was used (Ley 3/2004, art. 4.1).` } : {}),
            ...(l.errores.length ? { skippedLines: l.errores.slice(0, 50).map((e) => ({ line: e.linea, reason: MOTIVO[e.motivo] })) } : {}),
        },
    };
}
const facturaEn = (f: Factura) => ({ line: f.linea, ...(f.numero ? { number: f.numero } : {}), ...(f.tercero ? { party: f.tercero } : {}), date: f.fecha, dueDate: f.vencimiento, ...(f.vencimientoSupuesto ? { dueDateAssumed: true } : {}), amount: f.importe });
export interface EntradaDemora {
    amount?: number;
    dueDate?: string;
    until: string;
    invoices?: string;
    includePaid: boolean;
    collectionCosts: boolean;
}
export function demora(e: EntradaDemora) {
    if (diaDe(e.until) === null)
        return { error: `"${e.until}" is not a real date.` };
    if (e.invoices === undefined) {
        if (e.amount === undefined || e.dueDate === undefined)
            return { error: "Give amount and dueDate, or a CSV of invoices." };
        if (diaDe(e.dueDate) === null)
            return { error: `"${e.dueDate}" is not a real date.` };
        const i = interesDemora(e.amount, e.dueDate, e.until, DATOS);
        const costes = e.collectionCosts && i.dias > 0 ? COSTES_COBRO : 0;
        return {
            amount: e.amount,
            dueDate: e.dueDate,
            until: e.until,
            daysLate: i.dias,
            interest: i.interes,
            collectionCosts: costes,
            total: r2(i.interes + costes),
            stretches: tramosEn(i),
            ...(i.dias === 0 ? { note: "Not late on that date: interest starts the day after the due date." } : {}),
            warnings: supuesto(i.diasSupuestos),
            rateTable: tabla,
            notes: NOTAS_DEMORA,
        };
    }
    const l = lectura(e.invoices, "emitida");
    if ("error" in l)
        return l;
    const lote = loteDemora(l.facturas, e.until, DATOS, { incluirPagadas: e.includePaid, costes: e.collectionCosts });
    const dSup = Math.max(0, ...lote.reclamaciones.map((r) => r.interes.diasSupuestos));
    return {
        cutoff: e.until,
        claims: lote.reclamaciones.slice(0, 200).map((r) => ({
            ...facturaEn(r.factura),
            base: r.base,
            status: r.pagada ? `paid late on ${r.factura.pago}` : "outstanding",
            daysLate: r.interes.dias,
            interest: r.interes.interes,
            collectionCosts: r.costes,
            total: r.total,
            stretches: tramosEn(r.interes),
        })),
        ...(lote.reclamaciones.length > 200 ? { truncated: `${lote.reclamaciones.length} claims; the 200 largest are listed. The totals cover all of them.` } : {}),
        totals: { invoices: lote.reclamaciones.length, interest: lote.interes, collectionCosts: lote.costes, total: lote.total },
        reading: l.lectura,
        warnings: supuesto(dSup),
        rateTable: tabla,
        notes: [...NOTAS_DEMORA, `Only issued invoices (receivables) are claimed; ${e.includePaid ? "invoices paid late are included up to their payment date" : "invoices already paid are left out (includePaid: true adds the ones paid late)"}.`],
    };
}
export interface EntradaAging {
    invoices: string;
    cutoff: string;
    dsoDays: number;
}
export function aging(e: EntradaAging) {
    if (diaDe(e.cutoff) === null)
        return { error: `"${e.cutoff}" is not a real date.` };
    const l = lectura(e.invoices, "emitida");
    if ("error" in l)
        return l;
    const emitidas = l.facturas.filter((f) => f.tipo === "emitida");
    if (!emitidas.length)
        return { error: "There are no issued invoices (receivables) in the file: every row is a received one." };
    const a = antiguedad(emitidas, e.cutoff);
    const d = dso(emitidas, e.cutoff, e.dsoDays);
    const desde = isoDe(diaDe(e.cutoff)! - 364);
    const m = medioCobro(emitidas, desde, e.cutoff);
    const porTramo = (x: Record<Tramo, number>) => Object.fromEntries(TRAMOS.map((t) => [TRAMO[t], x[t]]));
    return {
        cutoff: e.cutoff,
        outstanding: a.total,
        overdue: a.vencido,
        byAge: { basis: "days past the DUE date (not the invoice date)", ...porTramo(a.totales) },
        byParty: a.porTercero.slice(0, 50).map((t) => ({ party: t.tercero === "\u2014" ? "(none)" : t.tercero, total: t.total, overdue: t.vencido, invoices: t.facturas, oldestDaysOverdue: Math.max(0, t.maxDias), byAge: porTramo(t.porTramo) })),
        ...(a.porTercero.length > 50 ? { partiesTruncated: `${a.porTercero.length} parties; the 50 to chase first (amount × days overdue) are listed.` } : {}),
        oldestInvoices: a.pendientes.filter((p) => p.diasVencida > 0).slice(0, 20).map((p) => ({ ...facturaEn(p.factura), outstanding: p.pendiente, daysOverdue: p.diasVencida })),
        dso: {
            simple: d.simple === null ? null : r2(d.simple),
            countback: d.countback === null ? null : r2(d.countback),
            periodDays: d.periodo,
            salesInPeriod: d.ventasPeriodo,
            receivables: d.pendiente,
            reading: "Simple DSO = receivables / sales of the period \u00D7 days: it moves with growing or falling sales even if customers pay the same. Countback subtracts each month's sales backwards until the receivables are used up, and is not fooled by seasonality.",
        },
        averageCollection: {
            lastDays: 365,
            invoicesCollected: m.facturas,
            collected: m.cobrado,
            daysFromInvoice: m.dias === null ? null : r2(m.dias),
            daysPastDue: m.retraso === null ? null : r2(m.retraso),
            withinLegalMaximum: { invoices: m.enPlazo.facturas, amount: m.enPlazo.importe, note: "60 calendar days from the invoice or delivery date: the most two businesses can agree (Ley 3/2004, art. 4.3)" },
        },
        ...(a.plazoExcesivo.length ? { termsOverLegalMaximum: { invoices: a.plazoExcesivo.slice(0, 50).map(facturaEn), note: `${a.plazoExcesivo.length} invoice(s) agreed with more than 60 days to pay: not allowed between businesses (Ley 3/2004, art. 4.3), and the excess term is void.` } } : {}),
        reading: l.lectura,
        notes: ["Partial payments count only if the CSV has an outstanding/balance column; otherwise an invoice is all or nothing by its payment date. Received invoices in the file are ignored here (they are payables)."],
    };
}
