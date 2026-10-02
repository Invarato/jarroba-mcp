export interface DiagnosticoRedos {
    estado: "seguro" | "vulnerable" | "desconocido";
    complejidad?: "constante" | "lineal" | "seguro" | "exponencial" | "polinomica";
    grado?: number;
    ataque?: string;
    ataqueDescrito?: string;
    zonas: {
        inicio: number;
        fin: number;
    }[];
    motivo?: string;
}
export interface TrozoPatron {
    texto: string;
    culpable: boolean;
}
interface RecheckDiag {
    status: "safe" | "vulnerable" | "unknown";
    complexity?: {
        type: string;
        degree?: number;
    };
    attack?: {
        string: string;
        pattern: string;
    };
    hotspot?: {
        start: number;
        end: number;
    }[];
    error?: {
        kind: string;
    };
}
type RecheckCheck = (source: string, flags: string, params?: Record<string, unknown>) => Promise<RecheckDiag>;
type RecheckCheckSync = (source: string, flags: string, params?: Record<string, unknown>) => RecheckDiag;
interface Recheck {
    check: RecheckCheck;
    checkSync: RecheckCheckSync;
}
let cargado: Promise<Recheck> | null = null;
function recheck(): Promise<Recheck> {
    cargado ??= import("recheck/lib/browser.js")
        .then((m) => {
        const mod = m as unknown as Partial<Recheck> & {
            default?: Partial<Recheck>;
        };
        const check = mod.check ?? mod.default?.check, checkSync = mod.checkSync ?? mod.default?.checkSync;
        if (typeof check !== "function" || typeof checkSync !== "function")
            throw new Error("recheck incompleto");
        return { check, checkSync };
    })
        .catch((e) => { cargado = null; throw e; });
    return cargado;
}
export function traducirDiagnostico(d: RecheckDiag): DiagnosticoRedos {
    const zonas = (d.hotspot ?? []).map((h) => ({ inicio: h.start, fin: h.end }));
    if (d.status === "unknown")
        return { estado: "desconocido", zonas: [], motivo: d.error?.kind ?? "unexpected" };
    const t = d.complexity?.type;
    const complejidad = t === "polynomial" ? "polinomica" : t === "exponential" ? "exponencial"
        : t === "constant" ? "constante" : t === "linear" ? "lineal" : "seguro";
    if (d.status === "safe")
        return { estado: "seguro", complejidad, zonas: [] };
    return {
        estado: "vulnerable",
        complejidad,
        zonas,
        ...(complejidad === "polinomica" && d.complexity?.degree ? { grado: d.complexity.degree } : {}),
        ...(d.attack ? { ataque: d.attack.string, ataqueDescrito: d.attack.pattern } : {}),
    };
}
const ATOMO = String.raw `(?:\[(?:\\.|[^\]\\])*\]|\\[^\s]|[^\\()[\]|+*?{}.^$])`;
const ANIDADO = new RegExp(String.raw `\((\?:)?(${ATOMO}|\.)([+*])\)([+*])`, "g");
const TRAMOS = new RegExp(String.raw `\((\?:)?(${ATOMO})\+(${ATOMO})\?\)([+*])`, "g");
export function sugerirReescritura(patron: string): string | null {
    let s = patron.replace(ANIDADO, (_m, nc: string | undefined, a: string, q1: string, q2: string) => {
        const q = q1 === "+" && q2 === "+" ? "+" : "*";
        return nc ? `${a}${q}` : `(${a}${q})`;
    });
    s = s.replace(TRAMOS, (_m, nc: string | undefined, a: string, b: string, q: string) => {
        const cuerpo = `${a}+(?:${b}${a}+)*${b}?`;
        const g = nc ? `(?:${cuerpo})` : `(${cuerpo})`;
        return q === "*" ? `${g}?` : g;
    });
    return s === patron ? null : s;
}
export function trocearPatron(patron: string, zonas: readonly {
    inicio: number;
    fin: number;
}[]): TrozoPatron[] {
    const marca = new Array<boolean>(patron.length).fill(false);
    for (const z of zonas)
        for (let i = Math.max(0, z.inicio); i < Math.min(patron.length, z.fin); i++)
            marca[i] = true;
    const out: TrozoPatron[] = [];
    for (let i = 0; i < patron.length; i++) {
        const ult = out[out.length - 1];
        if (ult && ult.culpable === marca[i])
            ult.texto += patron[i];
        else
            out.push({ texto: patron[i], culpable: marca[i] });
    }
    return out;
}
export class RegexRedosService {
    private worker: Worker | null = null;
    private siguiente = 0;
    private readonly pendientes = new Map<number, (d: RecheckDiag | null) => void>();
    private sinWorker = typeof Worker === "undefined";
    async analizar(patron: string, flags: string, opciones: {
        ms?: number;
        signal?: AbortSignal;
    } = {}): Promise<DiagnosticoRedos> {
        const ms = opciones.ms ?? 10000;
        const f = flags.replace(/[^dgimsuvy]/g, "");
        if (opciones.signal?.aborted)
            return { estado: "desconocido", zonas: [], motivo: "cancel" };
        if (!this.sinWorker) {
            const d = await this.enWorker(patron, f, ms, opciones.signal);
            if (d)
                return traducirDiagnostico(d);
        }
        let r: Recheck;
        try {
            r = await recheck();
        }
        catch {
            return { estado: "desconocido", zonas: [], motivo: "descarga" };
        }
        try {
            return traducirDiagnostico(typeof Worker === "undefined"
                ? r.checkSync(patron, f, { timeout: ms })
                : await r.check(patron, f, { timeout: ms, ...(opciones.signal ? { signal: opciones.signal } : {}) }));
        }
        catch {
            return { estado: "desconocido", zonas: [], motivo: "unexpected" };
        }
    }
    cerrar(): void { this.matar("cancel"); }
    private enWorker(source: string, flags: string, ms: number, signal?: AbortSignal): Promise<RecheckDiag | null> {
        let w: Worker;
        try {
            w = this.worker ??= this.crearWorker();
        }
        catch {
            this.sinWorker = true;
            return Promise.resolve(null);
        }
        const id = this.siguiente++;
        return new Promise<RecheckDiag | null>((resolve) => {
            const tope = setTimeout(() => this.matar("timeout"), ms + 2000);
            const alAbortar = () => this.matar("cancel");
            signal?.addEventListener("abort", alAbortar, { once: true });
            this.pendientes.set(id, (d) => { clearTimeout(tope); signal?.removeEventListener("abort", alAbortar); resolve(d); });
            w.postMessage({ id, source, flags, timeout: ms });
        });
    }
    private crearWorker(): Worker {
        const w = new Worker(new URL("../features/regex-tester/redos.worker", import.meta.url), { type: "module" });
        w.onmessage = ({ data }: MessageEvent<{
            id: number;
            d: RecheckDiag;
        }>) => {
            const r = this.pendientes.get(data.id);
            this.pendientes.delete(data.id);
            r?.(data.d);
        };
        w.onerror = () => {
            this.sinWorker = true;
            this.worker?.terminate();
            this.worker = null;
            const cola = [...this.pendientes.values()];
            this.pendientes.clear();
            for (const r of cola)
                r(null);
        };
        return w;
    }
    private matar(motivo: string): void {
        this.worker?.terminate();
        this.worker = null;
        const cola = [...this.pendientes.values()];
        this.pendientes.clear();
        for (const r of cola)
            r({ status: "unknown", error: { kind: motivo } });
    }
}
