import { Injectable } from "@angular/core";
import { LogEvent, LogLevel, LEVEL_ORDER } from "./log-parse.service";
import { LogPattern } from "./log-patterns.service";
import { LogStacktraceService } from "./log-stacktrace.service";
export type ReduceMode = "log" | "digest";
export interface ReduceOpts {
    maxChars?: number;
    keepLevels?: LogLevel[];
    contextBefore?: number;
    contextAfter?: number;
    samplesPerPattern?: number;
    rareMax?: number;
    keepTraces?: boolean;
    annotateCounts?: boolean;
}
export interface ReduceResult {
    text: string;
    kept: number;
    total: number;
    chars: number;
    originalChars: number;
    saved: number;
    trimmed: boolean;
}
const DEFAULTS = {
    keepLevels: ["error", "fatal"] as LogLevel[],
    contextBefore: 3,
    contextAfter: 1,
    samplesPerPattern: 1,
    rareMax: 2,
    keepTraces: true,
    annotateCounts: true,
};
const enum Prio {
    Extra = 0,
    Sample = 1,
    Rare = 2,
    Context = 3,
    Error = 4
}
@Injectable({ providedIn: "root" })
export class LogReduceService {
    private traces = new LogStacktraceService();
    reduce(events: LogEvent[], patterns: LogPattern[], opts: ReduceOpts = {}): ReduceResult {
        const o = { ...DEFAULTS, ...opts };
        const originalChars = events.reduce((a, e) => a + e.raw.length + 1, 0);
        if (events.length === 0) {
            return { text: "", kept: 0, total: 0, chars: 0, originalChars: 0, saved: 0, trimmed: false };
        }
        const prio = this.prioritize(events, patterns, o);
        const counts = this.countByIndex(events, patterns, o);
        const body = events.map((e, i) => this.render(e, counts.get(i), o));
        let keep = prio.map(p => p >= 0);
        let final = body;
        let trimmed = false;
        let salida = this.emit(final, keep);
        if (o.maxChars && o.maxChars > 0) {
            let budget = o.maxChars;
            for (let pasada = 0; pasada < 3; pasada++) {
                const fit = this.fitBudget(body, prio, budget);
                const r = this.emit(fit.body, fit.keep);
                keep = fit.keep;
                final = fit.body;
                trimmed = fit.trimmed;
                salida = r;
                if (r.text.length <= o.maxChars || budget <= 1)
                    break;
                budget = Math.max(1, budget - (r.text.length - o.maxChars));
            }
            if (salida.text.length > o.maxChars) {
                salida = salida.kept > 0
                    ? { text: salida.text.slice(0, o.maxChars), kept: salida.kept }
                    : { text: "", kept: 0 };
                trimmed = true;
            }
        }
        const { text, kept } = salida;
        return {
            text,
            kept,
            total: events.length,
            chars: text.length,
            originalChars,
            saved: originalChars ? 1 - text.length / originalChars : 0,
            trimmed,
        };
    }
    private prioritize(events: LogEvent[], patterns: LogPattern[], o: ReduceOpts): number[] {
        const keepLevels = new Set(o.keepLevels ?? DEFAULTS.keepLevels);
        const prio = new Array<number>(events.length).fill(-1);
        for (let i = 0; i < events.length; i++) {
            if (events[i].level && keepLevels.has(events[i].level!))
                prio[i] = Prio.Error;
        }
        const before = o.contextBefore ?? DEFAULTS.contextBefore;
        const after = o.contextAfter ?? DEFAULTS.contextAfter;
        for (let i = 0; i < events.length; i++) {
            if (prio[i] !== Prio.Error)
                continue;
            for (let k = Math.max(0, i - before); k <= Math.min(events.length - 1, i + after); k++) {
                if (prio[k] < Prio.Context)
                    prio[k] = Prio.Context;
            }
        }
        const rareMax = o.rareMax ?? DEFAULTS.rareMax;
        const samples = Math.max(1, o.samplesPerPattern ?? DEFAULTS.samplesPerPattern);
        for (const p of patterns) {
            if (p.count <= rareMax) {
                for (const i of p.occurrences)
                    if (prio[i] < Prio.Rare)
                        prio[i] = Prio.Rare;
                continue;
            }
            for (let k = 0; k < Math.min(samples, p.occurrences.length); k++) {
                const i = p.occurrences[k];
                if (prio[i] < Prio.Sample)
                    prio[i] = Prio.Sample;
            }
        }
        return prio;
    }
    private countByIndex(events: LogEvent[], patterns: LogPattern[], o: ReduceOpts): Map<number, {
        n: number;
        exact: boolean;
    }> {
        const m = new Map<number, {
            n: number;
            exact: boolean;
        }>();
        if (o.annotateCounts === false)
            return m;
        for (const p of patterns) {
            if (p.count <= 1 || !p.occurrences.length)
                continue;
            const primera = events[p.occurrences[0]]?.raw;
            const exact = p.occurrences.every(i => events[i]?.raw === primera);
            m.set(p.occurrences[0], { n: p.count, exact });
        }
        return m;
    }
    private render(e: LogEvent, count: {
        n: number;
        exact: boolean;
    } | undefined, o: ReduceOpts): string {
        let text = e.raw;
        if (o.keepTraces === false && e.span > 1) {
            const t = this.traces.parse(e.raw);
            const head = e.raw.split("\n", 1)[0];
            text = t ? `${head}  ⟪${this.traces.summary(t)}⟫` : head;
        }
        if (!count)
            return text;
        return `[${count.exact ? "\u00D7" : "~"}${count.n}] ${text}`;
    }
    private fitBudget(body: string[], prio: number[], maxChars: number): {
        keep: boolean[];
        trimmed: boolean;
        body: string[];
    } {
        const out = body.slice();
        const keep = new Array<boolean>(body.length).fill(false);
        let used = 0, trimmed = false, floor = Prio.Extra;
        for (let level = Prio.Error; level >= floor; level--) {
            for (let i = 0; i < out.length; i++) {
                if (prio[i] !== level)
                    continue;
                const cost = out[i].length + 1;
                if (used + cost <= maxChars) {
                    keep[i] = true;
                    used += cost;
                    continue;
                }
                trimmed = true;
                if (used === 0 && maxChars > 1) {
                    out[i] = out[i].slice(0, maxChars - 1) + "\u2026";
                    keep[i] = true;
                    used = out[i].length + 1;
                }
                floor = level;
            }
        }
        return { keep, trimmed, body: out };
    }
    private emit(body: string[], keep: boolean[]): {
        text: string;
        kept: number;
    } {
        const out: string[] = [];
        let gap = 0, kept = 0;
        const flushGap = () => { if (gap) {
            out.push(`[…${gap}]`);
            gap = 0;
        } };
        for (let i = 0; i < body.length; i++) {
            if (keep[i]) {
                flushGap();
                out.push(body[i]);
                kept++;
            }
            else
                gap++;
        }
        flushGap();
        return { text: out.join("\n"), kept };
    }
    digest(events: LogEvent[], patterns: LogPattern[], opts: {
        topPatterns?: number;
    } = {}): string {
        const top = opts.topPatterns ?? 15;
        const lines: string[] = [];
        const levels = { trace: 0, debug: 0, info: 0, warn: 0, error: 0, fatal: 0 } as Record<LogLevel, number>;
        let min = Infinity, max = -Infinity, dated = 0;
        for (const e of events) {
            if (e.level)
                levels[e.level]++;
            if (e.ts != null) {
                dated++;
                min = Math.min(min, e.ts);
                max = Math.max(max, e.ts);
            }
        }
        const iso = (t: number) => new Date(t).toISOString();
        const lvl = LEVEL_ORDER.filter(l => levels[l] > 0).map(l => `${l}=${levels[l]}`).join(" ");
        lines.push(`events=${events.length} patterns=${patterns.length}${lvl ? " " + lvl : ""}`);
        if (dated)
            lines.push(`range=${iso(min)}..${iso(max)}`);
        const errIds = new Set(patterns.filter(p => p.level === "error" || p.level === "fatal").map(p => p.id));
        const errores = patterns.filter(p => errIds.has(p.id));
        if (errores.length) {
            lines.push("", "## errors");
            for (const p of errores) {
                lines.push(`[x${p.count}] ${p.template}`);
                if (p.firstTs != null)
                    lines.push(`  when=${iso(p.firstTs)}..${iso(p.lastTs ?? p.firstTs)}`);
                const ev = events[p.sampleIndex];
                if (ev && ev.span > 1) {
                    const t = this.traces.parse(ev.raw);
                    if (t)
                        lines.push(`  cause=${this.traces.summary(t)}`);
                }
            }
        }
        const resto = patterns.filter(p => !errIds.has(p.id)).slice(0, top);
        if (resto.length) {
            lines.push("", "## top patterns");
            for (const p of resto)
                lines.push(`[x${p.count}] ${p.level ?? "-"} ${p.template}`);
        }
        return lines.join("\n");
    }
}
