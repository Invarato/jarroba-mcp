export type EntityCategory = "secret" | "pii" | "financial" | "id" | "path" | "generic";
export interface Detector {
    id: string;
    label: string;
    category: EntityCategory;
    regex: RegExp;
    group?: number;
    validate?: (m: string) => boolean;
    entropyMin?: number;
    defaultOff?: boolean;
    placeholder?: string;
}
export function stripAnsi(text: string): string {
    return text.replace(/\[[0-9;?]*[ -/]*[@-~]/g, "").replace(/[PX^_].*?\\/g, "");
}
export function shannonEntropy(s: string): number {
    if (!s)
        return 0;
    const freq = new Map<string, number>();
    for (const ch of s)
        freq.set(ch, (freq.get(ch) ?? 0) + 1);
    let e = 0;
    for (const n of freq.values()) {
        const p = n / s.length;
        e -= p * Math.log2(p);
    }
    return e;
}
export function luhnValid(raw: string): boolean {
    const d = raw.replace(/[^0-9]/g, "");
    if (d.length < 13 || d.length > 19)
        return false;
    let sum = 0, alt = false;
    for (let i = d.length - 1; i >= 0; i--) {
        let n = d.charCodeAt(i) - 48;
        if (alt) {
            n *= 2;
            if (n > 9)
                n -= 9;
        }
        sum += n;
        alt = !alt;
    }
    return sum % 10 === 0;
}
export function ibanValid(raw: string): boolean {
    const s = raw.replace(/\s/g, "").toUpperCase();
    if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(s))
        return false;
    const rearranged = s.slice(4) + s.slice(0, 4);
    let rem = 0;
    for (const ch of rearranged) {
        const v = ch >= "A" && ch <= "Z" ? (ch.charCodeAt(0) - 55).toString() : ch;
        for (const digit of v)
            rem = (rem * 10 + (digit.charCodeAt(0) - 48)) % 97;
    }
    return rem === 1;
}
const DNI_LETTERS = "TRWAGMYFPDXBNJZSQVHLCKE";
export function dniNieValid(raw: string): boolean {
    const s = raw.toUpperCase().replace(/[\s-]/g, "");
    const m = s.match(/^([XYZ]?)(\d{7,8})([A-Z])$/);
    if (!m)
        return false;
    const prefix = m[1] ? String("XYZ".indexOf(m[1])) : "";
    const num = parseInt(prefix + m[2], 10);
    return DNI_LETTERS[num % 23] === m[3];
}
function digitCount(s: string): boolean {
    const n = s.replace(/\D/g, "").length;
    return n >= 9 && n <= 15;
}
export function isReservedIpv4(ip: string): boolean {
    const m = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (!m)
        return false;
    const a = +m[1], b = +m[2];
    if (a > 255 || b > 255 || +m[3] > 255 || +m[4] > 255)
        return false;
    if (a === 0 || a === 10 || a === 127 || a === 255)
        return true;
    if (a === 172 && b >= 16 && b <= 31)
        return true;
    if (a === 192 && b === 168)
        return true;
    if (a === 169 && b === 254)
        return true;
    if (a === 192 && b === 0)
        return true;
    if (a === 198 && (b === 18 || b === 19))
        return true;
    if (a >= 224)
        return true;
    return false;
}
export function isReservedIpv6(ip: string): boolean {
    const s = ip.toLowerCase();
    return s === "::1" || s === "::" || s.startsWith("fe80") || s.startsWith("fc") || s.startsWith("fd") || s.startsWith("ff");
}
export const DEFAULT_ALLOWLIST = [
    "example",
    "ejemplo",
    "dummy",
    "test",
    "fake",
    "sample",
    "placeholder",
    "redacted",
    "changeme",
    "your_",
    "your-",
    "xxxx",
    "foobar",
];
export const DETECTORS: Detector[] = [
    { id: "private-key", label: "Clave privada (PEM/SSH)", category: "secret", regex: /-----BEGIN[ A-Z0-9]*PRIVATE KEY-----[\s\S]*?-----END[ A-Z0-9]*PRIVATE KEY-----/g, placeholder: "-----BEGIN PRIVATE KEY-----\n[REDACTED]\n-----END PRIVATE KEY-----" },
    { id: "jwt", label: "JSON Web Token (JWT)", category: "secret", regex: /\beyJ[A-Za-z0-9_-]{6,}\.eyJ[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}\b/g, placeholder: "JWT.REDACTED.REDACTED" },
    { id: "aws-key", label: "AWS Access Key ID", category: "secret", regex: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g, placeholder: "AKIAXXXXXXXXXXXXXXXX" },
    { id: "azure-conn-key", label: "Clave de cadena de conexi\u00F3n Azure", category: "secret", group: 1, regex: /\b(?:AccountKey|SharedAccessKey)=([A-Za-z0-9+/]{20,}={0,2})/g, placeholder: "REDACTED" },
    { id: "gcp-key", label: "Google API Key", category: "secret", regex: /\bAIza[0-9A-Za-z_-]{35}\b/g, placeholder: "AIzaXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX" },
    { id: "github-token", label: "GitHub token", category: "secret", regex: /\b(?:gh[pousr]_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{22,})\b/g, placeholder: "ghp_REDACTED" },
    { id: "gitlab-token", label: "GitLab token", category: "secret", regex: /\bglpat-[A-Za-z0-9_-]{20}\b/g, placeholder: "glpat-REDACTED" },
    { id: "slack-token", label: "Slack token", category: "secret", regex: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g, placeholder: "xoxb-REDACTED" },
    { id: "slack-webhook", label: "Slack webhook", category: "secret", regex: /https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9/_-]+/g, placeholder: "https://hooks.slack.com/services/REDACTED" },
    { id: "stripe-key", label: "Stripe key", category: "secret", regex: /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}\b/g, placeholder: "sk_live_REDACTED" },
    { id: "anthropic-key", label: "Anthropic (Claude) key", category: "secret", regex: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/g, placeholder: "sk-ant-REDACTED" },
    { id: "openai-key", label: "OpenAI y compatibles (sk-\u2026)", category: "secret", regex: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/g, placeholder: "sk-REDACTED" },
    { id: "hf-token", label: "Hugging Face token", category: "secret", regex: /\bhf_[A-Za-z0-9]{20,}\b/g, placeholder: "hf_REDACTED" },
    { id: "xai-key", label: "xAI (Grok) key", category: "secret", regex: /\bxai-[A-Za-z0-9_-]{20,}\b/g, placeholder: "xai-REDACTED" },
    { id: "groq-key", label: "Groq key", category: "secret", regex: /\bgsk_[A-Za-z0-9]{20,}\b/g, placeholder: "gsk_REDACTED" },
    { id: "replicate-key", label: "Replicate token", category: "secret", regex: /\br8_[A-Za-z0-9]{20,}\b/g, placeholder: "r8_REDACTED" },
    { id: "npm-token", label: "npm token", category: "secret", regex: /\bnpm_[A-Za-z0-9]{36}\b/g, placeholder: "npm_REDACTED" },
    { id: "bearer", label: "Cabecera Bearer", category: "secret", regex: /\bBearer\s+[A-Za-z0-9._-]{12,}/g, placeholder: "Bearer REDACTED" },
    { id: "email", label: "Correo electr\u00F3nico", category: "pii", regex: /(?<![A-Za-z0-9._%+-])(?<!:\/\/[^\s/:@]+:)[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, placeholder: "email@redacted.com" },
    { id: "url-auth", label: "Credencial en URL", category: "pii", regex: /:\/\/[^:\s/]+:([^@\s]+)@/g, group: 1, placeholder: "REDACTED" },
    { id: "mac", label: "Direcci\u00F3n MAC", category: "pii", regex: /\b(?:[0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}\b/g, placeholder: "00:00:00:00:00:00" },
    { id: "phone", label: "Tel\u00E9fono", category: "pii", validate: digitCount, regex: /(?<!\d[-/.])(?!(?:19|20)\d{2}[-/.](?:0[1-9]|1[0-2])[-/.](?:0[1-9]|[12]\d|3[01])(?!\d)|(?:0[1-9]|[12]\d|3[01])[-/.](?:0[1-9]|1[0-2])[-/.](?:19|20)\d{2}(?!\d))(?:\((?:\d{2,3}|0\d{1,3})\)[ \t.-]?)?\b(?:\+?\d{1,3}[ \t.-]?)?(?:\(\d{1,4}\)[ \t.-]?)?\d{2,4}(?:[ \t.-]?\d{2,4}){1,4}\b/g, placeholder: "+00 000 000 000" },
    { id: "ipv4", label: "Direcci\u00F3n IPv4", category: "pii", defaultOff: true, regex: /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g, placeholder: "127.0.0.1" },
    { id: "ipv6", label: "Direcci\u00F3n IPv6", category: "pii", defaultOff: true, regex: /\b(?:[A-Fa-f0-9]{1,4}:){2,7}[A-Fa-f0-9]{1,4}\b/g, placeholder: "::1" },
    { id: "credit-card", label: "Tarjeta de cr\u00E9dito", category: "financial", validate: luhnValid, regex: /\b\d(?:[ -]?\d){12,18}\b/g, placeholder: "4111 1111 1111 1111" },
    { id: "iban", label: "IBAN", category: "financial", validate: ibanValid, regex: /\b[A-Z]{2}\d{2}(?:\s?[A-Z0-9]{4}){2,7}(?:\s?[A-Z0-9]{1,3})?\b/g, placeholder: "XX00 0000 0000 0000" },
    { id: "ssn", label: "SSN (EE. UU.)", category: "id", regex: /\b\d{3}-\d{2}-\d{4}\b/g, placeholder: "000-00-0000" },
    { id: "dni-nie", label: "DNI / NIE (Espa\u00F1a)", category: "id", validate: dniNieValid, regex: /\b[XYZ]?\d{7,8}[\s-]?[A-Za-z]\b/g, placeholder: "00000000X" },
    { id: "home-path", label: "Ruta de usuario (home)", category: "path", regex: /(?:\/(?:home|Users)\/[^/\s"']+)|(?:[A-Za-z]:\\Users\\[^\\\s"']+)/g, placeholder: "/home/user" },
    { id: "abs-path", label: "Ruta absoluta (conserva el nombre)", category: "path", defaultOff: true, regex: /(?<![:\w/])(?:\/[^/\s"':]+){2,}(?=\/[^/\s"':])/g, placeholder: "/dir" },
    { id: "abs-path-win", label: "Ruta absoluta Windows", category: "path", defaultOff: true, regex: /(?<![\w])[A-Za-z]:(?:\\[^\\\s"':]+){1,}(?=\\[^\\\s"':])/g, placeholder: "C:\\dir" },
    { id: "high-entropy", label: "Secreto gen\u00E9rico (alta entrop\u00EDa)", category: "generic", defaultOff: true, regex: /\b[A-Za-z0-9+/]{32,}={0,2}\b/g, placeholder: "[REDACTED]", entropyMin: 4 },
];
export const DEFAULT_ON_IDS = DETECTORS.filter(d => !d.defaultOff).map(d => d.id);
