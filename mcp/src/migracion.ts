import type { MigrationImpact, Risk, FixCode } from "../../src/app/services/migration-impact.service";
export const RIESGO: Record<Risk, string> = { alto: "high", medio: "medium", bajo: "low" };
export const ARREGLO: Record<FixCode, string> = {
    "check-not-valid": "Add the CHECK as NOT VALID, then VALIDATE CONSTRAINT separately: validating takes a weaker lock and does not block writes.",
    "fk-not-valid": "Add the FOREIGN KEY as NOT VALID, then VALIDATE CONSTRAINT separately: the long scan runs without blocking writes.",
    "notnull-not-valid": "PostgreSQL 18: add NOT NULL as a NOT VALID constraint, then VALIDATE it, instead of a full-table check under an exclusive lock.",
    "index-concurrently": "Use CREATE INDEX CONCURRENTLY (it cannot run inside a transaction block): it does not block writes while building.",
    "type-new-column": "Instead of ALTER COLUMN TYPE (rewrites the whole table under an exclusive lock): add a new column, backfill it in batches, then swap.",
    "default-backfill": "Add the column without a volatile default, then backfill in batches: a volatile default rewrites the table.",
    "lock-timeout": "SET lock_timeout (e.g. '5s') before the statement: it needs an exclusive lock, and without a timeout it queues behind any long transaction and blocks every query behind it.",
};
export function migracionEn(m: MigrationImpact) {
    return {
        statements: m.statements.map((s) => ({
            line: s.line,
            sql: s.sql.length > 300 ? s.sql.slice(0, 297) + "\u2026" : s.sql,
            risk: RIESGO[s.risk],
            tables: s.tables.map((t) => ({
                table: t.table,
                strongestLock: t.lock,
                rewritesTable: t.rewrites,
                fullScan: t.scans,
                createdByThisStatement: t.isNew || undefined,
            })),
            saferAlternatives: s.fixes.map((f) => ({ fix: f.code, why: ARREGLO[f.code], sql: f.sql })),
            error: s.error,
            sqlstate: s.code,
            notMeasured: s.noTx ? "cannot run inside a transaction (e.g. CONCURRENTLY), so it was not measured" : undefined,
            skipped: s.skipped ? "not run: an earlier statement failed, so the real migration would stop there" : undefined,
        })),
    };
}
import type { ComprobacionConsulta } from "../../src/app/services/query-check";
import type { Equivalencia, TipoEscenario, Escenario } from "../../src/app/services/query-equivalence.service";
import type { ImpactoCambio, Veredicto, Cambio } from "../../src/app/services/schema-breaking";
const errorPg = (e?: {
    mensaje: string;
    codigo?: string;
    posicion?: number;
}) => e && { message: e.mensaje, sqlstate: e.codigo, position: e.posicion };
export const comprobacionEn = (c: ComprobacionConsulta) => ({
    runs: !c.error,
    error: errorPg(c.error),
    columns: c.columnas.map((x) => ({ name: x.nombre, type: x.tipo })),
    rows: c.error ? undefined : c.filas,
    sample: c.muestra.length ? c.muestra : undefined,
});
export const ESCENARIO: Record<TipoEscenario, string> = {
    datos: "your-data",
    "mas-datos": "more-rows",
    nulo: "null-value",
    duplicado: "duplicate-row",
    vacia: "empty-table",
};
const escenarioEn = (e: Escenario) => ({
    scenario: ESCENARIO[e.tipo],
    table: e.tabla,
    column: e.columna,
    includesGeneratedRows: e.conGeneradas,
});
export const equivalenciaEn = (q: Equivalencia) => ({
    sameResult: q.iguales,
    compareWithError: errorPg(q.errorB),
    notReadOnly: q.noLectura && `${q.noLectura === "a" ? "sql" : "compareWith"} writes data, so it cannot be compared`,
    differentColumnCount: q.formaDistinta || undefined,
    scenariosTested: q.probados.map((e) => ESCENARIO[e.tipo]),
    scenariosSkipped: q.saltados || undefined,
    counterExample: q.diferencia && {
        ...escenarioEn(q.diferencia.escenario),
        onlyInSql: q.diferencia.soloA,
        onlyInCompareWith: q.diferencia.soloB,
        data: q.diferencia.contraejemplo.map((t) => ({ table: t.tabla, columns: t.columnas, rows: t.filas })),
        inserts: q.diferencia.inserts,
    },
});
export const VEREDICTO: Record<Veredicto, string> = {
    rompe: "breaks",
    cambia: "changes",
    amplia: "widens",
    arregla: "fixes",
    fallaba: "already-failing",
    igual: "same",
};
const CAMBIO: Record<Cambio["tipo"], string> = { quitada: "column-removed", nueva: "column-added", tipo: "type-changed" };
export const impactoEn = (i: ImpactoCambio) => ({
    breaking: i.rompedor,
    queries: i.consultas.map((c) => ({
        name: c.nombre,
        verdict: VEREDICTO[c.veredicto],
        error: c.error,
        changes: c.cambios.length ? c.cambios.map((x) => ({ change: CAMBIO[x.tipo], column: x.columna, before: x.antes, after: x.despues })) : undefined,
    })),
});
