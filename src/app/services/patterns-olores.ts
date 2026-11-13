import { parser } from "@lezer/javascript";
const PARSER = parser.configure({ dialect: "ts" });
type Arbol = ReturnType<typeof PARSER.parse>;
type Nodo = Arbol["topNode"];
export type OlorId = "long-method" | "long-params" | "type-switch" | "message-chain" | "god-class" | "feature-envy" | "duplicate" | "global-instance";
export interface Olor {
    id: OlorId;
    desde: number;
    hasta: number;
    donde: string;
    n: number;
    extra?: string;
}
export interface FichaOlor {
    practica: string;
    patron?: string;
}
export const UMBRAL = { lineasMetodo: 30, parametros: 4, casos: 3, cadena: 4, metodosClase: 20, lineasClase: 300, envidia: 4, duplicado: 5 } as const;
export const FICHAS: Record<OlorId, FichaOlor> = {
    "long-method": { practica: "metodo-largo-sin-extraer-funciones", patron: "template-method" },
    "long-params": { practica: "lista-de-parametros-larga", patron: "builder" },
    "type-switch": { practica: "sustituir-switch-por-tipo-con-polimorfismo", patron: "strategy" },
    "message-chain": { practica: "cadenas-de-llamadas-por-objetos-intermedios", patron: "facade" },
    "god-class": { practica: "clase-que-lo-hace-todo", patron: "facade" },
    "feature-envy": { practica: "envidia-de-caracteristicas" },
    "duplicate": { practica: "unificar-el-codigo-duplicado-en-cuanto-aparece", patron: "template-method" },
    "global-instance": { practica: "service-locator-en-vez-de-inyeccion-de-dependencias", patron: "singleton" },
};
export const OLORES: OlorId[] = ["long-method", "long-params", "type-switch", "message-chain", "god-class", "feature-envy", "duplicate", "global-instance"];
const FLUIDOS = new Set(["map", "filter", "reduce", "flatMap", "forEach", "some", "every", "find", "findIndex", "sort", "slice", "splice", "concat", "join", "split", "replace", "replaceAll", "trim", "toLowerCase", "toUpperCase", "padStart", "padEnd", "then", "catch", "finally", "pipe", "subscribe", "toString", "toFixed", "keys", "values", "entries", "reverse", "at", "includes", "indexOf", "push", "set", "get", "has", "add", "append", "with", "where", "select", "from", "orderBy", "build", "call", "apply", "bind", "test", "match", "exec", "length", "prototype"]);
const ESPACIOS = new Set(["Math", "JSON", "console", "document", "window", "globalThis", "Object", "Array", "Number", "String", "Promise", "Reflect", "process", "navigator", "location", "Intl", "Date", "crypto", "performance", "module", "exports", "require", "import"]);
const DISCRIMINANTE = /(?:\.|^)(type|kind|tipo|clase|category|categoria|state|estado|status|mode|modo|role|rol)\b|^typeof\b/i;
const FUNCIONES = new Set(["FunctionDeclaration", "MethodDeclaration", "ArrowFunction", "FunctionExpression"]);
export interface Analisis {
    olores: Olor[];
    lineas: number;
    funciones: number;
    clases: number;
    conErrores: boolean;
}
export function analizar(codigo: string): Analisis {
    const arbol = PARSER.parse(codigo);
    const linea = lineador(codigo);
    const txt = (n: Nodo) => codigo.slice(n.from, n.to);
    const olores: Olor[] = [];
    let funciones = 0, clases = 0, conErrores = false;
    const switches: {
        disc: string;
        desde: number;
        hasta: number;
        casos: number;
        donde: string;
        porTipo?: boolean;
    }[] = [];
    const nombreFn = (n: Nodo): string => {
        const propio = n.getChild("VariableDefinition") ?? n.getChild("PropertyDefinition");
        if (propio)
            return txt(propio);
        const p = n.parent;
        if (p?.name === "VariableDeclaration") {
            const v = p.getChild("VariableDefinition");
            if (v)
                return txt(v);
        }
        if (p?.name === "Property" || p?.name === "PropertyDeclaration") {
            const v = p.getChild("PropertyDefinition");
            if (v)
                return txt(v);
        }
        return "(an\u00F3nima)";
    };
    const claseDe = (n: Nodo): string | null => {
        for (let p = n.parent; p; p = p.parent)
            if (p.name === "ClassDeclaration" || p.name === "ClassExpression") {
                const v = p.getChild("VariableDefinition");
                return v ? txt(v) : "(clase)";
            }
        return null;
    };
    const conClase = (n: Nodo, nombre: string) => { const c = claseDe(n); return c && n.name === "MethodDeclaration" ? `${c}.${nombre}` : nombre; };
    const cur = arbol.cursor();
    do {
        const n = cur.node;
        if (n.type.isError)
            conErrores = true;
        if (FUNCIONES.has(n.name)) {
            funciones++;
            const nombre = conClase(n, nombreFn(n));
            const cuerpo = n.getChild("Block");
            if (cuerpo) {
                const l = lineasConCodigo(codigo, cuerpo.from, cuerpo.to);
                if (l > UMBRAL.lineasMetodo)
                    olores.push({ id: "long-method", desde: linea(n.from), hasta: linea(n.to), donde: nombre, n: l, extra: String(UMBRAL.lineasMetodo) });
            }
            const params = n.getChild("ParamList");
            if (params) {
                const np = params.getChildren("VariableDefinition").length + params.getChildren("ObjectPattern").length + params.getChildren("ArrayPattern").length;
                if (np > UMBRAL.parametros)
                    olores.push({ id: "long-params", desde: linea(params.from), hasta: linea(params.to), donde: nombre, n: np, extra: String(UMBRAL.parametros) });
            }
            if (n.name === "MethodDeclaration" && cuerpo) {
                const propios = propiosDirectos(cuerpo);
                const [v, k] = [...contarAccesosDirectos(cuerpo, txt)].sort((x, y) => y[1] - x[1])[0] ?? ["", 0];
                if (k >= UMBRAL.envidia && k > propios)
                    olores.push({ id: "feature-envy", desde: linea(n.from), hasta: linea(n.to), donde: nombre, n: k, extra: v });
            }
        }
        if (n.name === "ClassDeclaration" || n.name === "ClassExpression") {
            clases++;
            const nombre = n.getChild("VariableDefinition") ? txt(n.getChild("VariableDefinition")!) : "(clase)";
            const cuerpo = n.getChild("ClassBody");
            const metodos = cuerpo ? cuerpo.getChildren("MethodDeclaration").length : 0;
            const l = lineasConCodigo(codigo, n.from, n.to);
            if (metodos > UMBRAL.metodosClase || l > UMBRAL.lineasClase) {
                olores.push({ id: "god-class", desde: linea(n.from), hasta: linea(n.to), donde: nombre, n: metodos, extra: String(l) });
            }
            if (cuerpo)
                for (const m of [...cuerpo.getChildren("MethodDeclaration"), ...cuerpo.getChildren("PropertyDeclaration")]) {
                    const t = txt(m);
                    const pd = m.getChild("PropertyDefinition");
                    if (/^\s*static\b/.test(t) && pd && /^(getInstance|instance|getDefault|shared|current)$/i.test(txt(pd))) {
                        olores.push({ id: "global-instance", desde: linea(m.from), hasta: linea(m.to), donde: `${nombre}.${txt(pd)}`, n: 1 });
                        break;
                    }
                }
        }
        if (n.name === "SwitchStatement") {
            const par = n.getChild("ParenthesizedExpression");
            const cuerpo = n.getChild("SwitchBody");
            const casos = cuerpo ? cuerpo.getChildren("CaseLabel").length : 0;
            if (par && casos >= UMBRAL.casos) {
                let fn: Nodo | null = n.parent;
                while (fn && !FUNCIONES.has(fn.name))
                    fn = fn.parent;
                switches.push({ disc: txt(par).slice(1, -1).trim().replace(/\s+/g, " "), desde: linea(n.from), hasta: linea(n.to), casos, donde: fn ? conClase(fn, nombreFn(fn)) : "" });
            }
        }
        if (n.name === "IfStatement" && n.parent?.name !== "IfStatement") {
            const ramas: string[] = [];
            let instanceOf = false;
            for (let i: Nodo | null = n; i && i.name === "IfStatement"; i = i.getChildren("IfStatement").at(-1) ?? null) {
                const cond = i.getChild("ParenthesizedExpression");
                if (!cond)
                    break;
                const t = txt(cond).slice(1, -1).trim();
                const m = t.match(/^([\w$.]+)\s+instanceof\s+[\w$.]+$/) ?? t.match(/^([\w$.]+)\s*={2,3}\s*['"`][^'"`]*['"`]$/);
                if (!m)
                    break;
                if (/\binstanceof\b/.test(t))
                    instanceOf = true;
                ramas.push(m[1]);
            }
            if (ramas.length >= UMBRAL.casos && ramas.every(r => r === ramas[0])) {
                let fn: Nodo | null = n.parent;
                while (fn && !FUNCIONES.has(fn.name))
                    fn = fn.parent;
                switches.push({ disc: ramas[0], desde: linea(n.from), hasta: linea(n.to), casos: ramas.length, donde: fn ? conClase(fn, nombreFn(fn)) : "", porTipo: instanceOf });
            }
        }
        if (n.name === "MemberExpression" && n.parent?.name !== "MemberExpression" && !(n.parent?.name === "CallExpression" && n.parent.parent?.name === "MemberExpression")) {
            const { raiz, eslabones } = cadena(n, txt);
            if (raiz && !ESPACIOS.has(raiz) && eslabones.length >= UMBRAL.cadena) {
                olores.push({ id: "message-chain", desde: linea(n.from), hasta: linea(n.to), donde: `${raiz}.${eslabones.join(".")}`, n: eslabones.length });
            }
        }
    } while (cur.next());
    const veces = new Map<string, number>();
    for (const s of switches)
        veces.set(s.disc, (veces.get(s.disc) ?? 0) + 1);
    for (const s of switches) {
        if (s.porTipo || DISCRIMINANTE.test(s.disc) || (veces.get(s.disc) ?? 0) > 1)
            olores.push({ id: "type-switch", desde: s.desde, hasta: s.hasta, donde: s.disc, n: s.casos, extra: String(veces.get(s.disc)) });
    }
    olores.push(...duplicados(codigo));
    olores.sort((a, b) => a.desde - b.desde || OLORES.indexOf(a.id) - OLORES.indexOf(b.id));
    return { olores, lineas: codigo.split("\n").length, funciones, clases, conErrores };
}
function cadena(n: Nodo, txt: (n: Nodo) => string): {
    raiz: string | null;
    eslabones: string[];
} {
    const props: string[] = [];
    let x: Nodo | null = n;
    while (x) {
        if (x.name === "MemberExpression") {
            const p = x.getChild("PropertyName");
            if (p)
                props.unshift(txt(p));
            x = x.firstChild;
        }
        else if (x.name === "CallExpression")
            x = x.firstChild;
        else
            break;
    }
    if (!x)
        return { raiz: null, eslabones: [] };
    const raiz = x.name === "this" ? "this" : x.name === "VariableName" ? txt(x) : null;
    return { raiz, eslabones: props.filter(p => !FLUIDOS.has(p)).slice(raiz === "this" ? 1 : 0) };
}
function contarAccesosDirectos(bloque: Nodo, txt: (n: Nodo) => string): Map<string, number> {
    const m = new Map<string, number>();
    const c = bloque.cursor();
    do {
        if (c.name !== "MemberExpression")
            continue;
        const raiz = c.node.firstChild;
        if (raiz?.name === "VariableName" && !ESPACIOS.has(txt(raiz)))
            m.set(txt(raiz), (m.get(txt(raiz)) ?? 0) + 1);
    } while (c.next() && c.from < bloque.to);
    return m;
}
function propiosDirectos(bloque: Nodo): number {
    let k = 0;
    const c = bloque.cursor();
    do {
        if (c.name === "MemberExpression" && c.node.firstChild?.name === "this")
            k++;
    } while (c.next() && c.from < bloque.to);
    return k;
}
function lineador(codigo: string): (pos: number) => number {
    const ini: number[] = [0];
    for (let i = 0; i < codigo.length; i++)
        if (codigo[i] === "\n")
            ini.push(i + 1);
    return (pos: number) => { let lo = 0, hi = ini.length - 1; while (lo < hi) {
        const m = (lo + hi + 1) >> 1;
        if (ini[m] <= pos)
            lo = m;
        else
            hi = m - 1;
    } return lo + 1; };
}
export function lineasConCodigo(codigo: string, desde: number, hasta: number): number {
    return codigo.slice(desde, hasta).split("\n").filter(l => { const t = l.trim(); return t && !/^[{}()[\];,]*$/.test(t) && !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*"); }).length;
}
export function significativas(codigo: string): {
    t: string;
    i: number;
}[] {
    return codigo.split("\n").map((l, i) => ({ t: l.trim().replace(/\s+/g, " "), i })).filter(x => x.t && !/^[{}()[\];,]*$/.test(x.t) && !x.t.startsWith("//") && !/^(import|export \{)/.test(x.t));
}
export function duplicados(codigo: string): Olor[] {
    const crudas = codigo.split("\n");
    const lin = significativas(codigo);
    const K = UMBRAL.duplicado, vistos = new Map<string, number>(), out: Olor[] = [];
    let cubiertoHasta = -1;
    for (let a = 0; a + K <= lin.length; a++) {
        if (a <= cubiertoHasta)
            continue;
        const clave = lin.slice(a, a + K).map(x => x.t).join("\n");
        const previo = vistos.get(clave);
        if (previo === undefined || previo + K > a) {
            if (previo === undefined)
                vistos.set(clave, a);
            continue;
        }
        let k = K;
        while (a + k < lin.length && previo + k < a && lin[previo + k].t === lin[a + k].t)
            k++;
        out.push({ id: "duplicate", desde: lin[a].i + 1, hasta: lin[a + k - 1].i + 1, donde: crudas[lin[a].i].trim().slice(0, 50), n: k, extra: String(lin[previo].i + 1) });
        cubiertoHasta = a + k - 1;
    }
    return out;
}
export const EJEMPLO_OLORES = `class InvoiceService {
  static instance;
  static getInstance() {
    if (!InvoiceService.instance) InvoiceService.instance = new InvoiceService();
    return InvoiceService.instance;
  }

  createInvoice(customerName, customerEmail, street, city, zip, country, items) {
    const invoice = { customerName, customerEmail, street, city, zip, country, items, lines: [] };
    return invoice;
  }

  shippingCost(order) {
    switch (order.type) {
      case 'standard':
        return 4.99;
      case 'express':
        return 9.99;
      case 'pickup':
        return 0;
    }
  }

  label(order) {
    return order.customer.address.city.name.toUpperCase();
  }

  discount(order) {
    let d = 0;
    if (order.customer.vip) d += 10;
    if (order.customer.years > 5) d += 5;
    if (order.total > 100) d += 5;
    if (order.coupon) d += order.coupon.value;
    return d;
  }

  printSpain(invoice) {
    let out = '';
    out += 'Invoice for ' + invoice.customerName + '\\n';
    out += 'Address: ' + invoice.street + ', ' + invoice.city + '\\n';
    for (const l of invoice.lines) out += l.name + ' ' + l.price + '\\n';
    out += 'Thank you!';
    return out + ' (ES)';
  }

  printFrance(invoice) {
    let out = '';
    out += 'Invoice for ' + invoice.customerName + '\\n';
    out += 'Address: ' + invoice.street + ', ' + invoice.city + '\\n';
    for (const l of invoice.lines) out += l.name + ' ' + l.price + '\\n';
    out += 'Thank you!';
    return out + ' (FR)';
  }
}
`;
