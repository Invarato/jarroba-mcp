import { Injectable } from "@angular/core";
export type TraceLang = "java" | "python" | "node" | "go" | "dotnet" | "rust" | "ruby" | "php";
export interface Frame {
    raw: string;
    fn: string;
    file: string;
    line: number | null;
    app: boolean;
}
export interface ExceptionNode {
    type: string;
    message: string;
    frames: Frame[];
    omitted: number;
}
export interface StackTrace {
    lang: TraceLang;
    chain: ExceptionNode[];
    root: ExceptionNode;
    culprit: Frame | null;
    appPrefixes: string[];
    totalFrames: number;
    appFrames: number;
}
export interface TraceOpts {
    appPrefixes?: string[];
}
const VENDOR_PATH = [
    "node_modules/",
    "node:",
    "internal/",
    "webpack/",
    "site-packages/",
    "dist-packages/",
    "/usr/lib/python",
    "lib/python",
    "<frozen ",
    "/usr/local/go/src/",
    "/rustc/",
    "/gems/",
    "ruby/3.",
    "ruby/2.",
    "<internal:",
    "/vendor/",
    "php:internal",
];
const VENDOR_NS = [
    "java.",
    "javax.",
    "jakarta.",
    "jdk.",
    "sun.",
    "com.sun.",
    "kotlin.",
    "scala.",
    "org.springframework.",
    "org.apache.",
    "org.hibernate.",
    "org.eclipse.",
    "org.jboss.",
    "org.junit.",
    "org.mockito.",
    "org.slf4j.",
    "ch.qos.logback.",
    "io.netty.",
    "reactor.",
    "com.fasterxml.",
    "com.google.common.",
    "com.zaxxer.",
    "okhttp3.",
    "retrofit2.",
    "feign.",
    "zone.js",
    "runtime.",
    "net/http.",
    "testing.",
    "System.",
    "Microsoft.",
    "Newtonsoft.",
    "core::",
    "std::",
    "alloc::",
    "rust_begin_unwind",
    "__rust_",
];
const isVendorPath = (s: string) => VENDOR_PATH.some(v => s.includes(v));
const isVendor = (s: string) => isVendorPath(s) || VENDOR_NS.some(v => s.includes(v));
const JAVA_FRAME = /^\s*at\s+([\w$.<>\/]+)\(([^)]*)\)/;
const JAVA_HEAD = /^\s*((?:[\w$]+\.)*[\w$]*(?:Exception|Error|Throwable)[\w$]*)(?::\s?([\s\S]*))?$/;
const JAVA_CAUSE = /^\s*Caused by:\s*(.*)$/;
const JAVA_SUPPRESSED = /^\s*Suppressed:\s*(.*)$/;
const JAVA_OMITTED = /^\s*\.{3}\s*(\d+)\s+(?:more|common frames omitted)/;
const PY_FRAME = /^\s*File\s+"([^"]*)",\s+line\s+(\d+)(?:,\s+in\s+(\S+))?/;
const PY_HEAD = /^\s*Traceback \(most recent call last\):/;
const PY_EXC = /^\s*([\w.]*(?:Error|Exception|Warning|Interrupt|Exit)[\w.]*)(?::\s?([\s\S]*))?$/;
const PY_CHAIN = /^\s*(?:The above exception was the direct cause of|During handling of the above exception)/;
const NODE_FRAME = /^\s*at\s+(?:(.+?)\s+\()?([^()\s]+?):(\d+):(\d+)\)?\s*$/;
const NODE_HEAD = /^\s*([\w$.]*(?:Error|Exception)[\w$]*)(?::\s?([\s\S]*))?$/;
const GO_PANIC = /^\s*panic:\s*([\s\S]*)$/;
const GO_GOROUTINE = /^\s*goroutine\s+\d+\s+\[/;
const GO_FILE = /^\s*([^\s:]+\.go):(\d+)(?:\s+\+0x[0-9a-f]+)?\s*$/;
const RUST_PANIC = /^\s*thread '[^']*' panicked at ([^\s:]+):(\d+):(\d+):?\s*$/;
const RUST_PANIC_1L = /^\s*thread '[^']*' panicked at '(.*)', ([^\s:]+):(\d+):(\d+)\s*$/;
const RUST_FRAME = /^\s*\d+:\s+(.+)$/;
const RUST_AT = /^\s*at\s+(\.?\/?[^\s:]+):(\d+)/;
const RUBY_HEAD = /^\s*([^\s:]+):(\d+):in [`'"]([^`'"]*)['"]:\s*(.*?)\s*\(([\w:]+)\)\s*$/;
const RUBY_FROM = /^\s*from\s+([^\s:]+):(\d+):in [`'"]([^`'"]*)['"]/;
const PHP_HEAD = /Uncaught\s+([\w\\]+):\s*(.*?)\s+in\s+(\S+):(\d+)\s*$/;
const PHP_FRAME = /^\s*#\d+\s+(?:(\S+)\((\d+)\):\s*)?(.*)$/;
const NET_FRAME = /^\s*at\s+([\w.<>`+]+)(?:\([^)]*\))?(?:\s+in\s+(.+?):line\s+(\d+))?\s*$/;
const NET_INNER = /^\s*--->\s*(.*)$/;
@Injectable({ providedIn: "root" })
export class LogStacktraceService {
    looksLikeTrace(text: string): boolean {
        return this.sniff(text) !== null;
    }
    private sniff(text: string): TraceLang | null {
        if (/^\s*thread '[^']*' panicked at /m.test(text))
            return "rust";
        if (/Uncaught\s+[\w\\]+:.*\sin\s\S+:\d+/.test(text) || /^\s*#\d+\s+\S+\(\d+\):/m.test(text))
            return "php";
        if (RUBY_HEAD.test(text) || /^\s*from\s+\S+:\d+:in /m.test(text))
            return "ruby";
        if (PY_HEAD.test(text) || /\n\s*File\s+"[^"]*",\s+line\s+\d+/.test(text))
            return "python";
        if (/\n\s*at\s+[\w$.<>\/]+\([^)]*\.(?:java|kt|scala|groovy)(?::\d+)?\)/.test(text))
            return "java";
        if (/^\s*panic:/m.test(text) && GO_GOROUTINE.test(text))
            return "go";
        if (/\n\s*goroutine\s+\d+\s+\[/.test(text))
            return "go";
        if (/\n\s*at\s+[\w.<>`+]+.*\sin\s.+:line\s+\d+/.test(text))
            return "dotnet";
        if (/\n\s*at\s+.*:\d+:\d+\)?\s*$/m.test(text))
            return "node";
        if (/\n\s*at\s+\S/.test(text) && /Caused by:/.test(text))
            return "java";
        return null;
    }
    parse(text: string, opts: TraceOpts = {}): StackTrace | null {
        const lang = this.sniff(text);
        if (!lang)
            return null;
        const lines = text.split(/\r\n|\n|\r/);
        let chain: ExceptionNode[];
        switch (lang) {
            case "java":
                chain = this.parseJava(lines);
                break;
            case "python":
                chain = this.parsePython(lines);
                break;
            case "go":
                chain = this.parseGo(lines);
                break;
            case "dotnet":
                chain = this.parseDotnet(lines);
                break;
            case "rust":
                chain = this.parseRust(lines);
                break;
            case "ruby":
                chain = this.parseRuby(lines);
                break;
            case "php":
                chain = this.parsePhp(lines);
                break;
            default:
                chain = this.parseNode(lines);
                break;
        }
        chain = chain.filter(c => c.type !== "" || c.frames.length > 0);
        if (chain.length === 0)
            return null;
        const appPrefixes = opts.appPrefixes?.length ? opts.appPrefixes : this.inferAppPrefixes(chain, lang);
        let total = 0, app = 0;
        for (const node of chain) {
            for (const f of node.frames) {
                f.app = this.isApp(f, appPrefixes);
                total++;
                if (f.app)
                    app++;
            }
        }
        const root = chain[chain.length - 1];
        let culprit: Frame | null = null;
        for (let i = chain.length - 1; i >= 0 && !culprit; i--)
            culprit = chain[i].frames.find(f => f.app) ?? null;
        return { lang, chain, root, culprit, appPrefixes, totalFrames: total, appFrames: app };
    }
    private parseJava(lines: string[]): ExceptionNode[] {
        const chain: ExceptionNode[] = [];
        let cur: ExceptionNode | null = null;
        const open = (head: string): ExceptionNode => {
            const m = JAVA_HEAD.exec(head.trim());
            const node: ExceptionNode = m
                ? { type: m[1], message: (m[2] ?? "").trim(), frames: [], omitted: 0 }
                : { type: head.trim(), message: "", frames: [], omitted: 0 };
            chain.push(node);
            return node;
        };
        for (const line of lines) {
            const cause = JAVA_CAUSE.exec(line);
            if (cause) {
                cur = open(cause[1]);
                continue;
            }
            const sup = JAVA_SUPPRESSED.exec(line);
            if (sup) {
                cur = open(sup[1]);
                continue;
            }
            const om = JAVA_OMITTED.exec(line);
            if (om && cur) {
                cur.omitted += Number(om[1]);
                continue;
            }
            const fr = JAVA_FRAME.exec(line);
            if (fr) {
                if (!cur)
                    cur = open("");
                const at = fr[2];
                const colon = at.lastIndexOf(":");
                const file = colon > 0 ? at.slice(0, colon) : at;
                const ln = colon > 0 ? Number(at.slice(colon + 1)) : NaN;
                cur.frames.push({ raw: line, fn: fr[1], file, line: Number.isFinite(ln) ? ln : null, app: false });
                continue;
            }
            if (!cur && line.trim() !== "" && JAVA_HEAD.test(line.trim()))
                cur = open(line);
        }
        return chain;
    }
    private parsePython(lines: string[]): ExceptionNode[] {
        const chain: ExceptionNode[] = [];
        let cur: ExceptionNode = { type: "", message: "", frames: [], omitted: 0 };
        let started = false;
        const push = () => {
            if (started || cur.frames.length || cur.type)
                chain.push(cur);
            cur = { type: "", message: "", frames: [], omitted: 0 };
        };
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (PY_CHAIN.test(line))
                continue;
            if (PY_HEAD.test(line)) {
                if (started)
                    push();
                started = true;
                continue;
            }
            const fr = PY_FRAME.exec(line);
            if (fr) {
                cur.frames.push({ raw: line, fn: fr[3] ?? "", file: fr[1], line: Number(fr[2]), app: false });
                continue;
            }
            if (!started)
                continue;
            if (/^\s{2,}\S/.test(line) && !PY_EXC.test(line.trim()))
                continue;
            const exc = PY_EXC.exec(line);
            if (exc && line.trim() !== "") {
                cur.type = exc[1];
                cur.message = (exc[2] ?? "").trim();
                push();
                started = false;
            }
        }
        push();
        return chain.reverse();
    }
    private parseNode(lines: string[]): ExceptionNode[] {
        const chain: ExceptionNode[] = [];
        let cur: ExceptionNode | null = null;
        for (const line of lines) {
            const fr = NODE_FRAME.exec(line);
            if (fr) {
                if (!cur) {
                    const n: ExceptionNode = { type: "", message: "", frames: [], omitted: 0 };
                    chain.push(n);
                    cur = n;
                }
                cur.frames.push({ raw: line, fn: (fr[1] ?? "").trim(), file: fr[2], line: Number(fr[3]), app: false });
                continue;
            }
            const head = NODE_HEAD.exec(line.trim());
            if (head && line.trim() !== "") {
                cur = { type: head[1], message: (head[2] ?? "").trim(), frames: [], omitted: 0 };
                chain.push(cur);
            }
        }
        return chain;
    }
    private parseGo(lines: string[]): ExceptionNode[] {
        const node: ExceptionNode = { type: "panic", message: "", frames: [], omitted: 0 };
        let pendingFn = "";
        for (const line of lines) {
            const p = GO_PANIC.exec(line);
            if (p) {
                node.message = p[1].trim();
                continue;
            }
            if (GO_GOROUTINE.test(line)) {
                pendingFn = "";
                continue;
            }
            const f = GO_FILE.exec(line);
            if (f) {
                node.frames.push({ raw: line, fn: pendingFn, file: f[1], line: Number(f[2]), app: false });
                pendingFn = "";
                continue;
            }
            if (/^\S.*\(/.test(line))
                pendingFn = line.trim();
        }
        return [node];
    }
    private parseDotnet(lines: string[]): ExceptionNode[] {
        const chain: ExceptionNode[] = [];
        let cur: ExceptionNode | null = null;
        const open = (head: string): ExceptionNode => {
            const i = head.indexOf(": ");
            const node: ExceptionNode = i > 0
                ? { type: head.slice(0, i).trim(), message: head.slice(i + 2).trim(), frames: [], omitted: 0 }
                : { type: head.trim(), message: "", frames: [], omitted: 0 };
            chain.push(node);
            return node;
        };
        for (const line of lines) {
            const inner = NET_INNER.exec(line);
            if (inner) {
                cur = open(inner[1]);
                continue;
            }
            if (/End of inner exception stack trace/.test(line))
                continue;
            const fr = NET_FRAME.exec(line);
            if (fr && /^\s*at\s/.test(line)) {
                if (!cur)
                    cur = open("");
                cur.frames.push({ raw: line, fn: fr[1], file: fr[2] ?? "", line: fr[3] ? Number(fr[3]) : null, app: false });
                continue;
            }
            if (!cur && line.trim() !== "" && /Exception/.test(line))
                cur = open(line);
        }
        return chain;
    }
    private parseRust(lines: string[]): ExceptionNode[] {
        const node: ExceptionNode = { type: "panic", message: "", frames: [], omitted: 0 };
        let pendiente = "";
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const viejo = RUST_PANIC_1L.exec(line);
            if (viejo) {
                node.message = viejo[1];
                node.frames.push({ raw: line, fn: "", file: viejo[2], line: Number(viejo[3]), app: false });
                continue;
            }
            const nuevo = RUST_PANIC.exec(line);
            if (nuevo) {
                node.frames.push({ raw: line, fn: "", file: nuevo[1], line: Number(nuevo[2]), app: false });
                if (!node.message && lines[i + 1] && !/^\s*(note:|stack backtrace:)/.test(lines[i + 1])) {
                    node.message = lines[++i].trim();
                }
                continue;
            }
            const at = RUST_AT.exec(line);
            if (at) {
                node.frames.push({ raw: line, fn: pendiente, file: at[1], line: Number(at[2]), app: false });
                pendiente = "";
                continue;
            }
            const fr = RUST_FRAME.exec(line);
            if (fr)
                pendiente = fr[1].trim();
        }
        return [node];
    }
    private parseRuby(lines: string[]): ExceptionNode[] {
        const node: ExceptionNode = { type: "", message: "", frames: [], omitted: 0 };
        for (const line of lines) {
            const head = RUBY_HEAD.exec(line);
            if (head && !node.type) {
                node.type = head[5];
                node.message = head[4];
                node.frames.push({ raw: line, fn: head[3], file: head[1], line: Number(head[2]), app: false });
                continue;
            }
            const from = RUBY_FROM.exec(line);
            if (from)
                node.frames.push({ raw: line, fn: from[3], file: from[1], line: Number(from[2]), app: false });
        }
        return [node];
    }
    private parsePhp(lines: string[]): ExceptionNode[] {
        const node: ExceptionNode = { type: "", message: "", frames: [], omitted: 0 };
        for (const line of lines) {
            const head = PHP_HEAD.exec(line);
            if (head && !node.type) {
                node.type = head[1];
                node.message = head[2];
                node.frames.push({ raw: line, fn: "", file: head[3], line: Number(head[4]), app: false });
                continue;
            }
            if (/^\s*#\d+\s+\{main\}\s*$/.test(line))
                continue;
            const fr = PHP_FRAME.exec(line);
            if (fr && /^\s*#\d+/.test(line)) {
                node.frames.push({ raw: line, fn: fr[3] ?? "", file: fr[1] ?? "", line: fr[2] ? Number(fr[2]) : null, app: false });
            }
        }
        return [node];
    }
    private isApp(f: Frame, appPrefixes: string[]): boolean {
        const hay = `${f.fn} ${f.file}`;
        if (isVendorPath(hay))
            return false;
        if (appPrefixes.length)
            return appPrefixes.some(p => p !== "" && hay.includes(p));
        return !isVendor(hay);
    }
    private inferAppPrefixes(chain: ExceptionNode[], lang: TraceLang): string[] {
        const tally = new Map<string, number>();
        for (const node of chain) {
            for (const f of node.frames) {
                const hay = `${f.fn} ${f.file}`;
                if (isVendor(hay))
                    continue;
                const key = lang === "java" || lang === "dotnet"
                    ? f.fn.split(".").slice(0, 2).join(".")
                    : lang === "rust"
                        ? (f.fn.split("::")[0] || f.file.split("/").filter(x => x && x !== ".")[0] || "")
                        : (f.file.split("/").filter(x => x && x !== ".")[0] ?? "");
                if (key && key.length > 1)
                    tally.set(key, (tally.get(key) ?? 0) + 1);
            }
        }
        let best = "", bestN = 0;
        for (const [k, n] of [...tally].sort((a, b) => a[0] < b[0] ? -1 : 1))
            if (n > bestN) {
                bestN = n;
                best = k;
            }
        return best ? [best] : [];
    }
    summary(t: StackTrace): string {
        const types = t.chain.map(c => short(c.type)).join(" \u2192 ");
        const where = t.culprit ? ` @ ${t.culprit.fn}(${t.culprit.file}${t.culprit.line != null ? ":" + t.culprit.line : ""})` : "";
        const msg = t.root.message ? `: ${t.root.message}` : "";
        return `${types}${msg}${where}`;
    }
    collapse(t: StackTrace): CollapsedLine[] {
        const out: CollapsedLine[] = [];
        for (const node of t.chain) {
            out.push({ kind: "exception", text: node.message ? `${node.type}: ${node.message}` : node.type, count: 0 });
            let run = 0;
            const flushRun = () => { if (run) {
                out.push({ kind: "folded", text: "", count: run });
                run = 0;
            } };
            for (const f of node.frames) {
                if (f.app) {
                    flushRun();
                    out.push({ kind: "frame", text: f.raw.trim(), count: 0, frame: f });
                }
                else
                    run++;
            }
            flushRun();
            if (node.omitted)
                out.push({ kind: "omitted", text: "", count: node.omitted });
        }
        return out;
    }
}
export interface CollapsedLine {
    kind: "exception" | "frame" | "folded" | "omitted";
    text: string;
    count: number;
    frame?: Frame;
}
function short(type: string): string {
    const i = type.lastIndexOf(".");
    return i >= 0 ? type.slice(i + 1) : type;
}
