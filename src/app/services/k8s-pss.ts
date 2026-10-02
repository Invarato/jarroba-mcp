import { Carga, HallazgoK8s, Modelo } from "./k8s-network";
export type NivelPss = "privileged" | "baseline" | "restricted";
export type CheckPss = "windowsHostProcess" | "hostNamespaces" | "privileged" | "capabilities_baseline" | "hostPathVolumes" | "hostPorts" | "hostProbesAndHostLifecycle" | "appArmorProfile" | "seLinuxOptions" | "procMount" | "seccompProfile_baseline" | "sysctls" | "restrictedVolumes" | "allowPrivilegeEscalation" | "runAsNonRoot" | "runAsUser" | "seccompProfile_restricted" | "capabilities_restricted" | "procMount_restricted";
type Spec = Record<string, any>;
const lista = (x: unknown): any[] => (Array.isArray(x) ? x : []);
const contenedores = (s: Spec): any[] => [...lista(s["initContainers"]), ...lista(s["containers"]), ...lista(s["ephemeralContainers"])];
const sc = (c: any): any => c?.securityContext;
const psc = (s: Spec): any => s["securityContext"];
const windows = (s: Spec) => s["os"]?.name === "windows";
const usuarioAislado = (s: Spec) => s["hostUsers"] === false;
const CAPS_BASELINE = new Set(["AUDIT_WRITE", "CHOWN", "DAC_OVERRIDE", "FOWNER", "FSETID", "KILL", "MKNOD", "NET_BIND_SERVICE", "SETFCAP", "SETGID", "SETPCAP", "SETUID", "SYS_CHROOT"]);
const SELINUX_TIPOS = new Set(["", "container_t", "container_init_t", "container_kvm_t", "container_engine_t"]);
const SYSCTLS = new Set(["kernel.shm_rmid_forced", "net.ipv4.ip_local_port_range", "net.ipv4.tcp_syncookies", "net.ipv4.ping_group_range", "net.ipv4.ip_unprivileged_port_start", "net.ipv4.ip_local_reserved_ports", "net.ipv4.tcp_keepalive_time", "net.ipv4.tcp_fin_timeout", "net.ipv4.tcp_keepalive_intvl", "net.ipv4.tcp_keepalive_probes", "net.ipv4.tcp_rmem", "net.ipv4.tcp_wmem", "net.ipv4.tcp_slow_start_after_idle", "net.ipv4.tcp_notsent_lowat"]);
const VOLUMENES_OK = ["configMap", "csi", "downwardAPI", "emptyDir", "ephemeral", "image", "persistentVolumeClaim", "projected", "secret"];
const seccompOk = (t: unknown) => t === "Localhost" || t === "RuntimeDefault";
const apparmorOk = (t: unknown) => t === "RuntimeDefault" || t === "Localhost";
const procMountOk = (s: Spec) => contenedores(s).every(c => sc(c)?.procMount === undefined || sc(c)?.procMount === null || sc(c)?.procMount === "Default");
const hostSondas = (p: any) => !!(p?.httpGet?.host || p?.tcpSocket?.host);
const BASELINE: Record<string, (s: Spec, anot: Record<string, string>) => boolean> = {
    windowsHostProcess: s => psc(s)?.windowsOptions?.hostProcess !== true && contenedores(s).every(c => sc(c)?.windowsOptions?.hostProcess !== true),
    hostNamespaces: s => s["hostNetwork"] !== true && s["hostPID"] !== true && s["hostIPC"] !== true,
    privileged: s => contenedores(s).every(c => sc(c)?.privileged !== true),
    capabilities_baseline: s => contenedores(s).every(c => lista(sc(c)?.capabilities?.add).every(x => CAPS_BASELINE.has(String(x)))),
    hostPathVolumes: s => lista(s["volumes"]).every(v => !v?.hostPath),
    hostPorts: s => contenedores(s).every(c => lista(c?.ports).every(p => !p?.hostPort)),
    hostProbesAndHostLifecycle: s => contenedores(s).every(c => !hostSondas(c?.livenessProbe) && !hostSondas(c?.readinessProbe) && !hostSondas(c?.startupProbe)
        && !hostSondas(c?.lifecycle?.postStart) && !hostSondas(c?.lifecycle?.preStop)),
    appArmorProfile: (s, anot) => (!psc(s)?.appArmorProfile || apparmorOk(psc(s).appArmorProfile.type))
        && contenedores(s).every(c => !sc(c)?.appArmorProfile || apparmorOk(sc(c).appArmorProfile.type))
        && Object.entries(anot).every(([k, v]) => !k.startsWith("container.apparmor.security.beta.kubernetes.io/")
            || v === "" || v === "runtime/default" || v.startsWith("localhost/")),
    seLinuxOptions: s => [psc(s)?.seLinuxOptions, ...contenedores(s).map(c => sc(c)?.seLinuxOptions)]
        .every(o => !o || (SELINUX_TIPOS.has(String(o.type ?? "")) && !o.user && !o.role)),
    procMount: s => usuarioAislado(s) || procMountOk(s),
    seccompProfile_baseline: s => (!psc(s)?.seccompProfile || seccompOk(psc(s).seccompProfile.type))
        && contenedores(s).every(c => !sc(c)?.seccompProfile || seccompOk(sc(c).seccompProfile.type)),
    sysctls: s => lista(psc(s)?.sysctls).every(x => SYSCTLS.has(String(x?.name))),
};
const RESTRICTED: Record<string, {
    pasa: (s: Spec) => boolean;
    sustituye?: CheckPss;
}> = {
    restrictedVolumes: { sustituye: "hostPathVolumes", pasa: s => lista(s["volumes"]).every(v => !Object.keys(v ?? {}).some(k => k !== "name")
            || VOLUMENES_OK.some(t => v?.[t] !== undefined && v?.[t] !== null)) },
    allowPrivilegeEscalation: { pasa: s => windows(s) || contenedores(s).every(c => sc(c)?.allowPrivilegeEscalation === false) },
    runAsNonRoot: { pasa: s => {
            if (usuarioAislado(s))
                return true;
            const pod = psc(s)?.runAsNonRoot;
            if (pod === false)
                return false;
            return contenedores(s).every(c => {
                const v = sc(c)?.runAsNonRoot;
                return v === undefined || v === null ? pod === true : v === true;
            });
        } },
    runAsUser: { pasa: s => usuarioAislado(s) || (psc(s)?.runAsUser !== 0 && contenedores(s).every(c => sc(c)?.runAsUser !== 0)) },
    seccompProfile_restricted: { sustituye: "seccompProfile_baseline", pasa: s => {
            if (windows(s))
                return true;
            const pod = psc(s)?.seccompProfile;
            if (pod && !seccompOk(pod.type))
                return false;
            return contenedores(s).every(c => {
                const t = sc(c)?.seccompProfile;
                return t ? seccompOk(t.type) : !!pod;
            });
        } },
    capabilities_restricted: { sustituye: "capabilities_baseline", pasa: s => windows(s) || contenedores(s).every(c => {
            const caps = sc(c)?.capabilities;
            return !!caps && lista(caps.drop).includes("ALL") && lista(caps.add).every(x => x === "NET_BIND_SERVICE");
        }) },
    procMount_restricted: { sustituye: "procMount", pasa: s => procMountOk(s) },
};
export interface ResultadoPss {
    carga: string;
    nivel: NivelPss;
    baseline: CheckPss[];
    restricted: CheckPss[];
}
export function evaluarPss(c: Carga): ResultadoPss {
    const s = c.spec ?? {}, anot = c.anotaciones ?? {};
    const baseline = (Object.keys(BASELINE) as CheckPss[]).filter(k => !BASELINE[k](s, anot));
    const sustituidos = new Set(Object.values(RESTRICTED).map(r => r.sustituye).filter(Boolean));
    const restricted = [
        ...baseline.filter(k => !sustituidos.has(k)),
        ...(Object.keys(RESTRICTED) as CheckPss[]).filter(k => !RESTRICTED[k].pasa(s)),
    ];
    return { carga: c.id, nivel: baseline.length ? "privileged" : restricted.length ? "baseline" : "restricted", baseline, restricted };
}
export const cumple = (r: ResultadoPss, nivel: NivelPss) => nivel === "privileged" || (nivel === "baseline" ? !r.baseline.length : !r.restricted.length);
export function nivelDeclarado(labels: Record<string, string>, modo: "enforce" | "warn" | "audit"): NivelPss | null {
    const v = labels[`pod-security.kubernetes.io/${modo}`];
    return v === "privileged" || v === "baseline" || v === "restricted" ? v : null;
}
export function hallazgosPss(m: Modelo): HallazgoK8s[] {
    const out: HallazgoK8s[] = [];
    for (const c of m.cargas) {
        const r = evaluarPss(c);
        const labels = m.namespaces.get(c.ns) ?? {};
        const exige = nivelDeclarado(labels, "enforce");
        const avisa = nivelDeclarado(labels, "warn");
        const falla = (n: NivelPss) => (n === "baseline" ? r.baseline : r.restricted).join(", ");
        if (exige && !cumple(r, exige)) {
            out.push({ regla: "pss-rechazado", gravedad: "alto", fragmento: `${c.tipo} ${c.id}`, datos: { nivel: exige, checks: falla(exige) } });
        }
        else if (r.nivel === "privileged") {
            out.push({ regla: "pss-privilegiado", gravedad: "aviso", fragmento: `${c.tipo} ${c.id}`, datos: { checks: falla("baseline") } });
        }
        if (avisa && !cumple(r, avisa) && !(exige && !cumple(r, exige))) {
            out.push({ regla: "pss-aviso", gravedad: "info", fragmento: `${c.tipo} ${c.id}`, datos: { nivel: avisa, checks: falla(avisa) } });
        }
    }
    return out;
}
