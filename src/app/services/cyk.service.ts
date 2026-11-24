import { Injectable } from "@angular/core";
export const MAX_PALABRA = 12;
export const MAX_REGLAS = 40;
export interface Regla {
    izq: string;
    der: string[];
}
export interface Gramatica {
    inicial: string;
    variables: string[];
    reglas: Regla[];
}
export type ErrorGramatica = {
    error: "vacia";
} | {
    error: "linea";
    linea: number;
} | {
    error: "no-fnc";
    linea: number;
    regla: string;
} | {
    error: "grande";
};
export function leerGramatica(texto: string): Gramatica | ErrorGramatica {
    const reglas: Regla[] = [];
    const lineas = texto.split("\n");
    const crudas: {
        linea: number;
        izq: string;
        alternativas: string[];
    }[] = [];
    for (let k = 0; k < lineas.length; k++) {
        const l = lineas[k].trim();
        if (!l || l.startsWith("#"))
            continue;
        const m = /^(\S+)\s*(?:->|→|::=)\s*(.+)$/.exec(l);
        if (!m)
            return { error: "linea", linea: k + 1 };
        crudas.push({ linea: k + 1, izq: m[1], alternativas: m[2].split("|").map(s => s.trim()) });
    }
    if (!crudas.length)
        return { error: "vacia" };
    const variables = [...new Set(crudas.map(c => c.izq))];
    const inicial = crudas[0].izq;
    const esVar = new Set(variables);
    const porPalabras = variables.some(v => [...v].length > 1) || crudas.some(c => c.alternativas.some(a => /\s/.test(a)));
    for (const c of crudas) {
        for (const alt of c.alternativas) {
            if (!alt)
                return { error: "linea", linea: c.linea };
            const der = porPalabras ? alt.split(/\s+/) : [...alt];
            const eps = der.length === 1 && /^(ε|eps)$/i.test(der[0]);
            const fnc = eps ? c.izq === inicial
                : der.length === 1 ? !esVar.has(der[0])
                    : der.length === 2 && esVar.has(der[0]) && esVar.has(der[1]);
            if (!fnc)
                return { error: "no-fnc", linea: c.linea, regla: `${c.izq} → ${alt}` };
            reglas.push({ izq: c.izq, der: eps ? [] : der });
        }
    }
    if (reglas.length > MAX_REGLAS)
        return { error: "grande" };
    return { inicial, variables, reglas };
}
export interface ParCYK {
    k: number;
    izq: string[];
    der: string[];
    combinaciones: string[];
    generan: string[];
}
export interface PasoCYK {
    i: number;
    j: number;
    pares: ParCYK[];
    celda: string[];
}
export interface ResultadoCYK {
    palabra: string[];
    tabla: string[][][];
    pasos: PasoCYK[];
    acepta: boolean;
}
export function trocearPalabra(w: string): string[] {
    const t = w.trim();
    return !t ? [] : /\s/.test(t) ? t.split(/\s+/) : [...t];
}
export function cyk(g: Gramatica, palabra: readonly string[]): ResultadoCYK | null {
    const n = palabra.length;
    if (n > MAX_PALABRA)
        return null;
    const orden = (xs: Iterable<string>) => g.variables.filter(v => new Set(xs).has(v));
    const tabla: string[][][] = Array.from({ length: n + 2 }, () => Array.from({ length: n + 2 }, () => [] as string[]));
    const pasos: PasoCYK[] = [];
    if (n === 0) {
        const acepta = g.reglas.some(r => r.izq === g.inicial && r.der.length === 0);
        return { palabra: [], tabla, pasos, acepta };
    }
    for (let i = 1; i <= n; i++) {
        const celda = orden(g.reglas.filter(r => r.der.length === 1 && r.der[0] === palabra[i - 1]).map(r => r.izq));
        tabla[i][i] = celda;
        pasos.push({ i, j: i, pares: [], celda });
    }
    for (let largo = 2; largo <= n; largo++) {
        for (let i = 1; i + largo - 1 <= n; i++) {
            const j = i + largo - 1;
            const pares: ParCYK[] = [];
            const celda = new Set<string>();
            for (let k = i; k < j; k++) {
                const izq = tabla[i][k], der = tabla[k + 1][j];
                const combinaciones = izq.flatMap(a => der.map(b => a + " " + b));
                const generan = orden(g.reglas.filter(r => r.der.length === 2 && izq.includes(r.der[0]) && der.includes(r.der[1])).map(r => r.izq));
                generan.forEach(v => celda.add(v));
                pares.push({ k, izq, der, combinaciones, generan });
            }
            tabla[i][j] = orden(celda);
            pasos.push({ i, j, pares, celda: tabla[i][j] });
        }
    }
    return { palabra: [...palabra], tabla, pasos, acepta: tabla[1][n].includes(g.inicial) };
}
@Injectable({ providedIn: "root" })
export class CykService {
    leerGramatica = leerGramatica;
    cyk = cyk;
}
