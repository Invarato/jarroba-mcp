import { Injectable, inject } from "@angular/core";
import { PgEngineService } from "./pg-engine.service";
import { SchemaModel, TableModel, ColumnModel } from "./schema-catalog";
export interface FkCandidate {
    childTable: string;
    childColumn: string;
    parentTable: string;
    parentColumn: string;
    reason: string;
}
export interface FkEvidence extends FkCandidate {
    total: number;
    orphans: number;
    coverage: number;
    error?: string;
}
function family(type: string): string {
    const t = type.toLowerCase();
    if (/^(small|big)?(int|serial)/.test(t) || t.startsWith("numeric") || t.startsWith("decimal"))
        return "num";
    if (t.startsWith("uuid"))
        return "uuid";
    if (/^(text|character|varchar|char|citext)/.test(t))
        return "txt";
    if (t.startsWith("date") || t.startsWith("time"))
        return "time";
    return t;
}
function targetNames(column: string): string[] {
    const c = column.toLowerCase();
    const bases: string[] = [];
    const m1 = /^(.+?)_?id$/.exec(c);
    if (m1)
        bases.push(m1[1]);
    const m2 = /^(?:id|fk)_(.+)$/.exec(c);
    if (m2)
        bases.push(m2[1]);
    const out = new Set<string>();
    for (const b of bases) {
        if (!b)
            continue;
        out.add(b);
        out.add(`${b}s`);
        out.add(`${b}es`);
        if (b.endsWith("es"))
            out.add(b.slice(0, -2));
        if (b.endsWith("s"))
            out.add(b.slice(0, -1));
    }
    return [...out];
}
function claveUnica(t: TableModel): ColumnModel | null {
    if (t.primaryKey.length === 1) {
        return t.columns.find(c => c.name === t.primaryKey[0]) ?? null;
    }
    if (t.primaryKey.length === 0)
        return t.columns.find(c => c.isUnique) ?? null;
    return null;
}
export function candidates(schema: SchemaModel): FkCandidate[] {
    const out: FkCandidate[] = [];
    const tablas = schema.tables.filter(t => !t.isView);
    const porNombre = new Map<string, TableModel[]>();
    for (const t of tablas) {
        const k = t.name.toLowerCase();
        (porNombre.get(k) ?? porNombre.set(k, []).get(k)!).push(t);
    }
    const yaHay = new Set<string>();
    for (const t of tablas) {
        for (const fk of t.foreignKeys)
            for (const c of fk.columns)
                yaHay.add(`${t.id}\x00${c}`);
    }
    for (const t of tablas) {
        for (const col of t.columns) {
            if (yaHay.has(`${t.id}\x00${col.name}`))
                continue;
            for (const nombre of targetNames(col.name)) {
                for (const madre of porNombre.get(nombre) ?? []) {
                    const clave = claveUnica(madre);
                    if (!clave)
                        continue;
                    if (madre.id === t.id && clave.name === col.name)
                        continue;
                    if (family(col.type) !== family(clave.type))
                        continue;
                    out.push({
                        childTable: t.id,
                        childColumn: col.name,
                        parentTable: madre.id,
                        parentColumn: clave.name,
                        reason: `«${col.name}» apunta por nombre a «${madre.name}», y los tipos casan`,
                    });
                }
            }
        }
    }
    return out.sort((a, b) => `${a.childTable}.${a.childColumn}`.localeCompare(`${b.childTable}.${b.childColumn}`)
        || a.parentTable.localeCompare(b.parentTable));
}
function ident(n: string): string { return "\"" + n.replace(/"/g, "\"\"") + "\""; }
function q(id: string): string {
    const i = id.indexOf(".");
    const [s, t] = i < 0 ? ["public", id] : [id.slice(0, i), id.slice(i + 1)];
    return `${ident(s)}.${ident(t)}`;
}
export function evidenceSql(c: FkCandidate): string {
    return `SELECT count(*)::int AS total,
                 count(*) FILTER (WHERE p.${ident(c.parentColumn)} IS NULL)::int AS huerfanas
            FROM ${q(c.childTable)} h
            LEFT JOIN ${q(c.parentTable)} p ON h.${ident(c.childColumn)} = p.${ident(c.parentColumn)}
           WHERE h.${ident(c.childColumn)} IS NOT NULL`;
}
export function orphanSql(c: FkCandidate): string {
    return `SELECT h.*
            FROM ${q(c.childTable)} h
            LEFT JOIN ${q(c.parentTable)} p ON h.${ident(c.childColumn)} = p.${ident(c.parentColumn)}
           WHERE h.${ident(c.childColumn)} IS NOT NULL AND p.${ident(c.parentColumn)} IS NULL
           LIMIT 50`;
}
export function addFkSql(c: FkCandidate): string {
    const nombre = `fk_${c.childTable.split(".").pop()}_${c.childColumn}`;
    return `ALTER TABLE ${q(c.childTable)} ADD CONSTRAINT ${ident(nombre)}`
        + ` FOREIGN KEY (${ident(c.childColumn)}) REFERENCES ${q(c.parentTable)} (${ident(c.parentColumn)})`;
}
export function cobertura(total: number, orphans: number): number {
    return total > 0 ? Math.round(((total - orphans) / total) * 100) : 0;
}
export function ordenarPorEvidencia<T extends {
    coverage: number;
    total: number;
}>(xs: T[]): T[] {
    return [...xs].sort((a, b) => b.coverage - a.coverage || b.total - a.total);
}
export function esRelevante(e: FkEvidence): boolean {
    return !e.error && e.total > 0 && e.coverage >= 80;
}
@Injectable({ providedIn: "root" })
export class FkInferService {
    private engine = inject(PgEngineService);
    async scan(schema: SchemaModel, limite = 200): Promise<FkEvidence[]> {
        const out: FkEvidence[] = [];
        for (const c of candidates(schema).slice(0, limite)) {
            await this.engine.exec("SAVEPOINT fki");
            const res = await this.engine.query(evidenceSql(c));
            await this.engine.exec(res.error ? "ROLLBACK TO SAVEPOINT fki" : "RELEASE SAVEPOINT fki");
            if (res.error) {
                out.push({ ...c, total: 0, orphans: 0, coverage: 0, error: res.error });
                continue;
            }
            const r = (res.rows as {
                total: number;
                huerfanas: number;
            }[])[0];
            const total = r?.total ?? 0, orphans = r?.huerfanas ?? 0;
            out.push({
                ...c,
                total,
                orphans,
                coverage: cobertura(total, orphans),
            });
        }
        return ordenarPorEvidencia(out.filter(esRelevante));
    }
    orphans(c: FkCandidate): Promise<{
        rows: Record<string, unknown>[];
        error?: string;
    }> {
        return this.engine.query(orphanSql(c)).then(r => ({ rows: r.rows, error: r.error }));
    }
    addFk(c: FkCandidate): string { return addFkSql(c); }
}
