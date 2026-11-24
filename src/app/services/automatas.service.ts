import { Injectable } from "@angular/core";
export const EPS = "\u03B5";
export const MUERTO = "\u2205";
export const MAX_ESTADOS = 80;
export const MAX_REGEX = 60;
export const MAX_ALFABETO = 12;
export interface Transicion {
    de: string;
    sim: string;
    a: string;
}
export interface Automata {
    estados: string[];
    alfabeto: string[];
    inicial: string;
    finales: string[];
    trans: Transicion[];
}
export function ordenNatural(a: string, b: string): number {
    const na = /^\d+$/.test(a), nb = /^\d+$/.test(b);
    if (na && nb)
        return Number(a) - Number(b);
    if (na !== nb)
        return na ? -1 : 1;
    return a < b ? -1 : a > b ? 1 : 0;
}
const ordenar = (xs: Iterable<string>) => [...new Set(xs)].sort(ordenNatural);
const clave = (xs: readonly string[]) => xs.join("\u0001");
export function esDeterminista(a: Automata): boolean {
    const vistos = new Set<string>();
    for (const t of a.trans) {
        if (t.sim === EPS)
            return false;
        const k = t.de + "\u0001" + t.sim;
        if (vistos.has(k))
            return false;
        vistos.add(k);
    }
    return true;
}
export function nombreLetra(i: number): string {
    let s = "";
    i++;
    while (i > 0) {
        const r = (i - 1) % 26;
        s = String.fromCharCode(65 + r) + s;
        i = Math.floor((i - 1) / 26);
    }
    return s;
}
export function cierreEpsilon(a: Automata, conjunto: readonly string[]): string[] {
    const res = new Set(conjunto);
    const pila = [...conjunto];
    while (pila.length) {
        const s = pila.pop()!;
        for (const t of a.trans)
            if (t.de === s && t.sim === EPS && !res.has(t.a)) {
                res.add(t.a);
                pila.push(t.a);
            }
    }
    return ordenar(res);
}
export function mover(a: Automata, conjunto: readonly string[], sim: string): string[] {
    const c = new Set(conjunto);
    return ordenar(a.trans.filter(t => c.has(t.de) && t.sim === sim).map(t => t.a));
}
export interface PasoSimulacion {
    sim: string;
    mover: string[];
    cierre: string[];
}
export interface ResultadoSimulacion {
    inicio: string[];
    pasos: PasoSimulacion[];
    acepta: boolean;
}
export function simular(a: Automata, palabra: readonly string[]): ResultadoSimulacion {
    const inicio = cierreEpsilon(a, [a.inicial]);
    let actual = inicio;
    const pasos: PasoSimulacion[] = [];
    for (const sim of palabra) {
        const m = mover(a, actual, sim);
        const c = cierreEpsilon(a, m);
        pasos.push({ sim, mover: m, cierre: c });
        actual = c;
        if (!c.length)
            break;
    }
    const fin = new Set(a.finales);
    const acepta = pasos.length === palabra.length && actual.some(s => fin.has(s));
    return { inicio, pasos, acepta };
}
export type NodoER = {
    t: "sim";
    v: string;
} | {
    t: "eps";
} | {
    t: "union";
    a: NodoER;
    b: NodoER;
} | {
    t: "concat";
    a: NodoER;
    b: NodoER;
} | {
    t: "estrella";
    a: NodoER;
};
export type ErrorER = {
    error: "vacia" | "larga" | "parentesis" | "operando" | "caracter";
    pos: number;
};
export function leerRegex(texto: string): NodoER | ErrorER {
    const s = texto.replace(/\s+/g, "");
    if (!s)
        return { error: "vacia", pos: 0 };
    if (s.length > MAX_REGEX)
        return { error: "larga", pos: MAX_REGEX };
    let i = 0;
    const fallo = (error: ErrorER["error"]): ErrorER => ({ error, pos: i });
    const expr = (): NodoER | ErrorER => {
        let izq = termino();
        if ("error" in izq)
            return izq;
        while (s[i] === "|") {
            i++;
            const der = termino();
            if ("error" in der)
                return der;
            izq = { t: "union", a: izq, b: der };
        }
        return izq;
    };
    const termino = (): NodoER | ErrorER => {
        let izq: NodoER | null = null;
        while (i < s.length && s[i] !== "|" && s[i] !== ")") {
            const f = factor();
            if ("error" in f)
                return f;
            izq = izq ? { t: "concat", a: izq, b: f } : f;
        }
        return izq ?? fallo("operando");
    };
    const factor = (): NodoER | ErrorER => {
        let a = atomo();
        if ("error" in a)
            return a;
        while (s[i] === "*" || s[i] === "+" || s[i] === "?") {
            const op = s[i++];
            a = op === "*" ? { t: "estrella", a } : op === "+" ? { t: "concat", a, b: { t: "estrella", a } } : { t: "union", a, b: { t: "eps" } };
        }
        return a;
    };
    const atomo = (): NodoER | ErrorER => {
        const c = s[i];
        if (c === "(") {
            i++;
            const e = expr();
            if ("error" in e)
                return e;
            if (s[i] !== ")")
                return fallo("parentesis");
            i++;
            return e;
        }
        if (c === "\u03B5") {
            i++;
            return { t: "eps" };
        }
        if (c !== undefined && /[\p{L}\p{N}]/u.test(c)) {
            i++;
            return { t: "sim", v: c };
        }
        if (c === "*" || c === "+" || c === "?" || c === "|" || c === ")" || c === undefined)
            return fallo("operando");
        return fallo("caracter");
    };
    const r = expr();
    if ("error" in r)
        return r;
    if (i < s.length)
        return s[i] === ")" ? fallo("parentesis") : fallo("caracter");
    return r;
}
export interface PasoThompson {
    tipo: "sim" | "eps" | "union" | "estrella";
    expr: string;
    ini: string;
    fin: string;
    nuevas: Transicion[];
}
export function textoER(n: NodoER): string {
    const prec = (x: NodoER) => x.t === "union" ? 0 : x.t === "concat" ? 1 : 2;
    const envolver = (x: NodoER, min: number) => prec(x) < min ? `(${textoER(x)})` : textoER(x);
    switch (n.t) {
        case "sim": return n.v;
        case "eps": return EPS;
        case "union": return `${envolver(n.a, 0)}|${envolver(n.b, 0)}`;
        case "concat": return `${envolver(n.a, 1)}${envolver(n.b, 1)}`;
        case "estrella": return `${envolver(n.a, 2)}*`;
    }
}
export function thompson(raiz: NodoER): {
    afn: Automata;
    pasos: PasoThompson[];
} | null {
    let n = 0;
    const trans: Transicion[] = [];
    const pasos: PasoThompson[] = [];
    const nuevo = () => String(n++);
    const arista = (de: string, sim: string, a: string, lista: Transicion[]) => { const t = { de, sim, a }; trans.push(t); lista.push(t); };
    const construir = (nodo: NodoER, ini?: string): {
        i: string;
        f: string;
    } => {
        if (n > MAX_ESTADOS)
            throw new RangeError("estados");
        const nuevas: Transicion[] = [];
        let r: {
            i: string;
            f: string;
        };
        switch (nodo.t) {
            case "sim":
            case "eps": {
                const i = ini ?? nuevo(), f = nuevo();
                arista(i, nodo.t === "sim" ? nodo.v : EPS, f, nuevas);
                r = { i, f };
                break;
            }
            case "union": {
                const i = ini ?? nuevo();
                const a = construir(nodo.a), b = construir(nodo.b);
                const f = nuevo();
                arista(i, EPS, a.i, nuevas);
                arista(i, EPS, b.i, nuevas);
                arista(a.f, EPS, f, nuevas);
                arista(b.f, EPS, f, nuevas);
                r = { i, f };
                break;
            }
            case "concat": {
                const a = construir(nodo.a, ini);
                const b = construir(nodo.b, a.f);
                return { i: a.i, f: b.f };
            }
            case "estrella": {
                const i = ini ?? nuevo();
                const a = construir(nodo.a);
                const f = nuevo();
                arista(i, EPS, a.i, nuevas);
                arista(a.f, EPS, a.i, nuevas);
                arista(a.f, EPS, f, nuevas);
                arista(i, EPS, f, nuevas);
                r = { i, f };
                break;
            }
        }
        pasos.push({ tipo: nodo.t, expr: textoER(nodo), ini: r.i, fin: r.f, nuevas });
        return r;
    };
    try {
        const { i, f } = construir(raiz);
        if (n > MAX_ESTADOS)
            return null;
        const estados = Array.from({ length: n }, (_, k) => String(k));
        const alfabeto = ordenar(trans.filter(t => t.sim !== EPS).map(t => t.sim));
        return { afn: { estados, alfabeto, inicial: i, finales: [f], trans }, pasos };
    }
    catch {
        return null;
    }
}
export interface PasoSubconjuntos {
    T: string;
    conjuntoT: string[];
    sim: string;
    mover: string[];
    U: string[];
    destino: string | null;
    nuevo: boolean;
}
export interface ResultadoSubconjuntos {
    afd: Automata;
    conjuntos: {
        nombre: string;
        estados: string[];
    }[];
    inicio: string[];
    pasos: PasoSubconjuntos[];
}
export function subconjuntos(afn: Automata, opciones: {
    conMuerto?: boolean;
} = {}): ResultadoSubconjuntos | null {
    const alfabeto = ordenar(afn.alfabeto.filter(s => s !== EPS));
    const inicio = cierreEpsilon(afn, [afn.inicial]);
    const conjuntos: {
        nombre: string;
        estados: string[];
    }[] = [];
    const porClave = new Map<string, string>();
    const trans: Transicion[] = [];
    const pasos: PasoSubconjuntos[] = [];
    const alta = (estados: string[]) => {
        const nombre = estados.length ? nombreLetra(conjuntos.filter(c => c.estados.length).length) : MUERTO;
        conjuntos.push({ nombre, estados });
        porClave.set(clave(estados), nombre);
        return nombre;
    };
    alta(inicio);
    for (let k = 0; k < conjuntos.length; k++) {
        if (conjuntos.length > MAX_ESTADOS)
            return null;
        const { nombre: T, estados: conjuntoT } = conjuntos[k];
        for (const sim of alfabeto) {
            const m = mover(afn, conjuntoT, sim);
            const U = cierreEpsilon(afn, m);
            let destino: string | null = porClave.get(clave(U)) ?? null;
            let esNuevo = false;
            if (destino === null && (U.length || opciones.conMuerto)) {
                destino = alta(U);
                esNuevo = true;
            }
            if (destino !== null)
                trans.push({ de: T, sim, a: destino });
            pasos.push({ T, conjuntoT, sim, mover: m, U, destino, nuevo: esNuevo });
        }
    }
    const fin = new Set(afn.finales);
    const afd: Automata = {
        estados: conjuntos.map(c => c.nombre),
        alfabeto,
        inicial: conjuntos[0].nombre,
        finales: conjuntos.filter(c => c.estados.some(s => fin.has(s))).map(c => c.nombre),
        trans,
    };
    return { afd, conjuntos, inicio, pasos };
}
export interface RondaMin {
    antes: string[][];
    divisiones: {
        grupo: string[];
        partes: {
            estados: string[];
            firma: number[];
        }[];
    }[];
    despues: string[][];
}
export interface ResultadoMin {
    inalcanzables: string[];
    completado: boolean;
    rondas: RondaMin[];
    final: string[][];
    afd: Automata;
}
export function alcanzables(a: Automata): string[] {
    const vistos = new Set([a.inicial]);
    const pila = [a.inicial];
    while (pila.length) {
        const s = pila.pop()!;
        for (const t of a.trans)
            if (t.de === s && !vistos.has(t.a)) {
                vistos.add(t.a);
                pila.push(t.a);
            }
    }
    return a.estados.filter(s => vistos.has(s));
}
export function minimizar(afd: Automata): ResultadoMin | null {
    if (!esDeterminista(afd))
        return null;
    const vivos = alcanzables(afd);
    const inalcanzables = afd.estados.filter(s => !vivos.includes(s));
    const alfabeto = ordenar(afd.alfabeto);
    const delta = new Map<string, string>();
    for (const t of afd.trans)
        if (vivos.includes(t.de))
            delta.set(t.de + "\u0001" + t.sim, t.a);
    let estados = [...vivos];
    let completado = false;
    for (const s of vivos)
        for (const c of alfabeto) {
            if (!delta.has(s + "\u0001" + c)) {
                completado = true;
                delta.set(s + "\u0001" + c, MUERTO);
            }
        }
    if (completado && !estados.includes(MUERTO)) {
        estados.push(MUERTO);
        for (const c of alfabeto)
            delta.set(MUERTO + "\u0001" + c, MUERTO);
    }
    const fin = new Set(afd.finales);
    let particion = [estados.filter(s => !fin.has(s)), estados.filter(s => fin.has(s))].filter(g => g.length);
    const rondas: RondaMin[] = [];
    for (;;) {
        const grupoDe = new Map<string, number>();
        particion.forEach((g, i) => g.forEach(s => grupoDe.set(s, i)));
        const divisiones: RondaMin["divisiones"] = [];
        const despues: string[][] = [];
        for (const g of particion) {
            const partes: {
                estados: string[];
                firma: number[];
            }[] = [];
            for (const s of g) {
                const firma = alfabeto.map(c => grupoDe.get(delta.get(s + "\u0001" + c)!)!);
                const p = partes.find(x => x.firma.every((v, i) => v === firma[i]));
                if (p)
                    p.estados.push(s);
                else
                    partes.push({ estados: [s], firma });
            }
            divisiones.push({ grupo: g, partes });
            despues.push(...partes.map(p => p.estados));
        }
        rondas.push({ antes: particion, divisiones, despues });
        if (despues.length === particion.length)
            break;
        particion = despues;
    }
    const juntar = (g: string[]) => g.every(s => s.length === 1) ? g.join("") : g.join(",");
    const nombreDe = new Map<string, string>();
    particion.forEach(g => g.forEach(s => nombreDe.set(s, juntar(g))));
    const trans: Transicion[] = [];
    for (const g of particion)
        for (const c of alfabeto)
            trans.push({ de: juntar(g), sim: c, a: nombreDe.get(delta.get(g[0] + "\u0001" + c)!)! });
    const minimo: Automata = {
        estados: particion.map(juntar),
        alfabeto,
        inicial: nombreDe.get(afd.inicial)!,
        finales: particion.filter(g => fin.has(g[0])).map(juntar),
        trans,
    };
    return { inalcanzables, completado, rondas, final: particion, afd: minimo };
}
export type ErrorAutomata = {
    error: "sin-inicio";
} | {
    error: "linea";
    linea: number;
} | {
    error: "grande";
};
export function leerAutomata(texto: string): Automata | ErrorAutomata {
    let inicial: string | null = null;
    const finales: string[] = [];
    const trans: Transicion[] = [];
    const estados: string[] = [];
    const ver = (s: string) => { if (!estados.includes(s))
        estados.push(s); };
    const lineas = texto.split("\n");
    for (let k = 0; k < lineas.length; k++) {
        const l = lineas[k].trim();
        if (!l || l.startsWith("#"))
            continue;
        const cab = /^(inicio|start|finales|final|finals)\s*:\s*(.*)$/i.exec(l);
        if (cab) {
            const valores = cab[2].split(/[\s,]+/).filter(Boolean);
            if (/^(inicio|start)$/i.test(cab[1])) {
                if (valores.length !== 1)
                    return { error: "linea", linea: k + 1 };
                inicial = valores[0];
                ver(inicial);
            }
            else {
                for (const v of valores) {
                    if (!finales.includes(v))
                        finales.push(v);
                    ver(v);
                }
            }
            continue;
        }
        const p = l.split(/\s+/);
        if (p.length !== 3)
            return { error: "linea", linea: k + 1 };
        const sim = /^(ε|eps|_)$/i.test(p[1]) ? EPS : p[1];
        if ([...sim].length !== 1)
            return { error: "linea", linea: k + 1 };
        ver(p[0]);
        ver(p[2]);
        if (!trans.some(t => t.de === p[0] && t.sim === sim && t.a === p[2]))
            trans.push({ de: p[0], sim, a: p[2] });
    }
    if (inicial === null)
        return { error: "sin-inicio" };
    const alfabeto = ordenar(trans.filter(t => t.sim !== EPS).map(t => t.sim));
    if (estados.length > MAX_ESTADOS || alfabeto.length > MAX_ALFABETO)
        return { error: "grande" };
    return { estados, alfabeto, inicial, finales, trans };
}
export function escribirAutomata(a: Automata): string {
    return [`inicio: ${a.inicial}`, `finales: ${a.finales.join(" ")}`, ...a.trans.map(t => `${t.de} ${t.sim} ${t.a}`)].join("\n");
}
@Injectable({ providedIn: "root" })
export class AutomatasService {
    leerRegex = leerRegex;
    thompson = thompson;
    subconjuntos = subconjuntos;
    minimizar = minimizar;
    simular = simular;
    leerAutomata = leerAutomata;
}
