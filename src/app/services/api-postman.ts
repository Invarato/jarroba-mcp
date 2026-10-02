import { ApiAuth, ApiCampo, ApiColeccion, ApiCuerpo, ApiPeticion, ResultadoImport, TipoCuerpo, campo, cuerpoVacio, authVacia, peticionVacia, partirUrl, unirUrl, } from "./api-ir";
export function esPostman(x: unknown): boolean {
    if (!esObjeto(x))
        return false;
    const info = x["info"];
    if (esObjeto(info) && typeof info["schema"] === "string" && info["schema"].includes("getpostman.com"))
        return true;
    return esObjeto(info) && "name" in info && Array.isArray(x["item"]);
}
export function leerPostman(texto: string): ResultadoImport {
    let raiz: unknown;
    try {
        raiz = JSON.parse(texto);
    }
    catch (e) {
        return { ok: false, error: `No es JSON válido: ${(e as Error).message}` };
    }
    if (!esObjeto(raiz))
        return { ok: false, error: "El JSON no es un objeto." };
    if (!Array.isArray(raiz["item"])) {
        return { ok: false, error: "No parece una colecci\u00F3n de Postman: le falta la lista \u00ABitem\u00BB." };
    }
    const avisos: string[] = [];
    const peticiones: ApiPeticion[] = [];
    const info = esObjeto(raiz["info"]) ? raiz["info"] : {};
    recorrer(raiz["item"], [], peticiones, avisos);
    const variables = leerVariables(raiz["variable"], avisos);
    const nScripts = contarScripts(raiz);
    if (nScripts) {
        avisos.push(`La colección trae ${nScripts} script(s) de Postman (pre-request / test). No se traducen: ` +
            `son código contra el runtime de Postman (pm.*), que no existe fuera de él. Quedan fuera de la conversión.`);
    }
    return {
        ok: true,
        avisos,
        coleccion: {
            nombre: typeof info["name"] === "string" ? info["name"] : "Colecci\u00F3n de Postman",
            variables,
            peticiones,
        },
    };
}
function recorrer(items: unknown[], ruta: string[], out: ApiPeticion[], avisos: string[]): void {
    for (const it of items) {
        if (!esObjeto(it))
            continue;
        const nombre = typeof it["name"] === "string" ? it["name"] : "(sin nombre)";
        if (Array.isArray(it["item"])) {
            recorrer(it["item"], [...ruta, nombre], out, avisos);
            continue;
        }
        if (esObjeto(it["request"]) || typeof it["request"] === "string") {
            out.push(unaPeticion(it, ruta, avisos));
        }
    }
}
function unaPeticion(it: Record<string, unknown>, ruta: string[], avisos: string[]): ApiPeticion {
    const nombre = typeof it["name"] === "string" ? it["name"] : "(sin nombre)";
    const req = it["request"];
    if (typeof req === "string") {
        const { base, query } = partirUrl(req);
        return peticionVacia({ nombre, url: base, query, carpeta: ruta });
    }
    if (!esObjeto(req))
        return peticionVacia({ nombre, carpeta: ruta });
    const p = peticionVacia({ nombre, carpeta: ruta });
    p.metodo = typeof req["method"] === "string" ? req["method"].toUpperCase() : "GET";
    const { url, query } = leerUrl(req["url"]);
    p.url = url;
    p.query = query;
    p.headers = leerCampos(req["header"]);
    p.cuerpo = leerCuerpo(req["body"], avisos, nombre);
    p.auth = leerAuth(req["auth"]);
    const d = req["description"];
    if (typeof d === "string" && d)
        p.docs = d;
    else if (esObjeto(d) && typeof d["content"] === "string")
        p.docs = d["content"];
    return p;
}
function leerUrl(u: unknown): {
    url: string;
    query: ApiCampo[];
} {
    if (typeof u === "string") {
        const { base, query } = partirUrl(u);
        return { url: base, query };
    }
    if (!esObjeto(u))
        return { url: "", query: [] };
    if (typeof u["raw"] === "string" && u["raw"]) {
        const { base, query } = partirUrl(u["raw"]);
        const q = leerCampos(u["query"]);
        return { url: base, query: q.length ? q : query };
    }
    const protocolo = typeof u["protocol"] === "string" ? `${u["protocol"]}://` : "";
    const host = Array.isArray(u["host"]) ? u["host"].filter(esTexto).join(".")
        : typeof u["host"] === "string" ? u["host"] : "";
    const puerto = typeof u["port"] === "string" && u["port"] ? `:${u["port"]}` : "";
    const path = Array.isArray(u["path"]) ? `/${u["path"].filter(esTexto).join("/")}`
        : typeof u["path"] === "string" ? u["path"] : "";
    return { url: `${protocolo}${host}${puerto}${path}`, query: leerCampos(u["query"]) };
}
function leerCampos(x: unknown): ApiCampo[] {
    if (!Array.isArray(x))
        return [];
    const out: ApiCampo[] = [];
    for (const c of x) {
        if (!esObjeto(c))
            continue;
        const nombre = typeof c["key"] === "string" ? c["key"] : "";
        if (!nombre)
            continue;
        const f = campo(nombre, valorTexto(c["value"]), c["disabled"] !== true);
        const d = c["description"];
        if (typeof d === "string" && d)
            f.docs = d;
        else if (esObjeto(d) && typeof d["content"] === "string")
            f.docs = d["content"];
        out.push(f);
    }
    return out;
}
function leerCuerpo(b: unknown, avisos: string[], peticion: string): ApiCuerpo {
    if (!esObjeto(b))
        return cuerpoVacio();
    const modo = typeof b["mode"] === "string" ? b["mode"] : "";
    switch (modo) {
        case "raw": {
            const texto = valorTexto(b["raw"]);
            if (!texto)
                return cuerpoVacio();
            return { tipo: lenguajeRaw(b["options"]), texto };
        }
        case "urlencoded":
            return { tipo: "urlencoded", campos: leerCampos(b["urlencoded"]) };
        case "formdata": {
            const campos = leerCampos(b["formdata"]);
            const ficheros = Array.isArray(b["formdata"])
                ? b["formdata"].filter(f => esObjeto(f) && f["type"] === "file").length : 0;
            if (ficheros) {
                avisos.push(`«${peticion}»: ${ficheros} campo(s) de fichero. Postman guarda la ruta local, no el contenido.`);
            }
            return { tipo: "form-data", campos };
        }
        case "graphql": {
            const g = esObjeto(b["graphql"]) ? b["graphql"] : {};
            const consulta = valorTexto(g["query"]);
            const vars = valorTexto(g["variables"]);
            return { tipo: "graphql", texto: vars ? `${consulta}\n\n# variables\n${vars}` : consulta };
        }
        case "file": {
            const src = esObjeto(b["file"]) ? valorTexto(b["file"]["src"]) : "";
            avisos.push(`«${peticion}»: el cuerpo es un fichero (${src || "sin ruta"}); su contenido no está en el export.`);
            return { tipo: "binario", texto: src };
        }
        default:
            return cuerpoVacio();
    }
}
function lenguajeRaw(options: unknown): TipoCuerpo {
    if (esObjeto(options) && esObjeto(options["raw"])) {
        const l = options["raw"]["language"];
        if (l === "json")
            return "json";
        if (l === "xml")
            return "xml";
        if (l === "graphql")
            return "graphql";
        if (l === "text" || l === "html")
            return "texto";
    }
    return "texto";
}
function leerAuth(a: unknown): ApiAuth {
    if (!esObjeto(a))
        return authVacia();
    const tipo = typeof a["type"] === "string" ? a["type"] : "";
    const lista = (k: string): Record<string, string> => {
        const out: Record<string, string> = {};
        const v = a[k];
        if (Array.isArray(v)) {
            for (const it of v) {
                if (esObjeto(it) && typeof it["key"] === "string")
                    out[it["key"]] = valorTexto(it["value"]);
            }
        }
        else if (esObjeto(v)) {
            for (const [kk, vv] of Object.entries(v))
                out[kk] = valorTexto(vv);
        }
        return out;
    };
    switch (tipo) {
        case "bearer": return { tipo: "bearer", clave: lista("bearer")["token"] ?? "" };
        case "basic": {
            const b = lista("basic");
            return { tipo: "basic", clave: b["username"] ?? "", secreto: b["password"] ?? "" };
        }
        case "apikey": {
            const k = lista("apikey");
            return {
                tipo: "apikey",
                clave: k["key"] ?? "",
                secreto: k["value"] ?? "",
                donde: k["in"] === "query" ? "query" : "header",
            };
        }
        case "oauth2": {
            const o = lista("oauth2");
            return { tipo: "oauth2", clave: o["accessToken"] ?? "" };
        }
        default: return authVacia();
    }
}
function leerVariables(v: unknown, avisos: string[]): ApiCampo[] {
    const out = leerCampos(v);
    const secretas = Array.isArray(v)
        ? v.filter(x => esObjeto(x) && x["type"] === "secret").length : 0;
    if (secretas) {
        avisos.push(`${secretas} variable(s) marcadas como secretas en Postman viajan con su valor dentro del fichero.`);
    }
    return out;
}
function contarScripts(x: unknown): number {
    let n = 0;
    const visitar = (o: unknown): void => {
        if (Array.isArray(o)) {
            for (const i of o)
                visitar(i);
            return;
        }
        if (!esObjeto(o))
            return;
        if (Array.isArray(o["event"])) {
            for (const e of o["event"]) {
                if (!esObjeto(e))
                    continue;
                const s = e["script"];
                if (esObjeto(s) && Array.isArray(s["exec"]) && s["exec"].join("").trim())
                    n++;
            }
        }
        for (const v of Object.values(o))
            visitar(v);
    };
    visitar(x);
    return n;
}
export function escribirPostman(c: ApiColeccion): string {
    const raiz: unknown[] = [];
    const carpetas = new Map<string, unknown[]>([["", raiz]]);
    const dameCarpeta = (ruta: string[]): unknown[] => {
        let clave = "";
        let actual = raiz;
        for (const tramo of ruta) {
            const padre = actual;
            clave = clave ? `${clave}\u0000${tramo}` : tramo;
            let hijos = carpetas.get(clave);
            if (!hijos) {
                hijos = [];
                carpetas.set(clave, hijos);
                padre.push({ name: tramo, item: hijos });
            }
            actual = hijos;
        }
        return actual;
    };
    for (const p of c.peticiones)
        dameCarpeta(p.carpeta).push(unaPeticionPostman(p));
    return JSON.stringify({
        info: {
            name: c.nombre,
            schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
        },
        item: raiz,
        ...(c.variables.length
            ? { variable: c.variables.map(v => ({ key: v.nombre, value: v.valor })) }
            : {}),
    }, null, 2);
}
function unaPeticionPostman(p: ApiPeticion): Record<string, unknown> {
    const req: Record<string, unknown> = {
        method: p.metodo,
        header: p.headers.map(h => ({
            key: h.nombre,
            value: h.valor,
            ...(h.activo ? {} : { disabled: true }),
            ...(h.docs ? { description: h.docs } : {}),
        })),
        url: urlPostman(p),
    };
    if (p.docs)
        req["description"] = p.docs;
    const c = p.cuerpo;
    if (c.tipo === "urlencoded") {
        req["body"] = { mode: "urlencoded", urlencoded: camposPostman(c.campos ?? []) };
    }
    else if (c.tipo === "form-data") {
        req["body"] = { mode: "formdata", formdata: camposPostman(c.campos ?? []) };
    }
    else if (c.tipo === "graphql") {
        req["body"] = { mode: "graphql", graphql: { query: c.texto ?? "", variables: "" } };
    }
    else if (c.tipo === "binario") {
        req["body"] = { mode: "file", file: { src: c.texto ?? "" } };
    }
    else if (c.texto) {
        const lang = c.tipo === "json" ? "json" : c.tipo === "xml" ? "xml" : "text";
        req["body"] = { mode: "raw", raw: c.texto, options: { raw: { language: lang } } };
    }
    const a = authPostman(p.auth);
    if (a)
        req["auth"] = a;
    return { name: p.nombre, request: req };
}
function camposPostman(cs: ApiCampo[]): unknown[] {
    return cs.map(f => ({ key: f.nombre, value: f.valor, ...(f.activo ? {} : { disabled: true }) }));
}
function urlPostman(p: ApiPeticion): Record<string, unknown> {
    const raw = unirUrl(p.url, p.query);
    const out: Record<string, unknown> = { raw };
    if (p.query.length) {
        out["query"] = p.query.map(q => ({
            key: q.nombre,
            value: q.valor,
            ...(q.activo ? {} : { disabled: true }),
        }));
    }
    return out;
}
function authPostman(a: ApiAuth): Record<string, unknown> | null {
    switch (a.tipo) {
        case "bearer": return { type: "bearer", bearer: [{ key: "token", value: a.clave ?? "", type: "string" }] };
        case "basic": return { type: "basic", basic: [
                { key: "username", value: a.clave ?? "", type: "string" },
                { key: "password", value: a.secreto ?? "", type: "string" },
            ] };
        case "apikey": return { type: "apikey", apikey: [
                { key: "key", value: a.clave ?? "", type: "string" },
                { key: "value", value: a.secreto ?? "", type: "string" },
                { key: "in", value: a.donde ?? "header", type: "string" },
            ] };
        case "oauth2": return { type: "oauth2", oauth2: [{ key: "accessToken", value: a.clave ?? "", type: "string" }] };
        default: return null;
    }
}
function esObjeto(x: unknown): x is Record<string, unknown> {
    return typeof x === "object" && x !== null && !Array.isArray(x);
}
function esTexto(x: unknown): x is string {
    return typeof x === "string";
}
function valorTexto(x: unknown): string {
    if (typeof x === "string")
        return x;
    if (typeof x === "number" || typeof x === "boolean")
        return String(x);
    return "";
}
