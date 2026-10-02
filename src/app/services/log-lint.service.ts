import { Injectable } from "@angular/core";
import { LogEvent, LogLevel } from "./log-parse.service";
import { LogPattern } from "./log-patterns.service";
import { DETECTORS, DEFAULT_ON_IDS } from "../shared/redact";
export type LintSeverity = "danger" | "warn" | "info";
export interface LintFinding {
    id: string;
    severity: LintSeverity;
    count: number;
    of: number;
    sample: string;
    at: number;
    detail?: string;
}
export interface LintOpts {
    floodShare?: number;
    giantMessage?: number;
    detectorIds?: string[];
}
const DEFAULTS = { floodShare: 0.35, giantMessage: 2000 };
const CORRELATION_KEYS = [
    "trace_id",
    "traceid",
    "trace.id",
    "traceparent",
    "span_id",
    "spanid",
    "request_id",
    "requestid",
    "request.id",
    "x-request-id",
    "correlation_id",
    "correlationid",
    "req_id",
    "reqid",
    "txid",
    "transaction_id",
];
@Injectable({ providedIn: "root" })
export class LogLintService {
    lint(events: LogEvent[], patterns: LogPattern[], opts: LintOpts = {}): LintFinding[] {
        if (events.length === 0)
            return [];
        const o = { ...DEFAULTS, ...opts };
        const out: LintFinding[] = [];
        const n = events.length;
        const ids = new Set(opts.detectorIds ?? DEFAULT_ON_IDS);
        const dets = DETECTORS.filter(d => ids.has(d.id));
        const porEntidad = new Map<string, {
            count: number;
            at: number;
            sample: string;
        }>();
        for (let i = 0; i < n; i++) {
            const texto = events[i].raw;
            for (const d of dets) {
                d.regex.lastIndex = 0;
                const m = d.regex.exec(texto);
                if (!m)
                    continue;
                if (d.validate && !d.validate(m[0]))
                    continue;
                const prev = porEntidad.get(d.id);
                if (prev)
                    prev.count++;
                else
                    porEntidad.set(d.id, { count: 1, at: i, sample: maskSample(m[0]) });
            }
        }
        for (const [entidad, info] of porEntidad) {
            out.push({ id: "secret", severity: "danger", count: info.count, of: n, sample: info.sample, at: info.at, detail: entidad });
        }
        for (const p of patterns) {
            if (p.overflow || p.count < 10)
                continue;
            if (p.count / n < o.floodShare)
                continue;
            out.push({
                id: "flood",
                severity: "warn",
                count: p.count,
                of: n,
                sample: cut(p.template),
                at: p.sampleIndex,
                detail: String(Math.round(100 * p.count / n)),
            });
        }
        let sinFecha = 0, sinZona = 0, primeroSinFecha = -1, primeroSinZona = -1;
        for (let i = 0; i < n; i++) {
            const e = events[i];
            if (e.ts == null) {
                sinFecha++;
                if (primeroSinFecha < 0)
                    primeroSinFecha = i;
                continue;
            }
            if (e.tsText && !/(Z|z|[+-]\d{2}:?\d{2})\s*$/.test(e.tsText.trim())) {
                sinZona++;
                if (primeroSinZona < 0)
                    primeroSinZona = i;
            }
        }
        if (sinFecha > n * 0.1) {
            out.push({ id: "no-timestamp", severity: "warn", count: sinFecha, of: n, sample: cut(events[primeroSinFecha].raw), at: primeroSinFecha });
        }
        if (sinZona > n * 0.5) {
            out.push({ id: "no-timezone", severity: "warn", count: sinZona, of: n, sample: cut(events[primeroSinZona].tsText), at: primeroSinZona });
        }
        let saltos = 0, primerSalto = -1, last: number | null = null;
        for (let i = 0; i < n; i++) {
            const t = events[i].ts;
            if (t == null)
                continue;
            if (last != null && t < last) {
                saltos++;
                if (primerSalto < 0)
                    primerSalto = i;
            }
            last = t;
        }
        if (saltos > 0) {
            out.push({ id: "clock-backwards", severity: "info", count: saltos, of: n, sample: cut(events[primerSalto].raw), at: primerSalto });
        }
        const conNivel = events.filter(e => e.level).length;
        if (conNivel < n * 0.5) {
            out.push({ id: "no-levels", severity: "warn", count: n - conNivel, of: n, sample: cut(events[0].raw), at: 0 });
        }
        else {
            const usados = new Set<LogLevel>();
            for (const e of events)
                if (e.level)
                    usados.add(e.level);
            if (usados.size === 1 && n >= 50) {
                out.push({ id: "single-level", severity: "info", count: n, of: n, sample: cut(events[0].raw), at: 0, detail: [...usados][0] });
            }
        }
        const claves = new Set<string>();
        for (const e of events)
            for (const k of Object.keys(e.fields))
                claves.add(k.toLowerCase());
        const tieneCorrelacion = CORRELATION_KEYS.some(k => claves.has(k)) ||
            events.some(e => /\b(?:trace|request|correlation)[-_. ]?id\b/i.test(e.message));
        if (!tieneCorrelacion && n >= 20) {
            out.push({ id: "no-correlation", severity: "warn", count: n, of: n, sample: cut(events[0].raw), at: 0 });
        }
        let gigantes = 0, primerGigante = -1;
        for (let i = 0; i < n; i++) {
            if (events[i].span === 1 && events[i].raw.length > o.giantMessage) {
                gigantes++;
                if (primerGigante < 0)
                    primerGigante = i;
            }
        }
        if (gigantes > 0) {
            out.push({ id: "giant-message", severity: "info", count: gigantes, of: n, sample: cut(events[primerGigante].raw), at: primerGigante, detail: String(o.giantMessage) });
        }
        let huerfanas = 0, primeraHuerfana = -1;
        for (let i = 0; i < n; i++) {
            const e = events[i];
            if (e.span > 1 && !e.level && e.ts == null) {
                huerfanas++;
                if (primeraHuerfana < 0)
                    primeraHuerfana = i;
            }
        }
        if (huerfanas > 0) {
            out.push({ id: "orphan-trace", severity: "warn", count: huerfanas, of: n, sample: cut(events[primeraHuerfana].raw), at: primeraHuerfana });
        }
        const peso: Record<LintSeverity, number> = { danger: 0, warn: 1, info: 2 };
        out.sort((a, b) => peso[a.severity] - peso[b.severity] || b.count - a.count || (a.id < b.id ? -1 : 1));
        return out;
    }
}
function cut(s: string, max = 120): string {
    const one = s.split("\n", 1)[0];
    return one.length > max ? one.slice(0, max) + "\u2026" : one;
}
function maskSample(s: string): string {
    if (s.length <= 6)
        return "\u2022".repeat(s.length);
    return s.slice(0, 3) + "\u2022".repeat(Math.min(12, s.length - 6)) + s.slice(-3);
}
