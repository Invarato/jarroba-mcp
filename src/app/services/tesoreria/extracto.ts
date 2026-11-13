export interface Movimiento {
    fecha: string;
    concepto: string;
    importe: number;
    saldo?: number;
    comun?: string;
}
export interface Extracto {
    formato: "n43" | "csv";
    movimientos: Movimiento[];
    saldoFinal: number | null;
    saldoInicial: number | null;
    divisa?: string;
    avisos: AvisoExtracto[];
}
export type AvisoExtracto = {
    que: "linea-ilegible";
    linea: number;
} | {
    que: "n43-no-cuadra";
    esperado: number;
    leido: number;
} | {
    que: "varias-cuentas";
    n: number;
};
export type ErrorExtracto = {
    que: "vacio";
} | {
    que: "formato";
} | {
    que: "sin-movimientos";
};
const r2 = (x: number) => Math.round(x * 100) / 100;
export const CONCEPTOS_COMUNES: Record<string, string> = {
    "01": "Talones / reintegros",
    "02": "Abonar\u00E9s / entregas / ingresos",
    "03": "Domiciliados / recibos",
    "04": "Transferencias / giros",
    "05": "Amortizaciones de pr\u00E9stamos",
    "06": "Remesas de efectos",
    "07": "Suscripciones / dividendos",
    "08": "Dividendos / cupones",
    "09": "Bolsa / valores",
    "10": "Cheques de gasolina",
    "11": "Cajeros",
    "12": "Tarjetas",
    "13": "Operaciones con el extranjero",
    "14": "Devoluciones / impagados",
    "15": "N\u00F3minas / seguros sociales",
    "16": "Timbres / corretajes",
    "17": "Intereses / comisiones / gastos",
    "98": "Anulaciones",
    "99": "Varios",
};
const fechaN43 = (aammdd: string): string | null => {
    if (!/^\d{6}$/.test(aammdd))
        return null;
    const [a, m, d] = [Number(aammdd.slice(0, 2)), Number(aammdd.slice(2, 4)), Number(aammdd.slice(4, 6))];
    if (m < 1 || m > 12 || d < 1 || d > 31)
        return null;
    return `${2000 + a}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
};
const importeN43 = (s: string): number | null => (/^\d{14}$/.test(s) ? Number(s) / 100 : null);
export function esNorma43(texto: string): boolean {
    const l = texto.replace(/\r/g, "").split("\n").filter((x) => x.trim());
    return l.length >= 2 && /^11\d/.test(l[0]) && l.some((x) => /^22/.test(x));
}
function leerNorma43(texto: string): Extracto | ErrorExtracto {
    const lineas = texto.replace(/\r/g, "").split("\n");
    const movimientos: Movimiento[] = [];
    const avisos: AvisoExtracto[] = [];
    let saldoInicial: number | null = null, saldoFinal: number | null = null, divisa: string | undefined, cuentas = 0;
    let ultimo: Movimiento | null = null, complementado = false;
    lineas.forEach((raw, i) => {
        const l = raw.padEnd(80, " ");
        if (!raw.trim())
            return;
        const tipo = l.slice(0, 2);
        if (tipo === "11") {
            cuentas++;
            const s = importeN43(l.slice(33, 47));
            if (s !== null && cuentas === 1)
                saldoInicial = l[32] === "1" ? -s : s;
            divisa = l.slice(47, 50).trim() || undefined;
        }
        else if (tipo === "22") {
            const fecha = fechaN43(l.slice(10, 16)), x = importeN43(l.slice(28, 42)), clave = l[27];
            if (!fecha || x === null || (clave !== "1" && clave !== "2")) {
                avisos.push({ que: "linea-ilegible", linea: i + 1 });
                ultimo = null;
                return;
            }
            const refs = [l.slice(52, 64), l.slice(64, 80)].map((r) => r.trim()).filter((r) => r && !/^0+$/.test(r));
            const comun = l.slice(22, 24);
            ultimo = { fecha, concepto: refs.join(" ") || CONCEPTOS_COMUNES[comun] || comun, importe: clave === "1" ? -x : x, comun };
            complementado = false;
            movimientos.push(ultimo);
        }
        else if (tipo === "23") {
            if (!ultimo)
                return;
            const t = (l.slice(4, 42) + " " + l.slice(42, 80)).replace(/\s+/g, " ").trim();
            if (!t)
                return;
            ultimo.concepto = complementado ? `${ultimo.concepto} ${t}` : t;
            complementado = true;
        }
        else if (tipo === "33") {
            const s = importeN43(l.slice(59, 73));
            if (s !== null)
                saldoFinal = l[58] === "1" ? -s : s;
        }
        else if (tipo !== "88") {
            avisos.push({ que: "linea-ilegible", linea: i + 1 });
        }
    });
    if (cuentas > 1)
        avisos.push({ que: "varias-cuentas", n: cuentas });
    if (!movimientos.length)
        return { que: "sin-movimientos" };
    movimientos.sort((a, b) => a.fecha.localeCompare(b.fecha));
    if (saldoInicial !== null && cuentas === 1) {
        let s: number = saldoInicial;
        for (const m of movimientos) {
            s = r2(s + m.importe);
            m.saldo = s;
        }
        if (saldoFinal !== null && Math.abs(s - saldoFinal) >= 0.005)
            avisos.push({ que: "n43-no-cuadra", esperado: saldoFinal, leido: s });
    }
    return { formato: "n43", movimientos, saldoInicial, saldoFinal, divisa, avisos };
}
export function partirCsv(linea: string, sep: string): string[] {
    const out: string[] = [];
    let cur = "", dentro = false;
    for (let i = 0; i < linea.length; i++) {
        const c = linea[i];
        if (c === "\"") {
            if (dentro && linea[i + 1] === "\"") {
                cur += "\"";
                i++;
            }
            else
                dentro = !dentro;
        }
        else if (c === sep && !dentro) {
            out.push(cur.trim());
            cur = "";
        }
        else
            cur += c;
    }
    out.push(cur.trim());
    return out;
}
const sinAcentos = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const COL = {
    fecha: /^(f\.?\s*)?(fecha|date|f\.?\s*operaci[oó]n|fecha\s*operaci[oó]n|fecha\s*contable|f\.?\s*valor|fecha\s*valor|booking date|transaction date)/,
    concepto: /^(concepto|descripci[oó]n|description|movimiento|detalle|observaciones|beneficiario|texto|details)/,
    importe: /^(importe|amount|cantidad|importe\s*\(?eur\)?|valor)/,
    cargo: /^(cargo|cargos|debe|gasto|debit|salida)/,
    abono: /^(abono|abonos|haber|ingreso|credit|entrada)/,
    saldo: /^(saldo|balance|disponible)/,
};
function leerFechaCsv(t: string): string | null {
    const s = t.trim().replace(/^"|"$/g, "");
    let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
    if (m)
        return iso(Number(m[1]), Number(m[2]), Number(m[3]));
    m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})\b/.exec(s);
    if (m)
        return iso(m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]), Number(m[2]), Number(m[1]));
    return null;
}
const iso = (a: number, m: number, d: number) => (m >= 1 && m <= 12 && d >= 1 && d <= 31 ? `${a}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}` : null);
export function leerImporte(t: string): number | null {
    let s = t.trim().replace(/^"|"$/g, "").replace(/\s|€|eur$/gi, "");
    if (!s)
        return null;
    let neg = false;
    if (/^\(.*\)$/.test(s)) {
        neg = true;
        s = s.slice(1, -1);
    }
    if (s.endsWith("-")) {
        neg = true;
        s = s.slice(0, -1);
    }
    if (s.startsWith("-")) {
        neg = !neg;
        s = s.slice(1);
    }
    else if (s.startsWith("+"))
        s = s.slice(1);
    if (!/^[\d.,]+$/.test(s) || !/\d/.test(s))
        return null;
    const ult = Math.max(s.lastIndexOf(","), s.lastIndexOf("."));
    let n: number;
    if (ult >= 0 && /^\d{1,2}$/.test(s.slice(ult + 1)))
        n = Number(s.slice(0, ult).replace(/[.,]/g, "") + "." + s.slice(ult + 1));
    else
        n = Number(s.replace(/[.,]/g, ""));
    return Number.isFinite(n) ? r2(neg ? -n : n) : null;
}
function leerCsv(texto: string): Extracto | ErrorExtracto {
    const lineas = texto.replace(/\r/g, "").replace(/^﻿/, "").split("\n").filter((l) => l.trim());
    if (lineas.length < 2)
        return { que: "vacio" };
    const sep = ["\t", ";", ","].map((s) => {
        const n = lineas.slice(0, 20).map((l) => partirCsv(l, s).length);
        const max = Math.max(...n);
        return { s, max, veces: n.filter((x) => x === max).length };
    }).filter((x) => x.max > 1 && x.veces >= 2).sort((a, b) => b.max - a.max)[0]?.s ?? ";";
    let cab = -1, idx: Partial<Record<keyof typeof COL, number>> = {};
    for (let i = 0; i < Math.min(15, lineas.length) && cab < 0; i++) {
        const cols = partirCsv(lineas[i], sep).map(sinAcentos);
        const buscar = (re: RegExp) => { const k = cols.findIndex((c) => re.test(c)); return k >= 0 ? k : undefined; };
        const cand = { fecha: buscar(COL.fecha), concepto: buscar(COL.concepto), importe: buscar(COL.importe), cargo: buscar(COL.cargo), abono: buscar(COL.abono), saldo: buscar(COL.saldo) };
        if (cand.fecha !== undefined && (cand.importe !== undefined || cand.cargo !== undefined || cand.abono !== undefined)) {
            cab = i;
            idx = cand;
        }
    }
    if (cab < 0)
        return { que: "formato" };
    const avisos: AvisoExtracto[] = [];
    const movimientos: Movimiento[] = [];
    for (let i = cab + 1; i < lineas.length; i++) {
        const c = partirCsv(lineas[i], sep);
        const fecha = leerFechaCsv(c[idx.fecha!] ?? "");
        let importe: number | null = null;
        if (idx.importe !== undefined)
            importe = leerImporte(c[idx.importe] ?? "");
        else {
            const cargo = idx.cargo !== undefined ? leerImporte(c[idx.cargo] ?? "") : null;
            const abono = idx.abono !== undefined ? leerImporte(c[idx.abono] ?? "") : null;
            if (cargo !== null || abono !== null)
                importe = r2((abono ?? 0) - Math.abs(cargo ?? 0));
        }
        if (!fecha || importe === null) {
            if (c.some((x) => x))
                avisos.push({ que: "linea-ilegible", linea: i + 1 });
            continue;
        }
        const saldo = idx.saldo !== undefined ? leerImporte(c[idx.saldo] ?? "") : null;
        const concepto = (idx.concepto !== undefined ? c[idx.concepto] : c.filter((_, k) => k !== idx.fecha && k !== idx.importe).join(" ")).replace(/\s+/g, " ").trim();
        movimientos.push({ fecha, concepto, importe, ...(saldo !== null ? { saldo } : {}) });
    }
    if (!movimientos.length)
        return { que: "sin-movimientos" };
    const desc = movimientos.length > 1 && movimientos[0].fecha > movimientos[movimientos.length - 1].fecha;
    if (desc)
        movimientos.reverse();
    const conSaldo = movimientos.filter((m) => m.saldo !== undefined);
    return {
        formato: "csv",
        movimientos: movimientos.map((m, k) => ({ ...m, _k: k })).sort((a, b) => a.fecha.localeCompare(b.fecha) || a._k - b._k).map(({ _k, ...m }) => m),
        saldoFinal: conSaldo.length ? conSaldo[conSaldo.length - 1].saldo! : null,
        saldoInicial: conSaldo.length ? r2(conSaldo[0].saldo! - conSaldo[0].importe) : null,
        avisos,
    };
}
export function leerExtracto(texto: string): Extracto | ErrorExtracto {
    if (!texto.trim())
        return { que: "vacio" };
    try {
        return esNorma43(texto) ? leerNorma43(texto) : leerCsv(texto);
    }
    catch {
        return { que: "formato" };
    }
}
