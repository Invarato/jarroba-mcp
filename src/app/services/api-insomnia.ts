import { ApiAuth, ApiColeccion, ApiCuerpo, ApiPeticion, ResultadoImport, campo, cuerpoVacio, authVacia, peticionVacia, partirUrl, } from "./api-ir";
export function esInsomnia(x: unknown): boolean {
    if (!esObj(x))
        return false;
    if (!Array.isArray(x["resources"]))
        return false;
    return x["_type"] === "export" || typeof x["__export_format"] === "number"
        || x["resources"].some(r => esObj(r) && typeof r["_type"] === "string");
}
export function leerInsomnia(texto: string): ResultadoImport {
    let raiz: unknown;
    try {
        raiz = JSON.parse(texto);
    }
    catch (e) {
        return { ok: false, error: `No es JSON válido: ${(e as Error).message}` };
    }
    if (!esObj(raiz) || !Array.isArray(raiz["resources"])) {
        return { ok: false, error: "No parece un export de Insomnia: le falta la lista \u00ABresources\u00BB." };
    }
    const avisos: string[] = [];
    const recursos = raiz["resources"].filter(esObj);
    const porId = new Map<string, Record<string, unknown>>();
    for (const r of recursos) {
        const id = texto1(r["_id"]);
        if (id)
            porId.set(id, r);
    }
    const nombre = texto1(recursos.find(r => r["_type"] === "workspace")?.["name"] as unknown)
        || "Colecci\u00F3n de Insomnia";
    const peticiones: ApiPeticion[] = [];
    let conPlantilla = 0;
    for (const r of recursos) {
        if (r["_type"] !== "request")
            continue;
        const p = unaPeticion(r, rutaDe(r, porId, avisos));
        if (llevaPlantilla(r))
            conPlantilla++;
        peticiones.push(p);
    }
    if (conPlantilla) {
        avisos.push(`${conPlantilla} petición(es) usan plantillas de Insomnia ({% … %}); se copian tal cual, ` +
            `porque su valor solo existe dentro de Insomnia.`);
    }
    if (!peticiones.length) {
        return { ok: false, error: "El export no contiene ninguna petici\u00F3n." };
    }
    return { ok: true, avisos, coleccion: { nombre, variables: variablesDe(recursos), peticiones } };
}
function rutaDe(r: Record<string, unknown>, porId: Map<string, Record<string, unknown>>, avisos: string[]): string[] {
    const ruta: string[] = [];
    const vistos = new Set<string>();
    let actual = texto1(r["parentId"]);
    let ciclo = false;
    while (actual) {
        if (vistos.has(actual)) {
            ciclo = true;
            break;
        }
        vistos.add(actual);
        const padre = porId.get(actual);
        if (!padre)
            break;
        if (padre["_type"] === "workspace")
            break;
        if (padre["_type"] === "request_group")
            ruta.unshift(texto1(padre["name"]) || "(carpeta)");
        actual = texto1(padre["parentId"]);
    }
    if (ciclo) {
        avisos.push(`«${texto1(r["name"])}»: la cadena de carpetas forma un ciclo; se corta donde se detectó.`);
    }
    return ruta;
}
function unaPeticion(r: Record<string, unknown>, carpeta: string[]): ApiPeticion {
    const { base, query } = partirUrl(texto1(r["url"]));
    const p = peticionVacia({
        nombre: texto1(r["name"]) || "(sin nombre)",
        metodo: (texto1(r["method"]) || "GET").toUpperCase(),
        url: base,
        carpeta,
    });
    const q = campos(r["parameters"]);
    p.query = q.length ? q : query;
    p.headers = campos(r["headers"]);
    p.cuerpo = leerCuerpo(r["body"]);
    p.auth = leerAuth(r["authentication"]);
    const d = texto1(r["description"]);
    if (d)
        p.docs = d;
    return p;
}
function campos(x: unknown) {
    if (!Array.isArray(x))
        return [];
    return x.filter(esObj)
        .map(c => ({ nombre: texto1(c["name"]), valor: texto1(c["value"]), activo: c["disabled"] !== true }))
        .filter(c => c.nombre)
        .map(c => campo(c.nombre, c.valor, c.activo));
}
function leerCuerpo(b: unknown): ApiCuerpo {
    if (!esObj(b))
        return cuerpoVacio();
    const mime = texto1(b["mimeType"]);
    if (mime === "application/x-www-form-urlencoded") {
        return { tipo: "urlencoded", campos: campos(b["params"]) };
    }
    if (mime === "multipart/form-data") {
        return { tipo: "form-data", campos: campos(b["params"]) };
    }
    if (mime === "application/graphql") {
        return { tipo: "graphql", texto: texto1(b["text"]) };
    }
    const texto = texto1(b["text"]);
    if (!texto) {
        const f = texto1(b["fileName"]);
        return f ? { tipo: "binario", texto: f } : cuerpoVacio();
    }
    if (mime.includes("json"))
        return { tipo: "json", texto };
    if (mime.includes("xml"))
        return { tipo: "xml", texto };
    return { tipo: "texto", texto };
}
function leerAuth(a: unknown): ApiAuth {
    if (!esObj(a))
        return authVacia();
    if (a["disabled"] === true)
        return authVacia();
    switch (texto1(a["type"])) {
        case "bearer": return { tipo: "bearer", clave: texto1(a["token"]) };
        case "basic": return { tipo: "basic", clave: texto1(a["username"]), secreto: texto1(a["password"]) };
        case "apikey": return {
            tipo: "apikey",
            clave: texto1(a["key"]),
            secreto: texto1(a["value"]),
            donde: texto1(a["addTo"]) === "queryParams" ? "query" : "header",
        };
        case "oauth2": return { tipo: "oauth2", clave: texto1(a["accessTokenUrl"]) };
        default: return authVacia();
    }
}
function variablesDe(recursos: Record<string, unknown>[]) {
    const env = recursos.find(r => r["_type"] === "environment" && !texto1(r["parentId"]).startsWith("env_"))
        ?? recursos.find(r => r["_type"] === "environment");
    if (!env || !esObj(env["data"]))
        return [];
    return Object.entries(env["data"]).map(([k, v]) => campo(k, typeof v === "string" ? v : JSON.stringify(v)));
}
function llevaPlantilla(r: Record<string, unknown>): boolean {
    return /\{%[\s\S]*?%\}/.test(JSON.stringify(r));
}
function esObj(x: unknown): x is Record<string, unknown> {
    return typeof x === "object" && x !== null && !Array.isArray(x);
}
function texto1(x: unknown): string {
    return typeof x === "string" ? x : "";
}
