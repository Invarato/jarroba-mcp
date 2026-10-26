import { leerXml, hijo, hijos, textoDe, type NodoXml } from "./pom-parse";
import { GRUPO_PLUGINS, VINCULACIONES, VINCULACIONES_FIJAS } from "./maven-ciclos";
import { gestionadosPorPadre, padreConocido } from "./maven-modelo";
import type { PomEntrada } from "./maven-plan";
export type ReglaRevision = "plugin-duplicado" | "dependencia-duplicada" | "sin-version-super-pom" | "sin-version-ultima" | "sin-version-ciclo" | "version-distinta-modulos" | "version-repetida-modulos";
export type Gravedad = "rompe" | "cambia" | "mejora";
export interface HallazgoRevision {
    regla: ReglaRevision;
    gravedad: Gravedad;
    ruta: string;
    linea?: number;
    datos: Record<string, string>;
}
export interface Revision {
    hallazgos: HallazgoRevision[];
    sinSaberVersiones: string[];
}
export const SUPER_POM_39: Readonly<Record<string, string>> = {
    "maven-antrun-plugin": "3.1.0",
    "maven-assembly-plugin": "3.7.1",
    "maven-dependency-plugin": "3.7.0",
    "maven-release-plugin": "3.0.1",
};
const GRAVEDAD: Record<ReglaRevision, Gravedad> = {
    "plugin-duplicado": "rompe",
    "dependencia-duplicada": "rompe",
    "sin-version-super-pom": "cambia",
    "sin-version-ultima": "cambia",
    "version-distinta-modulos": "cambia",
    "sin-version-ciclo": "mejora",
    "version-repetida-modulos": "mejora",
};
const DEL_CICLO = new Set([
    ...Object.values(VINCULACIONES).flat().map(v => v.artefacto),
    ...VINCULACIONES_FIJAS.map(v => v.artefacto),
]);
const ga = (n: NodoXml, defecto = "") => `${textoDe(n, "groupId") || defecto}:${textoDe(n, "artifactId")}`;
function contenedores(raiz: NodoXml): {
    donde: string;
    plugins: NodoXml[];
    gestionPlugins: NodoXml[];
    deps: NodoXml[];
    gestionDeps: NodoXml[];
}[] {
    const de = (n: NodoXml | null, donde: string) => {
        const b = hijo(n, "build");
        return {
            donde,
            plugins: hijos(hijo(b, "plugins"), "plugin"),
            gestionPlugins: hijos(hijo(hijo(b, "pluginManagement"), "plugins"), "plugin"),
            deps: hijos(hijo(n, "dependencies"), "dependency"),
            gestionDeps: hijos(hijo(hijo(n, "dependencyManagement"), "dependencies"), "dependency"),
        };
    };
    return [de(raiz, ""), ...hijos(hijo(raiz, "profiles"), "profile").map(p => de(p, textoDe(p, "id") || "default"))];
}
function duplicados(nodos: NodoXml[], clave: (n: NodoXml) => string): [
    NodoXml,
    NodoXml
][] {
    const vistos = new Map<string, NodoXml>();
    const out: [
        NodoXml,
        NodoXml
    ][] = [];
    for (const n of nodos) {
        if (!textoDe(n, "artifactId"))
            continue;
        const k = clave(n);
        const ya = vistos.get(k);
        if (ya)
            out.push([ya, n]);
        else
            vistos.set(k, n);
    }
    return out;
}
const claveDep = (n: NodoXml) => `${ga(n)}:${textoDe(n, "type") || "jar"}:${textoDe(n, "classifier")}`;
export function revisar(poms: PomEntrada[]): Revision {
    const hallazgos: HallazgoRevision[] = [];
    const sinSaberVersiones: string[] = [];
    const leidos: {
        ruta: string;
        raiz: NodoXml;
    }[] = [];
    for (const p of Array.isArray(poms) ? poms : []) {
        if (!p || typeof p.ruta !== "string")
            continue;
        let raiz: NodoXml | null = null;
        try {
            raiz = leerXml(p.xml);
        }
        catch {
            raiz = null;
        }
        if (raiz?.nombre === "project")
            leidos.push({ ruta: p.ruta, raiz });
    }
    const mete = (regla: ReglaRevision, ruta: string, linea: number | undefined, datos: Record<string, string>) => hallazgos.push({ regla, gravedad: GRAVEDAD[regla], ruta, linea, datos });
    const porGa = new Map(leidos.map(l => [`${textoDe(l.raiz, "groupId") || textoDe(hijo(l.raiz, "parent"), "groupId")}:${textoDe(l.raiz, "artifactId")}`, l]));
    for (const { ruta, raiz } of leidos) {
        const cont = contenedores(raiz);
        for (const c of cont) {
            for (const lista of [c.plugins, c.gestionPlugins]) {
                for (const [a, b] of duplicados(lista, n => ga(n, GRUPO_PLUGINS))) {
                    mete("plugin-duplicado", ruta, b.linea, { ga: ga(a, GRUPO_PLUGINS), primera: String(a.linea ?? ""), perfil: c.donde });
                }
            }
            for (const lista of [c.deps, c.gestionDeps]) {
                for (const [a, b] of duplicados(lista, claveDep)) {
                    mete("dependencia-duplicada", ruta, b.linea, { ga: ga(a), primera: String(a.linea ?? ""), perfil: c.donde });
                }
            }
        }
        const gestionados = new Set<string>();
        let conocida = true;
        let actual: NodoXml | null = raiz;
        for (let vuelta = 0; vuelta < 20 && actual; vuelta++) {
            for (const c of contenedores(actual))
                for (const n of c.gestionPlugins)
                    if (textoDe(n, "version"))
                        gestionados.add(ga(n, GRUPO_PLUGINS));
            const pd = hijo(actual, "parent");
            if (!pd)
                break;
            const gaPadre = `${textoDe(pd, "groupId")}:${textoDe(pd, "artifactId")}`;
            const local = porGa.get(gaPadre);
            if (local && local.raiz !== actual) {
                actual = local.raiz;
                continue;
            }
            let g = gaPadre, v = textoDe(pd, "version");
            for (let k = 0; k < 20 && g; k++) {
                const pb = padreConocido(g, v);
                if (!pb) {
                    conocida = false;
                    break;
                }
                for (const x of gestionadosPorPadre(g, v))
                    gestionados.add(x);
                g = pb.padre ? `${pb.padre.grupo}:${pb.padre.artefacto}` : "";
                v = pb.padre?.version ?? "";
            }
            break;
        }
        if (!conocida) {
            sinSaberVersiones.push(ruta);
            continue;
        }
        for (const c of cont) {
            for (const n of c.plugins) {
                if (textoDe(n, "version"))
                    continue;
                const g = ga(n, GRUPO_PLUGINS);
                if (gestionados.has(g))
                    continue;
                const artefacto = textoDe(n, "artifactId");
                const del39 = g.startsWith(GRUPO_PLUGINS + ":") ? SUPER_POM_39[artefacto] : undefined;
                if (del39)
                    mete("sin-version-super-pom", ruta, n.linea, { ga: g, version39: del39, perfil: c.donde });
                else if (g.startsWith(GRUPO_PLUGINS + ":") && DEL_CICLO.has(artefacto))
                    mete("sin-version-ciclo", ruta, n.linea, { ga: g, perfil: c.donde });
                else
                    mete("sin-version-ultima", ruta, n.linea, { ga: g, perfil: c.donde });
            }
        }
    }
    if (leidos.length > 1) {
        const propios = new Set(porGa.keys());
        const porDep = new Map<string, {
            ruta: string;
            version: string;
            linea?: number;
        }[]>();
        for (const { ruta, raiz } of leidos) {
            for (const d of hijos(hijo(raiz, "dependencies"), "dependency")) {
                const v = textoDe(d, "version");
                const k = ga(d);
                if (!v || propios.has(k) || v.includes("${project."))
                    continue;
                const l = porDep.get(k) ?? [];
                l.push({ ruta, version: v, linea: d.linea });
                porDep.set(k, l);
            }
        }
        for (const [k, l] of porDep) {
            if (l.length < 2)
                continue;
            const versiones = [...new Set(l.map(x => x.version))];
            const datos = { ga: k, modulos: String(l.length), versiones: versiones.join(", "), donde: l.map(x => x.ruta).join(", ") };
            mete(versiones.length > 1 ? "version-distinta-modulos" : "version-repetida-modulos", l[0].ruta, l[0].linea, datos);
        }
    }
    const orden: Gravedad[] = ["rompe", "cambia", "mejora"];
    hallazgos.sort((a, b) => orden.indexOf(a.gravedad) - orden.indexOf(b.gravedad));
    return { hallazgos, sinSaberVersiones };
}
