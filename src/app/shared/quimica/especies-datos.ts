import type { Sal } from "./solubilidad";
export interface FuenteConstante {
    cita: string;
    doi?: string;
    url?: string;
    verificado: "texto" | "resumen" | "compilacion" | "no";
}
export interface AcidoTabla {
    id: string;
    formula: string;
    carga0: number;
    pKa: number[];
    fuentes: FuenteConstante[];
    nota?: string;
}
export interface IndicadorTabla {
    id: string;
    viraje: [
        number,
        number
    ];
    colorAcidoHex: string;
    colorBasicoHex: string;
    fuentes: FuenteConstante[];
    nota?: string;
}
export interface SalTabla {
    id: string;
    formula: string;
    pKs: number;
    fuentes: FuenteConstante[];
    nota?: string;
}
export interface TablaConstantes {
    acidos: AcidoTabla[];
    indicadores: IndicadorTabla[];
    solubilidad?: SalTabla[];
}
export interface Forma {
    formula: string;
    ion?: string;
    esp: number;
}
export interface Especie {
    id: string;
    pKa: number[];
    carga0: number;
    formas: Forma[];
    propia?: boolean;
}
export interface EspecieDatos {
    formas: string[];
    iones: string[];
    esp?: (number | undefined)[];
}
export const ESPECIES_DATOS: Record<string, EspecieDatos> = {
    acetico: { formas: ["CH3COOH", "CH3COONa"], iones: ["CH3COOH", "CH3COO{-}"] },
    formico: { formas: ["HCOOH", "HCOONa"], iones: ["HCOOH", "HCOO{-}"] },
    benzoico: { formas: ["C6H5COOH", "C6H5COONa"], iones: ["C6H5COOH", "C6H5COO{-}"] },
    lactico: { formas: ["CH3CH(OH)COOH", "CH3CH(OH)COONa"], iones: ["CH3CH(OH)COOH", "CH3CH(OH)COO{-}"] },
    cloroacetico: { formas: ["ClCH2COOH", "ClCH2COONa"], iones: ["ClCH2COOH", "ClCH2COO{-}"] },
    dicloroacetico: { formas: ["Cl2CHCOOH", "Cl2CHCOONa"], iones: ["Cl2CHCOOH", "Cl2CHCOO{-}"] },
    tricloroacetico: { formas: ["Cl3CCOOH", "Cl3CCOONa"], iones: ["Cl3CCOOH", "Cl3CCOO{-}"] },
    fluorhidrico: { formas: ["HF", "NaF"], iones: ["HF", "F{-}"] },
    nitroso: { formas: ["HNO2", "NaNO2"], iones: ["HNO2", "NO2{-}"] },
    hipocloroso: { formas: ["HClO", "NaClO"], iones: ["HClO", "ClO{-}"] },
    cianhidrico: { formas: ["HCN", "NaCN"], iones: ["HCN", "CN{-}"] },
    sulfhidrico: { formas: ["H2S", "NaHS", "Na2S"], iones: ["H2S", "HS{-}", "S{2-}"] },
    carbonico: { formas: ["H2CO3", "NaHCO3", "Na2CO3"], iones: ["H2CO3", "HCO3{-}", "CO3{2-}"] },
    fosforico: { formas: ["H3PO4", "NaH2PO4", "Na2HPO4", "Na3PO4"], iones: ["H3PO4", "H2PO4{-}", "HPO4{2-}", "PO4{3-}"] },
    sulfuroso: { formas: ["H2SO3", "NaHSO3", "Na2SO3"], iones: ["H2SO3", "HSO3{-}", "SO3{2-}"] },
    sulfurico: { formas: ["H2SO4", "Na2SO4"], iones: ["HSO4{-}", "SO4{2-}"], esp: [0] },
    oxalico: { formas: ["H2C2O4", "NaHC2O4", "Na2C2O4"], iones: ["H2C2O4", "HC2O4{-}", "C2O4{2-}"] },
    malonico: { formas: ["CH2(COOH)2", "NaOOCCH2COOH", "CH2(COONa)2"], iones: ["CH2(COOH)2", "HOOCCH2COO{-}", "CH2(COO)2{2-}"] },
    succinico: { formas: ["(CH2COOH)2", "NaOOC(CH2)2COOH", "(CH2COONa)2"], iones: ["(CH2COOH)2", "HOOC(CH2)2COO{-}", "(CH2COO)2{2-}"] },
    ftalico: { formas: ["C6H4(COOH)2", "KHC8H4O4", "C6H4(COONa)2"], iones: ["C6H4(COOH)2", "HC8H4O4{-}", "C8H4O4{2-}"] },
    tartarico: { formas: ["H2C4H4O6", "KHC4H4O6", "Na2C4H4O6"], iones: ["H2C4H4O6", "HC4H4O6{-}", "C4H4O6{2-}"] },
    citrico: { formas: ["C6H8O7", "NaC6H7O7", "Na2C6H6O7", "Na3C6H5O7"], iones: ["C6H8O7", "C6H7O7{-}", "C6H6O7{2-}", "C6H5O7{3-}"] },
    borico: { formas: ["H3BO3", "NaB(OH)4"], iones: ["H3BO3", "B(OH)4{-}"] },
    amonio: { formas: ["NH4Cl", "NH3"], iones: ["NH4{+}", "NH3"] },
    metilamina: { formas: ["CH3NH3Cl", "CH3NH2"], iones: ["CH3NH3{+}", "CH3NH2"] },
    dimetilamina: { formas: ["(CH3)2NH2Cl", "(CH3)2NH"], iones: ["(CH3)2NH2{+}", "(CH3)2NH"] },
    trimetilamina: { formas: ["(CH3)3NHCl", "(CH3)3N"], iones: ["(CH3)3NH{+}", "(CH3)3N"] },
    etilamina: { formas: ["C2H5NH3Cl", "C2H5NH2"], iones: ["C2H5NH3{+}", "C2H5NH2"] },
    piridina: { formas: ["C5H5NHCl", "C5H5N"], iones: ["C5H5NH{+}", "C5H5N"] },
    anilina: { formas: ["C6H5NH3Cl", "C6H5NH2"], iones: ["C6H5NH3{+}", "C6H5NH2"] },
    hidracina: { formas: ["N2H5Cl", "N2H4"], iones: ["N2H5{+}", "N2H4"] },
    hidroxilamina: { formas: ["NH3OHCl", "NH2OH"], iones: ["NH3OH{+}", "NH2OH"] },
    glicina: { formas: ["HOOCCH2NH3Cl", "H2NCH2COOH", "H2NCH2COONa"], iones: ["H3NCH2COOH{+}", "H3NCH2COO", "H2NCH2COO{-}"] },
};
export interface SalDatos {
    cation: string;
    zc: number;
    m: number;
    n: number;
    anion: {
        ion: string;
        carga: number;
    } | {
        sistema: string;
    } | "oh";
}
export const SALES_DATOS: Record<string, SalDatos> = {
    agcl: { cation: "Ag+", zc: 1, m: 1, n: 1, anion: { ion: "Cl-", carga: -1 } },
    agbr: { cation: "Ag+", zc: 1, m: 1, n: 1, anion: { ion: "Br-", carga: -1 } },
    agi: { cation: "Ag+", zc: 1, m: 1, n: 1, anion: { ion: "I-", carga: -1 } },
    ag2cro4: { cation: "Ag+", zc: 1, m: 2, n: 1, anion: { ion: "CrO42-", carga: -2 } },
    baso4: { cation: "Ba2+", zc: 2, m: 1, n: 1, anion: { sistema: "sulfurico" } },
    caso4: { cation: "Ca2+", zc: 2, m: 1, n: 1, anion: { sistema: "sulfurico" } },
    caf2: { cation: "Ca2+", zc: 2, m: 1, n: 2, anion: { sistema: "fluorhidrico" } },
    caco3: { cation: "Ca2+", zc: 2, m: 1, n: 1, anion: { sistema: "carbonico" } },
    pbi2: { cation: "Pb2+", zc: 2, m: 1, n: 2, anion: { ion: "I-", carga: -1 } },
    mgoh2: { cation: "Mg2+", zc: 2, m: 1, n: 2, anion: "oh" },
    caoh2: { cation: "Ca2+", zc: 2, m: 1, n: 2, anion: "oh" },
    feoh3: { cation: "Fe3+", zc: 3, m: 1, n: 3, anion: "oh" },
};
export function formasDe(id: string, carga0: number, nPKa: number): Forma[] {
    const m = ESPECIES_DATOS[id];
    if (!m || m.formas.length < nPKa + 1 || m.iones.length !== m.formas.length)
        return [];
    const iones = m.iones.slice(0, nPKa + 1);
    if (!iones.every((ion, k) => cargaDe(ion) === carga0 - k))
        return [];
    return m.formas.slice(0, nPKa + 1).map((formula, k) => ({ formula, ion: iones[k], esp: m.esp?.[k] ?? k - carga0 }));
}
export function cargaDe(ion: string): number {
    const c = ion.match(/\{(\d*)([+-])\}$/);
    return c ? (c[1] ? Number(c[1]) : 1) * (c[2] === "+" ? 1 : -1) : 0;
}
export function especiesDeTabla(tabla: TablaConstantes | null): Map<string, Especie> {
    const m = new Map<string, Especie>();
    for (const a of tabla?.acidos ?? []) {
        const formas = formasDe(a.id, a.carga0, a.pKa.length);
        if (formas.length)
            m.set(a.id, { id: a.id, pKa: a.pKa, carga0: a.carga0, formas });
    }
    return m;
}
export function salesDeTabla(tabla: TablaConstantes | null): Map<string, Sal & {
    id: string;
    formula: string;
}> {
    const m = new Map<string, Sal & {
        id: string;
        formula: string;
    }>();
    const acidos = new Map((tabla?.acidos ?? []).map(a => [a.id, a]));
    for (const k of tabla?.solubilidad ?? []) {
        const d = SALES_DATOS[k.id];
        if (!d)
            continue;
        let anion: Sal["anion"];
        if (d.anion === "oh")
            anion = { tipo: "oh" };
        else if ("ion" in d.anion)
            anion = { tipo: "ion", ion: d.anion.ion, carga: d.anion.carga };
        else {
            const a = acidos.get(d.anion.sistema);
            if (!a)
                continue;
            anion = { tipo: "sistema", id: a.id, pKa: a.pKa, carga0: a.carga0 };
        }
        m.set(k.id, { id: k.id, formula: k.formula, pKs: k.pKs, cation: d.cation, zc: d.zc, m: d.m, n: d.n, anion });
    }
    return m;
}
