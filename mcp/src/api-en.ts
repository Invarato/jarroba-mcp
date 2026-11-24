import type { Hallazgo as SecretoApi, CodigoConv, MsgConv } from "../../src/app/services/api-ir";
import type { Informe, Cambio, ReglaDiff, TextosInforme, Gravedad as GravedadApi } from "../../src/app/services/api-diff";
const DONDE: Record<string, string> = { variable: "variable", cabecera: "header", query: "query", cuerpo: "body", auth: "auth" };
export const secretosEn = (hs: SecretoApi[]) => hs.map((h) => ({
    request: h.peticion === "(colecci\u00F3n)" ? "(collection)" : h.peticion,
    location: DONDE[h.donde] ?? h.donde,
    name: h.nombre,
    maskedSample: h.muestra,
}));
const GRAVEDAD: Record<GravedadApi, string> = { rompe: "breaking", aviso: "warning", info: "info" };
const REGLA: Record<ReglaDiff, string> = {
    "operacion-eliminada": "operation-removed",
    "operacion-nueva": "operation-added",
    "operacion-obsoleta": "operation-deprecated",
    "param-eliminado": "parameter-removed",
    "param-ruta-eliminado": "path-parameter-removed",
    "param-requerido-nuevo": "required-parameter-added",
    "param-opcional-nuevo": "optional-parameter-added",
    "param-pasa-a-requerido": "parameter-became-required",
    "param-pasa-a-opcional": "parameter-became-optional",
    "param-cambia-de-tipo": "parameter-type-changed",
    "campo-eliminado": "field-removed",
    "campo-requerido-nuevo": "required-field-added",
    "campo-opcional-nuevo": "optional-field-added",
    "campo-pasa-a-requerido": "field-became-required",
    "campo-cambia-de-tipo": "field-type-changed",
    "cuerpo-eliminado": "request-body-removed",
    "cuerpo-requerido-nuevo": "required-request-body-added",
    "cuerpo-opcional-nuevo": "optional-request-body-added",
    "cuerpo-pasa-a-requerido": "request-body-became-required",
    "content-type-eliminado": "content-type-removed",
    "enum-valor-eliminado": "enum-value-removed",
    "enum-valor-nuevo": "enum-value-added",
    "enum-cerrado": "enum-closed",
    "enum-abierto": "enum-opened",
    "respuesta-eliminada": "response-removed",
    "respuesta-exito-eliminada": "success-response-removed",
    "respuesta-nueva": "response-added",
    "seguridad-eliminada": "security-removed",
    "seguridad-nueva": "security-added",
    "seguridad-esquema-eliminado": "security-scheme-removed",
    "seguridad-esquema-nuevo": "security-scheme-added",
    "servidor-cambiado": "server-changed",
};
export const reglaApiEn = (r: ReglaDiff) => REGLA[r];
export const informeApiEn = (i: Informe) => ({
    compatible: i.compatible,
    breaking: i.rompe,
    warnings: i.avisos,
    info: i.info,
    from: { title: i.deA.titulo, version: i.deA.version },
    to: { title: i.aB.titulo, version: i.aB.version },
    changes: i.cambios.map((c) => ({
        rule: reglaApiEn(c.regla),
        severity: GRAVEDAD[c.gravedad],
        operation: c.operacion === "(global)" ? "(global)" : c.operacion,
        detail: cambioApiEn(c).detail,
        ...(cambioApiEn(c).why ? { why: cambioApiEn(c).why } : {}),
    })),
});
const s = (d: Record<string, string | number>, k: string): string => String(d[k] ?? "");
const CONV: Record<CodigoConv, (d: Record<string, string | number>) => string> = {
    "vacio-convertir": d => `There is nothing to convert.`,
    "vacio-leer": d => `There is nothing to read.`,
    "json-invalido": d => `Not valid JSON: ${s(d, "detalle")}`,
    "json-o-yaml-ilegible": d => `Could not be read as JSON or YAML: ${s(d, "detalle")}`,
    "curl-ninguno": d => `No curl command was found.`,
    "curl-sin-url": d => `A curl command was found, but without a URL: there is no request to build.`,
    "postman-no-objeto": d => `The JSON is not an object.`,
    "postman-sin-item": d => `This does not look like a Postman collection: the «item» list is missing.`,
    "insomnia-sin-resources": d => `This does not look like an Insomnia export: the «resources» list is missing.`,
    "insomnia-sin-peticiones": d => `The export contains no requests.`,
    "har-sin-entries": d => `This does not look like a HAR: «log.entries» is missing.`,
    "har-solo-recursos": d => `The ${s(d, "n")} entries in the HAR were all resources (images, CSS…). Turn the filter off to import them.`,
    "har-sin-peticiones": d => `The HAR contains no requests.`,
    "bruno-ninguna": d => `No .bru request was found in the given files.`,
    "openapi-no-objeto": d => `The document is not an object.`,
    "openapi-sin-paths": d => `This does not look like OpenAPI or Swagger: the «paths» object is missing.`,
    "curl-cabecera-sin-dos-puntos": d => `Request ${s(d, "n")}: header without «:», ignored: «${s(d, "texto")}».`,
    "curl-campo-sin-igual": d => `Request ${s(d, "n")}: form field without «=», ignored: «${s(d, "texto")}».`,
    "curl-opcion-desconocida": d => `Request ${s(d, "n")}: option «${s(d, "flag")}» not recognised, ignored.`,
    "curl-sobra": d => `Request ${s(d, "n")}: «${s(d, "texto")}» is extra (there was already a URL), ignored.`,
    "curl-sube-fichero": d => `Request ${s(d, "n")}: uploads the file «${s(d, "fichero")}»; its content is not in the command.`,
    "curl-sustitucion": d => `Request ${s(d, "n")}: uses command substitution ($(…) or \`…\`). It is copied as is: its real value only exists when it runs.`,
    "curl-variables-entorno": d => `Request ${s(d, "n")}: uses environment variables ($VAR). They are copied as is, unresolved.`,
    "curl-tuberia": d => `Request ${s(d, "n")}: there is a pipe or a redirection. They are not part of the request and are ignored.`,
    "postman-ficheros": d => `«${s(d, "peticion")}»: ${s(d, "n")} file field(s). Postman stores the local path, not the content.`,
    "postman-cuerpo-fichero": d => s(d, "src")
        ? `«${s(d, "peticion")}»: the body is a file (${s(d, "src")}); its content is not in the export.`
        : `«${s(d, "peticion")}»: the body is a file (no path); its content is not in the export.`,
    "postman-secretas": d => `${s(d, "n")} variable(s) marked as secret in Postman travel with their value inside the file.`,
    "postman-scripts": d => `The collection has ${s(d, "n")} Postman script(s) (pre-request / test). They are not translated: they are code against the Postman runtime (pm.*), which does not exist outside it. They stay out of the conversion.`,
    "insomnia-plantillas": d => `${s(d, "n")} request(s) use Insomnia templates ({% … %}); they are copied as is, because their value only exists inside Insomnia.`,
    "insomnia-ciclo": d => `«${s(d, "nombre")}»: the folder chain forms a cycle; it is cut where it was detected.`,
    "har-recursos": d => `${s(d, "n")} resource request(s) were left out (images, CSS, fonts, scripts). Turn the filter off to see them.`,
    "har-cache": d => `${s(d, "n")} response(s) served from the browser cache were left out.`,
    "har-sensible": d => `A HAR keeps the headers EXACTLY as they were sent: session cookies, «Authorization» and form bodies. Review what you imported before sharing it with anyone.`,
    "bruno-no-reconocido": d => `«${s(d, "ruta")}»: not recognised as a .bru request; skipped.`,
    "bruno-scripts-coleccion": d => s(d, "primeros")
        ? `The collection: has ${s(d, "primeros")} and ${s(d, "ultimo")}. It is JavaScript code and is not translated; it stays out of the conversion.`
        : `The collection: has ${s(d, "ultimo")}. It is JavaScript code and is not translated; it stays out of the conversion.`,
    "bruno-scripts": d => s(d, "primeros")
        ? `«${s(d, "peticion")}»: has ${s(d, "primeros")} and ${s(d, "ultimo")}. It is JavaScript code and is not translated; it stays out of the conversion.`
        : `«${s(d, "peticion")}»: has ${s(d, "ultimo")}. It is JavaScript code and is not translated; it stays out of the conversion.`,
    "openapi-ref-externa": d => `«${s(d, "ref")}» is an external reference: it is not resolved (it would need to go out to the network).`,
};
export const convEn = (m: MsgConv): string => CONV[m.que](m.datos ?? {});
type DatosDiff = Record<string, string | number>;
const CAMBIOS: Record<ReglaDiff, {
    detail: (d: DatosDiff) => string;
    why?: string;
}> = {
    "operacion-eliminada": { detail: d => `The operation no longer exists.`, why: "A client that calls it will get a 404 or 405." },
    "operacion-nueva": { detail: d => s(d, "resumen")
            ? `New operation: ${s(d, "resumen")}.`
            : `New operation.`, why: "Adding does not break anyone who does not use it." },
    "operacion-obsoleta": { detail: d => `Marked as deprecated.`, why: "It still works, but it announces that it is going away." },
    "servidor-cambiado": { detail: d => `The server changes from «${s(d, "antes")}» to «${s(d, "despues")}».`, why: "A client with a hard-coded base URL will keep calling the old address." },
    "param-requerido-nuevo": { detail: d => `New REQUIRED parameter: «${s(d, "nombre")}» (${s(d, "donde")}).`, why: "The old client does not send it; the call will start failing." },
    "param-opcional-nuevo": { detail: d => `New optional parameter: «${s(d, "nombre")}» (${s(d, "donde")}).`, why: "The old client does not send it and keeps working as before." },
    "param-pasa-a-requerido": { detail: d => `«${s(d, "nombre")}» (${s(d, "donde")}) becomes required.`, why: "A client that left it out will stop working." },
    "param-pasa-a-opcional": { detail: d => `«${s(d, "nombre")}» (${s(d, "donde")}) becomes optional.`, why: "Relaxing a requirement does not break anyone who already met it." },
    "param-cambia-de-tipo": { detail: d => `«${s(d, "nombre")}» (${s(d, "donde")}) changes from ${s(d, "de")} to ${s(d, "a")}.`, why: "What the client sends may stop being valid." },
    "param-ruta-eliminado": { detail: d => `The path parameter «${s(d, "nombre")}» disappears.`, why: "The shape of the URL changes: the one the client builds no longer exists." },
    "param-eliminado": { detail: d => `The parameter «${s(d, "nombre")}» (${s(d, "donde")}) disappears.`, why: "Whatever the client keeps sending will be ignored; check whether it relied on the effect." },
    "enum-abierto": { detail: d => `«${s(d, "nombre")}» is no longer limited to a list of values.`, why: "Accepting more than it accepted before breaks no one." },
    "enum-cerrado": { detail: d => `«${s(d, "nombre")}» becomes limited to: ${s(d, "valores")}.`, why: "A value the client used to send may no longer be valid." },
    "enum-valor-eliminado": { detail: d => `«${s(d, "nombre")}» no longer accepts: ${s(d, "valores")}.`, why: "A client that sent that value will start getting an error." },
    "enum-valor-nuevo": { detail: d => `«${s(d, "nombre")}» also accepts: ${s(d, "valores")}.`, why: "Accepting one more value does not affect anyone who does not send it." },
    "cuerpo-requerido-nuevo": { detail: d => `The operation now requires a body.`, why: "The old client does not send one." },
    "cuerpo-opcional-nuevo": { detail: d => `The operation now accepts an optional body.` },
    "cuerpo-eliminado": { detail: d => `The operation no longer declares a body.`, why: "Whatever the client sends will be ignored." },
    "cuerpo-pasa-a-requerido": { detail: d => `The body becomes required.`, why: "A call without a body will stop being valid." },
    "content-type-eliminado": { detail: d => `No longer accepts: ${s(d, "tipos")}.`, why: "A client that sends that Content-Type will get a 415." },
    "campo-requerido-nuevo": { detail: d => `New REQUIRED field in the body: «${s(d, "nombre")}» (${s(d, "tipo")}).`, why: "The body the old client sends is no longer valid." },
    "campo-opcional-nuevo": { detail: d => `New optional field in the body: «${s(d, "nombre")}» (${s(d, "tipo")}).` },
    "campo-pasa-a-requerido": { detail: d => `The body field «${s(d, "nombre")}» becomes required.`, why: "A client that left it out will stop working." },
    "campo-cambia-de-tipo": { detail: d => `The body field «${s(d, "nombre")}» changes from ${s(d, "de")} to ${s(d, "a")}.`, why: "What the client sends may stop being valid." },
    "campo-eliminado": { detail: d => d["eraObligatorio"] === 1
            ? `The field «${s(d, "nombre")}» disappears from the body (it was required).`
            : `The field «${s(d, "nombre")}» disappears from the body.`, why: "Whatever the client keeps sending will be ignored; check whether it relied on the effect." },
    "respuesta-exito-eliminada": { detail: d => `No longer documents the response ${s(d, "codigos")}.`, why: "A client that expects that code may be left without the branch that handles it." },
    "respuesta-eliminada": { detail: d => `No longer documents: ${s(d, "codigos")}.`, why: "It may be documentation only, but if the client handled it, take a look." },
    "respuesta-nueva": { detail: d => `Documents new responses: ${s(d, "codigos")}.` },
    "seguridad-nueva": { detail: d => `Now requires authentication: ${s(d, "esquemas")}.`, why: "A client that called without credentials will get a 401." },
    "seguridad-esquema-nuevo": { detail: d => `Also requires: ${s(d, "esquemas")}.`, why: "The client does not send that scheme and will be rejected." },
    "seguridad-esquema-eliminado": { detail: d => `No longer requires: ${s(d, "esquemas")}.`, why: "Relaxing a requirement does not break anyone who already met it." },
    "seguridad-eliminada": { detail: d => `No longer requires authentication.`, why: "A client that already sent it keeps working." },
};
export const cambioApiEn = (c: Cambio) => ({ detail: CAMBIOS[c.regla].detail(c.datos), why: CAMBIOS[c.regla].why });
export const TEXTOS_INFORME_EN: TextosInforme = {
    titulo: (inf) => `API changes: ${inf.deA.titulo} ${inf.deA.version} → ${inf.aB.version}`,
    veredicto: (inf) => inf.compatible
        ? `**Compatible.** No change breaks an existing client (${inf.avisos} warning(s), ${inf.info} informational).`
        : `**${inf.rompe} BREAKING change(s).** A client that already exists will stop working.`,
    bloque: (g) => (g === "rompe" ? "Breaking" : g === "aviso" ? "Warnings" : "Informational"),
    cambio: (c) => { const x = cambioApiEn(c); return { detalle: x.detail, porque: x.why }; },
};
