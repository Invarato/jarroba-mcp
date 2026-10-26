import { leerXml, hijo, hijos, textoDe, decodificarEntidades, type NodoXml } from "./pom-parse";
import { GRUPO_PLUGINS } from "./maven-ciclos";
import { PARENTS } from "./maven-datos";
export type Fuente = {
    tipo: "pom";
    ruta: string;
} | {
    tipo: "padre";
    ga: string;
    version: string;
    desde: string;
    hasta: string;
    aproximado: "" | "mas-nuevo" | "mas-viejo" | "hueco";
};
export interface Ejecucion {
    id: string;
    fase: string;
    goals: string[];
    heredable: boolean;
    fuente: Fuente;
    perfil?: string;
    linea?: number;
    tocadaEn: {
        fuente: Fuente;
        perfil?: string;
        linea?: number;
    }[];
    saltos: Record<string, string>;
}
export interface PluginBuild {
    grupo: string;
    artefacto: string;
    version: string;
    heredable: boolean;
    extensiones: boolean;
    ejecuciones: Ejecucion[];
    fuente: Fuente;
    perfil?: string;
    linea?: number;
    saltos: Record<string, string>;
}
export interface Build {
    plugins: PluginBuild[];
    gestion: PluginBuild[];
}
export interface Activacion {
    porDefecto: boolean;
    propiedad?: {
        nombre: string;
        valor?: string;
    };
    jdk?: string;
    os: boolean;
    fichero?: {
        existe?: string;
        falta?: string;
    };
    packaging?: string;
}
export interface Perfil {
    id: string;
    activacion: Activacion | null;
    build: Build;
    modulos: string[];
    propiedades: Record<string, string>;
    linea?: number;
}
export interface PadreDeclarado {
    grupo: string;
    artefacto: string;
    version: string;
    rutaRelativa: string | null;
}
export interface PomBuild {
    fuente: Fuente;
    grupo: string;
    artefacto: string;
    version: string;
    packaging: string;
    padre: PadreDeclarado | null;
    propiedades: Record<string, string>;
    build: Build;
    perfiles: Perfil[];
    modulos: string[];
    usaSubprojects: boolean;
    usa: string[];
}
const NOMBRES_SALTO = /^skip(Tests|ITs|Exec|Main)?$/;
function leerSaltos(conf: NodoXml | null): Record<string, string> {
    const out: Record<string, string> = {};
    if (!conf)
        return out;
    for (const h of conf.hijos)
        if (NOMBRES_SALTO.test(h.nombre))
            out[h.nombre] = decodificarEntidades(h.texto).trim();
    return out;
}
function leerPlugin(n: NodoXml, fuente: Fuente, perfil?: string): PluginBuild {
    const saltos = leerSaltos(hijo(n, "configuration"));
    const ejecuciones: Ejecucion[] = hijos(hijo(n, "executions"), "execution").map(e => ({
        id: textoDe(e, "id") || "default",
        fase: textoDe(e, "phase"),
        goals: hijos(hijo(e, "goals"), "goal").map(g => decodificarEntidades(g.texto).trim()).filter(Boolean),
        heredable: textoDe(e, "inherited").toLowerCase() !== "false",
        fuente,
        perfil,
        linea: e.linea,
        tocadaEn: [],
        saltos: leerSaltos(hijo(e, "configuration")),
    }));
    return {
        grupo: textoDe(n, "groupId") || GRUPO_PLUGINS,
        artefacto: textoDe(n, "artifactId"),
        version: textoDe(n, "version"),
        heredable: textoDe(n, "inherited").toLowerCase() !== "false",
        extensiones: textoDe(n, "extensions").toLowerCase() === "true",
        ejecuciones,
        fuente,
        perfil,
        linea: n.linea,
        saltos,
    };
}
function leerBuild(nBuild: NodoXml | null, fuente: Fuente, perfil?: string): Build {
    return {
        plugins: hijos(hijo(nBuild, "plugins"), "plugin").map(p => leerPlugin(p, fuente, perfil)).filter(p => p.artefacto),
        gestion: hijos(hijo(hijo(nBuild, "pluginManagement"), "plugins"), "plugin").map(p => leerPlugin(p, fuente, perfil)).filter(p => p.artefacto),
    };
}
function leerPropiedades(n: NodoXml | null): Record<string, string> {
    const out: Record<string, string> = {};
    for (const p of n?.hijos ?? [])
        out[p.nombre] = decodificarEntidades(p.texto).trim();
    return out;
}
function leerModulos(raiz: NodoXml): {
    modulos: string[];
    usaSubprojects: boolean;
} {
    const sub = hijo(raiz, "subprojects");
    const lista = sub ? hijos(sub, "subproject") : hijos(hijo(raiz, "modules"), "module");
    return { modulos: lista.map(m => decodificarEntidades(m.texto).trim()).filter(Boolean), usaSubprojects: !!sub };
}
function leerActivacion(n: NodoXml | null): Activacion | null {
    if (!n)
        return null;
    const prop = hijo(n, "property");
    const fich = hijo(n, "file");
    return {
        porDefecto: textoDe(n, "activeByDefault").toLowerCase() === "true",
        propiedad: prop ? { nombre: textoDe(prop, "name"), valor: hijo(prop, "value") ? textoDe(prop, "value") : undefined } : undefined,
        jdk: textoDe(n, "jdk") || undefined,
        os: !!hijo(n, "os"),
        fichero: fich ? { existe: textoDe(fich, "exists") || undefined, falta: textoDe(fich, "missing") || undefined } : undefined,
        packaging: textoDe(n, "packaging") || undefined,
    };
}
export function leerPomBuild(xml: string, fuente: Fuente): PomBuild | null {
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
    const padre: PadreDeclarado | null = nPadre ? {
        grupo: textoDe(nPadre, "groupId"),
        artefacto: textoDe(nPadre, "artifactId"),
        version: textoDe(nPadre, "version"),
        rutaRelativa: hijo(nPadre, "relativePath") ? textoDe(nPadre, "relativePath") : "../pom.xml",
    } : null;
    const { modulos, usaSubprojects } = leerModulos(raiz);
    const usa = [
        ...hijos(hijo(raiz, "dependencies"), "dependency"),
        ...hijos(hijo(hijo(raiz, "build"), "plugins"), "plugin"),
    ].map(d => `${textoDe(d, "groupId") || (d.nombre === "plugin" ? GRUPO_PLUGINS : "")}:${textoDe(d, "artifactId")}`);
    const perfiles: Perfil[] = hijos(hijo(raiz, "profiles"), "profile").map(p => {
        const id = textoDe(p, "id") || "default";
        return {
            id,
            activacion: leerActivacion(hijo(p, "activation")),
            build: leerBuild(hijo(p, "build"), fuente, id),
            modulos: leerModulos(p).modulos,
            propiedades: leerPropiedades(hijo(p, "properties")),
            linea: p.linea,
        };
    });
    return {
        fuente,
        grupo: textoDe(raiz, "groupId") || padre?.grupo || "",
        artefacto: textoDe(raiz, "artifactId"),
        version: textoDe(raiz, "version") || padre?.version || "",
        packaging: textoDe(raiz, "packaging"),
        padre,
        propiedades: leerPropiedades(hijo(raiz, "properties")),
        build: leerBuild(hijo(raiz, "build"), fuente),
        perfiles,
        modulos,
        usaSubprojects,
        usa,
    };
}
export function compararVersiones(a: string, b: string): number {
    const pa = String(a).split(/[.-]/), pb = String(b).split(/[.-]/);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
        const x = pa[i] ?? "0", y = pb[i] ?? "0";
        const nx = /^\d+$/.test(x), ny = /^\d+$/.test(y);
        if (nx && ny) {
            if (+x !== +y)
                return +x - +y;
        }
        else if (x !== y)
            return x < y ? -1 : 1;
    }
    return 0;
}
export function padreConocido(ga: string, version: string): PomBuild | null {
    const rangos = PARENTS[ga];
    if (!rangos?.length)
        return null;
    let elegido = rangos.find(r => compararVersiones(r.desde, version) <= 0 && compararVersiones(version, r.hasta) <= 0);
    let aproximado: "" | "mas-nuevo" | "mas-viejo" | "hueco" = "";
    if (!elegido) {
        const ordenados = [...rangos].sort((a, b) => compararVersiones(a.desde, b.desde));
        if (compararVersiones(version, ordenados[ordenados.length - 1].hasta) > 0) {
            elegido = ordenados[ordenados.length - 1];
            aproximado = "mas-nuevo";
        }
        else if (compararVersiones(version, ordenados[0].desde) < 0) {
            elegido = ordenados[0];
            aproximado = "mas-viejo";
        }
        else {
            elegido = [...ordenados].reverse().find(r => compararVersiones(r.desde, version) <= 0) ?? ordenados[0];
            aproximado = "hueco";
        }
    }
    const fuente: Fuente = { tipo: "padre", ga, version, desde: elegido.desde, hasta: elegido.hasta, aproximado };
    const pom = leerPomBuild(elegido.pom.replaceAll("<version>${project.version}</version>", `<version>${version}</version>`), fuente);
    return pom ? { ...pom, version } : null;
}
export function gestionadosPorPadre(ga: string, version: string): Set<string> {
    const p = padreConocido(ga, version);
    const fuente = p?.fuente;
    if (!fuente || fuente.tipo !== "padre")
        return new Set();
    const r = PARENTS[ga]?.find(x => x.desde === fuente.desde && x.hasta === fuente.hasta);
    return new Set((r?.gestionados ?? "").split(" ").filter(Boolean));
}
const clavePlugin = (p: {
    grupo: string;
    artefacto: string;
}) => `${p.grupo}:${p.artefacto}`;
export function mezclarEjecuciones(base: Ejecucion[], encima: Ejecucion[]): Ejecucion[] {
    const m = new Map<string, Ejecucion>();
    for (const e of base)
        m.set(e.id, { ...e, goals: [...e.goals], tocadaEn: [...e.tocadaEn], saltos: { ...e.saltos } });
    for (const e of encima) {
        const ya = m.get(e.id);
        if (!ya) {
            m.set(e.id, { ...e, goals: [...e.goals], tocadaEn: [...e.tocadaEn], saltos: { ...e.saltos } });
            continue;
        }
        m.set(e.id, {
            ...ya,
            fase: e.fase || ya.fase,
            goals: [...e.goals, ...ya.goals.filter(g => !e.goals.includes(g))],
            heredable: e.heredable,
            saltos: { ...ya.saltos, ...e.saltos },
            tocadaEn: [...ya.tocadaEn, { fuente: e.fuente, perfil: e.perfil, linea: e.linea }],
        });
    }
    return [...m.values()];
}
function fundirPlugin(base: PluginBuild, encima: PluginBuild): PluginBuild {
    return {
        ...encima,
        version: encima.version || base.version,
        extensiones: encima.extensiones || base.extensiones,
        ejecuciones: mezclarEjecuciones(base.ejecuciones, encima.ejecuciones),
        saltos: { ...base.saltos, ...encima.saltos },
        fuente: base.fuente,
        perfil: base.perfil,
        linea: base.linea,
    };
}
function mezclarPlugins(principal: PluginBuild[], otra: PluginBuild[]): PluginBuild[] {
    const porClave = new Map(principal.map(p => [clavePlugin(p), p] as const));
    const antesDe = new Map<string, PluginBuild[]>();
    let pendientes: PluginBuild[] = [];
    for (const o of otra) {
        const k = clavePlugin(o);
        const p = porClave.get(k);
        if (p) {
            porClave.set(k, fundirPlugin(p, o));
            antesDe.set(k, pendientes);
            pendientes = [];
        }
        else
            pendientes.push(o);
    }
    const out: PluginBuild[] = [];
    for (const [k, p] of porClave) {
        out.push(...(antesDe.get(k) ?? []), p);
    }
    return [...out, ...pendientes];
}
function heredable(plugins: PluginBuild[]): PluginBuild[] {
    return plugins.filter(p => p.heredable || p.ejecuciones.length)
        .map(p => ({ ...p, ejecuciones: p.ejecuciones.filter(e => e.heredable) }));
}
export function heredar(hijoB: Build, padreB: Build): Build {
    return {
        plugins: mezclarPlugins(heredable(padreB.plugins), hijoB.plugins),
        gestion: mezclarPlugins(heredable(padreB.gestion), hijoB.gestion),
    };
}
export function aplicarPerfil(b: Build, perfil: Build): Build {
    return { plugins: mezclarPlugins(b.plugins, perfil.plugins), gestion: mezclarPlugins(b.gestion, perfil.gestion) };
}
export function aplicarGestion(b: Build): PluginBuild[] {
    const gest = new Map(b.gestion.map(g => [clavePlugin(g), g] as const));
    return b.plugins.map(p => {
        const g = gest.get(clavePlugin(p));
        return g ? fundirPlugin({ ...g, fuente: p.fuente, perfil: p.perfil, linea: p.linea }, { ...p, version: p.version || g.version }) : p;
    });
}
