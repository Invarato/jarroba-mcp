import { auditarDocx, type CodigoDocx, type HallazgoDocx } from "../../src/app/services/docx-hygiene";
import { auditarXlsx, type CodigoXlsx, type HallazgoXlsx } from "../../src/app/services/xlsx-hygiene";
const GRAVEDAD = { critico: "critical", alto: "high", aviso: "warning", info: "info" } as const;
const DOCX: {
    [K in CodigoDocx]: {
        code: string;
        detail: (h: HallazgoDocx) => string;
    };
} = {
    "cambio-control": { code: "tracked-changes", detail: (h) => `${h.detalle?.["inserciones"] ?? "?"} insertion(s) and ${h.detalle?.["borrados"] ?? "?"} deletion(s) neither accepted nor rejected. The "No Markup" / "Final" view only HIDES them: they are still in the file, and anyone can show them again. Accept or reject them all (Review → Accept All Changes) before sending.` },
    "cambio-formato": { code: "tracked-formatting", detail: (h) => `${h.detalle?.["n"] ?? "?"} formatting change(s) still tracked (they keep the previous formatting in the file).` },
    comentario: { code: "comments", detail: (h) => `${h.detalle?.["n"] ?? "?"} live comment(s), with their authors.` },
    "comentario-resto": { code: "comment-leftovers", detail: (h) => `No live comments, but comment parts remain (${h.detalle?.["partes"] ?? "?"}): they can still hold the names of the people who commented.` },
    "xml-personalizado": { code: "custom-xml", detail: (h) => `${h.detalle?.["n"] ?? "?"} custom XML part(s), left by a company template or add-in: they can carry internal identifiers or metadata.` },
    "exif-imagen": { code: "image-exif", detail: (h) => `${h.detalle?.["n"] ?? "?"} embedded JPEG image(s) carry EXIF metadata (date, camera, sometimes GPS position).` },
    metadatos: { code: "metadata", detail: () => "Document properties name people or the company." },
};
const XLSX: {
    [K in CodigoXlsx]: {
        code: string;
        detail: (h: HallazgoXlsx) => string;
    };
} = {
    "hoja-muy-oculta": { code: "very-hidden-sheet", detail: (h) => `Sheet "${h.hoja}" is VERY hidden (state="veryHidden") and has data: Excel's interface cannot even list it, only a macro or a script; Office's Document Inspector does not look at it.` },
    "hoja-oculta": { code: "hidden-sheet", detail: (h) => `Sheet "${h.hoja}" is hidden and has data: Format → Unhide shows it again.` },
    "cache-dinamica": { code: "pivot-cache", detail: (h) => `A pivot table cache holds ${h.detalle?.["registros"] ?? "?"} source record(s), more than the table shows, and survives deleting the source sheet. This is how the PSNI (2023) and Royal Cornwall Hospitals (2025) leaked thousands of people's data.` },
    "fila-oculta": { code: "hidden-rows", detail: (h) => `${h.detalle?.["n"] ?? "?"} hidden row(s) with data.` },
    "columna-oculta": { code: "hidden-columns", detail: (h) => `${h.detalle?.["n"] ?? "?"} hidden column range(s) (contents not checked).` },
    comentario: { code: "comments", detail: () => "Comments with their authors' names." },
    metadatos: { code: "metadata", detail: () => "Document properties name people or the company." },
};
const META: [
    string,
    string,
    string
][] = [["autor", "author", "author"], ["ultimo", "lastModifiedBy", "last modified by"], ["titulo", "title", "title"], ["empresa", "company", "company"]];
const propiedades = (d?: Record<string, string>) => {
    const out: Record<string, string> = {};
    for (const [es, en] of META)
        if (d?.[es])
            out[en] = d[es];
    return out;
};
const lineaMeta = (d?: Record<string, string>) => META.filter(([es]) => d?.[es]).map(([es, , txt]) => `${txt}: ${d![es]}`).join(" \u00B7 ");
export type TipoDoc = "docx" | "xlsx";
export const tipoDe = (ruta: string): TipoDoc | null => (/\.(docx|docm|dotx)$/i.test(ruta) ? "docx" : /\.(xlsx|xlsm|xltx)$/i.test(ruta) ? "xlsx" : null);
export async function higiene(bytes: Uint8Array, tipo: TipoDoc) {
    const r = tipo === "docx" ? await auditarDocx(bytes) : await auditarXlsx(bytes);
    if (r.error) {
        const malo = r.error === "no-docx" || r.error === "no-xlsx" ? "It is not a ZIP-based Office file (an old binary .doc/.xls, or a different format)."
            : r.error === "no-docx-xml" ? "It is a ZIP but has no word/document.xml: not a Word document."
                : r.error === "no-xlsx-xml" ? "It is a ZIP but has no xl/workbook.xml: not an Excel workbook."
                    : `The ZIP could not be opened: ${r.error}`;
        return { error: malo };
    }
    const findings = r.hallazgos.map((h) => {
        const t = tipo === "docx" ? DOCX[h.codigo as CodigoDocx] : XLSX[h.codigo as CodigoXlsx];
        const meta = h.codigo === "metadatos";
        const muestra = meta ? lineaMeta(h.detalle) : h.muestra;
        return {
            code: t.code,
            severity: GRAVEDAD[h.gravedad],
            ...("hoja" in h && h.hoja ? { sheet: h.hoja } : {}),
            detail: t.detail(h as never),
            ...(meta ? { properties: propiedades(h.detalle) } : {}),
            ...(muestra ? { sample: muestra } : {}),
        };
    });
    return {
        format: tipo,
        clean: r.limpio,
        verdict: r.limpio
            ? (findings.length ? "Nothing critical or high: only metadata or minor leftovers (listed). Fine to send if those are acceptable." : "Nothing hidden found.")
            : `NOT clean: ${findings.filter((f) => f.severity === "critical" || f.severity === "high").length} critical or high finding(s). Fix them before sending this file outside.`,
        findings,
        notes: [
            "Read only: nothing is changed or cleaned. Accepting all changes, deleting comments and removing hidden sheets is a separate, explicit step.",
            "What is checked: tracked changes and comments (also in headers, footers and notes), custom XML, image EXIF and properties for Word; hidden and very hidden sheets, pivot caches, hidden rows and columns, comments and properties for Excel. Not checked: macros, embedded objects, external links, PDF.",
        ],
    };
}
