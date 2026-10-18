import type { Hallazgo as SecretoApi } from "../../src/app/services/api-ir";
import type { Informe, Gravedad as GravedadApi } from "../../src/app/services/api-diff";
const DONDE: Record<string, string> = { variable: "variable", cabecera: "header", query: "query", cuerpo: "body", auth: "auth" };
export const secretosEn = (hs: SecretoApi[]) => hs.map((h) => ({
    request: h.peticion === "(colecci\u00F3n)" ? "(collection)" : h.peticion,
    location: DONDE[h.donde] ?? h.donde,
    name: h.nombre,
    maskedSample: h.muestra,
}));
const GRAVEDAD: Record<GravedadApi, string> = { rompe: "breaking", aviso: "warning", info: "info" };
const REGLA: Record<string, string> = {
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
export const reglaApiEn = (r: string) => REGLA[r] ?? r;
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
        detail: c.detalle,
        ...(c.porque ? { why: c.porque } : {}),
    })),
});
