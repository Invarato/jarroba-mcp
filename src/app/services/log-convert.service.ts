import { Injectable } from "@angular/core";
import { LogEvent, LogLevel } from "./log-parse.service";
export type LogTarget = "json" | "logfmt" | "syslog5424" | "csv" | "otel" | "ecs";
export interface ConvertOpts {
    service?: string;
    host?: string;
    facility?: number;
    columns?: string[];
    pretty?: boolean;
}
const OTEL_SEVERITY: Record<LogLevel, number> = {
    trace: 1,
    debug: 5,
    info: 9,
    warn: 13,
    error: 17,
    fatal: 21,
};
const SYSLOG_SEVERITY: Record<LogLevel, number> = {
    fatal: 2,
    error: 3,
    warn: 4,
    info: 6,
    debug: 7,
    trace: 7,
};
const ECS_MOVE: Record<string, string> = {
    host: "host.hostname",
    app: "service.name",
    pid: "process.pid",
    procid: "process.pid",
    status: "http.response.status_code",
    request: "http.request.line",
    agent: "user_agent.original",
    referer: "http.request.referrer",
};
export interface LossReport {
    losses: string[];
    counts: Record<string, number>;
}
@Injectable({ providedIn: "root" })
export class LogConvertService {
    lossy(events: LogEvent[], target: LogTarget, opts: ConvertOpts = {}): LossReport {
        const counts: Record<string, number> = {};
        const bump = (id: string) => { counts[id] = (counts[id] ?? 0) + 1; };
        for (const e of events) {
            const nFields = Object.keys(e.fields).length;
            if (target === "syslog5424") {
                if (nFields > 0)
                    bump("fields-to-sd");
                if (e.span > 1)
                    bump("multiline");
                if (e.level === "trace")
                    bump("severity-collapsed");
            }
            if (target === "csv") {
                const cols = opts.columns?.length ?? 0;
                if (nFields > cols)
                    bump("fields-dropped");
                if (e.span > 1)
                    bump("multiline");
            }
            if (target === "logfmt" && e.span > 1)
                bump("multiline");
            if (e.ts == null && target !== "json")
                bump("no-timestamp");
        }
        return { losses: Object.keys(counts), counts };
    }
    convert(events: LogEvent[], target: LogTarget, opts: ConvertOpts = {}): string {
        switch (target) {
            case "json": return events.map(e => JSON.stringify(this.plain(e), null, opts.pretty ? 2 : undefined)).join("\n");
            case "otel": return events.map(e => JSON.stringify(this.otel(e, opts), null, opts.pretty ? 2 : undefined)).join("\n");
            case "ecs": return events.map(e => JSON.stringify(this.ecs(e, opts), null, opts.pretty ? 2 : undefined)).join("\n");
            case "logfmt": return events.map(e => this.logfmt(e)).join("\n");
            case "syslog5424": return events.map(e => this.syslog(e, opts)).join("\n");
            default: return this.csv(events, opts);
        }
    }
    private plain(e: LogEvent): Record<string, unknown> {
        const out: Record<string, unknown> = {};
        if (e.ts != null)
            out["timestamp"] = new Date(e.ts).toISOString();
        else if (e.tsText)
            out["timestamp"] = e.tsText;
        if (e.level)
            out["level"] = e.level;
        out["message"] = e.message;
        if (e.source)
            out["source"] = e.source;
        for (const [k, v] of Object.entries(e.fields))
            out[k] = v;
        return out;
    }
    private otel(e: LogEvent, opts: ConvertOpts): Record<string, unknown> {
        const attrs: Record<string, string> = { ...e.fields };
        const resource: Record<string, string> = {};
        const host = attrs["host"] ?? opts.host;
        const app = attrs["app"] ?? opts.service;
        if (host) {
            resource["host.name"] = host;
            delete attrs["host"];
        }
        if (app) {
            resource["service.name"] = app;
            delete attrs["app"];
        }
        const out: Record<string, unknown> = {};
        if (e.ts != null) {
            out["timeUnixNano"] = String(e.ts) + "000000";
            out["observedTimeUnixNano"] = out["timeUnixNano"];
        }
        if (e.level) {
            out["severityNumber"] = OTEL_SEVERITY[e.level];
            out["severityText"] = e.levelText || e.level.toUpperCase();
        }
        out["body"] = { stringValue: e.span > 1 ? e.raw : e.message };
        if (Object.keys(attrs).length)
            out["attributes"] = attrs;
        if (Object.keys(resource).length)
            out["resource"] = resource;
        return out;
    }
    private ecs(e: LogEvent, opts: ConvertOpts): Record<string, unknown> {
        const out: Record<string, unknown> = {};
        if (e.ts != null)
            out["@timestamp"] = new Date(e.ts).toISOString();
        if (e.level)
            out["log.level"] = e.level;
        out["message"] = e.span > 1 ? e.raw : e.message;
        if (opts.service)
            out["service.name"] = opts.service;
        if (opts.host)
            out["host.hostname"] = opts.host;
        for (const [k, v] of Object.entries(e.fields))
            out[ECS_MOVE[k] ?? `labels.${k}`] = v;
        return out;
    }
    private logfmt(e: LogEvent): string {
        const parts: string[] = [];
        if (e.ts != null)
            parts.push(`time=${new Date(e.ts).toISOString()}`);
        if (e.level)
            parts.push(`level=${e.level}`);
        parts.push(`msg=${quote(e.span > 1 ? e.raw : e.message)}`);
        for (const [k, v] of Object.entries(e.fields))
            parts.push(`${k}=${quote(v)}`);
        return parts.join(" ");
    }
    private syslog(e: LogEvent, opts: ConvertOpts): string {
        const fac = opts.facility ?? 1;
        const sev = e.level ? SYSLOG_SEVERITY[e.level] : 6;
        const pri = fac * 8 + sev;
        const ts = e.ts != null ? new Date(e.ts).toISOString() : "-";
        const host = e.fields["host"] ?? opts.host ?? "-";
        const app = e.fields["app"] ?? opts.service ?? "-";
        const procid = e.fields["pid"] ?? e.fields["procid"] ?? "-";
        const msgid = e.fields["msgid"] ?? "-";
        const resto = Object.entries(e.fields).filter(([k]) => !["host", "app", "pid", "procid", "msgid"].includes(k));
        const sd = resto.length
            ? `[jt@0 ${resto.map(([k, v]) => `${k}="${v.replace(/([\\\]"])/g, "\\$1")}"`).join(" ")}]`
            : "-";
        const body = (e.span > 1 ? e.raw : e.message).replace(/\n/g, "\\n");
        return `<${pri}>1 ${ts} ${host} ${app} ${procid} ${msgid} ${sd} ${body}`;
    }
    private csv(events: LogEvent[], opts: ConvertOpts): string {
        const cols = opts.columns ?? [];
        const head = ["timestamp", "level", "message", ...cols];
        const rows = events.map(e => [
            e.ts != null ? new Date(e.ts).toISOString() : e.tsText,
            e.level ?? "",
            e.span > 1 ? e.raw : e.message,
            ...cols.map(c => e.fields[c] ?? ""),
        ].map(csvCell).join(","));
        return [head.join(","), ...rows].join("\n");
    }
}
function quote(v: string): string {
    return /[\s"=]/.test(v) || v === "" ? JSON.stringify(v) : v;
}
function csvCell(v: string): string {
    return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, "\"\"")}"` : v;
}
