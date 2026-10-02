import { Detector, DETECTORS, EntityCategory, shannonEntropy, isReservedIpv4, isReservedIpv6 } from "./detectors";
import { claveDeSesion, hmacSha256 } from "./hmac";
import type { CoincidenciaCruda } from "../regex-limite";
export type Operator = "replace" | "redact" | "mask" | "token" | "hash";
export interface Span {
    start: number;
    end: number;
    entity: string;
    value: string;
}
export interface AnonymizeConfig {
    detectors?: Detector[];
    operators?: Record<string, Operator>;
    defaultOperator?: Operator;
    sensitiveKeys?: string[];
    wordMap?: Record<string, string>;
    customRegex?: {
        pattern: string;
        replacement: string;
        flags?: string;
    }[];
    customMatches?: (CoincidenciaCruda[] | null)[];
    allowlist?: string[];
    extraSpans?: (Span & {
        op?: Operator;
    })[];
    includeStructuralIps?: boolean;
    hashKey?: Uint8Array;
}
export interface AnonymizeResult {
    text: string;
    hits: Record<string, number>;
    tokenMap: Record<string, string>;
    spans: Span[];
}
export interface AnonymizeCarry {
    counters: Map<string, number>;
    valueToken: Map<string, string>;
    tokenMap: Record<string, string>;
}
export function newCarry(): AnonymizeCarry { return { counters: new Map(), valueToken: new Map(), tokenMap: {} }; }
interface Internal {
    start: number;
    end: number;
    entity: string;
    value: string;
    matchText: string;
    op: Operator;
    fixed?: string;
    reversibleTo?: string;
    det?: Detector;
}
function escapeRegExp(s: string): string { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
function withIndices(re: RegExp): RegExp { return re.flags.includes("d") ? re : new RegExp(re.source, re.flags + "d"); }
function huella(valor: string, clave: Uint8Array): string {
    const mac = hmacSha256(clave, new TextEncoder().encode(valor));
    let hex = "";
    for (let i = 0; i < 4; i++)
        hex += mac[i].toString(16).padStart(2, "0");
    return hex;
}
export function esDominioReservado(dominio: string): boolean {
    const d = dominio.toLowerCase().replace(/\.$/, "");
    if (/(^|\.)example\.(com|net|org)$/.test(d))
        return true;
    const tld = d.slice(d.lastIndexOf(".") + 1);
    return ["example", "test", "invalid", "localhost"].includes(tld);
}
function contienePalabra(texto: string, palabra: string): boolean {
    const prefijo = /[-_]$/.test(palabra);
    const re = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(palabra)}${prefijo ? "" : "(?![\\p{L}\\p{N}])"}`, "u");
    return re.test(texto);
}
export function enListaBlanca(entidad: string, categoria: EntityCategory | undefined, valor: string, allow: string[]): boolean {
    const v = valor.trim().toLowerCase();
    if (!v)
        return false;
    if (allow.includes(v))
        return true;
    if (entidad === "email") {
        const dom = v.slice(v.lastIndexOf("@") + 1);
        return !!dom && (esDominioReservado(dom) || allow.some(w => dom === w || dom.endsWith("." + w)));
    }
    if (categoria === "financial" || categoria === "id" || categoria === "pii")
        return false;
    return allow.some(w => contienePalabra(v, w));
}
function maskValue(value: string, entity: string): string {
    if (entity === "email") {
        const [loc, dom] = value.split("@");
        const tld = dom && dom.includes(".") ? dom.slice(dom.lastIndexOf(".")) : "";
        return (loc?.[0] ?? "*") + "***@***" + tld;
    }
    if (value.length <= 2)
        return "*".repeat(value.length);
    return value[0] + "*".repeat(Math.max(3, value.length - 2)) + value[value.length - 1];
}
function maskLast4(value: string): string {
    const digitIdx: number[] = [];
    for (let i = 0; i < value.length; i++)
        if (/\d/.test(value[i]))
            digitIdx.push(i);
    const keep = new Set(digitIdx.slice(-4));
    return value.split("").map((ch, i) => (/\d/.test(ch) && !keep.has(i)) ? "*" : ch).join("");
}
function collect(text: string, det: Detector): Internal[] {
    const out: Internal[] = [];
    const gi = det.group ?? 0;
    for (const m of text.matchAll(withIndices(det.regex))) {
        const idx = (m as RegExpMatchArray & {
            indices?: Array<[
                number,
                number
            ]>;
        }).indices?.[gi];
        if (!idx)
            continue;
        const matchText = m[0];
        const value = m[gi] ?? matchText;
        out.push({ start: idx[0], end: idx[1], entity: det.id, value, matchText, op: "replace", det });
    }
    return out;
}
export function patronNombreClave(clave: string): string | null {
    const partes = clave.trim().split(/[-_\s]+/).filter(Boolean);
    if (!partes.length)
        return null;
    const letra = (c: string) => c.toLowerCase() !== c.toUpperCase();
    const ci = (p: string) => [...p].map(c => letra(c) ? `[${c.toLowerCase()}${c.toUpperCase()}]` : escapeRegExp(c)).join("");
    const mayus = (p: string) => letra(p[0]) ? p[0].toUpperCase() + ci(p.slice(1)) : ci(p);
    const inicio = `(?:(?<![A-Za-z0-9])${ci(partes[0])}|(?<=[a-z0-9])${mayus(partes[0])})`;
    const resto = partes.slice(1).map(p => `[-_. ]?${ci(p)}`).join("");
    return `${inicio}${resto}(?![a-z]|(?<=[A-Z])[A-Z])`;
}
function keyDetectors(keys: string[]): Detector[] {
    const dets: Detector[] = [];
    const nombre = "[A-Za-z0-9_.-]*";
    for (const raw of keys) {
        const k = patronNombreClave(raw);
        if (!k)
            continue;
        dets.push({ id: "sensitive-key", label: "", category: "secret", group: 2, regex: new RegExp(`(<[A-Za-z0-9_.:-]*${k}[A-Za-z0-9_.:-]*>)([\\s\\S]*?)(</[^>\\s]+>)`, "g") }, { id: "sensitive-key", label: "", category: "secret", group: 2, regex: new RegExp(`("${nombre}${k}${nombre}"\\s*:\\s*")([^"\\n]*)`, "g") }, { id: "sensitive-key", label: "", category: "secret", group: 2, regex: new RegExp(`((?<![A-Za-z0-9_.-])${nombre}${k}${nombre}\\s*[:=]\\s*"?)([^\\n"]+)`, "g") });
    }
    return dets;
}
export function anonymize(text: string, cfg: AnonymizeConfig, carry?: AnonymizeCarry): AnonymizeResult {
    const detectors = cfg.detectors ?? DETECTORS.filter(d => !d.defaultOff);
    const ops = cfg.operators ?? {};
    const defOp = cfg.defaultOperator ?? "replace";
    const allow = (cfg.allowlist ?? []).map(w => w.toLowerCase()).filter(Boolean);
    const spans: Internal[] = [];
    for (const det of [...detectors, ...keyDetectors(cfg.sensitiveKeys ?? [])]) {
        for (const s of collect(text, det)) {
            if (det.validate && !det.validate(s.matchText))
                continue;
            if (det.entropyMin != null && shannonEntropy(s.value) < det.entropyMin)
                continue;
            if (enListaBlanca(s.entity, det.category, s.value, allow))
                continue;
            if (!cfg.includeStructuralIps && ((s.entity === "ipv4" && isReservedIpv4(s.matchText)) || (s.entity === "ipv6" && isReservedIpv6(s.matchText))))
                continue;
            s.op = ops[s.entity] ?? (s.entity === "sensitive-key" ? (ops["sensitive-key"] ?? "redact") : defOp);
            spans.push(s);
        }
    }
    (cfg.customRegex ?? []).forEach((c, i) => {
        if (!c.pattern)
            return;
        if (cfg.customMatches) {
            for (const m of cfg.customMatches[i] ?? []) {
                const fixed = (c.replacement ?? "").replace(/\$(\d)/g, (_x, d) => (+d === 0 ? m.value : m.groups[+d - 1]) ?? "");
                spans.push({ start: m.index, end: m.index + m.value.length, entity: "custom-regex", value: m.value, matchText: m.value, op: "replace", fixed });
            }
            return;
        }
        let re: RegExp;
        try {
            re = new RegExp(c.pattern, (c.flags ?? "g").includes("g") ? (c.flags ?? "g") : (c.flags ?? "") + "g");
        }
        catch {
            return;
        }
        for (const m of text.matchAll(withIndices(re))) {
            const idx = (m as RegExpMatchArray & {
                indices?: Array<[
                    number,
                    number
                ]>;
            }).indices?.[0];
            if (!idx)
                continue;
            const fixed = (c.replacement ?? "").replace(/\$(\d)/g, (_x, d) => m[+d] ?? "");
            spans.push({ start: idx[0], end: idx[1], entity: "custom-regex", value: m[0], matchText: m[0], op: "replace", fixed });
        }
    });
    const bajo = text.toLowerCase();
    const sinCaso = bajo.length === text.length;
    for (const [orig, alias] of Object.entries(cfg.wordMap ?? {})) {
        if (!orig || !alias)
            continue;
        const donde = sinCaso ? bajo : text, que = sinCaso ? orig.toLowerCase() : orig;
        let from = 0, i;
        while ((i = donde.indexOf(que, from)) !== -1) {
            const hallado = text.slice(i, i + orig.length);
            const forma = hallado === orig ? alias
                : hallado === hallado.toLowerCase() ? alias.toLowerCase()
                    : hallado === hallado.toUpperCase() ? alias.toUpperCase()
                        : alias;
            spans.push({ start: i, end: i + orig.length, entity: "word-map", value: hallado, matchText: hallado, op: "replace", fixed: forma, reversibleTo: hallado });
            from = i + orig.length;
        }
    }
    for (const s of cfg.extraSpans ?? []) {
        if (enListaBlanca(s.entity, undefined, s.value, allow))
            continue;
        spans.push({ start: s.start, end: s.end, entity: s.entity, value: s.value, matchText: s.value, op: s.op ?? ops[s.entity] ?? defOp });
    }
    spans.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));
    const chosen: Internal[] = [];
    let lastEnd = -1;
    for (const s of spans) {
        if (s.start >= lastEnd) {
            chosen.push(s);
            lastEnd = s.end;
        }
    }
    const hits: Record<string, number> = {};
    const tokenMap = carry?.tokenMap ?? {};
    const counters = carry?.counters ?? new Map<string, number>();
    const valueToken = carry?.valueToken ?? new Map<string, string>();
    let out = text;
    for (const s of [...chosen].sort((a, b) => b.start - a.start)) {
        const rep = applyOp(s, counters, valueToken, tokenMap, cfg.hashKey ?? claveDeSesion());
        out = out.slice(0, s.start) + rep + out.slice(s.end);
        hits[s.entity] = (hits[s.entity] ?? 0) + 1;
    }
    return {
        text: out,
        hits,
        tokenMap,
        spans: chosen.map(s => ({ start: s.start, end: s.end, entity: s.entity, value: s.value })),
    };
}
function applyOp(s: Internal, counters: Map<string, number>, valueToken: Map<string, string>, tokenMap: Record<string, string>, hashKey: Uint8Array): string {
    if (s.reversibleTo != null && s.fixed) {
        tokenMap[s.fixed] = s.reversibleTo;
        return s.fixed;
    }
    switch (s.op) {
        case "redact": return "[REDACTED]";
        case "mask": return (s.entity === "credit-card" || s.entity === "iban") ? maskLast4(s.value) : maskValue(s.value, s.entity);
        case "hash": return `[${s.entity.toUpperCase()}:${huella(s.value, hashKey)}]`;
        case "token": {
            const key = s.entity + "::" + s.value;
            let tok = valueToken.get(key);
            if (!tok) {
                const n = (counters.get(s.entity) ?? 0) + 1;
                counters.set(s.entity, n);
                tok = `[${s.entity.toUpperCase()}_${n}]`;
                valueToken.set(key, tok);
                tokenMap[tok] = s.value;
            }
            return tok;
        }
        default: return s.fixed ?? s.det?.placeholder ?? `[${s.entity.toUpperCase()}]`;
    }
}
export function deanonymize(text: string, tokenMap: Record<string, string>): string {
    let out = text;
    for (const k of Object.keys(tokenMap).sort((a, b) => b.length - a.length))
        out = out.split(k).join(tokenMap[k]);
    return out;
}
