import { partirCsv, unirCsv } from "./csv";
import { CortadorFilas, textoFila } from "./filas";
import { FileSource, decodificador } from "./file-source";
export interface DiffOpts {
    aKeyCol: number;
    bKeyCol: number;
    aDelim: string;
    bDelim: string;
    aHeaderRows?: number;
    bHeaderRows?: number;
    caseInsensitive?: boolean;
    trim?: boolean;
    maxEjemplos?: number;
    chunkSize?: number;
    signal?: AbortSignal;
    onProgress?: (frac: number) => void;
}
export interface DiffWriter {
    write(s: string): void;
}
export interface CambioCelda {
    columna: string;
    a: string;
    b: string;
}
export interface DiffResult {
    filasA: number;
    filasB: number;
    iguales: number;
    cambiadas: number;
    soloA: number;
    soloB: number;
    duplicadasA: number;
    duplicadasB: number;
    porColumna: Record<string, number>;
    soloColumnasA: string[];
    soloColumnasB: string[];
    ejemplos: {
        cambiadas: {
            clave: string;
            cambios: CambioCelda[];
        }[];
        soloA: string[];
        soloB: string[];
    };
    header: string[];
}
function huella(vals: string[]): [
    number,
    number
] {
    let h1 = 2166136261, h2 = 16777619 ^ 1540483477;
    for (let v = 0; v < vals.length; v++) {
        const s = vals[v];
        for (let i = 0; i < s.length; i++) {
            const c = s.charCodeAt(i);
            h1 = Math.imul(h1 ^ c, 16777619);
            h2 = Math.imul(h2 ^ c, 16777629);
        }
        h1 = Math.imul(h1 ^ 31, 16777619);
        h2 = Math.imul(h2 ^ 31, 16777629);
    }
    return [h1 >>> 0, h2 >>> 0];
}
async function recorrer(src: FileSource, delim: string, chunkSize: number, signal: AbortSignal | undefined, porTrozo: (filas: {
    texto: string;
    offset: number;
    largo: number;
}[]) => Promise<void> | void, onFrac?: (f: number) => void): Promise<void> {
    const dec = decodificador(src);
    const c = new CortadorFilas({ separador: delim });
    const size = src.size;
    let offset = 0;
    const tomar = async (t: {
        data: Uint8Array;
        base: number;
        cortes: number[];
    }) => {
        const filas: {
            texto: string;
            offset: number;
            largo: number;
        }[] = [];
        for (let k = 0; k < t.cortes.length; k += 2)
            filas.push({ texto: textoFila(dec, t.data, t.cortes[k], t.cortes[k + 1]), offset: t.base + t.cortes[k], largo: t.cortes[k + 1] - t.cortes[k] });
        if (filas.length)
            await porTrozo(filas);
    };
    while (offset < size) {
        if (signal?.aborted)
            throw new DOMException("aborted", "AbortError");
        const end = Math.min(offset + chunkSize, size);
        await tomar(c.push(await src.readRange(offset, end)));
        offset = end;
        onFrac?.(size ? offset / size : 1);
        await Promise.resolve();
    }
    await tomar(c.fin());
}
async function leerFilas(src: FileSource, delim: string, pos: {
    offset: number;
    largo: number;
}[]): Promise<string[][]> {
    const dec = decodificador(src);
    const orden = pos.map((p, i) => i).sort((x, y) => pos[x].offset - pos[y].offset);
    const out = new Array<string[]>(pos.length);
    const TRAMO = 4 * 1024 * 1024;
    for (let k = 0; k < orden.length;) {
        const ini = pos[orden[k]].offset;
        let j = k, fin = ini;
        while (j < orden.length && pos[orden[j]].offset + pos[orden[j]].largo - ini <= TRAMO) {
            fin = Math.max(fin, pos[orden[j]].offset + pos[orden[j]].largo);
            j++;
        }
        if (j === k) {
            fin = pos[orden[k]].offset + pos[orden[k]].largo;
            j = k + 1;
        }
        const buf = await src.readRange(ini, fin);
        for (let m = k; m < j; m++) {
            const p = pos[orden[m]];
            out[orden[m]] = partirCsv(textoFila(dec, buf, p.offset - ini, p.offset - ini + p.largo), delim);
        }
        k = j;
    }
    return out;
}
async function primeraFila(src: FileSource, delim: string): Promise<string[]> {
    const c = new CortadorFilas({ separador: delim });
    let t = c.push(await src.readRange(0, Math.min(src.size, 1 << 20)));
    if (!t.cortes.length)
        t = c.fin();
    return t.cortes.length ? partirCsv(textoFila(decodificador(src), t.data, t.cortes[0], t.cortes[1]), delim) : [];
}
export async function diffPorClave(a: FileSource, b: FileSource, opts: DiffOpts, writer: DiffWriter): Promise<DiffResult> {
    const chunkSize = Math.max(64 * 1024, opts.chunkSize ?? 4 * 1024 * 1024);
    const aH = opts.aHeaderRows ?? 0, bH = opts.bHeaderRows ?? 0;
    const maxEj = opts.maxEjemplos ?? 20;
    const normClave = (s: string) => opts.caseInsensitive ? s.toLowerCase() : s;
    const normValor = (s: string) => opts.trim ? s.trim() : s;
    const d = opts.aDelim;
    const cabA = aH ? await primeraFila(a, opts.aDelim) : [];
    const cabB = bH ? await primeraFila(b, opts.bDelim) : [];
    const porNombre = cabA.length > 0 && cabB.length > 0;
    let colsA: number[] = [], colsB: number[] = [], nombres: string[] = [];
    let soloColumnasA: string[] = [], soloColumnasB: string[] = [];
    const fijarColumnas = (nA: number, nB: number) => {
        if (porNombre) {
            cabA.forEach((n, i) => { if (i === opts.aKeyCol)
                return; const j = cabB.indexOf(n); if (j >= 0 && j !== opts.bKeyCol) {
                colsA.push(i);
                colsB.push(j);
                nombres.push(n);
            }
            else
                soloColumnasA.push(n); });
            soloColumnasB = cabB.filter((n, j) => j !== opts.bKeyCol && !cabA.includes(n));
        }
        else {
            const n = Math.max(nA, nB);
            for (let i = 0, j = 0; i < n; i++) {
                if (i === opts.aKeyCol)
                    continue;
                while (j === opts.bKeyCol)
                    j++;
                colsA.push(i);
                colsB.push(j);
                nombres.push(cabA[i] ?? `col ${i + 1}`);
                j++;
            }
        }
    };
    if (porNombre)
        fijarColumnas(0, 0);
    const idx = new Map<string, number>();
    let cap = 1 << 16, n = 0;
    let off = new Float64Array(cap), len = new Uint32Array(cap), h1 = new Uint32Array(cap), h2 = new Uint32Array(cap), vis = new Uint8Array(cap);
    const crecer = () => {
        cap *= 2;
        const o2 = new Float64Array(cap);
        o2.set(off);
        off = o2;
        const l2 = new Uint32Array(cap);
        l2.set(len);
        len = l2;
        const a2 = new Uint32Array(cap);
        a2.set(h1);
        h1 = a2;
        const b2 = new Uint32Array(cap);
        b2.set(h2);
        h2 = b2;
        const v2 = new Uint8Array(cap);
        v2.set(vis);
        vis = v2;
    };
    let filaB = 0, filasB = 0, duplicadasB = 0, anchoB = 0;
    await recorrer(b, opts.bDelim, chunkSize, opts.signal, (filas) => {
        for (const f of filas) {
            if (filaB++ < bH)
                continue;
            filasB++;
            const cells = partirCsv(f.texto, opts.bDelim);
            if (cells.length > anchoB)
                anchoB = cells.length;
            const k = normClave(cells[opts.bKeyCol] ?? "");
            if (idx.has(k)) {
                duplicadasB++;
                continue;
            }
            if (n === cap)
                crecer();
            idx.set(k, n);
            off[n] = f.offset;
            len[n] = f.largo;
            if (porNombre) {
                const [x, y] = huella(colsB.map(c => normValor(cells[c] ?? "")));
                h1[n] = x;
                h2[n] = y;
            }
            n++;
        }
    }, f => opts.onProgress?.(f * 0.45));
    if (!porNombre) {
        fijarColumnas(anchoB, anchoB);
        const TANDA = 50000;
        for (let s = 0; s < n; s += TANDA) {
            const pos = [];
            for (let i = s; i < Math.min(n, s + TANDA); i++)
                pos.push({ offset: off[i], largo: len[i] });
            const filas = await leerFilas(b, opts.bDelim, pos);
            filas.forEach((cells, k) => { const [x, y] = huella(colsB.map(c => normValor(cells[c] ?? ""))); h1[s + k] = x; h2[s + k] = y; });
        }
    }
    const header = ["estado", "clave", "columna", "valor_a", "valor_b"];
    writer.write(unirCsv(header, d) + "\n");
    const res: DiffResult = {
        filasA: 0,
        filasB,
        iguales: 0,
        cambiadas: 0,
        soloA: 0,
        soloB: 0,
        duplicadasA: 0,
        duplicadasB,
        porColumna: {},
        soloColumnasA,
        soloColumnasB,
        ejemplos: { cambiadas: [], soloA: [], soloB: [] },
        header,
    };
    const linea = (estado: string, clave: string, col: string, va: string, vb: string) => writer.write(unirCsv([estado, clave, col, va, vb], d) + "\n");
    let filaA = 0;
    await recorrer(a, opts.aDelim, chunkSize, opts.signal, async (filas) => {
        const pendientes: {
            clave: string;
            cellsA: string[];
            i: number;
        }[] = [];
        const salida: (string | number)[] = [];
        for (const f of filas) {
            if (filaA++ < aH)
                continue;
            res.filasA++;
            const cells = partirCsv(f.texto, opts.aDelim);
            const claveTxt = cells[opts.aKeyCol] ?? "";
            const i = idx.get(normClave(claveTxt));
            if (i === undefined) {
                res.soloA++;
                if (res.ejemplos.soloA.length < maxEj)
                    res.ejemplos.soloA.push(claveTxt);
                salida.push(unirCsv(["solo_a", claveTxt, "", "", ""], d) + "\n");
                continue;
            }
            if (vis[i]) {
                res.duplicadasA++;
                continue;
            }
            vis[i] = 1;
            const [x, y] = huella(colsA.map(c => normValor(cells[c] ?? "")));
            if (x === h1[i] && y === h2[i]) {
                res.iguales++;
                continue;
            }
            salida.push(pendientes.length);
            pendientes.push({ clave: claveTxt, cellsA: cells, i });
        }
        if (!pendientes.length) {
            for (const x of salida)
                writer.write(x as string);
            return;
        }
        const filasB = await leerFilas(b, opts.bDelim, pendientes.map(p => ({ offset: off[p.i], largo: len[p.i] })));
        for (const x of salida) {
            if (typeof x === "string") {
                writer.write(x);
                continue;
            }
            const p = pendientes[x], cellsB = filasB[x];
            const cambios: CambioCelda[] = [];
            colsA.forEach((ca, m) => {
                const va = p.cellsA[ca] ?? "", vb = cellsB[colsB[m]] ?? "";
                if (normValor(va) !== normValor(vb)) {
                    cambios.push({ columna: nombres[m], a: va, b: vb });
                    res.porColumna[nombres[m]] = (res.porColumna[nombres[m]] ?? 0) + 1;
                    linea("cambiada", p.clave, nombres[m], va, vb);
                }
            });
            if (cambios.length) {
                res.cambiadas++;
                if (res.ejemplos.cambiadas.length < maxEj)
                    res.ejemplos.cambiadas.push({ clave: p.clave, cambios });
            }
            else
                res.iguales++;
        }
    }, f => opts.onProgress?.(0.45 + f * 0.45));
    const TANDA = 50000;
    let tanda: number[] = [];
    const vaciar = async () => {
        if (!tanda.length)
            return;
        const filas = await leerFilas(b, opts.bDelim, tanda.map(i => ({ offset: off[i], largo: len[i] })));
        for (const cells of filas) {
            const clave = cells[opts.bKeyCol] ?? "";
            if (res.ejemplos.soloB.length < maxEj)
                res.ejemplos.soloB.push(clave);
            linea("solo_b", clave, "", "", "");
        }
        tanda = [];
    };
    for (let i = 0; i < n; i++) {
        if (vis[i])
            continue;
        res.soloB++;
        tanda.push(i);
        if (tanda.length >= TANDA)
            await vaciar();
    }
    await vaciar();
    opts.onProgress?.(1);
    return res;
}
