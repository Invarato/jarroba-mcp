import { apriori, leerCestas, reglas } from "../../src/app/services/recommender.service";
import { partirCsv } from "../../src/app/services/tesoreria/extracto";
export interface EntradaCesta {
    data: string;
    format: "baskets" | "long";
    transactionColumn?: string;
    itemColumn?: string;
    minSupport: number;
    minConfidence: number;
    maxSize: number;
    limit: number;
}
const MAX_CESTAS = 20000;
function largo(texto: string, colT?: string, colI?: string): {
    cestas: string[][];
} | {
    error: string;
} {
    const lineas = texto.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
    if (lineas.length < 2)
        return { error: "The long format needs a header and at least one row." };
    const sep = lineas[0].includes("\t") ? "\t" : lineas[0].split(";").length > lineas[0].split(",").length ? ";" : ",";
    const cab = partirCsv(lineas[0], sep).map((h) => h.replace(/^"|"$/g, "").trim());
    const iT = colT === undefined ? 0 : cab.indexOf(colT), iI = colI === undefined ? 1 : cab.indexOf(colI);
    if (iT < 0)
        return { error: `No column "${colT}" in the header (${cab.join(", ")}).` };
    if (iI < 0 || iI >= cab.length)
        return { error: colI === undefined ? "The long format needs two columns: transaction and item." : `No column "${colI}" in the header (${cab.join(", ")}).` };
    const mapa = new Map<string, Set<string>>();
    for (const l of lineas.slice(1)) {
        const c = partirCsv(l, sep).map((x) => x.replace(/^"|"$/g, "").trim());
        const t = c[iT], it = (c[iI] ?? "").toLowerCase();
        if (!t || !it)
            continue;
        if (!mapa.has(t)) {
            if (mapa.size >= MAX_CESTAS)
                break;
            mapa.set(t, new Set());
        }
        mapa.get(t)!.add(it);
    }
    return { cestas: [...mapa.values()].map((s) => [...s]) };
}
const r4 = (n: number) => Math.round(n * 10000) / 10000;
export function cesta(e: EntradaCesta) {
    const leido = e.format === "long" ? largo(e.data, e.transactionColumn, e.itemColumn) : { cestas: leerCestas(e.data, MAX_CESTAS) };
    if ("error" in leido)
        return leido;
    const cestas = leido.cestas;
    if (cestas.length < 10)
        return { error: `Only ${cestas.length} basket(s): at least 10 are needed for support and lift to mean anything.` };
    const frecuentes = apriori(cestas, e.minSupport, e.maxSize);
    const rs = reglas(frecuentes, e.minConfidence);
    const n = cestas.length;
    const distintos = new Set(cestas.flat()).size;
    const grupos = frecuentes.filter((f) => f.items.length >= 2).sort((a, b) => b.soporte - a.soporte);
    return {
        baskets: n,
        distinctItems: distintos,
        averageBasketSize: r4(cestas.reduce((s, c) => s + c.length, 0) / n),
        ...(n >= MAX_CESTAS ? { truncated: `Only the first ${MAX_CESTAS} baskets were read.` } : {}),
        frequentItemsets: grupos.length,
        topItemsets: grupos.slice(0, e.limit).map((f) => ({ items: f.items, support: r4(f.soporte), baskets: Math.round(f.soporte * n) })),
        rules: rs.slice(0, e.limit).map((r) => ({ if: r.si, then: r.entonces[0], support: r4(r.soporte), confidence: r4(r.confianza), lift: r4(r.lift), baskets: Math.round(r.soporte * n) })),
        totalRules: rs.length,
        ...(rs.length ? {} : { hint: grupos.length ? `No rule reaches confidence ${e.minConfidence}: lower minConfidence.` : `No pair of items appears together in ${e.minSupport * 100} % of the baskets: lower minSupport.` }),
        notes: [
            "Support = share of baskets with all the items. Confidence of A \u2192 B = P(B | A). Lift = confidence / P(B): 1 means A says nothing about B, above 1 they go together, below 1 they avoid each other. Rules are sorted by lift.",
            "High confidence without lift is the classic trap: if almost everyone buys bread, \"anything \u2192 bread\" has high confidence and means nothing. Trust lift, and the number of baskets behind a rule.",
            "Items are compared case-insensitively and counted once per basket. Apriori (Agrawal and Srikant, 1994); deterministic.",
        ],
    };
}
