export const MS_DIA = 86400000;
export function diaDe(iso: string): number | null {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((iso ?? "").trim());
    if (!m)
        return null;
    const y = +m[1], mo = +m[2], d = +m[3];
    const t = Date.UTC(y, mo - 1, d);
    const f = new Date(t);
    if (f.getUTCFullYear() !== y || f.getUTCMonth() !== mo - 1 || f.getUTCDate() !== d)
        return null;
    return Math.round(t / MS_DIA);
}
export function isoDe(dia: number): string {
    return new Date(dia * MS_DIA).toISOString().slice(0, 10);
}
