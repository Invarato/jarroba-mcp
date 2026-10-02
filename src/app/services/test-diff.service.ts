import { Injectable } from "@angular/core";
import type { Asercion, CasoPrueba, Fuerza, SuiteAnalizada } from "./test-audit.model";
import { ESCALA_FUERZA, nivelDeFuerza } from "./test-audit.model";
export const TIPOS_CAMBIO = [
    "desactivado",
    "eliminado",
    "debilitado",
    "aserciones-perdidas",
    "reactivado",
    "reforzado",
    "nuevo",
    "sin-cambio",
] as const;
export type TipoCambio = (typeof TIPOS_CAMBIO)[number];
export interface Ablandada {
    antes: Asercion;
    despues: Asercion;
}
export interface Cambio {
    tipo: TipoCambio;
    nombre: string;
    antes: CasoPrueba | null;
    despues: CasoPrueba | null;
    detalle: string;
    ablandadas: Ablandada[];
    gravedad: number;
}
export interface ResumenDiff {
    cambios: Cambio[];
    regresiones: number;
    mejoras: number;
    hayRegresion: boolean;
    veredicto: string;
}
const REGRESIONES = new Set<TipoCambio>(["desactivado", "eliminado", "debilitado", "aserciones-perdidas"]);
const MEJORAS = new Set<TipoCambio>(["reforzado", "reactivado", "nuevo"]);
@Injectable({ providedIn: "root" })
export class TestDiffService {
    comparar(antes: SuiteAnalizada, despues: SuiteAnalizada): ResumenDiff {
        const porNombreAntes = new Map(antes.casos.map((c) => [c.nombre, c]));
        const porNombreDespues = new Map(despues.casos.map((c) => [c.nombre, c]));
        const cambios: Cambio[] = [];
        for (const [nombre, a] of porNombreAntes) {
            const d = porNombreDespues.get(nombre);
            cambios.push(d ? this.compararCaso(a, d) : this.eliminado(a));
        }
        for (const [nombre, d] of porNombreDespues) {
            if (!porNombreAntes.has(nombre))
                cambios.push(this.nuevo(d));
        }
        cambios.sort((x, y) => x.gravedad - y.gravedad || x.nombre.localeCompare(y.nombre));
        const regresiones = cambios.filter((c) => REGRESIONES.has(c.tipo)).length;
        const mejoras = cambios.filter((c) => MEJORAS.has(c.tipo)).length;
        return {
            cambios,
            regresiones,
            mejoras,
            hayRegresion: regresiones > 0,
            veredicto: this.veredicto(regresiones, mejoras, cambios.length),
        };
    }
    private compararCaso(antes: CasoPrueba, despues: CasoPrueba): Cambio {
        if (!antes.inactivo && despues.inactivo) {
            return this.cambio("desactivado", antes, despues, [], `Estaba activo y ahora no se ejecuta (${despues.marcadorInactivo ?? despues.inactivo}). `
                + (antes.aserciones.length
                    ? `Con él se van ${antes.aserciones.length} aserción(es).`
                    : "No afirmaba nada, as\u00ED que quiz\u00E1 sobre del todo."));
        }
        if (antes.inactivo && !despues.inactivo) {
            return this.cambio("reactivado", antes, despues, [], "Vuelve a ejecutarse.");
        }
        if (antes.inactivo && despues.inactivo) {
            return this.cambio("sin-cambio", antes, despues, [], "Sigue desactivado.");
        }
        const nAntes = this.techo(antes);
        const nDespues = this.techo(despues);
        const ablandadas = this.ablandadas(antes, despues);
        if (nDespues < nAntes) {
            return this.cambio("debilitado", antes, despues, ablandadas, `La aserción más fuerte pasa de ${etiqueta(nAntes)} a ${etiqueta(nDespues)}. `
                + (ablandadas.length
                    ? `Se ablandó ${ablandadas.map((x) => `\`${x.antes.nombre}\` → \`${x.despues.nombre}\``).join(", ")}.`
                    : "Sigue verde, pero comprueba menos que antes."));
        }
        if (despues.aserciones.length < antes.aserciones.length) {
            return this.cambio("aserciones-perdidas", antes, despues, ablandadas, `Pierde ${antes.aserciones.length - despues.aserciones.length} aserción(es) `
                + `(de ${antes.aserciones.length} a ${despues.aserciones.length}), aunque la más fuerte aguanta.`);
        }
        if (nDespues > nAntes) {
            return this.cambio("reforzado", antes, despues, [], `La aserción más fuerte sube de ${etiqueta(nAntes)} a ${etiqueta(nDespues)}.`);
        }
        if (despues.aserciones.length > antes.aserciones.length) {
            return this.cambio("reforzado", antes, despues, [], `Añade ${despues.aserciones.length - antes.aserciones.length} aserción(es).`);
        }
        if (ablandadas.length) {
            return this.cambio("debilitado", antes, despues, ablandadas, `El techo aguanta, pero se ablandó ${ablandadas.map((x) => `\`${x.antes.nombre}\` → \`${x.despues.nombre}\``).join(", ")}.`);
        }
        return this.cambio("sin-cambio", antes, despues, [], "Sin cambios en lo que comprueba.");
    }
    private ablandadas(antes: CasoPrueba, despues: CasoPrueba): Ablandada[] {
        const out: Ablandada[] = [];
        const n = Math.min(antes.aserciones.length, despues.aserciones.length);
        for (let i = 0; i < n; i++) {
            const a = antes.aserciones[i];
            const d = despues.aserciones[i];
            if (nivelDeFuerza(d.fuerza) < nivelDeFuerza(a.fuerza))
                out.push({ antes: a, despues: d });
        }
        return out;
    }
    private techo(c: CasoPrueba): number {
        return c.aserciones.length ? Math.max(...c.aserciones.map((a) => nivelDeFuerza(a.fuerza))) : -1;
    }
    private eliminado(antes: CasoPrueba): Cambio {
        return this.cambio("eliminado", antes, null, [], antes.aserciones.length
            ? `El caso ya no está. Con él se van ${antes.aserciones.length} aserción(es).`
            : "El caso ya no est\u00E1. No afirmaba nada.");
    }
    private nuevo(despues: CasoPrueba): Cambio {
        return this.cambio("nuevo", null, despues, [], despues.aserciones.length
            ? `Caso nuevo con ${despues.aserciones.length} aserción(es).`
            : "Caso nuevo, pero no afirma nada: nace sin poder fallar.");
    }
    private cambio(tipo: TipoCambio, antes: CasoPrueba | null, despues: CasoPrueba | null, ablandadas: Ablandada[], detalle: string): Cambio {
        return {
            tipo,
            nombre: (antes ?? despues)!.nombre,
            antes,
            despues,
            detalle,
            ablandadas,
            gravedad: TIPOS_CAMBIO.indexOf(tipo),
        };
    }
    private veredicto(regresiones: number, mejoras: number, total: number): string {
        if (!total)
            return "No hay casos que comparar.";
        if (!regresiones && !mejoras)
            return "El cambio no toca lo que la suite comprueba.";
        if (!regresiones)
            return `La suite sale reforzada: ${mejoras} mejora(s) y ninguna pérdida.`;
        if (!mejoras)
            return `La suite sale MÁS DÉBIL: ${regresiones} pérdida(s) y ninguna mejora.`;
        return `${regresiones} pérdida(s) frente a ${mejoras} mejora(s). Mira las pérdidas antes de dar el cambio por bueno.`;
    }
}
function etiqueta(nivel: number): string {
    return nivel < 0 ? "nada" : (ESCALA_FUERZA[nivel] as Fuerza);
}
