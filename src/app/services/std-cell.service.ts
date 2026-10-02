import { Injectable } from "@angular/core";
export interface CeldaParams {
    tracks: number;
    pitchNm: number;
    railTracks: number;
    cppNm: number;
    anchoCpp: number;
    finPitchNm: number;
    rSheetOhmSq: number;
}
export type AvisoCelda = "sin-carriles-de-ruteo" | "altura-no-multiplo" | "ra\u00EDl-se-come-la-celda" | "sin-sitio-para-aletas";
export interface CeldaResultado {
    alturaNm: number;
    anchoNm: number;
    areaNm2: number;
    tracksRuteo: number;
    anchoRailNm: number;
    finsPorTransistor: number;
    celdasPorMm2: number;
    resistenciaRailOhm: number;
    avisos: AvisoCelda[];
}
export const TRACKS_MIN = 4, TRACKS_MAX = 16;
@Injectable({ providedIn: "root" })
export class StdCellService {
    calcular(p: CeldaParams): CeldaResultado | null {
        if (!this.valido(p))
            return null;
        const alturaNm = p.tracks * p.pitchNm;
        const anchoNm = p.anchoCpp * p.cppNm;
        const tracksRuteo = p.tracks - p.railTracks;
        const anchoRailNm = (p.railTracks * p.pitchNm) / 2;
        const utilNm = alturaNm - p.railTracks * p.pitchNm;
        const finsPorTransistor = Math.max(0, Math.floor((utilNm / 2) / p.finPitchNm));
        const resistenciaRailOhm = anchoRailNm > 0 ? p.rSheetOhmSq * (anchoNm / anchoRailNm) : Infinity;
        const avisos: AvisoCelda[] = [];
        if (tracksRuteo <= 0)
            avisos.push("sin-carriles-de-ruteo");
        if (p.railTracks >= p.tracks)
            avisos.push("ra\u00EDl-se-come-la-celda");
        if (finsPorTransistor < 1)
            avisos.push("sin-sitio-para-aletas");
        if (!Number.isInteger(p.tracks) && !Number.isInteger(p.tracks * 2))
            avisos.push("altura-no-multiplo");
        const areaNm2 = alturaNm * anchoNm;
        return {
            alturaNm,
            anchoNm,
            areaNm2,
            tracksRuteo,
            anchoRailNm,
            finsPorTransistor,
            celdasPorMm2: areaNm2 > 0 ? 1000000000000 / areaNm2 : 0,
            resistenciaRailOhm,
            avisos,
        };
    }
    comparar(a: CeldaParams, b: CeldaParams): {
        area: number;
        fins: number;
        rail: number;
    } | null {
        const ra = this.calcular(a), rb = this.calcular(b);
        if (!ra || !rb)
            return null;
        return {
            area: ra.areaNm2 > 0 ? (1 - rb.areaNm2 / ra.areaNm2) * 100 : 0,
            fins: rb.finsPorTransistor - ra.finsPorTransistor,
            rail: ra.resistenciaRailOhm > 0 && Number.isFinite(ra.resistenciaRailOhm)
                ? (rb.resistenciaRailOhm / ra.resistenciaRailOhm - 1) * 100 : 0,
        };
    }
    private valido(p: CeldaParams): boolean {
        const nums = [p.tracks, p.pitchNm, p.railTracks, p.cppNm, p.anchoCpp, p.finPitchNm, p.rSheetOhmSq];
        if (!nums.every(Number.isFinite))
            return false;
        return p.tracks >= TRACKS_MIN && p.tracks <= TRACKS_MAX
            && p.pitchNm > 0 && p.railTracks >= 0 && p.railTracks <= p.tracks
            && p.cppNm > 0 && p.anchoCpp >= 1 && p.finPitchNm > 0 && p.rSheetOhmSq > 0;
    }
}
