export type NivelHallazgo = "error" | "aviso" | "sugerencia";
export interface Hallazgo {
    id: string;
    nivel: NivelHallazgo;
    datos?: Record<string, string | number>;
    practica?: string;
}
export type TipoPrompt = "sistema" | "encargo";
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
const VAGAS_EN = /\b(appropriate|appropriately|proper|properly|high[- ]quality|professional|as good as possible|reasonable|optimal)\b/gi;
const CONTRADICCIONES: [
    RegExp,
    RegExp,
    string
][] = [
    [/\b(breve|conciso|concisa|corto|corta)\b/i, /\b(detallad[oa]|exhaustiv[oa]|extens[oa]|en profundidad)\b/i, "brevedad"],
    [/\b(brief|concise|short)\b/i, /\b(detailed|exhaustive|in[- ]depth|comprehensive)\b/i, "brevedad"],
    [/\bformal\b/i, /\b(informal|cercan[oa]|coloquial)\b/i, "tono"],
];
const VACIAS = new Set(["nunca", "siempre", "never", "always", "cuando", "donde", "porque", "sobre", "entre", "hasta", "desde", "antes", "despu\u00E9s", "despues", "todos", "todas", "cada", "ning\u00FAn", "ninguna", "ningun", "tienes", "debes", "puedes", "hacer", "responde", "responder", "contesta", "usuario", "should", "would", "every", "about", "there", "their", "which", "without", "answer", "respond", "reply", "user"]);
const raices = (f: string) => new Set(f.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .split(/[^a-z0-9]+/).filter(w => w.length >= 4 && !VACIAS.has(w)).map(w => w.replace(/(es|s)$/, "")));
export function nuncaSiempreDeLoMismo(texto: string): boolean {
    const frases = texto.split(/(?<=[.!?\n])\s+/);
    const nunca = frases.filter(f => /\b(nunca|never)\b/i.test(f)).map(raices);
    const siempre = frases.filter(f => /\b(siempre|always)\b/i.test(f)).map(raices);
    return nunca.some(a => siempre.some(b => [...a].some(w => b.has(w))));
}
const ENCARGO = "encargo-al-agente-con-objetivo-contexto-y-criterio-de-hecho";
export class PromptLintService {
    lint(secciones: SeccionPrompt[], nEjemplos: number, ensamblado: string, tipo: TipoPrompt = "sistema"): Hallazgo[] {
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
        if (tipo === "encargo") {
            if (!/\b(entreg|devuelve|informe|resumen|pr\b|pull request|commit|deliver|return|report|summary|output)\w*/i.test(texto)) {
                out.push({ id: "encargo-sin-entregable", nivel: "aviso", practica: ENCARGO });
            }
        }
        else if (!CONTRATO.test(donde)) {
            out.push({ id: "sin-formato", nivel: "error" });
        }
        else if (/\bjson\b/i.test(donde) && !/[{[]/.test(donde)) {
            out.push({ id: "json-sin-forma", nivel: "aviso", practica: "salidas-estructuradas-con-esquema" });
        }
        if (!/\b(criterio|éxito|exito|terminad|complet|hecho|listo|done|success|finished)\w*\b/i.test(bajo)) {
            out.push({ id: "sin-criterio-exito", nivel: "aviso", ...(tipo === "encargo" ? { practica: ENCARGO } : {}) });
        }
        const INCERTIDUMBRE = /\b(no (lo )?sabes|no est[áa]s? segur|desconoc|insuficiente|no hay (datos|información|informacion)|pregunta|aclara|incertidumbre)\w*\b/i;
        const UNCERTAINTY = /\b(don'?t know|do not know|not sure|unsure|uncertain|unclear|insufficient|missing|not enough (data|information|context)|ask (the user|for|me|before)|clarif\w*|say so)\b/i;
        if (!INCERTIDUMBRE.test(bajo) && !UNCERTAINTY.test(bajo)) {
            out.push({ id: "sin-regla-incertidumbre", nivel: tipo === "encargo" ? "aviso" : "error", practica: "permitir-decir-no-lo-se-contra-alucinaciones" });
        }
        for (const [a, b, cual] of CONTRADICCIONES) {
            if (a.test(texto) && b.test(texto) && !out.some((h) => h.id === "contradiccion" && h.datos?.["cual"] === cual)) {
                out.push({ id: "contradiccion", nivel: "aviso", datos: { cual }, practica: "instrucciones-contradictorias-en-el-prompt" });
            }
        }
        if (nuncaSiempreDeLoMismo(texto) && !out.some((h) => h.id === "contradiccion" && h.datos?.["cual"] === "nunca-siempre")) {
            out.push({ id: "contradiccion", nivel: "aviso", datos: { cual: "nunca-siempre" }, practica: "instrucciones-contradictorias-en-el-prompt" });
        }
        const vagas = [...VAGAS.filter(v => bajo.includes(v)), ...new Set([...texto.matchAll(VAGAS_EN)].map(m => m[0].toLowerCase()))];
        if (vagas.length)
            out.push({ id: "vago", nivel: "sugerencia", datos: { palabras: vagas.join(", "), n: vagas.length } });
        const frases = texto.split(/(?<=[.!?\n])\s+/);
        const PROHIBE = /\bno\s+(uses|hagas|incluyas|menciones|escribas|respondas|añadas)\b|\b(don'?t|do not|never)\s+(use|do|include|mention|write|answer|respond|add)\b/i;
        const ALTERNATIVA = /\ben su lugar\b|\ben vez de\b|\bsustitu\w+\b|\bprefiere\b|\binstead\b|\brather than\b|\bprefer\b|\breplace\b/i;
        const conProhibicion = frases.filter(f => PROHIBE.test(f));
        if (conProhibicion.length >= 3 && !conProhibicion.some(f => ALTERNATIVA.test(f))) {
            out.push({ id: "prohibiciones-sin-alternativa", nivel: "sugerencia", datos: { n: conProhibicion.length }, practica: "decir-que-hacer-en-vez-de-que-no-hacer" });
        }
        if (tipo === "sistema") {
            if (nEjemplos === 0)
                out.push({ id: "sin-ejemplos", nivel: "sugerencia", practica: "few-shot-con-modelos-de-razonamiento" });
            else if (nEjemplos > 8)
                out.push({ id: "demasiados-ejemplos", nivel: "sugerencia", datos: { n: nEjemplos } });
        }
        const tokens = Math.round(texto.length / 4);
        if (tipo === "sistema" && tokens > 2000)
            out.push({ id: "prompt-largo", nivel: "aviso", datos: { tokens } });
        const EXPERTO = /\b(experto|experta|expert|world[- ]class|de (talla|nivel) mundial|el mejor|la mejor|the best)\b/i;
        const ROL = /\b(eres|act[úu]a como|actuar[áa]s como|you are|you're|act as)\b[^.;:,\n]{0,80}/gi;
        const rolExperto = [...texto.matchAll(ROL)].find((m) => EXPERTO.test(m[0]));
        if (rolExperto) {
            out.push({ id: "rol-experto", nivel: "sugerencia", datos: { frase: rolExperto[0].trim().slice(0, 80) }, practica: "rol-de-experto-para-mejorar-la-precision" });
        }
        const GRITOS = texto.match(/\b(CRITICAL|CRUCIAL|IMPORTANT|MUST|NEVER|ALWAYS|MANDATORY|CRÍTICO|CRITICO|IMPORTANTE|OBLIGATORIO|NUNCA|SIEMPRE|JAMÁS|JAMAS|DEBES)\b/g) ?? [];
        if (GRITOS.length >= 2) {
            out.push({ id: "lenguaje-agresivo", nivel: "sugerencia", datos: { palabras: [...new Set(GRITOS)].join(", "), n: GRITOS.length }, practica: "lenguaje-agresivo-en-los-prompts" });
        }
        const estructurado = /^#{1,6}\s/m.test(texto) || /<[a-z_][\w-]*>/i.test(texto) || (texto.match(/^\s*(\d+[.)]|[-*•])\s/gm) ?? []).length >= 3;
        if (tokens > 300 && !estructurado)
            out.push({ id: "sin-estructura", nivel: "sugerencia", datos: { tokens }, practica: "estructurar-el-prompt-con-xml-o-markdown" });
        if (tipo === "encargo") {
            const CONTEXTO = /`[^`]+`|\b[\w.-]+\/[\w./-]+|\b\w+\.(ts|js|mjs|py|java|go|rs|md|json|ya?ml|sql|html|css)\b|\b(fichero|archivo|carpeta|repo|documentaci[óo]n|enlace|file|folder|directory|docs?|link|url)s?\b/i;
            if (!CONTEXTO.test(texto))
                out.push({ id: "encargo-sin-contexto", nivel: "sugerencia", practica: ENCARGO });
            const VERIFICA = /\b(test|tests|prueba|pruebas|comprueba|comprobar|verifica|verificar|ejecuta|lanza|reproduc\w*|check|verify|run|npm|pytest|build|lint)\b/i;
            if (!VERIFICA.test(texto))
                out.push({ id: "encargo-sin-verificacion", nivel: "aviso", practica: ENCARGO });
            const LIMITES = /\bno (toques|cambies|modifiques|edites)\b|\bsolo (en|toca|cambia)\b|\b(fuera de|alcance|sin tocar)\b|\b(don'?t|do not) (touch|change|modify|edit)\b|\bonly (in|touch|change|modify|edit)\b|\b(scope|out of scope|leave .{1,30} as is)\b/i;
            if (!LIMITES.test(texto))
                out.push({ id: "encargo-sin-limites", nivel: "sugerencia", practica: ENCARGO });
        }
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
