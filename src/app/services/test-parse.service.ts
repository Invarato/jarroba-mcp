import { Injectable } from "@angular/core";
import type { Asercion, CasoPrueba, Fuerza, Lenguaje, MotivoInactivo, SuiteAnalizada, } from "./test-audit.model";
import { MARCADORES_INACTIVOS, NEUTRALES, nombreDialecto, vocabulario, vocabularioCondicionado, type Dialecto } from "./test-dialects";
import type { Parametro, TipoBase } from "./test-cases.service";
export const RUTA_GRAMATICAS = "tree-sitter/";
export type CargadorWasm = (fichero: string) => Promise<Uint8Array>;
interface NodoTS {
    type: string;
    text: string;
    startPosition: {
        row: number;
    };
    childCount: number;
    namedChildCount: number;
    hasError: boolean;
    child(i: number): NodoTS | null;
    namedChild(i: number): NodoTS | null;
    childForFieldName(n: string): NodoTS | null;
}
interface ReglasLenguaje {
    llamada: string[];
    contenedorCaso: string[];
    extensiones: string[];
}
const REGLAS: Record<Lenguaje, ReglasLenguaje> = {
    typescript: { llamada: ["call_expression"], contenedorCaso: ["call_expression"], extensiones: [".ts", ".tsx", ".mts", ".cts"] },
    javascript: { llamada: ["call_expression"], contenedorCaso: ["call_expression"], extensiones: [".js", ".mjs", ".cjs", ".jsx"] },
    python: { llamada: ["call"], contenedorCaso: ["decorated_definition", "function_definition"], extensiones: [".py"] },
    java: { llamada: ["method_invocation"], contenedorCaso: ["method_declaration"], extensiones: [".java"] },
    go: { llamada: ["call_expression"], contenedorCaso: ["function_declaration"], extensiones: [".go"] },
};
export const GRAMATICAS: Record<Lenguaje, {
    fichero: string;
    kbGz: number;
}> = {
    typescript: { fichero: "tree-sitter-typescript.wasm", kbGz: 139 },
    javascript: { fichero: "tree-sitter-javascript.wasm", kbGz: 51 },
    python: { fichero: "tree-sitter-python.wasm", kbGz: 68 },
    java: { fichero: "tree-sitter-java.wasm", kbGz: 52 },
    go: { fichero: "tree-sitter-go.wasm", kbGz: 40 },
};
const NEUTRAL = new Set(NEUTRALES);
const PARECE_ASERCION = /^(and|then|or|will|also)?(expect|assert|check|verify|should|must|ensure|validate|compare|comprob|comprueb|verific|asegur|afirm|valida)/i;
@Injectable({ providedIn: "root" })
export class TestParseService {
    private motor: any = null;
    private lenguajesCargados = new Map<Lenguaje, unknown>();
    yaCargado(l: Lenguaje): boolean {
        return this.lenguajesCargados.has(l);
    }
    static lenguajePorExtension(nombreFichero: string): Lenguaje | null {
        const punto = nombreFichero.lastIndexOf(".");
        if (punto < 0)
            return null;
        const ext = nombreFichero.slice(punto).toLowerCase();
        for (const [l, r] of Object.entries(REGLAS)) {
            if (r.extensiones.includes(ext))
                return l as Lenguaje;
        }
        return null;
    }
    async init(mod: any, cargador: CargadorWasm, localizarMotor?: () => string): Promise<void> {
        if (this.motor)
            return;
        await mod.Parser.init({
            locateFile: localizarMotor ?? (() => `${RUTA_GRAMATICAS}web-tree-sitter.wasm`),
        });
        this.motor = mod;
        this.cargador = cargador;
    }
    private cargador: CargadorWasm | null = null;
    async cargarLenguaje(l: Lenguaje): Promise<unknown> {
        const ya = this.lenguajesCargados.get(l);
        if (ya)
            return ya;
        if (!this.motor || !this.cargador)
            throw new Error("TestParseService: init() no se ha llamado");
        const bytes = await this.cargador(GRAMATICAS[l].fichero);
        const lang = await this.motor.Language.load(bytes);
        this.lenguajesCargados.set(l, lang);
        return lang;
    }
    async extraerFirmas(codigo: string, lenguaje: Lenguaje): Promise<Firma[]> {
        if (lenguaje !== "typescript" && lenguaje !== "javascript")
            return [];
        const lang = await this.cargarLenguaje(lenguaje);
        const parser = new this.motor.Parser();
        parser.setLanguage(lang);
        const arbol = parser.parse(codigo);
        try {
            return firmasDe(arbol.rootNode as NodoTS);
        }
        finally {
            parser.delete?.();
        }
    }
    async analizar(codigo: string, lenguaje: Lenguaje, dialectosExtra: readonly Dialecto[] = []): Promise<SuiteAnalizada> {
        const lang = await this.cargarLenguaje(lenguaje);
        const parser = new this.motor.Parser();
        parser.setLanguage(lang);
        const arbol = parser.parse(codigo);
        try {
            return analizarArbol(arbol.rootNode as NodoTS, codigo, lenguaje, dialectosExtra);
        }
        finally {
            parser.delete?.();
        }
    }
}
export function analizarArbol(raiz: NodoTS, codigo: string, lenguaje: Lenguaje, dialectosExtra: readonly Dialecto[] = []): SuiteAnalizada {
    const vocab = vocabulario(lenguaje, dialectosExtra);
    const condicionadas = vocabularioCondicionado(lenguaje, dialectosExtra);
    const reglas = REGLAS[lenguaje];
    const marcadores = MARCADORES_INACTIVOS[lenguaje];
    const helpers = indexarHelpers(raiz, reglas);
    const importadosDePruebas = importesDePruebas(raiz, lenguaje);
    const junit3 = lenguaje === "java" && /\bextends\s+TestCase\b|\bjunit\.framework\b/.test(codigo);
    const casos: CasoPrueba[] = [];
    let erroresParseo = 0;
    const recorre = (n: NodoTS): void => {
        if (n.type === "ERROR")
            erroresParseo++;
        const caso = intentarCaso(n);
        if (caso) {
            casos.push(caso);
            return;
        }
        for (let i = 0; i < n.childCount; i++) {
            const h = n.child(i);
            if (h)
                recorre(h);
        }
    };
    function intentarCaso(n: NodoTS): CasoPrueba | null {
        if (!reglas.contenedorCaso.includes(n.type))
            return null;
        const id = identificarCaso(n, lenguaje, marcadores, junit3);
        if (!id)
            return null;
        const cabezas = new Set<string>();
        const acumulado = { aserciones: [] as Asercion[], llamadas: [] as string[], sospechosas: [] as string[] };
        recogerDe(id.cuerpo ?? n, acumulado, new Set<string>(), cabezas);
        if (lenguaje === "go" && /^Example/.test(id.nombre) && /\/\/\s*(Unordered\s+)?[Oo]utput\s*:/.test(n.text)) {
            acumulado.aserciones.push({
                nombre: "// Output:",
                fuerza: "exacta",
                linea: n.startPosition.row + 1,
                texto: "// Output: \u2026",
            });
        }
        return {
            nombre: id.nombre,
            lenguaje,
            linea: n.startPosition.row + 1,
            inactivo: id.inactivo,
            marcadorInactivo: id.marcador,
            aserciones: acumulado.aserciones,
            llamadas: [...new Set(acumulado.llamadas)],
            noResueltas: [...new Set(acumulado.sospechosas)],
        };
    }
    function recogerDe(n: NodoTS, acc: {
        aserciones: Asercion[];
        llamadas: string[];
        sospechosas: string[];
    }, visitados: Set<string>, cabezas: Set<string> = new Set(), dentroDeRama = false): void {
        if (lenguaje === "python" && n.type === "assert_statement") {
            acc.aserciones.push({
                nombre: "assert",
                fuerza: fuerzaDeAssertPython(n),
                linea: n.startPosition.row + 1,
                texto: recortar(n.text),
                condicional: dentroDeRama,
            });
        }
        if (lenguaje === "java" && n.type === "try_statement" && esperaExcepcionConFail(n)) {
            acc.aserciones.push({
                nombre: "try/fail/catch",
                fuerza: "parcial",
                linea: n.startPosition.row + 1,
                texto: recortar(n.text),
                condicional: dentroDeRama,
            });
        }
        if (reglas.llamada.includes(n.type)) {
            const cabeza = baseDeCadena(n);
            if (cabeza)
                cabezas.add(cabeza);
            const nombre = nombreDeLlamada(n, lenguaje);
            if (nombre) {
                acc.llamadas.push(nombre);
                const cond = cabeza ? condicionadas.get(nombre)?.find((c) => c.cabezas.has(cabeza)) : undefined;
                let fuerza = vocab.get(nombre) ?? cond?.fuerza;
                if (LANZA_SIN_DECIR.has(nombre) && (n.childForFieldName("arguments")?.namedChildCount ?? 0) === 0) {
                    fuerza = "debil";
                }
                if (lenguaje === "python" && VERACIDAD_PY.has(nombre)) {
                    const arg = sinParentesis(n.childForFieldName("arguments")?.namedChild(0) ?? null);
                    if (arg)
                        fuerza = fuerzaDeVeracidadPython(arg);
                }
                if (!fuerza && NEUTRAL.has(nombre)) {
                }
                else if (!fuerza && lenguaje === "go" && delegaFueraEnGo(n, nombre, cabeza)) {
                    acc.sospechosas.push(nombre);
                }
                else if (!fuerza && cabeza && vocab.get(cabeza) === "llamada") {
                    const args = n.childForFieldName("arguments");
                    if ((args?.namedChildCount ?? 0) > 0) {
                        acc.aserciones.push({
                            nombre: `${cabeza}(…).${nombre}`,
                            fuerza: "exacta",
                            linea: n.startPosition.row + 1,
                            texto: recortar(n.text),
                            condicional: dentroDeRama,
                        });
                    }
                }
                else if (!fuerza && cabeza && PARECE_ASERCION.test(cabeza)) {
                    acc.sospechosas.push(nombre);
                }
                else if (fuerza) {
                    acc.aserciones.push({
                        nombre,
                        fuerza,
                        linea: n.startPosition.row + 1,
                        texto: recortar(n.text),
                        condicional: dentroDeRama,
                    });
                }
                else if (helpers.has(nombre) && !visitados.has(nombre)) {
                    visitados.add(nombre);
                    const cuerpo = helpers.get(nombre)!;
                    const antes = acc.aserciones.length;
                    recogerDe(cuerpo, acc, visitados, new Set(), dentroDeRama);
                    if (acc.aserciones.length === antes && (lanza(cuerpo) || PARECE_ASERCION.test(nombre))) {
                        acc.sospechosas.push(nombre);
                    }
                }
                else if (!helpers.has(nombre) && !cabezas.has(nombre) && esSospechosa(nombre, importadosDePruebas)) {
                    acc.sospechosas.push(nombre);
                }
            }
        }
        const activaRama = dentroDeRama || esRamaReal(n, lenguaje);
        for (let i = 0; i < n.childCount; i++) {
            const h = n.child(i);
            if (h)
                recogerDe(h, acc, visitados, cabezas, activaRama);
        }
    }
    for (let i = 0; i < raiz.childCount; i++) {
        const h = raiz.child(i);
        if (h)
            recorre(h);
    }
    return { lenguaje, dialecto: nombreDialecto(lenguaje), casos, erroresParseo };
}
function esSospechosa(nombre: string, deMaquinaria: ReadonlySet<string>): boolean {
    return PARECE_ASERCION.test(nombre) || deMaquinaria.has(nombre);
}
function identificarCaso(n: NodoTS, lenguaje: Lenguaje, marcadores: readonly {
    patron: RegExp;
    motivo: MotivoInactivo;
}[], junit3 = false): {
    nombre: string;
    inactivo: MotivoInactivo | null;
    marcador?: string;
    cuerpo?: NodoTS;
} | null {
    if (lenguaje === "typescript" || lenguaje === "javascript") {
        const fn = n.childForFieldName("function");
        if (!fn)
            return null;
        const llamado = fn.text;
        const esTest = /^(it|test|fit|xit|xtest|specify)$/.test(llamado)
            || /^(it|test|specify)\.(skip|only|todo|failing|each|concurrent|sequential)$/.test(llamado);
        if (!esTest)
            return null;
        const args = n.childForFieldName("arguments");
        const cuerpo = cuerpoDeCallback(args);
        if (!cuerpo && (args?.namedChildCount ?? 0) > 1)
            return null;
        const primero = args?.namedChild(0);
        const nombre = primero ? despresentar(primero.text) : "(sin nombre)";
        const m = marcadores.find((x) => x.patron.test(llamado));
        if (m)
            return { nombre, inactivo: m.motivo, marcador: llamado, cuerpo: cuerpo ?? n };
        const opciones = opcionesDe(args);
        if (opciones) {
            return {
                nombre,
                inactivo: opciones,
                cuerpo: cuerpo ?? n,
                marcador: opciones === "pendiente" ? "{ todo: true }" : "{ skip: true }",
            };
        }
        return { nombre, inactivo: null, cuerpo: cuerpo ?? n };
    }
    if (lenguaje === "python") {
        const esDecorado = n.type === "decorated_definition";
        const fn = esDecorado ? hijoDeTipo(n, "function_definition") : n;
        if (!fn)
            return null;
        const nom = fn.childForFieldName("name")?.text;
        if (!nom || !/^test/i.test(nom))
            return null;
        const dec = esDecorado ? decoradoresPython(n) : [];
        const m = marcadores.find((x) => dec.some((d) => x.patron.test(d)));
        const cuerpo = fn.childForFieldName("body") ?? fn;
        const primera = cuerpo.namedChild(0);
        const saltaAlEmpezar = !!primera && /^(pytest\.skip|self\.skipTest|unittest\.skip)\s*\(/.test(primera.text.trim());
        return {
            nombre: nom,
            inactivo: m ? m.motivo : (saltaAlEmpezar ? "skip" : null),
            marcador: m ? `@${dec.find((d) => m.patron.test(d))}` : (saltaAlEmpezar ? "pytest.skip()" : undefined),
            cuerpo,
        };
    }
    const nombreNodo = n.childForFieldName("name")?.text;
    if (!nombreNodo)
        return null;
    if (lenguaje === "java") {
        const anot = anotacionesJava(n);
        const esTest = anot.some((a) => /^(Test|ParameterizedTest|RepeatedTest|TestFactory|TestTemplate)$/.test(a))
            || (junit3 && /^test/i.test(nombreNodo));
        if (!esTest)
            return null;
        const m = marcadores.find((x) => anot.some((a) => x.patron.test(a)));
        return { nombre: nombreNodo, inactivo: m ? m.motivo : null, marcador: m ? anot.find((a) => m.patron.test(a)) : undefined };
    }
    if (lenguaje === "go") {
        if (!/^(Test|Fuzz|Example)/.test(nombreNodo))
            return null;
        if (/^Example/.test(nombreNodo) && !/\/\/\s*(Unordered\s+)?[Oo]utput\s*:/.test(n.text))
            return null;
        const saltado = /\bt\.Skip(Now|f)?\s*\(/.test(n.text);
        return { nombre: nombreNodo, inactivo: saltado ? "skip" : null, marcador: saltado ? "t.Skip" : undefined };
    }
    return null;
}
const VERACIDAD_PY = new Set(["assert_", "assertTrue", "assertFalse"]);
function fuerzaDeAssertPython(n: NodoTS): Fuerza {
    const cond = sinParentesis(n.namedChild(0));
    if (!cond)
        return "debil";
    return fuerzaDeVeracidadPython(cond);
}
const LLAMADA_BOOL_PY = new Set([
    "isinstance",
    "issubclass",
    "hasattr",
    "callable",
    "startswith",
    "endswith",
    "isdigit",
    "isalpha",
    "isalnum",
    "isspace",
    "isupper",
    "islower",
    "istitle",
    "isnumeric",
    "isdecimal",
    "isidentifier",
]);
const BUILTIN_REDUCTOR_BOOL = new Set(["all", "any"]);
const RE_NOMBRE_PREDICADO_PY = /^(is|has|should|can)_\w+$|(_allowed|_valid)$|^matches$/;
function esLlamadaPredicadoPython(n: NodoTS): boolean {
    if (n.type !== "call")
        return false;
    const f = n.childForFieldName("function");
    if (!f)
        return false;
    const esMetodo = f.type === "attribute";
    const nombre = (esMetodo ? f.childForFieldName("attribute")?.text : f.text) ?? null;
    if (!nombre)
        return false;
    if (BUILTIN_REDUCTOR_BOOL.has(nombre)) {
        if (!esMetodo)
            return true;
        const args = n.childForFieldName("arguments");
        return (args?.namedChildCount ?? 0) === 0;
    }
    return LLAMADA_BOOL_PY.has(nombre) || RE_NOMBRE_PREDICADO_PY.test(nombre);
}
function fuerzaDeVeracidadPython(cond: NodoTS): Fuerza {
    let expr = sinParentesis(cond);
    if (!expr)
        return "debil";
    if (expr.type === "not_operator") {
        const interior = sinParentesis(expr.namedChild(0));
        if (interior && esLlamadaPredicadoPython(interior))
            return "exacta";
        return "debil";
    }
    if (expr.type === "comparison_operator")
        return fuerzaDeComparacionPython(expr);
    if (esLlamadaPredicadoPython(expr))
        return "exacta";
    return "debil";
}
function sinParentesis(n: NodoTS | null): NodoTS | null {
    let actual = n;
    let vueltas = 0;
    while (actual && actual.type === "parenthesized_expression" && vueltas++ < 10) {
        actual = actual.namedChild(0);
    }
    return actual;
}
function fuerzaDeComparacionPython(cond: NodoTS): Fuerza {
    const t = cond.text;
    if (/\s(==|!=)\s/.test(t))
        return "exacta";
    if (/\s(not\s+in|in|is\s+not|is)\s/.test(t))
        return "parcial";
    if (/\s(<=|>=|<|>)\s/.test(t))
        return "umbral";
    return "exacta";
}
function decoradoresPython(n: NodoTS): string[] {
    const out: string[] = [];
    for (let i = 0; i < n.childCount; i++) {
        const h = n.child(i);
        if (h?.type !== "decorator")
            continue;
        const m = h.text.match(/^@\s*([\w.]+)/);
        if (m)
            out.push(m[1]);
    }
    return out;
}
function opcionesDe(args: NodoTS | null): MotivoInactivo | null {
    if (!args)
        return null;
    for (let i = 0; i < args.childCount; i++) {
        const h = args.child(i);
        if (h?.type !== "object")
            continue;
        const t = h.text.replace(/\s+/g, "");
        if (/[{,]skip:true[,}]/.test(t))
            return "skip";
        if (/[{,]todo:true[,}]/.test(t))
            return "pendiente";
    }
    return null;
}
function cuerpoDeCallback(args: NodoTS | null): NodoTS | null {
    if (!args)
        return null;
    const FUNCIONES = new Set(["arrow_function", "function_expression", "function"]);
    for (let i = args.childCount - 1; i >= 0; i--) {
        const h = args.child(i);
        if (h && FUNCIONES.has(h.type))
            return h;
    }
    return null;
}
function hijoDeTipo(n: NodoTS, tipo: string): NodoTS | null {
    for (let i = 0; i < n.childCount; i++) {
        const h = n.child(i);
        if (h?.type === tipo)
            return h;
    }
    return null;
}
function anotacionesJava(n: NodoTS): string[] {
    const out: string[] = [];
    for (let i = 0; i < n.childCount; i++) {
        const h = n.child(i);
        if (!h)
            continue;
        if (h.type === "modifiers") {
            for (const x of h.text.matchAll(/@(\w+)/g))
                out.push(x[1]);
        }
    }
    return out;
}
function nombreDeLlamada(n: NodoTS, lenguaje: Lenguaje): string | null {
    const campo = lenguaje === "java" ? "name" : "function";
    const fn = n.childForFieldName(campo);
    if (!fn)
        return null;
    const miembro = fn.childForFieldName("property") ?? fn.childForFieldName("field")
        ?? fn.childForFieldName("attribute") ?? fn.childForFieldName("name");
    const t = (miembro ?? fn).text;
    const seg = (t.split(".").pop() ?? t).trim();
    return /^[A-Za-z_$][\w$]*$/.test(seg) ? seg : null;
}
function indexarHelpers(raiz: NodoTS, reglas: ReglasLenguaje): Map<string, NodoTS> {
    const m = new Map<string, NodoTS>();
    const tipos = new Set(["function_declaration", "function_definition", "method_declaration"]);
    const FUNCIONES = new Set(["arrow_function", "function_expression", "function", "lambda"]);
    const walk = (n: NodoTS): void => {
        if (tipos.has(n.type)) {
            const nom = n.childForFieldName("name")?.text;
            if (nom && !m.has(nom))
                m.set(nom, n);
        }
        else if (n.type === "variable_declarator") {
            const nom = n.childForFieldName("name")?.text;
            const val = n.childForFieldName("value");
            if (nom && val && FUNCIONES.has(val.type) && !m.has(nom))
                m.set(nom, n);
        }
        for (let i = 0; i < n.childCount; i++) {
            const h = n.child(i);
            if (h)
                walk(h);
        }
    };
    walk(raiz);
    for (const t of reglas.contenedorCaso)
        void t;
    return m;
}
const RUTA_DE_PRUEBAS = /(^|[\/.])(tests?|specs?|helpers?|fixtures?|assert|ayudas?|pruebas?|mocks?|stubs?|fakes?|dobles?|soporte)([\/.]|$)/i;
function importesDePruebas(raiz: NodoTS, lenguaje: Lenguaje): Set<string> {
    const out = new Set<string>();
    const texto = raiz.text;
    const anota = (lista: string, sep = ",") => {
        for (const parte of lista.split(sep)) {
            const nom = parte.trim().split(/\s+as\s+|:/).pop()?.trim();
            if (nom && /^[A-Za-z_$][\w$]*$/.test(nom))
                out.add(nom);
        }
    };
    if (lenguaje === "typescript" || lenguaje === "javascript") {
        for (const m of texto.matchAll(/import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]/g)) {
            if (RUTA_DE_PRUEBAS.test(m[2]))
                anota(m[1]);
        }
        for (const m of texto.matchAll(/import\s+([A-Za-z_$][\w$]*)\s+from\s*['"]([^'"]+)['"]/g)) {
            if (RUTA_DE_PRUEBAS.test(m[2]))
                out.add(m[1]);
        }
        for (const m of texto.matchAll(/(?:const|let|var)\s*\{([^}]+)\}\s*=\s*require\(\s*['"]([^'"]+)['"]/g)) {
            if (RUTA_DE_PRUEBAS.test(m[2]))
                anota(m[1]);
        }
        for (const m of texto.matchAll(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*require\(\s*['"]([^'"]+)['"]/g)) {
            if (RUTA_DE_PRUEBAS.test(m[2]))
                out.add(m[1]);
        }
        for (const f of [...out]) {
            for (const m of texto.matchAll(new RegExp(`\\{([^}]+)\\}\\s*(?:of|=)\\s*${f}\\s*\\(`, "g"))) {
                anota(m[1]);
            }
        }
    }
    else if (lenguaje === "python") {
        for (const m of texto.matchAll(/from\s+([\w.]+)\s+import\s+([^\n#]+)/g)) {
            if (RUTA_DE_PRUEBAS.test(m[1]))
                anota(m[2]);
        }
    }
    return out;
}
function baseDeCadena(n: NodoTS): string | null {
    let actual = n.childForFieldName("function") ?? n.childForFieldName("object");
    let vueltas = 0;
    while (actual && vueltas++ < 20) {
        if (actual.type.includes("call") || actual.type === "method_invocation") {
            const f = actual.childForFieldName("function") ?? actual.childForFieldName("name");
            const t = f?.text;
            return t && /^[A-Za-z_$][\w$]*$/.test(t) ? t : null;
        }
        const siguiente = actual.childForFieldName("object") ?? actual.childForFieldName("operand");
        if (!siguiente) {
            if (vueltas <= 1)
                return null;
            const t = actual.type === "identifier" ? actual.text : null;
            return t && /^[A-Za-z_$][\w$]*$/.test(t) ? t : null;
        }
        actual = siguiente;
    }
    return null;
}
const LANZA_SIN_DECIR = new Set(["toThrow", "toThrowError", "throws", "rejects"]);
const VARIABLES_TEST_GO = new Set(["t", "tb", "b", "f", "tt"]);
function delegaFueraEnGo(n: NodoTS, nombre: string, cabeza: string | null): boolean {
    const args = n.childForFieldName("arguments");
    if (!args)
        return false;
    if (nombre === "Run" && cabeza && VARIABLES_TEST_GO.has(cabeza)) {
        const cb = args.namedChild(1);
        return !!cb && cb.type !== "func_literal";
    }
    const primero = args.namedChild(0);
    return !!primero && primero.type === "identifier" && VARIABLES_TEST_GO.has(primero.text);
}
const RAMA_REAL = new Set([
    "if_statement",
    "while_statement",
    "do_statement",
    "switch_statement",
    "switch_expression",
]);
function esRamaReal(n: NodoTS, lenguaje: Lenguaje): boolean {
    if (!RAMA_REAL.has(n.type))
        return false;
    if (lenguaje === "go" && n.type === "if_statement" && !n.childForFieldName("alternative") && esGuardaDeReporte(n))
        return false;
    return true;
}
function esGuardaDeReporte(n: NodoTS): boolean {
    const cuerpo = n.childForFieldName("consequence");
    if (!cuerpo)
        return false;
    let soloReporta = true;
    const mira = (h: NodoTS): void => {
        if (h.type === "call_expression") {
            const f = h.childForFieldName("function");
            const nombre = f?.type === "selector_expression" ? f.childForFieldName("field")?.text : f?.text;
            if (!/^(Error|Errorf|Fatal|Fatalf|Skip|SkipNow|Skipf)$/.test(nombre ?? ""))
                soloReporta = false;
        }
        for (let i = 0; i < h.childCount; i++) {
            const k = h.child(i);
            if (k)
                mira(k);
        }
    };
    mira(cuerpo);
    return soloReporta;
}
function esperaExcepcionConFail(n: NodoTS): boolean {
    const cuerpo = n.childForFieldName("body");
    if (!cuerpo || !/\bfail\s*\(/.test(cuerpo.text))
        return false;
    for (let i = 0; i < n.childCount; i++) {
        if (n.child(i)?.type === "catch_clause")
            return true;
    }
    return false;
}
function lanza(n: NodoTS): boolean {
    if (n.type === "throw_statement" || n.type === "raise_statement")
        return true;
    for (let i = 0; i < n.childCount; i++) {
        const h = n.child(i);
        if (h && lanza(h))
            return true;
    }
    return false;
}
function despresentar(s: string): string {
    return s.replace(/^['"`]|['"`]$/g, "");
}
function recortar(s: string): string {
    const una = s.replace(/\s+/g, " ").trim();
    return una.length > 120 ? `${una.slice(0, 117)}…` : una;
}
export interface Firma {
    nombre: string;
    parametros: Parametro[];
    linea: number;
}
export function firmasDe(raiz: NodoTS): Firma[] {
    const out: Firma[] = [];
    const walk = (n: NodoTS): void => {
        if (n.type === "function_declaration" || n.type === "method_definition" || n.type === "function_signature") {
            const nombre = n.childForFieldName("name")?.text;
            const params = n.childForFieldName("parameters");
            if (nombre && params)
                out.push({ nombre, parametros: parametrosDe(params), linea: n.startPosition.row + 1 });
        }
        for (let i = 0; i < n.childCount; i++) {
            const h = n.child(i);
            if (h)
                walk(h);
        }
    };
    walk(raiz);
    return out;
}
function parametrosDe(params: NodoTS): Parametro[] {
    const out: Parametro[] = [];
    for (let i = 0; i < params.childCount; i++) {
        const p = params.child(i);
        if (!p)
            continue;
        if (!/parameter|pattern/.test(p.type))
            continue;
        const nombre = (p.childForFieldName("pattern") ?? p.childForFieldName("name"))?.text
            ?? p.text.split(/[:?=]/)[0].trim();
        if (!nombre || !/^[A-Za-z_$][\w$]*$/.test(nombre))
            continue;
        const anot = p.childForFieldName("type")?.text.replace(/^:\s*/, "") ?? "";
        const opcional = p.text.includes("?:") || /\b(null|undefined)\b/.test(anot);
        out.push({ nombre, ...tipoDeAnotacion(anot), opcional });
    }
    return out;
}
function tipoDeAnotacion(anot: string): {
    tipo: TipoBase;
    valores?: string[];
} {
    const t = anot.replace(/\s+/g, " ").trim();
    if (!t)
        return { tipo: "desconocido" };
    const partes = t.split("|").map((x) => x.trim()).filter((x) => !/^(null|undefined)$/.test(x));
    if (partes.length > 1 && partes.every((x) => /^['"`].*['"`]$/.test(x))) {
        return { tipo: "enum", valores: partes.map((x) => x.slice(1, -1)) };
    }
    const uno = partes.length === 1 ? partes[0] : t;
    if (/\[\]$/.test(uno) || /^(Array|ReadonlyArray)</.test(uno) || /^(Set|Map)</.test(uno))
        return { tipo: "lista" };
    if (/^number$/.test(uno))
        return { tipo: "decimal" };
    if (/^bigint$/.test(uno))
        return { tipo: "entero" };
    if (/^string$/.test(uno))
        return { tipo: "texto" };
    if (/^boolean$/.test(uno))
        return { tipo: "booleano" };
    if (/^(object|Record<|\{)/.test(uno))
        return { tipo: "objeto" };
    return { tipo: "desconocido" };
}
