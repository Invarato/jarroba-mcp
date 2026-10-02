export interface ApiCampo {
    nombre: string;
    valor: string;
    activo: boolean;
    docs?: string;
}
export type TipoCuerpo = "ninguno" | "json" | "texto" | "xml" | "form-data" | "urlencoded" | "graphql" | "binario";
export interface ApiCuerpo {
    tipo: TipoCuerpo;
    texto?: string;
    campos?: ApiCampo[];
}
export type TipoAuth = "ninguna" | "bearer" | "basic" | "apikey" | "oauth2";
export interface ApiAuth {
    tipo: TipoAuth;
    clave?: string;
    secreto?: string;
    donde?: "header" | "query";
}
export interface ApiPeticion {
    nombre: string;
    metodo: string;
    url: string;
    headers: ApiCampo[];
    query: ApiCampo[];
    cuerpo: ApiCuerpo;
    auth: ApiAuth;
    carpeta: string[];
    docs?: string;
}
export interface ApiColeccion {
    nombre: string;
    variables: ApiCampo[];
    peticiones: ApiPeticion[];
}
export type ResultadoImport = {
    ok: true;
    coleccion: ApiColeccion;
    avisos: string[];
} | {
    ok: false;
    error: string;
};
export function cuerpoVacio(): ApiCuerpo {
    return { tipo: "ninguno" };
}
export function authVacia(): ApiAuth {
    return { tipo: "ninguna" };
}
export function peticionVacia(parcial: Partial<ApiPeticion> = {}): ApiPeticion {
    return {
        nombre: "",
        metodo: "GET",
        url: "",
        headers: [],
        query: [],
        cuerpo: cuerpoVacio(),
        auth: authVacia(),
        carpeta: [],
        ...parcial,
    };
}
export function campo(nombre: string, valor: string, activo = true): ApiCampo {
    return { nombre, valor, activo };
}
const NOMBRES_SENSIBLES = [
    "authorization",
    "auth",
    "token",
    "access_token",
    "refresh_token",
    "id_token",
    "api-key",
    "apikey",
    "api_key",
    "x-api-key",
    "secret",
    "client_secret",
    "password",
    "passwd",
    "pwd",
    "cookie",
    "set-cookie",
    "x-auth-token",
    "private-key",
    "private_key",
    "session",
    "sessionid",
    "bearer",
];
export function esNombreSensible(nombre: string): boolean {
    const n = nombre.toLowerCase().replace(/[\s_-]/g, "");
    return NOMBRES_SENSIBLES.some(s => n === s.replace(/[_-]/g, ""));
}
export function enmascarar(valor: string): string {
    if (!valor)
        return "";
    if (valor.length <= 8)
        return "\u2022".repeat(valor.length);
    return `${valor.slice(0, 4)}…${valor.slice(-3)} (${valor.length})`;
}
export interface Hallazgo {
    peticion: string;
    donde: string;
    nombre: string;
    muestra: string;
}
export function buscarSecretos(c: ApiColeccion): Hallazgo[] {
    const out: Hallazgo[] = [];
    const mirar = (campos: ApiCampo[], peticion: string, donde: string) => {
        for (const f of campos) {
            if (f.valor && esNombreSensible(f.nombre)) {
                out.push({ peticion, donde, nombre: f.nombre, muestra: enmascarar(f.valor) });
            }
        }
    };
    mirar(c.variables, "(colecci\u00F3n)", "variable");
    for (const p of c.peticiones) {
        mirar(p.headers, p.nombre, "cabecera");
        mirar(p.query, p.nombre, "query");
        if (p.cuerpo.campos)
            mirar(p.cuerpo.campos, p.nombre, "cuerpo");
        if (p.auth.tipo !== "ninguna") {
            const v = p.auth.secreto || p.auth.clave || "";
            if (v)
                out.push({ peticion: p.nombre, donde: "auth", nombre: p.auth.tipo, muestra: enmascarar(v) });
        }
    }
    return out;
}
export function partirUrl(url: string): {
    base: string;
    query: ApiCampo[];
} {
    const i = url.indexOf("?");
    if (i < 0)
        return { base: url, query: [] };
    const base = url.slice(0, i);
    const query: ApiCampo[] = [];
    for (const par of url.slice(i + 1).split("&")) {
        if (!par)
            continue;
        const j = par.indexOf("=");
        const nombre = j < 0 ? par : par.slice(0, j);
        const valor = j < 0 ? "" : par.slice(j + 1);
        query.push(campo(decodeSeguro(nombre), decodeSeguro(valor)));
    }
    return { base, query };
}
export function decodeSeguro(s: string): string {
    try {
        return decodeURIComponent(s.replace(/\+/g, " "));
    }
    catch {
        return s;
    }
}
export function unirUrl(base: string, query: ApiCampo[]): string {
    const activos = query.filter(q => q.activo);
    if (!activos.length)
        return base;
    const qs = activos
        .map(q => `${encodeURIComponent(q.nombre)}=${encodeURIComponent(q.valor)}`)
        .join("&");
    return `${base}${base.includes("?") ? "&" : "?"}${qs}`;
}
