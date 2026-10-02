export interface Despliegue {
    fecha: Date;
    sha?: string;
    titulo?: string;
    id?: string;
}
export interface Commit {
    sha: string;
    fecha: Date;
    titulo: string;
}
export interface Incidente {
    inicio: Date;
    fin?: Date;
}
export interface Reglas {
    arreglo: RegExp;
    minutosDuplicado: number;
    horasVentanaArreglo: number;
}
export const REGLAS_POR_DEFECTO: Reglas = {
    arreglo: /\b(revert|rollback|roll back|hotfix|hot-fix|urgent|urgente|parche)\b/i,
    minutosDuplicado: 60,
    horasVentanaArreglo: 72,
};
export type MotivoFallo = "arreglo-siguiente" | "incidente" | "vuelve-a-sha";
export interface DespliegueAnalizado extends Despliegue {
    esArreglo: boolean;
    fallido: MotivoFallo | null;
    recuperacionHoras: number | null;
    leads: number[];
}
export interface ResultadoDatos {
    despliegues: DespliegueAnalizado[];
    duplicados: number;
    dias: number;
    desplieguesDia: number;
    diasConDespliegueSemana: number;
    leadHoras: number | null;
    recuperacionHoras: number | null;
    cfr: number;
    rework: number;
    commitsSinAtribuir: number;
}
export const mediana = (v: number[]): number | null => {
    if (!v.length)
        return null;
    const s = [...v].sort((a, b) => a - b), n = s.length;
    return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
};
const H = 3600000;
export function analizarDespliegues(desp: Despliegue[], commits: Commit[] = [], incidentes: Incidente[] = [], reglas: Reglas = REGLAS_POR_DEFECTO): ResultadoDatos | null {
    const ord = desp.filter((d) => !isNaN(d.fecha.getTime())).sort((a, b) => a.fecha.getTime() - b.fecha.getTime());
    const unicos: Despliegue[] = [];
    let duplicados = 0;
    for (const d of ord) {
        const previo = [...unicos].reverse().find((u) => u.sha && u.sha === d.sha);
        if (previo && d.fecha.getTime() - previo.fecha.getTime() < reglas.minutosDuplicado * 60000) {
            duplicados++;
            continue;
        }
        unicos.push(d);
    }
    if (unicos.length < 2)
        return null;
    const log = [...commits].sort((a, b) => a.fecha.getTime() - b.fecha.getTime());
    const pos = new Map(log.map((c, i) => [c.sha, i]));
    const posDe = (sha?: string) => {
        if (!sha)
            return undefined;
        const exacto = pos.get(sha);
        if (exacto !== undefined)
            return exacto;
        if (sha.length >= 7)
            for (const [s, i] of pos)
                if (s.startsWith(sha))
                    return i;
        return undefined;
    };
    let hasta = -1;
    let atribuidos = 0;
    const analizados: DespliegueAnalizado[] = unicos.map((d) => {
        const p = posDe(d.sha);
        const leads: number[] = [];
        if (p !== undefined && p > hasta) {
            for (let i = hasta + 1; i <= p; i++) {
                const l = (d.fecha.getTime() - log[i].fecha.getTime()) / H;
                if (l >= 0)
                    leads.push(l);
            }
            atribuidos += p - hasta;
            hasta = p;
        }
        const titulo = d.titulo ?? (p !== undefined ? log[p].titulo : undefined);
        return { ...d, titulo, esArreglo: !!titulo && reglas.arreglo.test(titulo), fallido: null, recuperacionHoras: null, leads };
    });
    const idxSha = new Map<string, number>();
    analizados.forEach((d, i) => { if (d.sha && !idxSha.has(d.sha))
        idxSha.set(d.sha, i); });
    for (let i = 0; i < analizados.length; i++) {
        const d = analizados[i], sig = analizados[i + 1];
        const t = d.fecha.getTime();
        if (sig && sig.esArreglo && sig.fecha.getTime() - t <= reglas.horasVentanaArreglo * H) {
            d.fallido = "arreglo-siguiente";
            d.recuperacionHoras = (sig.fecha.getTime() - t) / H;
            continue;
        }
        const inc = incidentes.find((x) => x.inicio.getTime() >= t && (!sig || x.inicio.getTime() < sig.fecha.getTime()));
        if (inc) {
            d.fallido = "incidente";
            d.recuperacionHoras = inc.fin ? (inc.fin.getTime() - t) / H : null;
            continue;
        }
        if (sig?.sha && d.sha && sig.sha !== d.sha && idxSha.has(sig.sha) && idxSha.get(sig.sha)! < i) {
            d.fallido = "vuelve-a-sha";
            d.recuperacionHoras = (sig.fecha.getTime() - t) / H;
        }
    }
    const primero = analizados[0].fecha.getTime(), ultimo = analizados[analizados.length - 1].fecha.getTime();
    const dias = Math.max(1, (ultimo - primero) / (24 * H));
    const semanas = new Map<number, Set<string>>();
    for (const d of analizados) {
        const s = Math.floor((d.fecha.getTime() - primero) / (7 * 24 * H));
        const dia = d.fecha.toISOString().slice(0, 10);
        if (!semanas.has(s))
            semanas.set(s, new Set());
        semanas.get(s)!.add(dia);
    }
    const nSemanas = Math.max(1, Math.ceil(dias / 7));
    const porSemana = Array.from({ length: nSemanas }, (_, s) => semanas.get(s)?.size ?? 0);
    const fallidos = analizados.filter((d) => d.fallido);
    return {
        despliegues: analizados,
        duplicados,
        dias,
        desplieguesDia: analizados.length / dias,
        diasConDespliegueSemana: mediana(porSemana) ?? 0,
        leadHoras: mediana(analizados.flatMap((d) => d.leads)),
        recuperacionHoras: mediana(fallidos.map((d) => d.recuperacionHoras).filter((x): x is number => x !== null)),
        cfr: (100 * fallidos.length) / analizados.length,
        rework: (100 * analizados.filter((d) => d.esArreglo).length) / analizados.length,
        commitsSinAtribuir: commits.length ? commits.length - atribuidos : 0,
    };
}
export interface LecturaDespliegues {
    despliegues: Despliegue[];
    descartadas: number;
    workflows: string[];
    formato: "gh-run-list" | "gh-deployments" | "csv";
}
export function leerGhRuns(texto: string, workflow?: string): LecturaDespliegues | null {
    let datos: unknown;
    try {
        datos = JSON.parse(texto);
    }
    catch {
        return null;
    }
    const runs = Array.isArray(datos) ? datos : (datos as {
        workflow_runs?: unknown[];
    })?.workflow_runs;
    if (!Array.isArray(runs) || !runs.length)
        return null;
    type Run = Record<string, unknown>;
    const s = (r: Run, ...k: string[]) => { for (const x of k)
        if (typeof r[x] === "string")
            return r[x] as string; return undefined; };
    const workflows = [...new Set(runs.map((r) => s(r as Run, "workflowName", "name") ?? "").filter(Boolean))].sort();
    const elegidos = workflow ? runs.filter((r) => s(r as Run, "workflowName", "name") === workflow) : runs;
    const ok = elegidos.filter((r) => s(r as Run, "conclusion") === "success");
    const despliegues = ok.map((r) => ({
        fecha: new Date(s(r as Run, "updatedAt", "updated_at", "createdAt", "created_at") ?? ""),
        sha: s(r as Run, "headSha", "head_sha"),
        titulo: s(r as Run, "displayTitle", "display_title"),
        id: String((r as Run)["databaseId"] ?? (r as Run)["id"] ?? ""),
    })).filter((d) => !isNaN(d.fecha.getTime()));
    if (!despliegues.length && !elegidos.length)
        return null;
    return { despliegues, descartadas: elegidos.length - ok.length, workflows, formato: "gh-run-list" };
}
export function leerCsvDespliegues(texto: string): LecturaDespliegues | null {
    const filas = parseCsv(texto);
    if (filas.length < 2)
        return null;
    const cab = filas[0].map((c) => c.trim().toLowerCase());
    const col = (...n: string[]) => cab.findIndex((c) => n.includes(c));
    const iF = col("fecha", "date", "deployed_at", "timestamp"), iS = col("sha", "commit", "version");
    const iT = col("titulo", "title", "descripcion", "description"), iR = col("resultado", "result", "status", "conclusion");
    if (iF < 0)
        return null;
    let descartadas = 0;
    const despliegues: Despliegue[] = [];
    for (const f of filas.slice(1)) {
        if (!f[iF]?.trim())
            continue;
        const res = iR >= 0 ? f[iR]?.trim().toLowerCase() : "ok";
        if (res && !["ok", "success", "exito", "\u00E9xito", "succeeded", "true", "1"].includes(res)) {
            descartadas++;
            continue;
        }
        const fecha = new Date(f[iF].trim());
        if (isNaN(fecha.getTime()))
            continue;
        despliegues.push({ fecha, sha: iS >= 0 ? f[iS]?.trim() || undefined : undefined, titulo: iT >= 0 ? f[iT]?.trim() || undefined : undefined });
    }
    return { despliegues, descartadas, workflows: [], formato: "csv" };
}
export function leerGitLog(texto: string): Commit[] {
    return texto.split(/\r?\n/).map((l) => {
        const sep = l.includes("\t") ? "\t" : "|";
        const p = l.split(sep);
        if (p.length < 2)
            return null;
        const fecha = new Date(p[1].trim());
        return /^[0-9a-f]{7,40}$/i.test(p[0].trim()) && !isNaN(fecha.getTime())
            ? { sha: p[0].trim(), fecha, titulo: p.slice(2).join(sep).trim() } : null;
    }).filter((c): c is Commit => c !== null);
}
export function leerIncidentes(texto: string): Incidente[] {
    const filas = parseCsv(texto);
    if (filas.length < 2)
        return [];
    const cab = filas[0].map((c) => c.trim().toLowerCase());
    const iI = cab.findIndex((c) => ["inicio", "start", "started_at", "opened"].includes(c));
    const iF = cab.findIndex((c) => ["fin", "end", "resolved_at", "closed"].includes(c));
    if (iI < 0)
        return [];
    const out: Incidente[] = [];
    for (const f of filas.slice(1)) {
        const inicio = new Date(f[iI]?.trim() ?? "");
        if (isNaN(inicio.getTime()))
            continue;
        const fin = iF >= 0 && f[iF]?.trim() ? new Date(f[iF].trim()) : undefined;
        out.push(fin && !isNaN(fin.getTime()) ? { inicio, fin } : { inicio });
    }
    return out;
}
export function parseCsv(texto: string): string[][] {
    const lineas = texto.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
    if (!lineas.length)
        return [];
    const sep = (lineas[0].match(/;/g)?.length ?? 0) > (lineas[0].match(/,/g)?.length ?? 0) ? ";" : ",";
    return lineas.map((l) => {
        const out: string[] = [];
        let cur = "", q = false;
        for (let i = 0; i < l.length; i++) {
            const c = l[i];
            if (q) {
                if (c === "\"" && l[i + 1] === "\"") {
                    cur += "\"";
                    i++;
                }
                else if (c === "\"")
                    q = false;
                else
                    cur += c;
            }
            else if (c === "\"")
                q = true;
            else if (c === sep) {
                out.push(cur);
                cur = "";
            }
            else
                cur += c;
        }
        out.push(cur);
        return out;
    });
}
