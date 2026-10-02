import { BANDAS_FRECUENCIA, BANDAS_PCT_2025, BANDAS_TIEMPO, BandaFrecuencia, BandaTiempo, DISTRIBUCION_2025, INFORMES, InformeConNiveles, NivelDora, } from "./dora-informes";
export interface MetricasDora {
    desplieguesDia?: number;
    leadHoras?: number;
    recuperacionHoras?: number;
    cfr?: number;
    rework?: number;
}
type Metrica4 = "frecuencia" | "lead" | "recuperacion" | "cfr";
export type ResultadoMetrica = {
    tipo: "nivel";
    nivel: NivelDora;
    aproximado?: boolean;
} | {
    tipo: "ambiguo";
    niveles: NivelDora[];
    aproximado?: boolean;
} | {
    tipo: "entre-bandas";
} | {
    tipo: "sin-dato";
};
export interface ClasificacionAnyo {
    anyo: InformeConNiveles["anyo"];
    porMetrica: Record<Metrica4, ResultadoMetrica>;
    global: {
        niveles: NivelDora[];
        coinciden: number;
        de: number;
    } | null;
}
const H_DIA = 24, H_SEMANA = 168, H_MES = 730, H_6MESES = 4380;
export function bandaTiempo(h: number): BandaTiempo | null {
    if (!(h >= 0) || !Number.isFinite(h))
        return null;
    return h < 1 ? "menos-1h" : h < H_DIA ? "menos-1d" : h <= H_SEMANA ? "1d-1s" : h <= H_MES ? "1s-1m" : h <= H_6MESES ? "1m-6m" : "mas-6m";
}
export function bandaFrecuencia(porDia: number): BandaFrecuencia | null {
    if (!(porDia >= 0) || !Number.isFinite(porDia))
        return null;
    return porDia > 1 ? "bajo-demanda" : porDia >= 1 / 7 ? "dia-semana" : porDia >= 1 / 30 ? "semana-mes"
        : porDia >= 1 / 182.5 ? "mes-6m" : "menos-6m";
}
function masEspecificos(cands: {
    nivel: NivelDora;
    tam: number;
}[]): ResultadoMetrica {
    if (!cands.length)
        return { tipo: "entre-bandas" };
    const min = Math.min(...cands.map((c) => c.tam));
    const niveles = cands.filter((c) => c.tam === min).map((c) => c.nivel);
    return niveles.length === 1 ? { tipo: "nivel", nivel: niveles[0] } : { tipo: "ambiguo", niveles };
}
function porBandas<B>(inf: InformeConNiveles, campo: "frecuencia" | "lead" | "recuperacion", banda: B | null): ResultadoMetrica {
    if (banda === null)
        return { tipo: "sin-dato" };
    return masEspecificos(inf.niveles
        .filter((n) => (n[campo] as unknown as B[]).includes(banda))
        .map((n) => ({ nivel: n.nivel, tam: n[campo].length })));
}
function porCfr(inf: InformeConNiveles, cfr: number | undefined): ResultadoMetrica {
    if (cfr === undefined || !(cfr >= 0 && cfr <= 100))
        return { tipo: "sin-dato" };
    const conRango = inf.niveles.filter((n) => "rango" in n.cfr);
    if (conRango.length === inf.niveles.length) {
        const r = Math.round(cfr);
        return masEspecificos(conRango
            .filter((n) => { const [lo, hi] = (n.cfr as {
            rango: [
                number,
                number
            ];
        }).rango; return r >= lo && r <= hi; })
            .map((n) => ({ nivel: n.nivel, tam: 1 })));
    }
    const dist = inf.niveles.map((n) => ({ nivel: n.nivel, d: Math.abs(cfr - (n.cfr as {
            valor: number;
        }).valor) }));
    const min = Math.min(...dist.map((x) => x.d));
    const niveles = dist.filter((x) => Math.abs(x.d - min) < 1e-9).map((x) => x.nivel);
    return niveles.length === 1 ? { tipo: "nivel", nivel: niveles[0], aproximado: true } : { tipo: "ambiguo", niveles, aproximado: true };
}
export function clasificarAnyo(inf: InformeConNiveles, m: MetricasDora): ClasificacionAnyo {
    const porMetrica: Record<Metrica4, ResultadoMetrica> = {
        frecuencia: porBandas(inf, "frecuencia", m.desplieguesDia === undefined ? null : bandaFrecuencia(m.desplieguesDia)),
        lead: porBandas(inf, "lead", m.leadHoras === undefined ? null : bandaTiempo(m.leadHoras)),
        recuperacion: porBandas(inf, "recuperacion", m.recuperacionHoras === undefined ? null : bandaTiempo(m.recuperacionHoras)),
        cfr: porCfr(inf, m.cfr),
    };
    const conDato = Object.values(porMetrica).filter((r) => r.tipo !== "sin-dato");
    if (!conDato.length)
        return { anyo: inf.anyo, porMetrica, global: null };
    const puntos = new Map<NivelDora, number>(inf.niveles.map((n) => [n.nivel, 0]));
    for (const r of conDato) {
        const ns = r.tipo === "nivel" ? [r.nivel] : r.tipo === "ambiguo" ? r.niveles : [];
        for (const n of ns)
            puntos.set(n, (puntos.get(n) ?? 0) + 1);
    }
    const max = Math.max(...puntos.values());
    return {
        anyo: inf.anyo,
        porMetrica,
        global: max === 0 ? { niveles: [], coinciden: 0, de: conDato.length }
            : { niveles: [...puntos].filter(([, p]) => p === max).map(([n]) => n), coinciden: max, de: conDato.length },
    };
}
export function clasificarHistorico(m: MetricasDora): ClasificacionAnyo[] {
    return INFORMES.map((inf) => clasificarAnyo(inf, m));
}
export function nivelUnico(r: ResultadoMetrica): NivelDora | null {
    const orden: NivelDora[] = ["elite", "high", "medium", "low"];
    if (r.tipo === "nivel")
        return r.nivel;
    if (r.tipo === "ambiguo")
        return orden.find((n) => r.niveles.includes(n)) ?? null;
    return null;
}
export interface Percentil2025 {
    top: [
        number,
        number
    ];
    bandas: number[];
}
export function percentil2025(m: MetricasDora): Partial<Record<"frecuencia" | "lead" | "recuperacion" | "cfr" | "rework", Percentil2025>> {
    const out: Partial<Record<"frecuencia" | "lead" | "recuperacion" | "cfr" | "rework", Percentil2025>> = {};
    const d = DISTRIBUCION_2025;
    const dePct = (v: number) => { const i = BANDAS_PCT_2025.findIndex(([lo, hi], k) => v >= lo && (v < hi || k === BANDAS_PCT_2025.length - 1)); return i; };
    const poner = (k: keyof typeof out, bandas: number[]) => {
        const ac = d.top[k];
        out[k] = { bandas, top: [ac[Math.min(...bandas)], ac[Math.max(...bandas)]] };
    };
    if (m.desplieguesDia !== undefined && m.desplieguesDia >= 0) {
        const b = bandaFrecuencia(m.desplieguesDia)!;
        const i = BANDAS_FRECUENCIA.indexOf(b);
        poner("frecuencia", b === "bajo-demanda" ? [0, 1] : [i]);
    }
    if (m.leadHoras !== undefined && bandaTiempo(m.leadHoras))
        poner("lead", [BANDAS_TIEMPO.indexOf(bandaTiempo(m.leadHoras)!)]);
    if (m.recuperacionHoras !== undefined && bandaTiempo(m.recuperacionHoras))
        poner("recuperacion", [BANDAS_TIEMPO.indexOf(bandaTiempo(m.recuperacionHoras)!)]);
    if (m.cfr !== undefined && m.cfr >= 0 && m.cfr <= 100)
        poner("cfr", [dePct(m.cfr)]);
    if (m.rework !== undefined && m.rework >= 0 && m.rework <= 100)
        poner("rework", [dePct(m.rework)]);
    return out;
}
