export interface ShaclViolation {
    focus: string;
    path: string;
    constraint: string;
    message: string;
}
export interface RowTerm {
    value: string;
    termType?: string;
}
export type Row = Record<string, RowTerm | undefined>;
export type QueryExec = (sparql: string) => Promise<Row[]>;
export const SH = "http://www.w3.org/ns/shacl#";
export const SHAPES_QUERY = `PREFIX sh: <${SH}>
SELECT ?tc ?path ?minCount ?maxCount ?datatype ?class ?nodeKind ?pattern ?minInclusive ?maxInclusive ?minLength ?maxLength ?message WHERE {
  ?shape sh:targetClass ?tc ; sh:property ?ps .
  ?ps sh:path ?path .
  OPTIONAL { ?ps sh:minCount ?minCount }
  OPTIONAL { ?ps sh:maxCount ?maxCount }
  OPTIONAL { ?ps sh:datatype ?datatype }
  OPTIONAL { ?ps sh:class ?class }
  OPTIONAL { ?ps sh:nodeKind ?nodeKind }
  OPTIONAL { ?ps sh:pattern ?pattern }
  OPTIONAL { ?ps sh:minInclusive ?minInclusive }
  OPTIONAL { ?ps sh:maxInclusive ?maxInclusive }
  OPTIONAL { ?ps sh:minLength ?minLength }
  OPTIONAL { ?ps sh:maxLength ?maxLength }
  OPTIONAL { ?ps sh:message ?message }
}`;
export const SH_IN_QUERY = `PREFIX sh: <${SH}>
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
SELECT ?tc ?path ?inValue WHERE {
  ?shape sh:targetClass ?tc ; sh:property ?ps .
  ?ps sh:path ?path ; sh:in/rdf:rest*/rdf:first ?inValue .
}`;
export interface Constraint {
    kind: "minCount" | "maxCount" | "datatype" | "class" | "nodeKind" | "pattern" | "minInclusive" | "maxInclusive" | "minLength" | "maxLength";
    value: string;
    label: string;
    defaultMsg: string;
}
export function constraintsOf(row: Row): Constraint[] {
    const out: Constraint[] = [];
    const g = (k: string) => row[k]?.value;
    const push = (kind: Constraint["kind"], v: string, label: string, defaultMsg: string) => out.push({ kind, value: v, label, defaultMsg });
    if (g("minCount"))
        push("minCount", g("minCount")!, `minCount ${g("minCount")}`, `Faltan valores (mínimo ${g("minCount")}).`);
    if (g("maxCount"))
        push("maxCount", g("maxCount")!, `maxCount ${g("maxCount")}`, `Demasiados valores (máximo ${g("maxCount")}).`);
    if (g("datatype"))
        push("datatype", g("datatype")!, "datatype", `Tipo de dato incorrecto (se esperaba ${g("datatype")}).`);
    if (g("class"))
        push("class", g("class")!, "class", `El valor no es de la clase ${g("class")}.`);
    if (g("nodeKind"))
        push("nodeKind", g("nodeKind")!, "nodeKind", `Tipo de nodo incorrecto (${g("nodeKind")}).`);
    if (g("pattern"))
        push("pattern", g("pattern")!, "pattern", `El valor no cumple el patrón «${g("pattern")}».`);
    if (g("minInclusive"))
        push("minInclusive", g("minInclusive")!, `minInclusive ${g("minInclusive")}`, `Valor por debajo del mínimo (${g("minInclusive")}).`);
    if (g("maxInclusive"))
        push("maxInclusive", g("maxInclusive")!, `maxInclusive ${g("maxInclusive")}`, `Valor por encima del máximo (${g("maxInclusive")}).`);
    if (g("minLength"))
        push("minLength", g("minLength")!, `minLength ${g("minLength")}`, `Texto demasiado corto (mínimo ${g("minLength")}).`);
    if (g("maxLength"))
        push("maxLength", g("maxLength")!, `maxLength ${g("maxLength")}`, `Texto demasiado largo (máximo ${g("maxLength")}).`);
    return out;
}
export function buildViolationQuery(c: Constraint, targetClass: string, path: string): string | null {
    const tc = `<${targetClass}>`, p = `<${path}>`;
    const forEachValue = (filter: string) => `SELECT DISTINCT ?focus ?v WHERE { ?focus a ${tc} ; ${p} ?v . FILTER( ${filter} ) }`;
    switch (c.kind) {
        case "minCount":
            return `SELECT ?focus (COUNT(?v) AS ?n) WHERE { ?focus a ${tc} . OPTIONAL { ?focus ${p} ?v } } GROUP BY ?focus HAVING (COUNT(?v) < ${int(c.value)})`;
        case "maxCount":
            return `SELECT ?focus (COUNT(?v) AS ?n) WHERE { ?focus a ${tc} . OPTIONAL { ?focus ${p} ?v } } GROUP BY ?focus HAVING (COUNT(?v) > ${int(c.value)})`;
        case "datatype":
            return forEachValue(`!isLiteral(?v) || datatype(?v) != <${c.value}>`);
        case "class":
            return `SELECT DISTINCT ?focus ?v WHERE { ?focus a ${tc} ; ${p} ?v . FILTER NOT EXISTS { ?v a <${c.value}> } }`;
        case "nodeKind": {
            const local = c.value.slice(SH.length);
            const f = local === "IRI" ? "!isIRI(?v)" : local === "Literal" ? "!isLiteral(?v)" : local === "BlankNode" ? "!isBlank(?v)" : null;
            return f ? forEachValue(f) : null;
        }
        case "pattern":
            return forEachValue(`isLiteral(?v) && !REGEX(STR(?v), "${escStr(c.value)}")`);
        case "minInclusive":
            return forEachValue(`?v < ${num(c.value)}`);
        case "maxInclusive":
            return forEachValue(`?v > ${num(c.value)}`);
        case "minLength":
            return forEachValue(`STRLEN(STR(?v)) < ${int(c.value)}`);
        case "maxLength":
            return forEachValue(`STRLEN(STR(?v)) > ${int(c.value)}`);
        default: return null;
    }
}
export function buildInViolationQuery(targetClass: string, path: string, allowed: RowTerm[]): string {
    const tc = `<${targetClass}>`, p = `<${path}>`;
    const list = allowed.map((t) => (t.termType === "NamedNode" ? `<${t.value}>` : `"${escStr(t.value)}"`)).join(", ");
    return `SELECT DISTINCT ?focus ?v WHERE { ?focus a ${tc} ; ${p} ?v . FILTER( ?v NOT IN (${list}) ) }`;
}
export async function validateShacl(exec: QueryExec): Promise<ShaclViolation[]> {
    const violations: ShaclViolation[] = [];
    for (const row of await exec(SHAPES_QUERY)) {
        const tc = row["tc"]?.value, path = row["path"]?.value;
        if (!tc || !path)
            continue;
        const msg = row["message"]?.value;
        for (const c of constraintsOf(row)) {
            const q = buildViolationQuery(c, tc, path);
            if (!q)
                continue;
            for (const v of await exec(q)) {
                violations.push({ focus: v["focus"]?.value ?? "", path, constraint: c.label, message: msg || c.defaultMsg });
            }
        }
    }
    const groups = new Map<string, {
        tc: string;
        path: string;
        terms: RowTerm[];
    }>();
    for (const r of await exec(SH_IN_QUERY)) {
        const tc = r["tc"]?.value, path = r["path"]?.value, v = r["inValue"];
        if (!tc || !path || !v)
            continue;
        const key = `${tc}|${path}`;
        if (!groups.has(key))
            groups.set(key, { tc, path, terms: [] });
        groups.get(key)!.terms.push(v);
    }
    for (const g of groups.values()) {
        for (const v of await exec(buildInViolationQuery(g.tc, g.path, g.terms))) {
            violations.push({ focus: v["focus"]?.value ?? "", path: g.path, constraint: "in", message: "El valor no est\u00E1 en la lista permitida (sh:in)." });
        }
    }
    return violations;
}
function int(v: string): number { const n = parseInt(v, 10); return Number.isFinite(n) ? n : 0; }
function num(v: string): string { const n = Number(v); return Number.isFinite(n) ? String(n) : "0"; }
function escStr(v: string): string { return v.replace(/\\/g, "\\\\").replace(/"/g, "\\\""); }
