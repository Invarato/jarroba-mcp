import { Injectable } from "@angular/core";
import { textoPropiedadEn } from "./test-cases-textos-en";
export type TipoBase = "entero" | "decimal" | "texto" | "booleano" | "enum" | "lista" | "objeto" | "desconocido";
export interface Parametro {
    nombre: string;
    tipo: TipoBase;
    opcional?: boolean;
    min?: number;
    max?: number;
    minLongitud?: number;
    maxLongitud?: number;
    valores?: string[];
}
export type Tecnica = "valores-limite" | "particiones" | "tabla-decision" | "ninguna";
export type CasoKind = "opcional-null" | "bajo-min-invalido" | "min-exacto" | "sobre-min" | "bajo-max" | "max-exacto" | "sobre-max-invalido" | "cero" | "negativo" | "positivo-pequeno" | "coma-flotante" | "nan-invalido" | "max-seguro" | "bajo-min-longitud-invalido" | "min-longitud-exacta" | "max-longitud-exacta" | "sobre-max-longitud-invalido" | "cadena-vacia" | "solo-espacios" | "texto-normal" | "unicode-emoji-rtl" | "texto-muy-largo" | "bool-true" | "bool-false" | "valor-enum" | "fuera-enum-invalido" | "lista-vacia" | "lista-un-elemento" | "lista-varios" | "lista-repetidos" | "objeto-vacio" | "objeto-completo";
export interface CasoSugerido {
    valor: string;
    kind: CasoKind;
    invalido?: boolean;
    prioridad: 1 | 2 | 3;
}
export interface CasoPriorizado extends CasoSugerido {
    parametro: string;
    tecnica: Tecnica;
}
export type TecnicaKind = "rango-numerico" | "particiones-numerico" | "rango-texto" | "particiones-texto" | "booleano" | "enum" | "lista" | "objeto" | "desconocido";
export interface PlanParametro {
    parametro: string;
    tipo: TipoBase;
    tecnica: Tecnica;
    tecnicaKind: TecnicaKind;
    casos: CasoSugerido[];
}
export type PropiedadKind = "total" | "determinista" | "honesta" | "rango";
export interface Propiedad {
    nombre: string;
    kind: PropiedadKind;
    rango?: {
        parametro: string;
        min: number;
        max: number;
    };
}
export type Aviso = {
    kind: "sin-tipo-derivable";
    parametros: string[];
} | {
    kind: "sin-parametros";
};
export interface PlanDePruebas {
    parametros: PlanParametro[];
    total: number;
    propiedades: Propiedad[];
    avisos: Aviso[];
}
const MAX_SEGURO = 9007199254740991;
@Injectable({ providedIn: "root" })
export class TestCasesService {
    planificar(parametros: readonly Parametro[]): PlanDePruebas {
        const planes = parametros.map((p) => this.planParametro(p));
        const avisos: Aviso[] = [];
        const desconocidos = planes.filter((p) => p.tecnica === "ninguna").map((p) => p.parametro);
        if (desconocidos.length) {
            avisos.push({ kind: "sin-tipo-derivable", parametros: desconocidos });
        }
        if (!parametros.length) {
            avisos.push({ kind: "sin-parametros" });
        }
        return {
            parametros: planes,
            total: this.casosTotales(planes),
            propiedades: this.propiedades(parametros),
            avisos,
        };
    }
    private casosTotales(planes: readonly PlanParametro[]): number {
        return planes.reduce((a, p) => a + p.casos.length, 0);
    }
    private planParametro(p: Parametro): PlanParametro {
        const casos: CasoSugerido[] = [];
        if (p.opcional) {
            casos.push({ valor: "null", kind: "opcional-null", prioridad: 3 });
        }
        switch (p.tipo) {
            case "entero":
            case "decimal": {
                const paso = p.tipo === "entero" ? 1 : 0.01;
                if (p.min !== undefined || p.max !== undefined) {
                    if (p.min !== undefined) {
                        casos.push({ valor: fmt(p.min - paso), kind: "bajo-min-invalido", invalido: true, prioridad: 3 });
                        casos.push({ valor: fmt(p.min), kind: "min-exacto", prioridad: 3 });
                        casos.push({ valor: fmt(p.min + paso), kind: "sobre-min", prioridad: 2 });
                    }
                    if (p.max !== undefined) {
                        casos.push({ valor: fmt(p.max - paso), kind: "bajo-max", prioridad: 2 });
                        casos.push({ valor: fmt(p.max), kind: "max-exacto", prioridad: 3 });
                        casos.push({ valor: fmt(p.max + paso), kind: "sobre-max-invalido", invalido: true, prioridad: 3 });
                    }
                    return { parametro: p.nombre, tipo: p.tipo, tecnica: "valores-limite", tecnicaKind: "rango-numerico", casos };
                }
                casos.push({ valor: "0", kind: "cero", prioridad: 3 });
                casos.push({ valor: "-1", kind: "negativo", prioridad: 3 });
                casos.push({ valor: "1", kind: "positivo-pequeno", prioridad: 1 });
                if (p.tipo === "decimal") {
                    casos.push({ valor: "0.1 + 0.2", kind: "coma-flotante", prioridad: 3 });
                    casos.push({ valor: "NaN", kind: "nan-invalido", invalido: true, prioridad: 3 });
                }
                casos.push({ valor: String(MAX_SEGURO), kind: "max-seguro", prioridad: 2 });
                return { parametro: p.nombre, tipo: p.tipo, tecnica: "particiones", tecnicaKind: "particiones-numerico", casos };
            }
            case "texto": {
                if (p.minLongitud !== undefined || p.maxLongitud !== undefined) {
                    const lo = p.minLongitud ?? 0;
                    const hi = p.maxLongitud;
                    if (lo > 0) {
                        casos.push({ valor: `"${"x".repeat(Math.max(0, lo - 1))}" (${lo - 1} car.)`, kind: "bajo-min-longitud-invalido", invalido: true, prioridad: 3 });
                        casos.push({ valor: `"${"x".repeat(lo)}" (${lo} car.)`, kind: "min-longitud-exacta", prioridad: 3 });
                    }
                    if (hi !== undefined) {
                        casos.push({ valor: `"…" (${hi} car.)`, kind: "max-longitud-exacta", prioridad: 3 });
                        casos.push({ valor: `"…" (${hi + 1} car.)`, kind: "sobre-max-longitud-invalido", invalido: true, prioridad: 3 });
                    }
                    return { parametro: p.nombre, tipo: p.tipo, tecnica: "valores-limite", tecnicaKind: "rango-texto", casos };
                }
                casos.push({ valor: "\"\"", kind: "cadena-vacia", prioridad: 3 });
                casos.push({ valor: "\"   \"", kind: "solo-espacios", prioridad: 3 });
                casos.push({ valor: "\"texto normal\"", kind: "texto-normal", prioridad: 1 });
                casos.push({ valor: "\"\u00D1and\u00FA \uD83D\uDE00 \u05E9\u05DC\u05D5\u05DD\"", kind: "unicode-emoji-rtl", prioridad: 2 });
                casos.push({ valor: "\"x\".repeat(10000)", kind: "texto-muy-largo", prioridad: 2 });
                return { parametro: p.nombre, tipo: p.tipo, tecnica: "particiones", tecnicaKind: "particiones-texto", casos };
            }
            case "booleano":
                casos.push({ valor: "true", kind: "bool-true", prioridad: 2 });
                casos.push({ valor: "false", kind: "bool-false", prioridad: 2 });
                return { parametro: p.nombre, tipo: p.tipo, tecnica: "tabla-decision", tecnicaKind: "booleano", casos };
            case "enum": {
                for (const v of p.valores ?? []) {
                    casos.push({ valor: `'${v}'`, kind: "valor-enum", prioridad: 2 });
                }
                casos.push({ valor: "'__no_existe__'", kind: "fuera-enum-invalido", invalido: true, prioridad: 3 });
                return { parametro: p.nombre, tipo: p.tipo, tecnica: "tabla-decision", tecnicaKind: "enum", casos };
            }
            case "lista":
                casos.push({ valor: "[]", kind: "lista-vacia", prioridad: 3 });
                casos.push({ valor: "[x]", kind: "lista-un-elemento", prioridad: 3 });
                casos.push({ valor: "[x, y, z]", kind: "lista-varios", prioridad: 1 });
                casos.push({ valor: "[x, x]", kind: "lista-repetidos", prioridad: 2 });
                return { parametro: p.nombre, tipo: p.tipo, tecnica: "particiones", tecnicaKind: "lista", casos };
            case "objeto":
                casos.push({ valor: "{}", kind: "objeto-vacio", prioridad: 3 });
                casos.push({ valor: "{ \u2026completo }", kind: "objeto-completo", prioridad: 1 });
                return { parametro: p.nombre, tipo: p.tipo, tecnica: "particiones", tecnicaKind: "objeto", casos };
            default:
                return { parametro: p.nombre, tipo: "desconocido", tecnica: "ninguna", tecnicaKind: "desconocido", casos };
        }
    }
    propiedades(parametros: readonly Parametro[]): Propiedad[] {
        const props: Propiedad[] = [
            { nombre: "TOTAL", kind: "total" },
            { nombre: "DETERMINISTA", kind: "determinista" },
        ];
        if (parametros.some((p) => p.tipo === "entero" || p.tipo === "decimal")) {
            props.push({ nombre: "HONESTA", kind: "honesta" });
        }
        for (const p of parametros) {
            if (p.min !== undefined && p.max !== undefined) {
                props.push({ nombre: `RANGO(${p.nombre})`, kind: "rango", rango: { parametro: p.nombre, min: p.min, max: p.max } });
            }
        }
        return props;
    }
    prioritarios(plan: PlanDePruebas, cuantos = 5): CasoPriorizado[] {
        const porParametro = plan.parametros
            .filter((p) => p.casos.length)
            .map((p) => ({
            tecnica: p.tecnica,
            parametro: p.parametro,
            casos: [...p.casos].sort((a, b) => b.prioridad - a.prioridad),
        }));
        const out: CasoPriorizado[] = [];
        for (let ronda = 0; out.length < cuantos; ronda++) {
            let hubo = false;
            for (const p of porParametro) {
                if (out.length >= cuantos)
                    break;
                const c = p.casos[ronda];
                if (!c)
                    continue;
                hubo = true;
                out.push({ ...c, parametro: p.parametro, tecnica: p.tecnica });
            }
            if (!hubo)
                break;
        }
        return out;
    }
    desdeJsonSchema(schema: unknown): Parametro[] {
        const s = schema as Record<string, any> | null;
        if (!s || typeof s !== "object")
            return [];
        const props = (s["properties"] ?? {}) as Record<string, any>;
        const requeridos = new Set<string>(Array.isArray(s["required"]) ? s["required"] : []);
        return Object.entries(props).map(([nombre, def]) => this.deSchema(nombre, def ?? {}, !requeridos.has(nombre)));
    }
    private deSchema(nombre: string, def: Record<string, any>, opcional: boolean): Parametro {
        const base: Parametro = { nombre, tipo: "desconocido", opcional };
        if (Array.isArray(def["enum"])) {
            return { ...base, tipo: "enum", valores: def["enum"].map(String) };
        }
        switch (def["type"]) {
            case "integer": return { ...base, tipo: "entero", min: def["minimum"], max: def["maximum"] };
            case "number": return { ...base, tipo: "decimal", min: def["minimum"], max: def["maximum"] };
            case "string": return { ...base, tipo: "texto", minLongitud: def["minLength"], maxLongitud: def["maxLength"] };
            case "boolean": return { ...base, tipo: "booleano" };
            case "array": return { ...base, tipo: "lista" };
            case "object": return { ...base, tipo: "objeto" };
            default: return base;
        }
    }
    codigoPropiedades(nombreFuncion: string, parametros: readonly Parametro[], props: readonly Propiedad[]): string {
        const arb = parametros.map((p) => this.arbitrario(p)).join(", ");
        const args = parametros.map((p) => p.nombre).join(", ");
        const decl = parametros.map((p) => p.nombre).join(", ");
        const l: string[] = [
            "import fc from 'fast-check';",
            "",
            `describe('${nombreFuncion} — properties', () => {`,
        ];
        for (const p of props) {
            const { que, porque } = textoPropiedadEn(p);
            l.push(`  // ${que}`);
            l.push(`  // ${porque}`);
            l.push(`  it('${p.nombre}', () => {`);
            l.push(`    fc.assert(fc.property(${arb}, (${decl}) => {`);
            if (p.nombre === "TOTAL")
                l.push(`      ${nombreFuncion}(${args});   // it's enough that it doesn't throw`);
            else if (p.nombre === "DETERMINISTA")
                l.push(`      expect(${nombreFuncion}(${args})).toEqual(${nombreFuncion}(${args}));`);
            else if (p.nombre === "HONESTA")
                l.push(`      expect(Number.isFinite(${nombreFuncion}(${args}))).toBeTrue();`);
            else
                l.push(`      // TODO: assert ${que}`);
            l.push("    }));");
            l.push("  });");
            l.push("");
        }
        l.push("  // And HERE goes the one that actually matters: your DOMAIN property. It does not come");
        l.push("  // from the type \u2014nobody can derive it from a signature\u2014 and it is what separates a test");
        l.push("  // that illustrates from one that verifies. Examples: \"the total is never less than the");
        l.push("  // subtotal\", \"decoding what was encoded returns the original\", \"sorting twice is the");
        l.push("  // same as sorting once\".");
        l.push("});");
        return l.join("\n");
    }
    private arbitrario(p: Parametro): string {
        const rango = (min?: number, max?: number) => {
            const partes: string[] = [];
            if (min !== undefined)
                partes.push(`min: ${min}`);
            if (max !== undefined)
                partes.push(`max: ${max}`);
            return partes.length ? `{ ${partes.join(", ")} }` : "";
        };
        let a: string;
        switch (p.tipo) {
            case "entero":
                a = `fc.integer(${rango(p.min, p.max)})`;
                break;
            case "decimal":
                a = `fc.double(${rango(p.min, p.max)})`;
                break;
            case "texto":
                a = `fc.string(${rango(p.minLongitud, p.maxLongitud)})`;
                break;
            case "booleano":
                a = "fc.boolean()";
                break;
            case "enum":
                a = `fc.constantFrom(${(p.valores ?? []).map((v) => `'${v}'`).join(", ")})`;
                break;
            case "lista":
                a = "fc.array(fc.anything())";
                break;
            case "objeto":
                a = "fc.object()";
                break;
            default: a = "fc.anything()";
        }
        return p.opcional ? `fc.option(${a}, { nil: null })` : a;
    }
}
function fmt(n: number): string {
    return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(10)));
}
