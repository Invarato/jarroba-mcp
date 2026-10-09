import { Indice, buscarEn, indexar, normaliza, palabras } from "../busqueda/busqueda";
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
    descripcion: Texto;
    herramienta?: string;
    fecha: string;
    donde?: string;
    commit?: string;
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
    aplica?: {
        producto: string;
        versiones?: string;
        github?: string;
    }[];
    consultas?: string[];
}
export interface Registro {
    practicas: Practica[];
}
export const AREAS: readonly Area[] = ["ia", "desarrollo", "web", "seguridad", "datos", "infra"];
export function caducada(p: Practica, hoy: string): boolean {
    return p.estado !== "superada" && !!p.caduca && p.caduca < hoy;
}
const campos = (p: Practica): [
    number,
    string
][] => [
    [4, [p.id.replace(/-/g, " "), ...p.temas.map(t => t.replace(/-/g, " "))].join(" ")],
    [3, `${p.titulo.es} ${p.titulo.en}`],
    [2, (p.consultas ?? []).join(" ")],
    [1, [p.porque.es, p.porque.en, ...(p.ambito ?? []).flatMap(c => [c.cuando.es, c.cuando.en])].join(" ")],
];
const indices = new WeakMap<readonly Practica[], Indice<Practica>>();
const indiceDe = (lista: readonly Practica[]) => {
    let ix = indices.get(lista);
    if (!ix) {
        ix = indexar(lista, campos);
        indices.set(lista, ix);
    }
    return ix;
};
export function buscar(lista: readonly Practica[], consulta = "", area?: Area | null, exige: "mitad" | "peso" | "una" = "mitad"): Practica[] {
    const q = normaliza(consulta.trim());
    const exacta = lista.find(p => p.id === q && (!area || p.area === area));
    if (exacta)
        return [exacta];
    if (!palabras(q).length)
        return lista.filter(p => !area || p.area === area).sort((a, b) => a.titulo.es.localeCompare(b.titulo.es));
    return buscarEn(indiceDe(lista), q, { exige })
        .filter(r => !area || r.item.area === area)
        .sort((a, b) => b.casan - a.casan || b.puntos - a.puntos || a.item.titulo.es.localeCompare(b.item.titulo.es))
        .map(r => r.item);
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
    url: string;
    cases?: {
        when: string;
        verdict: Estado;
        why?: string;
    }[];
    supersededBy?: string;
    lastReviewed: string;
    appliesTo?: {
        product: string;
        versions?: string;
    }[];
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
        measured?: string;
        tool?: string;
        date?: string;
    }[];
}
export type RespuestaConsulta = {
    found: true;
    results: RespuestaPractica[];
} | {
    found: false;
    note: string;
    nearest?: {
        id: string;
        practice: string;
    }[];
};
const CANDIDATAS = 20;
export function indice(reg: Registro, area: Area): {
    id: string;
    practice: string;
    verdict: Estado;
}[] {
    return reg.practicas.filter(p => p.area === area).sort((a, b) => a.id.localeCompare(b.id))
        .map(p => ({ id: p.id, practice: p.titulo.en, verdict: p.estado }));
}
export const enlacePractica = (id: string, idioma = "en") => `https://jarroba.com/tools/${idioma}/practices?q=${encodeURIComponent(id)}`;
export function consultar(reg: Registro, topic: string, since: string | undefined, hoy: string, max = 5): RespuestaConsulta {
    let lista = buscar(reg.practicas, topic, null, "peso");
    if (since)
        lista = lista.filter(p => cambiosDesde(p, since).length > 0);
    if (!lista.length) {
        if (since && buscar(reg.practicas, topic, null, "peso").length) {
            return { found: false, note: `No entry about "${topic}" changed after ${since}. That only means it is not in this register, not that nothing changed.` };
        }
        const cercanas = [...new Set([...buscar(reg.practicas, topic, null, "mitad"), ...buscar(reg.practicas, topic, null, "una")])];
        const nearest = cercanas.slice(0, CANDIDATAS).map(p => ({ id: p.id, practice: p.titulo.en }));
        return { found: false, note: `No entry matched "${topic}" well enough. That means it has not been reviewed here, not that it is fine or wrong.` +
                (nearest.length ? ` The closest entries are in "nearest": if one of them is your topic, call practice_check again with its id as the topic; if none is, say so instead of assuming.` : ""), ...(nearest.length ? { nearest } : {}) };
    }
    return { found: true, results: lista.slice(0, max).map(p => ({
            id: p.id,
            practice: p.titulo.en,
            url: enlacePractica(p.id),
            area: p.area,
            verdict: p.estado,
            certainty: p.certeza,
            why: p.porque.en,
            ...(p.ambito?.length ? { cases: p.ambito.map(c => ({ when: c.cuando.en, verdict: c.estado, ...(c.porque ? { why: c.porque.en } : {}) })) } : {}),
            ...(p.superadaPor ? { supersededBy: p.superadaPor } : {}),
            lastReviewed: p.revisado,
            stale: caducada(p, hoy),
            ...(p.aplica?.length ? { appliesTo: p.aplica.map(a => ({ product: a.producto, ...(a.versiones ? { versions: a.versiones } : {}) })) } : {}),
            ...(since ? { changesSince: cambiosDesde(p, since).map(h => ({ date: h.fecha, precision: h.precision, verdict: h.estado, note: h.nota.en, sourced: !h.sinFuente, ...(h.tipo === "anuncio" ? { announcement: true as const, ...(h.para ? { plannedFor: h.para } : {}) } : {}), ...(h.tipo === "borrador" ? { draft: true as const } : {}), ...(h.matiz ? { shift: h.matiz === "endurece" ? "stronger" as const : "weaker" as const } : {}) })) } : {}),
            sources: p.evidencia.map(e => e.tipo === "web"
                ? { url: e.url, title: e.titulo, quote: e.cita, date: e.fecha }
                : { measured: e.descripcion.en, ...(e.herramienta ? { tool: `https://jarroba.com/tools/en${e.herramienta}` } : {}), date: e.fecha }),
        })) };
}
