import { CRCS, crc, hexAncho, identificar, leerHex, todasLasSumas, type ModeloCrc } from "../../src/app/services/crc";
const USO: Record<string, string> = {
    crc8: "SMBus, ATM HEC",
    "crc8-maxim": "1-Wire (DS18B20)",
    "crc16-arc": "ARC, LHA",
    "crc16-modbus": "Modbus RTU",
    "crc16-ccitt-false": "very common in embedded firmware",
    "crc16-xmodem": "XMODEM, ZMODEM",
    "crc16-kermit": "Kermit, Bluetooth",
    "crc16-x25": "HDLC, X.25, PPP",
    crc32: "ZIP, PNG, gzip, Ethernet",
    crc32c: "iSCSI, SCTP, ext4, Btrfs",
    "crc32-bzip2": "bzip2",
    "crc32-mpeg2": "MPEG-2 TS, DVB",
    "crc64-ecma": "ECMA-182 (DLT tapes)",
    "crc64-xz": "xz, Go hash/crc64",
    adler32: "zlib",
    fletcher16: "ISO 8473, IS-IS",
};
export interface ParametrosCrc {
    width: number;
    poly: string;
    init: string;
    refin: boolean;
    refout: boolean;
    xorout: string;
}
export interface EntradaSuma {
    bytes: Uint8Array;
    algorithm?: string;
    expected?: string;
    custom?: ParametrosCrc;
}
const big = (h: string) => BigInt("0x" + h.replace(/^0x/i, ""));
const alReves = (hex: string, ancho: number) => {
    const h = hex.replace(/^0x/i, "").padStart(Math.ceil(ancho / 4), "0");
    return h.length % 2 ? null : (h.match(/../g) ?? []).reverse().join("");
};
export function leerBytesHex(t: string): Uint8Array | null { return leerHex(t); }
export function sumas(e: EntradaSuma) {
    if (e.custom) {
        const p = e.custom;
        let m: ModeloCrc;
        try {
            const mask = (1n << BigInt(p.width)) - 1n;
            const [poly, init, xorout] = [big(p.poly), big(p.init), big(p.xorout)];
            if (poly > mask || init > mask || xorout > mask)
                return { error: `poly, init and xorout must fit in ${p.width} bits.` };
            m = { id: `custom:${p.width}:${p.poly}:${p.init}:${p.refin}:${p.refout}:${p.xorout}`, nombre: "custom", ancho: p.width, poly, init, refin: p.refin, refout: p.refout, xorout, check: 0n, uso: "" };
        }
        catch {
            return { error: "poly, init and xorout must be hexadecimal (e.g. \"0x1021\")." };
        }
        const hex = hexAncho(crc(m, e.bytes), p.width);
        const check = hexAncho(crc(m, new TextEncoder().encode("123456789")), p.width);
        return {
            bytes: e.bytes.length,
            results: [{ algorithm: "custom", width: p.width, hex }],
            check: { value: check, note: "CRC of the ASCII string \"123456789\" with these parameters: compare it with the \"check\" column of the reveng catalogue to confirm the parameters are right." },
            ...(e.expected ? { matches: coincide(e.expected, [{ id: "custom", hex, ancho: p.width }]) } : {}),
        };
    }
    let filas = todasLasSumas(e.bytes);
    if (e.algorithm) {
        const a = e.algorithm.toLowerCase();
        const alias = (f: {
            alias?: string;
        }) => (f.alias ?? "").replace(/\([^)]*\)/g, "").toLowerCase().split(/,\s*/).map((x) => x.trim());
        filas = filas.filter((f) => f.id === a || f.nombre.toLowerCase() === a || alias(f).includes(a));
        if (!filas.length)
            return { error: `Unknown algorithm "${e.algorithm}". One of: ${[...CRCS.map((c) => c.id), "adler32", "fletcher16"].join(", ")}.` };
    }
    return {
        bytes: e.bytes.length,
        results: filas.map((f) => ({ algorithm: f.id, name: f.nombre, ...(f.alias ? { aliases: f.alias } : {}), usedIn: USO[f.id], width: f.ancho, hex: f.hex })),
        ...(e.expected ? { matches: coincide(e.expected, filas.map((f) => ({ id: f.id, hex: f.hex, ancho: f.ancho }))) } : {}),
        notes: [
            "CRCs, Adler-32 and Fletcher-16 catch ACCIDENTAL corruption only: anyone can forge data with a chosen CRC. Use SHA-256 (hash_text) against tampering.",
            "Not in the list? Pass `custom` with the Rocksoft parameters (width, poly, init, refin, refout, xorout) from the reveng catalogue or the device datasheet.",
        ],
    };
}
function coincide(esperado: string, filas: {
    id: string;
    hex: string;
    ancho: number;
}[]) {
    const directas = identificar(filas.map((f) => ({ id: f.id, nombre: "", uso: "", ancho: f.ancho, hex: f.hex })), esperado);
    const out = directas.map((id) => ({ algorithm: id, byteOrder: "as given" }));
    for (const f of filas) {
        if (directas.includes(f.id))
            continue;
        const r = alReves(f.hex, f.ancho);
        if (r && r !== f.hex && identificar([{ id: f.id, nombre: "", uso: "", ancho: f.ancho, hex: r }], esperado).length) {
            out.push({ algorithm: f.id, byteOrder: "bytes swapped (little-endian on the wire, as Modbus sends it)" });
        }
    }
    return {
        found: out,
        ...(out.length ? {} : { hint: "No algorithm in the catalogue gives that value, in either byte order. Check the exact bytes covered (header and length fields included or not?) and whether the value was transmitted with a different init or final XOR; then try `custom`." }),
    };
}
