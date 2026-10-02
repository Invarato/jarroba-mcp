import { Injectable } from "@angular/core";
import type { CasoPrueba, Clase, SuiteAnalizada, Veredicto } from "./test-audit.model";
import { esFuerte, nivelDeFuerza } from "./test-audit.model";
import type { Dialecto } from "./test-dialects";
export type TipoAviso = "aserciones-duplicadas" | "ruleta-de-aserciones" | "comparacion-escondida" | "logica-condicional";
export interface Aviso {
    tipo: TipoAviso;
    que: string;
    porque: string;
    arreglo: string;
}
const UMBRAL_RULETA = 4;
const ES_BOOLEANO = new Set([
    "assertTrue",
    "assertFalse",
    "isTrue",
    "isFalse",
    "toBeTrue",
    "toBeFalse",
    "True",
    "False",
    "ok",
    "notOk",
    "assert",
]);
const COMPARA_DENTRO = /(==|!=|<=|>=|\s<\s|\s>\s|\.equals\(|\.equalsIgnoreCase\(|\.compareTo\()/;
export interface ResumenAuditoria {
    total: number;
    porClase: Record<Clase, number>;
    sinAsercionFuerte: number;
    indeterminados: number;
}
@Injectable({ providedIn: "root" })
export class TestAuditService {
    clasificar(caso: CasoPrueba): Veredicto {
        const evidencia = { encontradas: caso.aserciones, noReconocidas: caso.noResueltas };
        if (caso.inactivo) {
            return {
                caso,
                clase: "inactivo",
                evidencia,
                porque: `El caso no se ejecuta: ${caso.marcadorInactivo ?? caso.inactivo}.`,
            };
        }
        const fuerzas = caso.aserciones.map((a) => a.fuerza);
        if (fuerzas.some(esFuerte)) {
            const cuales = caso.aserciones.filter((a) => esFuerte(a.fuerza)).map((a) => a.nombre);
            return { caso, clase: "afirma", evidencia, porque: `Afirma sobre un valor: ${listar(cuales)}.` };
        }
        if (caso.noResueltas.length) {
            return {
                caso,
                clase: "indeterminado",
                evidencia,
                porque: `No lo sabemos: llama a ${listar(caso.noResueltas)}, que no reconocemos y no pudimos seguir. `
                    + `Si en tu proyecto eso afirma, decláralo como dialecto y desaparecerá esta duda.`,
            };
        }
        if (!caso.aserciones.length) {
            return {
                caso,
                clase: "sin-asercion",
                evidencia,
                porque: caso.llamadas.length
                    ? `Ejecuta código (${listar(caso.llamadas)}) pero no comprueba nada de lo que sale.`
                    : "El cuerpo del caso no hace nada.",
            };
        }
        if (fuerzas.every((f) => f === "llamada")) {
            return {
                caso,
                clase: "solo-llamada",
                evidencia,
                porque: `Solo comprueba que algo se llamó (${listar(caso.aserciones.map((a) => a.nombre))}), `
                    + "nunca con qu\u00E9 ni qu\u00E9 devolvi\u00F3.",
            };
        }
        return {
            caso,
            clase: "solo-debil",
            evidencia,
            porque: `Solo comprueba que algo existe o es cierto (${listar(caso.aserciones.map((a) => a.nombre))}), `
                + "no QU\u00C9 vale. Pasar\u00EDa igual con casi cualquier valor.",
        };
    }
    auditar(suite: SuiteAnalizada): Veredicto[] {
        return suite.casos.map((c) => this.clasificar(c));
    }
    resumir(veredictos: readonly Veredicto[]): ResumenAuditoria {
        const porClase: Record<Clase, number> = {
            afirma: 0,
            "solo-debil": 0,
            "solo-llamada": 0,
            "sin-asercion": 0,
            indeterminado: 0,
            inactivo: 0,
        };
        for (const v of veredictos)
            porClase[v.clase]++;
        return {
            total: veredictos.length,
            porClase,
            sinAsercionFuerte: porClase["sin-asercion"] + porClase["solo-debil"] + porClase["solo-llamada"],
            indeterminados: porClase.indeterminado,
        };
    }
    fuerzaMaxima(caso: CasoPrueba): number {
        if (!caso.aserciones.length)
            return -1;
        return Math.max(...caso.aserciones.map((a) => nivelDeFuerza(a.fuerza)));
    }
    avisos(caso: CasoPrueba): Aviso[] {
        const out: Aviso[] = [];
        const vistas = new Map<string, number>();
        for (const a of caso.aserciones) {
            const clave = `${a.nombre}|${a.texto.replace(/\s+/g, " ").trim()}`;
            vistas.set(clave, (vistas.get(clave) ?? 0) + 1);
        }
        const repes = [...vistas.entries()].filter(([, n]) => n > 1);
        if (repes.length) {
            out.push({
                tipo: "aserciones-duplicadas",
                que: `Hay ${repes.length} comprobación(es) repetida(s) tal cual: ${repes.map(([k]) => `\`${k.split("|")[1]}\``).join(", ")}.`,
                porque: "La segunda no puede fallar si la primera pasa: ocupa sitio y no a\u00F1ade una sola garant\u00EDa.",
                arreglo: "B\u00F3rrala, o c\u00E1mbiala por la comprobaci\u00F3n que cre\u00EDas estar haciendo \u2014 a veces la repetida delata un copiar-pegar al que le falt\u00F3 cambiar el valor.",
            });
        }
        const esJs = caso.lenguaje === "typescript" || caso.lenguaje === "javascript";
        if (esJs && caso.aserciones.length >= UMBRAL_RULETA && !caso.llamadas.includes("withContext")) {
            out.push({
                tipo: "ruleta-de-aserciones",
                que: `${caso.aserciones.length} comprobaciones y ninguna dice cuál es.`,
                porque: "Cuando este test se ponga en rojo, el informe dir\u00E1 el nombre del caso y no cu\u00E1l de las "
                    + `${caso.aserciones.length} falló. Se acaba comentando líneas para averiguarlo.`,
                arreglo: "A\u00F1ade `withContext('\u2026')` a las que puedan confundirse, o parte el caso en varios con nombres que digan qu\u00E9 comprueban.",
            });
        }
        const escondidas = caso.aserciones.filter((a) => ES_BOOLEANO.has(a.nombre) && COMPARA_DENTRO.test(a.texto));
        if (escondidas.length) {
            out.push({
                tipo: "comparacion-escondida",
                que: `${escondidas.length} comprobación(es) meten una comparación dentro de un booleano: ${escondidas.slice(0, 2).map((a) => `\`${a.texto.slice(0, 60)}\``).join(", ")}.`,
                porque: "Al fallar, el informe solo puede decir \u00ABse esperaba true\u00BB: ni qu\u00E9 valor esperabas ni cu\u00E1l lleg\u00F3. Con esa l\u00EDnea en rojo hay que reproducirlo a mano para saber qu\u00E9 pas\u00F3.",
                arreglo: "S\u00E1cala fuera: `assertEquals(esperado, real)` en vez de `assertTrue(real.equals(esperado))`. Comprueba lo mismo y adem\u00E1s te dice en qu\u00E9 se diferencian.",
            });
        }
        const condicionadas = caso.aserciones.filter((a) => a.condicional);
        if (condicionadas.length) {
            out.push({
                tipo: "logica-condicional",
                que: `${condicionadas.length} comprobación(es) dentro de una rama (\`if\`/\`while\`/\`switch\`): ${listar(condicionadas.map((a) => a.nombre))}.`,
                porque: "Si la condici\u00F3n no se cumple en una ejecuci\u00F3n concreta, esa comprobaci\u00F3n no corre \u2014 y el test sigue en verde por el otro camino, sin que nadie se entere de que dej\u00F3 de comprobar nada.",
                arreglo: "Si son casos de verdad distintos, parte el test en varios con nombres que digan cada cual qu\u00E9 comprueba. Si es un guarda de entorno (`si hay red, si es Windows\u2026`), que salte el caso entero en vez de esconder la comprobaci\u00F3n dentro.",
            });
        }
        return out;
    }
    dialectosValidos(declarados: readonly Partial<Dialecto>[]): Dialecto[] {
        return declarados.filter((d): d is Dialecto => !!d && typeof d.nombre === "string" && !!d.nombre.trim() && !!d.lenguaje
            && Array.isArray(d.fuertes) && Array.isArray(d.debiles) && Array.isArray(d.llamadas));
    }
}
function listar(xs: readonly string[]): string {
    const u = [...new Set(xs)];
    if (u.length <= 3)
        return u.map((x) => `\`${x}\``).join(", ");
    return `${u.slice(0, 3).map((x) => `\`${x}\``).join(", ")} y ${u.length - 3} más`;
}
