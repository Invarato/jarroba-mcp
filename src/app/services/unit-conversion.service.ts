import { Injectable } from "@angular/core";
import BigNumber from "bignumber.js";
export interface UnitEntry {
    suflabel: string;
    symbol: string;
    bitsValue: string;
    bytesValue: string;
}
export interface UnitComparison {
    desde: string;
    hacia: string;
    pct: string;
}
export interface UnitConvertResult {
    interpretado: string;
    comparacion: UnitComparison | null;
    commonBits: string;
    commonBytes: string;
    siResults: UnitEntry[];
    iecResults: UnitEntry[];
}
export const REGEX_UNIT = /^(\d+(?:[.,]\d+)?)(\s*)([kKMGTPEZY]i?)?([bB])$/;
const SI_FACTORS: {
    suflabel: string;
    symbol: string;
    bits: BigNumber;
}[] = [
    { suflabel: "kilo", symbol: "k", bits: new BigNumber("1000") },
    { suflabel: "mega", symbol: "M", bits: new BigNumber("1000000") },
    { suflabel: "giga", symbol: "G", bits: new BigNumber("1000000000") },
    { suflabel: "tera", symbol: "T", bits: new BigNumber("1000000000000") },
    { suflabel: "peta", symbol: "P", bits: new BigNumber("1000000000000000") },
    { suflabel: "exa", symbol: "E", bits: new BigNumber("1000000000000000000") },
    { suflabel: "zetta", symbol: "Z", bits: new BigNumber("1000000000000000000000") },
    { suflabel: "yotta", symbol: "Y", bits: new BigNumber("1000000000000000000000000") },
];
const IEC_FACTORS: {
    suflabel: string;
    symbol: string;
    bits: BigNumber;
}[] = [
    { suflabel: "kibi", symbol: "Ki", bits: new BigNumber("1024") },
    { suflabel: "mebi", symbol: "Mi", bits: new BigNumber("1048576") },
    { suflabel: "gibi", symbol: "Gi", bits: new BigNumber("1073741824") },
    { suflabel: "tebi", symbol: "Ti", bits: new BigNumber("1099511627776") },
    { suflabel: "pebi", symbol: "Pi", bits: new BigNumber("1125899906842624") },
    { suflabel: "exbi", symbol: "Ei", bits: new BigNumber("1152921504606846976") },
    { suflabel: "zebi", symbol: "Zi", bits: new BigNumber("1180591620717411303424") },
    { suflabel: "yobi", symbol: "Yi", bits: new BigNumber("1208925819614629174706176") },
];
function canonico(prefix: string): string {
    if (/^[kK]i$/.test(prefix))
        return "Ki";
    return prefix === "K" ? "k" : prefix;
}
function corto(v: BigNumber): string {
    return (v.abs().gte(1) ? v.decimalPlaces(2) : v.precision(3)).toFixed();
}
export const REGEX_RATE = /^(\d+(?:[.,]\d+)?)(\s*)([kKMGTPEZY]i?)?([bB])(?:\/s|ps)$/;
export function parseDuracion(texto: string): number | null {
    const m = texto.trim().match(/^(\d+(?:[.,]\d+)?)\s*(s|seg|min|m|h|d)$/i);
    if (!m)
        return null;
    const n = Number(m[1].replace(",", "."));
    const factor = { s: 1, seg: 1, min: 60, m: 60, h: 3600, d: 86400 }[m[2].toLowerCase() as "s" | "seg" | "min" | "m" | "h" | "d"];
    return n > 0 ? n * factor : null;
}
export function partirDuracion(total: number): Duracion {
    const entero = Math.floor(total);
    const dias = Math.floor(entero / 86400);
    const resto = entero - dias * 86400;
    return {
        dias,
        horas: Math.floor(resto / 3600),
        minutos: Math.floor((resto % 3600) / 60),
        segundos: Math.round((total - entero + (resto % 60)) * 100) / 100,
        totalSegundos: total,
    };
}
export interface Comparacion {
    a: Duracion;
    b: Duracion;
    ganador: "a" | "b" | "igual";
    veces: number;
    ahorro: Duracion;
}
export const REFERENCIAS_TAMANO: {
    id: string;
    tamano: string;
}[] = [
    { id: "foto", tamano: "4 MB" },
    { id: "cancion", tamano: "8 MB" },
    { id: "serie", tamano: "1.5 GB" },
    { id: "peli4k", tamano: "15 GB" },
    { id: "juego", tamano: "50 GB" },
    { id: "copia", tamano: "1 TB" },
];
export interface Duracion {
    dias: number;
    horas: number;
    minutos: number;
    segundos: number;
    totalSegundos: number;
}
export interface TransferResult {
    duracion: Duracion;
    velocidad: {
        simbolo: string;
        valor: string;
    }[];
}
const RATE_UNITS: {
    simbolo: string;
    bits: BigNumber;
}[] = [
    { simbolo: "Mb/s", bits: new BigNumber("1e6") },
    { simbolo: "Gb/s", bits: new BigNumber("1e9") },
    { simbolo: "kB/s", bits: new BigNumber("8e3") },
    { simbolo: "MB/s", bits: new BigNumber("8e6") },
    { simbolo: "MiB/s", bits: new BigNumber("8388608") },
    { simbolo: "GB/h", bits: new BigNumber("8e9").div(3600) },
];
const FACTOR_MAP: Record<string, BigNumber> = {
    "": new BigNumber("1"),
    b: new BigNumber("1"),
    B: new BigNumber("8"),
    ...Object.fromEntries(SI_FACTORS.map(e => [e.symbol, e.bits])),
    ...Object.fromEntries(IEC_FACTORS.map(e => [e.symbol, e.bits])),
};
function bitsDe(match: RegExpMatchArray): BigNumber {
    const numero = new BigNumber(match[1].replace(",", "."));
    const prefijo = canonico(match[3] ?? "");
    return numero.times(match[4] === "B" ? 8 : 1).times(FACTOR_MAP[prefijo] ?? 1);
}
@Injectable({ providedIn: "root" })
export class UnitConversionService {
    transfer(size: string, rate: string, rendimiento = 100): TransferResult | null {
        const ms = size.trim().match(REGEX_UNIT);
        const mr = rate.trim().match(REGEX_RATE);
        if (!ms || !mr)
            return null;
        const bits = bitsDe(ms);
        const nominal = bitsDe(mr);
        if (nominal.isZero() || !(rendimiento > 0 && rendimiento <= 100))
            return null;
        const bps = nominal.times(rendimiento).div(100);
        const total = bits.div(bps);
        const entero = total.integerValue(BigNumber.ROUND_FLOOR);
        const dias = entero.idiv(86400);
        const resto = entero.minus(dias.times(86400)).toNumber();
        return {
            duracion: {
                dias: dias.toNumber(),
                horas: Math.floor(resto / 3600),
                minutos: Math.floor((resto % 3600) / 60),
                segundos: total.minus(entero).plus(resto % 60).decimalPlaces(2).toNumber(),
                totalSegundos: total.toNumber(),
            },
            velocidad: RATE_UNITS.map(u => ({ simbolo: u.simbolo, valor: corto(bps.div(u.bits)) })),
        };
    }
    compare(size: string, rateA: string, rateB: string, rendimiento = 100): Comparacion | null {
        const a = this.transfer(size, rateA, rendimiento)?.duracion;
        const b = this.transfer(size, rateB, rendimiento)?.duracion;
        if (!a || !b)
            return null;
        const ta = a.totalSegundos, tb = b.totalSegundos;
        const ganador = ta === tb ? "igual" : ta < tb ? "a" : "b";
        return { a, b, ganador, veces: ta === tb ? 1 : Math.max(ta, tb) / Math.min(ta, tb), ahorro: partirDuracion(Math.abs(ta - tb)) };
    }
    conPausas(size: string, rate: string, horasDia: number, rendimiento = 100): {
        dias: number;
        total: Duracion;
    } | null {
        const t = this.transfer(size, rate, rendimiento);
        if (!t || !(horasDia > 0 && horasDia <= 24))
            return null;
        return { dias: Math.max(1, Math.ceil(t.duracion.totalSegundos / (horasDia * 3600))), total: t.duracion };
    }
    requiredRate(size: string, duracion: string, rendimiento = 100): {
        simbolo: string;
        valor: string;
    }[] | null {
        const ms = size.trim().match(REGEX_UNIT);
        const segundos = parseDuracion(duracion);
        if (!ms || segundos === null || !(rendimiento > 0 && rendimiento <= 100))
            return null;
        const bps = bitsDe(ms).div(segundos).times(100).div(rendimiento);
        return RATE_UNITS.map(u => ({ simbolo: u.simbolo, valor: corto(bps.div(u.bits)) }));
    }
    convert(value: string): UnitConvertResult | null {
        if (!value.trim())
            return null;
        const match = value.match(REGEX_UNIT);
        if (!match)
            return null;
        const rawNumber = match[1].replace(",", ".");
        const prefix = canonico(match[3] ?? "");
        const isByte = match[4] === "B";
        const letra = isByte ? "B" : "b";
        const numero = new BigNumber(rawNumber);
        let totalBits = numero;
        if (isByte)
            totalBits = totalBits.times(8);
        totalBits = totalBits.times(FACTOR_MAP[prefix] ?? new BigNumber("1"));
        return {
            interpretado: `${numero.toFixed()} ${prefix}${letra}`,
            comparacion: this.comparar(numero, prefix, letra, totalBits, isByte),
            commonBits: totalBits.toFixed(),
            commonBytes: totalBits.div(8).toFixed(),
            siResults: SI_FACTORS.map(f => ({
                suflabel: f.suflabel,
                symbol: f.symbol,
                bitsValue: totalBits.div(f.bits).toFixed(),
                bytesValue: totalBits.div(f.bits).div(8).toFixed(),
            })),
            iecResults: IEC_FACTORS.map(f => ({
                suflabel: f.suflabel,
                symbol: f.symbol,
                bitsValue: totalBits.div(f.bits).toFixed(),
                bytesValue: totalBits.div(f.bits).div(8).toFixed(),
            })),
        };
    }
    private comparar(numero: BigNumber, prefix: string, letra: string, totalBits: BigNumber, isByte: boolean): UnitComparison | null {
        const iSi = SI_FACTORS.findIndex(f => f.symbol === prefix);
        const iIec = IEC_FACTORS.findIndex(f => f.symbol === prefix);
        const nivel = iSi >= 0 ? iSi : iIec;
        if (nivel < 0)
            return null;
        const otro = iSi >= 0 ? IEC_FACTORS[nivel] : SI_FACTORS[nivel];
        const valor = totalBits.div(otro.bits).div(isByte ? 8 : 1);
        return {
            desde: `${numero.toFixed()} ${prefix}${letra}`,
            hacia: `${corto(valor)} ${otro.symbol}${letra}`,
            pct: corto(IEC_FACTORS[nivel].bits.div(SI_FACTORS[nivel].bits).minus(1).times(100)),
        };
    }
}
