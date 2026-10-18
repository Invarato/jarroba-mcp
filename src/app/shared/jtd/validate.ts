export const JTD_SHAPE_NAMES = [
    "rect",
    "round",
    "ellipse",
    "diamond",
    "parallelogram",
    "cylinder",
    "hexagon",
    "note",
    "text",
    "container",
    "triangle",
    "star",
    "cloud",
    "document",
    "card",
    "callout",
    "actor",
    "cross",
    "process",
    "line",
    "ink",
];
export const JTD_CHART_TYPE_NAMES = [
    "bar",
    "barh",
    "pie",
    "donut",
    "line",
    "area",
    "scatter",
    "quadrant",
    "radar",
    "gauge",
    "voronoi",
    "sankey",
    "boxplot",
    "heatmap",
    "treemap",
];
export const JTD_LAYOUTS = ["flow-down", "flow-right", "free", "grid", "radial"];
export const JTD_PORTS = ["top", "bottom", "left", "right", "auto", "n", "s", "e", "w"];
export const JTD_POSTER_NAMES = ["blog", "square", "story", "wide"];
export const JTD_TRANSITIONS = ["none", "fade", "morph"];
export interface JtdValidation {
    ok: boolean;
    errors: string[];
    warnings: string[];
    summary: {
        nodes: number;
        edges: number;
        charts: number;
    };
}
export function validateJtd(input: string | unknown): JtdValidation {
    const errors: string[] = [], warnings: string[] = [];
    let doc: Record<string, unknown> | null = null;
    if (typeof input === "string") {
        try {
            doc = JSON.parse(input);
        }
        catch (e) {
            return fail(`JSON no válido: ${(e as Error).message}`);
        }
    }
    else if (input && typeof input === "object") {
        doc = input as Record<string, unknown>;
    }
    if (!doc || typeof doc !== "object")
        return fail("El documento debe ser un objeto JSON.");
    if (!("jtd" in doc))
        return fail("Falta la clave \"jtd\" (versi\u00F3n del formato). Usa {\"jtd\":1,...}.");
    if (doc["jtd"] !== 1)
        warnings.push(`Versión jtd=${JSON.stringify(doc["jtd"])} desconocida; se asume 1.`);
    if (Array.isArray(doc["pages"])) {
        const pages = doc["pages"] as unknown[];
        if (!pages.length)
            errors.push("pages: est\u00E1 vac\u00EDo (al menos una p\u00E1gina).");
        for (const k of ["nodes", "edges", "charts", "timeline"])
            if (doc[k] != null)
                warnings.push(`"${k}" fuera de "pages" se ignora en un documento con páginas: va dentro de cada página.`);
        const sum = { nodes: 0, edges: 0, charts: 0 };
        pages.forEach((p, i) => {
            if (!p || typeof p !== "object") {
                errors.push(`pages[${i}]: no es un objeto.`);
                return;
            }
            const pg = p as Record<string, unknown>, tr = pg["transition"];
            const kind = typeof tr === "string" ? tr : tr && typeof tr === "object" ? (tr as Record<string, unknown>)["kind"] : undefined;
            if (tr != null && !JTD_TRANSITIONS.includes(String(kind)))
                warnings.push(`pages[${i}].transition ${JSON.stringify(tr)} no válida (sin transición). Válidas: ${JTD_TRANSITIONS.join(", ")} o {"kind":…, "ms":N}.`);
            if (tr && typeof tr === "object") {
                const ms = (tr as Record<string, unknown>)["ms"];
                if (ms != null && !(typeof ms === "number" && isFinite(ms) && ms > 0))
                    warnings.push(`pages[${i}].transition.ms debe ser un número > 0 (milisegundos) → se usa 1000.`);
            }
            if (i === 0 && tr != null && kind !== "none")
                warnings.push("pages[0].transition se ignora: la primera p\u00E1gina no tiene p\u00E1gina anterior.");
            const { pages: _p, ...rest } = doc;
            const { transition: _t, name: _n, ...content } = pg;
            const v = validateJtd({ ...rest, ...content, jtd: 1 });
            for (const e of v.errors)
                errors.push(`pages[${i}]: ${e}`);
            for (const w of v.warnings)
                warnings.push(`pages[${i}]: ${w}`);
            sum.nodes += v.summary.nodes;
            sum.edges += v.summary.edges;
            sum.charts += v.summary.charts;
        });
        return { ok: errors.length === 0, errors, warnings, summary: sum };
    }
    if (Array.isArray(doc["frames"])) {
        const frames = doc["frames"] as unknown[];
        if (!frames.length)
            errors.push("frames: est\u00E1 vac\u00EDo (al menos un fotograma).");
        for (const k of ["nodes", "edges", "charts", "timeline"])
            if (doc[k] != null)
                warnings.push(`"${k}" fuera de "frames" se ignora en una película: va dentro de cada fotograma.`);
        const sum = { nodes: 0, edges: 0, charts: 0 };
        frames.forEach((f, i) => {
            if (!f || typeof f !== "object") {
                errors.push(`frames[${i}]: no es un objeto.`);
                return;
            }
            const fr = f as Record<string, unknown>, tr = fr["transition"], hold = fr["hold"], cam = fr["camera"];
            const kind = typeof tr === "string" ? tr : tr && typeof tr === "object" ? (tr as Record<string, unknown>)["kind"] : undefined;
            if (tr != null && !JTD_TRANSITIONS.includes(String(kind)))
                warnings.push(`frames[${i}].transition ${JSON.stringify(tr)} no válida (corte seco). Válidas: ${JTD_TRANSITIONS.join(", ")} o {"kind":…, "ms":N}.`);
            if (tr && typeof tr === "object") {
                const ms = (tr as Record<string, unknown>)["ms"];
                if (ms != null && !(typeof ms === "number" && isFinite(ms) && ms > 0))
                    warnings.push(`frames[${i}].transition.ms debe ser un número > 0 (milisegundos) → se usa 1000.`);
            }
            if (i === 0 && tr != null && kind !== "none")
                warnings.push("frames[0].transition se ignora: el primer fotograma no tiene anterior.");
            if (hold != null && !(typeof hold === "number" && isFinite(hold) && hold > 0))
                warnings.push(`frames[${i}].hold debe ser un número > 0 (milisegundos quieto) → se usa 2000.`);
            if (cam != null && !(typeof cam === "object" && ["x", "y", "w", "h"].every(k => typeof (cam as Record<string, unknown>)[k] === "number") && ((cam as Record<string, number>)["w"] > 0) && ((cam as Record<string, number>)["h"] > 0)))
                warnings.push(`frames[${i}].camera ${JSON.stringify(cam)} no válida (se encuadra el contenido). Formato: {"x":N,"y":N,"w":N,"h":N} (esquina superior izquierda).`);
            const { frames: _f, pages: _p, ...rest } = doc;
            const { hold: _h, transition: _t, camera: _c, name: _n, ...content } = fr;
            const v = validateJtd({ ...rest, ...content, jtd: 1 });
            for (const e of v.errors)
                errors.push(`frames[${i}]: ${e}`);
            for (const w of v.warnings)
                warnings.push(`frames[${i}]: ${w}`);
            sum.nodes += v.summary.nodes;
            sum.edges += v.summary.edges;
            sum.charts += v.summary.charts;
        });
        return { ok: errors.length === 0, errors, warnings, summary: sum };
    }
    if (doc["layout"] != null && !JTD_LAYOUTS.includes(String(doc["layout"])))
        warnings.push(`layout "${doc["layout"]}" desconocido; se usará flow-down. Válidos: ${JTD_LAYOUTS.join(", ")}.`);
    const pst = doc["poster"];
    if (pst != null && !(typeof pst === "string" ? JTD_POSTER_NAMES.includes(pst) : typeof pst === "object" && [(pst as Record<string, unknown>)["w"], (pst as Record<string, unknown>)["h"]].every(v => typeof v === "number" && v > 0)))
        warnings.push(`poster ${JSON.stringify(pst)} no válido; se importa sin marco de página. Válidos: ${JTD_POSTER_NAMES.join(", ")} o {"w":N,"h":N}.`);
    const nodesArr = Array.isArray(doc["nodes"]) ? doc["nodes"] as Record<string, unknown>[] : [];
    const chartsArr = Array.isArray(doc["charts"]) ? doc["charts"] as Record<string, unknown>[] : [];
    const edgesArr = Array.isArray(doc["edges"]) ? doc["edges"] as Record<string, unknown>[] : [];
    const ids = new Set<string>();
    nodesArr.forEach((n, i) => {
        if (!n || n["id"] == null) {
            errors.push(`nodes[${i}]: falta "id".`);
            return;
        }
        const id = String(n["id"]);
        if (ids.has(id))
            warnings.push(`id de nodo duplicado: "${id}".`);
        ids.add(id);
        if (n["shape"] != null && !n["icon"] && !JTD_SHAPE_NAMES.includes(String(n["shape"])))
            warnings.push(`nodes[${i}] shape "${n["shape"]}" no válida (se usará rect). Válidas: ${JTD_SHAPE_NAMES.join(", ")}.`);
        if (n["shape"] === "line" || n["shape"] === "ink") {
            const p = n["path"], min = n["shape"] === "line" ? 2 : 1;
            if (p == null)
                warnings.push(`nodes[${i}] (${n["shape"]}): sin "path" ([[x,y],…]) se dibuja una recta por defecto.`);
            else if (!Array.isArray(p) || p.length < min || !p.every(q => Array.isArray(q) && q.length >= 2 && q.every(v => typeof v === "number" && isFinite(v))))
                errors.push(`nodes[${i}] (${n["shape"]}): "path" debe ser una lista de al menos ${min} puntos [x,y] numéricos.`);
            if (n["pressure"] != null && (!Array.isArray(n["pressure"]) || (Array.isArray(p) && (n["pressure"] as unknown[]).length !== p.length)))
                warnings.push(`nodes[${i}].pressure: una presión (0..1) por punto de "path"; se ignora.`);
        }
    });
    chartsArr.forEach((c, i) => {
        if (!c || c["type"] == null) {
            errors.push(`charts[${i}]: falta "type".`);
            return;
        }
        if (c["id"] != null)
            ids.add(String(c["id"]));
        if (!JTD_CHART_TYPE_NAMES.includes(String(c["type"])))
            warnings.push(`charts[${i}] type "${c["type"]}" no válido (se usará bar). Válidos: ${JTD_CHART_TYPE_NAMES.join(", ")}.`);
    });
    edgesArr.forEach((e, i) => {
        if (!e || e["from"] == null || e["to"] == null) {
            errors.push(`edges[${i}]: faltan "from"/"to".`);
            return;
        }
        if (!ids.has(String(e["from"])))
            warnings.push(`edges[${i}]: "from" apunta a un id inexistente ("${e["from"]}") → se ignora.`);
        if (!ids.has(String(e["to"])))
            warnings.push(`edges[${i}]: "to" apunta a un id inexistente ("${e["to"]}") → se ignora.`);
        for (const side of ["fromPort", "toPort"])
            if (e[side] != null && !JTD_PORTS.includes(String(e[side]).toLowerCase()))
                warnings.push(`edges[${i}] ${side} "${e[side]}" no válido (lo decidirá el layout). Válidos: top, bottom, left, right, auto.`);
    });
    const edgeIds = new Set<string>();
    edgesArr.forEach((e, i) => { if (e && e["id"] != null) {
        const id = String(e["id"]);
        if (edgeIds.has(id) || ids.has(id))
            warnings.push(`edges[${i}]: id "${id}" repetido (con otra arista o con un nodo).`);
        edgeIds.add(id);
    } });
    const tl = doc["timeline"];
    if (tl != null) {
        const steps = (tl as {
            steps?: unknown;
        }).steps;
        if (typeof tl !== "object" || !Array.isArray(steps) || !steps.length)
            warnings.push("timeline: debe ser { \"mode\"?, \"steps\": [ \u2026 ] } con al menos un paso \u2192 se ignora.");
        else {
            const mode = (tl as {
                mode?: unknown;
            }).mode;
            if (mode != null && mode !== "highlight" && mode !== "reveal")
                warnings.push(`timeline.mode "${mode}" no válido (se usará highlight). Válidos: highlight, reveal.`);
            (steps as Record<string, unknown>[]).forEach((st, k) => {
                if (!st || typeof st !== "object") {
                    warnings.push(`timeline.steps[${k}]: no es un objeto → se ignora.`);
                    return;
                }
                if (st["text"] == null)
                    warnings.push(`timeline.steps[${k}]: sin "text" (la narración del paso).`);
                if (st["ms"] != null && (typeof st["ms"] !== "number" || !isFinite(st["ms"] as number) || (st["ms"] as number) < 0))
                    warnings.push(`timeline.steps[${k}].ms: debe ser un número ≥ 0 (milisegundos) → se ignora.`);
                for (const f of Array.isArray(st["flow"]) ? st["flow"] as Record<string, unknown>[] : [])
                    if (!f || !edgeIds.has(String(f["edge"])))
                        warnings.push(`timeline.steps[${k}].flow: "edge" ${JSON.stringify(f?.["edge"])} no es el id de ninguna arista (dale "id" a la arista) → se ignora.`);
                for (const key of ["focus", "show"])
                    for (const r of Array.isArray(st[key]) ? st[key] as unknown[] : [])
                        if (!ids.has(String(r)) && !edgeIds.has(String(r)))
                            warnings.push(`timeline.steps[${k}].${key}: "${r}" no es un id de nodo ni de arista → se ignora.`);
            });
        }
    }
    if (!nodesArr.length && !chartsArr.length)
        errors.push("El documento no tiene nodos ni gr\u00E1ficos.");
    return { ok: errors.length === 0, errors, warnings, summary: { nodes: nodesArr.length, edges: edgesArr.length, charts: chartsArr.length } };
    function fail(msg: string): JtdValidation { return { ok: false, errors: [msg], warnings, summary: { nodes: 0, edges: 0, charts: 0 } }; }
}
