import { EspecApi, OperacionApi, ParamApi, CuerpoApi } from "./api-openapi";
export type Gravedad = "rompe" | "aviso" | "info";
export type ReglaDiff = "operacion-eliminada" | "operacion-nueva" | "operacion-obsoleta" | "servidor-cambiado" | "param-requerido-nuevo" | "param-opcional-nuevo" | "param-pasa-a-requerido" | "param-pasa-a-opcional" | "param-cambia-de-tipo" | "param-ruta-eliminado" | "param-eliminado" | "enum-abierto" | "enum-cerrado" | "enum-valor-eliminado" | "enum-valor-nuevo" | "cuerpo-requerido-nuevo" | "cuerpo-opcional-nuevo" | "cuerpo-eliminado" | "cuerpo-pasa-a-requerido" | "content-type-eliminado" | "campo-requerido-nuevo" | "campo-opcional-nuevo" | "campo-pasa-a-requerido" | "campo-cambia-de-tipo" | "campo-eliminado" | "respuesta-exito-eliminada" | "respuesta-eliminada" | "respuesta-nueva" | "seguridad-nueva" | "seguridad-esquema-nuevo" | "seguridad-esquema-eliminado" | "seguridad-eliminada";
export interface Cambio {
    regla: ReglaDiff;
    gravedad: Gravedad;
    operacion: string;
    datos: Record<string, string | number>;
}
export interface Informe {
    cambios: Cambio[];
    rompe: number;
    avisos: number;
    info: number;
    compatible: boolean;
    deA: {
        titulo: string;
        version: string;
    };
    aB: {
        titulo: string;
        version: string;
    };
}
export function comparar(antes: EspecApi, despues: EspecApi): Informe {
    const cambios: Cambio[] = [];
    const mapaA = new Map(antes.operaciones.map(o => [o.id, o]));
    const mapaB = new Map(despues.operaciones.map(o => [o.id, o]));
    for (const [id, a] of mapaA) {
        const b = mapaB.get(id);
        if (!b) {
            cambios.push({
                regla: "operacion-eliminada",
                gravedad: "rompe",
                operacion: id,
                datos: {},
            });
            continue;
        }
        compararOperacion(a, b, cambios);
    }
    for (const [id, b] of mapaB) {
        if (!mapaA.has(id)) {
            cambios.push({
                regla: "operacion-nueva",
                gravedad: "info",
                operacion: id,
                datos: { resumen: b.resumen ?? "" },
            });
        }
    }
    if (antes.servidor && despues.servidor && antes.servidor !== despues.servidor) {
        cambios.push({
            regla: "servidor-cambiado",
            gravedad: "rompe",
            operacion: "(global)",
            datos: { antes: antes.servidor, despues: despues.servidor },
        });
    }
    const peso: Record<Gravedad, number> = { rompe: 0, aviso: 1, info: 2 };
    cambios.sort((x, y) => peso[x.gravedad] - peso[y.gravedad]
        || x.operacion.localeCompare(y.operacion)
        || x.regla.localeCompare(y.regla)
        || JSON.stringify(x.datos).localeCompare(JSON.stringify(y.datos)));
    const rompe = cambios.filter(c => c.gravedad === "rompe").length;
    return {
        cambios,
        rompe,
        avisos: cambios.filter(c => c.gravedad === "aviso").length,
        info: cambios.filter(c => c.gravedad === "info").length,
        compatible: rompe === 0,
        deA: { titulo: antes.titulo, version: antes.version },
        aB: { titulo: despues.titulo, version: despues.version },
    };
}
function compararOperacion(a: OperacionApi, b: OperacionApi, out: Cambio[]): void {
    const id = a.id;
    if (!a.obsoleta && b.obsoleta) {
        out.push({
            regla: "operacion-obsoleta",
            gravedad: "aviso",
            operacion: id,
            datos: {},
        });
    }
    compararParams(a.params, b.params, id, out);
    compararCuerpo(a.cuerpo, b.cuerpo, id, out);
    compararRespuestas(a.respuestas, b.respuestas, id, out);
    compararSeguridad(a.seguridad, b.seguridad, id, out);
}
const clave = (p: ParamApi) => `${p.donde}:${p.nombre}`;
function compararParams(antes: ParamApi[], despues: ParamApi[], id: string, out: Cambio[]): void {
    const A = new Map(antes.map(p => [clave(p), p]));
    const B = new Map(despues.map(p => [clave(p), p]));
    for (const [k, b] of B) {
        const a = A.get(k);
        if (!a) {
            out.push(b.requerido
                ? {
                    regla: "param-requerido-nuevo",
                    gravedad: "rompe",
                    operacion: id,
                    datos: { nombre: b.nombre, donde: b.donde },
                }
                : {
                    regla: "param-opcional-nuevo",
                    gravedad: "info",
                    operacion: id,
                    datos: { nombre: b.nombre, donde: b.donde },
                });
            continue;
        }
        if (!a.requerido && b.requerido) {
            out.push({
                regla: "param-pasa-a-requerido",
                gravedad: "rompe",
                operacion: id,
                datos: { nombre: a.nombre, donde: a.donde },
            });
        }
        if (a.requerido && !b.requerido) {
            out.push({
                regla: "param-pasa-a-opcional",
                gravedad: "info",
                operacion: id,
                datos: { nombre: a.nombre, donde: a.donde },
            });
        }
        if (a.tipo !== b.tipo) {
            out.push({
                regla: "param-cambia-de-tipo",
                gravedad: "rompe",
                operacion: id,
                datos: { nombre: a.nombre, donde: a.donde, de: a.tipo, a: b.tipo },
            });
        }
        compararEnum(a, b, id, out);
    }
    for (const [k, a] of A) {
        if (B.has(k))
            continue;
        out.push(a.donde === "path"
            ? {
                regla: "param-ruta-eliminado",
                gravedad: "rompe",
                operacion: id,
                datos: { nombre: a.nombre },
            }
            : {
                regla: "param-eliminado",
                gravedad: "aviso",
                operacion: id,
                datos: { nombre: a.nombre, donde: a.donde },
            });
    }
}
function compararEnum(a: ParamApi, b: ParamApi, id: string, out: Cambio[]): void {
    if (!a.enumerado && !b.enumerado)
        return;
    if (a.enumerado && !b.enumerado) {
        out.push({
            regla: "enum-abierto",
            gravedad: "info",
            operacion: id,
            datos: { nombre: a.nombre },
        });
        return;
    }
    if (!a.enumerado && b.enumerado) {
        out.push({
            regla: "enum-cerrado",
            gravedad: "rompe",
            operacion: id,
            datos: { nombre: a.nombre, valores: b.enumerado!.join(", ") },
        });
        return;
    }
    const A = new Set(a.enumerado!);
    const B = new Set(b.enumerado!);
    const quitados = [...A].filter(v => !B.has(v));
    const puestos = [...B].filter(v => !A.has(v));
    if (quitados.length) {
        out.push({
            regla: "enum-valor-eliminado",
            gravedad: "rompe",
            operacion: id,
            datos: { nombre: a.nombre, valores: quitados.join(", ") },
        });
    }
    if (puestos.length) {
        out.push({
            regla: "enum-valor-nuevo",
            gravedad: "info",
            operacion: id,
            datos: { nombre: a.nombre, valores: puestos.join(", ") },
        });
    }
}
function compararCuerpo(a: CuerpoApi | undefined, b: CuerpoApi | undefined, id: string, out: Cambio[]): void {
    if (!a && !b)
        return;
    if (!a && b) {
        out.push(b.requerido
            ? {
                regla: "cuerpo-requerido-nuevo",
                gravedad: "rompe",
                operacion: id,
                datos: {},
            }
            : {
                regla: "cuerpo-opcional-nuevo",
                gravedad: "info",
                operacion: id,
                datos: {},
            });
        return;
    }
    if (a && !b) {
        out.push({
            regla: "cuerpo-eliminado",
            gravedad: "aviso",
            operacion: id,
            datos: {},
        });
        return;
    }
    if (!a || !b)
        return;
    if (!a.requerido && b.requerido) {
        out.push({
            regla: "cuerpo-pasa-a-requerido",
            gravedad: "rompe",
            operacion: id,
            datos: {},
        });
    }
    const tiposQuitados = a.tipos.filter(t => !b.tipos.includes(t));
    if (tiposQuitados.length) {
        out.push({
            regla: "content-type-eliminado",
            gravedad: "rompe",
            operacion: id,
            datos: { tipos: tiposQuitados.join(", ") },
        });
    }
    const A = new Map(a.campos.map(c => [c.nombre, c]));
    const B = new Map(b.campos.map(c => [c.nombre, c]));
    for (const [n, cb] of B) {
        const ca = A.get(n);
        if (!ca) {
            if (cb.requerido) {
                out.push({
                    regla: "campo-requerido-nuevo",
                    gravedad: "rompe",
                    operacion: id,
                    datos: { nombre: n, tipo: cb.tipo },
                });
            }
            else {
                out.push({
                    regla: "campo-opcional-nuevo",
                    gravedad: "info",
                    operacion: id,
                    datos: { nombre: n, tipo: cb.tipo },
                });
            }
            continue;
        }
        if (!ca.requerido && cb.requerido) {
            out.push({
                regla: "campo-pasa-a-requerido",
                gravedad: "rompe",
                operacion: id,
                datos: { nombre: n },
            });
        }
        if (ca.tipo !== cb.tipo) {
            out.push({
                regla: "campo-cambia-de-tipo",
                gravedad: "rompe",
                operacion: id,
                datos: { nombre: n, de: ca.tipo, a: cb.tipo },
            });
        }
    }
    for (const [n, ca] of A) {
        if (B.has(n))
            continue;
        out.push({
            regla: "campo-eliminado",
            gravedad: "aviso",
            operacion: id,
            datos: { nombre: n, eraObligatorio: ca.requerido ? 1 : 0 },
        });
    }
}
function compararRespuestas(antes: string[], despues: string[], id: string, out: Cambio[]): void {
    const B = new Set(despues);
    const quitadas = antes.filter(c => !B.has(c));
    const A = new Set(antes);
    const nuevas = despues.filter(c => !A.has(c));
    if (quitadas.length) {
        const exito = quitadas.filter(c => /^2/.test(c));
        if (exito.length) {
            out.push({
                regla: "respuesta-exito-eliminada",
                gravedad: "rompe",
                operacion: id,
                datos: { codigos: exito.join(", ") },
            });
        }
        const otras = quitadas.filter(c => !/^2/.test(c));
        if (otras.length) {
            out.push({
                regla: "respuesta-eliminada",
                gravedad: "aviso",
                operacion: id,
                datos: { codigos: otras.join(", ") },
            });
        }
    }
    if (nuevas.length) {
        out.push({
            regla: "respuesta-nueva",
            gravedad: "info",
            operacion: id,
            datos: { codigos: nuevas.join(", ") },
        });
    }
}
function compararSeguridad(antes: string[], despues: string[], id: string, out: Cambio[]): void {
    const A = new Set(antes);
    const B = new Set(despues);
    const nuevas = [...B].filter(s => !A.has(s));
    const quitadas = [...A].filter(s => !B.has(s));
    if (!antes.length && despues.length) {
        out.push({
            regla: "seguridad-nueva",
            gravedad: "rompe",
            operacion: id,
            datos: { esquemas: despues.join(", ") },
        });
    }
    else if (nuevas.length) {
        out.push({
            regla: "seguridad-esquema-nuevo",
            gravedad: "rompe",
            operacion: id,
            datos: { esquemas: nuevas.join(", ") },
        });
    }
    if (quitadas.length && despues.length) {
        out.push({
            regla: "seguridad-esquema-eliminado",
            gravedad: "info",
            operacion: id,
            datos: { esquemas: quitadas.join(", ") },
        });
    }
    else if (quitadas.length) {
        out.push({
            regla: "seguridad-eliminada",
            gravedad: "info",
            operacion: id,
            datos: {},
        });
    }
}
export interface TextosInforme {
    titulo(inf: Informe): string;
    veredicto(inf: Informe): string;
    bloque(g: Gravedad): string;
    cambio(c: Cambio): {
        detalle: string;
        porque?: string;
    };
}
export function informeMarkdown(inf: Informe, t: TextosInforme): string {
    const l: string[] = [];
    l.push(`# ${t.titulo(inf)}`, "");
    l.push(t.veredicto(inf));
    l.push("");
    for (const g of ["rompe", "aviso", "info"] as const) {
        const cs = inf.cambios.filter(c => c.gravedad === g);
        if (!cs.length)
            continue;
        l.push(`## ${t.bloque(g)}`, "");
        for (const c of cs) {
            const { detalle, porque } = t.cambio(c);
            l.push(`- **${c.operacion}** — ${detalle}${porque ? ` _${porque}_` : ""} \`${c.regla}\``);
        }
        l.push("");
    }
    return l.join("\n");
}
