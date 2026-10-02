export type NivelHallazgo = "error" | "aviso" | "sugerencia";
export interface Hallazgo {
    id: string;
    nivel: NivelHallazgo;
    datos?: Record<string, string | number>;
}
export interface SeccionPrompt {
    id: string;
    enabled: boolean;
    content: string;
}
const VAGAS = [
    "apropiado",
    "apropiada",
    "adecuado",
    "adecuada",
    "de calidad",
    "profesional",
    "lo mejor posible",
    "razonable",
    "correcto",
    "correcta",
    "bien",
    "\u00F3ptimo",
    "\u00F3ptima",
];
const CONTRADICCIONES: [
    RegExp,
    RegExp,
    string
][] = [
    [/\b(breve|conciso|concisa|corto|corta)\b/i, /\b(detallad[oa]|exhaustiv[oa]|extens[oa]|en profundidad)\b/i, "brevedad"],
    [/\bnunca\b/i, /\bsiempre\b/i, "nunca-siempre"],
    [/\bformal\b/i, /\b(informal|cercan[oa]|coloquial)\b/i, "tono"],
];
export class PromptLintService {
    lint(secciones: SeccionPrompt[], nEjemplos: number, ensamblado: string): Hallazgo[] {
        const out: Hallazgo[] = [];
        const activas = secciones.filter(s => s.enabled && s.content.trim());
        const texto = ensamblado.trim();
        const bajo = texto.toLowerCase();
        const sec = (id: string) => activas.find(s => s.id === id)?.content.trim() ?? "";
        if (!texto)
            return out;
        const formato = sec("format");
        const donde = formato || texto;
        const CONTRATO = /\b(json|yaml|xml|markdown|csv|esquema|schema|formato|format|devuelve|responde con|estructura|campos?)\b/i;
        if (!CONTRATO.test(donde)) {
            out.push({ id: "sin-formato", nivel: "error" });
        }
        else if (/\bjson\b/i.test(donde) && !/[{[]/.test(donde)) {
            out.push({ id: "json-sin-forma", nivel: "aviso" });
        }
        if (!/\b(criterio|éxito|exito|terminad|complet|hecho|listo|done|success)\w*\b/i.test(bajo)) {
            out.push({ id: "sin-criterio-exito", nivel: "aviso" });
        }
        if (!/\b(no (lo )?sabes|no est[áa]s? segur|desconoc|insuficiente|no hay (datos|información|informacion)|pregunta|aclara|incertidumbre)\w*\b/i.test(bajo)) {
            out.push({ id: "sin-regla-incertidumbre", nivel: "error" });
        }
        for (const [a, b, cual] of CONTRADICCIONES) {
            if (a.test(texto) && b.test(texto))
                out.push({ id: "contradiccion", nivel: "aviso", datos: { cual } });
        }
        const vagas = VAGAS.filter(v => bajo.includes(v));
        if (vagas.length)
            out.push({ id: "vago", nivel: "sugerencia", datos: { palabras: vagas.join(", "), n: vagas.length } });
        const frases = texto.split(/(?<=[.!?\n])\s+/);
        const PROHIBE = /\bno\s+(uses|hagas|incluyas|menciones|escribas|respondas|añadas)\b/i;
        const ALTERNATIVA = /\ben su lugar\b|\ben vez de\b|\bsustitu\w+\b|\bprefiere\b/i;
        const conProhibicion = frases.filter(f => PROHIBE.test(f));
        if (conProhibicion.length >= 3 && !conProhibicion.some(f => ALTERNATIVA.test(f))) {
            out.push({ id: "prohibiciones-sin-alternativa", nivel: "sugerencia", datos: { n: conProhibicion.length } });
        }
        if (nEjemplos === 0)
            out.push({ id: "sin-ejemplos", nivel: "sugerencia" });
        else if (nEjemplos > 8)
            out.push({ id: "demasiados-ejemplos", nivel: "sugerencia", datos: { n: nEjemplos } });
        const tokens = Math.round(texto.length / 4);
        if (tokens > 2000)
            out.push({ id: "prompt-largo", nivel: "aviso", datos: { tokens } });
        return out;
    }
    resumen(hallazgos: Hallazgo[]): {
        errores: number;
        avisos: number;
        sugerencias: number;
        limpio: boolean;
    } {
        const n = (x: NivelHallazgo) => hallazgos.filter(h => h.nivel === x).length;
        const errores = n("error"), avisos = n("aviso"), sugerencias = n("sugerencia");
        return { errores, avisos, sugerencias, limpio: hallazgos.length === 0 };
    }
}
