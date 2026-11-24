import { diaDe, isoDe } from "../../shared/dias";
import { Factura, PLAZO_MAXIMO_DIAS, dias, pendienteEn } from "./facturas";
export type Tramo = "al-dia" | "1-30" | "31-60" | "61-90" | "mas-90";
export const TRAMOS: Tramo[] = ["al-dia", "1-30", "31-60", "61-90", "mas-90"];
export function tramoDe(diasVencida: number): Tramo {
    if (diasVencida <= 0)
        return "al-dia";
    if (diasVencida <= 30)
        return "1-30";
    if (diasVencida <= 60)
        return "31-60";
    if (diasVencida <= 90)
        return "61-90";
    return "mas-90";
}
export interface FacturaPendiente {
    factura: Factura;
    pendiente: number;
    diasVencida: number;
    tramo: Tramo;
}
export interface DeudaTercero {
    tercero: string;
    porTramo: Record<Tramo, number>;
    total: number;
    vencido: number;
    facturas: number;
    prioridad: number;
    maxDias: number;
}
export interface Antiguedad {
    corte: string;
    pendientes: FacturaPendiente[];
    porTercero: DeudaTercero[];
    totales: Record<Tramo, number>;
    total: number;
    vencido: number;
    plazoExcesivo: Factura[];
}
const ceros = (): Record<Tramo, number> => ({ "al-dia": 0, "1-30": 0, "31-60": 0, "61-90": 0, "mas-90": 0 });
const r2 = (n: number) => Math.round(n * 100) / 100;
export function antiguedad(facturas: Factura[], corte: string): Antiguedad {
    const pendientes: FacturaPendiente[] = [];
    for (const f of facturas) {
        const p = pendienteEn(f, corte);
        if (p <= 0)
            continue;
        const d = dias(f.vencimiento, corte);
        pendientes.push({ factura: f, pendiente: p, diasVencida: d, tramo: tramoDe(d) });
    }
    pendientes.sort((a, b) => b.diasVencida - a.diasVencida || b.pendiente - a.pendiente);
    const mapa = new Map<string, DeudaTercero>();
    const totales = ceros();
    for (const p of pendientes) {
        const k = p.factura.tercero || "\u2014";
        const t = mapa.get(k) ?? { tercero: k, porTramo: ceros(), total: 0, vencido: 0, facturas: 0, prioridad: 0, maxDias: 0 };
        t.porTramo[p.tramo] = r2(t.porTramo[p.tramo] + p.pendiente);
        t.total = r2(t.total + p.pendiente);
        if (p.diasVencida > 0) {
            t.vencido = r2(t.vencido + p.pendiente);
            t.prioridad += p.pendiente * p.diasVencida;
        }
        t.maxDias = Math.max(t.maxDias, p.diasVencida);
        t.facturas++;
        mapa.set(k, t);
        totales[p.tramo] = r2(totales[p.tramo] + p.pendiente);
    }
    const porTercero = [...mapa.values()].sort((a, b) => b.prioridad - a.prioridad || b.total - a.total);
    const total = r2(TRAMOS.reduce((s, k) => s + totales[k], 0));
    const plazoExcesivo = facturas.filter((f) => !f.vencimientoSupuesto && dias(f.recepcion ?? f.fecha, f.vencimiento) > PLAZO_MAXIMO_DIAS);
    return { corte, pendientes, porTercero, totales, total, vencido: r2(total - totales["al-dia"]), plazoExcesivo };
}
export interface Dso {
    pendiente: number;
    simple: number | null;
    periodo: number;
    ventasPeriodo: number;
    countback: number | null;
}
function mesDe(dia: number): {
    ini: number;
    fin: number;
} {
    const d = new Date(dia * 86400000);
    const ini = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) / 86400000;
    const fin = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0) / 86400000;
    return { ini, fin };
}
export function dso(facturas: Factura[], corte: string, periodo = 90): Dso {
    const emitidas = facturas.filter((f) => f.tipo === "emitida");
    const pendiente = r2(emitidas.reduce((s, f) => s + pendienteEn(f, corte), 0));
    const c = diaDe(corte)!;
    const desde = isoDe(c - periodo + 1);
    const ventasPeriodo = r2(emitidas.filter((f) => f.fecha >= desde && f.fecha <= corte).reduce((s, f) => s + f.importe, 0));
    const simple = ventasPeriodo > 0 ? (pendiente / ventasPeriodo) * periodo : null;
    let resto = pendiente, acum = 0, countback: number | null = null;
    const primera = emitidas.reduce((m, f) => (f.fecha < m ? f.fecha : m), corte);
    let fin = c;
    if (resto <= 0)
        countback = 0;
    while (countback === null && fin >= diaDe(primera)!) {
        const { ini } = mesDe(fin);
        const diasMes = fin - ini + 1;
        const a = isoDe(ini), b = isoDe(fin);
        const ventas = emitidas.filter((f) => f.fecha >= a && f.fecha <= b).reduce((s, f) => s + f.importe, 0);
        if (ventas >= resto && ventas > 0)
            countback = acum + (resto / ventas) * diasMes;
        else {
            resto -= ventas;
            acum += diasMes;
            fin = ini - 1;
        }
    }
    return { pendiente, simple, periodo, ventasPeriodo, countback };
}
export interface MedioCobro {
    dias: number | null;
    retraso: number | null;
    cobrado: number;
    facturas: number;
    enPlazo: {
        facturas: number;
        importe: number;
    };
}
export function medioCobro(facturas: Factura[], desde: string, hasta: string, plazoMaximo = PLAZO_MAXIMO_DIAS): MedioCobro {
    const cobradas = facturas.filter((f) => f.tipo === "emitida" && f.pago && f.pago >= desde && f.pago <= hasta);
    const cobrado = r2(cobradas.reduce((s, f) => s + f.importe, 0));
    let sd = 0, sr = 0;
    const enPlazo = { facturas: 0, importe: 0 };
    for (const f of cobradas) {
        const d = dias(f.recepcion ?? f.fecha, f.pago!);
        sd += d * f.importe;
        sr += Math.max(0, dias(f.vencimiento, f.pago!)) * f.importe;
        if (d <= plazoMaximo) {
            enPlazo.facturas++;
            enPlazo.importe = r2(enPlazo.importe + f.importe);
        }
    }
    return {
        dias: cobrado > 0 ? sd / cobrado : null,
        retraso: cobrado > 0 ? sr / cobrado : null,
        cobrado,
        facturas: cobradas.length,
        enPlazo,
    };
}
