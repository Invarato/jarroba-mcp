import { Injectable, inject } from "@angular/core";
import { PgEngineService, PgResult } from "./pg-engine.service";
import { SqlImportService } from "./sql-import.service";
export const LOCK_MODES = [
    "AccessShare",
    "RowShare",
    "RowExclusive",
    "ShareUpdateExclusive",
    "Share",
    "ShareRowExclusive",
    "Exclusive",
    "AccessExclusive",
] as const;
export type LockMode = typeof LOCK_MODES[number];
export interface TableImpact {
    table: string;
    lock: LockMode;
    rewrites: boolean;
    scans: boolean;
    isNew?: boolean;
}
export type Risk = "alto" | "medio" | "bajo";
export type FixCode = "check-not-valid" | "fk-not-valid" | "notnull-not-valid" | "index-concurrently" | "type-new-column" | "default-backfill" | "lock-timeout";
export interface Fix {
    code: FixCode;
    sql?: string;
}
export interface StatementImpact {
    sql: string;
    line: number;
    tables: TableImpact[];
    risk: Risk;
    fixes: Fix[];
    error?: string;
    code?: string;
    noTx?: boolean;
    skipped?: boolean;
}
export interface MigrationImpact {
    schemaError?: string;
    statements: StatementImpact[];
}
const rank = (m: LockMode) => LOCK_MODES.indexOf(m);
export function strongest(modes: LockMode[]): LockMode {
    return modes.reduce((a, b) => (rank(b) > rank(a) ? b : a), "AccessShare" as LockMode);
}
export function blocksWrites(m: LockMode): boolean { return rank(m) >= rank("Share"); }
export function blocksReads(m: LockMode): boolean { return m === "AccessExclusive"; }
export function lockFromPg(mode: string): LockMode | null {
    const m = mode.replace(/Lock$/, "");
    return (LOCK_MODES as readonly string[]).includes(m) ? m as LockMode : null;
}
export function riskOf(todas: TableImpact[]): Risk {
    const tables = todas.filter(t => !t.isNew);
    if (tables.some(t => blocksWrites(t.lock) && (t.rewrites || t.scans)))
        return "alto";
    if (tables.some(t => blocksReads(t.lock)))
        return "medio";
    return "bajo";
}
const reAddCheck = /^\s*ALTER\s+TABLE\s+(?:ONLY\s+)?(\S+)\s+ADD\s+CONSTRAINT\s+(\S+)\s+CHECK\b/i;
const reAddFk = /^\s*ALTER\s+TABLE\s+(?:ONLY\s+)?(\S+)\s+ADD\s+(?:CONSTRAINT\s+(\S+)\s+)?FOREIGN\s+KEY\b/i;
const reNotValid = /\bNOT\s+VALID\s*$/i;
const reSetNotNull = /^\s*ALTER\s+TABLE\s+(?:ONLY\s+)?(\S+)\s+ALTER\s+(?:COLUMN\s+)?(\S+)\s+SET\s+NOT\s+NULL\s*$/i;
const reCreateIndex = /^\s*CREATE\s+(UNIQUE\s+)?INDEX\s+(?!CONCURRENTLY\b)/i;
const reAlterType = /\bALTER\s+(?:COLUMN\s+)?\S+\s+(?:SET\s+DATA\s+)?TYPE\b/i;
const reAddColumnDefault = /\bADD\s+(?:COLUMN\s+)?\S+\s+.*\bDEFAULT\b/i;
export function fixesFor(sql: string, tables: TableImpact[]): Fix[] {
    const out: Fix[] = [];
    const scans = tables.some(t => t.scans);
    const rewrites = tables.some(t => t.rewrites);
    const s = sql.trim().replace(/;\s*$/, "");
    let m = reAddCheck.exec(s);
    if (m && scans && !reNotValid.test(s)) {
        out.push({ code: "check-not-valid", sql: `${s} NOT VALID;\nALTER TABLE ${m[1]} VALIDATE CONSTRAINT ${m[2]};` });
    }
    m = reAddFk.exec(s);
    if (m && scans && !reNotValid.test(s)) {
        out.push(m[2]
            ? { code: "fk-not-valid", sql: `${s} NOT VALID;\nALTER TABLE ${m[1]} VALIDATE CONSTRAINT ${m[2]};` }
            : { code: "fk-not-valid" });
    }
    m = reSetNotNull.exec(s);
    if (m && scans) {
        const col = m[2].replace(/"/g, "");
        out.push({ code: "notnull-not-valid", sql: `ALTER TABLE ${m[1]} ADD CONSTRAINT ${col}_not_null NOT NULL ${m[2]} NOT VALID;\nALTER TABLE ${m[1]} VALIDATE CONSTRAINT ${col}_not_null;` });
    }
    if (reCreateIndex.test(s) && tables.some(t => blocksWrites(t.lock))) {
        out.push({ code: "index-concurrently", sql: s.replace(/^(\s*CREATE\s+(?:UNIQUE\s+)?INDEX)\s+/i, "$1 CONCURRENTLY ") + ";" });
    }
    if (rewrites && reAlterType.test(s))
        out.push({ code: "type-new-column" });
    else if (rewrites && reAddColumnDefault.test(s))
        out.push({ code: "default-backfill" });
    if (!out.length && riskOf(tables) === "medio")
        out.push({ code: "lock-timeout" });
    return out;
}
const STATS = `SELECT c.relname AS t, c.relfilenode::text AS f, COALESCE(s.seq_scan, 0)::int AS scans
  FROM pg_class c LEFT JOIN pg_stat_user_tables s ON s.relid = c.oid
  WHERE c.relkind IN ('r','p','m') AND c.relnamespace NOT IN ('pg_catalog'::regnamespace, 'information_schema'::regnamespace)
    AND c.relnamespace::regnamespace::text NOT LIKE 'pg_toast%'`;
const LOCKS = `SELECT c.relname AS t, l.mode AS mode FROM pg_locks l JOIN pg_class c ON c.oid = l.relation
  WHERE l.pid = pg_backend_pid() AND c.relkind IN ('r','p','m')
    AND c.relnamespace NOT IN ('pg_catalog'::regnamespace, 'information_schema'::regnamespace)`;
export type Run = (sql: string) => Promise<PgResult[]>;
@Injectable({ providedIn: "root" })
export class MigrationImpactService {
    private engine = inject(PgEngineService);
    private importer = inject(SqlImportService);
    measure(schema: string, migration: string): Promise<MigrationImpact> {
        return this.engine.withScratch(run => this.measureWith(run, schema, migration));
    }
    measureWith(run: Run, schema: string, migration: string): Promise<MigrationImpact> {
        return medirMigracion(run, t => this.importer.split(t), schema, migration);
    }
}
export async function medirMigracion(run: Run, trocear: (sql: string) => {
    sql: string;
    line: number;
}[], schema: string, migration: string): Promise<MigrationImpact> {
    if (schema.trim()) {
        const bad = (await run(schema)).find(r => r.error);
        if (bad)
            return { schemaError: bad.error, statements: [] };
    }
    const one = async (sql: string) => (await run(sql))[0];
    const stats = async () => {
        await one("SELECT pg_stat_force_next_flush()");
        const r = await one(STATS);
        return new Map((r.rows as {
            t: string;
            f: string;
            scans: number;
        }[]).map(x => [x.t, x]));
    };
    const statements: StatementImpact[] = [];
    let parada = false;
    for (const st of trocear(migration)) {
        if (parada) {
            statements.push({ sql: st.sql, line: st.line, tables: [], risk: "bajo", fixes: [], skipped: true });
            continue;
        }
        const antes = await stats();
        await one("BEGIN");
        const r = await one(st.sql);
        if (r.error) {
            await one("ROLLBACK");
            const noTx = r.errorInfo?.code === "25001";
            statements.push({ sql: st.sql, line: st.line, tables: [], risk: "bajo", fixes: [], noTx, error: noTx ? undefined : r.error, code: r.errorInfo?.code });
            if (!noTx)
                parada = true;
            continue;
        }
        const locks = (await one(LOCKS)).rows as {
            t: string;
            mode: string;
        }[];
        await one("COMMIT");
        const despues = await stats();
        const porTabla = new Map<string, LockMode[]>();
        for (const l of locks) {
            const m = lockFromPg(l.mode);
            if (m)
                (porTabla.get(l.t) ?? porTabla.set(l.t, []).get(l.t)!).push(m);
        }
        const tables: TableImpact[] = [...porTabla].map(([table, modes]) => {
            const a = antes.get(table), d = despues.get(table);
            return {
                table,
                lock: strongest(modes),
                rewrites: !!a && !!d && a.f !== d.f && a.f !== "0",
                scans: !!a && !!d && d.scans > a.scans,
                ...(a ? {} : { isNew: true }),
            };
        }).sort((x, y) => rank(y.lock) - rank(x.lock) || x.table.localeCompare(y.table));
        statements.push({ sql: st.sql, line: st.line, tables, risk: riskOf(tables), fixes: fixesFor(st.sql, tables) });
    }
    return { statements };
}
