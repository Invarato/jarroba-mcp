export type NivelDora = "elite" | "high" | "medium" | "low";
export type BandaFrecuencia = "bajo-demanda" | "hora-dia" | "dia-semana" | "semana-mes" | "mes-6m" | "menos-6m";
export type BandaTiempo = "menos-1h" | "menos-1d" | "1d-1s" | "1s-1m" | "1m-6m" | "mas-6m";
export const BANDAS_FRECUENCIA: readonly BandaFrecuencia[] = ["bajo-demanda", "hora-dia", "dia-semana", "semana-mes", "mes-6m", "menos-6m"];
export const BANDAS_TIEMPO: readonly BandaTiempo[] = ["menos-1h", "menos-1d", "1d-1s", "1s-1m", "1m-6m", "mas-6m"];
const T_MENOS_1D: BandaTiempo[] = ["menos-1h", "menos-1d"];
export type CfrTabla = {
    rango: [
        number,
        number
    ];
} | {
    valor: number;
};
export interface NivelInforme {
    nivel: NivelDora;
    pct: number;
    pctIc?: [
        number,
        number
    ];
    frecuencia: BandaFrecuencia[];
    lead: BandaTiempo[];
    recuperacion: BandaTiempo[];
    cfr: CfrTabla;
}
export type AvisoInforme = "sin-elite" | "huecos" | "errata-low" | "cfr-valor" | "cfr-no-monotona" | "rework-sin-niveles" | "mttr-renombrado";
export interface InformeConNiveles {
    anyo: 2019 | 2021 | 2022 | 2023 | 2024;
    url: string;
    version?: string;
    pagina: number;
    niveles: NivelInforme[];
    avisos: AvisoInforme[];
}
const url = (a: number) => `https://dora.dev/research/${a}/dora-report/${a}-dora-accelerate-state-of-devops-report.pdf`;
export const INFORMES: readonly InformeConNiveles[] = [
    {
        anyo: 2019,
        url: url(2019),
        pagina: 18,
        avisos: [],
        niveles: [
            { nivel: "elite", pct: 20, frecuencia: ["bajo-demanda"], lead: T_MENOS_1D, recuperacion: ["menos-1h"], cfr: { rango: [0, 15] } },
            { nivel: "high", pct: 23, frecuencia: ["dia-semana"], lead: ["1d-1s"], recuperacion: T_MENOS_1D, cfr: { rango: [0, 15] } },
            { nivel: "medium", pct: 44, frecuencia: ["semana-mes"], lead: ["1s-1m"], recuperacion: T_MENOS_1D, cfr: { rango: [0, 15] } },
            { nivel: "low", pct: 12, frecuencia: ["mes-6m"], lead: ["1m-6m"], recuperacion: ["1s-1m"], cfr: { rango: [46, 60] } },
        ],
    },
    {
        anyo: 2021,
        url: url(2021),
        pagina: 9,
        avisos: ["huecos"],
        niveles: [
            { nivel: "elite", pct: 26, frecuencia: ["bajo-demanda"], lead: ["menos-1h"], recuperacion: ["menos-1h"], cfr: { rango: [0, 15] } },
            { nivel: "high", pct: 40, frecuencia: ["semana-mes"], lead: ["1d-1s"], recuperacion: T_MENOS_1D, cfr: { rango: [16, 30] } },
            { nivel: "medium", pct: 28, frecuencia: ["mes-6m"], lead: ["1m-6m"], recuperacion: ["1d-1s"], cfr: { rango: [16, 30] } },
            { nivel: "low", pct: 7, frecuencia: ["menos-6m"], lead: ["mas-6m"], recuperacion: ["mas-6m"], cfr: { rango: [16, 30] } },
        ],
    },
    {
        anyo: 2022,
        url: url(2022),
        pagina: 11,
        avisos: ["sin-elite"],
        niveles: [
            { nivel: "high", pct: 11, frecuencia: ["bajo-demanda"], lead: ["1d-1s"], recuperacion: T_MENOS_1D, cfr: { rango: [0, 15] } },
            { nivel: "medium", pct: 69, frecuencia: ["semana-mes"], lead: ["1s-1m"], recuperacion: ["1d-1s"], cfr: { rango: [16, 30] } },
            { nivel: "low", pct: 19, frecuencia: ["mes-6m"], lead: ["1m-6m"], recuperacion: ["1s-1m"], cfr: { rango: [46, 60] } },
        ],
    },
    {
        anyo: 2023,
        url: url(2023),
        version: "2023-12",
        pagina: 12,
        avisos: ["errata-low", "cfr-valor", "mttr-renombrado"],
        niveles: [
            { nivel: "elite", pct: 18, frecuencia: ["bajo-demanda"], lead: T_MENOS_1D, recuperacion: ["menos-1h"], cfr: { valor: 5 } },
            { nivel: "high", pct: 31, frecuencia: ["dia-semana"], lead: ["1d-1s"], recuperacion: T_MENOS_1D, cfr: { valor: 10 } },
            { nivel: "medium", pct: 33, frecuencia: ["semana-mes"], lead: ["1s-1m"], recuperacion: ["1d-1s"], cfr: { valor: 15 } },
            { nivel: "low", pct: 17, frecuencia: ["semana-mes"], lead: ["1s-1m"], recuperacion: ["1m-6m"], cfr: { valor: 64 } },
        ],
    },
    {
        anyo: 2024,
        url: url(2024),
        version: "2024.3",
        pagina: 13,
        avisos: ["cfr-valor", "cfr-no-monotona", "rework-sin-niveles"],
        niveles: [
            { nivel: "elite", pct: 19, pctIc: [18, 20], frecuencia: ["bajo-demanda"], lead: T_MENOS_1D, recuperacion: ["menos-1h"], cfr: { valor: 5 } },
            { nivel: "high", pct: 22, pctIc: [21, 23], frecuencia: ["dia-semana"], lead: ["1d-1s"], recuperacion: T_MENOS_1D, cfr: { valor: 20 } },
            { nivel: "medium", pct: 35, pctIc: [33, 36], frecuencia: ["semana-mes"], lead: ["1s-1m"], recuperacion: T_MENOS_1D, cfr: { valor: 10 } },
            { nivel: "low", pct: 25, pctIc: [23, 26], frecuencia: ["mes-6m"], lead: ["1m-6m"], recuperacion: ["1s-1m"], cfr: { valor: 40 } },
        ],
    },
];
export const BANDAS_PCT_2025: readonly [
    number,
    number
][] = [[0, 2], [2, 4], [4, 8], [8, 16], [16, 32], [32, 64], [64, 100]];
export const DISTRIBUCION_2025 = {
    url: "https://services.google.com/fh/files/misc/2025_state_of_ai_assisted_software_development.pdf",
    version: "2025.2",
    paginas: [20, 21],
    lead: [9.4, 15, 31.9, 28.3, 13.2, 2],
    frecuencia: [16.2, 6.5, 21.9, 31.5, 20.3, 3.6],
    recuperacion: [21.3, 35.3, 28, 9.4, 4.9, 1],
    cfr: [8.5, 8.1, 19.6, 26, 19.5, 12.5, 5.9],
    rework: [6.9, 5.8, 13.7, 26.1, 24.7, 15.4, 7.3],
    top: {
        lead: [9.4, 24.4, 56.4, 84.7, 98, 100],
        frecuencia: [16.2, 22.7, 44.6, 76.1, 96.4, 100],
        recuperacion: [21.3, 56.5, 84.5, 93.9, 98.8, 100],
        cfr: [8.5, 16.7, 36.2, 62.2, 81.6, 94.1, 100],
        rework: [6.9, 12.8, 26.5, 52.6, 77.3, 92.7, 100],
    },
} as const;
export const ARQUETIPOS_2025 = [
    { id: "foundational-challenges", pct: 10 },
    { id: "legacy-bottleneck", pct: 11 },
    { id: "constrained-by-process", pct: 17 },
    { id: "high-impact-low-cadence", pct: 7 },
    { id: "stable-and-methodical", pct: 15 },
    { id: "pragmatic-performers", pct: 20 },
    { id: "harmonious-high-achiever", pct: 20 },
] as const;
