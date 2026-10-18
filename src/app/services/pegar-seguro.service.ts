import { EntityCategory, DETECTORS } from "../shared/redact/detectors";
import { anonymize, AnonymizeConfig } from "../shared/redact/anonymize";
import { DETECTORES_PROVEEDORES } from "../shared/redact/detectors-proveedores";
export type Origen = "har" | "texto";
export type ParteHar = "cabecera-peticion" | "cabecera-respuesta" | "cookie-peticion" | "cookie-respuesta" | "query" | "cuerpo-peticion" | "cuerpo-respuesta";
export interface UbicacionHar {
    entrada: number;
    metodo: string;
    url: string;
    parte: ParteHar;
    nombre?: string;
}
export interface HallazgoPegado {
    entidad: string;
    categoria: EntityCategory;
    vistaPrevia: string;
    ubicacion?: UbicacionHar;
    linea?: number;
}
export interface AnalisisPegado {
    origen: Origen;
    hallazgos: HallazgoPegado[];
    porCategoria: Partial<Record<EntityCategory, number>>;
    limpio: string;
    entradasHar?: number;
    truncado: boolean;
}
const MAX_CAMPO = 20000;
const MAX_ENTRADAS = 500;
const CLAVES_SENSIBLES_POR_DEFECTO = ["password", "passwd", "api-key", "apikey", "secret", "token", "auth", "credential", "private-key"];
const CFG: AnonymizeConfig = {
    defaultOperator: "redact",
    sensitiveKeys: CLAVES_SENSIBLES_POR_DEFECTO,
    detectors: [...DETECTORS.filter(d => !d.defaultOff), ...DETECTORES_PROVEEDORES],
};
function vistaPrevia(valor: string): string {
    if (valor.length <= 10)
        return "\u2022".repeat(valor.length);
    return valor.slice(0, 4) + "\u2026" + valor.slice(-2);
}
export function pareceHar(contenido: string): boolean {
    const t = contenido.trimStart();
    if (!t.startsWith("{"))
        return false;
    try {
        const o = JSON.parse(t) as unknown;
        return !!o && typeof o === "object" && "log" in o && !!(o as {
            log?: unknown;
        }).log
            && typeof (o as {
                log: {
                    entries?: unknown;
                };
            }).log === "object"
            && Array.isArray((o as {
                log: {
                    entries?: unknown;
                };
            }).log.entries);
    }
    catch {
        return false;
    }
}
interface NombreValor {
    name?: unknown;
    value?: unknown;
}
interface HarContent {
    text?: unknown;
    encoding?: unknown;
    mimeType?: unknown;
}
interface HarEntry {
    request?: {
        method?: unknown;
        url?: unknown;
        headers?: unknown;
        cookies?: unknown;
        queryString?: unknown;
        postData?: {
            text?: unknown;
            mimeType?: unknown;
            params?: unknown;
        };
    };
    response?: {
        headers?: unknown;
        cookies?: unknown;
        content?: HarContent;
    };
}
const lista = (x: unknown): NombreValor[] => (Array.isArray(x) ? x.filter((v): v is NombreValor => !!v && typeof v === "object") : []);
const cadena = (x: unknown): string => (typeof x === "string" ? x : "");
function textoDeContenido(c: HarContent | undefined): string {
    const texto = cadena(c?.text);
    if (!texto)
        return "";
    if (cadena(c?.encoding) !== "base64")
        return texto;
    const mime = cadena(c?.mimeType);
    if (!/^(text\/|application\/(json|xml|x-www-form-urlencoded))/i.test(mime))
        return "";
    try {
        return atob(texto);
    }
    catch {
        return "";
    }
}
interface CampoHar {
    texto: string;
    valor: string;
    ubicacion: UbicacionHar;
    siempreSensible?: "cookie" | "cabecera-auth";
}
const CABECERA_SIEMPRE_SENSIBLE = /^(authorization|proxy-authorization|cookie|set-cookie)$/i;
function camposDeEntrada(e: HarEntry, entrada: number): CampoHar[] {
    const metodo = cadena(e.request?.method) || "?";
    const url = cadena(e.request?.url);
    const campos: CampoHar[] = [];
    const base = (parte: ParteHar, nombre?: string): UbicacionHar => ({ entrada, metodo, url, parte, nombre });
    const add = (ubicacion: UbicacionHar, valor: string, siempreSensible?: CampoHar["siempreSensible"]) => {
        if (!valor)
            return;
        campos.push({ texto: ubicacion.nombre ? `${ubicacion.nombre}: ${valor}` : valor, valor, ubicacion, siempreSensible });
    };
    for (const h of lista(e.request?.headers))
        add(base("cabecera-peticion", cadena(h.name)), cadena(h.value), CABECERA_SIEMPRE_SENSIBLE.test(cadena(h.name)) ? "cabecera-auth" : undefined);
    for (const c of lista(e.request?.cookies))
        add(base("cookie-peticion", cadena(c.name)), cadena(c.value), "cookie");
    for (const q of lista(e.request?.queryString))
        add(base("query", cadena(q.name)), cadena(q.value));
    for (const p of lista(e.request?.postData?.params))
        add(base("cuerpo-peticion", cadena(p.name)), cadena(p.value));
    add(base("cuerpo-peticion"), cadena(e.request?.postData?.text));
    for (const h of lista(e.response?.headers))
        add(base("cabecera-respuesta", cadena(h.name)), cadena(h.value), CABECERA_SIEMPRE_SENSIBLE.test(cadena(h.name)) ? "cabecera-auth" : undefined);
    for (const c of lista(e.response?.cookies))
        add(base("cookie-respuesta", cadena(c.name)), cadena(c.value), "cookie");
    add(base("cuerpo-respuesta"), textoDeContenido(e.response?.content));
    return campos;
}
function analizarHar(contenido: string): AnalisisPegado {
    const o = JSON.parse(contenido) as {
        log: {
            entries: HarEntry[];
        };
    };
    const entradas = o.log.entries;
    const truncado = entradas.length > MAX_ENTRADAS;
    const hallazgos: HallazgoPegado[] = [];
    const porCategoria: Partial<Record<EntityCategory, number>> = {};
    const anota = (entidad: string, valor: string, ubicacion: UbicacionHar) => {
        hallazgos.push({ entidad, categoria: categoriaDe(entidad), vistaPrevia: vistaPrevia(valor), ubicacion });
        porCategoria[categoriaDe(entidad)] = (porCategoria[categoriaDe(entidad)] ?? 0) + 1;
    };
    entradas.slice(0, MAX_ENTRADAS).forEach((e, i) => {
        for (const campo of camposDeEntrada(e, i + 1)) {
            const texto = campo.texto.length > MAX_CAMPO ? campo.texto.slice(0, MAX_CAMPO) : campo.texto;
            const r = anonymize(texto, CFG);
            for (const s of r.spans)
                anota(s.entity, campo.texto.slice(s.start, s.end), campo.ubicacion);
            if (campo.siempreSensible && !r.spans.length) {
                anota(campo.siempreSensible === "cookie" ? "cookie-sesion" : "cabecera-autenticacion", campo.valor, campo.ubicacion);
            }
        }
    });
    return { origen: "har", hallazgos, porCategoria, limpio: limpiarHar(o, entradas.length > MAX_ENTRADAS ? MAX_ENTRADAS : undefined), entradasHar: entradas.length, truncado };
}
function limpiarHar(o: {
    log: {
        entries: HarEntry[];
    };
}, tope?: number): string {
    const copia = JSON.parse(JSON.stringify(o)) as {
        log: {
            entries: HarEntry[];
        };
    };
    if (tope)
        copia.log.entries = copia.log.entries.slice(0, tope);
    const entradas = copia.log.entries;
    const limpia = (v: unknown, nombre?: string, siempreSensible?: CampoHar["siempreSensible"]): unknown => {
        const t = cadena(v);
        if (!t)
            return v;
        const texto = nombre ? `${nombre}: ${t}` : t;
        const r = anonymize(texto, CFG);
        if (siempreSensible && !r.spans.length)
            return "[REDACTED]";
        return nombre ? r.text.slice(nombre.length + 2) : r.text;
    };
    for (const e of entradas) {
        for (const h of lista(e.request?.headers))
            h.value = limpia(h.value, cadena(h.name), CABECERA_SIEMPRE_SENSIBLE.test(cadena(h.name)) ? "cabecera-auth" : undefined);
        for (const c of lista(e.request?.cookies))
            c.value = limpia(c.value, cadena(c.name), "cookie");
        for (const q of lista(e.request?.queryString))
            q.value = limpia(q.value, cadena(q.name));
        for (const p of lista(e.request?.postData?.params))
            p.value = limpia(p.value, cadena(p.name));
        if (e.request?.postData)
            e.request.postData.text = limpia(e.request.postData.text);
        for (const h of lista(e.response?.headers))
            h.value = limpia(h.value, cadena(h.name), CABECERA_SIEMPRE_SENSIBLE.test(cadena(h.name)) ? "cabecera-auth" : undefined);
        for (const c of lista(e.response?.cookies))
            c.value = limpia(c.value, cadena(c.name), "cookie");
        if (e.response?.content?.text) {
            const decodificado = textoDeContenido(e.response.content);
            if (decodificado) {
                e.response.content.text = limpia(decodificado);
                delete e.response.content.encoding;
            }
        }
    }
    return JSON.stringify(copia, null, 2);
}
function categoriaDe(entidad: string): EntityCategory {
    return CATEGORIA_POR_ENTIDAD[entidad] ?? "secret";
}
const CATEGORIA_POR_ENTIDAD: Record<string, EntityCategory> = Object.fromEntries(DETECTORS.map(d => [d.id, d.category]));
function analizarTextoPlano(contenido: string): AnalisisPegado {
    const truncado = contenido.length > MAX_CAMPO * 10;
    const texto = truncado ? contenido.slice(0, MAX_CAMPO * 10) : contenido;
    const r = anonymize(texto, CFG);
    const hallazgos: HallazgoPegado[] = r.spans.map(s => ({
        entidad: s.entity,
        categoria: categoriaDe(s.entity),
        vistaPrevia: vistaPrevia(s.value),
        linea: texto.slice(0, s.start).split("\n").length,
    }));
    const porCategoria: Partial<Record<EntityCategory, number>> = {};
    for (const h of hallazgos)
        porCategoria[h.categoria] = (porCategoria[h.categoria] ?? 0) + 1;
    return { origen: "texto", hallazgos, porCategoria, limpio: r.text + (truncado ? contenido.slice(MAX_CAMPO * 10) : ""), truncado };
}
export function analizarPegado(contenido: string): AnalisisPegado {
    if (pareceHar(contenido)) {
        try {
            return analizarHar(contenido);
        }
        catch { }
    }
    return analizarTextoPlano(contenido);
}
