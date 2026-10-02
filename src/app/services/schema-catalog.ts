export function contadorCompacto(n: number): string {
    if (!Number.isFinite(n) || n < 0)
        return "";
    if (n < 1000)
        return String(Math.round(n));
    const miles = Math.round(n / 1000);
    if (miles < 1000)
        return `${miles}k`;
    return `${Math.round(n / 1000000)}M`;
}
export interface ColumnModel {
    name: string;
    type: string;
    typeId: number;
    notNull: boolean;
    default: string | null;
    identity?: "" | "a" | "d";
    isPk: boolean;
    isFk: boolean;
    isUnique?: boolean;
    comment?: string | null;
}
export type FkAction = "a" | "r" | "c" | "n" | "d";
export interface FkModel {
    name: string;
    columns: string[];
    refSchema: string;
    refTable: string;
    refColumns: string[];
    onDelete?: FkAction;
    onUpdate?: FkAction;
}
export interface IndexModel {
    name: string;
    columns: string[];
    unique: boolean;
    primary: boolean;
    method?: string;
    partial?: boolean;
    expression?: boolean;
    def?: string;
}
export interface CheckModel {
    name: string;
    def: string;
}
export interface TriggerModel {
    name: string;
    timing: string;
    events: string[];
    perRow: boolean;
    fn: string;
}
export interface EnumType {
    schema: string;
    name: string;
    values: string[];
}
export interface TableModel {
    schema: string;
    name: string;
    id: string;
    columns: ColumnModel[];
    primaryKey: string[];
    foreignKeys: FkModel[];
    indexes: IndexModel[];
    checks?: CheckModel[];
    triggers?: TriggerModel[];
    partitioned?: boolean;
    partitionKey?: string;
    partitionOf?: string;
    comment?: string | null;
    estRows: number;
    isView?: boolean;
    isMatView?: boolean;
}
export interface RoleModel {
    name: string;
    superuser: boolean;
    canLogin: boolean;
}
export interface SequenceModel {
    schema: string;
    name: string;
    id: string;
    start: string;
    increment: string;
    min: string;
    max: string;
    cycles: boolean;
}
export interface SchemaModel {
    schemas: string[];
    tables: TableModel[];
    roles: RoleModel[];
    enums?: EnumType[];
    sequences?: SequenceModel[];
}
export const EMPTY_SCHEMA: SchemaModel = { schemas: [], tables: [], roles: [], enums: [], sequences: [] };
interface SeqRow {
    schema: string;
    name: string;
    start: string;
    increment: string;
    min: string;
    max: string;
    cycles: boolean;
}
interface ColRow {
    table_schema: string;
    table_name: string;
    column_name: string;
    data_type: string;
    type_id: number;
    not_null: boolean;
    relkind: string;
    column_default: string | null;
    identity: string;
    col_comment: string | null;
    tbl_comment: string | null;
}
interface PkRow {
    table_schema: string;
    table_name: string;
    column_name: string;
}
interface FkRow {
    constraint_name: string;
    table_schema: string;
    table_name: string;
    column_name: string;
    ref_schema: string;
    ref_table: string;
    ref_column: string;
    on_delete: string;
    on_update: string;
}
interface IdxRow {
    table_schema: string;
    table_name: string;
    index_name: string;
    columns: string[] | null;
    is_unique: boolean;
    is_primary: boolean;
    method: string;
    is_partial: boolean;
    is_expression: boolean;
    def: string;
}
interface CheckRow {
    table_schema: string;
    table_name: string;
    name: string;
    def: string;
}
interface RoleRow {
    rolname: string;
    rolsuper: boolean;
    rolcanlogin: boolean;
}
interface TrgRow {
    table_schema: string;
    table_name: string;
    name: string;
    is_row: boolean;
    timing: string;
    events: string[] | null;
    fn: string;
}
interface EnumRow {
    schema: string;
    name: string;
    values: string[] | null;
}
interface PartRow {
    schema: string;
    name: string;
    is_partitioned: boolean;
    is_partition: boolean;
    partkey: string;
    parent: string;
}
interface SchemaRow {
    nspname: string;
}
const USER_SCHEMAS = `n.nspname NOT IN ('pg_catalog','information_schema','pg_toast')
  AND n.nspname NOT LIKE 'pg_temp%' AND n.nspname NOT LIKE 'pg_toast_temp%'`;
const Q_COLUMNS = `
  SELECT n.nspname AS table_schema, c.relname AS table_name, a.attname AS column_name,
         format_type(a.atttypid, a.atttypmod) AS data_type,
         a.atttypid::int AS type_id,
         a.attnotnull AS not_null,
         c.relkind AS relkind,
         a.attidentity AS identity,
         col_description(c.oid, a.attnum) AS col_comment,
         obj_description(c.oid) AS tbl_comment,
         pg_get_expr(ad.adbin, ad.adrelid) AS column_default
  FROM pg_attribute a
  JOIN pg_class c ON c.oid = a.attrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  LEFT JOIN pg_attrdef ad ON ad.adrelid = a.attrelid AND ad.adnum = a.attnum
  WHERE c.relkind IN ('r','p','v','m') AND a.attnum > 0 AND NOT a.attisdropped AND ${USER_SCHEMAS}
  ORDER BY n.nspname, c.relname, a.attnum`;
const Q_PRIMARY_KEYS = `
  SELECT n.nspname AS table_schema, c.relname AS table_name, a.attname AS column_name
  FROM pg_constraint con
  JOIN pg_class c ON c.oid = con.conrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = ANY(con.conkey)
  WHERE con.contype = 'p' AND ${USER_SCHEMAS}`;
const Q_FOREIGN_KEYS = `
  SELECT con.conname AS constraint_name,
         n.nspname AS table_schema, c.relname AS table_name, a.attname AS column_name,
         rn.nspname AS ref_schema, rc.relname AS ref_table, ra.attname AS ref_column,
         con.confdeltype AS on_delete, con.confupdtype AS on_update
  FROM pg_constraint con
  JOIN pg_class c ON c.oid = con.conrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  JOIN pg_class rc ON rc.oid = con.confrelid
  JOIN pg_namespace rn ON rn.oid = rc.relnamespace
  JOIN LATERAL generate_subscripts(con.conkey, 1) AS k(i) ON true
  JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = con.conkey[k.i]
  JOIN pg_attribute ra ON ra.attrelid = con.confrelid AND ra.attnum = con.confkey[k.i]
  WHERE con.contype = 'f' AND ${USER_SCHEMAS}
  ORDER BY con.conname, k.i`;
const Q_INDEXES = `
  SELECT n.nspname AS table_schema, c.relname AS table_name, ic.relname AS index_name,
         ix.indisunique AS is_unique, ix.indisprimary AS is_primary,
         am.amname AS method,
         (ix.indpred IS NOT NULL) AS is_partial,
         (ix.indexprs IS NOT NULL) AS is_expression,
         pg_get_indexdef(ix.indexrelid) AS def,
         COALESCE((SELECT array_agg(att.attname ORDER BY k.i)
          FROM generate_subscripts(ix.indkey, 1) AS k(i)
          JOIN pg_attribute att ON att.attrelid = c.oid AND att.attnum = ix.indkey[k.i]), '{}') AS columns
  FROM pg_index ix
  JOIN pg_class c ON c.oid = ix.indrelid
  JOIN pg_class ic ON ic.oid = ix.indexrelid
  JOIN pg_am am ON am.oid = ic.relam
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE ${USER_SCHEMAS}`;
const Q_CHECKS = `
  SELECT n.nspname AS table_schema, c.relname AS table_name,
         con.conname AS name, pg_get_constraintdef(con.oid) AS def
  FROM pg_constraint con
  JOIN pg_class c ON c.oid = con.conrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE con.contype = 'c' AND ${USER_SCHEMAS}
  ORDER BY con.conname`;
const Q_ROLES = `SELECT rolname, rolsuper, rolcanlogin FROM pg_roles ORDER BY rolname`;
const Q_SCHEMAS = `
  SELECT n.nspname FROM pg_namespace n
  WHERE ${USER_SCHEMAS.replace(/\n\s*/g, " ")}
  ORDER BY n.nspname`;
const Q_TRIGGERS = `
  SELECT n.nspname AS table_schema, c.relname AS table_name, tg.tgname AS name,
         (tg.tgtype & 1) = 1 AS is_row,
         CASE WHEN (tg.tgtype & 2) = 2 THEN 'BEFORE'
              WHEN (tg.tgtype & 64) = 64 THEN 'INSTEAD OF' ELSE 'AFTER' END AS timing,
         ARRAY_REMOVE(ARRAY[
           CASE WHEN (tg.tgtype & 4) = 4 THEN 'INSERT' END,
           CASE WHEN (tg.tgtype & 8) = 8 THEN 'DELETE' END,
           CASE WHEN (tg.tgtype & 16) = 16 THEN 'UPDATE' END,
           CASE WHEN (tg.tgtype & 32) = 32 THEN 'TRUNCATE' END], NULL) AS events,
         p.proname AS fn
  FROM pg_trigger tg
  JOIN pg_class c ON c.oid = tg.tgrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  JOIN pg_proc p ON p.oid = tg.tgfoid
  WHERE NOT tg.tgisinternal AND ${USER_SCHEMAS}
  ORDER BY c.relname, tg.tgname`;
const Q_ENUMS = `
  SELECT n.nspname AS schema, t.typname AS name,
         array_agg(e.enumlabel ORDER BY e.enumsortorder) AS values
  FROM pg_type t
  JOIN pg_namespace n ON n.oid = t.typnamespace
  JOIN pg_enum e ON e.enumtypid = t.oid
  WHERE t.typtype = 'e' AND ${USER_SCHEMAS}
  GROUP BY n.nspname, t.typname
  ORDER BY 1, 2`;
const Q_PARTITIONS = `
  SELECT n.nspname AS schema, c.relname AS name,
         (c.relkind = 'p') AS is_partitioned,
         c.relispartition AS is_partition,
         COALESCE(pg_get_partkeydef(c.oid), '') AS partkey,
         COALESCE((SELECT pn.nspname || '.' || pc.relname
                   FROM pg_inherits i
                   JOIN pg_class pc ON pc.oid = i.inhparent
                   JOIN pg_namespace pn ON pn.oid = pc.relnamespace
                   WHERE i.inhrelid = c.oid), '') AS parent
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE c.relkind IN ('r','p') AND (c.relkind = 'p' OR c.relispartition) AND ${USER_SCHEMAS}`;
const Q_SEQUENCES = `
  SELECT n.nspname AS schema, c.relname AS name,
         s.seqstart::text AS start, s.seqincrement::text AS increment,
         s.seqmin::text AS min, s.seqmax::text AS max, s.seqcycle AS cycles
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  JOIN pg_sequence s ON s.seqrelid = c.oid
  WHERE c.relkind = 'S' AND ${USER_SCHEMAS}
    -- Las de serial/IDENTITY dependen de su columna ('a' = auto): esas ya se ven en la tabla.
    AND NOT EXISTS (SELECT 1 FROM pg_depend d
                    WHERE d.objid = c.oid AND d.classid = 'pg_class'::regclass AND d.deptype IN ('a','i'))
  ORDER BY 1, 2`;
export const CATALOG_QUERIES = [
    Q_COLUMNS,
    Q_PRIMARY_KEYS,
    Q_FOREIGN_KEYS,
    Q_INDEXES,
    Q_ROLES,
    Q_SCHEMAS,
    Q_CHECKS,
    Q_TRIGGERS,
    Q_ENUMS,
    Q_PARTITIONS,
    Q_SEQUENCES,
] as const;
export interface CatalogRows {
    cols: unknown[];
    pks: unknown[];
    fks: unknown[];
    idx: unknown[];
    roles: unknown[];
    nss: unknown[];
    chk: unknown[];
    trg: unknown[];
    enm: unknown[];
    part: unknown[];
    seq?: unknown[];
}
export function assembleSchema(r: CatalogRows): SchemaModel {
    const cols = { rows: r.cols }, pks = { rows: r.pks }, fks = { rows: r.fks };
    const idx = { rows: r.idx }, roles = { rows: r.roles }, nss = { rows: r.nss };
    const chk = { rows: r.chk }, trg = { rows: r.trg }, enm = { rows: r.enm }, part = { rows: r.part };
    const pkByTable = new Map<string, Set<string>>();
    for (const r of pks.rows as unknown as PkRow[]) {
        const key = `${r.table_schema}.${r.table_name}`;
        (pkByTable.get(key) ?? pkByTable.set(key, new Set()).get(key)!).add(r.column_name);
    }
    const fkByTable = new Map<string, Map<string, FkModel>>();
    const fkColSet = new Map<string, Set<string>>();
    for (const r of fks.rows as unknown as FkRow[]) {
        const key = `${r.table_schema}.${r.table_name}`;
        const byName = fkByTable.get(key) ?? fkByTable.set(key, new Map()).get(key)!;
        const fk = byName.get(r.constraint_name) ?? byName.set(r.constraint_name, {
            name: r.constraint_name,
            columns: [],
            refSchema: r.ref_schema,
            refTable: r.ref_table,
            refColumns: [],
            onDelete: (r.on_delete || "a") as FkAction,
            onUpdate: (r.on_update || "a") as FkAction,
        }).get(r.constraint_name)!;
        fk.columns.push(r.column_name);
        fk.refColumns.push(r.ref_column);
        (fkColSet.get(key) ?? fkColSet.set(key, new Set()).get(key)!).add(r.column_name);
    }
    const idxByTable = new Map<string, IndexModel[]>();
    const uniqueCols = new Map<string, Set<string>>();
    for (const r of idx.rows as unknown as IdxRow[]) {
        const key = `${r.table_schema}.${r.table_name}`;
        const columns = r.columns ?? [];
        (idxByTable.get(key) ?? idxByTable.set(key, []).get(key)!).push({
            name: r.index_name,
            columns,
            unique: r.is_unique,
            primary: r.is_primary,
            method: r.method,
            partial: r.is_partial,
            expression: r.is_expression,
            def: r.def,
        });
        if (r.is_unique && !r.is_partial && columns.length === 1) {
            (uniqueCols.get(key) ?? uniqueCols.set(key, new Set()).get(key)!).add(columns[0]);
        }
    }
    const checkByTable = new Map<string, CheckModel[]>();
    for (const r of chk.rows as unknown as CheckRow[]) {
        const key = `${r.table_schema}.${r.table_name}`;
        (checkByTable.get(key) ?? checkByTable.set(key, []).get(key)!).push({ name: r.name, def: r.def });
    }
    const trgByTable = new Map<string, TriggerModel[]>();
    for (const r of trg.rows as unknown as TrgRow[]) {
        const key = `${r.table_schema}.${r.table_name}`;
        (trgByTable.get(key) ?? trgByTable.set(key, []).get(key)!).push({
            name: r.name,
            timing: r.timing,
            events: r.events ?? [],
            perRow: r.is_row,
            fn: r.fn,
        });
    }
    const partByTable = new Map<string, PartRow>();
    for (const r of part.rows as unknown as PartRow[])
        partByTable.set(`${r.schema}.${r.name}`, r);
    const tableMap = new Map<string, TableModel>();
    const schemas = new Set<string>((nss.rows as unknown as SchemaRow[]).map(r => r.nspname));
    for (const r of cols.rows as unknown as ColRow[]) {
        const key = `${r.table_schema}.${r.table_name}`;
        schemas.add(r.table_schema);
        const pkSet = pkByTable.get(key);
        const fkSet = fkColSet.get(key);
        let t = tableMap.get(key);
        if (!t) {
            t = {
                schema: r.table_schema,
                name: r.table_name,
                id: key,
                columns: [],
                primaryKey: pkSet ? [...pkSet] : [],
                foreignKeys: [...(fkByTable.get(key)?.values() ?? [])],
                indexes: idxByTable.get(key) ?? [],
                checks: checkByTable.get(key) ?? [],
                triggers: trgByTable.get(key) ?? [],
                partitioned: partByTable.get(key)?.is_partitioned || undefined,
                partitionKey: partByTable.get(key)?.partkey || undefined,
                partitionOf: partByTable.get(key)?.parent || undefined,
                estRows: -1,
                isView: r.relkind === "v" || r.relkind === "m",
                isMatView: r.relkind === "m",
                comment: r.tbl_comment,
            };
            tableMap.set(key, t);
        }
        const uniqSet = uniqueCols.get(key);
        t.columns.push({
            name: r.column_name,
            type: r.data_type,
            typeId: r.type_id,
            notNull: r.not_null,
            default: r.column_default,
            identity: (r.identity || "") as "" | "a" | "d",
            isPk: !!pkSet?.has(r.column_name),
            isFk: !!fkSet?.has(r.column_name),
            isUnique: !!uniqSet?.has(r.column_name),
            comment: r.col_comment,
        });
    }
    return {
        schemas: [...schemas].sort(),
        tables: [...tableMap.values()].sort((a, b) => a.id.localeCompare(b.id)),
        roles: (roles.rows as unknown as RoleRow[]).map(r => ({
            name: r.rolname,
            superuser: r.rolsuper,
            canLogin: r.rolcanlogin,
        })),
        enums: (enm.rows as unknown as EnumRow[]).map(r => ({ schema: r.schema, name: r.name, values: r.values ?? [] })),
        sequences: ((r.seq ?? []) as SeqRow[]).map(q => ({
            schema: q.schema,
            name: q.name,
            id: `${q.schema}.${q.name}`,
            start: q.start,
            increment: q.increment,
            min: q.min,
            max: q.max,
            cycles: !!q.cycles,
        })),
    };
}
