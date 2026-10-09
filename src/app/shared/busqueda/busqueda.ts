export const normaliza = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const VACIAS = new Set(("a al con como de del el en es la las lo los mas o para por que se sin su un una y " +
    "an and as at be by do for how i in is it of on or should the to use using what when with " +
    "der die das und mit ein eine zu im den von ist le les des et un une du pour avec dans o os um uma e do da com no na").split(" "));
const raiz = (w: string) => w.length <= 4 ? w : w.replace(/(es|s)$/, "");
export const palabras = (s: string) => normaliza(s).split(/[^a-z0-9.]+/).map(w => w.replace(/^\.+|\.+$/g, ""))
    .filter(w => w.length > 1 && !VACIAS.has(w)).map(raiz);
const trigramas = (w: string) => { const s = ` ${w} `, out = new Set<string>(); for (let i = 0; i + 3 <= s.length; i++)
    out.add(s.slice(i, i + 3)); return out; };
export function parecido(a: Set<string>, b: Set<string>): number {
    let comun = 0;
    for (const t of a)
        if (b.has(t))
            comun++;
    return comun / (a.size + b.size - comun);
}
export const UMBRAL_ERRATA = 0.45;
export interface Indice<T> {
    items: T[];
    campos: {
        peso: number;
        palabras: Set<string>;
    }[][];
    vocabulario: Map<string, Set<string>>;
}
export function indexar<T>(items: readonly T[], campos: (it: T) => [
    peso: number,
    texto: string
][]): Indice<T> {
    const vocabulario = new Map<string, Set<string>>();
    const cs = items.map(it => campos(it).map(([peso, texto]) => {
        const ws = new Set([...palabras(texto), ...palabras(normaliza(texto).replace(/([a-z0-9])-(?=[a-z0-9])/g, "$1"))]);
        for (const w of ws)
            if (!vocabulario.has(w))
                vocabulario.set(w, trigramas(w));
        return { peso, palabras: ws };
    }));
    return { items: [...items], campos: cs, vocabulario };
}
export interface Opciones {
    exige?: "mitad" | "peso" | "una";
    escribiendo?: boolean;
}
export interface Resultado<T> {
    item: T;
    casan: number;
    puntos: number;
}
export function buscarEn<T>(ix: Indice<T>, consulta: string, { exige = "mitad", escribiendo = false }: Opciones = {}): Resultado<T>[] {
    const crudas = normaliza(consulta).split(/[^a-z0-9.]+/).map(w => w.replace(/^\.+|\.+$/g, "")).filter(Boolean);
    const aMedias = escribiendo && !/[\s.,;]$/.test(consulta);
    let ultima = "";
    const pedidas = [...new Set(crudas.flatMap((w, i) => {
            const esUltima = aMedias && i === crudas.length - 1;
            if (w.length <= 1 || (VACIAS.has(w) && !(esUltima && crudas.length === 1)))
                return [];
            if (esUltima) {
                ultima = w;
                return [w];
            }
            return [raiz(w)];
        }))];
    if (!pedidas.length)
        return [];
    const casaCon = pedidas.map(w => {
        const m = new Map<string, number>();
        const tw = w.length >= 5 ? trigramas(w) : null;
        const prefijo = w.length >= 5 || (w === ultima && w.length >= 2);
        const r = w === ultima ? raiz(w) : w;
        for (const [d, td] of ix.vocabulario) {
            if (d === w || d === r || (prefijo && (d.startsWith(w) || d.startsWith(r))))
                m.set(d, 1);
            else if (tw && d.length >= 4 && d[0] === w[0] && parecido(tw, td) >= UMBRAL_ERRATA)
                m.set(d, 0.5);
        }
        return m;
    });
    const valor = ix.items.map((_, i) => casaCon.map(m => {
        let mejor = 0, v1 = 0;
        for (const c of ix.campos[i])
            for (const [d, v] of m)
                if (c.palabras.has(d) && c.peso * v > mejor) {
                    mejor = c.peso * v;
                    v1 = v;
                }
        return { mejor, v: v1 };
    }));
    const N = ix.items.length;
    const idf = casaCon.map((_, k) => Math.log(1 + N / (valor.filter(x => x[k].mejor > 0).length + 0.5)));
    const total = idf.reduce((a, b) => a + b, 0);
    const out: Resultado<T>[] = [];
    ix.items.forEach((item, i) => {
        let casan = 0, puntos = 0, cubierto = 0;
        valor[i].forEach(({ mejor, v }, k) => { if (mejor) {
            casan++;
            puntos += mejor;
            cubierto += idf[k] * v;
        } });
        const sale = exige === "una" ? casan >= 1 : exige === "peso" ? cubierto >= total / 2 : casan >= Math.max(1, Math.ceil(pedidas.length / 2));
        if (sale)
            out.push({ item, casan, puntos });
    });
    return out.sort((a, b) => b.casan - a.casan || b.puntos - a.puntos);
}
