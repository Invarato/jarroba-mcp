export type Categoria = "etiquetas" | "selectores" | "bits" | "ancho-cero" | "bidi" | "control" | "espacios" | "homoglifos";
export type Gravedad = "grave" | "aviso" | "legitimo";
export interface Hallazgo {
    categoria: Categoria;
    gravedad: Gravedad;
    inicio: number;
    fin: number;
    codepoints: number[];
    decodificado?: string;
    palabra?: string;
    motivo?: "emoji" | "bandera" | "escritura" | "bom-inicial" | "selector-simple" | "texto-rtl";
}
export interface Segmento {
    texto: string;
    hallazgo: Hallazgo | null;
}
export interface Analisis {
    hallazgos: Hallazgo[];
    porCategoria: Partial<Record<Categoria, number>>;
    mensajes: {
        categoria: Categoria;
        texto: string;
    }[];
    graves: number;
    avisos: number;
    legitimos: number;
}
const cp = (s: string, i: number) => s.codePointAt(i) ?? 0;
const hex = (n: number) => "U+" + n.toString(16).toUpperCase().padStart(4, "0");
export { hex as codepointHex };
const esPictografico = (c: number) => /\p{Extended_Pictographic}/u.test(String.fromCodePoint(c));
const esModificadorEmoji = (c: number) => c >= 127995 && c <= 127999;
const esLetraNoLatina = (c: number) => {
    const ch = String.fromCodePoint(c);
    return /\p{L}|\p{M}/u.test(ch) && !/\p{Script=Latin}|\p{Script=Common}/u.test(ch);
};
const esRtl = (c: number) => /\p{Script=Arabic}|\p{Script=Hebrew}|\p{Script=Syriac}|\p{Script=Thaana}/u.test(String.fromCodePoint(c));
const esEtiqueta = (c: number) => c >= 917504 && c <= 917631;
const esSelector = (c: number) => (c >= 65024 && c <= 65039) || (c >= 917760 && c <= 917999);
const esBit = (c: number) => c === 8290 || c === 8292;
const ANCHO_CERO = new Set([8203, 8204, 8205, 8288, 65279, 6158]);
const BIDI_FUERTE = new Set([8234, 8235, 8236, 8237, 8238, 8294, 8295, 8296, 8297]);
const BIDI_MARCA = new Set([8206, 8207, 1564]);
const OTROS_INVISIBLES = new Set([173, 847, 4447, 4448, 6068, 6069, 8289, 8291, 12644, 65440, 65529, 65530, 65531]);
const ESPACIOS_RAROS = new Set([160, 8192, 8193, 8194, 8195, 8196, 8197, 8198, 8199, 8200, 8201, 8202, 8239, 8287, 12288]);
function esControl(c: number): boolean {
    if (c === 9 || c === 10 || c === 13)
        return false;
    return c < 32 || (c >= 127 && c <= 159) || OTROS_INVISIBLES.has(c) || (c >= 119155 && c <= 119162);
}
export function decodificarEtiquetas(cps: number[]): string {
    return cps.filter(c => c >= 917536 && c <= 917630).map(c => String.fromCharCode(c - 917504)).join("");
}
export function decodificarSelectores(cps: number[]): string | null {
    const bytes = cps.map(c => c >= 917760 ? c - 917760 + 16 : c - 65024);
    try {
        return new TextDecoder("utf-8", { fatal: true }).decode(new Uint8Array(bytes));
    }
    catch {
        return null;
    }
}
export function decodificarBits(cps: number[]): string | null {
    if (cps.length < 8 || cps.length % 8 !== 0)
        return null;
    const bytes: number[] = [];
    for (let i = 0; i < cps.length; i += 8) {
        let b = 0;
        for (let j = 0; j < 8; j++)
            b = (b << 1) | (cps[i + j] === 8292 ? 1 : 0);
        bytes.push(b);
    }
    try {
        return new TextDecoder("utf-8", { fatal: true }).decode(new Uint8Array(bytes));
    }
    catch {
        return null;
    }
}
interface Cp {
    c: number;
    i: number;
    n: number;
}
function codepoints(texto: string): Cp[] {
    const out: Cp[] = [];
    for (let i = 0; i < texto.length;) {
        const c = cp(texto, i);
        const n = c > 65535 ? 2 : 1;
        out.push({ c, i, n });
        i += n;
    }
    return out;
}
function homoglifos(texto: string): Hallazgo[] {
    const out: Hallazgo[] = [];
    for (const m of texto.matchAll(/[\p{L}\p{M}\p{N}\p{Cf}_-]+/gu)) {
        const w = m[0];
        const latin = /\p{Script=Latin}/u.test(w);
        const otro = /\p{Script=Cyrillic}|\p{Script=Greek}|\p{Script=Armenian}/u.test(w);
        if (latin && otro) {
            out.push({
                categoria: "homoglifos",
                gravedad: "grave",
                inicio: m.index!,
                fin: m.index! + w.length,
                palabra: w,
                codepoints: [...w].map(ch => ch.codePointAt(0)!).filter(c => /\p{Script=Cyrillic}|\p{Script=Greek}|\p{Script=Armenian}/u.test(String.fromCodePoint(c))),
            });
        }
    }
    return out;
}
export function analizarTexto(texto: string): Analisis {
    const cps = codepoints(texto);
    const h: Hallazgo[] = [];
    const tramo = (desde: number, hasta: number) => ({ inicio: cps[desde].i, fin: cps[hasta].i + cps[hasta].n, codepoints: cps.slice(desde, hasta + 1).map(x => x.c) });
    for (let k = 0; k < cps.length; k++) {
        const { c } = cps[k];
        const prev = k > 0 ? cps[k - 1].c : -1;
        if (esEtiqueta(c)) {
            let f = k;
            while (f + 1 < cps.length && esEtiqueta(cps[f + 1].c))
                f++;
            const t = tramo(k, f);
            const bandera = prev === 127988 && cps[f].c === 917631
                && t.codepoints.slice(0, -1).every(x => (x >= 917601 && x <= 917626) || (x >= 917552 && x <= 917561));
            if (bandera)
                h.push({ categoria: "etiquetas", gravedad: "legitimo", motivo: "bandera", ...t });
            else
                h.push({ categoria: "etiquetas", gravedad: "grave", decodificado: decodificarEtiquetas(t.codepoints) || undefined, ...t });
            k = f;
            continue;
        }
        if (esSelector(c)) {
            let f = k;
            while (f + 1 < cps.length && esSelector(cps[f + 1].c))
                f++;
            const t = tramo(k, f);
            if (f === k)
                h.push({ categoria: "selectores", gravedad: "legitimo", motivo: "selector-simple", ...t });
            else
                h.push({ categoria: "selectores", gravedad: "grave", decodificado: decodificarSelectores(t.codepoints) ?? undefined, ...t });
            k = f;
            continue;
        }
        if (esBit(c)) {
            let f = k;
            while (f + 1 < cps.length && esBit(cps[f + 1].c))
                f++;
            const t = tramo(k, f);
            const dec = decodificarBits(t.codepoints);
            h.push({ categoria: f - k + 1 >= 8 ? "bits" : "control", gravedad: f - k + 1 >= 8 ? "grave" : "aviso", decodificado: dec ?? undefined, ...t });
            k = f;
            continue;
        }
        if (ANCHO_CERO.has(c)) {
            const next = k + 1 < cps.length ? cps[k + 1].c : -1;
            const t = tramo(k, k);
            if (c === 65279 && k === 0)
                h.push({ categoria: "ancho-cero", gravedad: "legitimo", motivo: "bom-inicial", ...t });
            else if (c === 8205 && (esPictografico(prev) || esModificadorEmoji(prev) || prev === 65039) && esPictografico(next))
                h.push({ categoria: "ancho-cero", gravedad: "legitimo", motivo: "emoji", ...t });
            else if ((c === 8204 || c === 8205) && (esLetraNoLatina(prev) || esLetraNoLatina(next)))
                h.push({ categoria: "ancho-cero", gravedad: "legitimo", motivo: "escritura", ...t });
            else
                h.push({ categoria: "ancho-cero", gravedad: "grave", ...t });
            continue;
        }
        if (BIDI_FUERTE.has(c)) {
            h.push({ categoria: "bidi", gravedad: "grave", ...tramo(k, k) });
            continue;
        }
        if (BIDI_MARCA.has(c)) {
            const rtlCerca = cps.slice(Math.max(0, k - 20), k + 20).some(x => esRtl(x.c));
            h.push(rtlCerca ? { categoria: "bidi", gravedad: "legitimo", motivo: "texto-rtl", ...tramo(k, k) } : { categoria: "bidi", gravedad: "aviso", ...tramo(k, k) });
            continue;
        }
        if (esControl(c)) {
            h.push({ categoria: "control", gravedad: c === 173 ? "aviso" : "grave", ...tramo(k, k) });
            continue;
        }
        if (ESPACIOS_RAROS.has(c)) {
            h.push({ categoria: "espacios", gravedad: "aviso", ...tramo(k, k) });
            continue;
        }
    }
    h.push(...homoglifos(texto));
    h.sort((a, b) => a.inicio - b.inicio);
    const porCategoria: Partial<Record<Categoria, number>> = {};
    for (const x of h)
        if (x.gravedad !== "legitimo")
            porCategoria[x.categoria] = (porCategoria[x.categoria] ?? 0) + 1;
    return {
        hallazgos: h,
        porCategoria,
        mensajes: h.filter(x => x.decodificado).map(x => ({ categoria: x.categoria, texto: x.decodificado! })),
        graves: h.filter(x => x.gravedad === "grave").length,
        avisos: h.filter(x => x.gravedad === "aviso").length,
        legitimos: h.filter(x => x.gravedad === "legitimo").length,
    };
}
export function segmentar(texto: string, a: Analisis): Segmento[] {
    const invisibles = a.hallazgos.filter(x => x.categoria !== "homoglifos");
    const palabras = a.hallazgos.filter(x => x.categoria === "homoglifos");
    const marcas = [...invisibles];
    for (const p of palabras)
        if (!invisibles.some(i => i.inicio < p.fin && i.fin > p.inicio))
            marcas.push(p);
    marcas.sort((x, y) => x.inicio - y.inicio);
    const out: Segmento[] = [];
    let pos = 0;
    for (const m of marcas) {
        if (m.inicio < pos)
            continue;
        if (m.inicio > pos)
            out.push({ texto: texto.slice(pos, m.inicio), hallazgo: null });
        out.push({ texto: texto.slice(m.inicio, m.fin), hallazgo: m });
        pos = m.fin;
    }
    if (pos < texto.length)
        out.push({ texto: texto.slice(pos), hallazgo: null });
    return out;
}
export interface OpcionesLimpieza {
    normalizarEspacios: boolean;
    conservarLegitimo: boolean;
}
export function limpiarTexto(texto: string, a: Analisis, o: OpcionesLimpieza): string {
    let out = "";
    let pos = 0;
    for (const x of a.hallazgos) {
        if (x.categoria === "homoglifos" || x.inicio < pos)
            continue;
        if (x.gravedad === "legitimo" && o.conservarLegitimo)
            continue;
        out += texto.slice(pos, x.inicio);
        if (x.categoria === "espacios")
            out += o.normalizarEspacios ? " " : texto.slice(x.inicio, x.fin);
        pos = x.fin;
    }
    return out + texto.slice(pos);
}
