import * as jsYaml from "js-yaml";
import { ApiCampo, ApiColeccion, ApiCuerpo, ApiPeticion, ResultadoImport, campo, cuerpoVacio, authVacia, peticionVacia, } from "./api-ir";
export interface ParamApi {
    nombre: string;
    donde: "query" | "header" | "path" | "cookie";
    requerido: boolean;
    tipo: string;
    enumerado?: string[];
}
export interface CuerpoApi {
    requerido: boolean;
    tipos: string[];
    campos: {
        nombre: string;
        tipo: string;
        requerido: boolean;
    }[];
}
export interface OperacionApi {
    id: string;
    metodo: string;
    ruta: string;
    resumen?: string;
    obsoleta: boolean;
    params: ParamApi[];
    cuerpo?: CuerpoApi;
    respuestas: string[];
    seguridad: string[];
}
export interface EspecApi {
    titulo: string;
    version: string;
    servidor: string;
    operaciones: OperacionApi[];
}
export function esOpenApi(x: unknown): boolean {
    if (!esObj(x))
        return false;
    return typeof x["openapi"] === "string" || x["swagger"] === "2.0"
        || (esObj(x["paths"]) && (esObj(x["info"]) || "swagger" in x));
}
export function leerEspec(texto: string): {
    ok: true;
    espec: EspecApi;
    avisos: string[];
} | {
    ok: false;
    error: string;
} {
    let raiz: unknown;
    const t = texto.trim();
    if (!t)
        return { ok: false, error: "No hay nada que leer." };
    try {
        raiz = t.startsWith("{") || t.startsWith("[") ? JSON.parse(t) : jsYaml.load(t);
    }
    catch (e) {
        return { ok: false, error: `No se pudo leer como JSON ni como YAML: ${(e as Error).message}` };
    }
    if (!esObj(raiz))
        return { ok: false, error: "El documento no es un objeto." };
    if (!esObj(raiz["paths"])) {
        return { ok: false, error: "No parece OpenAPI ni Swagger: le falta el objeto \u00ABpaths\u00BB." };
    }
    const avisos: string[] = [];
    const v2 = raiz["swagger"] === "2.0";
    const resolver = hazResolver(raiz, avisos);
    const info = esObj(raiz["info"]) ? raiz["info"] : {};
    const espec: EspecApi = {
        titulo: texto1(info["title"]) || "API sin t\u00EDtulo",
        version: texto1(info["version"]) || "",
        servidor: servidorDe(raiz, v2),
        operaciones: [],
    };
    const METODOS = ["get", "put", "post", "delete", "options", "head", "patch", "trace"];
    for (const [ruta, item] of Object.entries(raiz["paths"] as Record<string, unknown>)) {
        const itemR = resolver(item);
        if (!esObj(itemR))
            continue;
        const comunes = leerParams(itemR["parameters"], resolver, v2);
        for (const metodo of METODOS) {
            const op = resolver(itemR[metodo]);
            if (!esObj(op))
                continue;
            espec.operaciones.push(unaOperacion(metodo, ruta, op, comunes, resolver, v2));
        }
    }
    espec.operaciones.sort((a, b) => a.id.localeCompare(b.id));
    return { ok: true, espec, avisos };
}
function unaOperacion(metodo: string, ruta: string, op: Record<string, unknown>, comunes: ParamApi[], resolver: Resolver, v2: boolean): OperacionApi {
    const propios = leerParams(op["parameters"], resolver, v2);
    const clave = (p: ParamApi) => `${p.donde}\u0000${p.nombre}`;
    const mapa = new Map(comunes.map(p => [clave(p), p]));
    for (const p of propios)
        mapa.set(clave(p), p);
    return {
        id: `${metodo.toUpperCase()} ${ruta}`,
        metodo: metodo.toUpperCase(),
        ruta,
        resumen: texto1(op["summary"]) || texto1(op["operationId"]) || undefined,
        obsoleta: op["deprecated"] === true,
        params: [...mapa.values()].sort((a, b) => clave(a).localeCompare(clave(b))),
        cuerpo: leerCuerpoApi(op, resolver, v2),
        respuestas: esObj(op["responses"]) ? Object.keys(op["responses"]).sort() : [],
        seguridad: leerSeguridad(op["security"]),
    };
}
function leerParams(x: unknown, resolver: Resolver, v2: boolean): ParamApi[] {
    if (!Array.isArray(x))
        return [];
    const out: ParamApi[] = [];
    for (const crudo of x) {
        const p = resolver(crudo);
        if (!esObj(p))
            continue;
        const nombre = texto1(p["name"]);
        const donde = texto1(p["in"]);
        if (!nombre)
            continue;
        if (donde === "body" || donde === "formData")
            continue;
        if (!["query", "header", "path", "cookie"].includes(donde))
            continue;
        const esquema = v2 && !esObj(p["schema"]) ? p : resolver(p["schema"]);
        out.push({
            nombre,
            donde: donde as ParamApi["donde"],
            requerido: p["required"] === true || donde === "path",
            tipo: tipoDe(esquema, resolver),
            enumerado: enumDe(esquema),
        });
    }
    return out;
}
function leerCuerpoApi(op: Record<string, unknown>, resolver: Resolver, v2: boolean): CuerpoApi | undefined {
    if (v2) {
        const params = Array.isArray(op["parameters"]) ? op["parameters"] : [];
        const body = params.map(resolver).find(p => esObj(p) && p["in"] === "body");
        if (!esObj(body))
            return undefined;
        const esq = resolver(body["schema"]);
        const consume = Array.isArray(op["consumes"]) ? op["consumes"].filter(esTxt) : ["application/json"];
        return { requerido: body["required"] === true, tipos: consume.sort(), campos: camposDe(esq, resolver) };
    }
    const rb = resolver(op["requestBody"]);
    if (!esObj(rb))
        return undefined;
    const content = esObj(rb["content"]) ? rb["content"] : {};
    const tipos = Object.keys(content).sort();
    const json = content["application/json"] ?? content[tipos[0] ?? ""];
    const esq = esObj(json) ? resolver(json["schema"]) : undefined;
    return { requerido: rb["required"] === true, tipos, campos: camposDe(esq, resolver) };
}
function camposDe(esq: unknown, resolver: Resolver): CuerpoApi["campos"] {
    if (!esObj(esq))
        return [];
    const props = esObj(esq["properties"]) ? esq["properties"] : null;
    if (!props)
        return [];
    const obligatorios = new Set(Array.isArray(esq["required"]) ? esq["required"].filter(esTxt) : []);
    return Object.entries(props)
        .map(([nombre, sub]) => ({
        nombre,
        tipo: tipoDe(resolver(sub), resolver),
        requerido: obligatorios.has(nombre),
    }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre));
}
function tipoDe(esq: unknown, resolver: Resolver): string {
    if (!esObj(esq))
        return "any";
    const t = esq["type"];
    if (Array.isArray(esq["oneOf"]) || Array.isArray(esq["anyOf"]))
        return "union";
    if (Array.isArray(esq["allOf"]))
        return "objeto";
    if (t === "array") {
        const it = resolver(esq["items"]);
        return `${tipoDe(it, resolver)}[]`;
    }
    if (esTxt(t))
        return esq["format"] ? `${t}/${String(esq["format"])}` : t;
    if (Array.isArray(t))
        return t.filter(esTxt).sort().join("|");
    if (esObj(esq["properties"]))
        return "objeto";
    return "any";
}
function enumDe(esq: unknown): string[] | undefined {
    if (!esObj(esq) || !Array.isArray(esq["enum"]))
        return undefined;
    return esq["enum"].map(v => String(v)).sort();
}
function leerSeguridad(x: unknown): string[] {
    if (!Array.isArray(x))
        return [];
    const out = new Set<string>();
    for (const req of x) {
        if (esObj(req))
            for (const k of Object.keys(req))
                out.add(k);
    }
    return [...out].sort();
}
function servidorDe(raiz: Record<string, unknown>, v2: boolean): string {
    if (v2) {
        const esquemas = Array.isArray(raiz["schemes"]) ? raiz["schemes"].filter(esTxt) : [];
        const proto = esquemas.includes("https") ? "https" : esquemas[0] ?? "https";
        const host = texto1(raiz["host"]);
        const base = texto1(raiz["basePath"]);
        return host ? `${proto}://${host}${base}` : base;
    }
    const servers = raiz["servers"];
    if (Array.isArray(servers) && esObj(servers[0])) {
        const u = texto1(servers[0]["url"]);
        const vars = esObj(servers[0]["variables"]) ? servers[0]["variables"] : {};
        return u.replace(/\{(\w+)\}/g, (todo, k) => {
            const v = (vars as Record<string, unknown>)[k];
            return esObj(v) && esTxt(v["default"]) ? v["default"] : todo;
        });
    }
    return "";
}
type Resolver = (x: unknown) => unknown;
function hazResolver(raiz: Record<string, unknown>, avisos: string[]): Resolver {
    const externos = new Set<string>();
    const MAX_SALTOS = 100;
    const resolver: Resolver = (x: unknown) => {
        const vistos = new Set<string>();
        let actual = x;
        for (let i = 0; i < MAX_SALTOS; i++) {
            if (!esObj(actual) || !esTxt(actual["$ref"]))
                break;
            const ref = actual["$ref"];
            if (!ref.startsWith("#/")) {
                if (!externos.has(ref)) {
                    externos.add(ref);
                    avisos.push(`«${ref}» es una referencia externa: no se resuelve (habría que salir a la red).`);
                }
                break;
            }
            if (vistos.has(ref))
                break;
            vistos.add(ref);
            const destino = porPuntero(raiz, ref);
            if (destino === undefined)
                break;
            actual = destino;
        }
        return actual;
    };
    return resolver;
}
function porPuntero(raiz: unknown, ref: string): unknown {
    const tramos = ref.slice(2).split("/").map(t => t.replace(/~1/g, "/").replace(/~0/g, "~"));
    let actual: unknown = raiz;
    for (const t of tramos) {
        if (!t)
            continue;
        if (Array.isArray(actual)) {
            const i = Number(t);
            actual = Number.isInteger(i) && i >= 0 ? actual[i] : undefined;
            if (actual === undefined)
                return undefined;
        }
        else if (esObj(actual)) {
            if (!(t in actual))
                return undefined;
            actual = actual[t];
        }
        else
            return undefined;
    }
    return actual;
}
export function leerOpenApi(texto: string): ResultadoImport {
    const r = leerEspec(texto);
    if (!r.ok)
        return { ok: false, error: r.error };
    return {
        ok: true,
        avisos: r.avisos,
        coleccion: aColeccion(r.espec),
    };
}
export function aColeccion(e: EspecApi): ApiColeccion {
    const peticiones: ApiPeticion[] = e.operaciones.map(op => {
        const p = peticionVacia({
            nombre: op.resumen || op.id,
            metodo: op.metodo,
            url: `{{base_url}}${op.ruta}`,
            carpeta: carpetaDe(op.ruta),
            docs: op.obsoleta ? "OBSOLETA en la especificaci\u00F3n." : undefined,
        });
        for (const par of op.params) {
            if (par.donde === "query") {
                p.query.push(campo(par.nombre, marcador(par), par.requerido));
            }
            else if (par.donde === "header") {
                p.headers.push(campo(par.nombre, marcador(par), par.requerido));
            }
        }
        if (op.cuerpo)
            p.cuerpo = cuerpoEjemplo(op.cuerpo);
        if (op.seguridad.length)
            p.auth = { tipo: "bearer", clave: "{{token}}" };
        return p;
    });
    return {
        nombre: e.titulo,
        variables: [campo("base_url", e.servidor)],
        peticiones,
    };
}
function marcador(p: ParamApi): string {
    if (p.enumerado?.length)
        return p.enumerado[0];
    return `{{${p.nombre}}}`;
}
function cuerpoEjemplo(c: CuerpoApi): ApiCuerpo {
    if (!c.tipos.some(t => t.includes("json"))) {
        if (c.tipos.some(t => t.includes("urlencoded"))) {
            return { tipo: "urlencoded", campos: c.campos.map(f => campo(f.nombre, `{{${f.nombre}}}`, f.requerido)) };
        }
        if (c.tipos.some(t => t.includes("form-data"))) {
            return { tipo: "form-data", campos: c.campos.map(f => campo(f.nombre, `{{${f.nombre}}}`, f.requerido)) };
        }
        if (!c.campos.length)
            return cuerpoVacio();
    }
    const obj: Record<string, unknown> = {};
    for (const f of c.campos)
        obj[f.nombre] = ejemploDeTipo(f.tipo, f.nombre);
    return { tipo: "json", texto: JSON.stringify(obj, null, 2) };
}
function ejemploDeTipo(tipo: string, nombre: string): unknown {
    if (tipo.endsWith("[]"))
        return [ejemploDeTipo(tipo.slice(0, -2), nombre)];
    if (tipo.startsWith("integer") || tipo.startsWith("number"))
        return 0;
    if (tipo.startsWith("boolean"))
        return false;
    if (tipo === "objeto")
        return {};
    return `{{${nombre}}}`;
}
function carpetaDe(ruta: string): string[] {
    const tramos = ruta.split("/").filter(Boolean).filter(t => !t.startsWith("{"));
    const util = tramos.find(t => !/^v\d+$/i.test(t)) ?? tramos[0];
    return util ? [util] : [];
}
function esObj(x: unknown): x is Record<string, unknown> {
    return typeof x === "object" && x !== null && !Array.isArray(x);
}
function esTxt(x: unknown): x is string {
    return typeof x === "string";
}
function texto1(x: unknown): string {
    return typeof x === "string" ? x : "";
}
