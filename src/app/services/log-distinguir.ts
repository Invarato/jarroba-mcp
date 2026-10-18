import type { LogEvent } from "./log-parse.service";
export interface Distintivo {
    campo: string;
    valor: string;
    enSeleccion: number;
    pctSeleccion: number;
    enResto: number;
    pctResto: number;
}
export interface Distincion {
    distintivos: Distintivo[];
    seleccion: number;
    resto: number;
    descartados: string[];
}
export interface OpcionesDistinguir {
    excluir?: string[];
    max?: number;
    minSeleccion?: number;
    minDiferencia?: number;
}
function dimensiones(ev: LogEvent): [
    string,
    string
][] {
    const out: [
        string,
        string
    ][] = [];
    if (ev.level)
        out.push(["level", ev.level]);
    if (ev.source)
        out.push(["source", ev.source]);
    for (const [k, v] of Object.entries(ev.fields))
        if (v !== "" && v.length <= 200)
            out.push([k, v]);
    return out;
}
export function distinguir(eventos: LogEvent[], enSeleccion: (i: number) => boolean, o: OpcionesDistinguir = {}): Distincion {
    const max = o.max ?? 10, minSel = o.minSeleccion ?? 3, minDif = o.minDiferencia ?? 0.1;
    const excluir = new Set(o.excluir ?? []);
    const cuenta = new Map<string, Map<string, [
        number,
        number
    ]>>();
    const conCampo = new Map<string, number>();
    let nSel = 0, nResto = 0;
    eventos.forEach((ev, i) => {
        const sel = enSeleccion(i);
        if (sel)
            nSel++;
        else
            nResto++;
        for (const [k, v] of dimensiones(ev)) {
            if (excluir.has(k))
                continue;
            let m = cuenta.get(k);
            if (!m) {
                m = new Map();
                cuenta.set(k, m);
            }
            const c = m.get(v) ?? [0, 0];
            c[sel ? 0 : 1]++;
            m.set(v, c);
            conCampo.set(k, (conCampo.get(k) ?? 0) + 1);
        }
    });
    const descartados: string[] = [];
    const out: Distintivo[] = [];
    if (!nSel || !nResto)
        return { distintivos: [], seleccion: nSel, resto: nResto, descartados };
    for (const [campo, valores] of cuenta) {
        const n = conCampo.get(campo) ?? 0;
        if (valores.size > 20 && valores.size > n * 0.5) {
            descartados.push(campo);
            continue;
        }
        for (const [valor, [s, r]] of valores) {
            if (s < minSel)
                continue;
            const pS = s / nSel, pR = r / nResto;
            if (pS - pR < minDif)
                continue;
            out.push({ campo, valor, enSeleccion: s, pctSeleccion: pS, enResto: r, pctResto: pR });
        }
    }
    out.sort((a, b) => (b.pctSeleccion - b.pctResto) - (a.pctSeleccion - a.pctResto) || b.enSeleccion - a.enSeleccion);
    return { distintivos: out.slice(0, max), seleccion: nSel, resto: nResto, descartados: descartados.sort() };
}
