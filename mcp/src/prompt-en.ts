import type { Hallazgo } from "../../src/app/services/prompt-lint.service";
const REGLA: Record<string, {
    code: string;
    fix: string;
}> = {
    "sin-formato": { code: "no-output-contract", fix: "Describe the exact shape of the answer (fields, format, an example). Without it every run differs and nothing can be checked automatically." },
    "json-sin-forma": { code: "json-without-shape", fix: "Show the JSON object or its schema: \"answer in JSON\" is an intention, not a contract. Where the API supports it, pass the schema as a strict structured output." },
    "sin-criterio-exito": { code: "no-definition-of-done", fix: "Say what must be true for the work to count as finished (what the answer covers, tests passing, the bug no longer reproducing)." },
    "sin-regla-incertidumbre": { code: "no-uncertainty-rule", fix: "Say what to do when information is missing: ask, say it is not known, or leave it blank. Without it the model fills the gap, confidently." },
    "contradiccion": { code: "contradiction", fix: "Two instructions pull in opposite directions. Keep one, or say which wins and when." },
    "vago": { code: "vague", fix: "Replace words the model cannot check (\"appropriate\", \"professional\") with something measurable: a length, a tone with an example, a list of what must appear." },
    "prohibiciones-sin-alternativa": { code: "prohibitions-without-alternative", fix: "For each \"do not X\", say what to do instead, and why." },
    "sin-ejemplos": { code: "no-examples", fix: "Add a couple of varied input \u2192 output examples: they raise reliability more than another paragraph of rules. With reasoning models vendors disagree: start without and measure." },
    "demasiados-ejemplos": { code: "too-many-examples", fix: "Keep a few varied, representative examples instead of a list of edge cases: they are paid on every request." },
    "prompt-largo": { code: "long-prompt", fix: "A system prompt is paid on every request: see what can move to each request's data, or be trimmed. If the bulk is a list of edge cases, replace it with a few representative examples." },
    "sin-estructura": { code: "no-structure", fix: "Separate the parts (instructions, context, input, examples) with Markdown headings or XML tags, so the model does not mistake one for another." },
    "rol-experto": { code: "expert-persona", fix: "An expert persona does not raise accuracy. Use the role for tone, focus and audience (\"explain it to first-year students\"), and put accuracy in the goal and the definition of done." },
    "lenguaje-agresivo": { code: "shouting", fix: "Write emphatic words in a normal tone and give the reason instead: current models follow the prompt and overshoot when shouted at." },
    "encargo-sin-entregable": { code: "task-without-deliverable", fix: "Say what to hand back: a pull request, a file, a short report of what changed." },
    "encargo-sin-contexto": { code: "task-without-context", fix: "Point to where to look: the files, folders, docs or links that matter." },
    "encargo-sin-verificacion": { code: "task-without-verification", fix: "Say how the agent can check its own work: the test or command to run, or how to reproduce the bug." },
    "encargo-sin-limites": { code: "task-without-boundaries", fix: "Say what is out of scope: files or interfaces not to touch, decisions to ask about first." },
};
const NIVEL: Record<Hallazgo["nivel"], string> = { error: "error", aviso: "warning", sugerencia: "suggestion" };
const CLAVE: Record<string, string> = { palabras: "words", n: "count", cual: "which", tokens: "tokens", frase: "phrase" };
const CUAL: Record<string, string> = { brevedad: "brief-vs-detailed", "nunca-siempre": "never-vs-always", tono: "formal-vs-informal" };
export const reglasSinTraducir = (ids: string[]) => ids.filter((id) => !REGLA[id]);
export const hallazgoPromptEn = (h: Hallazgo) => {
    const r = REGLA[h.id];
    const datos = h.datos && Object.fromEntries(Object.entries(h.datos).map(([k, v]) => [CLAVE[k] ?? k, k === "cual" ? (CUAL[String(v)] ?? v) : v]));
    return {
        code: r?.code ?? h.id,
        level: NIVEL[h.nivel],
        fix: r?.fix ?? "",
        ...(datos ? { details: datos } : {}),
        ...(h.practica ? { practice: h.practica } : {}),
    };
};
