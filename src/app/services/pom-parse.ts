const MAX_XML = 4000000;
const MAX_HONDO = 100;
const MAX_INTERPOLA = 20;
export interface NodoXml {
    nombre: string;
    texto: string;
    hijos: NodoXml[];
    linea?: number;
}
const ENTIDADES: Record<string, string> = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: "\"",
    apos: "'",
    nbsp: "\u00A0",
};
export function decodificarEntidades(s: string): string {
    const t = typeof s === "string" ? s : "";
    if (t.indexOf("&") < 0)
        return t;
    return t.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (todo, cuerpo: string) => {
        if (cuerpo[0] === "#") {
            const hex = cuerpo[1] === "x" || cuerpo[1] === "X";
            const n = parseInt(hex ? cuerpo.slice(2) : cuerpo.slice(1), hex ? 16 : 10);
            if (!Number.isFinite(n) || n < 0 || n > 1114111)
                return todo;
            try {
                return String.fromCodePoint(n);
            }
            catch {
                return todo;
            }
        }
        return ENTIDADES[cuerpo] ?? todo;
    });
}
export function leerXml(fuente: string): NodoXml | null {
    const src = typeof fuente === "string" ? fuente.slice(0, MAX_XML) : "";
    let raiz: NodoXml | null = null;
    const pila: NodoXml[] = [];
    let i = 0;
    let linea = 1;
    let contadoHasta = 0;
    const lineaEn = (pos: number): number => {
        for (let k = contadoHasta; k < pos; k++)
            if (src.charCodeAt(k) === 10)
                linea++;
        contadoHasta = Math.max(contadoHasta, pos);
        return linea;
    };
    const cima = (): NodoXml | undefined => pila[pila.length - 1];
    while (i < src.length) {
        const lt = src.indexOf("<", i);
        if (lt < 0) {
            const c = cima();
            if (c)
                c.texto += src.slice(i);
            break;
        }
        if (lt > i) {
            const c = cima();
            if (c)
                c.texto += src.slice(i, lt);
        }
        if (src.startsWith("<!--", lt)) {
            const fin = src.indexOf("-->", lt + 4);
            i = fin < 0 ? src.length : fin + 3;
            continue;
        }
        if (src.startsWith("<![CDATA[", lt)) {
            const fin = src.indexOf("]]>", lt + 9);
            const c = cima();
            if (c)
                c.texto += src.slice(lt + 9, fin < 0 ? src.length : fin);
            i = fin < 0 ? src.length : fin + 3;
            continue;
        }
        if (src.startsWith("<?", lt)) {
            const fin = src.indexOf("?>", lt + 2);
            i = fin < 0 ? src.length : fin + 2;
            continue;
        }
        if (src.startsWith("<!", lt)) {
            const fin = src.indexOf(">", lt + 2);
            i = fin < 0 ? src.length : fin + 1;
            continue;
        }
        const gt = src.indexOf(">", lt + 1);
        if (gt < 0)
            break;
        const bruto = src.slice(lt + 1, gt).trim();
        i = gt + 1;
        if (!bruto)
            continue;
        if (bruto[0] === "/") {
            const nombre = limpiarNombre(bruto.slice(1));
            for (let k = pila.length - 1; k >= 0; k--) {
                if (pila[k].nombre === nombre) {
                    pila.length = k;
                    break;
                }
            }
            continue;
        }
        const auto = bruto.endsWith("/");
        const nombre = limpiarNombre(auto ? bruto.slice(0, -1) : bruto);
        if (!nombre)
            continue;
        const nodo: NodoXml = { nombre, texto: "", hijos: [], linea: lineaEn(lt) };
        const padre = cima();
        if (padre)
            padre.hijos.push(nodo);
        else if (!raiz)
            raiz = nodo;
        else
            continue;
        if (!auto && pila.length < MAX_HONDO)
            pila.push(nodo);
    }
    return raiz;
}
function limpiarNombre(bruto: string): string {
    const primero = bruto.trim().split(/[\s/]/)[0] ?? "";
    const dosp = primero.lastIndexOf(":");
    return (dosp >= 0 ? primero.slice(dosp + 1) : primero).trim();
}
export function hijo(nodo: NodoXml | null, nombre: string): NodoXml | null {
    if (!nodo)
        return null;
    for (const h of nodo.hijos)
        if (h.nombre === nombre)
            return h;
    return null;
}
export function hijos(nodo: NodoXml | null, nombre: string): NodoXml[] {
    if (!nodo)
        return [];
    return nodo.hijos.filter(h => h.nombre === nombre);
}
export function textoDe(nodo: NodoXml | null, nombre: string): string {
    const h = hijo(nodo, nombre);
    return h ? decodificarEntidades(h.texto).trim() : "";
}
export type OrigenVersion = "literal" | "propiedad" | "gestionada" | "desconocida";
export interface Coordenada {
    grupo: string;
    artefacto: string;
    version: string;
}
export interface DependenciaPom {
    grupo: string;
    artefacto: string;
    version: string;
    versionCruda: string;
    origen: OrigenVersion;
    ambito: string;
    opcional: boolean;
    esRango: boolean;
}
export interface ProyectoPom {
    coord: Coordenada;
    padre: Coordenada | null;
    propiedades: Record<string, string>;
    dependencias: DependenciaPom[];
    gestionadas: DependenciaPom[];
    bomsImportados: Coordenada[];
    modulos: string[];
}
function propiedadesImplicitas(coord: Coordenada, padre: Coordenada | null): Record<string, string> {
    const m: Record<string, string> = {};
    if (coord.version) {
        m["project.version"] = coord.version;
        m["pom.version"] = coord.version;
        m["version"] = coord.version;
    }
    if (coord.grupo) {
        m["project.groupId"] = coord.grupo;
        m["pom.groupId"] = coord.grupo;
    }
    if (coord.artefacto) {
        m["project.artifactId"] = coord.artefacto;
        m["pom.artifactId"] = coord.artefacto;
    }
    if (padre?.version)
        m["project.parent.version"] = padre.version;
    if (padre?.grupo)
        m["project.parent.groupId"] = padre.grupo;
    return m;
}
export function interpolar(valor: string, props: Record<string, string>): string {
    let v = typeof valor === "string" ? valor : "";
    for (let vuelta = 0; vuelta < MAX_INTERPOLA && v.includes("${"); vuelta++) {
        const antes = v;
        v = v.replace(/\$\{([^{}]*)\}/g, (todo, clave: string) => {
            const val = props[clave.trim()];
            return typeof val === "string" ? val : todo;
        });
        if (v === antes)
            break;
    }
    return v;
}
export function esRangoDeVersion(v: string): boolean {
    const s = typeof v === "string" ? v.trim() : "";
    return /^[[(].*[\])]$/.test(s);
}
function leerDependencia(n: NodoXml, props: Record<string, string>): DependenciaPom {
    const cruda = textoDe(n, "version");
    const resuelta = interpolar(cruda, props);
    const rango = esRangoDeVersion(resuelta);
    let origen: OrigenVersion;
    if (!cruda)
        origen = "desconocida";
    else if (resuelta.includes("${"))
        origen = "desconocida";
    else
        origen = cruda.includes("${") ? "propiedad" : "literal";
    return {
        grupo: interpolar(textoDe(n, "groupId"), props),
        artefacto: interpolar(textoDe(n, "artifactId"), props),
        version: origen === "desconocida" ? "" : resuelta,
        versionCruda: cruda,
        origen,
        ambito: textoDe(n, "scope") || "compile",
        opcional: textoDe(n, "optional").toLowerCase() === "true",
        esRango: rango,
    };
}
export function leerPom(xml: string): ProyectoPom | null {
    let raiz: NodoXml | null = null;
    try {
        raiz = leerXml(xml);
    }
    catch {
        return null;
    }
    if (!raiz || raiz.nombre !== "project")
        return null;
    const nPadre = hijo(raiz, "parent");
    const padre: Coordenada | null = nPadre ? {
        grupo: textoDe(nPadre, "groupId"),
        artefacto: textoDe(nPadre, "artifactId"),
        version: textoDe(nPadre, "version"),
    } : null;
    const coord: Coordenada = {
        grupo: textoDe(raiz, "groupId") || padre?.grupo || "",
        artefacto: textoDe(raiz, "artifactId"),
        version: textoDe(raiz, "version") || padre?.version || "",
    };
    const crudas: Record<string, string> = {};
    const nProps = hijo(raiz, "properties");
    if (nProps)
        for (const p of nProps.hijos)
            crudas[p.nombre] = decodificarEntidades(p.texto).trim();
    const base = { ...crudas, ...propiedadesImplicitas(coord, padre) };
    const propiedades: Record<string, string> = {};
    for (const k of Object.keys(base))
        propiedades[k] = interpolar(base[k], base);
    const nDeps = hijo(raiz, "dependencies");
    const dependencias = hijos(nDeps, "dependency").map(d => leerDependencia(d, propiedades));
    const nGest = hijo(hijo(raiz, "dependencyManagement"), "dependencies");
    const gestionadas = hijos(nGest, "dependency").map(d => leerDependencia(d, propiedades));
    const bomsImportados: Coordenada[] = [];
    for (const d of hijos(nGest, "dependency")) {
        if (textoDe(d, "type") === "pom" && textoDe(d, "scope") === "import") {
            bomsImportados.push({
                grupo: interpolar(textoDe(d, "groupId"), propiedades),
                artefacto: interpolar(textoDe(d, "artifactId"), propiedades),
                version: interpolar(textoDe(d, "version"), propiedades),
            });
        }
    }
    const porClave = new Map<string, DependenciaPom>();
    for (const g of gestionadas)
        porClave.set(`${g.grupo}:${g.artefacto}`, g);
    for (const d of dependencias) {
        if (d.origen !== "desconocida")
            continue;
        const g = porClave.get(`${d.grupo}:${d.artefacto}`);
        if (g && g.origen !== "desconocida" && g.version) {
            d.version = g.version;
            d.origen = "gestionada";
            d.esRango = g.esRango;
        }
    }
    return {
        coord,
        padre,
        propiedades,
        dependencias,
        gestionadas,
        bomsImportados,
        modulos: hijos(hijo(raiz, "modules"), "module").map(m => decodificarEntidades(m.texto).trim()).filter(Boolean),
    };
}
export function coordTexto(d: {
    grupo: string;
    artefacto: string;
    version: string;
}): string {
    return `${d.grupo}:${d.artefacto}:${d.version || "?"}`;
}
export function huecos(p: ProyectoPom | null): {
    total: number;
    sinVersion: number;
    rangos: number;
    porBom: boolean;
} {
    const deps = p?.dependencias ?? [];
    return {
        total: deps.length,
        sinVersion: deps.filter(d => d.origen === "desconocida").length,
        rangos: deps.filter(d => d.esRango).length,
        porBom: !!(p?.bomsImportados.length || p?.padre),
    };
}
