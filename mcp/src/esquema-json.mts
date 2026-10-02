import Ajv from "ajv";
import Ajv2019 from "ajv/dist/2019.js";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
type Borrador = "2020-12" | "2019-09" | "draft-07";
function borradorDe(esquema: unknown): Borrador | {
    error: string;
} {
    const id = typeof esquema === "object" && esquema !== null ? (esquema as Record<string, unknown>)["$schema"] : undefined;
    if (id === undefined)
        return "2020-12";
    const s = String(id);
    if (/2020-12/.test(s))
        return "2020-12";
    if (/2019-09/.test(s))
        return "2019-09";
    if (/draft-0[67]/.test(s))
        return "draft-07";
    if (/draft-0[34]/.test(s))
        return { error: `Schema declares ${s}: draft-04 and older are not supported. Change $schema to draft-07 or 2020-12 (most draft-04 schemas validate the same under draft-07, except exclusiveMinimum/Maximum as booleans and "id" instead of "$id").` };
    return { error: `Unknown $schema "${s}". Supported: 2020-12, 2019-09, draft-07 (and draft-06, validated as draft-07).` };
}
function leer(texto: string, que: string): {
    valor: unknown;
} | {
    error: string;
} {
    try {
        return { valor: JSON.parse(texto) };
    }
    catch (e) {
        return { error: `The ${que} is not valid JSON: ${(e as Error).message}` };
    }
}
export function validarConEsquema(json: string, esquemaTxt: string, maxErrores = 50) {
    const doc = leer(json, "document");
    if ("error" in doc)
        return doc;
    const esq = leer(esquemaTxt, "schema");
    if ("error" in esq)
        return esq;
    if (typeof esq.valor !== "object" && typeof esq.valor !== "boolean")
        return { error: "A JSON Schema must be an object (or true/false)." };
    const draft = borradorDe(esq.valor);
    if (typeof draft === "object")
        return draft;
    const Clase = draft === "2020-12" ? Ajv2020 : draft === "2019-09" ? Ajv2019 : Ajv;
    const ajv = new Clase({ allErrors: true, strict: false, validateFormats: true });
    addFormats(ajv);
    let validar;
    try {
        validar = ajv.compile(esq.valor as object);
    }
    catch (e) {
        return { error: `The schema itself is invalid (${draft}): ${(e as Error).message}` };
    }
    const valid = validar(doc.valor) as boolean;
    const errores = validar.errors ?? [];
    return {
        valid,
        draft,
        errorCount: valid ? 0 : errores.length,
        errors: valid ? [] : errores.slice(0, maxErrores).map((e) => ({
            path: e.instancePath || "/",
            keyword: e.keyword,
            message: e.message,
            params: e.params,
            schemaPath: e.schemaPath,
        })),
        truncated: !valid && errores.length > maxErrores ? true : undefined,
    };
}
