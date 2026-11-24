import PizZip from "pizzip";
export type CodigoXlsx = "hoja-oculta" | "hoja-muy-oculta" | "cache-dinamica" | "fila-oculta" | "columna-oculta" | "comentario" | "metadatos";
export interface HallazgoXlsx {
    codigo: CodigoXlsx;
    gravedad: "critico" | "alto" | "aviso" | "info";
    hoja?: string;
    muestra?: string;
    detalle?: Record<string, string>;
}
export interface AuditoriaXlsx {
    hallazgos: HallazgoXlsx[];
    limpio: boolean;
    error: string | null;
}
function contar(xml: string, re: RegExp): number {
    return [...xml.matchAll(re)].length;
}
function esZip(datos: ArrayBuffer | Uint8Array): boolean {
    const b = datos instanceof Uint8Array ? datos : new Uint8Array(datos);
    return b.length >= 4 && b[0] === 80 && b[1] === 75 && (b[2] === 3 || b[2] === 5 || b[2] === 7);
}
function campoXml(xml: string, etiqueta: string): string | undefined {
    return xml.match(new RegExp(`<${etiqueta}[^>]*>([^<]*)</${etiqueta}>`))?.[1]?.trim() || undefined;
}
function relacionesDelLibro(zip: PizZip): Map<string, string> {
    const rels = zip.file("xl/_rels/workbook.xml.rels")?.asText() ?? "";
    const mapa = new Map<string, string>();
    for (const m of rels.matchAll(/<Relationship\b[^>]*\bId="([^"]+)"[^>]*\bTarget="([^"]+)"/g))
        mapa.set(m[1], m[2]);
    return mapa;
}
interface HojaLibro {
    nombre: string;
    estado: string | null;
    ruta: string | null;
}
function hojasDelLibro(zip: PizZip): HojaLibro[] {
    const wb = zip.file("xl/workbook.xml")?.asText() ?? "";
    const rels = relacionesDelLibro(zip);
    return [...wb.matchAll(/<sheet\b([^>]*)\/>/g)].map(m => {
        const attrs = m[1];
        const nombre = attrs.match(/\bname="([^"]*)"/)?.[1] ?? "";
        const estado = attrs.match(/\bstate="([^"]*)"/)?.[1] ?? null;
        const rid = attrs.match(/\br:id="([^"]*)"/)?.[1];
        const target = rid ? rels.get(rid) : undefined;
        return { nombre, estado, ruta: target ? `xl/${target.replace(/^\/?xl\//, "")}` : null };
    });
}
function hojaTieneDatos(zip: PizZip, ruta: string | null): boolean {
    const xml = ruta ? zip.file(ruta)?.asText() : undefined;
    return !!xml && /<c\b[^>]*>\s*(<f\b|<v\b|<is\b)/.test(xml);
}
function filasOcultasConDatos(xml: string): number {
    let n = 0;
    for (const m of xml.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/g)) {
        if (/\bhidden="1"/.test(m[1]) && /<c\b[^>]*>\s*(<f\b|<v\b|<is\b)/.test(m[2]))
            n++;
    }
    return n;
}
function columnasOcultas(xml: string): number {
    let n = 0;
    for (const m of xml.matchAll(/<col\b[^>]*\/>/g)) {
        if (!/\bhidden="1"/.test(m[0]))
            continue;
        const min = Number(m[0].match(/\bmin="(\d+)"/)?.[1] ?? "0");
        const max = Number(m[0].match(/\bmax="(\d+)"/)?.[1] ?? String(min));
        if (min && max >= min)
            n += max - min + 1;
    }
    return n;
}
export async function auditarXlsx(bytes: Uint8Array): Promise<AuditoriaXlsx> {
    if (!esZip(bytes))
        return { hallazgos: [], limpio: true, error: "no-xlsx" };
    let zip: PizZip;
    try {
        zip = new PizZip(bytes);
    }
    catch (e) {
        return { hallazgos: [], limpio: true, error: e instanceof Error ? e.message : String(e) };
    }
    if (!zip.file("xl/workbook.xml"))
        return { hallazgos: [], limpio: true, error: "no-xlsx-xml" };
    const hallazgos: HallazgoXlsx[] = [];
    for (const hoja of hojasDelLibro(zip)) {
        if (hoja.estado !== "hidden" && hoja.estado !== "veryHidden")
            continue;
        if (!hojaTieneDatos(zip, hoja.ruta))
            continue;
        hallazgos.push({
            codigo: hoja.estado === "veryHidden" ? "hoja-muy-oculta" : "hoja-oculta",
            gravedad: hoja.estado === "veryHidden" ? "critico" : "alto",
            hoja: hoja.nombre,
        });
    }
    let filas = 0, columnas = 0;
    for (const ruta of Object.keys(zip.files).filter(n => /^xl\/worksheets\/sheet\d+\.xml$/.test(n))) {
        const xml = zip.file(ruta)!.asText();
        filas += filasOcultasConDatos(xml);
        columnas += columnasOcultas(xml);
    }
    if (filas)
        hallazgos.push({ codigo: "fila-oculta", gravedad: "alto", detalle: { n: String(filas) } });
    if (columnas)
        hallazgos.push({ codigo: "columna-oculta", gravedad: "aviso", detalle: { n: String(columnas) } });
    for (const ruta of Object.keys(zip.files).filter(n => /^xl\/pivotCache\/pivotCacheRecords\d*\.xml$/.test(n))) {
        const n = contar(zip.file(ruta)!.asText(), /<r>/g);
        if (n)
            hallazgos.push({ codigo: "cache-dinamica", gravedad: "alto", detalle: { registros: String(n) } });
    }
    const autores = new Set<string>();
    for (const ruta of Object.keys(zip.files).filter(n => /^xl\/comments\d*\.xml$/.test(n))) {
        for (const m of zip.file(ruta)!.asText().matchAll(/<author>([^<]*)<\/author>/g))
            if (m[1])
                autores.add(m[1]);
    }
    if (autores.size)
        hallazgos.push({ codigo: "comentario", gravedad: "aviso", muestra: [...autores].join(", ") });
    const core = zip.file("docProps/core.xml")?.asText() ?? "";
    const app = zip.file("docProps/app.xml")?.asText() ?? "";
    const autor = campoXml(core, "dc:creator");
    const ultimo = campoXml(core, "cp:lastModifiedBy");
    const empresa = campoXml(app, "Company");
    const detalleMeta: Record<string, string> = {};
    if (autor)
        detalleMeta["autor"] = autor;
    if (ultimo && ultimo !== autor)
        detalleMeta["ultimo"] = ultimo;
    if (empresa)
        detalleMeta["empresa"] = empresa;
    if (Object.keys(detalleMeta).length)
        hallazgos.push({ codigo: "metadatos", gravedad: "info", detalle: detalleMeta });
    const orden = { critico: 0, alto: 1, aviso: 2, info: 3 } as const;
    hallazgos.sort((a, b) => orden[a.gravedad] - orden[b.gravedad]);
    const limpio = !hallazgos.some(h => h.gravedad === "critico" || h.gravedad === "alto");
    return { hallazgos, limpio, error: null };
}
