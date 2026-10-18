import { Carga, HallazgoK8s, Modelo, Pdb, casa } from "./k8s-network";
const lista = (x: unknown): any[] => (Array.isArray(x) ? x : []);
const obj = (x: unknown): Record<string, any> => (x && typeof x === "object" && !Array.isArray(x) ? x as Record<string, any> : {});
function canonico(x: unknown): string {
    if (Array.isArray(x))
        return `[${x.map(canonico).join(",")}]`;
    if (x && typeof x === "object")
        return `{${Object.keys(x).sort().map(k => `${JSON.stringify(k)}:${canonico((x as any)[k])}`).join(",")}}`;
    return JSON.stringify(x);
}
export function imagenSinVersion(imagen: string): boolean {
    if (imagen.includes("@"))
        return false;
    const ultimo = imagen.slice(imagen.lastIndexOf("/") + 1);
    const i = ultimo.lastIndexOf(":");
    return i < 0 || ultimo.slice(i + 1) === "latest";
}
export function recursosQueFaltan(c: Record<string, any>): string[] {
    const req = obj(obj(c["resources"])["requests"]), lim = obj(obj(c["resources"])["limits"]);
    const falta: string[] = [];
    if (req["cpu"] === undefined && lim["cpu"] === undefined)
        falta.push("requests.cpu");
    if (req["memory"] === undefined && lim["memory"] === undefined)
        falta.push("requests.memory");
    if (lim["memory"] === undefined)
        falta.push("limits.memory");
    return falta;
}
export function interrupcionesPermitidas(pdb: Pdb, replicas: number | undefined): number | null {
    const escala = (v: number | string, r: number) => (typeof v === "number" ? v : Math.ceil(r * parseFloat(v) / 100));
    if (pdb.maxUnavailable !== undefined) {
        if (replicas === undefined)
            return /^0%?$/.test(String(pdb.maxUnavailable)) ? 0 : null;
        return escala(pdb.maxUnavailable, replicas);
    }
    if (pdb.minAvailable !== undefined) {
        if (replicas === undefined)
            return String(pdb.minAvailable) === "100%" ? 0 : null;
        return Math.max(0, replicas - escala(pdb.minAvailable, replicas));
    }
    return null;
}
const CON_REPLICAS = new Set(["Deployment", "StatefulSet"]);
const DE_LARGA_VIDA = (c: Carga) => c.tipo !== "Job" && c.tipo !== "CronJob";
export function hallazgosFiabilidad(m: Modelo): HallazgoK8s[] {
    const out: HallazgoK8s[] = [];
    const conLimitRange = new Set([...m.definidos].filter(x => x.startsWith("LimitRange ")).map(x => x.slice(11).split("/")[0]));
    for (const c of m.cargas) {
        const frag = `${c.tipo} ${c.id}`;
        const contenedores = lista(c.spec["containers"]).map(obj);
        const todos = [...lista(c.spec["initContainers"]).map(obj), ...contenedores];
        if (!conLimitRange.has(c.ns))
            for (const k of todos) {
                const falta = recursosQueFaltan(k);
                if (falta.length)
                    out.push({ regla: "sin-recursos", gravedad: "aviso", fragmento: frag, datos: { contenedor: String(k["name"] ?? ""), faltan: falta.join(", ") } });
            }
        for (const k of todos) {
            const img = String(k["image"] ?? "");
            if (img && imagenSinVersion(img))
                out.push({ regla: "imagen-sin-version", gravedad: "aviso", fragmento: frag, datos: { contenedor: String(k["name"] ?? ""), imagen: img } });
        }
        const servicio = DE_LARGA_VIDA(c) ? m.servicios.find(s => s.ns === c.ns && s.selector && s.tipo !== "ExternalName" && casa({ matchLabels: s.selector }, c.labels)) : undefined;
        if (servicio)
            for (const k of contenedores) {
                if (!k["readinessProbe"])
                    out.push({ regla: "sin-readiness", gravedad: "aviso", fragmento: frag, datos: { contenedor: String(k["name"] ?? ""), servicio: servicio.nombre } });
            }
        for (const k of contenedores) {
            if (k["readinessProbe"] && k["livenessProbe"] && canonico(k["readinessProbe"]) === canonico(k["livenessProbe"])) {
                out.push({ regla: "sondas-iguales", gravedad: "aviso", fragmento: frag, datos: { contenedor: String(k["name"] ?? "") } });
            }
        }
        const pdbs = m.pdbs.filter(p => p.ns === c.ns && p.selector && casa(p.selector, c.labels));
        for (const p of pdbs) {
            if (interrupcionesPermitidas(p, c.replicas) === 0) {
                out.push({ regla: "pdb-bloquea", gravedad: "aviso", fragmento: frag, datos: { pdb: p.nombre, replicas: c.replicas === undefined ? "?" : String(c.replicas) } });
            }
        }
        if (!CON_REPLICAS.has(c.tipo) || c.replicas === undefined)
            continue;
        if (c.tipo === "Deployment" && c.replicas === 1)
            out.push({ regla: "una-replica", gravedad: "info", fragmento: frag });
        if (c.replicas < 2)
            continue;
        if (!pdbs.length)
            out.push({ regla: "sin-pdb", gravedad: "info", fragmento: frag, datos: { replicas: String(c.replicas) } });
        const reparte = !!obj(c.spec["affinity"])["podAntiAffinity"] || lista(c.spec["topologySpreadConstraints"]).length > 0;
        if (!reparte)
            out.push({ regla: "sin-antiafinidad", gravedad: "info", fragmento: frag, datos: { replicas: String(c.replicas) } });
    }
    return out;
}
