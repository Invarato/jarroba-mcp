import { Injectable } from "@angular/core";
export type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal";
export const LEVEL_ORDER: LogLevel[] = ["trace", "debug", "info", "warn", "error", "fatal"];
export type LogFormat = "json" | "logfmt" | "syslog5424" | "syslog3164" | "clf" | "combined" | "plain";
export interface LogEvent {
    line: number;
    span: number;
    raw: string;
    ts: number | null;
    tsText: string;
    level: LogLevel | null;
    levelText: string;
    message: string;
    fields: Record<string, string>;
    source?: string;
}
export interface ParseInfo {
    format: LogFormat;
    tsPattern: string | null;
    tsDateless: boolean;
    confidence: number;
    anchored: number;
}
export interface ParseResult {
    events: LogEvent[];
    info: ParseInfo;
    lines: number;
    truncated: boolean;
}
export interface ParseOpts {
    format?: LogFormat;
    source?: string;
    maxEvents?: number;
    maxEventLines?: number;
    offsetMs?: number;
    sourceZone?: string;
    eventStart?: RegExp;
}
const DEFAULT_MAX_EVENTS = 200000;
const DEFAULT_MAX_EVENT_LINES = 500;
const MONTHS: Record<string, number> = {
    jan: 0,
    feb: 1,
    mar: 2,
    apr: 3,
    may: 4,
    jun: 5,
    jul: 6,
    aug: 7,
    sep: 8,
    oct: 9,
    nov: 10,
    dec: 11,
    ene: 0,
    abr: 3,
    ago: 7,
    dic: 11,
};
interface TsPattern {
    id: string;
    re: RegExp;
    dateless?: boolean;
    parse(m: RegExpExecArray): number | null;
}
function fracMs(s: string | undefined): number {
    if (!s)
        return 0;
    return Math.round(parseFloat("0." + s) * 1000);
}
function tzMinutes(s: string | undefined): number | null {
    if (!s)
        return null;
    if (s === "Z" || s === "z")
        return 0;
    const m = /^([+-])(\d{2}):?(\d{2})$/.exec(s);
    if (!m)
        return null;
    const v = Number(m[2]) * 60 + Number(m[3]);
    return m[1] === "-" ? -v : v;
}
function utc(y: number, mo: number, d: number, h: number, mi: number, s: number, ms: number, tz: number | null): number {
    const base = Date.UTC(y, mo, d, h, mi, s, ms);
    return tz == null ? base : base - tz * 60000;
}
const TS_PATTERNS: TsPattern[] = [
    {
        id: "iso",
        re: /(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:[.,](\d{1,9}))?\s?(Z|z|[+-]\d{2}:?\d{2})?/,
        parse: m => utc(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6], fracMs(m[7]), tzMinutes(m[8])),
    },
    {
        id: "clf",
        re: /(\d{2})\/([A-Za-z]{3})\/(\d{4}):(\d{2}):(\d{2}):(\d{2})\s([+-]\d{4})/,
        parse: m => {
            const mo = MONTHS[m[2].toLowerCase()];
            if (mo == null)
                return null;
            return utc(+m[3], mo, +m[1], +m[4], +m[5], +m[6], 0, tzMinutes(m[7]));
        },
    },
    {
        id: "epoch-ms",
        re: /^\s*(\d{13})(?:\.\d+)?\b/,
        parse: m => +m[1],
    },
    {
        id: "epoch-s",
        re: /^\s*(\d{10})(?:\.(\d{1,9}))?\b/,
        parse: m => +m[1] * 1000 + fracMs(m[2]),
    },
    {
        id: "bsd",
        re: /([A-Za-z]{3})\s{1,2}(\d{1,2})\s(\d{2}):(\d{2}):(\d{2})/,
        parse: m => {
            const mo = MONTHS[m[1].toLowerCase()];
            if (mo == null)
                return null;
            return utc(new Date().getUTCFullYear(), mo, +m[2], +m[3], +m[4], +m[5], 0, 0);
        },
    },
    {
        id: "time",
        dateless: true,
        re: /(\d{2}):(\d{2}):(\d{2})(?:[.,](\d{1,9}))?/,
        parse: m => utc(1970, 0, 1, +m[1], +m[2], +m[3], fracMs(m[4]), 0),
    },
];
const TS_BY_ID = new Map(TS_PATTERNS.map(p => [p.id, p]));
const MAX_INSTANTE = 8640000000000000;
export function isUsableInstant(ms: number): boolean {
    return Number.isFinite(ms) && Math.abs(ms) <= MAX_INSTANTE;
}
export function hasExplicitZone(tsText: string): boolean {
    return /(?:Z|z|[+-]\d{2}:?\d{2})\s*$/.test(tsText.trim());
}
export function wallToUtc(wallMs: number, timeZone: string): number | null {
    if (!isUsableInstant(wallMs))
        return null;
    const desplazamiento = (t: number): number | null => {
        const w = zoneWallMs(t, timeZone);
        return w == null ? null : w - t;
    };
    const UN_DIA = 86400000;
    const oAntes = desplazamiento(isUsableInstant(wallMs - UN_DIA) ? wallMs - UN_DIA : wallMs);
    const oDespues = desplazamiento(isUsableInstant(wallMs + UN_DIA) ? wallMs + UN_DIA : wallMs);
    if (oAntes == null || oDespues == null)
        return wallMs;
    if (oAntes === oDespues) {
        const t = wallMs - oAntes;
        return isUsableInstant(t) ? t : null;
    }
    const a = wallMs - oAntes, b = wallMs - oDespues;
    const valeA = zoneWallMs(a, timeZone) === wallMs;
    const valeB = zoneWallMs(b, timeZone) === wallMs;
    const r = valeA && valeB ? Math.min(a, b)
        : valeA ? a
            : valeB ? b
                : Math.max(a, b);
    return isUsableInstant(r) ? r : null;
}
function zoneWallMs(ms: number, timeZone: string): number | null {
    try {
        const p = zoneParts(timeZone).formatToParts(new Date(ms));
        const g = (k: string) => Number(p.find(x => x.type === k)?.value);
        let h = g("hour");
        if (h === 24)
            h = 0;
        return Date.UTC(g("year"), g("month") - 1, g("day"), h, g("minute"), g("second"), 0);
    }
    catch {
        return null;
    }
}
const ZONE_FMT = new Map<string, Intl.DateTimeFormat>();
function zoneParts(timeZone: string): Intl.DateTimeFormat {
    let f = ZONE_FMT.get(timeZone);
    if (!f) {
        f = new Intl.DateTimeFormat("en-US", {
            timeZone,
            hour12: false,
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
        });
        ZONE_FMT.set(timeZone, f);
    }
    return f;
}
export function isValidZone(timeZone: string): boolean {
    return zoneWallMs(0, timeZone) != null;
}
export function formatIn(ms: number, timeZone?: string): string {
    if (!isUsableInstant(ms))
        return "";
    const w = timeZone ? zoneWallMs(ms, timeZone) : null;
    const usar = w != null && isUsableInstant(w) ? w : ms;
    return new Date(usar).toISOString().replace("T", " ").replace(/\.\d+Z$/, "");
}
export function zoneOffsetMinutes(ms: number, timeZone: string): number | null {
    if (!isUsableInstant(ms))
        return null;
    const w = zoneWallMs(ms, timeZone);
    return w == null ? null : Math.round((w - ms) / 60000);
}
const TS_WINDOW = 72;
interface TsHit {
    id: string;
    text: string;
    ts: number | null;
    start: number;
    end: number;
}
function findTs(line: string, only?: string | null): TsHit | null {
    const head = line.slice(0, TS_WINDOW);
    const pats = only ? (TS_BY_ID.has(only) ? [TS_BY_ID.get(only)!] : []) : TS_PATTERNS;
    for (const p of pats) {
        const m = p.re.exec(head);
        if (!m)
            continue;
        return { id: p.id, text: m[0], ts: p.parse(m), start: m.index, end: m.index + m[0].length };
    }
    return null;
}
const LEVEL_ALIAS: Record<string, LogLevel> = {
    trace: "trace",
    trc: "trace",
    verbose: "trace",
    finest: "trace",
    finer: "trace",
    debug: "debug",
    dbg: "debug",
    fine: "debug",
    d: "debug",
    info: "info",
    information: "info",
    notice: "info",
    config: "info",
    i: "info",
    warn: "warn",
    warning: "warn",
    w: "warn",
    error: "error",
    err: "error",
    severe: "error",
    e: "error",
    fatal: "fatal",
    critical: "fatal",
    crit: "fatal",
    panic: "fatal",
    emerg: "fatal",
    emergency: "fatal",
    alert: "fatal",
};
const LEVEL_WORDS = Object.keys(LEVEL_ALIAS).filter(w => w.length > 1).join("|");
const LEVEL_MARKED = new RegExp(`[[(|<]\\s*(${LEVEL_WORDS})\\s*[\\])|>]|\\b(${LEVEL_WORDS})\\s*:`, "i");
const LEVEL_BARE = new RegExp(`\\b(${LEVEL_WORDS})\\b`, "i");
interface LevelHit {
    level: LogLevel;
    text: string;
    end: number;
}
function findLevel(line: string, tsEnd = 0): LevelHit | null {
    const after = line.slice(tsEnd, tsEnd + 40);
    const bare = LEVEL_BARE.exec(after);
    if (bare && bare.index <= 12) {
        const lv = LEVEL_ALIAS[bare[1].toLowerCase()];
        if (lv)
            return { level: lv, text: bare[0], end: tsEnd + bare.index + bare[0].length };
    }
    const head = line.slice(0, 160);
    const mk = LEVEL_MARKED.exec(head);
    if (mk) {
        const word = mk[1] ?? mk[2];
        const lv = LEVEL_ALIAS[word.toLowerCase()];
        if (lv)
            return { level: lv, text: word, end: mk.index + mk[0].length };
    }
    return null;
}
function levelFromSeverity(sev: number): LogLevel {
    if (sev <= 2)
        return "fatal";
    if (sev === 3)
        return "error";
    if (sev === 4)
        return "warn";
    if (sev <= 6)
        return "info";
    return "debug";
}
export function normalizeLevel(text: string): LogLevel | null {
    const t = text.trim().toLowerCase();
    if (LEVEL_ALIAS[t])
        return LEVEL_ALIAS[t];
    const n = Number(t);
    if (Number.isFinite(n) && t !== "") {
        if (n >= 10)
            return n >= 60 ? "fatal" : n >= 50 ? "error" : n >= 40 ? "warn" : n >= 30 ? "info" : n >= 20 ? "debug" : "trace";
        if (n >= 0 && n <= 7)
            return levelFromSeverity(n);
    }
    return null;
}
const JSON_TS_KEYS = ["timestamp", "time", "ts", "@timestamp", "eventTime", "date", "datetime", "asctime"];
const JSON_LEVEL_KEYS = ["level", "severity", "lvl", "levelname", "log.level", "levelStr", "loglevel", "severityText"];
const JSON_MSG_KEYS = ["message", "msg", "text", "event", "log", "body", "short_message"];
function escalar(v: unknown): string | null {
    return v != null && (typeof v === "string" || typeof v === "number" || typeof v === "boolean")
        ? String(v) : null;
}
function pick(obj: Record<string, unknown>, keys: string[]): {
    key: string;
    value: string;
} | null {
    const porMinuscula = new Map<string, string>();
    for (const k of Object.keys(obj)) {
        const m = k.toLowerCase();
        if (!porMinuscula.has(m))
            porMinuscula.set(m, k);
    }
    for (const k of keys) {
        const real = porMinuscula.get(k.toLowerCase());
        if (real === undefined)
            continue;
        const v = escalar(obj[real]);
        if (v !== null)
            return { key: real, value: v };
    }
    for (const k of keys) {
        const buscado = k.toLowerCase();
        let mejor: string | null = null, hondo = Infinity;
        for (const real of Object.keys(obj)) {
            const i = real.lastIndexOf(".");
            if (i < 0 || real.slice(i + 1).toLowerCase() !== buscado)
                continue;
            const n = real.split(".").length;
            if (n < hondo && escalar(obj[real]) !== null) {
                mejor = real;
                hondo = n;
            }
        }
        if (mejor !== null)
            return { key: mejor, value: escalar(obj[mejor])! };
    }
    return null;
}
function flatten(obj: unknown, prefix: string, out: Record<string, string>, depth = 0): void {
    if (obj == null || depth > 4)
        return;
    if (typeof obj !== "object") {
        out[prefix] = String(obj);
        return;
    }
    if (Array.isArray(obj)) {
        out[prefix] = JSON.stringify(obj);
        return;
    }
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
        const key = prefix ? `${prefix}.${k}` : k;
        if (v != null && typeof v === "object" && !Array.isArray(v))
            flatten(v, key, out, depth + 1);
        else if (v != null)
            out[key] = typeof v === "object" ? JSON.stringify(v) : String(v);
    }
}
const INLINE_KV = /(?:^|\s)([A-Za-z_][\w.@/-]*)=("(?:[^"\\]|\\.)*"|[^\s]+)/g;
export function inlineFields(msg: string, into: Record<string, string>): void {
    INLINE_KV.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = INLINE_KV.exec(msg)) !== null) {
        let v = m[2];
        if (v.startsWith("\"")) {
            try {
                v = JSON.parse(v) as string;
            }
            catch {
                v = v.slice(1, -1);
            }
        }
        if (into[m[1]] === undefined)
            into[m[1]] = v;
    }
}
export function parseLogfmt(line: string): Record<string, string> | null {
    const out: Record<string, string> = {};
    const re = /([\w.@/-]+)=("(?:[^"\\]|\\.)*"|[^\s]*)/g;
    let m: RegExpExecArray | null;
    let covered = 0;
    while ((m = re.exec(line)) !== null) {
        let v = m[2];
        if (v.startsWith("\"")) {
            try {
                v = JSON.parse(v) as string;
            }
            catch {
                v = v.slice(1, -1);
            }
        }
        out[m[1]] = v;
        covered += m[0].length;
    }
    const keys = Object.keys(out);
    if (keys.length < 2)
        return null;
    return covered / line.trim().length < 0.6 ? null : out;
}
const RFC5424 = /^<(\d{1,3})>1 (\S+) (\S+) (\S+) (\S+) (\S+) (?:-|(\[.*?\](?:\[.*?\])*))\s?([\s\S]*)$/;
const RFC3164 = /^(?:<(\d{1,3})>)?([A-Za-z]{3}\s{1,2}\d{1,2} \d{2}:\d{2}:\d{2}) (\S+) ([^:[\s]+)(?:\[(\d+)\])?:\s?([\s\S]*)$/;
const CLF = /^(\S+) (\S+) (\S+) \[([^\]]+)\] "([^"]*)" (\d{3}) (\S+)(?: "([^"]*)" "([^"]*)")?/;
function parseSd(sd: string): Record<string, string> {
    const out: Record<string, string> = {};
    const blocks = sd.match(/\[[^\]]*\]/g) ?? [];
    for (const b of blocks) {
        const inner = b.slice(1, -1).trim();
        const sp = inner.indexOf(" ");
        const id = sp < 0 ? inner : inner.slice(0, sp);
        if (sp < 0) {
            out[id] = "";
            continue;
        }
        const re = /([\w.@/-]+)="((?:[^"\\]|\\.)*)"/g;
        let m: RegExpExecArray | null;
        while ((m = re.exec(inner.slice(sp))) !== null)
            out[`${id}.${m[1]}`] = m[2].replace(/\\(.)/g, "$1");
    }
    return out;
}
const CONT_MARKS: RegExp[] = [
    /^\s+at\s+\S/,
    /^\s*Caused by:\s/,
    /^\s*Suppressed:\s/,
    /^\s*\.\.\.\s*\d+\s+(more|common frames omitted)/,
    /^\s+File\s+"[^"]*",\s+line\s+\d+/,
    /^\s*Traceback \(most recent call last\):/,
    /^\s+\.{3}\s*$/,
    /^\s+[\w$.]+\([^)]*\)\s*$/,
    /^\s*goroutine \d+ \[/,
    /^\s+\/.*\.go:\d+/,
    /^\s+at\s/,
    /^\s*\^+\s*$/,
];
export function looksLikeContinuation(line: string): boolean {
    if (line === "")
        return false;
    for (const re of CONT_MARKS)
        if (re.test(line))
            return true;
    return /^(\t|\s{2,})\S/.test(line);
}
@Injectable({ providedIn: "root" })
export class LogParseService {
    splitLines(text: string): string[] {
        if (text === "")
            return [];
        const lines = text.split(/\r\n|\n|\r/);
        if (lines.length && lines[lines.length - 1] === "")
            lines.pop();
        return lines;
    }
    detect(lines: string[], eventStart?: RegExp): ParseInfo {
        const cabecera = eventStart ? (l: string) => eventStart.test(l) : (l: string) => !looksLikeContinuation(l);
        const sample = lines.filter(l => l.trim() !== "" && cabecera(l)).slice(0, 200);
        const n = sample.length;
        if (n === 0)
            return { format: "plain", tsPattern: null, tsDateless: false, confidence: 0, anchored: 0 };
        const score: Record<LogFormat, number> = {
            json: 0,
            logfmt: 0,
            syslog5424: 0,
            syslog3164: 0,
            clf: 0,
            combined: 0,
            plain: 0,
        };
        for (const l of sample) {
            const t = l.trim();
            if (t.startsWith("{") && t.endsWith("}")) {
                try {
                    JSON.parse(t);
                    score.json++;
                    continue;
                }
                catch { }
            }
            if (RFC5424.test(l)) {
                score.syslog5424++;
                continue;
            }
            const clf = CLF.exec(l);
            if (clf) {
                if (clf[8] != null)
                    score.combined++;
                else
                    score.clf++;
                continue;
            }
            if (RFC3164.test(l)) {
                score.syslog3164++;
                continue;
            }
            if (parseLogfmt(l)) {
                score.logfmt++;
                continue;
            }
        }
        const web = score.clf + score.combined;
        let format: LogFormat = "plain";
        let hits = 0;
        for (const f of ["json", "syslog5424", "syslog3164", "logfmt"] as LogFormat[]) {
            if (score[f] > hits) {
                hits = score[f];
                format = f;
            }
        }
        if (web > hits) {
            hits = web;
            format = score.combined >= score.clf ? "combined" : "clf";
        }
        const confidence = hits / n;
        if (confidence < 0.5) {
            format = "plain";
        }
        const tally = new Map<string, number>();
        for (const l of sample) {
            const hit = findTs(l);
            if (hit)
                tally.set(hit.id, (tally.get(hit.id) ?? 0) + 1);
        }
        let tsPattern: string | null = null;
        let best = 0;
        for (const [id, c] of tally)
            if (c > best) {
                best = c;
                tsPattern = id;
            }
        if (best / n < 0.34)
            tsPattern = null;
        const anchored = tsPattern ? best / n : 0;
        return {
            format,
            tsPattern,
            tsDateless: !!tsPattern && !!TS_BY_ID.get(tsPattern)?.dateless,
            confidence: format === "plain" ? (tsPattern ? anchored : 0) : confidence,
            anchored,
        };
    }
    parse(text: string, opts: ParseOpts = {}): ParseResult {
        return this.parseLines(this.splitLines(text), opts);
    }
    parseLines(lines: string[], opts: ParseOpts = {}): ParseResult {
        const maxEvents = opts.maxEvents ?? DEFAULT_MAX_EVENTS;
        const maxEventLines = opts.maxEventLines ?? DEFAULT_MAX_EVENT_LINES;
        const info = opts.format
            ? { ...this.detect(lines, opts.eventStart), format: opts.format }
            : this.detect(lines, opts.eventStart);
        const events: LogEvent[] = [];
        let cur: {
            start: number;
            buf: string[];
        } | null = null;
        let truncated = false;
        const flush = () => {
            if (!cur)
                return;
            const ev = this.buildEvent(cur.buf, cur.start + 1, info, opts);
            events.push(ev);
            cur = null;
        };
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (cur && cur.buf.length >= maxEventLines)
                flush();
            const starts = cur === null ? true : this.startsEvent(line, info, opts);
            if (starts) {
                flush();
                if (events.length >= maxEvents) {
                    truncated = true;
                    break;
                }
                cur = { start: i, buf: [line] };
            }
            else {
                cur!.buf.push(line);
            }
        }
        if (!truncated)
            flush();
        else if (cur)
            cur = null;
        return { events, info, lines: lines.length, truncated };
    }
    startsEvent(line: string, info: ParseInfo, opts: ParseOpts = {}): boolean {
        if (line.trim() === "")
            return false;
        if (opts.eventStart)
            return opts.eventStart.test(line);
        if (info.format === "json")
            return line.trimStart().startsWith("{");
        if (looksLikeContinuation(line))
            return false;
        if (info.tsPattern) {
            const hit = findTs(line, info.tsPattern);
            return !!hit && hit.start <= 8;
        }
        if (info.format === "syslog5424")
            return RFC5424.test(line);
        if (info.format === "syslog3164")
            return RFC3164.test(line);
        if (info.format === "clf" || info.format === "combined")
            return CLF.test(line);
        if (info.format === "logfmt")
            return parseLogfmt(line) !== null;
        return true;
    }
    private buildEvent(buf: string[], line: number, info: ParseInfo, opts: ParseOpts): LogEvent {
        const raw = buf.join("\n");
        const head = buf[0];
        const rest = buf.length > 1 ? "\n" + buf.slice(1).join("\n") : "";
        const ev: LogEvent = {
            line,
            span: buf.length,
            raw,
            ts: null,
            tsText: "",
            level: null,
            levelText: "",
            message: head,
            fields: {},
        };
        if (opts.source)
            ev.source = opts.source;
        switch (info.format) {
            case "json":
                this.fillJson(ev, raw, head);
                break;
            case "syslog5424":
                this.fillRfc5424(ev, head);
                break;
            case "syslog3164":
                this.fillRfc3164(ev, head);
                break;
            case "clf":
            case "combined":
                this.fillClf(ev, head);
                break;
            case "logfmt":
                this.fillLogfmt(ev, head);
                break;
            default:
                this.fillPlain(ev, head, info.tsPattern);
                break;
        }
        if (info.format !== "json")
            ev.message += rest;
        if (ev.ts != null && opts.sourceZone && !hasExplicitZone(ev.tsText)) {
            ev.ts = wallToUtc(ev.ts, opts.sourceZone);
        }
        if (ev.ts != null && opts.offsetMs)
            ev.ts += opts.offsetMs;
        if (ev.ts != null && !isUsableInstant(ev.ts))
            ev.ts = null;
        return ev;
    }
    private fillPlain(ev: LogEvent, head: string, tsPattern: string | null): void {
        const ts = findTs(head, tsPattern);
        let cut = 0;
        if (ts) {
            ev.ts = ts.ts;
            ev.tsText = ts.text;
            cut = ts.end;
        }
        const lv = findLevel(head, cut);
        if (lv) {
            ev.level = lv.level;
            ev.levelText = lv.text;
            cut = Math.max(cut, lv.end);
        }
        ev.message = head.slice(cut).replace(/^[\s\-|:\]]+/, "");
        if (ev.message === "")
            ev.message = head.trim();
        inlineFields(ev.message, ev.fields);
    }
    private fillJson(ev: LogEvent, raw: string, head: string): void {
        let obj: Record<string, unknown> | null = null;
        try {
            const parsed: unknown = JSON.parse(raw.trim());
            if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
                obj = parsed as Record<string, unknown>;
        }
        catch {
            obj = null;
        }
        if (!obj) {
            this.fillPlain(ev, head, null);
            return;
        }
        const flat: Record<string, string> = {};
        flatten(obj, "", flat);
        const t = pick(obj, JSON_TS_KEYS) ?? pick(flat as Record<string, unknown>, JSON_TS_KEYS);
        if (t) {
            ev.tsText = t.value;
            const n = Number(t.value);
            if (Number.isFinite(n) && /^\d+(\.\d+)?$/.test(t.value))
                ev.ts = t.value.length <= 11 ? n * 1000 : n;
            else {
                const p = Date.parse(t.value);
                ev.ts = Number.isNaN(p) ? null : p;
            }
            delete flat[t.key];
        }
        const l = pick(obj, JSON_LEVEL_KEYS) ?? pick(flat as Record<string, unknown>, JSON_LEVEL_KEYS);
        if (l) {
            ev.levelText = l.value;
            ev.level = normalizeLevel(l.value);
            delete flat[l.key];
        }
        const m = pick(obj, JSON_MSG_KEYS) ?? pick(flat as Record<string, unknown>, JSON_MSG_KEYS);
        if (m) {
            ev.message = m.value;
            delete flat[m.key];
        }
        else {
            ev.message = head;
        }
        for (const k of ["stack", "stack_trace", "stacktrace", "exception", "error.stack_trace"]) {
            if (flat[k]) {
                ev.message += "\n" + flat[k];
                delete flat[k];
            }
        }
        ev.fields = flat;
    }
    private fillRfc5424(ev: LogEvent, head: string): void {
        const m = RFC5424.exec(head);
        if (!m) {
            this.fillPlain(ev, head, null);
            return;
        }
        const pri = +m[1];
        ev.level = levelFromSeverity(pri % 8);
        ev.levelText = `<${m[1]}>`;
        ev.tsText = m[2];
        const p = Date.parse(m[2]);
        ev.ts = Number.isNaN(p) ? null : p;
        ev.fields = {
            host: m[3],
            app: m[4],
            procid: m[5],
            msgid: m[6],
            "syslog.facility": String(Math.floor(pri / 8)),
            "syslog.severity": String(pri % 8),
        };
        if (m[7])
            Object.assign(ev.fields, parseSd(m[7]));
        ev.message = m[8] ?? "";
        inlineFields(ev.message, ev.fields);
    }
    private fillRfc3164(ev: LogEvent, head: string): void {
        const m = RFC3164.exec(head);
        if (!m) {
            this.fillPlain(ev, head, null);
            return;
        }
        if (m[1] != null) {
            const pri = +m[1];
            ev.level = levelFromSeverity(pri % 8);
            ev.levelText = `<${m[1]}>`;
            ev.fields["syslog.facility"] = String(Math.floor(pri / 8));
            ev.fields["syslog.severity"] = String(pri % 8);
        }
        ev.tsText = m[2];
        const hit = findTs(m[2], "bsd");
        ev.ts = hit?.ts ?? null;
        ev.fields["host"] = m[3];
        ev.fields["app"] = m[4];
        if (m[5])
            ev.fields["pid"] = m[5];
        ev.message = m[6] ?? "";
        if (!ev.level) {
            const lv = findLevel(ev.message, 0);
            if (lv) {
                ev.level = lv.level;
                ev.levelText = lv.text;
            }
        }
        inlineFields(ev.message, ev.fields);
    }
    private fillClf(ev: LogEvent, head: string): void {
        const m = CLF.exec(head);
        if (!m) {
            this.fillPlain(ev, head, null);
            return;
        }
        ev.tsText = m[4];
        ev.ts = findTs(m[4], "clf")?.ts ?? null;
        const status = +m[6];
        ev.level = status >= 500 ? "error" : status >= 400 ? "warn" : "info";
        ev.levelText = m[6];
        ev.fields = { host: m[1], ident: m[2], user: m[3], request: m[5], status: m[6], size: m[7] };
        if (m[8] != null) {
            ev.fields["referer"] = m[8];
            ev.fields["agent"] = m[9];
        }
        ev.message = `${m[5]} → ${m[6]}`;
    }
    private fillLogfmt(ev: LogEvent, head: string): void {
        const f = parseLogfmt(head);
        if (!f) {
            this.fillPlain(ev, head, null);
            return;
        }
        const fields = { ...f };
        for (const k of JSON_TS_KEYS) {
            if (fields[k] != null) {
                ev.tsText = fields[k];
                const p = Date.parse(fields[k]);
                ev.ts = Number.isNaN(p) ? (findTs(fields[k])?.ts ?? null) : p;
                delete fields[k];
                break;
            }
        }
        for (const k of JSON_LEVEL_KEYS) {
            if (fields[k] != null) {
                ev.levelText = fields[k];
                ev.level = normalizeLevel(fields[k]);
                delete fields[k];
                break;
            }
        }
        let msg: string | null = null;
        for (const k of JSON_MSG_KEYS)
            if (fields[k] != null) {
                msg = fields[k];
                delete fields[k];
                break;
            }
        ev.message = msg ?? head;
        ev.fields = fields;
    }
    merge(sources: {
        name: string;
        events: LogEvent[];
    }[]): LogEvent[] {
        return this.mergeReport(sources).events;
    }
    mergeReport(sources: {
        name: string;
        events: LogEvent[];
    }[]): {
        events: LogEvent[];
        undated: string[];
    } {
        const dated: {
            ev: LogEvent;
            key: number;
            src: number;
            seq: number;
        }[] = [];
        const tail: LogEvent[] = [];
        const undated: string[] = [];
        sources.forEach((s, si) => {
            const first = s.events.find(e => e.ts != null)?.ts;
            if (first == null) {
                if (s.events.length)
                    undated.push(s.name);
                tail.push(...s.events.map(ev => ({ ...ev, source: s.name })));
                return;
            }
            let last = first;
            s.events.forEach((ev, i) => {
                if (ev.ts != null)
                    last = ev.ts;
                dated.push({ ev: { ...ev, source: s.name }, key: ev.ts ?? last, src: si, seq: i });
            });
        });
        dated.sort((a, b) => a.key - b.key || a.src - b.src || a.seq - b.seq);
        return { events: [...dated.map(x => x.ev), ...tail], undated };
    }
    stats(events: LogEvent[]): LogStats {
        const byLevel = { trace: 0, debug: 0, info: 0, warn: 0, error: 0, fatal: 0 } as Record<LogLevel, number>;
        let unknown = 0, dated = 0, min = Infinity, max = -Infinity, multiline = 0, rawLines = 0;
        for (const e of events) {
            if (e.level)
                byLevel[e.level]++;
            else
                unknown++;
            if (e.ts != null) {
                dated++;
                if (e.ts < min)
                    min = e.ts;
                if (e.ts > max)
                    max = e.ts;
            }
            if (e.span > 1)
                multiline++;
            rawLines += e.span;
        }
        return {
            events: events.length,
            rawLines,
            byLevel,
            unknown,
            dated,
            multiline,
            min: dated ? min : null,
            max: dated ? max : null,
        };
    }
}
export interface LogStats {
    events: number;
    rawLines: number;
    byLevel: Record<LogLevel, number>;
    unknown: number;
    dated: number;
    multiline: number;
    min: number | null;
    max: number | null;
}
