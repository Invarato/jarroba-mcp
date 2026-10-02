import type { PgResult } from "./pg-engine.service";
export type Run = (sql: string) => Promise<PgResult[]>;
export interface ColumnaResultado {
    nombre: string;
    tipo: string;
}
export interface ComprobacionConsulta {
    esquemaError?: string;
    error?: {
        mensaje: string;
        codigo?: string;
        posicion?: number;
    };
    columnas: ColumnaResultado[];
    filas: number;
    muestra: Record<string, unknown>[];
}
export async function comprobarConsulta(run: Run, schema: string, sql: string, muestra = 3): Promise<ComprobacionConsulta> {
    const vacio: ComprobacionConsulta = { columnas: [], filas: 0, muestra: [] };
    const uno = async (s: string) => (await run(s))[0];
    if (schema.trim()) {
        const bad = (await run(schema)).find(r => r.error);
        if (bad)
            return { ...vacio, esquemaError: bad.error };
    }
    const q = sql.trim().replace(/;\s*$/, "");
    await uno("BEGIN");
    try {
        const r = await uno(q);
        if (r.error)
            return { ...vacio, error: { mensaje: r.error, codigo: r.errorInfo?.code, posicion: r.errorInfo?.position } };
        const oids = [...new Set(r.fields.map(f => f.typeId))];
        const nombres = new Map<number, string>();
        if (oids.length) {
            const t = await uno(`SELECT oid::int AS oid, format_type(oid, NULL) AS nombre FROM pg_type WHERE oid IN (${oids.join(",")})`);
            for (const f of t.rows as {
                oid: number;
                nombre: string;
            }[])
                nombres.set(f.oid, f.nombre);
        }
        return {
            columnas: r.fields.map(f => ({ nombre: f.name, tipo: nombres.get(f.typeId) ?? String(f.typeId) })),
            filas: r.fields.length ? r.rows.length : r.affected,
            muestra: r.rows.slice(0, muestra),
        };
    }
    finally {
        await uno("ROLLBACK");
    }
}
