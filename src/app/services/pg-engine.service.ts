import { Injectable, signal } from "@angular/core";
export interface PgField {
    name: string;
    typeId: number;
}
export interface PgResult {
    rows: Record<string, unknown>[];
    fields: PgField[];
    affected: number;
    error?: string;
    errorInfo?: PgErrorDetail;
    ms: number;
}
export interface PgErrorDetail {
    position?: number;
    code?: string;
    detail?: string;
    hint?: string;
    table?: string;
    column?: string;
    constraint?: string;
}
interface Artefactos {
    pgliteWasmModule: WebAssembly.Module;
    initdbWasmModule: WebAssembly.Module;
    fsBundle: Blob;
    extensions: Record<string, unknown>;
}
let artefactos: Promise<Artefactos> | null = null;
let artefactosListos = false;
export function olvidarCargaDelMotor(): void { artefactos = null; artefactosListos = false; }
@Injectable({ providedIn: "root" })
export class PgEngineService {
    readonly ready = signal(false);
    readonly booting = signal(false);
    private pg: unknown = null;
    private initPromise: Promise<void> | null = null;
    private async cargar(): Promise<Artefactos> {
        const enFrio = !artefactosListos;
        if (enFrio)
            this.booting.set(true);
        try {
            return await this.cargarUnaVez();
        }
        finally {
            if (enFrio && !this.initPromise)
                this.booting.set(false);
        }
    }
    private cargarUnaVez(): Promise<Artefactos> {
        artefactos ??= (async () => {
            const base = "assets/pglite/";
            const bytes = (f: string) => fetch(base + f).then(r => {
                if (!r.ok)
                    throw new Error(`pglite: HTTP ${r.status} al descargar ${base}${f}`);
                return r.arrayBuffer();
            });
            const [pgWasm, initWasm, dataBuf] = await Promise.all([
                bytes("pglite.wasm"),
                bytes("initdb.wasm"),
                bytes("pglite.data"),
            ]);
            const [pgliteWasmModule, initdbWasmModule] = await Promise.all([
                WebAssembly.compile(pgWasm),
                WebAssembly.compile(initWasm),
            ]);
            const [trgm, unacc] = await Promise.all([bytes("pg_trgm.tar.gz"), bytes("unaccent.tar.gz")]);
            const blobUrl = (b: ArrayBuffer) => URL.createObjectURL(new Blob([b], { type: "application/gzip" }));
            const urls: Record<string, string> = { pg_trgm: blobUrl(trgm), unaccent: blobUrl(unacc) };
            const contrib = (name: string) => ({ name, setup: async () => ({ bundlePath: new URL(urls[name]) }) });
            const extensions = { unaccent: contrib("unaccent"), pg_trgm: contrib("pg_trgm") };
            artefactosListos = true;
            const fsBundle = { arrayBuffer: () => Promise.resolve(dataBuf) } as unknown as Blob;
            return { pgliteWasmModule, initdbWasmModule, fsBundle, extensions };
        })().catch(err => { artefactos = null; throw err; });
        return artefactos;
    }
    private ensure(): Promise<void> {
        if (this.initPromise)
            return this.initPromise;
        this.booting.set(true);
        this.initPromise = (async () => {
            const { PGlite } = await import("@electric-sql/pglite");
            const w = await this.cargar();
            this.pg = await PGlite.create("idb://jt-dbstudio", {
                pgliteWasmModule: w.pgliteWasmModule,
                initdbWasmModule: w.initdbWasmModule,
                fsBundle: w.fsBundle,
                extensions: w.extensions as never,
            });
            this.ready.set(true);
            this.booting.set(false);
        })().catch(err => {
            this.booting.set(false);
            this.initPromise = null;
            throw err;
        });
        return this.initPromise;
    }
    async warmup(): Promise<void> {
        await this.ensure();
    }
    async exec(sql: string): Promise<PgResult[]> {
        await this.ensure();
        const pg = this.pg as {
            exec(q: string): Promise<RawResult[]>;
        };
        const start = performance.now();
        try {
            const results = await pg.exec(sql);
            const ms = performance.now() - start;
            return this.mapScript(results, ms);
        }
        catch (e) {
            return [this.fail(e, start)];
        }
    }
    async query(sql: string, params: unknown[] = []): Promise<PgResult> {
        await this.ensure();
        const pg = this.pg as {
            query(q: string, p?: unknown[]): Promise<RawResult>;
        };
        const start = performance.now();
        try {
            const r = await pg.query(sql, params);
            return this.map(r, performance.now() - start);
        }
        catch (e) {
            return this.fail(e, start);
        }
    }
    async withScratch<T>(fn: (run: (sql: string) => Promise<PgResult[]>) => Promise<T>): Promise<T> {
        const w = await this.cargar();
        const { PGlite } = await import("@electric-sql/pglite");
        const scratch = await PGlite.create(w as never) as {
            exec(q: string): Promise<RawResult[]>;
            close?(): Promise<void>;
        };
        const run = async (sql: string): Promise<PgResult[]> => {
            const start = performance.now();
            try {
                const rs = await scratch.exec(sql);
                return this.mapScript(rs, performance.now() - start);
            }
            catch (e) {
                return [this.fail(e, start)];
            }
        };
        try {
            return await fn(run);
        }
        finally {
            try {
                await scratch.close?.();
            }
            catch { }
        }
    }
    async createScratch(): Promise<{
        exec(sql: string): Promise<PgResult[]>;
        query(sql: string, params?: unknown[]): Promise<PgResult>;
        close(): Promise<void>;
    }> {
        const w = await this.cargar();
        const { PGlite } = await import("@electric-sql/pglite");
        const s = await PGlite.create(w as never) as {
            exec(q: string): Promise<RawResult[]>;
            query(q: string, p?: unknown[]): Promise<RawResult>;
            close?(): Promise<void>;
        };
        return {
            exec: async (sql: string) => {
                const start = performance.now();
                try {
                    const rs = await s.exec(sql);
                    return this.mapScript(rs, performance.now() - start);
                }
                catch (e) {
                    return [this.fail(e, start)];
                }
            },
            query: async (sql: string, params: unknown[] = []) => {
                const start = performance.now();
                try {
                    return this.map(await s.query(sql, params), performance.now() - start);
                }
                catch (e) {
                    return this.fail(e, start);
                }
            },
            close: async () => { try {
                await s.close?.();
            }
            catch { } },
        };
    }
    async dump(): Promise<Blob> {
        await this.ensure();
        const pg = this.pg as {
            dumpDataDir(): Promise<Blob | File>;
        };
        return pg.dumpDataDir();
    }
    private mapScript(rs: RawResult[], ms: number): PgResult[] {
        let previo = 0;
        return rs.map(r => {
            const total = r.affectedRows ?? 0;
            const m = this.map(r, ms);
            m.affected = Math.max(0, total - previo);
            previo = Math.max(previo, total);
            return m;
        });
    }
    private map(r: RawResult, ms: number): PgResult {
        return {
            rows: (r.rows ?? []) as Record<string, unknown>[],
            fields: (r.fields ?? []).map(f => ({ name: f.name, typeId: f.dataTypeID })),
            affected: r.affectedRows ?? 0,
            ms,
        };
    }
    private fail(e: unknown, start: number): PgResult {
        return {
            rows: [],
            fields: [],
            affected: 0,
            error: this.msg(e),
            errorInfo: this.detail(e),
            ms: performance.now() - start,
        };
    }
    private detail(e: unknown): PgErrorDetail | undefined {
        if (!e || typeof e !== "object")
            return undefined;
        const x = e as Record<string, unknown>;
        const str = (k: string) => (typeof x[k] === "string" && x[k] ? String(x[k]) : undefined);
        const pos = Number(x["position"]);
        const out: PgErrorDetail = {
            position: Number.isFinite(pos) && pos > 0 ? pos : undefined,
            code: str("code"),
            detail: str("detail"),
            hint: str("hint"),
            table: str("table"),
            column: str("column"),
            constraint: str("constraint"),
        };
        return Object.values(out).some(v => v !== undefined) ? out : undefined;
    }
    private msg(e: unknown): string {
        if (e && typeof e === "object" && "message" in e)
            return String((e as {
                message: unknown;
            }).message);
        return String(e);
    }
}
interface RawResult {
    rows?: unknown[];
    affectedRows?: number;
    fields?: {
        name: string;
        dataTypeID: number;
    }[];
}
