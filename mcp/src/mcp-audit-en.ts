import type { InformeCatalogo, ReglaId, Hallazgo } from "../../src/app/services/mcp-audit.service";
import type { Trifecta } from "../../src/app/services/prompt-injection.service";
import { REGLA_AGENTE, SEVERIDAD } from "./seguridad";
type Datos = Record<string, string | number>;
const s = (d: Datos, k: string) => String(d[k] ?? "");
const PATA: Record<keyof Trifecta, string> = { datosPrivados: "private-data", contenidoNoFiable: "untrusted-content", canalDeSalida: "exfiltration-channel" };
const lista = (v: string, mapa: Record<string, string>) => v ? v.split(", ").map((x) => mapa[x] ?? x).join(", ") : "";
function envenenamiento(d: Datos): string {
    const reglas = lista(s(d, "reglas"), REGLA_AGENTE);
    let t = d["explotable"]
        ? `${s(d, "patas")}/3 signals — matches the published pattern: it asks to read something sensitive AND send it (${reglas}).`
        : `${s(d, "patas")}/3 signals of the trifecta (${reglas}); missing: ${lista(s(d, "faltan"), PATA) || "\u2014"}.`;
    if (d["enEsquema"])
        t += ` In the schema: ${s(d, "enEsquema")}.`;
    if (d["codificado"])
        t += " It was ENCODED (base64, hex or %xx): a person does not see it, the model does.";
    return t;
}
const RULE: Record<ReglaId, string> = {
    "esquema-invalido": "invalid-json",
    "description-vacia": "missing-description",
    "sin-annotations": "missing-annotations",
    "annotations-incompletas": "incomplete-annotations",
    "annotation-sospechosa": "name-annotation-mismatch",
    "nombre-formato-dudoso": "unusual-name-format",
    "registro-campo-largo": "registry-field-too-long",
    "registro-campo-corto": "registry-field-too-short",
    "registro-name-formato": "registry-field-pattern",
    "recuento-desincronizado": "stale-tool-count",
    "sin-instructions": "missing-instructions",
    "instructions-larga": "instructions-may-be-trimmed",
    "version-desincronizada": "version-mismatch",
    "tool-cara": "expensive-tool",
    "posible-envenenamiento": "possible-tool-poisoning",
    "envenenamiento-esquema": "schema-poisoning",
    "sombra-entre-tools": "tool-shadowing",
};
const MESSAGE: Record<ReglaId, (d: Datos) => string> = {
    "esquema-invalido": (d) => `the pasted ${s(d, "fichero")} is not valid JSON; ignored`,
    "description-vacia": () => "no \"description\", or empty",
    "sin-annotations": () => "no \"annotations\": the spec says the client must assume the WORST (it may write, it may be destructive) until stated otherwise",
    "annotations-incompletas": (d) => `missing: ${s(d, "campos")}`,
    "annotation-sospechosa": (d) => `the name suggests it writes or deletes, but ${d["soloLectura"] ? "it declares \"readOnlyHint: true\"" : "\"destructiveHint\" is not \"true\""} — check it by hand; it may be a confusing name, or an optimistic annotation`,
    "nombre-formato-dudoso": () => "not lowercase snake_case: the spec does not forbid it, but it is the convention large catalogues follow and what a model expects to see",
    "registro-campo-largo": (d) => `${s(d, "campo")}: ${s(d, "longitud")} characters, the registry maximum is ${s(d, "maximo")} — the registry answers 422 to this, AFTER you have authenticated`,
    "registro-campo-corto": (d) => `${s(d, "campo")}: ${s(d, "longitud")} characters, the registry minimum is ${s(d, "minimo")}`,
    "registro-name-formato": (d) => `${s(d, "campo")}: "${s(d, "valor")}" does not match the pattern the registry requires (${s(d, "patron")})`,
    "recuento-desincronizado": (d) => `the description quotes "${s(d, "citado")} tools" and the pasted tools/list has ${s(d, "real")}`,
    "sin-instructions": () => "empty. Under Tool Search it is the only thing loaded before the model searches anything: without it, deciding whether to search here comes down to guessing from the server name",
    "instructions-larga": (d) => `${s(d, "bytes")} bytes — some clients are reported to trim this field silently above ~${s(d, "tope")}`,
    "version-desincronizada": (d) => `server.json says "${s(d, "server")}" and package.json says "${s(d, "paquete")}" — the official registry checks the version against npm, and this gives a 400 after you have authenticated`,
    "tool-cara": (d) => `${s(d, "tokens")} tokens, ${s(d, "veces")}× the catalogue median (${s(d, "mediana")})`,
    "posible-envenenamiento": envenenamiento,
    "envenenamiento-esquema": envenenamiento,
    "sombra-entre-tools": (d) => `Its description sets conditions on "${s(d, "nombrada")}", which is not itself: "${s(d, "texto")}". A tool should not say how to use another, let alone one from another server.`,
};
const findingEn = (h: Hallazgo) => ({
    rule: RULE[h.regla],
    severity: SEVERIDAD[h.gravedad],
    ...(h.tool ? { tool: h.tool } : {}),
    message: MESSAGE[h.regla](h.datos ?? {}),
});
export function informeCatalogoEn(r: InformeCatalogo) {
    return {
        totalTools: r.totalTools,
        tokens: r.tokensTotal,
        ...(r.tokensClaude !== null ? { claudeTokensEstimate: r.tokensClaude } : {}),
        perTool: r.porTool.map((p) => ({ tool: p.nombre, tokens: p.tokens })),
        bySeverity: Object.fromEntries(Object.entries(r.porGravedad).map(([g, n]) => [SEVERIDAD[g as Hallazgo["gravedad"]], n])),
        findings: r.hallazgos.map(findingEn),
    };
}
