export interface Trozo {
    texto: string;
    desde: number;
    hasta: number;
    idx: number;
}
export interface TrozoSeccion extends Trozo {
    ruta: string;
    indexado: string;
    tabla: boolean;
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
    trocearPorSecciones(texto: string, op: OpcionesTroceo): TrozoSeccion[] {
        const out: TrozoSeccion[] = [];
        const lineas = texto.replace(/\r/g, "").split("\n");
        const pila: string[] = [];
        let cuerpo: string[] = [], desde = 0, pos = 0, rutaCuerpo = "";
        const empujar = (t: string, ruta: string, a: number, b: number, tabla: boolean) => {
            const limpio = t.trim();
            if (!limpio)
                return;
            out.push({ texto: limpio, desde: a, hasta: b, idx: out.length, ruta, indexado: ruta ? `${ruta}: ${limpio}` : limpio, tabla });
        };
        const cerrar = () => {
            let bloque: string[] = [], esTabla = false, ini = desde;
            const vaciar = (fin: number) => {
                if (!bloque.length)
                    return;
                const t = bloque.join("\n");
                if (!esTabla) {
                    for (const tr of this.trocear(t, op))
                        empujar(tr.texto, rutaCuerpo, ini + tr.desde, ini + tr.hasta, false);
                }
                else if (t.length <= op.tamano || bloque.length <= 3) {
                    empujar(t, rutaCuerpo, ini, fin, true);
                }
                else {
                    const cab = bloque.slice(0, 2).join("\n"), filas = bloque.slice(2);
                    let grupo: string[] = [];
                    for (const f of filas) {
                        if (grupo.length && cab.length + grupo.join("\n").length + f.length + 2 > op.tamano) {
                            empujar(cab + "\n" + grupo.join("\n"), rutaCuerpo, ini, fin, true);
                            grupo = [];
                        }
                        grupo.push(f);
                    }
                    if (grupo.length)
                        empujar(cab + "\n" + grupo.join("\n"), rutaCuerpo, ini, fin, true);
                }
                bloque = [];
            };
            let p = desde;
            for (const l of cuerpo) {
                const t = /^\s*\|/.test(l);
                if (bloque.length && t !== esTabla) {
                    vaciar(p);
                    ini = p;
                }
                if (!bloque.length) {
                    esTabla = t;
                    ini = p;
                }
                bloque.push(l);
                p += l.length + 1;
            }
            vaciar(p);
            cuerpo = [];
        };
        for (const l of lineas) {
            const m = /^(#{1,6})\s+(.*)$/.exec(l);
            if (m) {
                cerrar();
                const nivel = m[1].length;
                pila.length = Math.min(pila.length, nivel - 1);
                pila[nivel - 1] = m[2].trim();
                for (let k = 0; k < nivel - 1; k++)
                    pila[k] ??= "(sin t\u00EDtulo)";
                rutaCuerpo = pila.join(" \u203A ");
                desde = pos + l.length + 1;
            }
            else {
                if (!cuerpo.length)
                    desde = pos;
                cuerpo.push(l);
            }
            pos += l.length + 1;
        }
        cerrar();
        return out.map((t, idx) => ({ ...t, idx }));
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
                const espacio = Math.max(ventana.lastIndexOf(" "), ventana.lastIndexOf("\n"));
                if (parrafo > 0)
                    hasta = minimo + parrafo + 2;
                else if (frase > 0)
                    hasta = minimo + frase + 1;
                else if (espacio > 0)
                    hasta = minimo + espacio;
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
