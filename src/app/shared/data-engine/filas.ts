import { FileSource } from "./file-source";
const NL = 10, CR = 13, COMILLA = 34;
export interface ModoFilas {
    separador: string;
    maxLineas?: number;
}
export const MAX_LINEAS_FILA = 1000;
export function bytesSeparador(separador: string | null | undefined): Uint8Array | null {
    if (!separador)
        return null;
    const b = new TextEncoder().encode(separador);
    for (const x of b)
        if (x >= 128 || x === NL || x === COMILLA)
            return null;
    return b.length ? b : null;
}
function alInicio(data: Uint8Array, q: number, desde: number, sep: Uint8Array): boolean {
    if (q === desde)
        return true;
    const ls = sep.length;
    if (q - ls < desde)
        return false;
    for (let k = 0; k < ls; k++)
        if (data[q - ls + k] !== sep[k])
            return false;
    return true;
}
export function finDeFila(data: Uint8Array, desde: number, sep: Uint8Array | null, maxLineas = MAX_LINEAS_FILA, cuenta?: {
    cortadas: number;
}): number {
    if (!sep)
        return data.indexOf(NL, desde);
    let i = desde, lineas = 1;
    for (;;) {
        const nl = data.indexOf(NL, i);
        let q = data.indexOf(COMILLA, i);
        while (q >= 0 && (nl < 0 || q < nl) && !alInicio(data, q, desde, sep))
            q = data.indexOf(COMILLA, q + 1);
        if (q < 0 || (nl >= 0 && nl < q))
            return nl;
        i = q + 1;
        for (;;) {
            const c = data.indexOf(COMILLA, i);
            const hasta = c < 0 ? data.length : c;
            for (let l = data.indexOf(NL, i); l >= 0 && l < hasta; l = data.indexOf(NL, l + 1)) {
                if (++lineas > maxLineas) {
                    if (cuenta)
                        cuenta.cortadas++;
                    return l;
                }
            }
            if (c < 0)
                return -1;
            if (data[c + 1] === COMILLA) {
                i = c + 2;
                continue;
            }
            i = c + 1;
            break;
        }
    }
}
export interface TrozoFilas {
    data: Uint8Array;
    base: number;
    cortes: number[];
}
export class CortadorFilas {
    private carry: Uint8Array = new Uint8Array(0);
    private leidos = 0;
    private readonly sep: Uint8Array | null;
    private readonly max: number;
    readonly cuenta = { cortadas: 0 };
    constructor(modo?: ModoFilas | null) {
        this.sep = bytesSeparador(modo?.separador);
        this.max = Math.max(1, modo?.maxLineas ?? MAX_LINEAS_FILA);
    }
    get esCsv(): boolean { return this.sep !== null; }
    get cortadas(): number { return this.cuenta.cortadas; }
    push(chunk: Uint8Array): TrozoFilas {
        let data: Uint8Array;
        if (this.carry.length) {
            data = new Uint8Array(this.carry.length + chunk.length);
            data.set(this.carry);
            data.set(chunk, this.carry.length);
        }
        else
            data = chunk;
        const base = this.leidos - this.carry.length;
        this.leidos += chunk.length;
        const cortes: number[] = [];
        let start = 0;
        let q = this.sep ? data.indexOf(COMILLA) : -1;
        for (;;) {
            let f: number;
            if (q < 0)
                f = data.indexOf(NL, start);
            else {
                const nl = data.indexOf(NL, start);
                if (nl >= 0 && nl < q)
                    f = nl;
                else {
                    f = finDeFila(data, start, this.sep, this.max, this.cuenta);
                    if (f >= 0)
                        q = data.indexOf(COMILLA, f + 1);
                }
            }
            if (f < 0)
                break;
            cortes.push(start, f);
            start = f + 1;
        }
        this.carry = data.subarray(start);
        return { data, base, cortes };
    }
    fin(): TrozoFilas {
        const data = this.carry;
        const base = this.leidos - data.length;
        this.carry = new Uint8Array(0);
        if (!data.length)
            return { data, base, cortes: [] };
        if (this.sep) {
            const cortes: number[] = [];
            let start = 0;
            for (;;) {
                const f = finDeFila(data, start, this.sep, this.max, this.cuenta);
                if (f < 0)
                    break;
                cortes.push(start, f);
                start = f + 1;
            }
            if (start < data.length) {
                if (abiertaAlFinal(data, start, this.sep))
                    this.cuenta.cortadas++;
                cortes.push(start, data.length);
            }
            return { data, base, cortes };
        }
        return { data, base, cortes: [0, data.length] };
    }
}
function abiertaAlFinal(data: Uint8Array, desde: number, sep: Uint8Array): boolean {
    let i = desde;
    for (;;) {
        let q = data.indexOf(COMILLA, i);
        while (q >= 0 && !alInicio(data, q, desde, sep))
            q = data.indexOf(COMILLA, q + 1);
        if (q < 0)
            return false;
        i = q + 1;
        for (;;) {
            const c = data.indexOf(COMILLA, i);
            if (c < 0)
                return true;
            if (data[c + 1] === COMILLA) {
                i = c + 2;
                continue;
            }
            i = c + 1;
            break;
        }
    }
}
export function sinCR(data: Uint8Array, ini: number, fin: number): number {
    return (fin > ini && data[fin - 1] === CR) ? fin - 1 : fin;
}
export function textoFila(decoder: TextDecoder, data: Uint8Array, ini: number, fin: number): string {
    const t = decoder.decode(data.subarray(ini, sinCR(data, ini, fin)));
    return t.indexOf("\n") >= 0 && t.indexOf("\r") >= 0 ? t.replace(/\r\n/g, "\n") : t;
}
export async function recorrerFilas(src: FileSource, decoder: TextDecoder, opts: {
    chunkSize?: number;
    signal?: AbortSignal;
    modo?: ModoFilas | null;
    onProgress?: (bytes: number, total: number) => void;
}, fila: (texto: string) => void): Promise<CortadorFilas> {
    const chunkSize = Math.max(64 * 1024, opts.chunkSize ?? 4 * 1024 * 1024);
    const size = src.size;
    const cortador = new CortadorFilas(opts.modo);
    let offset = 0;
    while (offset < size) {
        if (opts.signal?.aborted)
            throw new DOMException("aborted", "AbortError");
        const end = Math.min(offset + chunkSize, size);
        const t = cortador.push(await src.readRange(offset, end));
        for (let k = 0; k < t.cortes.length; k += 2)
            fila(textoFila(decoder, t.data, t.cortes[k], t.cortes[k + 1]));
        offset = end;
        opts.onProgress?.(offset, size);
        await Promise.resolve();
    }
    const t = cortador.fin();
    for (let k = 0; k < t.cortes.length; k += 2)
        fila(textoFila(decoder, t.data, t.cortes[k], t.cortes[k + 1]));
    return cortador;
}
