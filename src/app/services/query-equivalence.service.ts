import { Injectable, inject } from "@angular/core";
import { PgEngineService, PgResult } from "./pg-engine.service";
import { SampleDataService } from "./sample-data.service";
import { CATALOG_QUERIES, assembleSchema, SchemaModel, TableModel } from "./schema-catalog";
import { diffFilas } from "../shared/sql/result-compare";
export type Run = (sql: string) => Promise<PgResult[]>;
export type TipoEscenario = "datos" | "mas-datos" | "nulo" | "duplicado" | "vacia";
export interface Escenario {
    tipo: TipoEscenario;
    tabla?: string;
    columna?: string;
    conGeneradas?: true;
}
export interface ErrorConsulta {
    mensaje: string;
    codigo?: string;
    posicion?: number;
}
export interface TablaContraejemplo {
    tabla: string;
    columnas: string[];
    filas: unknown[][];
}
export interface Diferencia {
    escenario: Escenario;
    soloA: unknown[][];
    soloB: unknown[][];
    contraejemplo: TablaContraejemplo[];
    inserts: string;
}
export interface Equivalencia {
    esquemaError?: string;
    errorA?: ErrorConsulta;
    errorB?: ErrorConsulta;
    noLectura?: "a" | "b";
    columnasA: string[];
    columnasB: string[];
    formaDistinta: boolean;
    probados: Escenario[];
    saltados: number;
    iguales: boolean;
    diferencia?: Diferencia;
}
export interface OpcionesEquivalencia {
    ordenado?: boolean;
    maxEscenarios?: number;
    filasExtra?: number;
    generarDatos?: ((schema: SchemaModel, filas: number) => string) | null;
}
const esLectura = (sql: string) => /^\s*(\(\s*)*(SELECT|WITH|VALUES|TABLE)\b/i.test(sql.replace(/^(\s*--[^\n]*\n|\s*\/\*[\s\S]*?\*\/)*/, ""));
const limpia = (sql: string) => sql.trim().replace(/;\s*$/, "");
const ident = (s: string) => /^[a-z_][a-z0-9_]*$/.test(s) ? s : `"${s.replace(/"/g, "\"\"")}"`;
const nombre = (t: TableModel) => t.schema === "public" ? ident(t.name) : `${ident(t.schema)}.${ident(t.name)}`;
export function literal(v: unknown): string {
    if (v === null || v === undefined)
        return "NULL";
    if (typeof v === "number" || typeof v === "bigint")
        return String(v);
    if (typeof v === "boolean")
        return v ? "true" : "false";
    if (v instanceof Date) {
        const iso = v.toISOString();
        return `'${iso.endsWith("T00:00:00.000Z") ? iso.slice(0, 10) : iso}'`;
    }
    if (typeof v === "object")
        return `'${JSON.stringify(v).replace(/'/g, "''")}'`;
    return `'${String(v).replace(/'/g, "''")}'`;
}
export async function compararConsultas(run: Run, schema: string, a: string, b: string, op: OpcionesEquivalencia = {}): Promise<Equivalencia> {
    const vacio: Equivalencia = { columnasA: [], columnasB: [], formaDistinta: false, probados: [], saltados: 0, iguales: false };
    const qa = limpia(a), qb = limpia(b);
    if (!esLectura(qa))
        return { ...vacio, noLectura: "a" };
    if (!esLectura(qb))
        return { ...vacio, noLectura: "b" };
    const uno = async (sql: string) => (await run(sql))[0];
    if (schema.trim()) {
        const bad = (await run(schema)).find(r => r.error);
        if (bad)
            return { ...vacio, esquemaError: bad.error };
    }
    const forma = async (q: string) => {
        await uno("BEGIN");
        const r = await uno(q);
        await uno("ROLLBACK");
        return r;
    };
    const fa = await forma(qa), fb = await forma(qb);
    const err = (r: PgResult): ErrorConsulta | undefined => r.error
        ? { mensaje: r.error, codigo: r.errorInfo?.code, posicion: r.errorInfo?.position } : undefined;
    const columnasA = fa.fields.map(f => f.name), columnasB = fb.fields.map(f => f.name);
    if (fa.error || fb.error)
        return { ...vacio, errorA: err(fa), errorB: err(fb), columnasA, columnasB };
    if (columnasA.length !== columnasB.length)
        return { ...vacio, columnasA, columnasB, formaDistinta: true };
    const alias = columnasA.map((_, i) => `c${i + 1}`);
    const envuelve = (q: string) => `SELECT * FROM (${q}) AS _jt(${alias.join(", ")})`;
    const filas = async (q: string): Promise<unknown[][] | null> => {
        const r = await uno(envuelve(q));
        return r.error ? null : r.rows.map(f => alias.map(k => f[k]));
    };
    const difiere = async (): Promise<{
        soloA: unknown[][];
        soloB: unknown[][];
    } | null | "error"> => {
        const ra = await filas(qa), rb = await filas(qb);
        if (!ra || !rb)
            return "error";
        const d = diffFilas(ra, rb, !!op.ordenado);
        return d.iguales ? null : d;
    };
    const cat = await Promise.all(CATALOG_QUERIES.map(q => uno(q)));
    const modelo = assembleSchema({
        cols: cat[0].rows,
        pks: cat[1].rows,
        fks: cat[2].rows,
        idx: cat[3].rows,
        roles: cat[4].rows,
        nss: cat[5].rows,
        chk: cat[6].rows,
        trg: cat[7].rows,
        enm: cat[8].rows,
        part: cat[9].rows,
        seq: cat[10].rows,
    });
    const tablas = modelo.tables.filter(t => !t.isView && !t.partitioned);
    const extra = op.generarDatos ? op.generarDatos(modelo, op.filasExtra ?? 4) : "";
    const bloques = extra ? extra.split(/;\s*\n\s*\n/).map(b => b.trim()).filter(Boolean) : [];
    const setups: {
        esc: Escenario;
        extra: boolean;
        sql: string[];
    }[] = [{ esc: { tipo: "datos" }, extra: false, sql: [] }];
    if (bloques.length)
        setups.push({ esc: { tipo: "mas-datos" }, extra: true, sql: [] });
    const adversosDe = (conExtra: boolean) => {
        const adversos: {
            esc: Escenario;
            extra: boolean;
            sql: string[];
        }[] = [];
        const base: string[] = [];
        for (const t of tablas) {
            for (const c of t.columns) {
                if (c.notNull || c.isPk)
                    continue;
                adversos.push({ esc: { tipo: "nulo", tabla: t.name, columna: c.name }, extra: conExtra, sql: [...base, `UPDATE ${nombre(t)} SET ${ident(c.name)} = NULL WHERE ctid = (SELECT ctid FROM ${nombre(t)} LIMIT 1)`] });
            }
            const dup = duplicarFila(t);
            if (dup)
                adversos.push({ esc: { tipo: "duplicado", tabla: t.name }, extra: conExtra, sql: [...base, dup] });
            adversos.push({ esc: { tipo: "vacia", tabla: t.name }, extra: conExtra, sql: [...base, `TRUNCATE ${nombre(t)} CASCADE`] });
        }
        return adversos;
    };
    setups.push(...[...adversosDe(false), ...(bloques.length ? adversosDe(true) : [])].slice(0, op.maxEscenarios ?? 80));
    const probados: Escenario[] = [];
    let saltados = 0;
    for (const { esc, extra: conExtra, sql } of setups) {
        await uno("BEGIN");
        if (conExtra) {
            for (const bl of bloques) {
                await uno("SAVEPOINT jt_extra");
                const r = await run(bl);
                await uno(r.some(x => x.error) ? "ROLLBACK TO SAVEPOINT jt_extra" : "RELEASE SAVEPOINT jt_extra");
            }
        }
        let montado = true, efecto = sql.length === 0;
        for (const s of sql) {
            const r = await run(s);
            if (r.some(x => x.error)) {
                montado = false;
                break;
            }
            if (/^\s*TRUNCATE/i.test(s) || r.some(x => x.affected > 0))
                efecto = true;
        }
        if (!montado || !efecto) {
            await uno("ROLLBACK");
            saltados++;
            continue;
        }
        const d = await difiere();
        if (d === "error") {
            await uno("ROLLBACK");
            saltados++;
            continue;
        }
        if (conExtra && esc.tipo !== "mas-datos")
            esc.conGeneradas = true;
        probados.push(esc);
        if (d) {
            const diferencia = await reducir(uno, qa, qb, difiere, esc, d);
            await uno("ROLLBACK");
            return { columnasA, columnasB, formaDistinta: false, probados, saltados, iguales: false, diferencia };
        }
        await uno("ROLLBACK");
    }
    return { columnasA, columnasB, formaDistinta: false, probados, saltados, iguales: true };
}
function duplicarFila(t: TableModel): string | null {
    const auto = (c: TableModel["columns"][number]) => c.identity === "a" || c.identity === "d" || /nextval\(/i.test(c.default ?? "");
    const pk = t.columns.filter(c => c.isPk);
    const pkManual = pk.filter(c => !auto(c));
    if (pkManual.length > 1 || (pkManual.length === 1 && !/^(integer|bigint|smallint)$/.test(pkManual[0].type)))
        return null;
    const cols = t.columns.filter(c => !auto(c));
    if (!cols.length)
        return null;
    const sel = cols.map(c => pkManual[0]?.name === c.name
        ? `(SELECT coalesce(max(${ident(c.name)}), 0) + 1 FROM ${nombre(t)})` : ident(c.name));
    return `INSERT INTO ${nombre(t)} (${cols.map(c => ident(c.name)).join(", ")}) SELECT ${sel.join(", ")} FROM ${nombre(t)} LIMIT 1`;
}
async function reducir(uno: (s: string) => Promise<PgResult>, qa: string, qb: string, difiere: () => Promise<{
    soloA: unknown[][];
    soloB: unknown[][];
} | null | "error">, escenario: Escenario, inicial: {
    soloA: unknown[][];
    soloB: unknown[][];
}): Promise<Diferencia> {
    const leidas = new Set<string>();
    for (const q of [qa, qb]) {
        const p = await uno(`EXPLAIN (FORMAT JSON) ${q}`);
        const recorre = (n: Record<string, unknown>) => {
            if (typeof n["Relation Name"] === "string")
                leidas.add(`${n["Schema"] ?? "public"}.${n["Relation Name"]}`);
            for (const h of (n["Plans"] as Record<string, unknown>[] | undefined) ?? [])
                recorre(h);
        };
        const plan = (p.rows[0] as Record<string, unknown>)?.["QUERY PLAN"] as {
            Plan: Record<string, unknown>;
        }[] | undefined;
        if (plan?.[0])
            recorre(plan[0].Plan);
    }
    const tablasQ = await uno(`SELECT n.nspname AS s, c.relname AS t FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind IN ('r','p') AND n.nspname NOT IN ('pg_catalog','information_schema')`);
    const todas = (tablasQ.rows as {
        s: string;
        t: string;
    }[]).map(x => ({
        lee: leidas.has(`${x.s}.${x.t}`) || leidas.has(`public.${x.t}`),
        t: x.s === "public" ? ident(x.t) : `${ident(x.s)}.${ident(x.t)}`,
    }));
    const tablas = todas.filter(x => x.lee).map(x => x.t);
    let actual = inicial;
    const otras = todas.filter(x => !x.lee).map(x => x.t);
    if (otras.length) {
        await uno("SAVEPOINT jt_otras");
        const vacias = new Set<string>();
        for (let vuelta = 0; vuelta < otras.length; vuelta++) {
            let alguna = false;
            for (const t of otras.filter(x => !vacias.has(x))) {
                await uno("SAVEPOINT jt_otra");
                if ((await uno(`DELETE FROM ${t}`)).error) {
                    await uno("ROLLBACK TO SAVEPOINT jt_otra");
                    continue;
                }
                await uno("RELEASE SAVEPOINT jt_otra");
                vacias.add(t);
                alguna = true;
            }
            if (!alguna)
                break;
        }
        const d = await difiere();
        if (d && d !== "error") {
            actual = d;
            await uno("RELEASE SAVEPOINT jt_otras");
        }
        else
            await uno("ROLLBACK TO SAVEPOINT jt_otras");
    }
    const TOPE = 400;
    let intentos = 0;
    for (let pasada = 0; pasada < 3; pasada++) {
        let borrada = false;
        for (const t of tablas) {
            const ctids = (await uno(`SELECT ctid::text AS c FROM ${t}`)).rows.map(r => String((r as {
                c: string;
            }).c));
            for (const ctid of ctids) {
                if (++intentos > TOPE)
                    break;
                await uno("SAVEPOINT jt_red");
                const del = await uno(`DELETE FROM ${t} WHERE ctid = '${ctid}'::tid`);
                const d = del.error ? null : await difiere();
                if (d && d !== "error") {
                    actual = d;
                    borrada = true;
                    await uno("RELEASE SAVEPOINT jt_red");
                }
                else
                    await uno("ROLLBACK TO SAVEPOINT jt_red");
            }
        }
        if (!borrada || intentos > TOPE)
            break;
    }
    const contraejemplo: TablaContraejemplo[] = [];
    const inserts: string[] = [];
    for (const t of tablas) {
        const r = await uno(`SELECT * FROM ${t}`);
        const columnas = r.fields.map(f => f.name);
        const filas = r.rows.map(f => columnas.map(c => f[c]));
        contraejemplo.push({ tabla: t, columnas, filas });
        if (filas.length)
            inserts.push(`INSERT INTO ${t} (${columnas.map(ident).join(", ")}) VALUES\n  ${filas.map(f => `(${f.map(literal).join(", ")})`).join(",\n  ")};`);
    }
    return { escenario, soloA: actual.soloA, soloB: actual.soloB, contraejemplo, inserts: inserts.join("\n") };
}
@Injectable({ providedIn: "root" })
export class QueryEquivalenceService {
    private engine = inject(PgEngineService);
    private sample = inject(SampleDataService);
    compare(schema: string, a: string, b: string, op: Omit<OpcionesEquivalencia, "generarDatos"> = {}): Promise<Equivalencia> {
        return this.engine.withScratch(run => compararConsultas(run, schema, a, b, {
            ...op,
            generarDatos: (m, n) => this.sample.generate(m, { rowsPerTable: n }),
        }));
    }
}
