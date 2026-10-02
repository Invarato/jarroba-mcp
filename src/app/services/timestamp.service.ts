export interface TimestampResult {
    unix: number;
    iso: string;
    local: string;
    utc: string;
}
export type ParseKind = "unix-s" | "unix-ms" | "unix-us" | "unix-ns" | "discord" | "x" | "filetime" | "dotnet" | "excel" | "uuid-v1" | "uuid-v6" | "uuid-v7" | "ulid" | "objectid" | "iso-utc" | "iso-offset" | "iso-local" | "date-only" | "rfc2822" | "http-date" | "fallback";
export type UnixUnit = "auto" | "s" | "ms" | "us" | "ns" | "discord" | "x" | "filetime" | "dotnet" | "excel";
export type SinFecha = "uuid-v3" | "uuid-v4" | "uuid-v5" | "uuid-v8" | "uuid-nil";
export interface Lectura {
    unit: Exclude<UnixUnit, "auto">;
    unixMs: number;
}
export interface ParsedInstant {
    unixMs: number;
    kind: ParseKind;
    assumedUtc: boolean;
    ambiguous: boolean;
    exactNs?: bigint;
    dst?: {
        tipo: "inexistente" | "doble";
        pedida: string;
        tomada: string;
    };
}
export type FormatGroup = "unix" | "iso" | "human" | "log" | "lang";
export interface FormatItem {
    key: string;
    value: string;
    group: FormatGroup;
}
const MS_PER_DAY = 86400000;
const NET_TICKS_AT_EPOCH = 621355968000000000n;
const FILETIME_AT_EPOCH = 116444736000000000n;
const INT32_MAX = 2147483647;
const RE_INT = /^[+-]?\d+$/;
const RE_DEC = /^\d+\.\d+$/;
const RE_UUID = /^([0-9a-f]{8})-([0-9a-f]{4})-([0-9a-f])([0-9a-f]{3})-([0-9a-f]{4})-([0-9a-f]{12})$/i;
const RE_ULID = /^[0-9A-HJKMNP-TV-Z]{26}$/i;
const RE_OBJECTID = /^[0-9a-f]{24}$/i;
const DISCORD_EPOCH = 1420070400000n;
const X_EPOCH = 1288834974657n;
const UUID_GREGORIAN_AT_EPOCH = 122192928000000000n;
const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const RE_DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const RE_ISO_UTC = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?(\.\d+)?Z$/i;
const RE_ISO_OFF = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?(\.\d+)?[+-]\d{2}:?\d{2}$/;
const RE_ISO_LOCAL = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?(\.\d+)?$/;
const RE_RFC2822 = /^[A-Za-z]{3},?\s+\d{1,2}\s+[A-Za-z]{3}\s+\d{2,4}/;
export class TimestampService {
    fromUnix(unix: number): TimestampResult | null {
        if (!isFinite(unix))
            return null;
        return this.toLegacy(new Date(unix * 1000), unix);
    }
    fromDateString(str: string): TimestampResult | null {
        const date = new Date(str);
        if (isNaN(date.getTime()))
            return null;
        return this.toLegacy(date, Math.floor(date.getTime() / 1000));
    }
    now(): TimestampResult {
        const now = new Date();
        return this.toLegacy(now, Math.floor(now.getTime() / 1000));
    }
    private toLegacy(date: Date, unix: number): TimestampResult {
        return { unix, iso: date.toISOString(), local: date.toLocaleString("es"), utc: date.toUTCString() };
    }
    parse(input: string, unit: UnixUnit = "auto"): ParsedInstant | null {
        const s = (input ?? "").trim();
        if (!s)
            return null;
        const id = this.parseId(s);
        if (id)
            return id;
        if (RE_DEC.test(s) && (unit === "auto" || unit === "s" || unit === "excel")) {
            const [ent, dec] = s.split(".");
            const esExcel = unit === "excel" || (unit === "auto" && ent.length <= 6);
            if (esExcel) {
                const unixMs = (Number(s) - 25569) * MS_PER_DAY;
                return isFinite(unixMs) ? { unixMs, kind: "excel", assumedUtc: true, ambiguous: true } : null;
            }
            const exactNs = BigInt(ent) * 1000000000n + BigInt(dec.slice(0, 9).padEnd(9, "0"));
            return { unixMs: Number(exactNs) / 1000000, kind: "unix-s", assumedUtc: true, ambiguous: false, exactNs };
        }
        if (RE_INT.test(s) && ["discord", "x", "filetime", "dotnet", "excel"].includes(unit)) {
            return this.leerComo(BigInt(s), unit as "discord" | "x" | "filetime" | "dotnet" | "excel");
        }
        if (RE_INT.test(s)) {
            const detected = (unit === "auto" ? this.detectUnit(s) : unit) as "s" | "ms" | "us" | "ns";
            const factor = { s: 1000000000n, ms: 1000000n, us: 1000n, ns: 1n }[detected] ?? 1000000000n;
            const exactNs = BigInt(s) * factor;
            const unixMs = Number(exactNs) / 1000000;
            if (!isFinite(unixMs) || Math.abs(unixMs) > 8640000000000000)
                return null;
            return { unixMs, kind: `unix-${detected}` as ParseKind, assumedUtc: true, ambiguous: false, exactNs };
        }
        const date = new Date(s);
        if (isNaN(date.getTime()))
            return null;
        const unixMs = date.getTime();
        const frac = /[T ]\d{2}:\d{2}:\d{2}\.(\d{4,9})/.exec(s)?.[1];
        const exactNs = frac ? BigInt(unixMs) * 1000000n + BigInt(frac.slice(3).padEnd(6, "0")) : undefined;
        const conNs = <T extends object>(o: T) => (exactNs !== undefined ? { ...o, exactNs } : o);
        if (RE_DATE_ONLY.test(s))
            return { unixMs, kind: "date-only", assumedUtc: true, ambiguous: true };
        if (RE_ISO_UTC.test(s))
            return conNs({ unixMs, kind: "iso-utc" as ParseKind, assumedUtc: true, ambiguous: false });
        if (RE_ISO_OFF.test(s))
            return conNs({ unixMs, kind: "iso-offset" as ParseKind, assumedUtc: false, ambiguous: false });
        if (RE_ISO_LOCAL.test(s)) {
            const dst = this.cambioDeHora(s, date);
            return conNs({ unixMs, kind: "iso-local" as ParseKind, assumedUtc: false, ambiguous: true, ...(dst ? { dst } : {}) });
        }
        if (RE_RFC2822.test(s))
            return { unixMs, kind: "rfc2822", assumedUtc: false, ambiguous: false };
        return { unixMs, kind: "fallback", assumedUtc: false, ambiguous: true };
    }
    private leerComo(v: bigint, unit: "discord" | "x" | "filetime" | "dotnet" | "excel"): ParsedInstant | null {
        let exactNs: bigint;
        switch (unit) {
            case "discord":
                if (v < 0n)
                    return null;
                exactNs = ((v >> 22n) + DISCORD_EPOCH) * 1000000n;
                break;
            case "x":
                if (v < 0n)
                    return null;
                exactNs = ((v >> 22n) + X_EPOCH) * 1000000n;
                break;
            case "filetime":
                exactNs = (v - FILETIME_AT_EPOCH) * 100n;
                break;
            case "dotnet":
                exactNs = (v - NET_TICKS_AT_EPOCH) * 100n;
                break;
            case "excel":
                exactNs = (v - 25569n) * BigInt(MS_PER_DAY) * 1000000n;
                break;
        }
        const unixMs = Number(exactNs) / 1000000;
        if (!isFinite(unixMs) || Math.abs(unixMs) > 8640000000000000)
            return null;
        return { unixMs, kind: unit, assumedUtc: true, ambiguous: unit === "excel", exactNs };
    }
    private parseId(s: string): ParsedInstant | null {
        const u = RE_UUID.exec(s);
        if (u) {
            const [, low, mid, ver, hi3] = u;
            let exactNs: bigint;
            if (ver === "7")
                exactNs = BigInt("0x" + low + mid) * 1000000n;
            else if (ver === "1")
                exactNs = (BigInt("0x" + hi3 + mid + low) - UUID_GREGORIAN_AT_EPOCH) * 100n;
            else if (ver === "6")
                exactNs = (BigInt("0x" + low + mid + hi3) - UUID_GREGORIAN_AT_EPOCH) * 100n;
            else
                return null;
            return { unixMs: Number(exactNs) / 1000000, kind: `uuid-v${ver}` as ParseKind, assumedUtc: true, ambiguous: false, exactNs };
        }
        if (RE_ULID.test(s)) {
            let ms = 0n;
            for (const c of s.slice(0, 10).toUpperCase())
                ms = ms * 32n + BigInt(CROCKFORD.indexOf(c));
            return { unixMs: Number(ms), kind: "ulid", assumedUtc: true, ambiguous: false, exactNs: ms * 1000000n };
        }
        if (RE_OBJECTID.test(s)) {
            const sec = BigInt("0x" + s.slice(0, 8));
            return { unixMs: Number(sec) * 1000, kind: "objectid", assumedUtc: true, ambiguous: false, exactNs: sec * 1000000000n };
        }
        return null;
    }
    sinFecha(input: string): SinFecha | null {
        const u = RE_UUID.exec((input ?? "").trim());
        if (!u)
            return null;
        if (/^0{8}-0{4}-0{4}-0{4}-0{12}$/.test(input.trim()))
            return "uuid-nil";
        return ({ "3": "uuid-v3", "4": "uuid-v4", "5": "uuid-v5", "8": "uuid-v8" } as Record<string, SinFecha>)[u[3]] ?? null;
    }
    lecturas(input: string): Lectura[] {
        const s = (input ?? "").trim();
        if (!RE_INT.test(s) && !RE_DEC.test(s))
            return [];
        const MIN = Date.UTC(1990, 0, 1), MAX = Date.UTC(2100, 0, 1), MIN_XL = Date.UTC(1900, 0, 1);
        const units: Exclude<UnixUnit, "auto">[] = RE_DEC.test(s) ? ["s", "excel"] : ["s", "ms", "us", "ns", "discord", "x", "filetime", "dotnet", "excel"];
        const digitos = s.replace(/^[+-]/, "").split(".")[0].length;
        const LARGO: Partial<Record<Exclude<UnixUnit, "auto">, [
            number,
            number
        ]>> = {
            discord: [17, 19],
            x: [17, 19],
            filetime: [18, 18],
            dotnet: [18, 18],
            excel: [1, 6],
        };
        const out: Lectura[] = [];
        for (const unit of units) {
            const l = LARGO[unit];
            if (l && (digitos < l[0] || digitos > l[1]))
                continue;
            const p = this.parse(s, unit);
            if (!p)
                continue;
            const min = unit === "excel" ? MIN_XL : MIN;
            if (p.unixMs >= min && p.unixMs < MAX)
                out.push({ unit, unixMs: p.unixMs });
        }
        return out;
    }
    private cambioDeHora(s: string, d: Date): ParsedInstant["dst"] | undefined {
        const m = /[T ](\d{2}):(\d{2})/.exec(s);
        if (!m)
            return undefined;
        const pedida = `${m[1]}:${m[2]}`;
        const reloj = (x: Date) => `${this.pad(x.getHours())}:${this.pad(x.getMinutes())}`;
        const tomada = reloj(d);
        if (tomada !== pedida)
            return { tipo: "inexistente", pedida, tomada };
        const otra = new Date(d.getTime() + 3600000);
        if (reloj(otra) === pedida && otra.getDate() === d.getDate())
            return { tipo: "doble", pedida, tomada };
        return undefined;
    }
    detectUnit(intStr: string): Exclude<UnixUnit, "auto"> {
        const digits = intStr.replace(/^[+-]/, "").length;
        if (digits <= 11)
            return "s";
        if (digits <= 14)
            return "ms";
        if (digits <= 17)
            return "us";
        return "ns";
    }
    formats(unixMs: number, locale = "es", exactNs?: bigint): FormatItem[] {
        const d = new Date(unixMs);
        const ns = exactNs ?? BigInt(Math.round(unixMs)) * 1000000n;
        const div = (a: bigint, b: bigint) => (a >= 0n ? a / b : -((-a + b - 1n) / b));
        const secBig = div(ns, 1000000000n);
        const msBig = exactNs !== undefined ? div(ns, 1000000n) : BigInt(Math.round(unixMs));
        const fracNs = ns - secBig * 1000000000n;
        const frac9 = fracNs.toString().padStart(9, "0");
        const frac = exactNs !== undefined && frac9.slice(3) !== "000000" ? (frac9.slice(6) === "000" ? frac9.slice(0, 6) : frac9) : frac9.slice(0, 3);
        const isoUtc = d.toISOString().replace(/\.\d{3}Z$/, `.${frac}Z`);
        const items: FormatItem[] = [
            { key: "unix-s", group: "unix", value: secBig.toString() },
            { key: "unix-ms", group: "unix", value: msBig.toString() },
            { key: "unix-us", group: "unix", value: div(ns, 1000n).toString() },
            { key: "unix-ns", group: "unix", value: ns.toString() },
            { key: "iso-utc", group: "iso", value: isoUtc },
            { key: "iso-local", group: "iso", value: this.isoWithOffset(d, d.getMilliseconds() !== 0) },
            { key: "rfc2822", group: "iso", value: this.rfc2822(d) },
            { key: "http-date", group: "iso", value: d.toUTCString() },
            { key: "sql", group: "iso", value: this.sqlUtc(d) },
            { key: "local", group: "human", value: d.toLocaleString(locale) },
            { key: "date-str", group: "human", value: d.toString() },
            { key: "utc-str", group: "human", value: d.toUTCString() },
            { key: "syslog-3164", group: "log", value: this.syslog3164(d) },
            { key: "syslog-5424", group: "log", value: this.isoWithOffset(d, true) },
            { key: "excel", group: "log", value: (unixMs / MS_PER_DAY + 25569).toString() },
            { key: "filetime", group: "log", value: (msBig * 10000n + FILETIME_AT_EPOCH).toString() },
            { key: "dotnet", group: "log", value: (msBig * 10000n + NET_TICKS_AT_EPOCH).toString() },
            { key: "objectid", group: "log", value: this.objectIdPrefix(secBig) },
            { key: "java", group: "lang", value: String(Math.round(unixMs)) + "L" },
            { key: "go-rfc", group: "lang", value: exactNs !== undefined ? this.isoWithOffset(d, true).replace(/\.\d{3}(?=[+-])/, `.${frac}`) : this.isoWithOffset(d, true) },
            { key: "py-iso", group: "lang", value: d.toISOString().replace("Z", "+00:00") },
        ];
        return items;
    }
    relative(unixMs: number, nowMs: number, locale = "es"): string {
        const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
        const diffSec = Math.round((unixMs - nowMs) / 1000);
        const abs = Math.abs(diffSec);
        const units: [
            Intl.RelativeTimeFormatUnit,
            number
        ][] = [
            ["year", 31536000],
            ["month", 2592000],
            ["week", 604800],
            ["day", 86400],
            ["hour", 3600],
            ["minute", 60],
            ["second", 1],
        ];
        for (const [unit, secs] of units) {
            if (abs >= secs || unit === "second")
                return rtf.format(Math.round(diffSec / secs), unit);
        }
        return rtf.format(0, "second");
    }
    isYear2038Unsafe(unixMs: number): boolean {
        const sec = Math.floor(unixMs / 1000);
        return sec > INT32_MAX || sec < -INT32_MAX - 1;
    }
    private pad(n: number, w = 2): string { return String(Math.abs(n)).padStart(w, "0"); }
    private isoWithOffset(d: Date, withMs: boolean): string {
        const off = -d.getTimezoneOffset();
        const sign = off >= 0 ? "+" : "-";
        const ms = withMs ? "." + this.pad(d.getMilliseconds(), 3) : "";
        return `${d.getFullYear()}-${this.pad(d.getMonth() + 1)}-${this.pad(d.getDate())}` +
            `T${this.pad(d.getHours())}:${this.pad(d.getMinutes())}:${this.pad(d.getSeconds())}${ms}` +
            `${sign}${this.pad(Math.floor(Math.abs(off) / 60))}:${this.pad(Math.abs(off) % 60)}`;
    }
    private rfc2822(d: Date): string {
        const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        const mon = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const off = -d.getTimezoneOffset();
        const sign = off >= 0 ? "+" : "-";
        return `${days[d.getDay()]}, ${this.pad(d.getDate())} ${mon[d.getMonth()]} ${d.getFullYear()} ` +
            `${this.pad(d.getHours())}:${this.pad(d.getMinutes())}:${this.pad(d.getSeconds())} ` +
            `${sign}${this.pad(Math.floor(Math.abs(off) / 60))}${this.pad(Math.abs(off) % 60)}`;
    }
    private sqlUtc(d: Date): string {
        return `${d.getUTCFullYear()}-${this.pad(d.getUTCMonth() + 1)}-${this.pad(d.getUTCDate())} ` +
            `${this.pad(d.getUTCHours())}:${this.pad(d.getUTCMinutes())}:${this.pad(d.getUTCSeconds())}`;
    }
    private syslog3164(d: Date): string {
        const mon = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const day = String(d.getDate()).padStart(2, " ");
        return `${mon[d.getMonth()]} ${day} ${this.pad(d.getHours())}:${this.pad(d.getMinutes())}:${this.pad(d.getSeconds())}`;
    }
    private objectIdPrefix(sec: bigint): string {
        const hex = (sec < 0n ? 0n : sec).toString(16).padStart(8, "0").slice(-8);
        return hex + "0000000000000000";
    }
    offsetMinutes(unixMs: number, tz: string): number {
        const dtf = new Intl.DateTimeFormat("en-US", {
            timeZone: tz,
            hourCycle: "h23",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
        });
        const m: Record<string, string> = {};
        for (const p of dtf.formatToParts(new Date(unixMs)))
            m[p.type] = p.value;
        const hour = m["hour"] === "24" ? 0 : Number(m["hour"]);
        const asUtc = Date.UTC(+m["year"], +m["month"] - 1, +m["day"], hour, +m["minute"], +m["second"]);
        return Math.round((asUtc - unixMs) / 60000);
    }
    private offsetLabel(min: number): string {
        const sign = min >= 0 ? "+" : "-";
        const a = Math.abs(min);
        return `${sign}${this.pad(Math.floor(a / 60))}:${this.pad(a % 60)}`;
    }
    zoneInfo(unixMs: number, tz: string, locale = "es"): ZoneInfo {
        const offset = this.offsetMinutes(unixMs, tz);
        const date = new Date(unixMs);
        let abbrev = "";
        try {
            const part = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "short" })
                .formatToParts(date).find(p => p.type === "timeZoneName");
            abbrev = part?.value ?? "";
        }
        catch { }
        let wall = "";
        try {
            wall = new Intl.DateTimeFormat(locale, {
                timeZone: tz,
                dateStyle: "medium",
                timeStyle: "medium",
            }).format(date);
        }
        catch { }
        const y = new Date(unixMs).getUTCFullYear();
        const jan = this.offsetMinutes(Date.UTC(y, 0, 1), tz);
        const jul = this.offsetMinutes(Date.UTC(y, 6, 1), tz);
        const isDST = offset > Math.min(jan, jul);
        return { tz, offsetMinutes: offset, offsetLabel: this.offsetLabel(offset), abbrev, isDST, wall };
    }
    nextTransition(unixMs: number, tz: string): ZoneTransition | null {
        const DAY = 86400000;
        const end = unixMs + 400 * DAY;
        const prev = this.offsetMinutes(unixMs, tz);
        let t = unixMs;
        while (t < end) {
            const next = Math.min(t + DAY, end);
            if (this.offsetMinutes(next, tz) !== prev) {
                let lo = t, hi = next;
                while (hi - lo > 1000) {
                    const mid = Math.floor((lo + hi) / 2);
                    if (this.offsetMinutes(mid, tz) === prev)
                        lo = mid;
                    else
                        hi = mid;
                }
                return { atMs: hi, fromOffsetMinutes: prev, toOffsetMinutes: this.offsetMinutes(hi, tz) };
            }
            t = next;
        }
        return null;
    }
    solarPosition(unixMs: number): SolarPosition {
        const d = new Date(unixMs);
        const dayStart = Date.UTC(d.getUTCFullYear(), 0, 0);
        const dayOfYear = (unixMs - dayStart) / 86400000;
        const decl = -23.44 * Math.cos((2 * Math.PI / 365) * (dayOfYear + 10));
        const utcHours = d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600;
        let lon = -15 * (utcHours - 12);
        lon = ((lon + 540) % 360) - 180;
        return { subsolarLon: lon, subsolarLat: decl };
    }
    terminator(unixMs: number, stepDeg = 4): Terminator {
        const paso = Number.isFinite(stepDeg) && stepDeg > 0 ? Math.min(Math.max(stepDeg, 0.1), 180) : 4;
        const { subsolarLon, subsolarLat } = this.solarPosition(unixMs);
        const decl = Math.abs(subsolarLat) < 0.5 ? (subsolarLat < 0 ? -0.5 : 0.5) : subsolarLat;
        const tanDecl = Math.tan(decl * Math.PI / 180);
        const points: {
            lon: number;
            lat: number;
        }[] = [];
        for (let lon = -180; lon <= 180; lon += paso) {
            const H = (lon - subsolarLon) * Math.PI / 180;
            let lat = Math.atan(-Math.cos(H) / tanDecl) * 180 / Math.PI;
            lat = Math.max(-89.9, Math.min(89.9, lat));
            points.push({ lon, lat });
        }
        return { subsolarLon, subsolarLat, points, nightSouth: subsolarLat >= 0 };
    }
    zoneCoord(tz: string, unixMs: number): [
        number,
        number
    ] {
        const known = ZONE_COORDS[tz];
        if (known)
            return known;
        if (tz === "UTC" || tz === "Etc/UTC")
            return [0, 0];
        const lon = Math.max(-179, Math.min(179, (this.offsetMinutes(unixMs, tz) / 60) * 15));
        return [lon, 0];
    }
    nearestZone(lon: number, lat: number): string {
        let best = "UTC", bestD = Infinity;
        for (const [tz, [zl, za]] of Object.entries(ZONE_COORDS)) {
            let dl = Math.abs(zl - lon);
            if (dl > 180)
                dl = 360 - dl;
            const d = dl * dl + (za - lat) * (za - lat);
            if (d < bestD) {
                bestD = d;
                best = tz;
            }
        }
        return best;
    }
    localZone(): string {
        try {
            return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
        }
        catch {
            return "UTC";
        }
    }
    formatPattern(unixMs: number, pattern: string, tz: string, locale = "es", dialect: FormatDialect = "ldml"): string {
        let ldml = pattern;
        if (dialect === "strftime") {
            ldml = pattern.replace(/%:z|%[A-Za-z%]/g, m => STRFTIME_TO_LDML[m] ?? m);
        }
        const offMin = this.offsetMinutes(unixMs, tz);
        const wall = new Date(unixMs + offMin * 60000);
        const real = new Date(unixMs);
        const y = wall.getUTCFullYear(), mon = wall.getUTCMonth() + 1, day = wall.getUTCDate();
        const h24 = wall.getUTCHours(), min = wall.getUTCMinutes(), sec = wall.getUTCSeconds(), ms = wall.getUTCMilliseconds();
        const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
        const name = (opt: Intl.DateTimeFormatOptions): string => {
            try {
                return new Intl.DateTimeFormat(locale, { ...opt, timeZone: tz }).format(real);
            }
            catch {
                return "";
            }
        };
        const values: Record<string, string> = {
            yyyy: String(y).padStart(4, "0"),
            yy: String(y % 100).padStart(2, "0"),
            MMMM: name({ month: "long" }),
            MMM: name({ month: "short" }),
            MM: this.pad(mon),
            M: String(mon),
            dd: this.pad(day),
            d: String(day),
            EEEE: name({ weekday: "long" }),
            EEE: name({ weekday: "short" }),
            HH: this.pad(h24),
            H: String(h24),
            hh: this.pad(h12),
            h: String(h12),
            mm: this.pad(min),
            m: String(min),
            ss: this.pad(sec),
            s: String(sec),
            SSS: String(ms).padStart(3, "0"),
            a: h24 < 12 ? "AM" : "PM",
            XXX: offMin === 0 ? "Z" : this.offsetLabel(offMin),
            xx: (offMin >= 0 ? "+" : "-") + this.pad(Math.floor(Math.abs(offMin) / 60)) + this.pad(Math.abs(offMin) % 60),
            zzz: name({ timeZoneName: "short" }).split(" ").pop() ?? "",
        };
        return ldml.replace(LDML_RE, (m, tok) => tok ? (values[tok] ?? m) : m.slice(1, -1));
    }
    allZones(): string[] {
        const anyIntl = Intl as unknown as {
            supportedValuesOf?: (k: string) => string[];
        };
        if (typeof anyIntl.supportedValuesOf === "function") {
            try {
                return anyIntl.supportedValuesOf("timeZone");
            }
            catch { }
        }
        return COMMON_ZONES;
    }
}
export interface ZoneInfo {
    tz: string;
    offsetMinutes: number;
    offsetLabel: string;
    abbrev: string;
    isDST: boolean;
    wall: string;
}
export interface ZoneTransition {
    atMs: number;
    fromOffsetMinutes: number;
    toOffsetMinutes: number;
}
export const COMMON_ZONES = [
    "UTC",
    "Europe/Madrid",
    "Europe/London",
    "Europe/Berlin",
    "Europe/Moscow",
    "America/New_York",
    "America/Chicago",
    "America/Denver",
    "America/Los_Angeles",
    "America/Sao_Paulo",
    "America/Mexico_City",
    "Asia/Kolkata",
    "Asia/Shanghai",
    "Asia/Tokyo",
    "Asia/Dubai",
    "Australia/Sydney",
    "Pacific/Auckland",
];
export type FormatDialect = "ldml" | "strftime";
const STRFTIME_TO_LDML: Record<string, string> = {
    "%Y": "yyyy",
    "%y": "yy",
    "%m": "MM",
    "%B": "MMMM",
    "%b": "MMM",
    "%d": "dd",
    "%e": "d",
    "%H": "HH",
    "%I": "hh",
    "%M": "mm",
    "%S": "ss",
    "%p": "a",
    "%A": "EEEE",
    "%a": "EEE",
    "%z": "xx",
    "%:z": "XXX",
    "%L": "SSS",
    "%%": "'%'",
};
export const DATE_REGEXES: {
    key: string;
    pattern: string;
}[] = [
    { key: "iso-date", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
    { key: "iso-datetime", pattern: "^\\d{4}-\\d{2}-\\d{2}[T ]\\d{2}:\\d{2}(:\\d{2})?(\\.\\d+)?(Z|[+-]\\d{2}:?\\d{2})?$" },
    { key: "time-hm", pattern: "^([01]\\d|2[0-3]):[0-5]\\d$" },
    { key: "time-hms", pattern: "^([01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d$" },
    { key: "us-date", pattern: "^(0?[1-9]|1[0-2])/(0?[1-9]|[12]\\d|3[01])/\\d{4}$" },
    { key: "eu-date", pattern: "^(0?[1-9]|[12]\\d|3[01])/(0?[1-9]|1[0-2])/\\d{4}$" },
    { key: "unix-10", pattern: "^\\d{10}$" },
    { key: "unix-13", pattern: "^\\d{13}$" },
];
const LDML_TOKENS = ["yyyy", "MMMM", "EEEE", "yy", "MMM", "EEE", "SSS", "XXX", "MM", "dd", "HH", "hh", "mm", "ss", "xx", "M", "d", "H", "h", "m", "s", "a", "zzz"];
const LDML_RE = new RegExp(`'[^']*'|(${LDML_TOKENS.join("|")})`, "g");
export interface FormatToken {
    token: string;
    desc: string;
}
export interface SolarPosition {
    subsolarLon: number;
    subsolarLat: number;
}
export interface Terminator {
    subsolarLon: number;
    subsolarLat: number;
    points: {
        lon: number;
        lat: number;
    }[];
    nightSouth: boolean;
}
export const ZONE_COORDS: Record<string, [
    number,
    number
]> = {
    "Europe/Madrid": [-3.7, 40.4],
    "Europe/London": [-0.1, 51.5],
    "Europe/Berlin": [13.4, 52.5],
    "Europe/Paris": [2.3, 48.9],
    "Europe/Moscow": [37.6, 55.8],
    "Europe/Malta": [14.5, 35.9],
    "Europe/Istanbul": [28.9, 41],
    "Europe/Athens": [23.7, 38],
    "Europe/Rome": [12.5, 41.9],
    "Europe/Lisbon": [-9.1, 38.7],
    "Atlantic/Reykjavik": [-21.9, 64.1],
    "America/New_York": [-74, 40.7],
    "America/Chicago": [-87.6, 41.9],
    "America/Denver": [-105, 39.7],
    "America/Los_Angeles": [-118.2, 34.1],
    "America/Sao_Paulo": [-46.6, -23.5],
    "America/Mexico_City": [-99.1, 19.4],
    "America/Bogota": [-74.1, 4.6],
    "America/Argentina/Buenos_Aires": [-58.4, -34.6],
    "America/Toronto": [-79.4, 43.7],
    "America/Vancouver": [-123.1, 49.3],
    "America/Anchorage": [-149.9, 61.2],
    "America/Lima": [-77, -12],
    "America/Santiago": [-70.6, -33.4],
    "Asia/Kolkata": [88.4, 22.6],
    "Asia/Shanghai": [121.5, 31.2],
    "Asia/Tokyo": [139.7, 35.7],
    "Asia/Dubai": [55.3, 25.2],
    "Asia/Singapore": [103.8, 1.35],
    "Asia/Hong_Kong": [114.2, 22.3],
    "Asia/Seoul": [127, 37.5],
    "Asia/Bangkok": [100.5, 13.8],
    "Asia/Jakarta": [106.8, -6.2],
    "Asia/Karachi": [67, 24.9],
    "Asia/Tehran": [51.4, 35.7],
    "Asia/Kathmandu": [85.3, 27.7],
    "Australia/Sydney": [151.2, -33.9],
    "Australia/Perth": [115.9, -31.9],
    "Pacific/Auckland": [174.8, -36.9],
    "Pacific/Honolulu": [-157.9, 21.3],
    "Africa/Cairo": [31.2, 30],
    "Africa/Johannesburg": [28, -26.2],
    "Africa/Lagos": [3.4, 6.5],
    "Africa/Nairobi": [36.8, -1.3],
};
