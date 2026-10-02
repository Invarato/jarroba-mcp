export type Area = "ia" | "desarrollo" | "web" | "seguridad" | "datos" | "infra";
export type Estado = "vigente" | "superada" | "antipatron" | "innecesaria" | "depende";
export type Certeza = "medido" | "documentado" | "consenso" | "opinion";
export type Precision = "dia" | "mes" | "a\u00F1o" | "aprox";
export interface Texto {
    es: string;
    en: string;
}
export type Evidencia = {
    tipo: "web";
    url: string;
    titulo: string;
    fecha?: string;
    consultado: string;
    primaria?: boolean;
    cita: string;
} | {
    tipo: "medida";
    donde: string;
    commit?: string;
    fecha: string;
};
export interface Hito {
    fecha: string;
    precision: Precision;
    registrado: string;
    estado: Estado;
    certeza: Certeza;
    nota: Texto;
    evidencia?: number[];
    sinFuente?: boolean;
    tipo?: "hecho" | "anuncio" | "borrador";
    para?: string;
    matiz?: "endurece" | "suaviza";
}
export interface Practica {
    id: string;
    titulo: Texto;
    area: Area;
    temas: string[];
    estado: Estado;
    superadaPor?: string;
    porque: Texto;
    ambito?: {
        cuando: Texto;
        estado: Estado;
        porque?: Texto;
    }[];
    certeza: Certeza;
    evidencia: Evidencia[];
    historia: Hito[];
    revisado: string;
    caduca?: string;
    recomprobar?: string;
    enlaces?: {
        nombre: string;
        url: string;
    }[];
}
export interface Registro {
    practicas: Practica[];
}
export const AREAS: readonly Area[] = ["ia", "desarrollo", "web", "seguridad", "datos", "infra"];
export function caducada(p: Practica, hoy: string): boolean {
    return p.estado !== "superada" && !!p.caduca && p.caduca < hoy;
}
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
export function buscar(lista: readonly Practica[], consulta = "", area?: Area | null): Practica[] {
    const q = norm(consulta.trim());
    const palabras = q.split(/[\s,]+/).filter(Boolean);
    const puntua = (p: Practica) => {
        if (!palabras.length)
            return 1;
        const hay = norm([p.id, ...p.temas, p.titulo.es, p.titulo.en].join(" "));
        if (!palabras.every(w => hay.includes(w)))
            return 0;
        return (p.id === q || p.temas.includes(q) ? 10 : 0) + palabras.filter(w => p.temas.some(t => norm(t) === w)).length + 1;
    };
    return lista
        .filter(p => !area || p.area === area)
        .map(p => ({ p, s: puntua(p) }))
        .filter(x => x.s > 0)
        .sort((a, b) => b.s - a.s || a.p.titulo.es.localeCompare(b.p.titulo.es))
        .map(x => x.p);
}
export function posiblementeDespues(fecha: string, desde: string): boolean {
    const n = Math.min(fecha.length, desde.length);
    return fecha.slice(0, n) >= desde.slice(0, n) && !(fecha.length >= desde.length && fecha <= desde);
}
export function cambiosDesde(p: Practica, desde: string): Hito[] {
    return p.historia.filter(h => posiblementeDespues(h.fecha, desde));
}
export function estadoEn(p: Practica, fecha: string): Hito | null {
    let r: Hito | null = null;
    for (const h of p.historia)
        if ((!h.tipo || h.tipo === "hecho") && !posiblementeDespues(h.fecha, fecha))
            r = h;
    return r;
}
export interface RespuestaPractica {
    id: string;
    practice: string;
    area: Area;
    verdict: Estado;
    certainty: Certeza;
    why: string;
    cases?: {
        when: string;
        verdict: Estado;
        why?: string;
    }[];
    supersededBy?: string;
    lastReviewed: string;
    stale: boolean;
    changesSince?: {
        date: string;
        precision: Precision;
        verdict: Estado;
        note: string;
        sourced: boolean;
        announcement?: true;
        plannedFor?: string;
        draft?: true;
        shift?: "stronger" | "weaker";
    }[];
    sources: {
        url?: string;
        title?: string;
        quote?: string;
        measuredIn?: string;
        date?: string;
    }[];
}
export type RespuestaConsulta = {
    found: true;
    results: RespuestaPractica[];
} | {
    found: false;
    note: string;
};
export function consultar(reg: Registro, topic: string, since: string | undefined, hoy: string, max = 5): RespuestaConsulta {
    let lista = buscar(reg.practicas, topic);
    if (since)
        lista = lista.filter(p => cambiosDesde(p, since).length > 0);
    if (!lista.length) {
        return { found: false, note: since
                ? `No entry about "${topic}" changed after ${since}. That only means it is not in this register, not that nothing changed.`
                : `No entry about "${topic}". That means it has not been reviewed here, not that it is fine or wrong.` };
    }
    return { found: true, results: lista.slice(0, max).map(p => ({
            id: p.id,
            practice: p.titulo.en,
            area: p.area,
            verdict: p.estado,
            certainty: p.certeza,
            why: p.porque.en,
            ...(p.ambito?.length ? { cases: p.ambito.map(c => ({ when: c.cuando.en, verdict: c.estado, ...(c.porque ? { why: c.porque.en } : {}) })) } : {}),
            ...(p.superadaPor ? { supersededBy: p.superadaPor } : {}),
            lastReviewed: p.revisado,
            stale: caducada(p, hoy),
            ...(since ? { changesSince: cambiosDesde(p, since).map(h => ({ date: h.fecha, precision: h.precision, verdict: h.estado, note: h.nota.en, sourced: !h.sinFuente, ...(h.tipo === "anuncio" ? { announcement: true as const, ...(h.para ? { plannedFor: h.para } : {}) } : {}), ...(h.tipo === "borrador" ? { draft: true as const } : {}), ...(h.matiz ? { shift: h.matiz === "endurece" ? "stronger" as const : "weaker" as const } : {}) })) } : {}),
            sources: p.evidencia.map(e => e.tipo === "web"
                ? { url: e.url, title: e.titulo, quote: e.cita, date: e.fecha }
                : { measuredIn: e.donde, date: e.fecha }),
        })) };
}
