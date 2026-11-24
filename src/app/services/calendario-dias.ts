import { MS_DIA } from "../shared/dias";
export function diaSemana(dia: number): number {
    return new Date(dia * MS_DIA).getUTCDay();
}
export const diasDelMes = (y: number, m: number) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
export function sumarMeses(dia: number, meses: number): number {
    const d = new Date(dia * MS_DIA);
    const total = d.getUTCFullYear() * 12 + d.getUTCMonth() + meses;
    const y = Math.floor(total / 12), m = total - y * 12;
    const dd = Math.min(d.getUTCDate(), diasDelMes(y, m));
    return Math.round(Date.UTC(y, m, dd) / MS_DIA);
}
