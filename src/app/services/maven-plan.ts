import { type VersionMaven, type Ciclo, FASES, cicloDe, faseNormalizada, prioridadDe, ALIAS_MAVEN_4, FASES_SOLO_MAVEN_4, VINCULACIONES, VINCULACIONES_FIJAS, GRUPO_PLUGINS, } from "./maven-ciclos";
import { type Fuente, type PomBuild, type PluginBuild, type Ejecucion, type Build, type Perfil, leerPomBuild, padreConocido, heredar, aplicarPerfil, aplicarGestion, mezclarEjecuciones, compararVersiones, } from "./maven-modelo";
import { interpolar } from "./pom-parse";
import { PLUGINS, type GoalDescriptor } from "./maven-datos";
export type Tarea = {
    tipo: "fase";
    fase: string;
    escrita: string;
} | {
    tipo: "goal";
    escrita: string;
    prefijo: string;
    grupo: string;
    artefacto: string;
    goal: string;
    ejecucion: string;
} | {
    tipo: "desconocida";
    escrita: string;
    motivo: "no-es-fase" | "solo-maven-4";
};
export interface ComandoMvn {
    tareas: Tarea[];
    pl: string[];
    am: boolean;
    amd: boolean;
    noRecursivo: boolean;
    reanudarDesde: string;
    perfilesActivar: string[];
    perfilesDesactivar: string[];
    props: Record<string, string>;
    ignoradas: string[];
}
const OPCIONES_CON_VALOR = new Set(["-T", "--threads", "-s", "--settings", "-gs", "--global-settings", "-l", "--log-file", "-t", "--toolchains", "-b", "--builder", "-f", "--file", "-c", "--color", "-emp", "-ep"]);
export function leerComando(texto: string, maven: VersionMaven): ComandoMvn {
    const c: ComandoMvn = {
        tareas: [],
        pl: [],
        am: false,
        amd: false,
        noRecursivo: false,
        reanudarDesde: "",
        perfilesActivar: [],
        perfilesDesactivar: [],
        props: {},
        ignoradas: [],
    };
    const tokens = (typeof texto === "string" ? texto : "").trim().match(/"[^"]*"|'[^']*'|\S+/g) ?? [];
    const limpia = (t: string) => t.replace(/^["']|["']$/g, "");
    let i = 0;
    if (/(^|[\\/])(mvn|mvnw|mvnd)(\.cmd|\.bat)?$/.test(tokens[0] ?? ""))
        i = 1;
    const valor = (t: string, largo: string): string => t.length > largo.length ? t.slice(largo.length).replace(/^=/, "") : limpia(tokens[++i] ?? "");
    for (; i < tokens.length; i++) {
        const t = limpia(tokens[i]);
        if (t === "-pl" || t === "--projects") {
            c.pl.push(...valor(t, t).split(",").filter(Boolean));
            continue;
        }
        if (t === "-am" || t === "--also-make") {
            c.am = true;
            continue;
        }
        if (t === "-amd" || t === "--also-make-dependents") {
            c.amd = true;
            continue;
        }
        if (t === "-N" || t === "--non-recursive") {
            c.noRecursivo = true;
            continue;
        }
        if (t === "-rf" || t === "--resume-from") {
            c.reanudarDesde = valor(t, t);
            continue;
        }
        if (t.startsWith("-P") || t === "--activate-profiles") {
            const lista = t === "--activate-profiles" ? valor(t, t) : valor(t, "-P");
            for (const p of lista.split(",").map(s => s.trim()).filter(Boolean)) {
                if (p.startsWith("!") || p.startsWith("-"))
                    c.perfilesDesactivar.push(p.slice(1).replace(/^\?/, ""));
                else
                    c.perfilesActivar.push(p.replace(/^[+?]/, ""));
            }
            continue;
        }
        if (t.startsWith("-D") || t === "--define") {
            const kv = t === "--define" ? valor(t, t) : valor(t, "-D");
            const eq = kv.indexOf("=");
            if (kv)
                c.props[eq < 0 ? kv : kv.slice(0, eq)] = eq < 0 ? "true" : limpia(kv.slice(eq + 1));
            continue;
        }
        if (OPCIONES_CON_VALOR.has(t)) {
            c.ignoradas.push(`${t} ${tokens[i + 1] ?? ""}`.trim());
            i++;
            continue;
        }
        if (t.startsWith("-")) {
            c.ignoradas.push(t);
            continue;
        }
        c.tareas.push(leerTarea(t, maven));
    }
    return c;
}
function leerTarea(t: string, maven: VersionMaven): Tarea {
    if (cicloDe(t))
        return { tipo: "fase", fase: t, escrita: t };
    if (maven === "4" && ALIAS_MAVEN_4[t])
        return { tipo: "fase", fase: ALIAS_MAVEN_4[t], escrita: t };
    if ((FASES_SOLO_MAVEN_4 as readonly string[]).includes(t) || /^(before|after):/.test(t)) {
        return { tipo: "desconocida", escrita: t, motivo: maven === "4" ? "solo-maven-4" : "no-es-fase" };
    }
    if (!t.includes(":"))
        return { tipo: "desconocida", escrita: t, motivo: "no-es-fase" };
    const [cuerpo, ejecucion = "default-cli"] = t.split("@");
    const partes = cuerpo.split(":");
    const goal = partes[partes.length - 1];
    if (partes.length === 2)
        return { tipo: "goal", escrita: t, prefijo: partes[0], grupo: "", artefacto: "", goal, ejecucion };
    return { tipo: "goal", escrita: t, prefijo: "", grupo: partes[0], artefacto: partes[1], goal, ejecucion };
}
export type OrigenPaso = {
    tipo: "packaging";
    packaging: string;
    plugin?: string;
} | {
    tipo: "pom";
    ruta: string;
    linea?: number;
    perfil?: string;
} | {
    tipo: "padre";
    ga: string;
    version: string;
    desde: string;
    hasta: string;
    aproximado: string;
    perfil?: string;
} | {
    tipo: "cli";
};
export interface Salto {
    por: "propiedad" | "config";
    nombre: string;
}
export interface PasoPlan {
    fase: string | null;
    desfase: -1 | 0 | 1;
    prioridad: number;
    ga: string;
    prefijo: string;
    goal: string;
    ejecucion: string;
    origen: OrigenPaso;
    tocadaEn: OrigenPaso[];
    salta?: Salto;
    bifurca?: {
        hasta: string;
        pasos: PasoPlan[];
        omitida?: "ya-hecha-maven-4";
    };
}
export type MotivoNoEjecuta = "fase-none" | "fase-inexistente" | "sin-fase" | "plugin-desconocido" | "goal-desconocido";
export interface NoEjecuta {
    ga: string;
    goal: string;
    ejecucion: string;
    motivo: MotivoNoEjecuta;
    fase: string;
    origen: OrigenPaso;
}
export interface PerfilEvaluado {
    id: string;
    activo: boolean;
    porque: "cli" | "cli-desactivado" | "por-defecto" | "por-defecto-anulado" | "propiedad" | "jdk" | "packaging" | "fichero" | "no-cumple" | "sin-activacion" | "dudoso-os" | "dudoso-fichero";
    origen: OrigenPaso;
}
export interface ModuloPlan {
    ruta: string;
    ga: string;
    packaging: string;
    pasos: PasoPlan[];
    noEjecuta: NoEjecuta[];
    perfiles: PerfilEvaluado[];
    cadena: {
        ga: string;
        version: string;
        origen: OrigenPaso | null;
    }[];
}
export type CodigoAviso = "sin-poms" | "sin-tareas" | "extension-desconocida" | "padre-desconocido" | "padre-aproximado" | "modulo-no-cargado" | "tarea-desconocida" | "tarea-solo-maven-4" | "prefijo-desconocido" | "packaging-desconocido" | "perfil-no-existe" | "pl-no-encontrado" | "integration-test-sin-post" | "post-clean-maven-4" | "subprojects-en-maven-3" | "prioridad-en-maven-3";
export interface AvisoPlan {
    codigo: CodigoAviso;
    datos: Record<string, string>;
}
export interface PlanMaven {
    comando: ComandoMvn;
    maven: VersionMaven;
    reactor: ModuloPlan[];
    fuera: string[];
    avisos: AvisoPlan[];
}
export interface PomEntrada {
    ruta: string;
    xml: string;
}
export interface OpcionesPlan {
    maven: VersionMaven;
    comando: string;
    jdk?: number;
    ficheros?: string[];
}
function dirDe(ruta: string): string { const i = ruta.lastIndexOf("/"); return i < 0 ? "" : ruta.slice(0, i); }
function normalizar(ruta: string): string {
    const out: string[] = [];
    for (const p of ruta.replace(/\\/g, "/").split("/")) {
        if (!p || p === ".")
            continue;
        if (p === "..") {
            if (out.length && out[out.length - 1] !== "..")
                out.pop();
            else
                out.push("..");
        }
        else
            out.push(p);
    }
    return out.join("/");
}
function unir(dir: string, rel: string): string { return normalizar(dir ? `${dir}/${rel}` : rel); }
function pomDeModulo(dir: string, modulo: string): string {
    const r = unir(dir, modulo);
    return /\.xml$/i.test(r) ? r : unir(r, "pom.xml");
}
function origenDe(f: Fuente, perfil?: string, linea?: number): OrigenPaso {
    return f.tipo === "pom"
        ? { tipo: "pom", ruta: f.ruta, linea, perfil }
        : { tipo: "padre", ga: f.ga, version: f.version, desde: f.desde, hasta: f.hasta, aproximado: f.aproximado, perfil };
}
function jdkMayor(v: string): number {
    const p = v.trim().split(".");
    const n = parseInt(p[0] === "1" && p.length > 1 ? p[1] : p[0], 10);
    return Number.isFinite(n) ? n : NaN;
}
export function cumpleJdk(expr: string, jdk: number): boolean {
    const e = expr.trim();
    if (e.startsWith("!"))
        return !cumpleJdk(e.slice(1), jdk);
    const m = /^([[(])\s*([^,]*)\s*,\s*([^\])]*)\s*([\])])$/.exec(e);
    if (m) {
        const lo = m[2] ? jdkMayor(m[2]) : -Infinity, hi = m[3] ? jdkMayor(m[3]) : Infinity;
        const okLo = m[1] === "[" ? jdk >= lo : jdk > lo;
        const okHi = m[4] === "]" ? jdk <= hi : jdk < hi;
        return okLo && okHi;
    }
    return jdkMayor(e) === jdk;
}
const PROPIEDADES_JVM = new Set(["user.home", "user.name", "user.dir", "java.version", "java.home", "java.vendor", "os.name", "os.arch", "os.version", "file.separator", "path.separator", "line.separator", "file.encoding", "java.io.tmpdir", "maven.home", "maven.version", "maven.build.version"]);
function evaluarPerfiles(pom: PomBuild, c: ComandoMvn, op: OpcionesPlan, dirPom: string): PerfilEvaluado[] {
    const jdk = op.jdk ?? 21;
    const out = pom.perfiles.map((p): PerfilEvaluado => {
        const origen = origenDe(pom.fuente, p.id, p.linea);
        if (c.perfilesDesactivar.includes(p.id))
            return { id: p.id, activo: false, porque: "cli-desactivado", origen };
        if (c.perfilesActivar.includes(p.id))
            return { id: p.id, activo: true, porque: "cli", origen };
        const a = p.activacion;
        if (!a)
            return { id: p.id, activo: false, porque: "sin-activacion", origen };
        const conds: {
            ok: boolean | null;
            por: PerfilEvaluado["porque"];
        }[] = [];
        if (a.propiedad?.nombre) {
            const neg = a.propiedad.nombre.startsWith("!");
            const nombre = neg ? a.propiedad.nombre.slice(1) : a.propiedad.nombre;
            const v = c.props[nombre] ?? (PROPIEDADES_JVM.has(nombre) ? "" : undefined);
            let ok: boolean;
            if (a.propiedad.valor === undefined)
                ok = neg ? v === undefined : v !== undefined;
            else {
                const negV = a.propiedad.valor.startsWith("!");
                const esperado = negV ? a.propiedad.valor.slice(1) : a.propiedad.valor;
                ok = negV ? v !== esperado : v === esperado;
            }
            conds.push({ ok, por: "propiedad" });
        }
        if (a.jdk)
            conds.push({ ok: cumpleJdk(a.jdk, jdk), por: "jdk" });
        if (a.packaging)
            conds.push({ ok: (pom.packaging || "jar") === a.packaging, por: "packaging" });
        if (a.os)
            conds.push({ ok: null, por: "dudoso-os" });
        if (a.fichero && (a.fichero.existe || a.fichero.falta)) {
            const rel = (a.fichero.existe || a.fichero.falta || "").replace(/\$\{(project\.)?basedir\}\/?/g, "");
            if (op.ficheros && !/\$\{/.test(rel)) {
                const hay = op.ficheros.some(f => normalizar(f) === unir(dirPom, rel) || normalizar(f).startsWith(unir(dirPom, rel) + "/"));
                conds.push({ ok: a.fichero.existe ? hay : !hay, por: "fichero" });
            }
            else
                conds.push({ ok: null, por: "dudoso-fichero" });
        }
        if (!conds.length) {
            return { id: p.id, activo: a.porDefecto, porque: a.porDefecto ? "por-defecto" : "sin-activacion", origen };
        }
        const dudosa = conds.find(x => x.ok === null);
        if (conds.some(x => x.ok === false))
            return { id: p.id, activo: false, porque: "no-cumple", origen };
        if (dudosa)
            return { id: p.id, activo: false, porque: dudosa.por, origen };
        return { id: p.id, activo: true, porque: conds[0].por, origen };
    });
    const otroActivo = out.some(p => p.activo && p.porque !== "por-defecto");
    if (otroActivo)
        for (const p of out)
            if (p.porque === "por-defecto") {
                p.activo = false;
                p.porque = "por-defecto-anulado";
            }
    if (!out.some(p => p.activo)) {
        for (const p of out) {
            const def = pom.perfiles.find(x => x.id === p.id)?.activacion?.porDefecto;
            if (def && p.porque === "no-cumple") {
                p.activo = true;
                p.porque = "por-defecto";
            }
        }
    }
    return out;
}
interface Efectivo {
    pom: PomBuild;
    plugins: PluginBuild[];
    props: Record<string, string>;
    perfiles: PerfilEvaluado[];
    cadena: ModuloPlan["cadena"];
    prioridadPaquete: Map<string, number>;
    paqueteDe: string;
    modulosPerfil: string[];
}
function propsImplicitas(p: PomBuild): Record<string, string> {
    const m: Record<string, string> = {};
    if (p.version) {
        m["project.version"] = p.version;
        m["version"] = p.version;
    }
    if (p.grupo)
        m["project.groupId"] = p.grupo;
    if (p.artefacto)
        m["project.artifactId"] = p.artefacto;
    m["project.packaging"] = p.packaging || "jar";
    return m;
}
function efectivo(ruta: string, porRuta: Map<string, PomBuild>, c: ComandoMvn, op: OpcionesPlan, avisos: AvisoPlan[]): Efectivo | null {
    const propio = porRuta.get(ruta);
    if (!propio)
        return null;
    const cadenaPoms: {
        pom: PomBuild;
        dir: string;
    }[] = [{ pom: propio, dir: dirDe(ruta) }];
    const cadena: ModuloPlan["cadena"] = [];
    const vistos = new Set<string>([ruta]);
    let actual = propio, dirActual = dirDe(ruta);
    for (let vuelta = 0; vuelta < 20 && actual.padre; vuelta++) {
        const pd = actual.padre;
        const ga = `${pd.grupo}:${pd.artefacto}`;
        let local: [
            string,
            PomBuild
        ] | undefined;
        if (pd.rutaRelativa) {
            const r = pomDeModulo(dirActual, pd.rutaRelativa);
            const p = porRuta.get(r);
            if (p && p.grupo === pd.grupo && p.artefacto === pd.artefacto)
                local = [r, p];
        }
        local ??= [...porRuta.entries()].find(([, p]) => p.grupo === pd.grupo && p.artefacto === pd.artefacto);
        if (local && !vistos.has(local[0])) {
            vistos.add(local[0]);
            cadenaPoms.push({ pom: local[1], dir: dirDe(local[0]) });
            cadena.push({ ga, version: pd.version, origen: { tipo: "pom", ruta: local[0] } });
            actual = local[1];
            dirActual = dirDe(local[0]);
            continue;
        }
        const conocido = padreConocido(ga, interpolar(pd.version, { ...actual.propiedades, ...propsImplicitas(actual) }));
        if (conocido) {
            cadenaPoms.push({ pom: conocido, dir: "" });
            cadena.push({ ga, version: pd.version, origen: origenDe(conocido.fuente) });
            if (conocido.fuente.tipo === "padre" && conocido.fuente.aproximado) {
                avisos.push({ codigo: "padre-aproximado", datos: { modulo: ruta, ga, version: pd.version, desde: conocido.fuente.desde, hasta: conocido.fuente.hasta, tipo: conocido.fuente.aproximado } });
            }
            actual = conocido;
            dirActual = "";
            continue;
        }
        cadena.push({ ga, version: pd.version, origen: null });
        if (!avisos.some(a => a.codigo === "padre-desconocido" && a.datos["ga"] === ga)) {
            avisos.push({ codigo: "padre-desconocido", datos: { modulo: ruta, ga, version: pd.version } });
        }
        break;
    }
    let perfiles: PerfilEvaluado[] = [];
    let modulosPerfil: string[] = [];
    const conPerfiles = cadenaPoms.map(({ pom }, idx) => {
        const ev = evaluarPerfiles(pom, c, op, dirDe(ruta));
        perfiles = [...perfiles, ...ev];
        let b: Build = pom.build;
        let props = { ...pom.propiedades };
        for (const e of ev) {
            if (!e.activo)
                continue;
            const pf = pom.perfiles.find(p => p.id === e.id) as Perfil;
            b = aplicarPerfil(b, pf.build);
            props = { ...props, ...pf.propiedades };
            if (idx === 0)
                modulosPerfil = [...modulosPerfil, ...pf.modulos];
        }
        return { build: b, props };
    });
    let build = conPerfiles[conPerfiles.length - 1].build;
    let props = { ...conPerfiles[conPerfiles.length - 1].props };
    for (let k = conPerfiles.length - 2; k >= 0; k--) {
        build = heredar(conPerfiles[k].build, build);
        props = { ...props, ...conPerfiles[k].props };
    }
    props = { ...props, ...propsImplicitas(propio), ...c.props };
    const coords = (l: PluginBuild[]) => l.map(p => ({ ...p, grupo: interpolar(p.grupo, props), artefacto: interpolar(p.artefacto, props) }));
    build = { plugins: coords(build.plugins), gestion: coords(build.gestion) };
    let plugins = aplicarGestion(build);
    const packaging = interpolar(propio.packaging, props) || "jar";
    const prioridadPaquete = new Map<string, number>();
    const extension = plugins.find(p => p.extensiones && PLUGINS[`${p.grupo}:${p.artefacto}`]?.paquetes?.[packaging]);
    const paqueteDe = extension ? `${extension.grupo}:${extension.artefacto}` : "";
    for (const p of plugins) {
        const ga = `${p.grupo}:${p.artefacto}`;
        if (p.extensiones && !PLUGINS[ga])
            avisos.push({ codigo: "extension-desconocida", datos: { modulo: ruta, ga } });
    }
    const propias: {
        fase: string;
        ga: string;
        goal: string;
    }[] = paqueteDe
        ? (PLUGINS[paqueteDe].paquetes?.[packaging] ?? []).map(l => {
            const [fase, spec] = l.split(" ");
            const p = spec.split(":");
            return { fase, ga: `${p[0]}:${p[1]}`, goal: p[2] };
        })
        : (VINCULACIONES[packaging] ?? []).map(v => ({ fase: v.fase, ga: `${GRUPO_PLUGINS}:${v.artefacto}`, goal: v.goal }));
    const vinc = [...propias, ...VINCULACIONES_FIJAS.map(v => ({ fase: v.fase, ga: `${GRUPO_PLUGINS}:${v.artefacto}`, goal: v.goal }))];
    if (!paqueteDe && (!VINCULACIONES[packaging] || (packaging === "bom" && op.maven === "3"))) {
        avisos.push({ codigo: "packaging-desconocido", datos: { modulo: ruta, packaging } });
    }
    const delPaquete = new Map<string, Ejecucion[]>();
    vinc.forEach((v, idx) => {
        const ga = v.ga;
        const id = `default-${v.goal}`;
        prioridadPaquete.set(`${ga}#${id}`, idx - vinc.length);
        const lista = delPaquete.get(ga) ?? [];
        lista.push({ id, fase: v.fase, goals: [v.goal], heredable: true, fuente: { tipo: "pom", ruta: "" }, tocadaEn: [], saltos: {} });
        delPaquete.set(ga, lista);
    });
    const gestion = new Map<string, PluginBuild>(build.gestion.map(g => [`${g.grupo}:${g.artefacto}`, g]));
    for (const [ga, ejs] of delPaquete) {
        const i = plugins.findIndex(p => `${p.grupo}:${p.artefacto}` === ga);
        if (i >= 0) {
            plugins[i] = { ...plugins[i], ejecuciones: mezclarEjecuciones(ejs, plugins[i].ejecuciones) };
            continue;
        }
        const [grupo, artefacto] = ga.split(":");
        const g = gestion.get(ga);
        plugins = [...plugins, {
                grupo,
                artefacto,
                version: g?.version ?? "",
                heredable: true,
                extensiones: false,
                fuente: { tipo: "pom", ruta: "" },
                saltos: { ...(g?.saltos ?? {}) },
                ejecuciones: mezclarEjecuciones(ejs, g?.ejecuciones ?? []),
            }];
    }
    return { pom: { ...propio, packaging }, plugins, props, perfiles, cadena, prioridadPaquete, paqueteDe, modulosPerfil };
}
interface Enlace {
    fase: string;
    desfase: -1 | 0 | 1;
    prioridad: number;
    orden: number;
    plugin: PluginBuild;
    ej: Ejecucion;
    goal: string;
    origen: OrigenPaso;
}
function descriptor(ga: string, goal: string): GoalDescriptor | undefined { return PLUGINS[ga]?.goals[goal]; }
function enlaces(ef: Efectivo, maven: VersionMaven): {
    enlaces: Enlace[];
    noEjecuta: NoEjecuta[];
    avisos: AvisoPlan[];
} {
    const out: Enlace[] = [];
    const noEjecuta: NoEjecuta[] = [];
    const avisos: AvisoPlan[] = [];
    let orden = 0;
    for (const p of ef.plugins) {
        const ga = `${p.grupo}:${p.artefacto}`;
        for (const ej of p.ejecuciones) {
            const deCli = ej.id === "default-cli";
            for (const goal of ej.goals) {
                const paq = ef.prioridadPaquete.get(`${ga}#${ej.id}`);
                const origen: OrigenPaso = paq !== undefined && ej.fuente.tipo === "pom" && !ej.fuente.ruta
                    ? { tipo: "packaging", packaging: ef.pom.packaging || "jar", ...(ef.paqueteDe ? { plugin: ef.paqueteDe } : {}) }
                    : origenDe(ej.fuente, ej.perfil, ej.linea);
                const escrita = interpolar(ej.fase, ef.props);
                if (deCli)
                    continue;
                if (escrita === "none") {
                    noEjecuta.push({ ga, goal, ejecucion: ej.id, motivo: "fase-none", fase: escrita, origen });
                    continue;
                }
                let fase = escrita;
                if (!fase) {
                    const d = descriptor(ga, goal);
                    if (!PLUGINS[ga]) {
                        noEjecuta.push({ ga, goal, ejecucion: ej.id, motivo: "plugin-desconocido", fase: "", origen });
                        continue;
                    }
                    if (!d) {
                        noEjecuta.push({ ga, goal, ejecucion: ej.id, motivo: "goal-desconocido", fase: "", origen });
                        continue;
                    }
                    if (!d.fase) {
                        noEjecuta.push({ ga, goal, ejecucion: ej.id, motivo: "sin-fase", fase: "", origen });
                        continue;
                    }
                    fase = d.fase;
                }
                if (maven === "3" && /\[-?\d+\]\s*$/.test(fase)) {
                    avisos.push({ codigo: "prioridad-en-maven-3", datos: { ga, goal, ejecucion: ej.id, fase } });
                    noEjecuta.push({ ga, goal, ejecucion: ej.id, motivo: "fase-inexistente", fase, origen });
                    continue;
                }
                const norm = faseNormalizada(fase, maven);
                if (!norm) {
                    noEjecuta.push({ ga, goal, ejecucion: ej.id, motivo: "fase-inexistente", fase, origen });
                    continue;
                }
                out.push({
                    fase: norm.fase,
                    desfase: norm.desfase,
                    prioridad: paq ?? (maven === "4" ? prioridadDe(fase) : 0),
                    orden: orden++,
                    plugin: p,
                    ej,
                    goal,
                    origen,
                });
            }
        }
    }
    return { enlaces: out, noEjecuta, avisos };
}
const SALTOS_EN_CODIGO: Record<string, string[]> = {
    "org.apache.maven.plugins:maven-failsafe-plugin#integration-test": ["skipTests"],
    "org.apache.maven.plugins:maven-failsafe-plugin#verify": ["skipTests"],
};
function saltoDe(ga: string, goal: string, ej: Ejecucion | null, plugin: PluginBuild | null, props: Record<string, string>, cli: Record<string, string>): Salto | undefined {
    const d = descriptor(ga, goal);
    for (const prop of [...(d?.salta ?? []), ...(SALTOS_EN_CODIGO[`${ga}#${goal}`] ?? [])]) {
        const v = cli[prop];
        if (v !== undefined && v.toLowerCase() !== "false")
            return { por: "propiedad", nombre: prop };
    }
    const conf = { ...(plugin?.saltos ?? {}), ...(ej?.saltos ?? {}) };
    for (const [k, v] of Object.entries(conf))
        if (interpolar(v, props).toLowerCase() === "true")
            return { por: "config", nombre: k };
    return undefined;
}
function pasoDe(e: Enlace, ef: Efectivo, cli: Record<string, string>): PasoPlan {
    const ga = `${e.plugin.grupo}:${e.plugin.artefacto}`;
    return {
        fase: e.fase,
        desfase: e.desfase,
        prioridad: e.prioridad,
        ga,
        prefijo: PLUGINS[ga]?.prefijo || prefijoSupuesto(e.plugin.artefacto),
        goal: e.goal,
        ejecucion: e.ej.id,
        origen: e.origen,
        tocadaEn: e.ej.tocadaEn.map(t => origenDe(t.fuente, t.perfil, t.linea)),
        salta: saltoDe(ga, e.goal, e.ej, e.plugin, ef.props, cli),
    };
}
export function prefijoSupuesto(artefacto: string): string {
    return artefacto.replace(/^maven-(.+)-plugin$/, "$1").replace(/^(.+)-maven-plugin$/, "$1");
}
function pasosDeFase(fase: string, porFase: Map<string, Enlace[]>, ef: Efectivo, cli: Record<string, string>): PasoPlan[] {
    return (porFase.get(fase) ?? []).map(e => pasoDe(e, ef, cli));
}
export function fasesHasta(fase: string, maven: VersionMaven): string[] {
    const ciclo = cicloDe(fase) as Ciclo | null;
    if (!ciclo)
        return [];
    const lista = FASES[ciclo];
    const hasta = lista.indexOf(fase);
    const out = lista.slice(0, hasta + 1);
    const post = `post-${fase}`;
    if (maven === "4" && lista.includes(post))
        out.push(post);
    return out;
}
function planModulo(ruta: string, ef: Efectivo, c: ComandoMvn, op: OpcionesPlan, avisos: AvisoPlan[]): ModuloPlan {
    const { enlaces: lista, noEjecuta, avisos: av } = enlaces(ef, op.maven);
    avisos.push(...av);
    const porFase = new Map<string, Enlace[]>();
    for (const e of lista) {
        const l = porFase.get(e.fase) ?? [];
        l.push(e);
        porFase.set(e.fase, l);
    }
    for (const l of porFase.values())
        l.sort((a, b) => a.desfase - b.desfase || a.prioridad - b.prioridad || a.orden - b.orden);
    const pasos: PasoPlan[] = [];
    const hechas = new Set<string>();
    const bifurcar = (p: PasoPlan): PasoPlan => {
        const d = descriptor(p.ga, p.goal);
        if (!d?.bifurcaFase || !cicloDe(d.bifurcaFase))
            return p;
        const fases = fasesHasta(d.bifurcaFase, "3");
        if (op.maven === "4" && fases.every(f => hechas.has(f)))
            return { ...p, bifurca: { hasta: d.bifurcaFase, pasos: [], omitida: "ya-hecha-maven-4" } };
        const dentro = fases.flatMap(f => pasosDeFase(f, porFase, ef, c.props));
        return { ...p, bifurca: { hasta: d.bifurcaFase, pasos: dentro } };
    };
    for (const t of c.tareas) {
        if (t.tipo === "fase") {
            for (const f of fasesHasta(t.fase, op.maven)) {
                for (const p of pasosDeFase(f, porFase, ef, c.props))
                    pasos.push(bifurcar(p));
                hechas.add(f);
            }
        }
        else if (t.tipo === "goal") {
            const plugin = resolverPlugin(t, ef.plugins);
            if (!plugin)
                continue;
            const pb = ef.plugins.find(p => `${p.grupo}:${p.artefacto}` === plugin.ga) ?? null;
            const ej = pb?.ejecuciones.find(e => e.id === t.ejecucion) ?? null;
            pasos.push(bifurcar({
                fase: null,
                desfase: 0,
                prioridad: 0,
                ga: plugin.ga,
                prefijo: plugin.prefijo,
                goal: t.goal,
                ejecucion: t.ejecucion,
                origen: { tipo: "cli" },
                tocadaEn: [],
                salta: saltoDe(plugin.ga, t.goal, ej, pb, ef.props, c.props),
            }));
        }
    }
    return {
        ruta,
        ga: `${ef.pom.grupo}:${ef.pom.artefacto}`,
        packaging: ef.pom.packaging || "jar",
        pasos,
        noEjecuta,
        perfiles: ef.perfiles,
        cadena: ef.cadena,
    };
}
export function resolverPlugin(t: Extract<Tarea, {
    tipo: "goal";
}>, plugins: PluginBuild[]): {
    ga: string;
    prefijo: string;
} | null {
    if (t.grupo && t.artefacto) {
        const ga = `${t.grupo}:${t.artefacto}`;
        return { ga, prefijo: PLUGINS[ga]?.prefijo || prefijoSupuesto(t.artefacto) };
    }
    const delPom = plugins.find(p => (PLUGINS[`${p.grupo}:${p.artefacto}`]?.prefijo || prefijoSupuesto(p.artefacto)) === t.prefijo);
    if (delPom)
        return { ga: `${delPom.grupo}:${delPom.artefacto}`, prefijo: t.prefijo };
    for (const grupo of [GRUPO_PLUGINS, "org.codehaus.mojo"]) {
        const ga = Object.keys(PLUGINS).find(k => k.startsWith(grupo + ":") && PLUGINS[k].prefijo === t.prefijo);
        if (ga)
            return { ga, prefijo: t.prefijo };
    }
    return null;
}
export function ordenReactor(rutas: string[], usa: Map<string, string[]>): string[] {
    const out: string[] = [];
    const estado = new Map<string, 1 | 2>();
    const visita = (r: string) => {
        if (estado.get(r))
            return;
        estado.set(r, 1);
        for (const d of usa.get(r) ?? [])
            visita(d);
        estado.set(r, 2);
        out.push(r);
    };
    for (const r of rutas)
        visita(r);
    return out;
}
export function planMaven(poms: PomEntrada[], op: OpcionesPlan): PlanMaven {
    const maven: VersionMaven = op?.maven === "4" ? "4" : "3";
    const opciones: OpcionesPlan = { ...op, maven };
    const c = leerComando(op?.comando ?? "", maven);
    const avisos: AvisoPlan[] = [];
    const vacio: PlanMaven = { comando: c, maven, reactor: [], fuera: [], avisos };
    const porRuta = new Map<string, PomBuild>();
    for (const p of Array.isArray(poms) ? poms : []) {
        if (!p || typeof p.ruta !== "string")
            continue;
        const ruta = normalizar(p.ruta) || "pom.xml";
        const pb = leerPomBuild(p.xml, { tipo: "pom", ruta });
        if (pb)
            porRuta.set(ruta, pb);
    }
    if (!porRuta.size) {
        avisos.push({ codigo: "sin-poms", datos: {} });
        return vacio;
    }
    for (const t of c.tareas) {
        if (t.tipo === "desconocida")
            avisos.push({ codigo: t.motivo === "solo-maven-4" ? "tarea-solo-maven-4" : "tarea-desconocida", datos: { tarea: t.escrita } });
    }
    if (!c.tareas.some(t => t.tipo !== "desconocida"))
        avisos.push({ codigo: "sin-tareas", datos: {} });
    const raiz = [...porRuta.keys()].sort((a, b) => a.split("/").length - b.split("/").length || a.localeCompare(b))[0];
    const efectivos = new Map<string, Efectivo>();
    const ef = (r: string) => {
        if (!efectivos.has(r)) {
            const e = efectivo(r, porRuta, c, opciones, avisos);
            if (e)
                efectivos.set(r, e);
        }
        return efectivos.get(r);
    };
    const recogidos: string[] = [];
    const recoge = (r: string, hondo: number) => {
        if (recogidos.includes(r) || hondo > 30)
            return;
        const p = porRuta.get(r);
        if (!p)
            return;
        recogidos.push(r);
        if (p.usaSubprojects && maven === "3")
            avisos.push({ codigo: "subprojects-en-maven-3", datos: { modulo: r } });
        const mods = [...p.modulos, ...(ef(r)?.modulosPerfil ?? [])];
        for (const m of mods) {
            const hija = pomDeModulo(dirDe(r), m);
            if (!porRuta.has(hija)) {
                avisos.push({ codigo: "modulo-no-cargado", datos: { modulo: m, ruta: hija, desde: r } });
                continue;
            }
            recoge(hija, hondo + 1);
        }
    };
    recoge(raiz, 0);
    if (c.noRecursivo)
        recogidos.splice(1);
    const porGa = new Map<string, string>(recogidos.map(r => [`${porRuta.get(r)!.grupo}:${porRuta.get(r)!.artefacto}`, r]));
    const usa = new Map<string, string[]>();
    for (const r of recogidos) {
        const p = porRuta.get(r)!;
        const deps = [...p.usa];
        if (p.padre)
            deps.push(`${p.padre.grupo}:${p.padre.artefacto}`);
        usa.set(r, deps.map(ga => porGa.get(ga)).filter((x): x is string => !!x && x !== r));
    }
    const orden = ordenReactor(recogidos, usa);
    let elegidos = new Set(orden);
    if (c.pl.length) {
        const incluir = new Set<string>(), excluir = new Set<string>();
        for (const sel of c.pl) {
            const neg = sel.startsWith("!") || sel.startsWith("-");
            const s = sel.replace(/^[!?-]/, "");
            const hallado = orden.find(r => {
                const p = porRuta.get(r)!;
                if (s.startsWith(":"))
                    return p.artefacto === s.slice(1);
                if (/^[^/\\]+:[^/\\]+$/.test(s))
                    return `${p.grupo}:${p.artefacto}` === s;
                const dir = normalizar(unir(dirDe(raiz), s)).replace(/\/?pom\.xml$/i, "");
                return dirDe(r) === dir;
            });
            if (!hallado) {
                if (!sel.startsWith("?"))
                    avisos.push({ codigo: "pl-no-encontrado", datos: { seleccion: sel } });
                continue;
            }
            (neg ? excluir : incluir).add(hallado);
        }
        const base = incluir.size ? new Set(incluir) : new Set(orden);
        if (c.am) {
            const sube = (r: string) => { for (const d of usa.get(r) ?? [])
                if (!base.has(d)) {
                    base.add(d);
                    sube(d);
                } };
            for (const r of [...base])
                sube(r);
        }
        if (c.amd) {
            const baja = (r: string) => { for (const [o, ds] of usa)
                if (ds.includes(r) && !base.has(o)) {
                    base.add(o);
                    baja(o);
                } };
            for (const r of [...base])
                baja(r);
        }
        for (const r of excluir)
            base.delete(r);
        elegidos = base;
    }
    if (c.reanudarDesde) {
        const s = c.reanudarDesde.replace(/^:/, "");
        const i = orden.findIndex(r => porRuta.get(r)!.artefacto === s || dirDe(r) === normalizar(unir(dirDe(raiz), s)));
        if (i >= 0)
            for (const r of orden.slice(0, i))
                elegidos.delete(r);
        else
            avisos.push({ codigo: "pl-no-encontrado", datos: { seleccion: c.reanudarDesde } });
    }
    const todosLosPerfiles = new Set([...efectivos.values()].flatMap(e => e.perfiles.map(p => p.id)));
    for (const r of orden)
        ef(r)?.perfiles.forEach(p => todosLosPerfiles.add(p.id));
    for (const p of c.perfilesActivar)
        if (!todosLosPerfiles.has(p))
            avisos.push({ codigo: "perfil-no-existe", datos: { perfil: p } });
    const reactor: ModuloPlan[] = [];
    for (const r of orden) {
        if (!elegidos.has(r))
            continue;
        const e = ef(r);
        if (!e)
            continue;
        for (const t of c.tareas) {
            if (t.tipo === "goal" && !resolverPlugin(t, e.plugins) && !avisos.some(a => a.codigo === "prefijo-desconocido" && a.datos["tarea"] === t.escrita)) {
                avisos.push({ codigo: "prefijo-desconocido", datos: { tarea: t.escrita } });
            }
        }
        reactor.push(planModulo(r, e, c, opciones, avisos));
    }
    const pide = (f: string) => c.tareas.some(t => t.tipo === "fase" && t.fase === f);
    const enlazaA = (f: string) => [...efectivos.values()].some(e => enlaces(e, maven).enlaces.some(x => x.fase === f));
    if (maven === "3" && pide("integration-test") && enlazaA("post-integration-test"))
        avisos.push({ codigo: "integration-test-sin-post", datos: {} });
    if (maven === "4" && pide("clean") && enlazaA("post-clean"))
        avisos.push({ codigo: "post-clean-maven-4", datos: {} });
    return { comando: c, maven, reactor, fuera: orden.filter(r => !elegidos.has(r)), avisos: dedup(avisos) };
}
function dedup(avisos: AvisoPlan[]): AvisoPlan[] {
    const vistos = new Set<string>();
    return avisos.filter(a => { const k = a.codigo + JSON.stringify(a.datos); if (vistos.has(k))
        return false; vistos.add(k); return true; });
}
export { compararVersiones };
