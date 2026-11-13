import { analizar, FICHAS, UMBRAL, type Olor, type OlorId } from "../../src/app/services/patterns-olores";
const WEB = "https://jarroba.com/tools/en";
const TITULO: Record<OlorId, string> = {
    "long-method": "Long function",
    "long-params": "Long parameter list",
    "type-switch": "Conditional on type",
    "message-chain": "Message chain",
    "god-class": "Large class",
    "feature-envy": "Feature envy",
    "duplicate": "Duplicated code",
    "global-instance": "Global instance",
};
const REFACTOR: Record<OlorId, string> = {
    "long-method": "Extract Function",
    "long-params": "Introduce Parameter Object",
    "type-switch": "Replace Conditional with Polymorphism",
    "message-chain": "Hide Delegate",
    "god-class": "Extract Class",
    "feature-envy": "Move Function",
    "duplicate": "Extract Function (and call it from both places)",
    "global-instance": "Pass the dependency in (inject it)",
};
function detalle(o: Olor): string {
    switch (o.id) {
        case "long-method": return `${o.n} lines with code (over ${o.extra}). Each piece with a meaning of its own can be a named function.`;
        case "long-params": return `${o.n} parameters. Those that travel together are usually one concept: a named object, or a step-by-step builder.`;
        case "type-switch": return o.extra && o.extra !== "1"
            ? `${o.n} cases on "${o.donde}", and the same split repeats in ${o.extra} places: every new type means touching all of them.`
            : `${o.n} cases by type ("${o.donde}"). If each case is a behaviour, it can be one object per case.`;
        case "message-chain": return `${o.n} hops from object to object. The caller depends on the whole intermediate structure: change one link and it breaks here.`;
        case "god-class": return `${o.n} methods and ${o.extra} lines with code. It probably does several things that could be separate classes.`;
        case "feature-envy": return `Touches "${o.extra}" ${o.n} times and itself less: this function might live better in ${o.extra}'s class.`;
        case "duplicate": return `${o.n} lines identical to those starting at line ${o.extra}. A fix in one copy gets forgotten in the other.`;
        case "global-instance": return "An instance reachable from anywhere: global state, and tests contaminate each other.";
    }
}
export function olores(codigo: string) {
    const r = analizar(codigo);
    return {
        lines: r.lineas,
        functions: r.funciones,
        classes: r.clases,
        syntaxErrors: r.conErrores || undefined,
        smells: r.olores.map((o) => {
            const f = FICHAS[o.id];
            return {
                smell: o.id,
                title: TITULO[o.id],
                lines: o.desde === o.hasta ? String(o.desde) : `${o.desde}-${o.hasta}`,
                where: o.donde,
                detail: detalle(o),
                refactoring: REFACTOR[o.id],
                pattern: f.patron ? { id: f.patron, demo: `${WEB}/patterns?pattern=${f.patron}&tab=compare` } : undefined,
                whenNot: { practice: f.practica, url: `${WEB}/practices?q=${f.practica}` },
            };
        }),
        thresholds: {
            functionLines: UMBRAL.lineasMetodo,
            parameters: UMBRAL.parametros,
            typeCases: UMBRAL.casos,
            chainLinks: UMBRAL.cadena,
            classMethods: UMBRAL.metodosClase,
            classLines: UMBRAL.lineasClase,
            envyAccesses: UMBRAL.envidia,
            duplicateLines: UMBRAL.duplicado,
        },
    };
}
