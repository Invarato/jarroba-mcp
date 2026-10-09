import type { Disolucion, SistemaAcido } from "../shared/quimica/ph";
import { parseFormula } from "../shared/quimica/formula";
import { elementBySymbol } from "./elements-data";
import type { Especie, FuenteConstante, Forma, TablaConstantes } from "../shared/quimica/especies-datos";
export type { AcidoTabla, Especie, FuenteConstante, Forma, IndicadorTabla, SalTabla, TablaConstantes } from "../shared/quimica/especies-datos";
export const FUERTES: Record<string, {
    formula: string;
    esp: number;
    iones?: Record<string, number>;
}> = {
    hcl: { formula: "HCl", esp: -1, iones: { "Cl-": 1 } },
    hno3: { formula: "HNO3", esp: -1 },
    hclo4: { formula: "HClO4", esp: -1 },
    hbr: { formula: "HBr", esp: -1, iones: { "Br-": 1 } },
    hi: { formula: "HI", esp: -1, iones: { "I-": 1 } },
    naoh: { formula: "NaOH", esp: 1 },
    koh: { formula: "KOH", esp: 1 },
    caoh2: { formula: "Ca(OH)2", esp: 2, iones: { "Ca2+": 1 } },
    baoh2: { formula: "Ba(OH)2", esp: 2, iones: { "Ba2+": 1 } },
    nacl: { formula: "NaCl", esp: 0, iones: { "Cl-": 1 } },
    nabr: { formula: "NaBr", esp: 0, iones: { "Br-": 1 } },
    ki: { formula: "KI", esp: 0, iones: { "I-": 1 } },
    agno3: { formula: "AgNO3", esp: 0, iones: { "Ag+": 1 } },
    cacl2: { formula: "CaCl2", esp: 0, iones: { "Ca2+": 1, "Cl-": 2 } },
    bacl2: { formula: "BaCl2", esp: 0, iones: { "Ba2+": 1, "Cl-": 2 } },
    mgcl2: { formula: "MgCl2", esp: 0, iones: { "Mg2+": 1, "Cl-": 2 } },
    pbno32: { formula: "Pb(NO3)2", esp: 0, iones: { "Pb2+": 1 } },
    k2cro4: { formula: "K2CrO4", esp: 0, iones: { "CrO42-": 1 } },
};
export interface Componente {
    ref: string;
    forma: number;
    C: number;
}
export const C_MAX = 20;
export class ChemistryService {
    parseConcentracion(texto: string): number | null {
        const SUP = "\u2070\u00B9\u00B2\u00B3\u2074\u2075\u2076\u2077\u2078\u2079";
        let s = String(texto ?? "").trim().replace(/\s+/g, "").replace(",", ".");
        if (!s)
            return null;
        s = s.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, c => String(SUP.indexOf(c))).replace(/⁻/g, "-").replace(/⁺/g, "");
        const m = s.match(/^([0-9]*\.?[0-9]+)(?:[·*×x]10\^?([+-]?[0-9]+)|e([+-]?[0-9]+))?$/i);
        if (!m)
            return null;
        const v = Number(m[1]) * 10 ** Number(m[2] ?? m[3] ?? 0);
        return Number.isFinite(v) && v > 0 && v <= C_MAX ? v : null;
    }
    disolucion(componentes: Componente[], especies: Map<string, Especie>): Disolucion {
        const sistemas: SistemaAcido[] = [];
        const iones: Record<string, number> = {};
        let espectadores = 0;
        for (const c of componentes) {
            if (!(c.C > 0) || c.C > C_MAX)
                continue;
            const f = FUERTES[c.ref];
            if (f) {
                espectadores += f.esp * c.C;
                for (const [ion, n] of Object.entries(f.iones ?? {}))
                    iones[ion] = (iones[ion] ?? 0) + n * c.C;
                continue;
            }
            const e = especies.get(c.ref);
            const forma = e?.formas[c.forma];
            if (!e || !forma)
                continue;
            const ya = sistemas.find(x => x.nombre === e.id);
            if (ya)
                ya.C += c.C;
            else
                sistemas.push({ C: c.C, pKa: e.pKa, carga0: e.carga0, nombre: e.id });
            espectadores += forma.esp * c.C;
            if (forma.esp < 0)
                iones["Cl-"] = (iones["Cl-"] ?? 0) - forma.esp * c.C;
        }
        return { sistemas, espectadores, iones };
    }
    mezclaATexto(componentes: Componente[]): string {
        return componentes.map(c => `${c.ref}${c.forma ? "." + c.forma : ""}:${c.C}`).join(";");
    }
    textoAMezcla(texto: string): Componente[] {
        const out: Componente[] = [];
        for (const parte of String(texto ?? "").split(";").slice(0, 12)) {
            const m = parte.trim().match(/^([a-z0-9-]{1,40})(?:\.(\d))?:([0-9.eE+-]{1,20})$/);
            if (!m)
                continue;
            const C = Number(m[3]);
            if (!(C > 0) || C > C_MAX)
                continue;
            out.push({ ref: m[1].toLowerCase(), forma: Number(m[2] ?? 0), C });
        }
        return out;
    }
    masaMolar(formula: string): number | null {
        try {
            let M = 0;
            for (const [el, n] of parseFormula(formula).atomos) {
                const e = elementBySymbol(el);
                if (!e)
                    return null;
                M += e.mass * n;
            }
            return M > 0 ? M : null;
        }
        catch {
            return null;
        }
    }
    parsePKa(texto: string): number[] | null {
        const xs = String(texto ?? "").split(/[;\s]+/).filter(Boolean).map(t => Number(t.replace(",", ".")));
        if (!xs.length || xs.length > 6 || xs.some(x => !Number.isFinite(x) || x < -5 || x > 20))
            return null;
        for (let i = 1; i < xs.length; i++)
            if (xs[i] <= xs[i - 1])
                return null;
        return xs;
    }
}
export function esTablaConstantes(x: unknown): x is TablaConstantes {
    const t = x as TablaConstantes;
    const fuentes = (f: unknown) => Array.isArray(f) && f.every(y => typeof (y as FuenteConstante)?.cita === "string");
    return !!t && typeof t === "object" && Array.isArray(t.acidos) && Array.isArray(t.indicadores)
        && t.acidos.every(a => typeof a?.id === "string" && Number.isInteger(a.carga0) && Array.isArray(a.pKa)
            && a.pKa.length > 0 && a.pKa.every(Number.isFinite) && fuentes(a.fuentes))
        && t.indicadores.every(i => typeof i?.id === "string" && Array.isArray(i.viraje) && i.viraje.length === 2
            && i.viraje.every(Number.isFinite) && fuentes(i.fuentes));
}
let cache: Promise<TablaConstantes | null> | null = null;
export function cargarConstantes(): Promise<TablaConstantes | null> {
    return cache ??= (async () => {
        try {
            const man = await (await fetch("datos/manifiesto.json")).json() as {
                entradas: {
                    id: string;
                    carpeta?: string;
                    actual?: string;
                }[];
            };
            const e = man.entradas.find(x => x.id === "quimica-constantes");
            if (!e?.carpeta || !e.actual)
                return null;
            const d = await (await fetch(`datos/${e.carpeta}/${e.actual}`)).json();
            return esTablaConstantes(d) ? d : null;
        }
        catch {
            cache = null;
            return null;
        }
    })();
}
