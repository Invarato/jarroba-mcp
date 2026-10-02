import { Injectable } from "@angular/core";
export interface LecturaParams {
    celdasPorColumna: number;
    cPorCeldaFf: number;
    iCeldaUa: number;
    sensibilidadMv: number;
    offsetSigmaMv: number;
    sigmas: number;
    bancos: number;
}
export interface PuntoRampa {
    t: number;
    dv: number;
}
export interface Lectura {
    cBitlineFf: number;
    deltaVRequeridoMv: number;
    margenPorOffsetMv: number;
    tiempoNs: number;
    lecturasPorSegundo: number;
    rampa: PuntoRampa[];
    porBancos: {
        bancos: number;
        tiempoNs: number;
    }[];
}
const MUESTRAS = 80;
@Injectable({ providedIn: "root" })
export class SenseAmpService {
    calcular(p: LecturaParams): Lectura | null {
        if (!this.valido(p))
            return null;
        const bancos = Math.max(1, Math.floor(p.bancos));
        const celdasPorLinea = p.celdasPorColumna / bancos;
        const cBitlineFf = celdasPorLinea * p.cPorCeldaFf;
        const margenPorOffsetMv = p.sigmas * p.offsetSigmaMv;
        const deltaVRequeridoMv = p.sensibilidadMv + margenPorOffsetMv;
        const t = (c: number) => (c * deltaVRequeridoMv) / p.iCeldaUa / 1000;
        const tiempoNs = t(cBitlineFf);
        const tMax = tiempoNs * 1.35;
        const rampa = Array.from({ length: MUESTRAS }, (_, i) => {
            const ti = (tMax * i) / (MUESTRAS - 1);
            return { t: ti, dv: (p.iCeldaUa * ti * 1000) / cBitlineFf };
        });
        return {
            cBitlineFf,
            deltaVRequeridoMv,
            margenPorOffsetMv,
            tiempoNs,
            lecturasPorSegundo: tiempoNs > 0 ? 1000000000 / tiempoNs : Infinity,
            rampa,
            porBancos: [1, 2, 4, 8].map(b => ({
                bancos: b,
                tiempoNs: t((p.celdasPorColumna / b) * p.cPorCeldaFf),
            })),
        };
    }
    private valido(p: LecturaParams): boolean {
        const n = [p.celdasPorColumna, p.cPorCeldaFf, p.iCeldaUa, p.sensibilidadMv, p.offsetSigmaMv, p.sigmas, p.bancos];
        if (!n.every(Number.isFinite))
            return false;
        return p.celdasPorColumna >= 1 && p.celdasPorColumna <= 8192
            && p.cPorCeldaFf > 0 && p.iCeldaUa > 0
            && p.sensibilidadMv > 0 && p.offsetSigmaMv >= 0
            && p.sigmas >= 0 && p.sigmas <= 12
            && p.bancos >= 1 && p.bancos <= 64;
    }
}
