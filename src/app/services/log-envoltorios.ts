import type { LogLevel } from "./log-parse.service";
export type Envoltorio = "docker" | "cri" | "journald" | "otlp" | "cloudtrail";
export interface MetaLinea {
    ts?: number;
    tsText?: string;
    level?: LogLevel;
    levelText?: string;
    fields?: Record<string, string>;
}
export interface Desenvuelto {
    envoltorio: Envoltorio;
    lineas: string[];
    ini: number[];
    fin: number[];
    meta: (MetaLinea | undefined)[];
    unidos: number;
}
const CRI = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})) (stdout|stderr) ([PF])(?::\S*)?(?: (.*))?$/;
function rfc3339(s: string): number | undefined {
    const t = Date.parse(s.replace(/(\.\d{3})\d+/, "$1"));
    return Number.isNaN(t) ? undefined : t;
}
function objeto(l: string): Record<string, unknown> | null {
    const t = l.trim();
    if (!t.startsWith("{") || !t.endsWith("}"))
        return null;
    try {
        const o: unknown = JSON.parse(t);
        return o && typeof o === "object" && !Array.isArray(o) ? o as Record<string, unknown> : null;
    }
    catch {
        return null;
    }
}
function documento(lines: string[]): Record<string, unknown> | null {
    const primera = lines.find(l => l.trim() !== "");
    if (!primera || !primera.trimStart().startsWith("{") || objeto(primera))
        return null;
    return objeto(lines.join("\n"));
}
const esOtlp = (o: Record<string, unknown> | null) => !!o && Array.isArray(o["resourceLogs"]);
const esRegistroCloudTrail = (o: unknown) => !!o && typeof o === "object" && typeof (o as Record<string, unknown>)["eventTime"] === "string"
    && typeof (o as Record<string, unknown>)["eventSource"] === "string" && typeof (o as Record<string, unknown>)["eventName"] === "string";
const esCloudTrail = (o: Record<string, unknown> | null) => !!o && Array.isArray(o["Records"]) && esRegistroCloudTrail((o["Records"] as unknown[])[0]);
export function detectarEnvoltorio(lines: string[]): Envoltorio | null {
    const muestra = lines.filter(l => l.trim() !== "").slice(0, 50);
    if (!muestra.length)
        return null;
    const doc = documento(lines);
    if (esOtlp(doc))
        return "otlp";
    if (esCloudTrail(doc))
        return "cloudtrail";
    const umbral = Math.max(1, Math.ceil(muestra.length * 0.8));
    let docker = 0, cri = 0, journald = 0, otlp = 0, ct = 0;
    for (const l of muestra) {
        if (CRI.test(l)) {
            cri++;
            continue;
        }
        const o = objeto(l);
        if (!o)
            continue;
        if (typeof o["log"] === "string" && typeof o["stream"] === "string")
            docker++;
        else if ("__REALTIME_TIMESTAMP" in o && "MESSAGE" in o)
            journald++;
        else if (esOtlp(o))
            otlp++;
        else if (esRegistroCloudTrail(o) || esCloudTrail(o))
            ct++;
    }
    if (docker >= umbral)
        return "docker";
    if (cri >= umbral)
        return "cri";
    if (journald >= umbral)
        return "journald";
    if (otlp >= umbral)
        return "otlp";
    if (ct >= umbral)
        return "cloudtrail";
    return null;
}
export function desenvolver(lines: string[], env: Envoltorio): Desenvuelto {
    const d: Desenvuelto = { envoltorio: env, lineas: [], ini: [], fin: [], meta: [], unidos: 0 };
    const emitir = (texto: string, ini: number, fin: number, meta?: MetaLinea) => {
        const partes = texto.replace(/\r?\n$/, "").split(/\r?\n/);
        partes.forEach((p, k) => { d.lineas.push(p); d.ini.push(ini); d.fin.push(fin); d.meta.push(k === 0 ? meta : undefined); });
    };
    if (env === "docker" || env === "cri") {
        let trozo = "", desde = -1, meta: MetaLinea | undefined;
        const cerrar = (hasta: number) => { emitir(trozo, desde, hasta, meta); trozo = ""; desde = -1; meta = undefined; };
        lines.forEach((l, i) => {
            let texto: string, parcial: boolean, m: MetaLinea;
            if (env === "docker") {
                const o = objeto(l);
                if (!o || typeof o["log"] !== "string") {
                    if (desde >= 0)
                        cerrar(i - 1);
                    emitir(l, i, i);
                    return;
                }
                const log = o["log"] as string;
                parcial = !log.endsWith("\n");
                texto = parcial ? log : log.slice(0, -1);
                const time = typeof o["time"] === "string" ? o["time"] : "";
                m = { ts: rfc3339(time), tsText: time, fields: { stream: String(o["stream"]) } };
            }
            else {
                const r = CRI.exec(l);
                if (!r) {
                    if (desde >= 0)
                        cerrar(i - 1);
                    emitir(l, i, i);
                    return;
                }
                parcial = r[3] === "P";
                texto = r[4] ?? "";
                m = { ts: rfc3339(r[1]), tsText: r[1], fields: { stream: r[2] } };
            }
            if (desde < 0) {
                desde = i;
                meta = m;
            }
            else
                d.unidos++;
            trozo += texto;
            if (!parcial)
                cerrar(i);
        });
        if (desde >= 0)
            cerrar(lines.length - 1);
        return d;
    }
    if (env === "journald") {
        lines.forEach((l, i) => {
            const o = objeto(l);
            if (!o) {
                emitir(l, i, i);
                return;
            }
            emitir(mensajeJournald(o["MESSAGE"]), i, i, metaJournald(o));
        });
        return d;
    }
    const doc = documento(lines);
    const docs: {
        o: Record<string, unknown>;
        ini: number;
        fin: number;
    }[] = doc && (esOtlp(doc) || esCloudTrail(doc))
        ? [{ o: doc, ini: 0, fin: lines.length - 1 }]
        : lines.map((l, i) => ({ o: objeto(l)!, ini: i, fin: i })).filter(x => x.o);
    for (const { o, ini, fin } of docs) {
        if (env === "otlp")
            for (const r of registrosOtlp(o))
                emitir(r.texto, ini, fin, r.meta);
        else
            for (const r of (Array.isArray(o["Records"]) ? o["Records"] as Record<string, unknown>[] : [o])) {
                if (esRegistroCloudTrail(r))
                    emitir(textoCloudTrail(r), ini, fin, metaCloudTrail(r));
            }
    }
    return d;
}
const PRIORIDAD: LogLevel[] = ["fatal", "fatal", "fatal", "error", "warn", "info", "info", "debug"];
const JOURNALD_FUERA = new Set(["MESSAGE", "PRIORITY", "__CURSOR", "__REALTIME_TIMESTAMP", "__MONOTONIC_TIMESTAMP", "_BOOT_ID", "_MACHINE_ID", "__SEQNUM", "__SEQNUM_ID", "_SOURCE_REALTIME_TIMESTAMP", "_SOURCE_MONOTONIC_TIMESTAMP"]);
function mensajeJournald(m: unknown): string {
    if (typeof m === "string")
        return m;
    if (Array.isArray(m) && m.every(b => typeof b === "number"))
        return new TextDecoder().decode(new Uint8Array(m as number[]));
    return m == null ? "" : JSON.stringify(m);
}
function metaJournald(o: Record<string, unknown>): MetaLinea {
    const us = Number(o["__REALTIME_TIMESTAMP"]);
    const ts = Number.isFinite(us) && us > 0 ? Math.floor(us / 1000) : undefined;
    const p = Number(o["PRIORITY"]);
    const fields: Record<string, string> = {};
    for (const [k, v] of Object.entries(o))
        if (!JOURNALD_FUERA.has(k) && v != null)
            fields[k] = typeof v === "string" ? v : JSON.stringify(v);
    return {
        ts,
        tsText: ts != null ? new Date(ts).toISOString() : "",
        level: Number.isInteger(p) && p >= 0 && p <= 7 ? PRIORIDAD[p] : undefined,
        levelText: o["PRIORITY"] != null ? String(o["PRIORITY"]) : "",
        fields,
    };
}
type AnyValue = {
    stringValue?: string;
    intValue?: string | number;
    doubleValue?: number;
    boolValue?: boolean;
    bytesValue?: string;
    arrayValue?: {
        values?: AnyValue[];
    };
    kvlistValue?: {
        values?: {
            key: string;
            value: AnyValue;
        }[];
    };
};
function valor(v: AnyValue | undefined): string {
    if (!v)
        return "";
    if (v.stringValue != null)
        return v.stringValue;
    if (v.intValue != null)
        return String(v.intValue);
    if (v.doubleValue != null)
        return String(v.doubleValue);
    if (v.boolValue != null)
        return String(v.boolValue);
    if (v.bytesValue != null)
        return v.bytesValue;
    if (v.arrayValue)
        return JSON.stringify((v.arrayValue.values ?? []).map(valor));
    if (v.kvlistValue)
        return JSON.stringify(Object.fromEntries((v.kvlistValue.values ?? []).map(kv => [kv.key, valor(kv.value)])));
    return "";
}
function nivelOtlp(n: unknown): LogLevel | undefined {
    const x = Number(n);
    if (!Number.isInteger(x) || x < 1 || x > 24)
        return undefined;
    return (["trace", "debug", "info", "warn", "error", "fatal"] as LogLevel[])[Math.floor((x - 1) / 4)];
}
function nanosAMs(s: unknown): number | undefined {
    if (typeof s !== "string" && typeof s !== "number")
        return undefined;
    const t = String(s);
    if (!/^\d+$/.test(t) || t === "0")
        return undefined;
    return Number(t.length > 6 ? t.slice(0, -6) : "0");
}
function registrosOtlp(doc: Record<string, unknown>): {
    texto: string;
    meta: MetaLinea;
}[] {
    const out: {
        texto: string;
        meta: MetaLinea;
    }[] = [];
    for (const rl of (doc["resourceLogs"] as Record<string, unknown>[] | undefined) ?? []) {
        const recurso: Record<string, string> = {};
        for (const a of ((rl["resource"] as {
            attributes?: {
                key: string;
                value: AnyValue;
            }[];
        } | undefined)?.attributes ?? []))
            recurso[a.key] = valor(a.value);
        for (const sl of (rl["scopeLogs"] as Record<string, unknown>[] | undefined) ?? []) {
            for (const r of (sl["logRecords"] as Record<string, unknown>[] | undefined) ?? []) {
                const fields: Record<string, string> = { ...recurso };
                for (const a of ((r["attributes"] as {
                    key: string;
                    value: AnyValue;
                }[] | undefined) ?? []))
                    fields[a.key] = valor(a.value);
                if (r["traceId"])
                    fields["trace_id"] = String(r["traceId"]);
                if (r["spanId"])
                    fields["span_id"] = String(r["spanId"]);
                const ts = nanosAMs(r["timeUnixNano"]) ?? nanosAMs(r["observedTimeUnixNano"]);
                const sev = typeof r["severityText"] === "string" ? r["severityText"] as string : "";
                out.push({
                    texto: valor(r["body"] as AnyValue | undefined),
                    meta: { ts, tsText: ts != null ? new Date(ts).toISOString() : "", level: nivelOtlp(r["severityNumber"]), levelText: sev || String(r["severityNumber"] ?? ""), fields },
                });
            }
        }
    }
    return out;
}
function textoCloudTrail(r: Record<string, unknown>): string {
    const err = r["errorCode"] ? ` ${r["errorCode"]}${r["errorMessage"] ? ": " + r["errorMessage"] : ""}` : "";
    return `${r["eventSource"]} ${r["eventName"]}${err}`;
}
function metaCloudTrail(r: Record<string, unknown>): MetaLinea {
    const fields: Record<string, string> = {};
    const plano = (o: Record<string, unknown>, pre: string) => {
        for (const [k, v] of Object.entries(o)) {
            if (v == null)
                continue;
            if (typeof v === "object" && !Array.isArray(v) && pre === "" && k === "userIdentity")
                plano(v as Record<string, unknown>, "userIdentity.");
            else if (typeof v === "object") {
                const j = JSON.stringify(v);
                fields[pre + k] = j.length > 500 ? j.slice(0, 500) + "\u2026" : j;
            }
            else
                fields[pre + k] = String(v);
        }
    };
    plano(r, "");
    delete fields["eventTime"];
    const ts = rfc3339(String(r["eventTime"]));
    return { ts, tsText: String(r["eventTime"]), level: r["errorCode"] ? "error" : "info", levelText: r["errorCode"] ? String(r["errorCode"]) : "", fields };
}
