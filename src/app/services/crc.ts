export interface ModeloCrc {
    id: string;
    nombre: string;
    alias?: string;
    ancho: number;
    poly: bigint;
    init: bigint;
    refin: boolean;
    refout: boolean;
    xorout: bigint;
    check: bigint;
    uso: string;
}
export const CRCS: readonly ModeloCrc[] = [
    { id: "crc8", nombre: "CRC-8/SMBUS", alias: "CRC-8", ancho: 8, poly: 0x07n, init: 0n, refin: false, refout: false, xorout: 0n, check: 0xf4n, uso: "SMBus, ATM HEC" },
    { id: "crc8-maxim", nombre: "CRC-8/MAXIM-DOW", alias: "Dallas/Maxim 1-Wire", ancho: 8, poly: 0x31n, init: 0n, refin: true, refout: true, xorout: 0n, check: 0xa1n, uso: "1-Wire (DS18B20)" },
    { id: "crc16-arc", nombre: "CRC-16/ARC", alias: "CRC-16, CRC-IBM", ancho: 16, poly: 0x8005n, init: 0n, refin: true, refout: true, xorout: 0n, check: 0xbb3dn, uso: "ARC, LHA" },
    { id: "crc16-modbus", nombre: "CRC-16/MODBUS", ancho: 16, poly: 0x8005n, init: 0xffffn, refin: true, refout: true, xorout: 0n, check: 0x4b37n, uso: "Modbus RTU" },
    { id: "crc16-ccitt-false", nombre: "CRC-16/IBM-3740", alias: "CRC-16/CCITT-FALSE", ancho: 16, poly: 0x1021n, init: 0xffffn, refin: false, refout: false, xorout: 0n, check: 0x29b1n, uso: "muy habitual en embebido" },
    { id: "crc16-xmodem", nombre: "CRC-16/XMODEM", alias: "CRC-16/ACORN, ZMODEM", ancho: 16, poly: 0x1021n, init: 0n, refin: false, refout: false, xorout: 0n, check: 0x31c3n, uso: "XMODEM, ZMODEM" },
    { id: "crc16-kermit", nombre: "CRC-16/KERMIT", alias: "CRC-16/CCITT (true)", ancho: 16, poly: 0x1021n, init: 0n, refin: true, refout: true, xorout: 0n, check: 0x2189n, uso: "Kermit, Bluetooth" },
    { id: "crc16-x25", nombre: "CRC-16/IBM-SDLC", alias: "CRC-16/X-25", ancho: 16, poly: 0x1021n, init: 0xffffn, refin: true, refout: true, xorout: 0xffffn, check: 0x906en, uso: "HDLC, X.25, PPP" },
    { id: "crc32", nombre: "CRC-32/ISO-HDLC", alias: "CRC-32 (zip, PNG, Ethernet)", ancho: 32, poly: 0x04c11db7n, init: 0xffffffffn, refin: true, refout: true, xorout: 0xffffffffn, check: 0xcbf43926n, uso: "ZIP, PNG, gzip, Ethernet" },
    { id: "crc32c", nombre: "CRC-32/ISCSI", alias: "CRC-32C (Castagnoli)", ancho: 32, poly: 0x1edc6f41n, init: 0xffffffffn, refin: true, refout: true, xorout: 0xffffffffn, check: 0xe3069283n, uso: "iSCSI, SCTP, ext4, Btrfs" },
    { id: "crc32-bzip2", nombre: "CRC-32/BZIP2", alias: "CRC-32/AAL5", ancho: 32, poly: 0x04c11db7n, init: 0xffffffffn, refin: false, refout: false, xorout: 0xffffffffn, check: 0xfc891918n, uso: "bzip2" },
    { id: "crc32-mpeg2", nombre: "CRC-32/MPEG-2", ancho: 32, poly: 0x04c11db7n, init: 0xffffffffn, refin: false, refout: false, xorout: 0n, check: 0x0376e6e7n, uso: "MPEG-2 TS, DVB" },
    { id: "crc64-ecma", nombre: "CRC-64/ECMA-182", ancho: 64, poly: 0x42f0e1eba9ea3693n, init: 0n, refin: false, refout: false, xorout: 0n, check: 0x6c40df5f0b497347n, uso: "ECMA-182 (cintas DLT)" },
    { id: "crc64-xz", nombre: "CRC-64/XZ", alias: "CRC-64/GO-ECMA", ancho: 64, poly: 0x42f0e1eba9ea3693n, init: 0xffffffffffffffffn, refin: true, refout: true, xorout: 0xffffffffffffffffn, check: 0x995dc9bbdf1939fan, uso: "xz, Go hash/crc64" },
];
const reflejar = (v: bigint, n: number) => { let r = 0n; for (let i = 0; i < n; i++) {
    r = (r << 1n) | (v & 1n);
    v >>= 1n;
} return r; };
const tablas = new Map<string, bigint[]>();
function tabla(m: ModeloCrc): bigint[] {
    let t = tablas.get(m.id);
    if (t)
        return t;
    const w = BigInt(m.ancho), top = 1n << (w - 1n), mask = (1n << w) - 1n;
    t = [];
    for (let b = 0; b < 256; b++) {
        let r = (m.refin ? reflejar(BigInt(b), 8) : BigInt(b)) << (w - 8n < 0n ? 0n : w - 8n);
        if (m.ancho < 8)
            r = BigInt(b);
        for (let i = 0; i < 8; i++)
            r = r & top ? ((r << 1n) ^ m.poly) & mask : (r << 1n) & mask;
        t.push(m.refin ? reflejar(r, m.ancho) : r);
    }
    tablas.set(m.id, t);
    return t;
}
export function crc(m: ModeloCrc, datos: Uint8Array): bigint {
    const w = BigInt(m.ancho), mask = (1n << w) - 1n, t = tabla(m);
    let r = m.refin ? reflejar(m.init, m.ancho) : m.init;
    for (const b of datos) {
        if (m.refin)
            r = (r >> 8n) ^ t[Number((r ^ BigInt(b)) & 0xffn)];
        else
            r = ((r << 8n) & mask) ^ t[Number(((r >> (w - 8n)) ^ BigInt(b)) & 0xffn)];
    }
    if (m.refin !== m.refout)
        r = reflejar(r, m.ancho);
    return (r ^ m.xorout) & mask;
}
export function adler32(datos: Uint8Array): number {
    let a = 1, b = 0;
    for (const x of datos) {
        a = (a + x) % 65521;
        b = (b + a) % 65521;
    }
    return ((b << 16) | a) >>> 0;
}
export function fletcher16(datos: Uint8Array): number {
    let a = 0, b = 0;
    for (const x of datos) {
        a = (a + x) % 255;
        b = (b + a) % 255;
    }
    return (b << 8) | a;
}
export function hexAncho(v: bigint | number, ancho: number): string {
    return v.toString(16).toUpperCase().padStart(Math.ceil(ancho / 4), "0");
}
export function leerHex(t: string): Uint8Array | null {
    const limpio = t.replace(/0x/gi, "").replace(/[\s,:;-]/g, "");
    if (!limpio)
        return new Uint8Array();
    if (!/^[0-9a-f]*$/i.test(limpio) || limpio.length % 2)
        return null;
    return Uint8Array.from(limpio.match(/../g)!.map(h => parseInt(h, 16)));
}
export interface FilaSuma {
    id: string;
    nombre: string;
    alias?: string;
    uso: string;
    ancho: number;
    hex: string;
}
export function todasLasSumas(datos: Uint8Array): FilaSuma[] {
    return [
        ...CRCS.map(m => ({ id: m.id, nombre: m.nombre, alias: m.alias, uso: m.uso, ancho: m.ancho, hex: hexAncho(crc(m, datos), m.ancho) })),
        { id: "adler32", nombre: "Adler-32", uso: "zlib", ancho: 32, hex: hexAncho(adler32(datos), 32) },
        { id: "fletcher16", nombre: "Fletcher-16", uso: "ISO 8473, IS-IS", ancho: 16, hex: hexAncho(fletcher16(datos), 16) },
    ];
}
export function identificar(filas: readonly FilaSuma[], esperado: string): string[] {
    const e = esperado.replace(/0x/i, "").replace(/\s/g, "").toUpperCase();
    if (!/^[0-9A-F]+$/.test(e))
        return [];
    const n = (h: string) => h.replace(/^0+/, "") || "0";
    return filas.filter(f => n(f.hex) === n(e)).map(f => f.id);
}
