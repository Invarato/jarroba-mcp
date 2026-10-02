import { Injectable } from "@angular/core";
import { LogEvent, LogLevel } from "./log-parse.service";
export const WILDCARD = "<*>";
export interface MaskRule {
    id: string;
    re: RegExp;
    token: string;
}
export const DEFAULT_MASKS: MaskRule[] = [
    { id: "uuid", re: /\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b/g, token: "<UUID>" },
    { id: "iso-date", re: /\b\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:[.,]\d+)?(?:Z|[+-]\d{2}:?\d{2})?/g, token: "<TIME>" },
    { id: "time", re: /\b\d{2}:\d{2}:\d{2}(?:[.,]\d+)?\b/g, token: "<TIME>" },
    { id: "url", re: /\b[a-z][a-z0-9+.-]*:\/\/[^\s"']+/gi, token: "<URL>" },
    { id: "email", re: /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g, token: "<EMAIL>" },
    { id: "ipv4", re: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(?::\d{1,5})?\b/g, token: "<IP>" },
    { id: "mac", re: /\b(?:[0-9a-fA-F]{2}:){5}[0-9a-fA-F]{2}\b/g, token: "<MAC>" },
    { id: "hex", re: /\b0x[0-9a-fA-F]+\b|\b[0-9a-fA-F]{16,}\b/g, token: "<HEX>" },
    { id: "path", re: /(?:[A-Za-z]:\\|\/)(?:[\w.@%+-]+[\\/])*[\w.@%+-]+/g, token: "<PATH>" },
    { id: "duration", re: /\b\d+(?:\.\d+)?(?:ms|s|m|h|us|µs|ns|B|KB|MB|GB|TB)\b/g, token: "<NUM>" },
    { id: "number", re: /(?<![\w.])[+-]?\d+(?:\.\d+)?(?![\w.])/g, token: "<NUM>" },
];
export interface LogPattern {
    id: number;
    template: string;
    count: number;
    occurrences: number[];
    sample: string;
    sampleIndex: number;
    byLevel: Record<LogLevel, number>;
    level: LogLevel | null;
    firstTs: number | null;
    lastTs: number | null;
    overflow: boolean;
}
export interface MineOpts {
    simThreshold?: number;
    depth?: number;
    maxChildren?: number;
    masks?: MaskRule[];
    maxPatterns?: number;
}
export interface MineResult {
    patterns: LogPattern[];
    events: number;
    compression: number;
    saturated: boolean;
}
const DEFAULTS = { simThreshold: 0.4, depth: 4, maxChildren: 100, maxPatterns: 5000 };
interface Cluster {
    id: number;
    tokens: string[];
    count: number;
    occurrences: number[];
    sample: string;
    sampleIndex: number;
    byLevel: Record<LogLevel, number>;
    firstTs: number | null;
    lastTs: number | null;
    frozen: boolean;
}
interface TreeNode {
    children: Map<string, TreeNode>;
    clusters: Cluster[];
}
const newNode = (): TreeNode => ({ children: new Map(), clusters: [] });
const emptyLevels = (): Record<LogLevel, number> => ({ trace: 0, debug: 0, info: 0, warn: 0, error: 0, fatal: 0 });
const merged = (a: number[], b: number[]) => a.concat(b).sort((x, y) => x - y);
const hasDigit = (t: string) => /\d/.test(t);
const SEVERITY: LogLevel[] = ["fatal", "error", "warn", "info", "debug", "trace"];
@Injectable({ providedIn: "root" })
export class LogPatternsService {
    mask(text: string, masks: MaskRule[] = DEFAULT_MASKS): string {
        let out = text;
        for (const m of masks) {
            m.re.lastIndex = 0;
            out = out.replace(m.re, m.token);
        }
        return out;
    }
    mine(events: LogEvent[], opts: MineOpts = {}): MineResult {
        const simTh = opts.simThreshold ?? DEFAULTS.simThreshold;
        const depth = Math.max(2, opts.depth ?? DEFAULTS.depth);
        const maxChildren = opts.maxChildren ?? DEFAULTS.maxChildren;
        const maxPatterns = opts.maxPatterns ?? DEFAULTS.maxPatterns;
        const masks = opts.masks ?? DEFAULT_MASKS;
        const root = newNode();
        const clusters: Cluster[] = [];
        let overflow: Cluster | null = null;
        let saturated = false;
        for (let i = 0; i < events.length; i++) {
            const ev = events[i];
            const head = ev.message.split("\n", 1)[0];
            const tokens = this.mask(head, masks).split(/\s+/).filter(t => t !== "");
            if (tokens.length === 0) {
                continue;
            }
            const leaf = this.descend(root, tokens, depth, maxChildren, clusters.length >= maxPatterns);
            const found = leaf ? this.bestMatch(leaf.clusters, tokens, simTh) : null;
            if (found) {
                this.absorb(found, tokens, ev, i);
            }
            else if (clusters.length >= maxPatterns) {
                if (!overflow) {
                    overflow = { id: clusters.length + 1, tokens: [WILDCARD], count: 0, occurrences: [], sample: head, sampleIndex: i, byLevel: emptyLevels(), firstTs: null, lastTs: null, frozen: true };
                    clusters.push(overflow);
                }
                saturated = true;
                this.absorb(overflow, tokens, ev, i);
            }
            else {
                const c: Cluster = {
                    id: clusters.length + 1,
                    tokens: tokens.slice(),
                    count: 0,
                    occurrences: [],
                    sample: head,
                    sampleIndex: i,
                    byLevel: emptyLevels(),
                    firstTs: null,
                    lastTs: null,
                    frozen: false,
                };
                this.absorb(c, tokens, ev, i);
                clusters.push(c);
                leaf?.clusters.push(c);
            }
        }
        const patterns = this.mergePass(clusters, simTh).map(c => this.toPattern(c));
        patterns.sort((a, b) => b.count - a.count || a.id - b.id);
        return {
            patterns,
            events: events.length,
            compression: patterns.length ? events.length / patterns.length : 0,
            saturated,
        };
    }
    private absorb(c: Cluster, tokens: string[], ev: LogEvent, i: number): void {
        if (c.count > 0 && !c.frozen) {
            for (let k = 0; k < c.tokens.length; k++)
                if (c.tokens[k] !== tokens[k])
                    c.tokens[k] = WILDCARD;
        }
        c.count++;
        c.occurrences.push(i);
        if (ev.level)
            c.byLevel[ev.level]++;
        if (ev.ts != null) {
            c.firstTs = c.firstTs == null ? ev.ts : Math.min(c.firstTs, ev.ts);
            c.lastTs = c.lastTs == null ? ev.ts : Math.max(c.lastTs, ev.ts);
        }
    }
    private descend(root: TreeNode, tokens: string[], depth: number, maxChildren: number, frozen: boolean): TreeNode | null {
        let node = this.child(root, String(tokens.length), maxChildren, frozen);
        if (!node)
            return null;
        const levels = Math.min(depth - 2, tokens.length);
        for (let d = 0; d < levels; d++) {
            const key = hasDigit(tokens[d]) ? WILDCARD : tokens[d];
            const next = this.child(node, key, maxChildren, frozen);
            if (!next)
                return node;
            node = next;
        }
        return node;
    }
    private child(node: TreeNode, key: string, maxChildren: number, frozen: boolean): TreeNode | null {
        const hit = node.children.get(key);
        if (hit)
            return hit;
        if (frozen)
            return node.children.get(WILDCARD) ?? null;
        if (node.children.size >= maxChildren) {
            let wc = node.children.get(WILDCARD);
            if (!wc) {
                wc = newNode();
                node.children.set(WILDCARD, wc);
            }
            return wc;
        }
        const fresh = newNode();
        node.children.set(key, fresh);
        return fresh;
    }
    private bestMatch(clusters: Cluster[], tokens: string[], simTh: number): Cluster | null {
        let best: Cluster | null = null, bestSim = -1, bestPar = -1;
        for (const c of clusters) {
            if (c.tokens.length !== tokens.length)
                continue;
            let same = 0, par = 0;
            for (let k = 0; k < tokens.length; k++) {
                if (c.tokens[k] === WILDCARD) {
                    par++;
                    continue;
                }
                if (c.tokens[k] === tokens[k])
                    same++;
            }
            const sim = tokens.length ? same / tokens.length : 1;
            if (sim > bestSim || (sim === bestSim && par > bestPar)) {
                bestSim = sim;
                bestPar = par;
                best = c;
            }
        }
        return bestSim >= simTh ? best : null;
    }
    private mergePass(clusters: Cluster[], simTh: number): Cluster[] {
        const byLen = new Map<number, Cluster[]>();
        for (const c of clusters) {
            const k = c.tokens.length;
            const bucket = byLen.get(k);
            if (bucket)
                bucket.push(c);
            else
                byLen.set(k, [c]);
        }
        const kept: Cluster[] = [];
        for (const bucket of byLen.values()) {
            const reps: Cluster[] = [];
            for (const c of bucket) {
                const into = c.frozen ? null : this.bestMatch(reps.filter(r => !r.frozen), c.tokens, simTh);
                if (into)
                    this.fuse(into, c);
                else
                    reps.push(c);
            }
            kept.push(...reps);
        }
        return kept;
    }
    private fuse(into: Cluster, from: Cluster): void {
        for (let k = 0; k < into.tokens.length; k++)
            if (into.tokens[k] !== from.tokens[k])
                into.tokens[k] = WILDCARD;
        into.count += from.count;
        into.occurrences = merged(into.occurrences, from.occurrences);
        for (const lv of SEVERITY)
            into.byLevel[lv] += from.byLevel[lv];
        if (from.firstTs != null && (into.firstTs == null || from.firstTs < into.firstTs))
            into.firstTs = from.firstTs;
        if (from.lastTs != null && (into.lastTs == null || from.lastTs > into.lastTs))
            into.lastTs = from.lastTs;
    }
    private toPattern(c: Cluster): LogPattern {
        let level: LogLevel | null = null;
        for (const lv of SEVERITY)
            if (c.byLevel[lv] > 0) {
                level = lv;
                break;
            }
        return {
            id: c.id,
            template: c.tokens.join(" "),
            count: c.count,
            occurrences: c.occurrences,
            sample: c.sample,
            sampleIndex: c.sampleIndex,
            byLevel: c.byLevel,
            level,
            firstTs: c.firstTs,
            lastTs: c.lastTs,
            overflow: c.frozen,
        };
    }
    rare(patterns: LogPattern[], maxCount = 3): LogPattern[] {
        return patterns.filter(p => p.count <= maxCount).sort((a, b) => a.count - b.count || a.id - b.id);
    }
    compare(before: LogPattern[], after: LogPattern[]): PatternDiff {
        const byTemplate = (ps: LogPattern[]) => {
            const m = new Map<string, LogPattern>();
            for (const p of ps) {
                const prev = m.get(p.template);
                if (prev)
                    m.set(p.template, { ...prev, count: prev.count + p.count });
                else
                    m.set(p.template, p);
            }
            return m;
        };
        const a = byTemplate(before), b = byTemplate(after);
        const added: PatternChange[] = [], removed: PatternChange[] = [], changed: PatternChange[] = [];
        for (const [tpl, p] of b) {
            const old = a.get(tpl);
            if (!old)
                added.push({ template: tpl, before: 0, after: p.count, level: p.level, sample: p.sample });
            else if (old.count !== p.count)
                changed.push({ template: tpl, before: old.count, after: p.count, level: p.level, sample: p.sample });
        }
        for (const [tpl, p] of a) {
            if (!b.has(tpl))
                removed.push({ template: tpl, before: p.count, after: 0, level: p.level, sample: p.sample });
        }
        const bySize = (x: PatternChange, y: PatternChange) => Math.abs(y.after - y.before) - Math.abs(x.after - x.before);
        added.sort(bySize);
        removed.sort(bySize);
        changed.sort(bySize);
        return { added, removed, changed };
    }
}
export interface PatternChange {
    template: string;
    before: number;
    after: number;
    level: LogLevel | null;
    sample: string;
}
export interface PatternDiff {
    added: PatternChange[];
    removed: PatternChange[];
    changed: PatternChange[];
}
