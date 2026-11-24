export type Decimal = "coma" | "punto";
export type EstadoComprobacion = "ok" | "redondeo" | "mal" | "nolei";
export interface Comprobacion {
    desde: number;
    hasta: number;
    izquierda: string;
    derecha: string;
    expresion: string;
    valorIzq: number;
    valorDer: number;
    aproximado: boolean;
    estado: EstadoComprobacion;
    decimales: number;
}
export interface ResultadoComprobar {
    decimal: Decimal;
    comprobaciones: Comprobacion[];
}
type Tipo = "num" | "op" | "pi" | "pd" | "pct" | "de" | "cur" | "eq" | "raiz" | "otro" | "salto";
interface Ficha {
    t: Tipo;
    v: string;
    i: number;
    f: number;
    num?: number;
    dec?: number;
    aprox?: boolean;
}
const SUPER: Record<string, string> = { "\u00B2": "2", "\u00B3": "3", "\u2074": "4" };
const MONEDA = /^(€|\$|£|eur|euros?|usd|dólar(es)?|dolar(es)?|dollars?|gbp|libras?)$/i;
function trocear(texto: string): Ficha[] {
    const out: Ficha[] = [];
    const re = /(\d[\d.,]*\d|\d)|([+\-−*×·⋅÷/^()=≈≃%√:–])|([²³⁴])|(\n)|(\s+)|([A-Za-zÀ-ÿ€$£]+)|(.)/gu;
    for (const m of texto.matchAll(re)) {
        const i = m.index!, f = i + m[0].length;
        if (m[1])
            out.push({ t: "num", v: m[1], i, f });
        else if (m[2]) {
            const s = m[2];
            if (s === "(")
                out.push({ t: "pi", v: s, i, f });
            else if (s === ")")
                out.push({ t: "pd", v: s, i, f });
            else if (s === "=" || s === "\u2248" || s === "\u2243")
                out.push({ t: "eq", v: s, i, f, aprox: s !== "=" });
            else if (s === "%")
                out.push({ t: "pct", v: s, i, f });
            else if (s === "\u221A")
                out.push({ t: "raiz", v: s, i, f });
            else if (s === ":" || s === "\u2013") {
                const conEsp = /\s/.test(texto[i - 1] ?? "") && /\s/.test(texto[f] ?? "");
                out.push(conEsp ? { t: "op", v: s === ":" ? "/" : "-", i, f } : { t: "otro", v: s, i, f });
            }
            else
                out.push({ t: "op", v: s === "\u2212" ? "-" : s === "\u00D7" || s === "\u00B7" || s === "\u22C5" ? "*" : s === "\u00F7" ? "/" : s, i, f });
        }
        else if (m[3]) {
            out.push({ t: "op", v: "^", i, f: i });
            out.push({ t: "num", v: SUPER[m[3]], i, f });
        }
        else if (m[4])
            out.push({ t: "salto", v: "\n", i, f });
        else if (m[5])
            continue;
        else if (m[6]) {
            const w = m[6];
            const prev = out[out.length - 1];
            if ((w === "x" || w === "X") && prev && (prev.t === "num" || prev.t === "pd" || prev.t === "pct"))
                out.push({ t: "op", v: "*", i, f });
            else if (/^(de|del|of)$/i.test(w) && prev?.t === "pct")
                out.push({ t: "de", v: w, i, f });
            else if (MONEDA.test(w))
                out.push({ t: "cur", v: w, i, f });
            else
                out.push({ t: "otro", v: w, i, f });
        }
        else
            out.push({ t: "otro", v: m[7], i, f });
    }
    return out;
}
export function detectarDecimal(texto: string, preferido: Decimal): Decimal {
    let coma = 0, punto = 0;
    for (const m of texto.matchAll(/\d[\d.,]*\d/g)) {
        const n = m[0];
        const ip = n.lastIndexOf("."), ic = n.lastIndexOf(",");
        if (ip >= 0 && ic >= 0) {
            if (ic > ip)
                coma += 2;
            else
                punto += 2;
            continue;
        }
        if (/^\d{1,3}(\.\d{3}){2,}$/.test(n))
            coma++;
        else if (/^\d{1,3}(,\d{3}){2,}$/.test(n))
            punto++;
        else if (/^\d+,\d{1,2}$/.test(n) || /^\d+,\d{4,}$/.test(n))
            coma++;
        else if (/^\d+\.\d{1,2}$/.test(n) || /^\d+\.\d{4,}$/.test(n))
            punto++;
    }
    return coma > punto ? "coma" : punto > coma ? "punto" : preferido;
}
export function leerNumero(s: string, decimal: Decimal): {
    n: number;
    dec: number;
} | null {
    const [miles, dec] = decimal === "coma" ? [".", ","] : [",", "."];
    const partes = s.split(dec);
    if (partes.length > 2)
        return null;
    const [ent, frac = ""] = partes;
    if (ent.includes(miles)) {
        const g = ent.split(miles);
        if (!/^\d{1,3}$/.test(g[0]) || g.slice(1).some(x => !/^\d{3}$/.test(x))) {
            if (g.length === 2 && !frac)
                return { n: Number(`${g[0]}.${g[1]}`), dec: g[1].length };
            return null;
        }
    }
    if (frac && !/^\d+$/.test(frac))
        return null;
    const n = Number(ent.split(miles).join("") + (frac ? "." + frac : ""));
    return Number.isFinite(n) ? { n, dec: frac.length } : null;
}
interface Val {
    v: number;
    s: string;
}
const NUM_S = (n: number) => String(n);
class Lector {
    private k = 0;
    constructor(private f: Ficha[]) { }
    private ver() { return this.f[this.k]; }
    private es(t: Tipo, v?: string) { const x = this.ver(); return !!x && x.t === t && (v === undefined || x.v === v); }
    fin() { return this.k >= this.f.length; }
    expr(): Val {
        let a = this.term();
        while (this.es("op", "+") || this.es("op", "-")) {
            const op = this.f[this.k++].v;
            const ini = this.k;
            const t = this.term();
            const soloPct = this.k - ini === 2 && this.f[ini].t === "num" && this.f[ini + 1].t === "pct";
            if (soloPct)
                a = { v: op === "+" ? a.v * (1 + t.v) : a.v * (1 - t.v), s: `(${a.s}) * (1 ${op} ${t.s})` };
            else
                a = { v: op === "+" ? a.v + t.v : a.v - t.v, s: `${a.s} ${op} ${t.s}` };
        }
        return a;
    }
    private term(): Val {
        let a = this.pot();
        while (this.es("op", "*") || this.es("op", "/")) {
            const op = this.f[this.k++].v;
            const d = this.pot();
            if (op === "/" && d.v === 0)
                throw new Error("div0");
            a = { v: op === "*" ? a.v * d.v : a.v / d.v, s: `${a.s} ${op} ${d.s}` };
        }
        return a;
    }
    private pot(): Val {
        const b = this.unario();
        if (this.es("op", "^")) {
            this.k++;
            const e = this.pot();
            return { v: Math.pow(b.v, e.v), s: `${b.s}^${e.s}` };
        }
        return b;
    }
    private unario(): Val {
        if (this.es("op", "-")) {
            this.k++;
            const x = this.unario();
            return { v: -x.v, s: `-${x.s}` };
        }
        if (this.es("op", "+")) {
            this.k++;
            return this.unario();
        }
        if (this.es("raiz")) {
            this.k++;
            const x = this.unario();
            if (x.v < 0)
                throw new Error("raiz");
            return { v: Math.sqrt(x.v), s: `sqrt(${x.s.replace(/^\((.*)\)$/, "$1")})` };
        }
        return this.primario();
    }
    private primario(): Val {
        const x = this.ver();
        if (!x)
            throw new Error("fin");
        if (x.t === "pi") {
            this.k++;
            const v = this.expr();
            if (!this.es("pd"))
                throw new Error("par\u00E9ntesis");
            this.k++;
            return this.pct({ v: v.v, s: `(${v.s})` });
        }
        if (x.t === "num") {
            this.k++;
            return this.pct({ v: x.num!, s: NUM_S(x.num!) });
        }
        throw new Error("ficha");
    }
    private pct(a: Val): Val {
        if (!this.es("pct"))
            return a;
        this.k++;
        const p = { v: a.v / 100, s: `${a.s} / 100` };
        if (this.es("de")) {
            this.k++;
            const b = this.unario();
            return { v: p.v * b.v, s: `${p.s} * ${b.s}` };
        }
        return p;
    }
}
function evaluar(f: Ficha[]): Val {
    const l = new Lector(f);
    const v = l.expr();
    if (!l.fin())
        throw new Error("sobra");
    if (!Number.isFinite(v.v))
        throw new Error("infinito");
    return v;
}
const MATE: ReadonlySet<Tipo> = new Set<Tipo>(["num", "op", "pi", "pd", "pct", "de", "cur", "eq", "raiz"]);
const ACABA_OPERANDO = (x: Ficha) => x.t === "num" || x.t === "pd" || x.t === "pct";
const EMPIEZA_OPERANDO = (x: Ficha) => x.t === "num" || x.t === "pi" || x.t === "raiz";
function trozos(lado: Ficha[]): Ficha[][] {
    const out: Ficha[][] = [[]];
    for (let k = 0; k < lado.length; k++) {
        if (k > 0 && ACABA_OPERANDO(lado[k - 1]) && EMPIEZA_OPERANDO(lado[k]))
            out.push([]);
        out[out.length - 1].push(lado[k]);
    }
    return out.filter(t => t.length);
}
function recortar(t: Ficha[]): Ficha[] {
    let a = 0, b = t.length;
    while (a < b && !(EMPIEZA_OPERANDO(t[a]) || (t[a].t === "op" && t[a].v === "-")))
        a++;
    while (b > a && !ACABA_OPERANDO(t[b - 1]))
        b--;
    return t.slice(a, b);
}
const tieneOperacion = (t: Ficha[]) => t.some(x => x.t === "op" || x.t === "pct" || x.t === "raiz");
const textoDe = (texto: string, t: Ficha[]) => texto.slice(t[0].i, t[t.length - 1].f);
export function comprobarTexto(texto: string, preferido: Decimal, forzar?: Decimal): ResultadoComprobar {
    const decimal = forzar ?? detectarDecimal(texto, preferido);
    const fichas = trocear(texto);
    for (const x of fichas)
        if (x.t === "num") {
            const r = leerNumero(x.v, decimal);
            if (r) {
                x.num = r.n;
                x.dec = r.dec;
            }
            else
                x.t = "otro";
        }
    fichas.forEach((x, k) => {
        if (x.t === "cur" && fichas[k - 1]?.t !== "num" && fichas[k + 1]?.t !== "num")
            x.t = "otro";
    });
    const comprobaciones: Comprobacion[] = [];
    let k = 0;
    while (k < fichas.length) {
        if (!MATE.has(fichas[k].t)) {
            k++;
            continue;
        }
        let fin = k;
        while (fin < fichas.length && MATE.has(fichas[fin].t))
            fin++;
        const tramo = fichas.slice(k, fin).filter(x => x.t !== "cur");
        k = fin;
        const lados: Ficha[][] = [[]];
        const signos: Ficha[] = [];
        for (const x of tramo) {
            if (x.t === "eq") {
                lados.push([]);
                signos.push(x);
            }
            else
                lados[lados.length - 1].push(x);
        }
        for (let s = 0; s < signos.length; s++) {
            const izqT = trozos(lados[s]), derT = trozos(lados[s + 1]);
            const izq = recortar(s === 0 ? izqT[izqT.length - 1] ?? [] : lados[s]);
            const der = recortar(s + 1 === signos.length ? derT[0] ?? [] : lados[s + 1]);
            if (!izq.length || !der.length || (!tieneOperacion(izq) && !tieneOperacion(der)))
                continue;
            const aproximado = !!signos[s].aprox;
            const base: Omit<Comprobacion, "valorIzq" | "valorDer" | "estado"> = {
                desde: izq[0].i,
                hasta: der[der.length - 1].f,
                izquierda: textoDe(texto, izq),
                derecha: textoDe(texto, der),
                expresion: "",
                aproximado,
                decimales: der.filter(x => x.t === "num").reduce((m, x) => Math.max(m, x.dec ?? 0), 0),
            };
            let vi: Val, vd: Val;
            try {
                vi = evaluar(izq);
                vd = evaluar(der);
            }
            catch {
                comprobaciones.push({ ...base, valorIzq: NaN, valorDer: NaN, estado: "nolei" });
                continue;
            }
            comprobaciones.push({ ...base, expresion: vi.s, valorIzq: vi.v, valorDer: vd.v, estado: veredicto(vi.v, vd.v, der, base.decimales, aproximado) });
        }
    }
    return { decimal, comprobaciones };
}
function veredicto(vi: number, vd: number, der: Ficha[], decimales: number, aprox: boolean): EstadoComprobacion {
    const cerca = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol + 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
    if (cerca(vi, vd, 0))
        return "ok";
    const derEsPct = der.length >= 2 && der[der.length - 1].t === "pct" && !der.slice(0, -1).some(x => x.t === "op");
    const candidatos = derEsPct ? [vd, vd * 100] : [vd];
    const simple = der.every(x => x.t === "num" || x.t === "pct" || (x.t === "op" && x.v === "-"));
    for (const c of candidatos) {
        if (cerca(vi, c, 0))
            return "ok";
        const escala = derEsPct && c === vd ? 100 : 1;
        if (simple && cerca(vi * escala, c * escala, 0.5 * 10 ** -decimales))
            return "redondeo";
        if (aprox && cerca(vi, c, 0.01 * Math.abs(c)))
            return "redondeo";
    }
    return "mal";
}
export function formatear(n: number, decimales: number, decimal: Decimal): string {
    const d = Math.min(Math.max(decimales, Number.isInteger(n) ? 0 : Math.min(4, decimales || 2)), 10);
    const [ent, frac] = Math.abs(n).toFixed(d).split(".");
    const miles = ent.replace(/\B(?=(\d{3})+(?!\d))/g, decimal === "coma" ? "." : ",");
    return `${n < 0 ? "\u2212" : ""}${miles}${frac ? (decimal === "coma" ? "," : ".") + frac : ""}`;
}
