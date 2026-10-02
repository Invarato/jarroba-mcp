import { decodeEntidades } from "./coder-decoder.service";
export type EscapeMode = "javascript" | "json" | "sql" | "regex" | "html" | "url" | "css";
const REGEX_META = /[\\^$.*+?()[\]{}|/]/g;
function cssEscape(s: string): string {
    let out = "";
    for (let i = 0; i < s.length; i++) {
        const c = s.charCodeAt(i);
        const hex = () => "\\" + c.toString(16) + " ";
        if (c === 0) {
            out += "\uFFFD";
            continue;
        }
        if ((c >= 1 && c <= 31) || c === 127) {
            out += hex();
            continue;
        }
        if (i === 0 && c >= 48 && c <= 57) {
            out += hex();
            continue;
        }
        if (i === 1 && c >= 48 && c <= 57 && s.charCodeAt(0) === 45) {
            out += hex();
            continue;
        }
        if (i === 0 && c === 45 && s.length === 1) {
            out += "\\-";
            continue;
        }
        if (c >= 128 || c === 45 || c === 95 || (c >= 48 && c <= 57) || (c >= 65 && c <= 90) || (c >= 97 && c <= 122)) {
            out += s[i];
            continue;
        }
        out += "\\" + s[i];
    }
    return out;
}
export class StringEscapeService {
    escape(str: string, mode: EscapeMode): string {
        switch (mode) {
            case "javascript":
                return str
                    .replace(/[\\\n\r\t\0"'`<\u2028\u2029]|\$\{/g, c => ({
                    "\\": "\\\\",
                    "\n": "\\n",
                    "\r": "\\r",
                    "\t": "\\t",
                    "\0": "\\0",
                    "\"": "\\\"",
                    "'": "\\'",
                    "`": "\\`",
                    "<": "\\x3C",
                    "\u2028": "\\u2028",
                    "\u2029": "\\u2029",
                    "${": "\\${",
                }[c] ?? c));
            case "json":
                return JSON.stringify(str).slice(1, -1);
            case "sql":
                return str.replace(/'/g, "''");
            case "regex":
                return str.replace(REGEX_META, "\\$&");
            case "html":
                return str
                    .replace(/&/g, "&amp;")
                    .replace(/</g, "&lt;")
                    .replace(/>/g, "&gt;")
                    .replace(/"/g, "&quot;")
                    .replace(/'/g, "&#39;");
            case "url":
                return encodeURIComponent(str);
            case "css":
                return cssEscape(str);
        }
    }
    unescape(str: string, mode: EscapeMode): string {
        switch (mode) {
            case "javascript":
                return str.replace(/\\(u\{[0-9a-fA-F]{1,6}\}|u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2}|\r\n|[\s\S])/g, (m, e: string) => {
                    if (e[0] === "u" && e[1] === "{") {
                        const cp = parseInt(e.slice(2, -1), 16);
                        return cp <= 1114111 ? String.fromCodePoint(cp) : m;
                    }
                    if (e[0] === "u" && e.length === 5)
                        return String.fromCharCode(parseInt(e.slice(1), 16));
                    if (e[0] === "x" && e.length === 3)
                        return String.fromCharCode(parseInt(e.slice(1), 16));
                    if (e === "\n" || e === "\r\n")
                        return "";
                    const simples: Record<string, string> = { n: "\n", r: "\r", t: "\t", b: "\b", f: "\f", v: "\v", 0: "\0" };
                    return simples[e] ?? e;
                });
            case "json":
                try {
                    return JSON.parse("\"" + str + "\"");
                }
                catch {
                    return str;
                }
            case "sql":
                return str.replace(/''/g, "'");
            case "regex":
                return str.replace(/\\([^A-Za-z0-9])/g, "$1");
            case "html":
                return decodeEntidades(str);
            case "url":
                try {
                    return decodeURIComponent(str);
                }
                catch {
                    return str;
                }
            case "css":
                return str.replace(/\\([0-9a-fA-F]{1,6})[ \t\n]?|\\([\s\S])/g, (_m, hex: string | undefined, ch: string | undefined) => {
                    if (hex) {
                        const cp = parseInt(hex, 16);
                        return cp === 0 || cp > 1114111 || (cp >= 55296 && cp <= 57343) ? "\uFFFD" : String.fromCodePoint(cp);
                    }
                    return ch ?? "";
                });
        }
    }
}
