import { ApiAuth, ApiCampo, ApiColeccion, ApiCuerpo, ApiPeticion, ResultadoImport, TipoCuerpo, campo, cuerpoVacio, authVacia, peticionVacia, partirUrl, unirUrl, } from "./api-ir";
const METODOS = ["get", "post", "put", "delete", "patch", "head", "options", "trace"];
export interface FicheroBru {
    ruta: string;
    contenido: string;
}
export function esBru(texto: string): boolean {
    return /^\s*meta\s*\{/m.test(texto) && METODOS.some(m => new RegExp(`^\\s*${m}\\s*\\{`, "m").test(texto));
}
export function leerBru(texto: string, ruta: string[] = []): ApiPeticion | null {
    const bloques = partirBloques(texto);
    const meta = paresDe(bloques.get("meta") ?? "");
    const metodo = METODOS.find(m => bloques.has(m));
    if (!metodo)
        return null;
    const p = peticionVacia({
        nombre: meta["name"] || "(sin nombre)",
        metodo: metodo.toUpperCase(),
        carpeta: ruta,
    });
    const cab = paresDe(bloques.get(metodo) ?? "");
    const { base, query } = partirUrl(cab["url"] ?? "");
    p.url = base;
    const pq = camposDe(bloques.get("params:query"));
    p.query = pq.length ? pq : query;
    p.headers = camposDe(bloques.get("headers"));
    p.cuerpo = leerCuerpo(bloques);
    p.auth = leerAuth(bloques, cab["auth"]);
    const docs = bloques.get("docs");
    if (docs)
        p.docs = docs.trim();
    return p;
}
export function leerColeccionBru(ficheros: FicheroBru[]): ResultadoImport {
    const avisos: string[] = [];
    const peticiones: ApiPeticion[] = [];
    let nombre = "Colecci\u00F3n de Bruno";
    let variables: ApiCampo[] = [];
    for (const f of ficheros) {
        const tramos = f.ruta.split("/").filter(Boolean);
        const hoja = tramos.pop() ?? "";
        if (!hoja.endsWith(".bru"))
            continue;
        if (hoja === "collection.bru") {
            const b = partirBloques(f.contenido);
            const m = paresDe(b.get("meta") ?? "");
            if (m["name"])
                nombre = m["name"];
            variables = camposDe(b.get("vars:pre-request"));
            avisarDeScripts(b, "la colecci\u00F3n", avisos);
            continue;
        }
        if (hoja === "folder.bru")
            continue;
        const p = leerBru(f.contenido, tramos);
        if (!p) {
            avisos.push(`«${f.ruta}»: no se reconoce como petición .bru; omitido.`);
            continue;
        }
        avisarDeScripts(partirBloques(f.contenido), `«${p.nombre}»`, avisos);
        peticiones.push(p);
    }
    if (!peticiones.length) {
        return { ok: false, error: "No se encontr\u00F3 ninguna petici\u00F3n .bru en los ficheros dados." };
    }
    return { ok: true, avisos, coleccion: { nombre, variables, peticiones } };
}
function avisarDeScripts(bloques: Map<string, string>, quien: string, avisos: string[]): void {
    const conScript = ["script:pre-request", "script:post-response", "tests"]
        .filter(k => (bloques.get(k) ?? "").trim());
    if (conScript.length) {
        avisos.push(`${quien}: lleva ${conScript.join(" y ")}. Es código JavaScript y no se traduce; queda fuera de la conversión.`);
    }
}
export function partirBloques(texto: string): Map<string, string> {
    const out = new Map<string, string>();
    const re = /^[ \t]*([A-Za-z][\w:.-]*)[ \t]*\{[ \t]*$/gm;
    let m: RegExpExecArray | null;
    while ((m = re.exec(texto))) {
        const nombre = m[1];
        let i = texto.indexOf("{", m.index) + 1;
        let prof = 1;
        const ini = i;
        while (i < texto.length && prof > 0) {
            if (texto[i] === "{")
                prof++;
            else if (texto[i] === "}")
                prof--;
            i++;
        }
        out.set(nombre, texto.slice(ini, prof === 0 ? i - 1 : texto.length));
        re.lastIndex = i;
    }
    return out;
}
function paresDe(bloque: string): Record<string, string> {
    const out: Record<string, string> = {};
    for (const c of camposDe(bloque))
        out[c.nombre] = c.valor;
    return out;
}
export function camposDe(bloque: string | undefined): ApiCampo[] {
    if (!bloque)
        return [];
    const out: ApiCampo[] = [];
    for (const linea of bloque.split("\n")) {
        const t = linea.trim();
        if (!t || t.startsWith("//"))
            continue;
        const j = t.indexOf(":");
        if (j < 1)
            continue;
        let nombre = t.slice(0, j).trim();
        const valor = t.slice(j + 1).trim();
        const activo = !nombre.startsWith("~");
        if (!activo)
            nombre = nombre.slice(1).trim();
        if (nombre)
            out.push(campo(nombre, valor, activo));
    }
    return out;
}
function leerCuerpo(bloques: Map<string, string>): ApiCuerpo {
    const mapa: Record<string, TipoCuerpo> = {
        json: "json",
        text: "texto",
        xml: "xml",
        sparql: "texto",
        graphql: "graphql",
    };
    for (const [sufijo, tipo] of Object.entries(mapa)) {
        const b = bloques.get(`body:${sufijo}`);
        if (b !== undefined && b.trim())
            return { tipo, texto: desangrar(b) };
    }
    const fu = bloques.get("body:form-urlencoded");
    if (fu !== undefined)
        return { tipo: "urlencoded", campos: camposDe(fu) };
    const mf = bloques.get("body:multipart-form");
    if (mf !== undefined)
        return { tipo: "form-data", campos: camposDe(mf) };
    return cuerpoVacio();
}
function leerAuth(bloques: Map<string, string>, declarado: string | undefined): ApiAuth {
    const b = paresDe(bloques.get("auth:bearer") ?? "");
    if (bloques.has("auth:bearer"))
        return { tipo: "bearer", clave: b["token"] ?? "" };
    if (bloques.has("auth:basic")) {
        const x = paresDe(bloques.get("auth:basic") ?? "");
        return { tipo: "basic", clave: x["username"] ?? "", secreto: x["password"] ?? "" };
    }
    if (bloques.has("auth:apikey")) {
        const x = paresDe(bloques.get("auth:apikey") ?? "");
        return {
            tipo: "apikey",
            clave: x["key"] ?? "",
            secreto: x["value"] ?? "",
            donde: x["placement"] === "queryparams" ? "query" : "header",
        };
    }
    if (declarado === "oauth2")
        return { tipo: "oauth2" };
    return authVacia();
}
function desangrar(bloque: string): string {
    const lineas = bloque.replace(/^\n/, "").replace(/\s+$/, "").split("\n");
    const sangrias = lineas.filter(l => l.trim()).map(l => l.match(/^[ \t]*/)![0].length);
    const min = sangrias.length ? Math.min(...sangrias) : 0;
    return lineas.map(l => l.slice(min)).join("\n");
}
export function escribirColeccionBru(c: ApiColeccion): FicheroBru[] {
    const out: FicheroBru[] = [];
    out.push({ ruta: "bruno.json", contenido: JSON.stringify({
            version: "1",
            name: c.nombre,
            type: "collection",
            ignore: ["node_modules", ".git"],
        }, null, 2) });
    const bloquesColeccion: string[] = [bloque("meta", [`name: ${c.nombre}`])];
    if (c.variables.length) {
        bloquesColeccion.push(bloque("vars:pre-request", c.variables.map(paresLinea)));
    }
    out.push({ ruta: "collection.bru", contenido: bloquesColeccion.join("\n\n") + "\n" });
    const seq = new Map<string, number>();
    const usados = new Set<string>();
    for (const p of c.peticiones) {
        const dir = p.carpeta.map(nombreSeguro).join("/");
        const n = (seq.get(dir) ?? 0) + 1;
        seq.set(dir, n);
        let base = nombreSeguro(p.nombre) || "peticion";
        let ruta = `${dir ? `${dir}/` : ""}${base}.bru`;
        let k = 2;
        while (usados.has(ruta.toLowerCase())) {
            ruta = `${dir ? `${dir}/` : ""}${base}-${k++}.bru`;
        }
        usados.add(ruta.toLowerCase());
        out.push({ ruta, contenido: escribirBru(p, n) });
    }
    return out;
}
export function escribirBru(p: ApiPeticion, seq = 1): string {
    const partes: string[] = [];
    partes.push(bloque("meta", [`name: ${p.nombre}`, "type: http", `seq: ${seq}`]));
    const metodo = p.metodo.toLowerCase();
    const cab = [`url: ${unirUrl(p.url, p.query)}`, `body: ${cuerpoDeclarado(p.cuerpo)}`, `auth: ${authDeclarada(p.auth)}`];
    partes.push(bloque(METODOS.includes(metodo) ? metodo : "get", cab));
    if (p.query.length)
        partes.push(bloque("params:query", p.query.map(paresLinea)));
    if (p.headers.length)
        partes.push(bloque("headers", p.headers.map(paresLinea)));
    const a = p.auth;
    if (a.tipo === "bearer")
        partes.push(bloque("auth:bearer", [`token: ${a.clave ?? ""}`]));
    else if (a.tipo === "basic")
        partes.push(bloque("auth:basic", [`username: ${a.clave ?? ""}`, `password: ${a.secreto ?? ""}`]));
    else if (a.tipo === "apikey") {
        partes.push(bloque("auth:apikey", [
            `key: ${a.clave ?? ""}`,
            `value: ${a.secreto ?? ""}`,
            `placement: ${a.donde === "query" ? "queryparams" : "header"}`,
        ]));
    }
    const c = p.cuerpo;
    if (c.tipo === "urlencoded")
        partes.push(bloque("body:form-urlencoded", (c.campos ?? []).map(paresLinea)));
    else if (c.tipo === "form-data")
        partes.push(bloque("body:multipart-form", (c.campos ?? []).map(paresLinea)));
    else if (c.texto) {
        const sufijo = c.tipo === "json" ? "json" : c.tipo === "xml" ? "xml" : c.tipo === "graphql" ? "graphql" : "text";
        partes.push(bloqueLiteral(`body:${sufijo}`, c.texto));
    }
    if (p.docs)
        partes.push(bloqueLiteral("docs", p.docs));
    return partes.join("\n\n") + "\n";
}
function cuerpoDeclarado(c: ApiCuerpo): string {
    switch (c.tipo) {
        case "json": return "json";
        case "xml": return "xml";
        case "graphql": return "graphql";
        case "urlencoded": return "form-urlencoded";
        case "form-data": return "multipart-form";
        case "texto":
        case "binario": return "text";
        default: return "none";
    }
}
function authDeclarada(a: ApiAuth): string {
    return a.tipo === "ninguna" ? "none" : a.tipo === "apikey" ? "apikey" : a.tipo;
}
function paresLinea(c: ApiCampo): string {
    return `${c.activo ? "" : "~"}${c.nombre}: ${c.valor}`;
}
function bloque(nombre: string, lineas: string[]): string {
    return `${nombre} {\n${lineas.map(l => `  ${l}`).join("\n")}\n}`;
}
function bloqueLiteral(nombre: string, texto: string): string {
    return `${nombre} {\n${texto.split("\n").map(l => `  ${l}`).join("\n")}\n}`;
}
export function nombreSeguro(s: string): string {
    const limpio = s
        .replace(/[\\/:*?"<>|]/g, "-")
        .replace(/[\x00-\x1f]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/^\.+/, "")
        .replace(/\.+$/, "")
        .slice(0, 120)
        .trim();
    if (!limpio)
        return "";
    return /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(limpio) ? `${limpio}-` : limpio;
}
