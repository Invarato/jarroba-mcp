export type OperadorRegla = "eq" | "ne" | "startsWith" | "notStartsWith" | "endsWith" | "notEndsWith" | "contains" | "notContains" | "match" | "notMatch" | "in" | "notIn";
export type ValorRegla = string | number | boolean | null | ValorRegla[];
export type NodoRegla = {
    tipo: "y";
    hijos: NodoRegla[];
} | {
    tipo: "o";
    hijos: NodoRegla[];
} | {
    tipo: "no";
    hijo: NodoRegla;
} | {
    tipo: "comparacion";
    propiedad: string;
    operador: OperadorRegla;
    valor: ValorRegla;
    texto: string;
} | {
    tipo: "coleccion";
    propiedad: string;
    modo: "any" | "all";
    sub: NodoRegla;
    texto: string;
} | {
    tipo: "noModelado";
    texto: string;
};
export interface AtributosPrincipal {
    [clave: string]: string | number | boolean | null | unknown[] | undefined;
}
type Token = {
    tipo: "operador";
    valor: string;
} | {
    tipo: "cadena";
    valor: string;
} | {
    tipo: "numero";
    valor: number;
} | {
    tipo: "bool";
    valor: boolean;
} | {
    tipo: "null";
} | {
    tipo: "ident";
    valor: string;
} | {
    tipo: "(";
} | {
    tipo: ")";
} | {
    tipo: "[";
} | {
    tipo: "]";
} | {
    tipo: ",";
};
const OPERADORES = [
    "notStartsWith",
    "notEndsWith",
    "notContains",
    "notMatch",
    "notIn",
    "startsWith",
    "endsWith",
    "contains",
    "match",
    "in",
    "eq",
    "ne",
    "and",
    "or",
    "not",
    "any",
    "all",
];
const TOKEN_REGEX = new RegExp(`\\s*(?:(-(?:${OPERADORES.join("|")})\\b)|("(?:[^"\\\\]|\\\\.)*")|(\\[)|(\\])|(\\()|(\\))|(,)|([A-Za-z_][A-Za-z0-9_.]*)|(-?\\d+(?:\\.\\d+)?))`, "y");
function tokenizar(s: string): Token[] {
    const tokens: Token[] = [];
    TOKEN_REGEX.lastIndex = 0;
    let pos = 0;
    while (pos < s.length) {
        TOKEN_REGEX.lastIndex = pos;
        const m = TOKEN_REGEX.exec(s);
        if (!m || m[0].length === 0) {
            pos++;
            continue;
        }
        pos = TOKEN_REGEX.lastIndex;
        const [, operador, cadena, abre, cierra, lparen, rparen, coma, ident, numero] = m;
        if (operador)
            tokens.push({ tipo: "operador", valor: operador.slice(1) });
        else if (cadena)
            tokens.push({ tipo: "cadena", valor: cadena.slice(1, -1).replace(/\\(.)/g, "$1") });
        else if (abre)
            tokens.push({ tipo: "[" });
        else if (cierra)
            tokens.push({ tipo: "]" });
        else if (lparen)
            tokens.push({ tipo: "(" });
        else if (rparen)
            tokens.push({ tipo: ")" });
        else if (coma)
            tokens.push({ tipo: "," });
        else if (ident === "true" || ident === "false")
            tokens.push({ tipo: "bool", valor: ident === "true" });
        else if (ident === "null")
            tokens.push({ tipo: "null" });
        else if (ident)
            tokens.push({ tipo: "ident", valor: ident });
        else if (numero)
            tokens.push({ tipo: "numero", valor: Number(numero) });
    }
    return tokens;
}
const OPS_COMPARACION = new Set<string>(["eq", "ne", "startsWith", "notStartsWith", "endsWith", "notEndsWith", "contains", "notContains", "match", "notMatch", "in", "notIn"]);
class LectorTokens {
    private i = 0;
    constructor(private readonly t: Token[], private readonly original: string) { }
    mira(): Token | undefined { return this.t[this.i]; }
    fin(): boolean { return this.i >= this.t.length; }
    esOperador(nombre: string): boolean { const tk = this.mira(); return !!tk && tk.tipo === "operador" && tk.valor === nombre; }
    consumeOperador(nombre: string): boolean { if (this.esOperador(nombre)) {
        this.i++;
        return true;
    } return false; }
    consume(tipo: Token["tipo"]): boolean { if (this.mira()?.tipo === tipo) {
        this.i++;
        return true;
    } return false; }
    avanza(): Token { const tk = this.t[this.i]; if (!tk)
        throw new Error("fin inesperado"); this.i++; return tk; }
    textoRestante(): string { return this.original; }
    sincroniza(): void {
        while (this.mira() && !(this.esOperador("and") || this.esOperador("or") || this.mira()!.tipo === ")"))
            this.i++;
    }
}
function parseValor(l: LectorTokens): ValorRegla {
    if (l.consume("[")) {
        const items: ValorRegla[] = [];
        if (!l.mira() || l.mira()!.tipo !== "]") {
            items.push(parseValorSimple(l));
            while (l.consume(","))
                items.push(parseValorSimple(l));
        }
        if (!l.consume("]"))
            throw new Error("falta ']'");
        return items;
    }
    return parseValorSimple(l);
}
function parseValorSimple(l: LectorTokens): ValorRegla {
    const tk = l.avanza();
    if (tk.tipo === "cadena")
        return tk.valor;
    if (tk.tipo === "numero")
        return tk.valor;
    if (tk.tipo === "bool")
        return tk.valor;
    if (tk.tipo === "null")
        return null;
    if (tk.tipo === "ident")
        return tk.valor;
    throw new Error("se esperaba un valor");
}
function parsePrimaria(l: LectorTokens): NodoRegla {
    if (l.consume("(")) {
        const n = parseOr(l);
        if (!l.consume(")"))
            throw new Error("falta ')'");
        return n;
    }
    if (l.consumeOperador("not"))
        return { tipo: "no", hijo: parsePrimaria(l) };
    const tk = l.mira();
    if (!tk || tk.tipo !== "ident") {
        l.sincroniza();
        return { tipo: "noModelado", texto: l.textoRestante() };
    }
    const propiedad = l.avanza() as Token & {
        tipo: "ident";
    };
    const siguiente = l.mira();
    if (siguiente?.tipo === "operador" && (siguiente.valor === "any" || siguiente.valor === "all")) {
        const modo = siguiente.valor as "any" | "all";
        l.avanza();
        if (!l.consume("(")) {
            l.sincroniza();
            return { tipo: "noModelado", texto: `${propiedad.valor} -${modo} …` };
        }
        const sub = parseOr(l);
        if (!l.consume(")"))
            throw new Error("falta ')'");
        return { tipo: "coleccion", propiedad: propiedad.valor, modo, sub, texto: `${propiedad.valor} -${modo} (…)` };
    }
    if (siguiente?.tipo === "operador" && OPS_COMPARACION.has(siguiente.valor)) {
        const operador = siguiente.valor as OperadorRegla;
        l.avanza();
        const valor = parseValor(l);
        return { tipo: "comparacion", propiedad: propiedad.valor, operador, valor, texto: `${propiedad.valor} -${operador} ${JSON.stringify(valor)}` };
    }
    l.sincroniza();
    return { tipo: "noModelado", texto: propiedad.valor };
}
function parseNo(l: LectorTokens): NodoRegla { return parsePrimaria(l); }
function parseY(l: LectorTokens): NodoRegla {
    const hijos = [parseNo(l)];
    while (l.consumeOperador("and"))
        hijos.push(parseNo(l));
    return hijos.length === 1 ? hijos[0] : { tipo: "y", hijos };
}
function parseOr(l: LectorTokens): NodoRegla {
    const hijos = [parseY(l)];
    while (l.consumeOperador("or"))
        hijos.push(parseY(l));
    return hijos.length === 1 ? hijos[0] : { tipo: "o", hijos };
}
export function parseRegla(regla: string): NodoRegla {
    try {
        const l = new LectorTokens(tokenizar(regla), regla);
        const n = parseOr(l);
        return l.fin() ? n : { tipo: "noModelado", texto: regla };
    }
    catch {
        return { tipo: "noModelado", texto: regla };
    }
}
function ultimoTramo(propiedad: string): string {
    const partes = propiedad.split(".");
    return partes[partes.length - 1];
}
function igualdadCI(a: unknown, b: unknown): boolean {
    if (a == null || b == null)
        return a == null && b == null;
    if (typeof a === "string" && typeof b === "string")
        return a.toLowerCase() === b.toLowerCase();
    return a === b;
}
function coincideOperador(op: OperadorRegla, real: unknown, esperado: ValorRegla): boolean {
    const rs = typeof real === "string" ? real.toLowerCase() : null;
    const es = typeof esperado === "string" ? esperado.toLowerCase() : null;
    switch (op) {
        case "eq": return igualdadCI(real, esperado);
        case "ne": return !igualdadCI(real, esperado);
        case "startsWith": return rs != null && es != null && rs.startsWith(es);
        case "notStartsWith": return !(rs != null && es != null && rs.startsWith(es));
        case "endsWith": return rs != null && es != null && rs.endsWith(es);
        case "notEndsWith": return !(rs != null && es != null && rs.endsWith(es));
        case "contains": return rs != null && es != null && rs.includes(es);
        case "notContains": return !(rs != null && es != null && rs.includes(es));
        case "match": return rs != null && es != null && new RegExp(esperado as string, "i").test(real as string);
        case "notMatch": return !(rs != null && es != null && new RegExp(esperado as string, "i").test(real as string));
        case "in": return Array.isArray(esperado) && esperado.some(v => igualdadCI(real, v));
        case "notIn": return !(Array.isArray(esperado) && esperado.some(v => igualdadCI(real, v)));
    }
}
type Contexto = {
    clase: "atributos";
    attrs: AtributosPrincipal;
} | {
    clase: "item";
    valor: unknown;
};
function resolverValor(propiedad: string, ctx: Contexto): unknown {
    if (ctx.clase === "item") {
        if (propiedad === "_")
            return ctx.valor;
        if (ctx.valor != null && typeof ctx.valor === "object")
            return (ctx.valor as Record<string, unknown>)[ultimoTramo(propiedad)];
        return undefined;
    }
    return ctx.attrs[ultimoTramo(propiedad)];
}
export interface DetalleRegla {
    texto: string;
    resultado: boolean | "no-modelado";
}
export function evaluarRegla(n: NodoRegla, attrs: AtributosPrincipal, detalles: DetalleRegla[] = []): boolean | "no-modelado" {
    const ctx: Contexto = { clase: "atributos", attrs };
    return evaluarNodo(n, ctx, detalles);
}
function evaluarNodo(n: NodoRegla, ctx: Contexto, detalles: DetalleRegla[]): boolean | "no-modelado" {
    switch (n.tipo) {
        case "y": {
            const rs = n.hijos.map(h => evaluarNodo(h, ctx, detalles));
            if (rs.some(r => r === false))
                return false;
            return rs.every(r => r === true) ? true : "no-modelado";
        }
        case "o": {
            const rs = n.hijos.map(h => evaluarNodo(h, ctx, detalles));
            if (rs.some(r => r === true))
                return true;
            return rs.every(r => r === false) ? false : "no-modelado";
        }
        case "no": {
            const r = evaluarNodo(n.hijo, ctx, detalles);
            return r === "no-modelado" ? "no-modelado" : !r;
        }
        case "comparacion": {
            const real = resolverValor(n.propiedad, ctx);
            const r = coincideOperador(n.operador, real, n.valor);
            detalles.push({ texto: n.texto, resultado: r });
            return r;
        }
        case "coleccion": {
            const coleccion = ctx.clase === "atributos" ? ctx.attrs[ultimoTramo(n.propiedad)] : undefined;
            if (!Array.isArray(coleccion)) {
                detalles.push({ texto: n.texto, resultado: "no-modelado" });
                return "no-modelado";
            }
            const resultados = coleccion.map(item => evaluarNodo(n.sub, { clase: "item", valor: item }, []));
            const r = n.modo === "any"
                ? (resultados.some(x => x === true) ? true : resultados.every(x => x === false) ? false : "no-modelado")
                : (resultados.some(x => x === false) ? false : resultados.every(x => x === true) ? true : "no-modelado");
            detalles.push({ texto: n.texto, resultado: r });
            return r;
        }
        case "noModelado":
            detalles.push({ texto: n.texto, resultado: "no-modelado" });
            return "no-modelado";
    }
}
