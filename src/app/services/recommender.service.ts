export type Cesta = readonly string[];
export function cestasEjemplo(n = 400, semilla = 1): string[][] {
    const r = azar(semilla), out: string[][] = [];
    for (let i = 0; i < n; i++) {
        const c = new Set<string>();
        if (r() < 0.8)
            c.add("pan");
        if (r() < 0.6)
            c.add("leche");
        const desayuno = r() < 0.3, barbacoa = r() < 0.2, bebe = r() < 0.08;
        if (desayuno) {
            c.add("cereales");
            if (r() < 0.7)
                c.add("leche");
            if (r() < 0.4)
                c.add("pl\u00E1tanos");
        }
        if (barbacoa) {
            c.add("carb\u00F3n");
            if (r() < 0.8)
                c.add("salchichas");
            if (r() < 0.6)
                c.add("cerveza");
            if (r() < 0.4)
                c.add("ketchup");
        }
        if (bebe) {
            c.add("pa\u00F1ales");
            if (r() < 0.5)
                c.add("cerveza");
            if (r() < 0.6)
                c.add("toallitas");
        }
        if (r() < 0.25)
            c.add("cerveza");
        if (r() < 0.15)
            c.add("pl\u00E1tanos");
        if (r() < 0.1)
            c.add("ketchup");
        if (!c.size)
            c.add("pan");
        out.push([...c]);
    }
    return out;
}
export function leerCestas(texto: string, max = 5000): string[][] {
    return texto.split(/\r?\n/).map(l => [...new Set(l.split(/[,;\t]/).map(x => x.trim().toLowerCase()).filter(Boolean))]).filter(c => c.length).slice(0, max);
}
export interface Frecuente {
    items: string[];
    soporte: number;
}
export function apriori(cestas: readonly Cesta[], minSoporte: number, maxTam = 4): Frecuente[] {
    const n = cestas.length || 1, sets = cestas.map(c => new Set(c)), out: Frecuente[] = [];
    const soporte = (items: string[]) => sets.filter(s => items.every(i => s.has(i))).length / n;
    let nivel = [...new Set(cestas.flat())].sort().map(i => [i]).filter(c => soporte(c) >= minSoporte);
    for (let k = 1; nivel.length && k <= maxTam; k++) {
        nivel.forEach(items => out.push({ items, soporte: soporte(items) }));
        const claves = new Set(nivel.map(c => c.join("\0"))), cand: string[][] = [];
        for (let a = 0; a < nivel.length; a++)
            for (let b = a + 1; b < nivel.length; b++) {
                const x = nivel[a], y = nivel[b];
                if (x.slice(0, -1).join("\0") !== y.slice(0, -1).join("\0"))
                    continue;
                const c = [...x, y[y.length - 1]].sort();
                if (c.every((_, i) => claves.has(c.filter((_, j) => j !== i).join("\0"))))
                    cand.push(c);
            }
        nivel = cand.filter(c => soporte(c) >= minSoporte);
    }
    return out;
}
export interface Regla {
    si: string[];
    entonces: string[];
    soporte: number;
    confianza: number;
    lift: number;
}
export function reglas(frecuentes: readonly Frecuente[], minConfianza: number): Regla[] {
    const sop = new Map(frecuentes.map(f => [f.items.join("\0"), f.soporte])), out: Regla[] = [];
    for (const f of frecuentes) {
        if (f.items.length < 2)
            continue;
        for (const b of f.items) {
            const si = f.items.filter(x => x !== b), sA = sop.get(si.join("\0")), sB = sop.get(b);
            if (!sA || !sB)
                continue;
            const confianza = f.soporte / sA;
            if (confianza >= minConfianza)
                out.push({ si, entonces: [b], soporte: f.soporte, confianza, lift: confianza / sB });
        }
    }
    return out.sort((x, y) => y.lift - x.lift || y.confianza - x.confianza);
}
export type Valoraciones = (number | null)[][];
export interface DatosValoraciones {
    personas: string[];
    peliculas: string[];
    notas: Valoraciones;
    generos: string[];
}
export function valoracionesEjemplo(semilla = 1): DatosValoraciones {
    const r = azar(semilla);
    const peliculas = ["Persecuci\u00F3n", "Explosi\u00F3n final", "Misi\u00F3n al l\u00EDmite", "Cartas de amor", "Un verano en Par\u00EDs", "Boda en mayo", "El robot amable", "Bosque m\u00E1gico", "Ping\u00FCinos al rescate", "La isla"];
    const generos = ["acci\u00F3n", "acci\u00F3n", "acci\u00F3n", "rom\u00E1ntica", "rom\u00E1ntica", "rom\u00E1ntica", "animaci\u00F3n", "animaci\u00F3n", "animaci\u00F3n", "mezcla"];
    const perfil: number[][] = [[1, 0, 0], [1, 0, 0], [1, 0, 0], [0, 1, 0], [0, 1, 0], [0, 1, 0], [0, 0, 1], [0, 0, 1], [0, 0, 1], [0.5, 0.5, 0]];
    const personas = ["Ana", "Bruno", "Carla", "Diego", "Elena", "Fran", "Gema", "Hugo", "Irene", "Jorge", "Luc\u00EDa", "Mario"];
    const notas = personas.map(() => {
        const g = [r(), r(), r()].map(x => x * x), sg = g[0] + g[1] + g[2];
        return peliculas.map((_, j) => {
            const afinidad = perfil[j].reduce((s, v, t) => s + v * g[t] / sg, 0);
            const nota = Math.max(1, Math.min(5, Math.round(1 + 4 * afinidad * 1.6 + (r() - 0.5))));
            return r() < 0.45 ? nota : null;
        });
    });
    return { personas, peliculas, notas, generos };
}
const mediaFila = (f: readonly (number | null)[]) => { const v = f.filter((x): x is number => x !== null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 3; };
export function similitudItems(notas: Valoraciones): number[][] {
    const medias = notas.map(mediaFila), m = notas[0]?.length ?? 0, S = Array.from({ length: m }, () => new Array<number>(m).fill(0));
    for (let a = 0; a < m; a++)
        for (let b = a; b < m; b++) {
            let num = 0, na = 0, nb = 0;
            notas.forEach((f, u) => { const x = f[a], y = f[b]; if (x !== null && y !== null) {
                const dx = x - medias[u], dy = y - medias[u];
                num += dx * dy;
                na += dx * dx;
                nb += dy * dy;
            } });
            const s = a === b ? 1 : na && nb ? num / Math.sqrt(na * nb) : 0;
            S[a][b] = s;
            S[b][a] = s;
        }
    return S;
}
export function predecirItems(notas: Valoraciones, S: number[][], u: number, j: number, k = 3): number | null {
    const mu = mediaFila(notas[u]);
    const vecinos = notas[u].map((x, i) => ({ i, x, s: S[j][i] })).filter(v => v.x !== null && v.i !== j && v.s > 0).sort((a, b) => b.s - a.s).slice(0, k);
    const den = vecinos.reduce((s, v) => s + v.s, 0);
    if (!den)
        return null;
    return Math.max(1, Math.min(5, mu + vecinos.reduce((s, v) => s + v.s * ((v.x as number) - mu), 0) / den));
}
export interface Factorizacion {
    P: number[][];
    Q: number[][];
    bu: number[];
    bi: number[];
    mu: number;
    predecir: (u: number, j: number) => number;
    error: number[];
}
export function factorizar(notas: Valoraciones, k = 3, epocas = 200, tasa = 0.02, l2 = 0.05, semilla = 1): Factorizacion {
    const r = azar(semilla), U = notas.length, M = notas[0]?.length ?? 0;
    const vistas: [
        number,
        number,
        number
    ][] = [];
    notas.forEach((f, u) => f.forEach((x, j) => { if (x !== null)
        vistas.push([u, j, x]); }));
    const mu = vistas.reduce((s, v) => s + v[2], 0) / (vistas.length || 1);
    const P = Array.from({ length: U }, () => Array.from({ length: k }, () => (r() - 0.5) * 0.2));
    const Q = Array.from({ length: M }, () => Array.from({ length: k }, () => (r() - 0.5) * 0.2));
    const bu = new Array<number>(U).fill(0), bi = new Array<number>(M).fill(0), error: number[] = [];
    const pred = (u: number, j: number) => mu + bu[u] + bi[j] + P[u].reduce((s, v, t) => s + v * Q[j][t], 0);
    for (let e = 0; e < epocas; e++) {
        let se = 0;
        for (const idx of barajarIdx(vistas.length, r)) {
            const [u, j, x] = vistas[idx], err = x - pred(u, j);
            se += err * err;
            bu[u] += tasa * (err - l2 * bu[u]);
            bi[j] += tasa * (err - l2 * bi[j]);
            for (let t = 0; t < k; t++) {
                const pu = P[u][t], qj = Q[j][t];
                P[u][t] += tasa * (err * qj - l2 * pu);
                Q[j][t] += tasa * (err * pu - l2 * qj);
            }
        }
        error.push(Math.sqrt(se / (vistas.length || 1)));
    }
    return { P, Q, bu, bi, mu, error, predecir: (u, j) => Math.max(1, Math.min(5, pred(u, j))) };
}
export function apartar(notas: Valoraciones, fraccion: number, semilla = 2): {
    entreno: Valoraciones;
    prueba: [
        number,
        number,
        number
    ][];
} {
    const r = azar(semilla), entreno = notas.map(f => [...f]), prueba: [
        number,
        number,
        number
    ][] = [];
    notas.forEach((f, u) => f.forEach((x, j) => { if (x !== null && r() < fraccion && entreno[u].filter(v => v !== null).length > 2) {
        prueba.push([u, j, x]);
        entreno[u][j] = null;
    } }));
    return { entreno, prueba };
}
export const rmse = (pares: readonly [
    number,
    number
][]) => Math.sqrt(pares.reduce((s, [a, b]) => s + (a - b) ** 2, 0) / (pares.length || 1));
export function azar(semilla: number): () => number {
    let a = semilla >>> 0;
    return () => { a = (a + 1831565813) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function barajarIdx(n: number, r: () => number): number[] {
    const a = Array.from({ length: n }, (_, i) => i);
    for (let i = n - 1; i > 0; i--) {
        const j = Math.floor(r() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}
