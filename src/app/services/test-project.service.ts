import { Injectable } from "@angular/core";
import type { Clase, Fuerza, Lenguaje, MotivoInactivo, Veredicto } from "./test-audit.model";
export interface FicheroAuditado {
    ruta: string;
    lenguaje: Lenguaje;
    veredictos: Veredicto[];
}
export interface FicheroOmitido {
    ruta: string;
    motivo: string;
}
export interface FilaFichero {
    ruta: string;
    lenguaje: Lenguaje;
    casos: number;
    sinAsercionFuerte: number;
    indeterminados: number;
    inactivos: number;
    proporcion: number;
}
export interface CasoDesactivado {
    ruta: string;
    nombre: string;
    linea: number;
    motivo: MotivoInactivo;
    marcador?: string;
    aserciones: number;
}
export interface UsoMatcher {
    lenguaje: Lenguaje;
    nombre: string;
    fuerza: Fuerza;
    veces: number;
}
export interface ResumenProyecto {
    ficheros: number;
    casos: number;
    porClase: Record<Clase, number>;
    sinAsercionFuerte: number;
    indeterminados: number;
    porLenguaje: {
        lenguaje: Lenguaje;
        ficheros: number;
        casos: number;
        sinAsercionFuerte: number;
    }[];
    peores: FilaFichero[];
    desactivados: CasoDesactivado[];
    omitidos: FicheroOmitido[];
}
const CLASES_ACUSADAS: readonly Clase[] = ["sin-asercion", "solo-debil", "solo-llamada"];
const EXTENSIONES: Record<string, Lenguaje> = {
    ts: "typescript",
    tsx: "typescript",
    mts: "typescript",
    cts: "typescript",
    js: "javascript",
    mjs: "javascript",
    cjs: "javascript",
    jsx: "javascript",
    py: "python",
    java: "java",
    go: "go",
};
const CARPETA_FUERA = /^(node_modules|\.git|dist|build|out|target|vendor|\.venv|venv|__pycache__|coverage|\.angular|\.next|\.nuxt)$/;
const CARPETAS_FUERA = new RegExp(`(^|/)(${CARPETA_FUERA.source.slice(1, -1)})(/|$)`);
@Injectable({ providedIn: "root" })
export class TestProjectService {
    esFicheroDeTest(ruta: string): boolean {
        if (CARPETAS_FUERA.test(ruta))
            return false;
        const nombre = ruta.split("/").pop() ?? "";
        const ext = nombre.includes(".") ? nombre.split(".").pop()!.toLowerCase() : "";
        if (!(ext in EXTENSIONES))
            return false;
        if (/[._-](spec|test)\.[a-z]+$/i.test(nombre))
            return true;
        if (/^test_[\w-]+\.py$/i.test(nombre))
            return true;
        if (/_test\.(py|go|js|ts)$/i.test(nombre))
            return true;
        if (/(Test|Tests|IT)\.java$/.test(nombre))
            return true;
        return /(^|\/)(__tests__|tests?|spec)\//i.test(ruta);
    }
    carpetaExcluida(nombre: string): boolean {
        return CARPETA_FUERA.test(nombre);
    }
    lenguajeDe(ruta: string): Lenguaje | null {
        const ext = (ruta.split("/").pop() ?? "").split(".").pop()?.toLowerCase() ?? "";
        return EXTENSIONES[ext] ?? null;
    }
    agregar(ficheros: readonly FicheroAuditado[], omitidos: readonly FicheroOmitido[] = []): ResumenProyecto {
        const porClase: Record<Clase, number> = {
            afirma: 0,
            "solo-debil": 0,
            "solo-llamada": 0,
            "sin-asercion": 0,
            indeterminado: 0,
            inactivo: 0,
        };
        const porLenguaje = new Map<Lenguaje, {
            ficheros: number;
            casos: number;
            sinAsercionFuerte: number;
        }>();
        const peores: FilaFichero[] = [];
        const desactivados: CasoDesactivado[] = [];
        let casos = 0;
        for (const f of ficheros) {
            let flojos = 0;
            let dudas = 0;
            let inactivos = 0;
            for (const v of f.veredictos) {
                casos++;
                porClase[v.clase]++;
                if (CLASES_ACUSADAS.includes(v.clase))
                    flojos++;
                else if (v.clase === "indeterminado")
                    dudas++;
                else if (v.clase === "inactivo") {
                    inactivos++;
                    desactivados.push({
                        ruta: f.ruta,
                        nombre: v.caso.nombre,
                        linea: v.caso.linea,
                        motivo: v.caso.inactivo!,
                        marcador: v.caso.marcadorInactivo,
                        aserciones: v.caso.aserciones.length,
                    });
                }
            }
            const l = porLenguaje.get(f.lenguaje) ?? { ficheros: 0, casos: 0, sinAsercionFuerte: 0 };
            l.ficheros++;
            l.casos += f.veredictos.length;
            l.sinAsercionFuerte += flojos;
            porLenguaje.set(f.lenguaje, l);
            if (flojos || dudas || inactivos) {
                const juzgados = f.veredictos.length - dudas - inactivos;
                peores.push({
                    ruta: f.ruta,
                    lenguaje: f.lenguaje,
                    casos: f.veredictos.length,
                    sinAsercionFuerte: flojos,
                    indeterminados: dudas,
                    inactivos,
                    proporcion: juzgados > 0 ? flojos / juzgados : 0,
                });
            }
        }
        peores.sort((a, b) => b.sinAsercionFuerte - a.sinAsercionFuerte
            || b.proporcion - a.proporcion
            || b.inactivos - a.inactivos
            || a.ruta.localeCompare(b.ruta));
        desactivados.sort((a, b) => b.aserciones - a.aserciones || a.ruta.localeCompare(b.ruta));
        return {
            ficheros: ficheros.length,
            casos,
            porClase,
            sinAsercionFuerte: porClase["sin-asercion"] + porClase["solo-debil"] + porClase["solo-llamada"],
            indeterminados: porClase.indeterminado,
            porLenguaje: [...porLenguaje.entries()]
                .map(([lenguaje, v]) => ({ lenguaje, ...v }))
                .sort((a, b) => b.casos - a.casos),
            peores,
            desactivados,
            omitidos: [...omitidos],
        };
    }
    usoDeMatchers(ficheros: readonly FicheroAuditado[], declarados: readonly {
        lenguaje: Lenguaje;
        nombre: string;
        fuerza: Fuerza;
    }[]): UsoMatcher[] {
        const lenguajesPresentes = new Set(ficheros.map((f) => f.lenguaje));
        const relevantes = declarados.filter((d) => lenguajesPresentes.has(d.lenguaje));
        if (!relevantes.length)
            return [];
        const clave = (l: Lenguaje, n: string) => `${l}::${n}`;
        const cuenta = new Map<string, number>();
        for (const f of ficheros) {
            for (const v of f.veredictos) {
                for (const a of v.evidencia.encontradas) {
                    const k = clave(f.lenguaje, a.nombre);
                    cuenta.set(k, (cuenta.get(k) ?? 0) + 1);
                }
            }
        }
        return relevantes
            .map((d) => ({ ...d, veces: cuenta.get(clave(d.lenguaje, d.nombre)) ?? 0 }))
            .sort((a, b) => a.veces - b.veces || a.nombre.localeCompare(b.nombre));
    }
}
