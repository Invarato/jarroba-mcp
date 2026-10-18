import * as jsYaml from "js-yaml";
export type Proto = "TCP" | "UDP" | "SCTP";
export interface Rango {
    proto: Proto;
    desde: number;
    hasta: number;
}
export type Conexiones = "todas" | Rango[];
interface ExprSelector {
    key: string;
    operator: string;
    values?: string[];
}
export interface Selector {
    matchLabels?: Record<string, string>;
    matchExpressions?: ExprSelector[];
}
export interface PuertoContenedor {
    nombre?: string;
    numero: number;
    proto: Proto;
}
export interface Referencia {
    tipo: "ConfigMap" | "Secret" | "ServiceAccount";
    nombre: string;
}
export interface Carga {
    id: string;
    ns: string;
    nombre: string;
    tipo: string;
    labels: Record<string, string>;
    puertos: PuertoContenedor[];
    refs: Referencia[];
    spec: Record<string, any>;
    anotaciones: Record<string, string>;
    replicas?: number;
}
export interface Pdb {
    id: string;
    ns: string;
    nombre: string;
    selector: Selector | null;
    minAvailable?: number | string;
    maxUnavailable?: number | string;
}
export type Peer = {
    tipo: "pods";
    ns: Selector | "propio";
    pods: Selector;
} | {
    tipo: "ip";
    cidr: string;
    except: string[];
};
export interface PuertoRegla {
    proto: Proto;
    port?: number | string;
    endPort?: number;
}
export interface Regla {
    peers: Peer[] | null;
    puertos: PuertoRegla[] | null;
}
export interface Politica {
    id: string;
    ns: string;
    nombre: string;
    selector: Selector;
    ingress: Regla[] | null;
    egress: Regla[] | null;
}
export interface Servicio {
    id: string;
    ns: string;
    nombre: string;
    selector: Record<string, string> | null;
    tipo: string;
    targetPorts: (number | string)[];
}
export type ReglaK8s = "yaml-invalido" | "politica-sin-pods" | "peer-sin-pods" | "peers-separados" | "servicio-sin-pods" | "servicio-puerto-inexistente" | "referencia-inexistente" | "inalcanzable" | "namespace-sin-politicas" | "red-del-nodo" | "pss-rechazado" | "pss-privilegiado" | "pss-aviso" | "sa-peligrosa" | "sa-token-innecesario" | "sin-recursos" | "sin-readiness" | "sondas-iguales" | "imagen-sin-version" | "sin-pdb" | "pdb-bloquea" | "una-replica" | "sin-antiafinidad";
export interface HallazgoK8s {
    regla: ReglaK8s;
    gravedad: "alto" | "aviso" | "info";
    fragmento: string;
    datos?: Record<string, string>;
}
export interface Modelo {
    cargas: Carga[];
    politicas: Politica[];
    servicios: Servicio[];
    namespaces: Map<string, Record<string, string>>;
    definidos: Set<string>;
    errores: string[];
    redDelNodo: string[];
    pdbs: Pdb[];
}
export const EXTERNO = "(externo)";
const PROTOS: Proto[] = ["TCP", "UDP", "SCTP"];
const proto = (p: unknown): Proto => (PROTOS.includes(p as Proto) ? p as Proto : "TCP");
const obj = (x: unknown): Record<string, any> => (x && typeof x === "object" && !Array.isArray(x) ? x as Record<string, any> : {});
const lista = (x: unknown): any[] => (Array.isArray(x) ? x : []);
const etiquetas = (x: unknown): Record<string, string> => Object.fromEntries(Object.entries(obj(x)).map(([k, v]) => [k, String(v)]));
export function casa(sel: Selector, labels: Record<string, string>): boolean {
    for (const [k, v] of Object.entries(sel.matchLabels ?? {}))
        if (labels[k] !== v)
            return false;
    for (const e of sel.matchExpressions ?? []) {
        const tiene = e.key in labels;
        const vals = e.values ?? [];
        switch (e.operator) {
            case "In":
                if (!tiene || !vals.includes(labels[e.key]))
                    return false;
                break;
            case "NotIn":
                if (tiene && vals.includes(labels[e.key]))
                    return false;
                break;
            case "Exists":
                if (!tiene)
                    return false;
                break;
            case "DoesNotExist":
                if (tiene)
                    return false;
                break;
            default: return false;
        }
    }
    return true;
}
const selector = (x: unknown): Selector => {
    const o = obj(x);
    return { matchLabels: etiquetas(o["matchLabels"]), matchExpressions: lista(o["matchExpressions"]).map(obj) as ExprSelector[] };
};
const PLANTILLA: Record<string, (s: any) => any> = {
    Deployment: s => s?.template,
    ReplicaSet: s => s?.template,
    StatefulSet: s => s?.template,
    DaemonSet: s => s?.template,
    Job: s => s?.template,
    ReplicationController: s => s?.template,
    CronJob: s => s?.jobTemplate?.spec?.template,
};
function refsDe(spec: any): Referencia[] {
    const refs: Referencia[] = [];
    const add = (tipo: Referencia["tipo"], nombre: unknown, opcional: unknown) => {
        if (typeof nombre === "string" && nombre && opcional !== true)
            refs.push({ tipo, nombre });
    };
    const sa = spec?.serviceAccountName ?? spec?.serviceAccount;
    if (typeof sa === "string" && sa !== "default")
        add("ServiceAccount", sa, false);
    for (const v of lista(spec?.volumes)) {
        add("ConfigMap", v?.configMap?.name, v?.configMap?.optional);
        add("Secret", v?.secret?.secretName, v?.secret?.optional);
        for (const s of lista(v?.projected?.sources)) {
            add("ConfigMap", s?.configMap?.name, s?.configMap?.optional);
            add("Secret", s?.secret?.name, s?.secret?.optional);
        }
    }
    for (const s of lista(spec?.imagePullSecrets))
        add("Secret", s?.name, false);
    for (const c of [...lista(spec?.containers), ...lista(spec?.initContainers)]) {
        for (const ef of lista(c?.envFrom)) {
            add("ConfigMap", ef?.configMapRef?.name, ef?.configMapRef?.optional);
            add("Secret", ef?.secretRef?.name, ef?.secretRef?.optional);
        }
        for (const e of lista(c?.env)) {
            add("ConfigMap", e?.valueFrom?.configMapKeyRef?.name, e?.valueFrom?.configMapKeyRef?.optional);
            add("Secret", e?.valueFrom?.secretKeyRef?.name, e?.valueFrom?.secretKeyRef?.optional);
        }
    }
    return refs.filter((r, i) => refs.findIndex(o => o.tipo === r.tipo && o.nombre === r.nombre) === i);
}
function peerDe(p: any): Peer | null {
    const o = obj(p);
    if (o["ipBlock"])
        return { tipo: "ip", cidr: String(o["ipBlock"]?.cidr ?? ""), except: lista(o["ipBlock"]?.except).map(String) };
    const tienePods = "podSelector" in o, tieneNs = "namespaceSelector" in o;
    if (!tienePods && !tieneNs)
        return null;
    return { tipo: "pods", ns: tieneNs ? selector(o["namespaceSelector"]) : "propio", pods: tienePods ? selector(o["podSelector"]) : {} };
}
function reglas(x: unknown, campoPeers: "from" | "to"): Regla[] {
    return lista(x).map(r => {
        const o = obj(r);
        const peersCrudos = lista(o[campoPeers]);
        const puertosCrudos = lista(o["ports"]);
        return {
            peers: peersCrudos.length ? peersCrudos.map(peerDe).filter((p): p is Peer => !!p) : null,
            puertos: puertosCrudos.length ? puertosCrudos.map(pp => {
                const q = obj(pp);
                return { proto: proto(q["protocol"]), port: q["port"] as number | string | undefined, endPort: typeof q["endPort"] === "number" ? q["endPort"] : undefined };
            }) : null,
        };
    });
}
export function leer(texto: string): Modelo {
    const m: Modelo = { cargas: [], politicas: [], servicios: [], namespaces: new Map(), definidos: new Set(), errores: [], redDelNodo: [], pdbs: [] };
    const hpas: {
        objetivo: string;
        min: number;
    }[] = [];
    const pendientes: any[] = [];
    for (const trozo of texto.split(/^---[ \t]*$/m)) {
        if (!trozo.trim())
            continue;
        try {
            pendientes.push(...jsYaml.loadAll(trozo));
        }
        catch (e) {
            m.errores.push(String((e as Error).message ?? e).split("\n")[0]);
        }
    }
    while (pendientes.length) {
        const d = obj(pendientes.shift());
        const kind = String(d["kind"] ?? "");
        if (kind.endsWith("List")) {
            const deLista = kind === "List" ? "" : kind.slice(0, -4);
            pendientes.push(...lista(d["items"]).map(i => ({ kind: deLista || undefined, ...obj(i) })));
            continue;
        }
        const meta = obj(d["metadata"]);
        const nombre = String(meta["name"] ?? "");
        const ns = String(meta["namespace"] ?? "default");
        if (!kind || !nombre)
            continue;
        const spec = obj(d["spec"]);
        if (kind === "Namespace") {
            m.namespaces.set(nombre, etiquetas(meta["labels"]));
            continue;
        }
        if (!m.namespaces.has(ns))
            m.namespaces.set(ns, {});
        if (["ConfigMap", "Secret", "ServiceAccount", "LimitRange"].includes(kind)) {
            m.definidos.add(`${kind} ${ns}/${nombre}`);
            continue;
        }
        if (kind === "Service") {
            const sel = spec["selector"];
            m.servicios.push({ id: `${ns}/${nombre}`, ns, nombre, tipo: String(spec["type"] ?? "ClusterIP"), selector: sel && typeof sel === "object" && Object.keys(sel).length ? etiquetas(sel) : null, targetPorts: lista(spec["ports"]).map(p => obj(p)["targetPort"] ?? obj(p)["port"]).filter(v => v !== undefined) });
            continue;
        }
        if (kind === "NetworkPolicy") {
            const tipos = lista(spec["policyTypes"]).map(String);
            const conIngress = tipos.length ? tipos.includes("Ingress") : true;
            const conEgress = tipos.length ? tipos.includes("Egress") : "egress" in spec;
            m.politicas.push({ id: `${ns}/${nombre}`, ns, nombre, selector: selector(spec["podSelector"]), ingress: conIngress ? reglas(spec["ingress"], "from") : null, egress: conEgress ? reglas(spec["egress"], "to") : null });
            continue;
        }
        if (kind === "PodDisruptionBudget") {
            const v = (x: unknown) => (typeof x === "number" || typeof x === "string" ? x : undefined);
            m.pdbs.push({ id: `${ns}/${nombre}`, ns, nombre, selector: spec["selector"] ? selector(spec["selector"]) : null, minAvailable: v(spec["minAvailable"]), maxUnavailable: v(spec["maxUnavailable"]) });
            continue;
        }
        if (kind === "HorizontalPodAutoscaler") {
            const ref = obj(spec["scaleTargetRef"]);
            hpas.push({ objetivo: `${ref["kind"]} ${ns}/${ref["name"]}`, min: typeof spec["minReplicas"] === "number" ? spec["minReplicas"] : 1 });
            continue;
        }
        const plantilla = kind === "Pod" ? d : PLANTILLA[kind]?.(spec);
        if (!plantilla)
            continue;
        const pm = obj(obj(plantilla)["metadata"]);
        const ps = obj(obj(plantilla)["spec"]);
        if (ps["hostNetwork"] === true)
            m.redDelNodo.push(`${kind} ${ns}/${nombre}`);
        const puertos: PuertoContenedor[] = [];
        for (const c of lista(ps["containers"]))
            for (const p of lista(obj(c)["ports"])) {
                const q = obj(p);
                if (typeof q["containerPort"] === "number")
                    puertos.push({ nombre: q["name"] ? String(q["name"]) : undefined, numero: q["containerPort"], proto: proto(q["protocol"]) });
            }
        const labels = etiquetas(kind === "Pod" ? meta["labels"] : pm["labels"]);
        const dueno = kind === "Pod" ? lista(meta["ownerReferences"]).map(obj).find(o => o["controller"] === true && o["name"] && o["kind"] !== "Node") : undefined;
        if (dueno) {
            const id = `${ns}/${dueno["name"]}`;
            const previa = m.cargas.find(c => c.id === id);
            const iguales = (x: Record<string, string>) => JSON.stringify(Object.entries(x).sort()) === JSON.stringify(Object.entries(labels).sort());
            if (previa && iguales(previa.labels)) {
                for (const p of puertos)
                    if (!previa.puertos.some(q => q.numero === p.numero && q.proto === p.proto && q.nombre === p.nombre))
                        previa.puertos.push(p);
                continue;
            }
            if (!previa) {
                m.cargas.push({ id, ns, nombre: String(dueno["name"]), tipo: String(dueno["kind"] ?? kind), labels, puertos, refs: refsDe(ps), spec: ps, anotaciones: etiquetas(kind === "Pod" ? meta["annotations"] : pm["annotations"]) });
                continue;
            }
        }
        const replicas = kind === "Deployment" || kind === "StatefulSet" ? (typeof spec["replicas"] === "number" ? spec["replicas"] : 1) : undefined;
        m.cargas.push({ id: `${ns}/${nombre}`, ns, nombre, tipo: kind, labels, puertos, refs: refsDe(ps), spec: ps, anotaciones: etiquetas(kind === "Pod" ? meta["annotations"] : pm["annotations"]), ...(replicas !== undefined ? { replicas } : {}) });
    }
    for (const c of m.cargas) {
        const h = hpas.find(x => x.objetivo === `${c.tipo} ${c.id}`);
        if (h && c.replicas !== undefined)
            c.replicas = h.min;
    }
    for (const [n, l] of m.namespaces)
        m.namespaces.set(n, { ...l, "kubernetes.io/metadata.name": n });
    return m;
}
const TODO_PROTO = (p: Proto): Rango => ({ proto: p, desde: 1, hasta: 65535 });
export function normalizar(rs: Rango[]): Conexiones {
    const out: Rango[] = [];
    for (const p of PROTOS) {
        const del = rs.filter(r => r.proto === p).sort((a, b) => a.desde - b.desde);
        for (const r of del) {
            const ult = out[out.length - 1];
            if (ult && ult.proto === p && r.desde <= ult.hasta + 1)
                ult.hasta = Math.max(ult.hasta, r.hasta);
            else
                out.push({ ...r });
        }
    }
    return PROTOS.every(p => out.some(r => r.proto === p && r.desde === 1 && r.hasta === 65535)) ? "todas" : out;
}
const comoRangos = (c: Conexiones): Rango[] => (c === "todas" ? PROTOS.map(TODO_PROTO) : c);
export const unir = (a: Conexiones, b: Conexiones): Conexiones => normalizar([...comoRangos(a), ...comoRangos(b)]);
export function cruzar(a: Conexiones, b: Conexiones): Conexiones {
    const out: Rango[] = [];
    for (const x of comoRangos(a))
        for (const y of comoRangos(b)) {
            if (x.proto !== y.proto)
                continue;
            const desde = Math.max(x.desde, y.desde), hasta = Math.min(x.hasta, y.hasta);
            if (desde <= hasta)
                out.push({ proto: x.proto, desde, hasta });
        }
    return normalizar(out);
}
function puertosDeRegla(r: Regla, destino: Carga | null): Conexiones {
    if (!r.puertos)
        return "todas";
    const rs: Rango[] = [];
    for (const p of r.puertos) {
        if (p.port === undefined) {
            rs.push(TODO_PROTO(p.proto));
            continue;
        }
        if (typeof p.port === "number") {
            rs.push({ proto: p.proto, desde: p.port, hasta: p.endPort ?? p.port });
            continue;
        }
        for (const c of destino?.puertos ?? [])
            if (c.nombre === p.port && c.proto === p.proto)
                rs.push({ proto: c.proto, desde: c.numero, hasta: c.numero });
    }
    return normalizar(rs);
}
function peerCasa(p: Peer, pol: Politica, otro: Carga | null, m: Modelo): boolean {
    if (p.tipo === "ip")
        return otro === null;
    if (!otro)
        return false;
    const nsOk = p.ns === "propio" ? otro.ns === pol.ns : casa(p.ns, m.namespaces.get(otro.ns) ?? {});
    return nsOk && casa(p.pods, otro.labels);
}
export interface Lado {
    aislado: boolean;
    politicas: string[];
    permiten: {
        politica: string;
        regla: number;
        conexiones: Conexiones;
        parcial: boolean;
    }[];
    conexiones: Conexiones;
    parcial: boolean;
}
function lado(dir: "ingress" | "egress", yo: Carga | null, otro: Carga | null, destino: Carga | null, m: Modelo): Lado {
    if (!yo)
        return { aislado: false, politicas: [], permiten: [], conexiones: "todas", parcial: false };
    const pols = m.politicas.filter(p => p[dir] !== null && p.ns === yo.ns && casa(p.selector, yo.labels));
    if (!pols.length)
        return { aislado: false, politicas: [], permiten: [], conexiones: "todas", parcial: false };
    const permiten: Lado["permiten"] = [];
    let total: Conexiones = [];
    let parcial = false;
    for (const pol of pols)
        (pol[dir] ?? []).forEach((r, i) => {
            const peersQueCasan = r.peers === null ? null : r.peers.filter(p => peerCasa(p, pol, otro, m));
            if (peersQueCasan !== null && !peersQueCasan.length)
                return;
            const esParcial = otro === null && peersQueCasan !== null
                && !peersQueCasan.some(p => p.tipo === "ip" && /^0\.0\.0\.0\/0$|^::\/0$/.test(p.cidr) && !p.except.length);
            const c = puertosDeRegla(r, destino);
            if (c !== "todas" && !c.length)
                return;
            permiten.push({ politica: pol.id, regla: i, conexiones: c, parcial: esParcial });
            total = unir(total, c);
            parcial ||= esParcial;
        });
    return { aislado: true, politicas: pols.map(p => p.id), permiten, conexiones: total, parcial: parcial && !permiten.some(p => !p.parcial) };
}
export interface Explicacion {
    salida: Lado;
    entrada: Lado;
    conexiones: Conexiones;
    parcial: boolean;
}
export function explicar(m: Modelo, origen: string, destino: string): Explicacion {
    const a = origen === EXTERNO ? null : m.cargas.find(c => c.id === origen) ?? null;
    const b = destino === EXTERNO ? null : m.cargas.find(c => c.id === destino) ?? null;
    const salida = lado("egress", a, b, b, m);
    const entrada = lado("ingress", b, a, b, m);
    return { salida, entrada, conexiones: cruzar(salida.conexiones, entrada.conexiones), parcial: salida.parcial || entrada.parcial };
}
export interface Matriz {
    nodos: string[];
    celdas: Record<string, Record<string, {
        conexiones: Conexiones;
        parcial: boolean;
    }>>;
}
export function matriz(m: Modelo): Matriz {
    const nodos = [...m.cargas.map(c => c.id), EXTERNO];
    const celdas: Matriz["celdas"] = {};
    for (const o of nodos) {
        celdas[o] = {};
        for (const d of nodos) {
            if (o === d)
                continue;
            if (o === EXTERNO && d === EXTERNO)
                continue;
            const e = explicar(m, o, d);
            celdas[o][d] = { conexiones: e.conexiones, parcial: e.parcial };
        }
    }
    return { nodos, celdas };
}
export function textoConexiones(c: Rango[]): string {
    return PROTOS.map(p => {
        const del = c.filter(r => r.proto === p);
        return del.length ? `${p} ${del.map(r => (r.desde === r.hasta ? `${r.desde}` : `${r.desde}-${r.hasta}`)).join(", ")}` : "";
    }).filter(Boolean).join(" \u00B7 ");
}
export function hallazgos(m: Modelo): HallazgoK8s[] {
    const out: HallazgoK8s[] = [];
    for (const e of m.errores)
        out.push({ regla: "yaml-invalido", gravedad: "alto", fragmento: e });
    for (const pol of m.politicas) {
        const pods = m.cargas.filter(c => c.ns === pol.ns && casa(pol.selector, c.labels));
        if (!pods.length && m.cargas.length)
            out.push({ regla: "politica-sin-pods", gravedad: "aviso", fragmento: `NetworkPolicy ${pol.id}` });
        for (const dir of ["ingress", "egress"] as const)
            (pol[dir] ?? []).forEach((r, i) => {
                const peersPods = (r.peers ?? []).filter((p): p is Extract<Peer, {
                    tipo: "pods";
                }> => p.tipo === "pods");
                for (const p of peersPods) {
                    const alguno = m.cargas.some(c => peerCasa(p, pol, c, m));
                    if (!alguno && m.cargas.length)
                        out.push({ regla: "peer-sin-pods", gravedad: "aviso", fragmento: `NetworkPolicy ${pol.id}`, datos: { direccion: dir, regla: String(i + 1) } });
                }
                const soloNs = peersPods.some(p => p.ns !== "propio" && !Object.keys(p.pods.matchLabels ?? {}).length && !(p.pods.matchExpressions ?? []).length);
                const soloPods = peersPods.some(p => p.ns === "propio");
                if (soloNs && soloPods)
                    out.push({ regla: "peers-separados", gravedad: "aviso", fragmento: `NetworkPolicy ${pol.id}`, datos: { direccion: dir, regla: String(i + 1) } });
            });
    }
    for (const s of m.servicios) {
        if (!s.selector || s.tipo === "ExternalName")
            continue;
        const pods = m.cargas.filter(c => c.ns === s.ns && casa({ matchLabels: s.selector! }, c.labels));
        if (!pods.length) {
            out.push({ regla: "servicio-sin-pods", gravedad: "aviso", fragmento: `Service ${s.id}` });
            continue;
        }
        for (const tp of s.targetPorts) {
            if (typeof tp === "string" && !pods.some(c => c.puertos.some(p => p.nombre === tp))) {
                out.push({ regla: "servicio-puerto-inexistente", gravedad: "aviso", fragmento: `Service ${s.id}`, datos: { puerto: tp } });
            }
        }
    }
    for (const c of m.cargas)
        for (const r of c.refs) {
            if (!m.definidos.has(`${r.tipo} ${c.ns}/${r.nombre}`)) {
                out.push({ regla: "referencia-inexistente", gravedad: "info", fragmento: `${c.tipo} ${c.id}`, datos: { tipo: r.tipo, nombre: r.nombre } });
            }
        }
    for (const c of m.cargas) {
        const e = explicar(m, EXTERNO, c.id);
        if (!e.entrada.aislado)
            continue;
        const alguien = [EXTERNO, ...m.cargas.map(x => x.id)].some(o => o !== c.id && (() => {
            const x = explicar(m, o, c.id).conexiones;
            return x === "todas" || x.length > 0;
        })());
        if (!alguien)
            out.push({ regla: "inalcanzable", gravedad: "aviso", fragmento: `${c.tipo} ${c.id}` });
    }
    for (const ns of m.namespaces.keys()) {
        if (m.cargas.some(c => c.ns === ns) && !m.politicas.some(p => p.ns === ns)) {
            out.push({ regla: "namespace-sin-politicas", gravedad: "info", fragmento: `Namespace ${ns}` });
        }
    }
    for (const p of m.redDelNodo)
        out.push({ regla: "red-del-nodo", gravedad: "info", fragmento: p });
    const orden = { alto: 0, aviso: 1, info: 2 };
    return out.sort((a, b) => orden[a.gravedad] - orden[b.gravedad]);
}
