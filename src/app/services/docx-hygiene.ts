import PizZip from "pizzip";
export type CodigoDocx = "cambio-control" | "cambio-formato" | "comentario" | "comentario-resto" | "xml-personalizado" | "exif-imagen" | "metadatos";
export interface HallazgoDocx {
    codigo: CodigoDocx;
    gravedad: "critico" | "alto" | "aviso" | "info";
    muestra?: string;
    detalle?: Record<string, string>;
}
export interface AuditoriaDocx {
    hallazgos: HallazgoDocx[];
    limpio: boolean;
    error: string | null;
}
const PARTES_TEXTO = [
    "word/document.xml",
    "word/header1.xml",
    "word/header2.xml",
    "word/header3.xml",
    "word/footer1.xml",
    "word/footer2.xml",
    "word/footer3.xml",
    "word/footnotes.xml",
    "word/endnotes.xml",
];
function contar(xml: string, re: RegExp): number {
    return [...xml.matchAll(re)].length;
}
function muestraDeCambio(xml: string): string | undefined {
    const ins = xml.match(/<w:ins\b[^>]*>[\s\S]*?<w:t[^>]*>([^<]*)<\/w:t>/);
    if (ins?.[1]?.trim())
        return ins[1].trim();
    const del = xml.match(/<w:del\b[^>]*>[\s\S]*?<w:delText[^>]*>([^<]*)<\/w:delText>/);
    return del?.[1]?.trim() || undefined;
}
function tieneExifJpeg(bytes: Uint8Array): boolean {
    if (bytes.length < 4 || bytes[0] !== 255 || bytes[1] !== 216)
        return false;
    let i = 2;
    while (i + 4 <= bytes.length) {
        if (bytes[i] !== 255)
            break;
        const marcador = bytes[i + 1];
        if (marcador === 216 || marcador === 217 || marcador === 218)
            break;
        const largo = (bytes[i + 2] << 8) | bytes[i + 3];
        if (largo < 2)
            break;
        if (marcador === 225 && largo >= 8) {
            const firma = String.fromCharCode(...bytes.slice(i + 4, i + 8));
            if (firma === "Exif")
                return true;
        }
        i += 2 + largo;
    }
    return false;
}
function campoXml(xml: string, etiqueta: string): string | undefined {
    return xml.match(new RegExp(`<${etiqueta}[^>]*>([^<]*)</${etiqueta}>`))?.[1]?.trim() || undefined;
}
function esZip(datos: ArrayBuffer | Uint8Array): boolean {
    const b = datos instanceof Uint8Array ? datos : new Uint8Array(datos);
    return b.length >= 4 && b[0] === 80 && b[1] === 75 && (b[2] === 3 || b[2] === 5 || b[2] === 7);
}
export async function auditarDocx(bytes: Uint8Array): Promise<AuditoriaDocx> {
    if (!esZip(bytes))
        return { hallazgos: [], limpio: true, error: "no-docx" };
    let zip: PizZip;
    try {
        zip = new PizZip(bytes);
    }
    catch (e) {
        return { hallazgos: [], limpio: true, error: e instanceof Error ? e.message : String(e) };
    }
    if (!zip.file("word/document.xml"))
        return { hallazgos: [], limpio: true, error: "no-docx-xml" };
    const hallazgos: HallazgoDocx[] = [];
    let ins = 0, del = 0, fmt = 0;
    let muestra: string | undefined;
    for (const ruta of PARTES_TEXTO) {
        const f = zip.file(ruta);
        if (!f)
            continue;
        const xml = f.asText();
        const nIns = contar(xml, /<w:ins\b/g), nDel = contar(xml, /<w:del\b/g);
        ins += nIns;
        del += nDel;
        if ((nIns || nDel) && !muestra)
            muestra = muestraDeCambio(xml);
        fmt += contar(xml, /<w:pPrChange\b/g) + contar(xml, /<w:rPrChange\b/g);
    }
    if (ins || del) {
        hallazgos.push({ codigo: "cambio-control", gravedad: "critico", muestra, detalle: { inserciones: String(ins), borrados: String(del) } });
    }
    if (fmt)
        hallazgos.push({ codigo: "cambio-formato", gravedad: "aviso", detalle: { n: String(fmt) } });
    const comentarios = zip.file("word/comments.xml");
    const nComentarios = comentarios ? contar(comentarios.asText(), /<w:comment\b/g) : 0;
    if (nComentarios)
        hallazgos.push({ codigo: "comentario", gravedad: "alto", detalle: { n: String(nComentarios) } });
    const restos = ["word/commentsExtended.xml", "word/commentsIds.xml", "word/people.xml"].filter(r => zip.file(r));
    if (restos.length && !nComentarios) {
        hallazgos.push({ codigo: "comentario-resto", gravedad: "aviso", detalle: { partes: restos.join(", ") } });
    }
    const customXml = Object.keys(zip.files).filter(n => /^customXml\/item\d+\.xml$/.test(n));
    if (customXml.length)
        hallazgos.push({ codigo: "xml-personalizado", gravedad: "aviso", detalle: { n: String(customXml.length) } });
    const imagenes = Object.keys(zip.files).filter(n => /^word\/media\/.*\.jpe?g$/i.test(n));
    const conExif = imagenes.filter(ruta => tieneExifJpeg(zip.file(ruta)!.asUint8Array())).length;
    if (conExif)
        hallazgos.push({ codigo: "exif-imagen", gravedad: "aviso", detalle: { n: String(conExif) } });
    const core = zip.file("docProps/core.xml")?.asText() ?? "";
    const app = zip.file("docProps/app.xml")?.asText() ?? "";
    const autor = campoXml(core, "dc:creator");
    const ultimo = campoXml(core, "cp:lastModifiedBy");
    const titulo = campoXml(core, "dc:title");
    const empresa = campoXml(app, "Company");
    const detalleMeta: Record<string, string> = {};
    if (autor)
        detalleMeta["autor"] = autor;
    if (ultimo && ultimo !== autor)
        detalleMeta["ultimo"] = ultimo;
    if (titulo)
        detalleMeta["titulo"] = titulo;
    if (empresa)
        detalleMeta["empresa"] = empresa;
    if (Object.keys(detalleMeta).length)
        hallazgos.push({ codigo: "metadatos", gravedad: "info", detalle: detalleMeta });
    const orden = { critico: 0, alto: 1, aviso: 2, info: 3 } as const;
    hallazgos.sort((a, b) => orden[a.gravedad] - orden[b.gravedad]);
    const limpio = !hallazgos.some(h => h.gravedad === "critico" || h.gravedad === "alto");
    return { hallazgos, limpio, error: null };
}
