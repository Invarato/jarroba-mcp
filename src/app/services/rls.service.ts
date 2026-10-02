import { Injectable, inject } from "@angular/core";
import { PgEngineService } from "./pg-engine.service";
export interface RunnerSql {
    query(sql: string): Promise<{
        rows: unknown[];
        error?: string;
        affected?: number;
    }>;
    exec(sql: string): Promise<unknown>;
}
export type RlsCmd = "ALL" | "SELECT" | "INSERT" | "UPDATE" | "DELETE";
export interface RlsPolicy {
    schema: string;
    table: string;
    name: string;
    cmd: RlsCmd;
    permissive: boolean;
    roles: string[];
    using: string | null;
    withCheck: string | null;
}
export interface RlsTable {
    schema: string;
    table: string;
    owner: string;
    enabled: boolean;
    forced: boolean;
    policies: RlsPolicy[];
}
export type RlsIssueKind = "sin-politicas" | "politicas-muertas" | "dueno-se-la-salta" | "rol-superusuario" | "sin-usage" | "sin-select" | "ve-todo" | "escribe-todo" | "sin-rls-legible";
export interface RlsIssue {
    kind: RlsIssueKind;
    table: string;
    subject?: string;
}
export function tableId(t: {
    schema: string;
    table: string;
}): string {
    return `${t.schema}.${t.table}`;
}
export function parsePolicyRow(r: {
    schema: string;
    table: string;
    name: string;
    cmd?: string | null;
    permissive?: string | null;
    roles?: string | null;
    using?: string | null;
    with_check?: string | null;
}): RlsPolicy {
    return {
        schema: r.schema,
        table: r.table,
        name: r.name,
        cmd: (r.cmd as RlsCmd) || "ALL",
        permissive: r.permissive === "PERMISSIVE",
        roles: String(r.roles ?? "").replace(/^\{|\}$/g, "").split(",").map(x => x.trim()).filter(Boolean),
        using: r.using ?? null,
        withCheck: r.with_check ?? null,
    };
}
export function diagnose(tables: RlsTable[], role: string | null, esSuperusuario = false, puedeLeer: (t: RlsTable) => boolean = () => true, puedeUsarEsquema: (t: RlsTable) => boolean = () => true): RlsIssue[] {
    const out: RlsIssue[] = [];
    if (role && esSuperusuario)
        out.push({ kind: "rol-superusuario", table: "", subject: role });
    const hayRls = tables.some(t => t.enabled);
    for (const t of tables) {
        const id = tableId(t);
        if (role && hayRls && !t.enabled && puedeUsarEsquema(t) && puedeLeer(t)) {
            out.push({ kind: "sin-rls-legible", table: id, subject: role });
        }
        if (t.enabled) {
            const aplica = (p: RlsPolicy) => p.permissive && (!role || p.roles.includes("public") || p.roles.includes(role));
            const verTodo = t.policies.find(p => aplica(p) && (p.cmd === "SELECT" || p.cmd === "ALL") && esVerdad(p.using));
            if (verTodo)
                out.push({ kind: "ve-todo", table: id, subject: verTodo.name });
            const escribeTodo = t.policies.find(p => aplica(p) && p.cmd !== "SELECT" && p.cmd !== "DELETE"
                && esVerdad(p.withCheck ?? (p.cmd === "INSERT" ? null : p.using)));
            if (escribeTodo)
                out.push({ kind: "escribe-todo", table: id, subject: escribeTodo.name });
        }
        if (!t.enabled && t.policies.length > 0)
            out.push({ kind: "politicas-muertas", table: id });
        if (t.enabled && t.policies.length === 0)
            out.push({ kind: "sin-politicas", table: id });
        if (t.enabled && !t.forced && t.policies.length > 0) {
            out.push({ kind: "dueno-se-la-salta", table: id, subject: t.owner });
        }
        if (role && !puedeUsarEsquema(t)) {
            out.push({ kind: "sin-usage", table: id, subject: role });
        }
        else if (role && !puedeLeer(t)) {
            out.push({ kind: "sin-select", table: id, subject: role });
        }
    }
    return out;
}
function esVerdad(expr: string | null): boolean {
    return !!expr && expr.replace(/[()\s]/g, "").toLowerCase() === "true";
}
export interface RlsSimulation {
    role: string;
    table: string;
    total: number;
    visibles: number;
    filas: {
        datos: Record<string, unknown>;
        visible: boolean;
    }[];
    actualizables: number | null;
    borrables: number | null;
    error?: string;
    nota?: string;
}
export const LIMITE_SIMULACION_ESCRITURA = 5000;
export const MUESTRA_FILAS = 50;
export async function readRls(run: RunnerSql): Promise<RlsTable[]> {
    const res = await run.query(Q_RLS);
    if (res.error)
        return [];
    const tablas = new Map<string, RlsTable>();
    for (const r of res.rows as unknown as RawTable[]) {
        tablas.set(`${r.schema}.${r.table}`, {
            schema: r.schema,
            table: r.table,
            owner: r.owner,
            enabled: r.enabled,
            forced: r.forced,
            policies: [],
        });
    }
    const pol = await run.query(Q_POLICIES);
    if (!pol.error) {
        for (const r of pol.rows as unknown as RawPolicy[]) {
            const t = tablas.get(`${r.schema}.${r.table}`);
            if (!t)
                continue;
            t.policies.push(parsePolicyRow(r));
        }
    }
    return [...tablas.values()];
}
export async function esquemasUsablesDe(run: RunnerSql, role: string): Promise<Set<string>> {
    const res = await run.query(`SELECT nspname FROM pg_namespace
      WHERE nspname NOT IN ('pg_catalog','information_schema')
        AND nspname NOT LIKE 'pg_%'
        AND has_schema_privilege('${esc(role)}', nspname, 'USAGE')`);
    if (res.error)
        return new Set();
    return new Set((res.rows as {
        nspname: string;
    }[]).map(r => r.nspname));
}
export async function superusuariosDe(run: RunnerSql): Promise<Set<string>> {
    const res = await run.query(`SELECT rolname FROM pg_roles WHERE rolsuper`);
    if (res.error)
        return new Set();
    return new Set((res.rows as {
        rolname: string;
    }[]).map(r => r.rolname));
}
@Injectable({ providedIn: "root" })
export class RlsService {
    private engine = inject(PgEngineService);
    read(): Promise<RlsTable[]> { return readRls(this.engine); }
    esquemasUsables(role: string): Promise<Set<string>> { return esquemasUsablesDe(this.engine, role); }
    superusuarios(): Promise<Set<string>> { return superusuariosDe(this.engine); }
    enableRls(table: string): string { return `ALTER TABLE ${q(table)} ENABLE ROW LEVEL SECURITY`; }
    disableRls(table: string): string { return `ALTER TABLE ${q(table)} DISABLE ROW LEVEL SECURITY`; }
    forceRls(table: string, on: boolean): string {
        return `ALTER TABLE ${q(table)} ${on ? "FORCE" : "NO FORCE"} ROW LEVEL SECURITY`;
    }
    dropPolicy(table: string, name: string): string {
        return `DROP POLICY ${ident(name)} ON ${q(table)}`;
    }
    createPolicy(p: {
        table: string;
        name: string;
        cmd: RlsCmd;
        permissive: boolean;
        roles: string[];
        using: string;
        withCheck: string;
    }): string {
        const partes = [`CREATE POLICY ${ident(p.name)} ON ${q(p.table)}`];
        if (!p.permissive)
            partes.push("AS RESTRICTIVE");
        if (p.cmd !== "ALL")
            partes.push(`FOR ${p.cmd}`);
        const roles = p.roles.filter(r => r.trim());
        if (roles.length)
            partes.push(`TO ${roles.map(r => (r === "public" ? "public" : ident(r))).join(", ")}`);
        if (p.using.trim())
            partes.push(`USING (${p.using.trim()})`);
        if (p.withCheck.trim() && p.cmd !== "SELECT")
            partes.push(`WITH CHECK (${p.withCheck.trim()})`);
        return partes.join(" ");
    }
    simulate(role: string, table: string): Promise<RlsSimulation> {
        return simulateRls(this.engine, role, table, $localize `:@@dbstudio.rls.nota.grande:La tabla tiene demasiadas filas para probar la escritura sin tocarlas todas; solo se ha simulado la lectura.`);
    }
}
export async function simulateRls(run: RunnerSql, role: string, table: string, notaTablaGrande: string): Promise<RlsSimulation> {
    const base: RlsSimulation = {
        role,
        table,
        total: 0,
        visibles: 0,
        filas: [],
        actualizables: null,
        borrables: null,
    };
    const t = q(table);
    const cuentasAfectadas = async (sql: string): Promise<number | null> => {
        await run.exec("SAVEPOINT sim");
        const res = await run.query(sql);
        await run.exec("ROLLBACK TO SAVEPOINT sim");
        return res.error ? null : (res.affected ?? null);
    };
    const todo = await run.query(`SELECT ctid::text AS __ctid, * FROM ${t} LIMIT ${MUESTRA_FILAS}`);
    if (todo.error)
        return { ...base, error: todo.error };
    const cnt = await run.query(`SELECT count(*)::int AS n FROM ${t}`);
    base.total = cnt.error ? 0 : ((cnt.rows as {
        n: number;
    }[])[0]?.n ?? 0);
    const col = await unaColumna(run, table);
    await run.exec("BEGIN");
    try {
        const puesto = await run.query(`SET LOCAL ROLE ${ident(role)}`);
        if (puesto.error)
            return { ...base, error: puesto.error };
        const vis = await run.query(`SELECT ctid::text AS __ctid FROM ${t}`);
        if (vis.error)
            return { ...base, error: vis.error };
        const visibles = new Set((vis.rows as {
            __ctid: string;
        }[]).map(r => r.__ctid));
        base.visibles = visibles.size;
        base.filas = (todo.rows as Record<string, unknown>[]).map(r => {
            const { __ctid, ...datos } = r;
            return { datos, visible: visibles.has(String(__ctid)) };
        });
        if (base.total <= LIMITE_SIMULACION_ESCRITURA) {
            base.actualizables = await cuentasAfectadas(`UPDATE ${t} SET ${col} = ${col}`);
            base.borrables = await cuentasAfectadas(`DELETE FROM ${t}`);
        }
        else {
            base.nota = notaTablaGrande;
        }
        return base;
    }
    finally {
        await run.exec("ROLLBACK");
    }
}
async function unaColumna(run: RunnerSql, table: string): Promise<string> {
    const [schema, name] = partes(table);
    const res = await run.query(`SELECT attname FROM pg_attribute a
       JOIN pg_class c ON c.oid = a.attrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = '${esc(schema)}' AND c.relname = '${esc(name)}'
        AND a.attnum > 0 AND NOT a.attisdropped
      ORDER BY a.attnum LIMIT 1`);
    const col = res.error ? null : (res.rows as {
        attname: string;
    }[])[0]?.attname;
    return col ? ident(col) : ident("id");
}
function ident(name: string): string { return "\"" + name.replace(/"/g, "\"\"") + "\""; }
function esc(v: string): string { return v.replace(/'/g, "''"); }
function partes(id: string): [
    string,
    string
] {
    const i = id.indexOf(".");
    return i < 0 ? ["public", id] : [id.slice(0, i), id.slice(i + 1)];
}
function q(id: string): string {
    const [s, t] = partes(id);
    return `${ident(s)}.${ident(t)}`;
}
interface RawTable {
    schema: string;
    table: string;
    owner: string;
    enabled: boolean;
    forced: boolean;
}
interface RawPolicy {
    schema: string;
    table: string;
    name: string;
    cmd: string;
    permissive: string;
    roles: string;
    using: string | null;
    with_check: string | null;
}
const Q_RLS = `
  SELECT n.nspname AS schema, c.relname AS table, pg_get_userbyid(c.relowner) AS owner,
         c.relrowsecurity AS enabled, c.relforcerowsecurity AS forced
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE c.relkind IN ('r','p')
    AND n.nspname NOT IN ('pg_catalog','information_schema')
    AND n.nspname NOT LIKE 'pg_toast%' AND n.nspname NOT LIKE 'pg_temp%'
  ORDER BY n.nspname, c.relname`;
const Q_POLICIES = `
  SELECT schemaname AS schema, tablename AS table, policyname AS name,
         cmd, permissive, roles::text AS roles, qual AS using, with_check
  FROM pg_policies
  WHERE schemaname NOT IN ('pg_catalog','information_schema')
  ORDER BY schemaname, tablename, policyname`;
