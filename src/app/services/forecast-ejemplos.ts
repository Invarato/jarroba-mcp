import { generador } from "./explicar-modelos";
export type IdEjemplo = "ventas" | "demanda" | "nivel" | "paseo";
export const IDS_EJEMPLO: readonly IdEjemplo[] = ["ventas", "demanda", "nivel", "paseo"];
export interface EjemploSerie {
    id: IdEjemplo;
    y: number[];
    m: number;
    inicio: string;
    paso: "mes" | "dia";
    festivos?: number[];
    festivosFuturo?(h: number): number[];
    verdad(h: number): number[];
    sigmaRuido: number;
    cambio?: number;
}
function ruido(semilla: number): () => number {
    const r = generador(semilla);
    return () => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());
}
const PERFIL_ANUAL = [0, -7.5, -12, -4.5, 6, 15, 21, 18, 7.5, -3, -9, -13.5];
export function sumarMeses(iso: string, k: number): string {
    const [a, m] = iso.split("-").map(Number);
    const t = a * 12 + (m - 1) + k;
    return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}-01`;
}
export function sumarDias(iso: string, k: number): string {
    const d = new Date(`${iso}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + k);
    return d.toISOString().slice(0, 10);
}
const FIJOS = ["01-01", "01-06", "05-01", "08-15", "10-12", "11-01", "12-06", "12-08", "12-25"];
const PERFIL_SEMANAL = [10, 14, 12, 20, 40, 60, -30];
const EFECTO_FESTIVO = 0.45;
function demandaBase(t: number): number { return 200 + 0.05 * t + PERFIL_SEMANAL[t % 7]; }
export function ejemplo(id: IdEjemplo): EjemploSerie {
    switch (id) {
        case "ventas": {
            const g = ruido(11);
            const f = (t: number) => 100 + 0.8 * t + PERFIL_ANUAL[t % 12];
            const y = Array.from({ length: 96 }, (_, t) => f(t) + 4 * g());
            return { id, y, m: 12, inicio: "2018-01-01", paso: "mes", sigmaRuido: 4, verdad: h => Array.from({ length: h }, (_, i) => f(96 + i)) };
        }
        case "demanda": {
            const g = ruido(23);
            const inicio = "2025-01-06";
            const n = 420;
            const festivos = Array.from({ length: n }, (_, t) => (FIJOS.includes(sumarDias(inicio, t).slice(5)) ? 1 : 0));
            const futuro = (t: number) => (FIJOS.includes(sumarDias(inicio, t).slice(5)) ? 1 : 0);
            const valor = (t: number, fest: number) => demandaBase(t) * (fest ? EFECTO_FESTIVO : 1);
            const y = Array.from({ length: n }, (_, t) => valor(t, festivos[t]) + 6 * g());
            return {
                id,
                y,
                m: 7,
                inicio,
                paso: "dia",
                festivos,
                sigmaRuido: 6,
                festivosFuturo: h => Array.from({ length: h }, (_, i) => futuro(n + i)),
                verdad: h => Array.from({ length: h }, (_, i) => valor(n + i, futuro(n + i))),
            };
        }
        case "nivel": {
            const g = ruido(37);
            const cambio = 70;
            const f = (t: number) => 100 + PERFIL_ANUAL[t % 12] * 0.6 + (t >= cambio ? 30 : 0);
            const y = Array.from({ length: 120 }, (_, t) => f(t) + 3 * g());
            return { id, y, m: 12, inicio: "2016-01-01", paso: "mes", sigmaRuido: 3, cambio, verdad: h => Array.from({ length: h }, (_, i) => f(120 + i)) };
        }
        case "paseo": {
            const g = ruido(41);
            const y: number[] = [];
            let v = 100;
            for (let t = 0; t < 200; t++) {
                v += 2 * g();
                y.push(v);
            }
            return { id, y, m: 1, inicio: "2024-01-01", paso: "dia", sigmaRuido: 2, verdad: h => Array.from({ length: h }, () => y[y.length - 1]) };
        }
    }
}
