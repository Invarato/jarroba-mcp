export interface TramoSolidaridad {
    desde: number;
    trabajador: number;
    empresa: number;
}
export interface ParametrosCotizacion {
    desde: string;
    hasta: string;
    norma: string;
    boe: string;
    basesMinimasDerivadas?: true;
    trabajador: {
        cc: number;
        desempleoIndefinido: number;
        desempleoTemporal: number;
        fp: number;
        mei: number;
        horasExtraFuerzaMayor: number;
        horasExtraResto: number;
    };
    baseMaxima: number;
    basesMinimas: [
        number,
        number,
        number,
        number,
        number,
        number,
        number
    ];
    baseMinimaDiaria: number;
    basesMinimasProvisionales?: [
        number,
        number,
        number,
        number,
        number,
        number,
        number
    ];
    solidaridad?: TramoSolidaridad[];
}
export const COTIZACION: ParametrosCotizacion[] = [
    { desde: "2013-01-01", hasta: "2013-12-31", norma: "Orden ESS/56/2013", boe: "BOE-A-2013-835", trabajador: { cc: 4.7, desempleoIndefinido: 1.55, desempleoTemporal: 1.6, fp: 0.1, mei: 0, horasExtraFuerzaMayor: 2, horasExtraResto: 4.7 }, baseMaxima: 3425.7, basesMinimas: [1051.5, 872.1, 758.7, 753, 753, 753, 753], baseMinimaDiaria: 25.1, },
    { desde: "2014-01-01", hasta: "2014-12-31", norma: "Orden ESS/106/2014", boe: "BOE-A-2014-1051", trabajador: { cc: 4.7, desempleoIndefinido: 1.55, desempleoTemporal: 1.6, fp: 0.1, mei: 0, horasExtraFuerzaMayor: 2, horasExtraResto: 4.7 }, baseMaxima: 3597, basesMinimas: [1051.5, 872.1, 758.7, 753, 753, 753, 753], baseMinimaDiaria: 25.1, },
    { desde: "2015-01-01", hasta: "2015-12-31", norma: "Orden ESS/86/2015", boe: "BOE-A-2015-847", trabajador: { cc: 4.7, desempleoIndefinido: 1.55, desempleoTemporal: 1.6, fp: 0.1, mei: 0, horasExtraFuerzaMayor: 2, horasExtraResto: 4.7 }, baseMaxima: 3606, basesMinimas: [1056.9, 876.6, 762.6, 756.6, 756.6, 756.6, 756.6], baseMinimaDiaria: 25.22, },
    { desde: "2016-01-01", hasta: "2016-12-31", norma: "Orden ESS/70/2016", boe: "BOE-A-2016-886", trabajador: { cc: 4.7, desempleoIndefinido: 1.55, desempleoTemporal: 1.6, fp: 0.1, mei: 0, horasExtraFuerzaMayor: 2, horasExtraResto: 4.7 }, baseMaxima: 3642, basesMinimas: [1067.4, 885.3, 770.1, 764.4, 764.4, 764.4, 764.4], baseMinimaDiaria: 25.48, },
    { desde: "2017-01-01", hasta: "2017-12-31", norma: "Orden ESS/106/2017", boe: "BOE-A-2017-1369", trabajador: { cc: 4.7, desempleoIndefinido: 1.55, desempleoTemporal: 1.6, fp: 0.1, mei: 0, horasExtraFuerzaMayor: 2, horasExtraResto: 4.7 }, baseMaxima: 3751.2, basesMinimas: [1152.9, 956.1, 831.6, 825.6, 825.6, 825.6, 825.6], baseMinimaDiaria: 27.52, },
    { desde: "2018-01-01", hasta: "2018-07-31", norma: "Orden ESS/55/2018", boe: "BOE-A-2018-1142", trabajador: { cc: 4.7, desempleoIndefinido: 1.55, desempleoTemporal: 1.6, fp: 0.1, mei: 0, horasExtraFuerzaMayor: 2, horasExtraResto: 4.7 }, baseMaxima: 3751.2, basesMinimas: [1199.1, 994.2, 864.9, 858.6, 858.6, 858.6, 858.6], baseMinimaDiaria: 28.62, },
    { desde: "2018-08-01", hasta: "2018-12-31", norma: "Ley 6/2018, art. 130", boe: "BOE-A-2018-9268", basesMinimasDerivadas: true, trabajador: { cc: 4.7, desempleoIndefinido: 1.55, desempleoTemporal: 1.6, fp: 0.1, mei: 0, horasExtraFuerzaMayor: 2, horasExtraResto: 4.7 }, baseMaxima: 3803.7, basesMinimas: [1199.1, 994.2, 864.9, 858.6, 858.6, 858.6, 858.6], baseMinimaDiaria: 28.62, },
    { desde: "2019-01-01", hasta: "2019-12-31", norma: "Orden TMS/83/2019", boe: "BOE-A-2019-1366", trabajador: { cc: 4.7, desempleoIndefinido: 1.55, desempleoTemporal: 1.6, fp: 0.1, mei: 0, horasExtraFuerzaMayor: 2, horasExtraResto: 4.7 }, baseMaxima: 4070.1, basesMinimas: [1466.4, 1215.9, 1057.8, 1050, 1050, 1050, 1050], baseMinimaDiaria: 35, },
    { desde: "2020-01-01", hasta: "2020-12-31", norma: "RDL 18/2019 (prorroga la Orden TMS/83/2019)", boe: "BOE-A-2019-18611", basesMinimasDerivadas: true, trabajador: { cc: 4.7, desempleoIndefinido: 1.55, desempleoTemporal: 1.6, fp: 0.1, mei: 0, horasExtraFuerzaMayor: 2, horasExtraResto: 4.7 }, baseMaxima: 4070.1, basesMinimas: [1466.4, 1215.9, 1108.33, 1108.33, 1108.33, 1108.33, 1108.33], baseMinimaDiaria: 36.94, },
    { desde: "2021-01-01", hasta: "2021-08-31", norma: "Ley 11/2020, art. 119", boe: "BOE-A-2020-17339", basesMinimasDerivadas: true, trabajador: { cc: 4.7, desempleoIndefinido: 1.55, desempleoTemporal: 1.6, fp: 0.1, mei: 0, horasExtraFuerzaMayor: 2, horasExtraResto: 4.7 }, baseMaxima: 4070.1, basesMinimas: [1466.4, 1215.9, 1108.33, 1108.33, 1108.33, 1108.33, 1108.33], baseMinimaDiaria: 36.94, },
    { desde: "2021-09-01", hasta: "2021-12-31", norma: "Orden PCM/1353/2021", boe: "BOE-A-2021-20075", trabajador: { cc: 4.7, desempleoIndefinido: 1.55, desempleoTemporal: 1.6, fp: 0.1, mei: 0, horasExtraFuerzaMayor: 2, horasExtraResto: 4.7 }, baseMaxima: 4070.1, basesMinimas: [1572.3, 1303.8, 1134.3, 1125.9, 1125.9, 1125.9, 1125.9], baseMinimaDiaria: 37.53, },
    { desde: "2022-01-01", hasta: "2022-12-31", norma: "Orden PCM/244/2022", boe: "BOE-A-2022-5063", trabajador: { cc: 4.7, desempleoIndefinido: 1.55, desempleoTemporal: 1.6, fp: 0.1, mei: 0, horasExtraFuerzaMayor: 2, horasExtraResto: 4.7 }, baseMaxima: 4139.4, basesMinimas: [1629.3, 1351.2, 1175.4, 1166.7, 1166.7, 1166.7, 1166.7], baseMinimaDiaria: 38.89, },
    { desde: "2023-01-01", hasta: "2023-12-31", norma: "Orden PCM/74/2023", boe: "BOE-A-2023-2472", trabajador: { cc: 4.7, desempleoIndefinido: 1.55, desempleoTemporal: 1.6, fp: 0.1, mei: 0.1, horasExtraFuerzaMayor: 2, horasExtraResto: 4.7 }, baseMaxima: 4495.5, basesMinimas: [1759.5, 1459.2, 1269.3, 1260, 1260, 1260, 1260], baseMinimaDiaria: 42, basesMinimasProvisionales: [1629.3, 1351.2, 1175.4, 1166.7, 1166.7, 1166.7, 1166.7], },
    { desde: "2024-01-01", hasta: "2024-12-31", norma: "Orden PJC/51/2024", boe: "BOE-A-2024-1691", trabajador: { cc: 4.7, desempleoIndefinido: 1.55, desempleoTemporal: 1.6, fp: 0.1, mei: 0.12, horasExtraFuerzaMayor: 2, horasExtraResto: 4.7 }, baseMaxima: 4720.5, basesMinimas: [1847.4, 1532.1, 1332.9, 1323, 1323, 1323, 1323], baseMinimaDiaria: 44.1, basesMinimasProvisionales: [1759.5, 1459.2, 1269.3, 1260, 1260, 1260, 1260], },
    { desde: "2025-01-01", hasta: "2025-12-31", norma: "Orden PJC/178/2025", boe: "BOE-A-2025-3780", trabajador: { cc: 4.7, desempleoIndefinido: 1.55, desempleoTemporal: 1.6, fp: 0.1, mei: 0.13, horasExtraFuerzaMayor: 2, horasExtraResto: 4.7 }, baseMaxima: 4909.5, basesMinimas: [1929, 1599.6, 1391.7, 1381.2, 1381.2, 1381.2, 1381.2], baseMinimaDiaria: 46.04, solidaridad: [{ desde: 4909.51, trabajador: 0.15, empresa: 0.77 }, { desde: 5400.46, trabajador: 0.17, empresa: 0.83 }, { desde: 7364.26, trabajador: 0.19, empresa: 0.98 }], },
    { desde: "2026-01-01", hasta: "2026-12-31", norma: "Orden PJC/297/2026", boe: "BOE-A-2026-7296", trabajador: { cc: 4.7, desempleoIndefinido: 1.55, desempleoTemporal: 1.6, fp: 0.1, mei: 0.15, horasExtraFuerzaMayor: 2, horasExtraResto: 4.7 }, baseMaxima: 5101.2, basesMinimas: [1989.3, 1649.7, 1435.2, 1424.4, 1424.4, 1424.4, 1424.4], baseMinimaDiaria: 47.48, solidaridad: [{ desde: 5101.21, trabajador: 0.19, empresa: 0.96 }, { desde: 5611.33, trabajador: 0.21, empresa: 1.04 }, { desde: 7651.81, trabajador: 0.24, empresa: 1.22 }], },
];
export function cotizacionPara(fecha: string): ParametrosCotizacion | null {
    return COTIZACION.find((p) => fecha >= p.desde && fecha <= p.hasta) ?? null;
}
const redondear = (x: number) => Math.round((x + Number.EPSILON) * 100) / 100;
export interface EntradaCuotas {
    baseCC: number;
    baseCP: number;
    temporal?: boolean;
    horasExtraFuerzaMayor?: number;
    horasExtraResto?: number;
    retribucion?: number;
}
export interface CuotasTrabajador {
    cc: number;
    mei: number;
    desempleo: number;
    fp: number;
    horasExtra: number;
    solidaridad: number;
    total: number;
}
export function cuotasTrabajador(e: EntradaCuotas, p: ParametrosCotizacion): CuotasTrabajador {
    const t = p.trabajador;
    const cc = redondear((e.baseCC * t.cc) / 100);
    const mei = redondear((e.baseCC * t.mei) / 100);
    const desempleo = redondear((e.baseCP * (e.temporal ? t.desempleoTemporal : t.desempleoIndefinido)) / 100);
    const fp = redondear((e.baseCP * t.fp) / 100);
    const horasExtra = redondear(((e.horasExtraFuerzaMayor ?? 0) * t.horasExtraFuerzaMayor + (e.horasExtraResto ?? 0) * t.horasExtraResto) / 100);
    const solidaridad = redondear(cuotaSolidaridad(e.retribucion ?? 0, p));
    return { cc, mei, desempleo, fp, horasExtra, solidaridad, total: redondear(cc + mei + desempleo + fp + horasExtra + solidaridad) };
}
export function cuotaSolidaridad(retribucion: number, p: ParametrosCotizacion, parte: "trabajador" | "empresa" = "trabajador"): number {
    const tramos = p.solidaridad ?? [];
    let cuota = 0;
    for (let i = 0; i < tramos.length; i++) {
        const desde = p.baseMaxima + (i === 0 ? 0 : tramos[i].desde - tramos[0].desde);
        const hasta = i + 1 < tramos.length ? p.baseMaxima + tramos[i + 1].desde - tramos[0].desde : Infinity;
        cuota += (Math.max(0, Math.min(retribucion, hasta) - desde) * tramos[i][parte]) / 100;
    }
    return cuota;
}
export const EMPRESA = { cc: 23.6, desempleoIndefinido: 5.5, desempleoTemporal: 6.7, fp: 0.6, fogasa: 0.2, atEpSupuesto: 1.5 } as const;
const MEI_EMPRESA: Record<number, number> = { 2023: 0.5, 2024: 0.58, 2025: 0.67, 2026: 0.75 };
export function meiEmpresa(fecha: string): number {
    return MEI_EMPRESA[+fecha.slice(0, 4)] ?? 0;
}
export function cuotasEmpresaEstimadas(e: {
    baseCC: number;
    baseCP: number;
    temporal?: boolean;
    retribucion?: number;
    fecha: string;
}, p: ParametrosCotizacion): number {
    const tipoCC = EMPRESA.cc + meiEmpresa(e.fecha);
    const tipoCP = (e.temporal ? EMPRESA.desempleoTemporal : EMPRESA.desempleoIndefinido) + EMPRESA.fp + EMPRESA.fogasa + EMPRESA.atEpSupuesto;
    const sol = cuotaSolidaridad(e.retribucion ?? 0, p, "empresa");
    return redondear((e.baseCC * tipoCC) / 100 + (e.baseCP * tipoCP) / 100 + sol);
}
