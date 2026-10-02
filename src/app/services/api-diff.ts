import { EspecApi, OperacionApi, ParamApi, CuerpoApi } from "./api-openapi";
export type Gravedad = "rompe" | "aviso" | "info";
export interface Cambio {
    regla: string;
    gravedad: Gravedad;
    operacion: string;
    detalle: string;
    porque?: string;
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
                detalle: "La operaci\u00F3n ya no existe.",
                porque: "Un cliente que la llame recibir\u00E1 404 o 405.",
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
                detalle: `Operación nueva${b.resumen ? `: ${b.resumen}` : ""}.`,
                porque: "A\u00F1adir no rompe a quien no la usa.",
            });
        }
    }
    if (antes.servidor && despues.servidor && antes.servidor !== despues.servidor) {
        cambios.push({
            regla: "servidor-cambiado",
            gravedad: "rompe",
            operacion: "(global)",
            detalle: `El servidor pasa de «${antes.servidor}» a «${despues.servidor}».`,
            porque: "Un cliente con la URL base fija seguir\u00E1 llamando a la direcci\u00F3n vieja.",
        });
    }
    const peso: Record<Gravedad, number> = { rompe: 0, aviso: 1, info: 2 };
    cambios.sort((x, y) => peso[x.gravedad] - peso[y.gravedad]
        || x.operacion.localeCompare(y.operacion)
        || x.regla.localeCompare(y.regla)
        || x.detalle.localeCompare(y.detalle));
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
            detalle: "Marcada como obsoleta (deprecated).",
            porque: "Todav\u00EDa funciona, pero anuncia que va a desaparecer.",
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
                    detalle: `Parámetro OBLIGATORIO nuevo: «${b.nombre}» (${b.donde}).`,
                    porque: "El cliente viejo no lo env\u00EDa; la llamada pasar\u00E1 a fallar.",
                }
                : {
                    regla: "param-opcional-nuevo",
                    gravedad: "info",
                    operacion: id,
                    detalle: `Parámetro opcional nuevo: «${b.nombre}» (${b.donde}).`,
                    porque: "El cliente viejo no lo env\u00EDa y sigue funcionando igual.",
                });
            continue;
        }
        if (!a.requerido && b.requerido) {
            out.push({
                regla: "param-pasa-a-requerido",
                gravedad: "rompe",
                operacion: id,
                detalle: `«${a.nombre}» (${a.donde}) pasa a ser obligatorio.`,
                porque: "El cliente que lo omit\u00EDa dejar\u00E1 de funcionar.",
            });
        }
        if (a.requerido && !b.requerido) {
            out.push({
                regla: "param-pasa-a-opcional",
                gravedad: "info",
                operacion: id,
                detalle: `«${a.nombre}» (${a.donde}) pasa a ser opcional.`,
                porque: "Relajar un requisito no rompe a quien ya lo cumpl\u00EDa.",
            });
        }
        if (a.tipo !== b.tipo) {
            out.push({
                regla: "param-cambia-de-tipo",
                gravedad: "rompe",
                operacion: id,
                detalle: `«${a.nombre}» (${a.donde}) pasa de ${a.tipo} a ${b.tipo}.`,
                porque: "Lo que el cliente env\u00EDa puede dejar de ser v\u00E1lido.",
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
                detalle: `Desaparece el parámetro de ruta «${a.nombre}».`,
                porque: "Cambia la forma de la URL: la que el cliente construye ya no existe.",
            }
            : {
                regla: "param-eliminado",
                gravedad: "aviso",
                operacion: id,
                detalle: `Desaparece el parámetro «${a.nombre}» (${a.donde}).`,
                porque: "Lo que el cliente siga enviando se ignorar\u00E1; comprueba si depend\u00EDa del efecto.",
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
            detalle: `«${a.nombre}» deja de estar limitado a una lista de valores.`,
            porque: "Aceptar m\u00E1s de lo que aceptaba no rompe a nadie.",
        });
        return;
    }
    if (!a.enumerado && b.enumerado) {
        out.push({
            regla: "enum-cerrado",
            gravedad: "rompe",
            operacion: id,
            detalle: `«${a.nombre}» pasa a estar limitado a: ${b.enumerado!.join(", ")}.`,
            porque: "Un valor que el cliente enviaba puede haber dejado de valer.",
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
            detalle: `«${a.nombre}» ya no acepta: ${quitados.join(", ")}.`,
            porque: "El cliente que enviaba ese valor pasar\u00E1 a recibir un error.",
        });
    }
    if (puestos.length) {
        out.push({
            regla: "enum-valor-nuevo",
            gravedad: "info",
            operacion: id,
            detalle: `«${a.nombre}» acepta además: ${puestos.join(", ")}.`,
            porque: "Aceptar un valor m\u00E1s no afecta a quien no lo env\u00EDa.",
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
                detalle: "La operaci\u00F3n pasa a exigir un cuerpo.",
                porque: "El cliente viejo no env\u00EDa ninguno.",
            }
            : {
                regla: "cuerpo-opcional-nuevo",
                gravedad: "info",
                operacion: id,
                detalle: "La operaci\u00F3n acepta ahora un cuerpo opcional.",
            });
        return;
    }
    if (a && !b) {
        out.push({
            regla: "cuerpo-eliminado",
            gravedad: "aviso",
            operacion: id,
            detalle: "La operaci\u00F3n ya no declara cuerpo.",
            porque: "Lo que el cliente env\u00EDe se ignorar\u00E1.",
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
            detalle: "El cuerpo pasa a ser obligatorio.",
            porque: "La llamada sin cuerpo dejar\u00E1 de valer.",
        });
    }
    const tiposQuitados = a.tipos.filter(t => !b.tipos.includes(t));
    if (tiposQuitados.length) {
        out.push({
            regla: "content-type-eliminado",
            gravedad: "rompe",
            operacion: id,
            detalle: `Ya no acepta: ${tiposQuitados.join(", ")}.`,
            porque: "El cliente que env\u00EDe ese Content-Type recibir\u00E1 415.",
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
                    detalle: `Campo OBLIGATORIO nuevo en el cuerpo: «${n}» (${cb.tipo}).`,
                    porque: "El cuerpo que env\u00EDa el cliente viejo ya no es v\u00E1lido.",
                });
            }
            else {
                out.push({
                    regla: "campo-opcional-nuevo",
                    gravedad: "info",
                    operacion: id,
                    detalle: `Campo opcional nuevo en el cuerpo: «${n}» (${cb.tipo}).`,
                });
            }
            continue;
        }
        if (!ca.requerido && cb.requerido) {
            out.push({
                regla: "campo-pasa-a-requerido",
                gravedad: "rompe",
                operacion: id,
                detalle: `El campo «${n}» del cuerpo pasa a ser obligatorio.`,
                porque: "El cliente que lo omit\u00EDa dejar\u00E1 de funcionar.",
            });
        }
        if (ca.tipo !== cb.tipo) {
            out.push({
                regla: "campo-cambia-de-tipo",
                gravedad: "rompe",
                operacion: id,
                detalle: `El campo «${n}» del cuerpo pasa de ${ca.tipo} a ${cb.tipo}.`,
                porque: "Lo que el cliente env\u00EDa puede dejar de ser v\u00E1lido.",
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
            detalle: `Desaparece del cuerpo el campo «${n}»${ca.requerido ? " (era obligatorio)" : ""}.`,
            porque: "Lo que el cliente siga enviando se ignorar\u00E1; comprueba si depend\u00EDa del efecto.",
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
                detalle: `Ya no documenta la respuesta ${exito.join(", ")}.`,
                porque: "El cliente que espera ese c\u00F3digo puede quedarse sin la rama que lo trata.",
            });
        }
        const otras = quitadas.filter(c => !/^2/.test(c));
        if (otras.length) {
            out.push({
                regla: "respuesta-eliminada",
                gravedad: "aviso",
                operacion: id,
                detalle: `Ya no documenta: ${otras.join(", ")}.`,
                porque: "Puede ser solo documentaci\u00F3n, pero si el cliente la trataba conviene mirarlo.",
            });
        }
    }
    if (nuevas.length) {
        out.push({
            regla: "respuesta-nueva",
            gravedad: "info",
            operacion: id,
            detalle: `Documenta respuestas nuevas: ${nuevas.join(", ")}.`,
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
            detalle: `Pasa a exigir autenticación: ${despues.join(", ")}.`,
            porque: "El cliente que llamaba sin credenciales recibir\u00E1 401.",
        });
    }
    else if (nuevas.length) {
        out.push({
            regla: "seguridad-esquema-nuevo",
            gravedad: "rompe",
            operacion: id,
            detalle: `Exige además: ${nuevas.join(", ")}.`,
            porque: "El cliente no env\u00EDa ese esquema y ser\u00E1 rechazado.",
        });
    }
    if (quitadas.length && despues.length) {
        out.push({
            regla: "seguridad-esquema-eliminado",
            gravedad: "info",
            operacion: id,
            detalle: `Ya no exige: ${quitadas.join(", ")}.`,
            porque: "Relajar un requisito no rompe a quien ya lo cumpl\u00EDa.",
        });
    }
    else if (quitadas.length) {
        out.push({
            regla: "seguridad-eliminada",
            gravedad: "info",
            operacion: id,
            detalle: "Deja de exigir autenticaci\u00F3n.",
            porque: "El cliente que ya la enviaba sigue funcionando.",
        });
    }
}
export function informeMarkdown(inf: Informe): string {
    const l: string[] = [];
    l.push(`# Cambios de API: ${inf.deA.titulo} ${inf.deA.version} → ${inf.aB.version}`, "");
    l.push(inf.compatible
        ? `**Compatible.** Ningún cambio rompe a un cliente existente (${inf.avisos} aviso(s), ${inf.info} informativo(s)).`
        : `**${inf.rompe} cambio(s) ROMPEDOR(es).** Un cliente que ya existe dejará de funcionar.`);
    l.push("");
    const bloques: [
        Gravedad,
        string
    ][] = [
        ["rompe", "## Rompe"],
        ["aviso", "## Avisos"],
        ["info", "## Informativo"],
    ];
    for (const [g, titulo] of bloques) {
        const cs = inf.cambios.filter(c => c.gravedad === g);
        if (!cs.length)
            continue;
        l.push(titulo, "");
        for (const c of cs) {
            l.push(`- **${c.operacion}** — ${c.detalle}${c.porque ? ` _${c.porque}_` : ""} \`${c.regla}\``);
        }
        l.push("");
    }
    return l.join("\n");
}
