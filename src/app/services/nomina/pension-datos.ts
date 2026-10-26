import { cotizacionPara } from "./cotizacion-historico";
const PTS = 166.386;
const ANTERIORES: {
    desde: string;
    base: number;
    norma: string;
    boe: string;
}[] = [
    { desde: "1997-01", base: 77730 / PTS, norma: "Orden de 27 de enero de 1997", boe: "BOE-A-1997-1701" },
    { desde: "1998-01", base: 79380 / PTS, norma: "Orden de 26 de enero de 1998", boe: "BOE-A-1998-1806" },
    { desde: "1999-01", base: 80820 / PTS, norma: "Orden de 15 de enero de 1999", boe: "BOE-A-1999-1132" },
    { desde: "2000-01", base: 82470 / PTS, norma: "Orden de 28 de enero de 2000", boe: "BOE-A-2000-1799" },
    { desde: "2001-01", base: 84150 / PTS, norma: "Orden de 29 de enero de 2001", boe: "BOE-A-2001-2156" },
    { desde: "2002-01", base: 516, norma: "Orden TAS/192/2002", boe: "BOE-A-2002-2195" },
    { desde: "2003-01", base: 526.5, norma: "Orden TAS/118/2003", boe: "BOE-A-2003-2099" },
    { desde: "2004-01", base: 537.3, norma: "Orden TAS/368/2004", boe: "BOE-A-2004-3062" },
    { desde: "2004-07", base: 572.7, norma: "RDL 3/2004, art. 5 (subida del SMI)", boe: "BOE-A-2004-12010" },
    { desde: "2005-01", base: 598.5, norma: "Orden TAS/77/2005", boe: "BOE-A-2005-1412" },
    { desde: "2006-01", base: 631.2, norma: "Orden TAS/29/2006", boe: "BOE-A-2006-842" },
    { desde: "2007-01", base: 665.7, norma: "Orden TAS/31/2007", boe: "BOE-A-2007-1113" },
    { desde: "2008-01", base: 699.9, norma: "Orden TAS/76/2008", boe: "BOE-A-2008-1466" },
    { desde: "2009-01", base: 728.1, norma: "Orden TIN/41/2009", boe: "BOE-A-2009-1169" },
    { desde: "2010-01", base: 738.9, norma: "Orden TIN/25/2010", boe: "BOE-A-2010-729" },
    { desde: "2011-01", base: 748.2, norma: "Orden TIN/41/2011", boe: "BOE-A-2011-1009" },
    { desde: "2012-01", base: 748.2, norma: "Orden ESS/184/2012", boe: "BOE-A-2012-1791" },
];
export function baseMinimaLagunas(mes: string): number | null {
    if (mes >= "2013-01") {
        const p = cotizacionPara(`${mes}-15`);
        return p ? Math.min(...p.basesMinimas) : null;
    }
    const fila = ANTERIORES.filter((f) => f.desde <= mes).at(-1);
    return fila ? Math.round(fila.base * 100) / 100 : null;
}
export function ultimaBaseMinima(): {
    mes: string;
    base: number;
} | null {
    for (let a = new Date().getFullYear() + 1; a >= 2013; a--) {
        const p = cotizacionPara(`${a}-12-15`);
        if (p)
            return { mes: p.hasta.slice(0, 7), base: Math.min(...p.basesMinimas) };
    }
    return null;
}
export const BRECHA_GENERO = { anyo: 2025, porcentaje: 26.18, fuente: "https://www.lamoncloa.gob.es/serviciosdeprensa/notasprensa/inclusion/paginas/2025/251125-paga-extraordinaria-pensionistas.aspx" } as const;
