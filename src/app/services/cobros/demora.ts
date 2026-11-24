import { diaDe, isoDe } from "../../shared/dias";
import { Factura, dias } from "./facturas";
export interface TramoTipo {
    desde: string;
    tipo: number;
}
export interface DatosDemora {
    capturado: string;
    hasta: string;
    tramos: TramoTipo[];
}
export function esDatosDemora(x: unknown): x is DatosDemora {
    const d = x as DatosDemora;
    const iso = (s: unknown) => typeof s === "string" && diaDe(s) !== null;
    return !!d && typeof d === "object" && iso(d.capturado) && iso(d.hasta) && Array.isArray(d.tramos) && d.tramos.length > 0
        && d.tramos.every((t, i) => iso(t.desde) && typeof t.tipo === "number" && Number.isFinite(t.tipo) && t.tipo >= 0
            && (i === 0 || t.desde > d.tramos[i - 1].desde));
}
export const COSTES_COBRO = 40;
export interface TramoInteres {
    desde: string;
    hasta: string;
    dias: number;
    tipo: number;
    interes: number;
}
export interface Interes {
    dias: number;
    interes: number;
    tramos: TramoInteres[];
    diasSupuestos: number;
}
const r2 = (n: number) => Math.round(n * 100) / 100;
export function interesDemora(importe: number, vencimiento: string, hasta: string, datos: DatosDemora): Interes {
    const v = diaDe(vencimiento)!, h = diaDe(hasta)!;
    const total = Math.max(0, h - v);
    const res: Interes = { dias: total, interes: 0, tramos: [], diasSupuestos: 0 };
    if (total === 0 || importe <= 0)
        return res;
    const t = datos.tramos;
    const finDatos = diaDe(datos.hasta)!;
    let dia = v + 1;
    while (dia <= h) {
        let i = -1;
        for (let k = 0; k < t.length; k++)
            if (diaDe(t[k].desde)! <= dia)
                i = k;
        if (i < 0)
            i = 0;
        const finTramo = i + 1 < t.length ? diaDe(t[i + 1].desde)! - 1 : Infinity;
        const fin = Math.min(h, finTramo);
        const n = fin - dia + 1;
        const interes = importe * (t[i].tipo / 100) * (n / 365);
        res.tramos.push({ desde: isoDe(dia), hasta: isoDe(fin), dias: n, tipo: t[i].tipo, interes: r2(interes) });
        res.interes += interes;
        dia = fin + 1;
    }
    res.diasSupuestos = Math.max(0, h - Math.max(finDatos, v));
    res.interes = r2(res.interes);
    return res;
}
export interface Reclamacion {
    factura: Factura;
    base: number;
    pagada: boolean;
    interes: Interes;
    costes: number;
    total: number;
}
export interface Lote {
    corte: string;
    reclamaciones: Reclamacion[];
    interes: number;
    costes: number;
    total: number;
    diasSupuestos: boolean;
}
export function loteDemora(facturas: Factura[], corte: string, datos: DatosDemora, o: {
    incluirPagadas?: boolean;
    costes?: boolean;
} = {}): Lote {
    const reclamaciones: Reclamacion[] = [];
    for (const f of facturas) {
        if (f.tipo !== "emitida" || f.fecha > corte)
            continue;
        const pagada = !!f.pago && f.pago <= corte;
        if (pagada && !o.incluirPagadas)
            continue;
        const hasta = pagada ? f.pago! : corte;
        if (dias(f.vencimiento, hasta) <= 0)
            continue;
        const base = pagada ? f.importe : (f.pendiente ?? f.importe);
        if (base <= 0)
            continue;
        const interes = interesDemora(base, f.vencimiento, hasta, datos);
        const costes = o.costes === false ? 0 : COSTES_COBRO;
        reclamaciones.push({ factura: f, base, pagada, interes, costes, total: r2(interes.interes + costes) });
    }
    reclamaciones.sort((a, b) => b.total - a.total);
    const interes = r2(reclamaciones.reduce((s, r) => s + r.interes.interes, 0));
    const costes = reclamaciones.reduce((s, r) => s + r.costes, 0);
    return { corte, reclamaciones, interes, costes, total: r2(interes + costes), diasSupuestos: reclamaciones.some((r) => r.interes.diasSupuestos > 0) };
}
