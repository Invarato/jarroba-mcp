import { ClaimCheckService } from "./claim-check.service";
export type TipoAsercion = "contiene" | "no-contiene" | "regex" | "json" | "rango" | "max-caracteres" | "respaldado";
export interface Asercion {
    tipo: TipoAsercion;
    valor?: string;
    min?: number;
    max?: number;
}
export interface Caso {
    id: string;
    entrada: string;
    salida: string;
    aserciones: Asercion[];
}
export interface ResultadoAsercion {
    indice: number;
    tipo: TipoAsercion;
    pasa: boolean;
    detalle: string;
    regex?: "pendiente" | "agotado";
}
export type PruebaRegex = (patron: string, salida: string) => boolean | "agotado" | undefined;
export interface Veredicto {
    id: string;
    pasa: boolean;
}
export interface ResultadoCaso extends Veredicto {
    resultados: ResultadoAsercion[];
}
export interface Informe {
    total: number;
    pasan: number;
    fallan: number;
    tasa: number;
    casos: ResultadoCaso[];
}
export interface HallazgoBanco {
    id: string;
    gravedad: "error" | "aviso";
    caso?: string;
    datos?: Record<string, string | number>;
}
export interface Comparacion {
    regresiones: string[];
    arreglados: string[];
    estables: number;
    soloAntes: string[];
    soloAhora: string[];
}
const REGEX_TRIVIAL = /^[\^$]*(\.[*?+]?|\(\?:\)|\(\))?[\^$]*$/;
export class EvalBankService {
    private claim = new ClaimCheckService();
    revisar(casos: Caso[]): HallazgoBanco[] {
        const out: HallazgoBanco[] = [];
        const vistos = new Set<string>();
        for (const c of casos) {
            const id = c.id.trim() || "(sin id)";
            if (vistos.has(id))
                out.push({ id: "id-duplicado", gravedad: "error", caso: id });
            vistos.add(id);
            if (!c.aserciones.length) {
                out.push({ id: "caso-sin-aserciones", gravedad: "error", caso: id });
                continue;
            }
            for (const a of c.aserciones) {
                const v = (a.valor ?? "").trim();
                if ((a.tipo === "contiene" || a.tipo === "no-contiene" || a.tipo === "regex") && !v) {
                    out.push({ id: "asercion-vacia", gravedad: "error", caso: id, datos: { tipo: a.tipo } });
                    continue;
                }
                if (a.tipo === "regex") {
                    try {
                        new RegExp(v);
                    }
                    catch {
                        out.push({ id: "regex-invalida", gravedad: "error", caso: id, datos: { patron: v } });
                        continue;
                    }
                    if (REGEX_TRIVIAL.test(v)) {
                        out.push({ id: "regex-trivial", gravedad: "error", caso: id, datos: { patron: v } });
                    }
                }
                if (a.tipo === "rango" && a.min !== undefined && a.max !== undefined && a.min > a.max) {
                    out.push({ id: "rango-imposible", gravedad: "error", caso: id, datos: { min: a.min, max: a.max } });
                }
                if (a.tipo === "max-caracteres" && (a.max === undefined || a.max <= 0)) {
                    out.push({ id: "presupuesto-invalido", gravedad: "error", caso: id });
                }
            }
            const pide = new Set(c.aserciones.filter(a => a.tipo === "contiene").map(a => (a.valor ?? "").trim()).filter(Boolean));
            for (const a of c.aserciones) {
                const v = (a.valor ?? "").trim();
                if (a.tipo === "no-contiene" && v && pide.has(v)) {
                    out.push({ id: "contradictorio", gravedad: "error", caso: id, datos: { valor: v } });
                }
            }
        }
        return out;
    }
    evaluar(caso: Caso, prueba?: PruebaRegex): ResultadoCaso {
        const resultados = caso.aserciones.map((a, i) => this.comprobar(a, i, caso.salida, prueba));
        return { id: caso.id, pasa: resultados.length > 0 && resultados.every(r => r.pasa), resultados };
    }
    private comprobar(a: Asercion, indice: number, salida: string, prueba?: PruebaRegex): ResultadoAsercion {
        const v = (a.valor ?? "").trim();
        const di = (pasa: boolean, detalle: string): ResultadoAsercion => ({ indice, tipo: a.tipo, pasa, detalle });
        switch (a.tipo) {
            case "contiene":
                return di(!!v && salida.includes(v), v ? `«${v}»` : "(vac\u00EDa)");
            case "no-contiene":
                return di(!!v && !salida.includes(v), v ? `«${v}»` : "(vac\u00EDa)");
            case "regex": {
                if (!v)
                    return di(false, "(vac\u00EDa)");
                try {
                    new RegExp(v);
                }
                catch {
                    return di(false, `patrón inválido: ${v}`);
                }
                if (!prueba)
                    return di(new RegExp(v).test(salida), v);
                const r = prueba(v, salida);
                if (r === undefined || r === "agotado") {
                    return { ...di(false, v), regex: r === "agotado" ? "agotado" : "pendiente" };
                }
                return di(r, v);
            }
            case "json": {
                let dato: unknown;
                try {
                    dato = JSON.parse(salida);
                }
                catch {
                    return di(false, "la salida no parsea como JSON");
                }
                const campos = v ? v.split(",").map(s => s.trim()).filter(Boolean) : [];
                if (!campos.length)
                    return di(true, "JSON v\u00E1lido");
                if (typeof dato !== "object" || dato === null || Array.isArray(dato)) {
                    return di(false, "JSON v\u00E1lido, pero no es un objeto con campos");
                }
                const faltan = campos.filter(c => !(c in (dato as Record<string, unknown>)));
                return di(faltan.length === 0, faltan.length ? `faltan: ${faltan.join(", ")}` : campos.join(", "));
            }
            case "rango": {
                const m = salida.match(/-?\d+(?:[.,]\d+)?/);
                if (!m)
                    return di(false, "no hay ning\u00FAn n\u00FAmero en la salida");
                const n = Number(m[0].replace(",", "."));
                const min = a.min ?? -Infinity, max = a.max ?? Infinity;
                const dentro = n >= min && n <= max;
                return di(dentro, `${n} ${dentro ? "\u2208" : "\u2209"} [${a.min ?? "\u2212\u221E"}, ${a.max ?? "\u221E"}]`);
            }
            case "max-caracteres": {
                const max = a.max ?? 0;
                return di(max > 0 && salida.length <= max, `${salida.length} / ${max}`);
            }
            case "respaldado": {
                const r = this.claim.resumen(this.claim.analizar(salida));
                return di(r.sinRespaldo === 0, `${r.sinRespaldo} afirmación(es) categórica(s) sin fuente`);
            }
        }
    }
    correr(casos: Caso[], prueba?: PruebaRegex): Informe {
        const res = casos.map(c => this.evaluar(c, prueba));
        const pasan = res.filter(r => r.pasa).length;
        return {
            total: res.length,
            pasan,
            fallan: res.length - pasan,
            tasa: res.length ? pasan / res.length : 0,
            casos: res,
        };
    }
    comparar(antes: Veredicto[], ahora: Veredicto[]): Comparacion {
        const a = new Map(antes.map(c => [c.id, c.pasa]));
        const b = new Map(ahora.map(c => [c.id, c.pasa]));
        const comunes = [...b.keys()].filter(id => a.has(id));
        return {
            regresiones: comunes.filter(id => a.get(id) && !b.get(id)),
            arreglados: comunes.filter(id => !a.get(id) && b.get(id)),
            estables: comunes.filter(id => a.get(id) === b.get(id)).length,
            soloAntes: [...a.keys()].filter(id => !b.has(id)),
            soloAhora: [...b.keys()].filter(id => !a.has(id)),
        };
    }
    exportarPromptfoo(casos: Caso[]): string {
        const esc = (s: string) => JSON.stringify(s);
        const l: string[] = [
            "# Generado por Jarroba Tools \u2014 banco de evals.",
            "# Las salidas NO viajan aqu\u00ED: promptfoo las produce llamando al proveedor que configures.",
            "# Faltan `providers:` y `prompts:` a prop\u00F3sito \u2014 eso depende de tu entorno, no del banco.",
            "tests:",
        ];
        for (const c of casos) {
            l.push(`  - description: ${esc(c.id)}`);
            l.push("    vars:");
            l.push(`      entrada: ${esc(c.entrada)}`);
            l.push("    assert:");
            let n = 0;
            for (const a of c.aserciones) {
                const v = (a.valor ?? "").trim();
                switch (a.tipo) {
                    case "contiene":
                        l.push(`      - type: contains`, `        value: ${esc(v)}`);
                        n++;
                        break;
                    case "no-contiene":
                        l.push(`      - type: not-contains`, `        value: ${esc(v)}`);
                        n++;
                        break;
                    case "regex":
                        l.push(`      - type: regex`, `        value: ${esc(v)}`);
                        n++;
                        break;
                    case "json": {
                        const campos = v ? v.split(",").map(x => x.trim()).filter(Boolean) : [];
                        l.push(`      - type: is-json`);
                        if (campos.length)
                            l.push(`        value: ${JSON.stringify({ type: "object", required: campos })}`);
                        n++;
                        break;
                    }
                    case "max-caracteres":
                        l.push(`      - type: javascript`, `        value: output.length <= ${a.max ?? 0}`);
                        n++;
                        break;
                    case "rango": {
                        const min = a.min ?? Number.NEGATIVE_INFINITY, max = a.max ?? Number.POSITIVE_INFINITY;
                        l.push(`      - type: javascript`, `        value: "const n = Number((output.match(/-?\\\\d+(?:[.,]\\\\d+)?/) || [NaN])[0]); return n >= ${min} && n <= ${max};"`);
                        n++;
                        break;
                    }
                    case "respaldado":
                        l.push("      # \u00ABrespaldado\u00BB no se exporta: comprueba que ninguna afirmaci\u00F3n categ\u00F3rica", "      # va sin fuente, y eso lo hace el verificador de afirmaciones de la tool.");
                        break;
                }
            }
            if (!n)
                l.push("      - type: javascript", "        value: \"throw new Error('caso sin aserci\u00F3n exportable');\"");
        }
        return l.join("\n") + "\n";
    }
}
