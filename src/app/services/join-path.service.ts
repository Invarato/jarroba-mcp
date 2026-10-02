import { Injectable } from "@angular/core";
import { SchemaModel, TableModel } from "./schema-catalog";
export interface JoinStep {
    from: string;
    to: string;
    fromColumns: string[];
    toColumns: string[];
    hacia: "madre" | "hija";
}
export interface JoinPath {
    tables: string[];
    steps: JoinStep[];
}
export interface FindPathsOptions {
    maxLength?: number;
    ignore?: Set<string>;
    maxPaths?: number;
}
function edges(schema: SchemaModel): Map<string, JoinStep[]> {
    const ids = new Set(schema.tables.map(t => t.id));
    const out = new Map<string, JoinStep[]>();
    const push = (s: JoinStep) => {
        const l = out.get(s.from);
        if (l)
            l.push(s);
        else
            out.set(s.from, [s]);
    };
    for (const t of schema.tables) {
        for (const fk of t.foreignKeys) {
            const other = `${fk.refSchema}.${fk.refTable}`;
            if (!ids.has(other) || other === t.id)
                continue;
            push({ from: t.id, to: other, fromColumns: fk.columns, toColumns: fk.refColumns, hacia: "madre" });
            push({ from: other, to: t.id, fromColumns: fk.refColumns, toColumns: fk.columns, hacia: "hija" });
        }
    }
    return out;
}
export function findPaths(schema: SchemaModel, fromId: string, toId: string, opts: FindPathsOptions = {}): JoinPath[] {
    const maxLength = opts.maxLength ?? 4;
    const ignore = opts.ignore ?? new Set<string>();
    const maxPaths = opts.maxPaths ?? 20;
    const ids = new Set(schema.tables.map(t => t.id));
    if (!ids.has(fromId) || !ids.has(toId) || fromId === toId)
        return [];
    const adj = edges(schema);
    const found: JoinPath[] = [];
    const visited = new Set<string>([fromId]);
    const steps: JoinStep[] = [];
    const walk = (actual: string) => {
        if (found.length >= maxPaths || steps.length >= maxLength)
            return;
        for (const e of adj.get(actual) ?? []) {
            if (visited.has(e.to))
                continue;
            if (ignore.has(e.to) && e.to !== toId)
                continue;
            steps.push(e);
            if (e.to === toId) {
                found.push({ tables: [fromId, ...steps.map(s => s.to)], steps: [...steps] });
            }
            else {
                visited.add(e.to);
                walk(e.to);
                visited.delete(e.to);
            }
            steps.pop();
            if (found.length >= maxPaths)
                return;
        }
    };
    walk(fromId);
    return found.sort((a, b) => a.steps.length - b.steps.length || a.tables.join().localeCompare(b.tables.join()));
}
function q(id: string): string {
    const i = id.indexOf(".");
    const [s, t] = i < 0 ? ["public", id] : [id.slice(0, i), id.slice(i + 1)];
    return `${ident(s)}.${ident(t)}`;
}
function ident(name: string): string { return "\"" + name.replace(/"/g, "\"\"") + "\""; }
export function aliases(tables: string[]): Map<string, string> {
    const out = new Map<string, string>();
    const usados = new Set<string>();
    for (const id of tables) {
        const nombre = id.slice(id.indexOf(".") + 1);
        const base = (nombre.match(/[a-zA-Z]/)?.[0] ?? "t").toLowerCase();
        let alias = base, n = 1;
        while (usados.has(alias))
            alias = `${base}${++n}`;
        usados.add(alias);
        out.set(id, alias);
    }
    return out;
}
export function joinSql(schema: SchemaModel, path: JoinPath): string {
    if (!path.steps.length)
        return "";
    const al = aliases(path.tables);
    const origen = path.tables[0], destino = path.tables[path.tables.length - 1];
    const cols: string[] = [];
    for (const id of [origen, destino]) {
        const t = schema.tables.find(x => x.id === id);
        const a = al.get(id)!;
        const elegidas = t?.primaryKey.length ? t.primaryKey : (t?.columns ?? []).slice(0, 3).map(c => c.name);
        for (const c of elegidas)
            cols.push(`${a}.${ident(c)} AS ${ident(`${a}_${c}`)}`);
    }
    const lineas = [`SELECT ${cols.join(", ")}`, `FROM ${q(origen)} ${al.get(origen)}`];
    for (const s of path.steps) {
        const a = al.get(s.from)!, b = al.get(s.to)!;
        const on = s.fromColumns.map((c, i) => `${a}.${ident(c)} = ${b}.${ident(s.toColumns[i] ?? c)}`).join(" AND ");
        lineas.push(`JOIN ${q(s.to)} ${b} ON ${on}`);
    }
    return lineas.join("\n") + "\nLIMIT 100";
}
export function joinCountSql(path: JoinPath): string {
    if (!path.steps.length)
        return "";
    const al = aliases(path.tables);
    const origen = path.tables[0];
    const lineas = [`SELECT count(*)::int AS n`, `FROM ${q(origen)} ${al.get(origen)}`];
    for (const s of path.steps) {
        const a = al.get(s.from)!, b = al.get(s.to)!;
        const on = s.fromColumns.map((c, i) => `${a}.${ident(c)} = ${b}.${ident(s.toColumns[i] ?? c)}`).join(" AND ");
        lineas.push(`JOIN ${q(s.to)} ${b} ON ${on}`);
    }
    return lineas.join("\n");
}
export function pathLabel(path: JoinPath): string {
    return path.tables.map(id => id.startsWith("public.") ? id.slice(7) : id).join(" \u2192 ");
}
@Injectable({ providedIn: "root" })
export class JoinPathService {
    findPaths(schema: SchemaModel, from: string, to: string, opts?: FindPathsOptions): JoinPath[] {
        return findPaths(schema, from, to, opts);
    }
    sql(schema: SchemaModel, path: JoinPath): string { return joinSql(schema, path); }
    countSql(path: JoinPath): string { return joinCountSql(path); }
    hubs(schema: SchemaModel): string[] {
        const grados = new Map<string, number>();
        for (const [from, list] of edges(schema))
            grados.set(from, new Set(list.map(e => e.to)).size);
        const total = schema.tables.length;
        if (total < 6)
            return [];
        const umbral = Math.max(4, Math.ceil(total * 0.25));
        return [...grados.entries()].filter(([, g]) => g >= umbral).map(([id]) => id).sort();
    }
}
export type { TableModel };
