export interface GlossaryTerm {
    term: string;
    target: string;
    synonyms?: string[];
    note?: string;
}
export interface Metric {
    name: string;
    label?: string;
    sparql: string;
    note?: string;
}
export interface SemanticLayer {
    glossary: GlossaryTerm[];
    metrics: Metric[];
}
export const EMPTY_SEMANTIC: SemanticLayer = { glossary: [], metrics: [] };
function norm(s: string): string {
    return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
}
export function groundingForms(layer: SemanticLayer, resolveLocal: (target: string) => string | null): Record<string, string[]> {
    const out: Record<string, string[]> = {};
    for (const g of layer.glossary ?? []) {
        if (!g?.term?.trim() || !g?.target?.trim())
            continue;
        const local = resolveLocal(g.target.trim());
        if (!local)
            continue;
        const key = norm(local);
        const forms = [g.term, ...(g.synonyms ?? [])].map(norm).filter(Boolean);
        if (!forms.length)
            continue;
        out[key] = [...new Set([...(out[key] ?? []), ...forms])];
    }
    return out;
}
export function metricParams(sparql: string): string[] {
    const seen = new Set<string>();
    const re = /\{\{\s*(\w+)\s*\}\}/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(sparql ?? "")))
        seen.add(m[1]);
    return [...seen];
}
export interface MetricInstance {
    sparql: string;
    missing: string[];
}
export function instantiateMetric(metric: Metric, args: Record<string, string> = {}): MetricInstance {
    const declared = metricParams(metric.sparql);
    const missing = declared.filter((p) => args[p] === undefined || args[p] === "");
    const sparql = (metric.sparql ?? "").replace(/\{\{\s*(\w+)\s*\}\}/g, (whole, name: string) => args[name] !== undefined && args[name] !== "" ? args[name] : whole);
    return { sparql, missing };
}
export interface SemanticValidation {
    ok: boolean;
    errors: string[];
    warnings: string[];
}
export function validateSemantic(input: unknown): SemanticValidation {
    const errors: string[] = [];
    const warnings: string[] = [];
    const doc = input as Partial<SemanticLayer> | null | undefined;
    if (!doc || typeof doc !== "object") {
        return { ok: false, errors: ["El documento debe ser un objeto { glossary, metrics }."], warnings };
    }
    const glossary = doc.glossary;
    const metrics = doc.metrics;
    if (!Array.isArray(glossary))
        errors.push("`glossary` debe ser un array.");
    if (!Array.isArray(metrics))
        errors.push("`metrics` debe ser un array.");
    const termSeen = new Set<string>();
    if (Array.isArray(glossary)) {
        glossary.forEach((g, i) => {
            if (!g || typeof g !== "object") {
                errors.push(`glossary[${i}] no es un objeto.`);
                return;
            }
            if (!g.term?.trim())
                errors.push(`glossary[${i}].term está vacío.`);
            if (!g.target?.trim())
                errors.push(`glossary[${i}].target está vacío.`);
            if (g.synonyms !== undefined && !Array.isArray(g.synonyms))
                errors.push(`glossary[${i}].synonyms debe ser un array.`);
            const key = norm(g.term ?? "");
            if (key && termSeen.has(key))
                warnings.push(`Término duplicado en el glosario: "${g.term}".`);
            termSeen.add(key);
        });
    }
    const nameSeen = new Set<string>();
    if (Array.isArray(metrics)) {
        metrics.forEach((m, i) => {
            if (!m || typeof m !== "object") {
                errors.push(`metrics[${i}] no es un objeto.`);
                return;
            }
            if (!m.name?.trim())
                errors.push(`metrics[${i}].name está vacío.`);
            else if (!/^\w[\w-]*$/.test(m.name))
                errors.push(`metrics[${i}].name "${m.name}" debe ser un identificador (letras, dígitos, _ , -).`);
            if (!m.sparql?.trim())
                errors.push(`metrics[${i}].sparql está vacío.`);
            const key = (m.name ?? "").trim();
            if (key && nameSeen.has(key))
                errors.push(`Métrica duplicada: "${m.name}" (los nombres deben ser únicos).`);
            nameSeen.add(key);
        });
    }
    return { ok: errors.length === 0, errors, warnings };
}
export function findMetric(layer: SemanticLayer, name: string): Metric | undefined {
    return (layer.metrics ?? []).find((m) => m.name === name);
}
