export type Lenguaje = "typescript" | "javascript" | "python" | "java" | "go";
export type Fuerza = "exacta" | "parcial" | "umbral" | "debil" | "llamada";
export const ESCALA_FUERZA: readonly Fuerza[] = ["llamada", "debil", "umbral", "parcial", "exacta"] as const;
export function nivelDeFuerza(f: Fuerza): number {
    return ESCALA_FUERZA.indexOf(f);
}
export function esFuerte(f: Fuerza): boolean {
    return f === "exacta" || f === "parcial" || f === "umbral";
}
export interface Asercion {
    nombre: string;
    fuerza: Fuerza;
    linea: number;
    texto: string;
    condicional?: boolean;
}
export type MotivoInactivo = "skip" | "ignorado" | "pendiente" | "comentado";
export interface CasoPrueba {
    nombre: string;
    lenguaje: Lenguaje;
    linea: number;
    inactivo: MotivoInactivo | null;
    marcadorInactivo?: string;
    aserciones: Asercion[];
    llamadas: string[];
    noResueltas: string[];
}
export interface SuiteAnalizada {
    lenguaje: Lenguaje;
    dialecto: string | null;
    casos: CasoPrueba[];
    erroresParseo: number;
}
export type Clase = "afirma" | "solo-debil" | "solo-llamada" | "sin-asercion" | "indeterminado" | "inactivo";
export interface Veredicto {
    caso: CasoPrueba;
    clase: Clase;
    evidencia: {
        encontradas: Asercion[];
        noReconocidas: string[];
    };
    porque: string;
}
