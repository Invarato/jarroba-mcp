import { ApiCampo, ApiColeccion, ApiCuerpo, ApiPeticion, ResultadoImport, campo, cuerpoVacio, authVacia, peticionVacia, partirUrl, } from "./api-ir";
export function esHar(x: unknown): boolean {
    if (!esObj(x))
        return false;
    const log = x["log"];
    return esObj(log) && Array.isArray(log["entries"]);
}
export interface OpcionesHar {
    soloApi?: boolean;
    sinCache?: boolean;
}
const RUIDO = /^(image|font|video|audio)\//;
const RUIDO_EXTRA = /^(text\/css|text\/javascript|application\/javascript|application\/x-javascript)/;
const EXT_RUIDO = /\.(png|jpe?g|gif|webp|avif|svg|ico|woff2?|ttf|eot|css|m?js|map)(\?|$)/i;
export function leerHar(texto: string, op: OpcionesHar = {}): ResultadoImport {
    let raiz: unknown;
    try {
        raiz = JSON.parse(texto);
    }
    catch (e) {
        return { ok: false, error: `No es JSON válido: ${(e as Error).message}` };
    }
    if (!esHar(raiz))
        return { ok: false, error: "No parece un HAR: falta \u00ABlog.entries\u00BB." };
    const soloApi = op.soloApi ?? true;
    const sinCache = op.sinCache ?? false;
    const log = (raiz as Record<string, unknown>)["log"] as Record<string, unknown>;
    const entries = (log["entries"] as unknown[]).filter(esObj);
    const avisos: string[] = [];
    const peticiones: ApiPeticion[] = [];
    let descartadas = 0;
    let deCache = 0;
    for (const e of entries) {
        const req = e["request"];
        if (!esObj(req))
            continue;
        if (sinCache && servidoDeCache(e)) {
            deCache++;
            continue;
        }
        if (soloApi && esRuido(e, req)) {
            descartadas++;
            continue;
        }
        peticiones.push(unaPeticion(req, e));
    }
    if (descartadas) {
        avisos.push(`Se dejaron fuera ${descartadas} petición(es) de recursos (imágenes, CSS, fuentes, scripts). Desactiva el filtro para verlas.`);
    }
    if (deCache)
        avisos.push(`Se dejaron fuera ${deCache} respuesta(s) servidas desde la caché del navegador.`);
    avisos.push("Un HAR guarda las cabeceras TAL CUAL se enviaron: cookies de sesi\u00F3n, \u00ABAuthorization\u00BB y " +
        "cuerpos de formulario. Revisa lo importado antes de compartirlo con nadie.");
    if (!peticiones.length) {
        return { ok: false, error: descartadas
                ? `Las ${descartadas} entradas del HAR eran recursos (imágenes, CSS…). Desactiva el filtro para importarlas.`
                : "El HAR no contiene ninguna petici\u00F3n." };
    }
    return { ok: true, avisos, coleccion: { nombre: nombreDe(log), variables: [], peticiones } };
}
function servidoDeCache(e: Record<string, unknown>): boolean {
    const res = e["response"];
    if (!esObj(res))
        return false;
    const desdeRed = num(res["bodySize"]);
    const estado = num(res["status"]);
    if (estado === 304)
        return false;
    return e["_fromCache"] !== undefined || (desdeRed === 0 && num(res["_transferSize"]) === 0 && estado === 200);
}
function esRuido(e: Record<string, unknown>, req: Record<string, unknown>): boolean {
    const res = e["response"];
    const mime = esObj(res) && esObj(res["content"]) ? txt(res["content"]["mimeType"]) : "";
    if (RUIDO.test(mime) || RUIDO_EXTRA.test(mime))
        return true;
    if (!mime && EXT_RUIDO.test(txt(req["url"])))
        return true;
    return false;
}
function unaPeticion(req: Record<string, unknown>, e: Record<string, unknown>): ApiPeticion {
    const urlCruda = txt(req["url"]);
    const { base, query } = partirUrl(urlCruda);
    const p = peticionVacia({
        metodo: (txt(req["method"]) || "GET").toUpperCase(),
        url: base,
        query: campos(req["queryString"], "name").length ? campos(req["queryString"], "name") : query,
        headers: cabeceras(req["headers"]),
        cuerpo: leerCuerpo(req["postData"]),
    });
    const res = e["response"];
    if (esObj(res)) {
        const st = num(res["status"]);
        if (st)
            p.docs = `Respondió ${st} ${txt(res["statusText"])}`.trim();
    }
    p.nombre = `${p.metodo} ${ultimoTramo(base)}`;
    return p;
}
function cabeceras(x: unknown): ApiCampo[] {
    const fuera = new Set(["content-length", "host", "connection", "transfer-encoding"]);
    return campos(x, "name").filter(c => !c.nombre.startsWith(":") && !fuera.has(c.nombre.toLowerCase()));
}
function campos(x: unknown, clave: string): ApiCampo[] {
    if (!Array.isArray(x))
        return [];
    const out: ApiCampo[] = [];
    for (const c of x) {
        if (!esObj(c))
            continue;
        const nombre = txt(c[clave]);
        if (nombre)
            out.push(campo(nombre, txt(c["value"])));
    }
    return out;
}
function leerCuerpo(pd: unknown): ApiCuerpo {
    if (!esObj(pd))
        return cuerpoVacio();
    const mime = txt(pd["mimeType"]).toLowerCase();
    if (Array.isArray(pd["params"]) && pd["params"].length) {
        const cs = campos(pd["params"], "name");
        return mime.includes("multipart")
            ? { tipo: "form-data", campos: cs }
            : { tipo: "urlencoded", campos: cs };
    }
    const t = txt(pd["text"]);
    if (!t)
        return cuerpoVacio();
    if (mime.includes("json"))
        return { tipo: "json", texto: t };
    if (mime.includes("xml"))
        return { tipo: "xml", texto: t };
    if (mime.includes("urlencoded"))
        return { tipo: "urlencoded", campos: partirUrl(`?${t}`).query };
    return { tipo: "texto", texto: t };
}
function nombreDe(log: Record<string, unknown>): string {
    const pages = log["pages"];
    if (Array.isArray(pages) && esObj(pages[0])) {
        const t = txt(pages[0]["title"]);
        if (t)
            return `HAR · ${t}`;
    }
    return "Importado de HAR";
}
function ultimoTramo(url: string): string {
    const sin = url.replace(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//, "");
    const barra = sin.indexOf("/");
    if (barra < 0)
        return sin;
    const tramos = sin.slice(barra + 1).split("/").filter(Boolean);
    const util = [...tramos].reverse().find(t => !/^\d+$/.test(t) && !/^[0-9a-f-]{8,}$/i.test(t));
    return util ?? sin.slice(0, barra);
}
function esObj(x: unknown): x is Record<string, unknown> {
    return typeof x === "object" && x !== null && !Array.isArray(x);
}
function txt(x: unknown): string {
    return typeof x === "string" ? x : "";
}
function num(x: unknown): number {
    return typeof x === "number" ? x : 0;
}
