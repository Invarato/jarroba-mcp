export interface Trozo {
    texto: string;
    desde: number;
    hasta: number;
    idx: number;
}
export interface OpcionesTroceo {
    tamano: number;
    solape: number;
}
const VACIAS = new Set([
    "el",
    "la",
    "los",
    "las",
    "un",
    "una",
    "unos",
    "unas",
    "de",
    "del",
    "al",
    "a",
    "y",
    "o",
    "u",
    "en",
    "que",
    "es",
    "se",
    "por",
    "con",
    "para",
    "su",
    "sus",
    "lo",
    "como",
    "m\u00E1s",
    "pero",
    "sin",
    "sobre",
    "este",
    "esta",
    "the",
    "of",
    "and",
    "to",
    "in",
    "is",
    "it",
    "for",
    "on",
    "with",
    "as",
    "at",
    "by",
    "an",
    "be",
    "this",
    "that",
]);
export function tokenizar(t: string): string[] {
    return t.toLowerCase()
        .normalize("NFD").replace(/[̀-ͯ]/g, "")
        .split(/[^a-z0-9]+/)
        .filter(w => w.length > 1 && !VACIAS.has(w));
}
export class RagRetrievalService {
    navegarPorEstructura(texto: string, consulta: string): {
        ruta: string;
        texto: string;
        score: number;
    }[] {
        const secciones = this.seccionar(texto);
        if (!secciones.length)
            return [];
        const rutas = secciones.map(s => s.ruta);
        const porTitulo = this.bm25(consulta, rutas);
        const porCuerpo = this.bm25(consulta, secciones.map(s => s.texto));
        return secciones
            .map((s, i) => ({ ...s, score: porTitulo[i] * 2 + porCuerpo[i] }))
            .sort((a, b) => b.score - a.score);
    }
    seccionar(texto: string): {
        ruta: string;
        texto: string;
        nivel: number;
    }[] {
        const lineas = texto.split("\n");
        const out: {
            ruta: string;
            texto: string;
            nivel: number;
        }[] = [];
        const pila: string[] = [];
        let cuerpo: string[] = [];
        const cerrar = () => {
            const t = cuerpo.join("\n").trim();
            if (t && pila.length)
                out.push({ ruta: pila.join(" \u203A "), texto: t, nivel: pila.length });
            cuerpo = [];
        };
        for (const l of lineas) {
            const m = /^(#{1,6})\s+(.*)$/.exec(l);
            if (m) {
                cerrar();
                const nivel = m[1].length;
                pila.length = Math.min(pila.length, nivel - 1);
                pila[nivel - 1] = m[2].trim();
                for (let i = 0; i < nivel - 1; i++)
                    pila[i] ??= "(sin t\u00EDtulo)";
            }
            else {
                cuerpo.push(l);
            }
        }
        cerrar();
        return out;
    }
    trocear(texto: string, { tamano, solape }: OpcionesTroceo): Trozo[] {
        const t = texto.trim();
        if (!t)
            return [];
        const solapeEf = Math.max(0, Math.min(solape, Math.floor(tamano / 2)));
        const out: Trozo[] = [];
        let desde = 0;
        while (desde < t.length) {
            let hasta = Math.min(t.length, desde + tamano);
            if (hasta < t.length) {
                const minimo = desde + Math.floor(tamano * 0.6);
                const ventana = t.slice(minimo, hasta);
                const parrafo = ventana.lastIndexOf("\n\n");
                const frase = Math.max(ventana.lastIndexOf(". "), ventana.lastIndexOf(".\n"));
                if (parrafo > 0)
                    hasta = minimo + parrafo + 2;
                else if (frase > 0)
                    hasta = minimo + frase + 1;
            }
            const trozo = t.slice(desde, hasta).trim();
            if (trozo)
                out.push({ texto: trozo, desde, hasta, idx: out.length });
            if (hasta >= t.length)
                break;
            desde = Math.max(desde + 1, hasta - solapeEf);
        }
        return out;
    }
    bm25(consulta: string, docs: string[], k1 = 1.2, b = 0.75): number[] {
        const q = tokenizar(consulta);
        if (!q.length || !docs.length)
            return docs.map(() => 0);
        const tokens = docs.map(tokenizar);
        const largos = tokens.map(d => d.length);
        const largoMedio = largos.reduce((s, n) => s + n, 0) / docs.length || 1;
        return tokens.map((doc, i) => {
            const frec = new Map<string, number>();
            for (const w of doc)
                frec.set(w, (frec.get(w) ?? 0) + 1);
            let score = 0;
            for (const termino of new Set(q)) {
                const f = frec.get(termino) ?? 0;
                if (!f)
                    continue;
                const n = tokens.filter(d => d.includes(termino)).length;
                const idf = Math.max(0, Math.log(1 + (docs.length - n + 0.5) / (n + 0.5)));
                score += idf * (f * (k1 + 1)) / (f + k1 * (1 - b + b * largos[i] / largoMedio));
            }
            return score;
        });
    }
    fusionRRF(listas: number[][], k = 60): number[] {
        const n = listas[0]?.length ?? 0;
        const out = new Array(n).fill(0);
        for (const puntuaciones of listas) {
            const orden = puntuaciones
                .map((s, i) => ({ s, i }))
                .filter(({ s }) => s > 0)
                .sort((a, b) => b.s - a.s);
            orden.forEach(({ i }, puesto) => { out[i] += 1 / (k + puesto + 1); });
        }
        return out;
    }
}
