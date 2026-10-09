import tablaJson from "../../public/datos/quimica/2026-10-08.json";
import { phExacto, fracciones, type Disolucion } from "../../src/app/shared/quimica/ph";
import { aproximacionLibro, type MetodoLibro, type AproximacionLibro } from "../../src/app/shared/quimica/libro";
import { curva, puntosEquivalencia, elegirIndicador, type Valoracion } from "../../src/app/shared/quimica/valoracion";
import { precipitacion, ionesDelVaso, solubilidadLibro, type Sal } from "../../src/app/shared/quimica/solubilidad";
import { ESPECIES_DATOS, especiesDeTabla, salesDeTabla, type TablaConstantes, type FuenteConstante } from "../../src/app/shared/quimica/especies-datos";
import { ChemistryService, FUERTES, type Componente } from "../../src/app/services/chemistry.service";
const TABLA = tablaJson as unknown as TablaConstantes;
const ESPECIES = especiesDeTabla(TABLA);
const SALES = salesDeTabla(TABLA);
const svc = new ChemistryService();
export const TABLA_FICHERO = "2026-10-08.json";
type Fallo = {
    error: string;
};
const fallo = (error: string): Fallo => ({ error });
const sinEspacios = (s: string) => s.replace(/\s+/g, "");
const POR_FORMULA = new Map<string, {
    ref: string;
    forma: number;
}>();
for (const [ref, f] of Object.entries(FUERTES))
    POR_FORMULA.set(f.formula, { ref, forma: 0 });
for (const e of ESPECIES.values())
    e.formas.forEach((f, k) => POR_FORMULA.set(f.formula, { ref: e.id, forma: k }));
const POR_FORMULA_MIN = new Map<string, {
    ref: string;
    forma: number;
} | null>();
for (const [f, v] of POR_FORMULA) {
    const k = f.toLowerCase();
    POR_FORMULA_MIN.set(k, POR_FORMULA_MIN.has(k) ? null : v);
}
export function aceptadas() {
    return {
        weak: [...ESPECIES.values()].map((e) => ({ id: e.id, forms: e.formas.map((f) => f.formula) })),
        strong: Object.entries(FUERTES).map(([id, f]) => ({ id, formula: f.formula })),
    };
}
function resolver(nombre: string): {
    ref: string;
    forma: number;
} | null {
    const n = sinEspacios(nombre);
    const id = n.toLowerCase();
    if (FUERTES[id] || ESPECIES.has(id))
        return { ref: id, forma: 0 };
    const m = /^([a-z0-9-]+)\.(\d)$/.exec(id);
    if (m && ESPECIES.get(m[1])?.formas[Number(m[2])])
        return { ref: m[1], forma: Number(m[2]) };
    return POR_FORMULA.get(n) ?? POR_FORMULA_MIN.get(id) ?? null;
}
export interface ComponenteEntrada {
    substance: string;
    concentration: number;
}
function componentes(lista: ComponenteEntrada[]): Componente[] | Fallo {
    const out: Componente[] = [];
    for (const c of lista) {
        const r = resolver(c.substance);
        if (!r)
            return fallo(`Unknown substance "${c.substance}". Use a table id, the formula of one of its forms or a strong acid/base/salt; call with listSubstances: true to see them all.`);
        out.push({ ref: r.ref, forma: r.forma, C: c.concentration });
    }
    return out;
}
const fuentesEn = (f: FuenteConstante[]) => f.map((x) => ({ citation: x.cita, ...(x.doi ? { doi: x.doi } : {}), ...(x.url ? { url: x.url } : {}), verified: VERIFICADO[x.verificado] }));
const VERIFICADO: Record<FuenteConstante["verificado"], string> = {
    texto: "read in the source text",
    resumen: "read in the abstract",
    compilacion: "read in a critical compilation",
    no: "not verified",
};
function constantesDe(refs: Iterable<string>): {
    constants: unknown[];
} | Fallo {
    const constants = [];
    for (const ref of new Set(refs)) {
        if (FUERTES[ref])
            continue;
        const a = TABLA.acidos.find((x) => x.id === ref);
        if (!a?.fuentes?.length)
            return fallo(`The constant for "${ref}" has no citation in the table, so it is not used.`);
        constants.push({ substance: ref, formula: a.formula, pKa: a.pKa, sources: fuentesEn(a.fuentes) });
    }
    return { constants };
}
const METODO: Record<MetodoLibro, string> = {
    agua: "pure water: pH = pKw/2",
    "fuerte-acido": "strong acid: pH = \u2212log C",
    "fuerte-base": "strong base: pOH = \u2212log C",
    "debil-acido": "weak acid: pH = \u00BD(pKa \u2212 log C), assuming x \u226A C",
    "debil-base": "weak base: pOH = \u00BD(pKb \u2212 log C), assuming x \u226A C",
    anfotero: "amphoteric salt: pH = \u00BD(pKa\u2081 + pKa\u2082)",
    tampon: "buffer: Henderson\u2013Hasselbalch",
    "mezcla-fuerte": "only the excess strong acid or base counts",
    "mezcla-mas-fuerte": "only the strongest acid counts",
};
type IdRegla = NonNullable<AproximacionLibro["regla"]>["id"];
const REGLA: Record<IdRegla, string> = {
    "cinco-por-ciento": "x/C < 5 % (value = x/C)",
    "agua-despreciable": "the water's own H\u207A/OH\u207B is negligible: C \u2265 10\u207B\u2076 M (value = C)",
    tampon: "both forms \u2265 100 \u00D7 [H\u207A] and [OH\u207B], ratio between 0.1 and 10 (value = smaller form / max([H\u207A],[OH\u207B]))",
    "anfotero-concentrado": "C > 100 \u00B7 Ka\u2081 (value = C/Ka\u2081)",
};
function libroEn(a: AproximacionLibro | null) {
    if (!a)
        return { formula: null, note: "No textbook formula covers this mixture (several weak systems with salts): only the exact calculation applies." };
    return {
        method: METODO[a.metodo],
        pH: a.pH,
        pKaUsed: a.pKa,
        rule: a.regla && { condition: REGLA[a.regla.id], value: a.regla.valor, holds: a.regla.cumple },
        errorVsExact: a.error,
    };
}
const iones = (s: string) => s.replace(/\{(\d*)([+-])\}$/, "$1$2");
function especiacion(comps: Componente[], pH: number) {
    const porId = new Map<string, number>();
    for (const c of comps)
        if (ESPECIES.has(c.ref))
            porId.set(c.ref, (porId.get(c.ref) ?? 0) + c.C);
    return [...porId].map(([id, C]) => {
        const e = ESPECIES.get(id)!;
        const formas = ESPECIES_DATOS[id].iones;
        return { substance: id, totalConcentration: C, forms: fracciones(e.pKa, pH).map((alfa, k) => ({ species: iones(formas[k] ?? e.formas[k].formula), fraction: alfa, concentration: alfa * C })) };
    });
}
const SUPUESTOS = ["Ideal solution at 25 \u00B0C: concentrations, no activity coefficients (Kw = 1e-14)."];
export function chemPh(entrada: {
    components: ComponenteEntrada[];
}) {
    const comps = componentes(entrada.components);
    if ("error" in comps)
        return comps;
    const fuentes = constantesDe(comps.map((c) => c.ref));
    if ("error" in fuentes)
        return fuentes;
    const d = svc.disolucion(comps, ESPECIES);
    const r = phExacto(d);
    return {
        pH: r.pH,
        chargeBalanceResidual: r.residuo,
        speciation: especiacion(comps, r.pH),
        textbook: libroEn(aproximacionLibro(d)),
        ...fuentes,
        assumptions: SUPUESTOS,
    };
}
export function chemTitration(entrada: {
    analyte: ComponenteEntrada[];
    analyteVolumeMl: number;
    titrant: ComponenteEntrada;
    maxVolumeMl: number;
    points?: number;
}) {
    const a = componentes(entrada.analyte);
    if ("error" in a)
        return a;
    const t = componentes([entrada.titrant]);
    if ("error" in t)
        return t;
    const fuentes = constantesDe([...a, ...t].map((c) => c.ref));
    if ("error" in fuentes)
        return fuentes;
    const val: Valoracion = { analito: svc.disolucion(a, ESPECIES), vAnalito: entrada.analyteVolumeMl, valorante: svc.disolucion(t, ESPECIES) };
    const vMax = entrada.maxVolumeMl;
    const eqs = puntosEquivalencia(val, vMax, { n: 1500 });
    const indicadores = TABLA.indicadores.map((i) => ({ id: i.id, viraje: i.viraje }));
    return {
        equivalencePoints: eqs.map((eq, i) => ({
            volumeMl: eq.v,
            pH: eq.pH,
            slope: eq.pendiente,
            indicators: elegirIndicador(val, eq, [i ? eqs[i - 1].v : 0, eqs[i + 1]?.v ?? vMax], indicadores).map((x) => ({
                indicator: x.id,
                range: TABLA.indicadores.find((i) => i.id === x.id)?.viraje,
                changesAtMl: x.vCambio,
                errorPercent: x.errorPct,
            })),
        })),
        curve: curva(val, vMax, Math.min(Math.max(entrada.points ?? 41, 2), 400)).map((p) => ({ volumeMl: p.v, pH: p.pH })),
        ...fuentes,
        indicatorSources: TABLA.indicadores.map((i) => ({ indicator: i.id, range: i.viraje, sources: fuentesEn(i.fuentes) })),
        assumptions: SUPUESTOS,
    };
}
const NOTA_SAL: Record<string, string> = {
    ag2cro4: "Chromate is treated as if it were not a base (the table has no pKa for HCrO\u2084\u207B): in acid, the real solubility is higher.",
    caco3: "Closed vessel: the CO\u2082 formed in acid stays dissolved (in an open one it would escape and even more would dissolve).",
    feoh3: "Without the hydrolysis of Fe\u00B3\u207A or its hydroxo complexes: this is the textbook Ksp calculation, not the real solubility of iron.",
};
const METODO_SOL: Record<ReturnType<typeof solubilidadLibro>["metodo"], string> = {
    agua: "in pure water: s = (Ksp / m\u1D50n\u207F)^(1/(m+n))",
    "ion-comun-cation": "common ion (cation): s \u226A the cation already present",
    "ion-comun-anion": "common ion (anion): s \u226A the anion already present",
    "sin-formula": "no textbook formula (both ions already present)",
};
export function chemSolubility(entrada: {
    salt: string;
    components: ComponenteEntrada[];
    solidInExcess: boolean;
}) {
    const id = sinEspacios(entrada.salt).toLowerCase();
    const sal = SALES.get(id) ?? [...SALES.values()].find((s) => s.formula.toLowerCase() === id);
    if (!sal)
        return fallo(`Unknown salt "${entrada.salt}". Known: ${[...SALES.values()].map((s) => `${s.id} (${s.formula})`).join(", ")}.`);
    const comps = componentes(entrada.components);
    if ("error" in comps)
        return comps;
    const tablaSal = TABLA.solubilidad?.find((s) => s.id === sal.id);
    if (!tablaSal?.fuentes?.length)
        return fallo(`The Ksp of "${sal.id}" has no citation in the table, so it is not used.`);
    const refs = comps.map((c) => c.ref).concat(sal.anion.tipo === "sistema" ? [sal.anion.id] : []);
    const fuentes = constantesDe(refs);
    if ("error" in fuentes)
        return fuentes;
    const d: Disolucion = svc.disolucion(comps, ESPECIES);
    const pHvaso = phExacto(d).pH;
    const p = precipitacion(d, sal as Sal, entrada.solidInExcess);
    const { M0, A0 } = ionesDelVaso(d, sal as Sal);
    const A0libro = sal.anion.tipo === "oh" ? (pHvaso > 8 ? 10 ** (pHvaso - 14) : 0) : A0;
    const libro = solubilidadLibro(sal as Sal, M0, A0libro);
    return {
        salt: sal.id,
        formula: sal.formula,
        pKsp: sal.pKs,
        logQ: p.logQ,
        precipitates: p.precipita,
        equilibrium: p.equilibrio && { pH: p.equilibrio.pH, dissolvedMolPerL: p.equilibrio.s, cation: p.equilibrio.M, anion: p.equilibrio.A, ...(p.equilibrio.s < 0 ? { note: "Negative: that much precipitates from what was in the vessel." } : {}) },
        ...(p.equilibrio ? {} : { note: "Q < Ksp and no solid added: nothing precipitates and nothing more dissolves." }),
        textbook: { method: METODO_SOL[libro.metodo], dissolvedMolPerL: Number.isFinite(libro.s) ? libro.s : null },
        kspSources: fuentesEn(tablaSal.fuentes),
        ...fuentes,
        assumptions: [...SUPUESTOS, "The metal cation does not hydrolyse.", ...(NOTA_SAL[sal.id] ? [NOTA_SAL[sal.id]] : [])],
    };
}
