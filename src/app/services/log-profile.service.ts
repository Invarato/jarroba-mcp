import { Injectable } from "@angular/core";
import { LogEvent, LogFormat, LogLevel, LEVEL_ORDER, isValidZone } from "./log-parse.service";
import { LogPattern } from "./log-patterns.service";
import { LogStacktraceService } from "./log-stacktrace.service";
export const LOG_PROFILE_VERSION = 1;
export type ProfileAction = "highlight" | "hide" | "pin";
export interface ProfileRule {
    label?: string;
    pattern: string;
    regex?: boolean;
    caseSensitive?: boolean;
    action?: ProfileAction;
    color?: string;
}
export interface LogProfile {
    logprofile: number;
    name?: string;
    format?: LogFormat;
    sourceZone?: string;
    displayZone?: string;
    appPrefixes?: string[];
    eventStart?: string;
    rules?: ProfileRule[];
    levels?: LogLevel[];
    ai?: {
        maxTokens?: number;
        redact?: boolean;
        digest?: boolean;
        keepTraces?: boolean;
        context?: number;
    };
}
export interface ProfileIssue {
    where: string;
    message: string;
}
export interface ProfileCheck {
    ok: boolean;
    errors: ProfileIssue[];
    warnings: ProfileIssue[];
    profile?: LogProfile;
}
const FORMATS: LogFormat[] = ["json", "logfmt", "syslog5424", "syslog3164", "clf", "combined", "plain"];
const ACTIONS: ProfileAction[] = ["highlight", "hide", "pin"];
const HEX = /^#[0-9a-fA-F]{6}$/;
export function isLogProfile(text: string): boolean {
    const t = text.trim();
    if (!t.startsWith("{"))
        return false;
    try {
        const o: unknown = JSON.parse(t);
        return !!o && typeof o === "object" && "logprofile" in (o as Record<string, unknown>);
    }
    catch {
        return false;
    }
}
@Injectable({ providedIn: "root" })
export class LogProfileService {
    private traces = new LogStacktraceService();
    check(text: string): ProfileCheck {
        const errors: ProfileIssue[] = [];
        const warnings: ProfileIssue[] = [];
        const err = (where: string, message: string) => errors.push({ where, message });
        const warn = (where: string, message: string) => warnings.push({ where, message });
        let raw: unknown;
        try {
            raw = JSON.parse(text);
        }
        catch (e) {
            return { ok: false, errors: [{ where: "(ra\u00EDz)", message: `No es JSON válido: ${String((e as Error).message)}` }], warnings };
        }
        if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
            return { ok: false, errors: [{ where: "(ra\u00EDz)", message: "El perfil tiene que ser un objeto JSON." }], warnings };
        }
        const o = raw as Record<string, unknown>;
        if (o["logprofile"] !== LOG_PROFILE_VERSION) {
            err("logprofile", `Falta o no vale: tiene que ser exactamente ${LOG_PROFILE_VERSION}. Es lo que distingue un perfil de cualquier otro JSON.`);
        }
        const p: LogProfile = { logprofile: LOG_PROFILE_VERSION };
        if (typeof o["name"] === "string")
            p.name = o["name"];
        if (o["format"] !== undefined) {
            if (typeof o["format"] !== "string" || !FORMATS.includes(o["format"] as LogFormat)) {
                err("format", `Formato desconocido. Los que hay: ${FORMATS.join(", ")}. Si lo quitas, la tool lo detecta sola.`);
            }
            else
                p.format = o["format"] as LogFormat;
        }
        for (const campo of ["sourceZone", "displayZone"] as const) {
            const v = o[campo];
            if (v === undefined)
                continue;
            if (typeof v !== "string") {
                err(campo, "Tiene que ser el nombre de una zona IANA, en texto.");
                continue;
            }
            if (v && !isValidZone(v)) {
                err(campo, `«${v}» no es una zona IANA que el navegador conozca. Se escriben como «Europe/Madrid» o «America/New_York».`);
                continue;
            }
            p[campo] = v;
        }
        if (o["eventStart"] !== undefined) {
            const v = o["eventStart"];
            if (typeof v !== "string") {
                err("eventStart", "Tiene que ser el texto de una expresi\u00F3n regular, p. ej. \"^\\\\[\\\\d{4}-\".");
            }
            else {
                try {
                    new RegExp(v);
                    p.eventStart = v;
                }
                catch (e) {
                    err("eventStart", `No es una expresión regular válida: ${String((e as Error).message)}`);
                }
            }
        }
        if (o["appPrefixes"] !== undefined) {
            const v = o["appPrefixes"];
            if (!Array.isArray(v) || v.some(x => typeof x !== "string")) {
                err("appPrefixes", "Tiene que ser una lista de textos, p. ej. [\"com.acme.\", \"src/\"].");
            }
            else {
                p.appPrefixes = (v as string[]).filter(x => x.trim() !== "");
                if (!p.appPrefixes.length)
                    warn("appPrefixes", "La lista est\u00E1 vac\u00EDa: es lo mismo que no ponerla.");
            }
        }
        if (o["levels"] !== undefined) {
            const v = o["levels"];
            if (!Array.isArray(v))
                err("levels", `Tiene que ser una lista con alguno de: ${LEVEL_ORDER.join(", ")}.`);
            else {
                const malos = v.filter(x => typeof x !== "string" || !LEVEL_ORDER.includes(x as LogLevel));
                if (malos.length)
                    err("levels", `Niveles desconocidos: ${malos.map(String).join(", ")}. Los que hay: ${LEVEL_ORDER.join(", ")}.`);
                else
                    p.levels = v as LogLevel[];
            }
        }
        if (o["rules"] !== undefined) {
            const v = o["rules"];
            if (!Array.isArray(v))
                err("rules", "Tiene que ser una lista de reglas.");
            else {
                p.rules = [];
                v.forEach((r, i) => {
                    const donde = `rules[${i}]`;
                    if (!r || typeof r !== "object" || Array.isArray(r)) {
                        err(donde, "Cada regla es un objeto.");
                        return;
                    }
                    const o2 = r as Record<string, unknown>;
                    if (typeof o2["pattern"] !== "string" || !o2["pattern"]) {
                        err(`${donde}.pattern`, "Falta el patr\u00F3n, que es lo \u00FAnico obligatorio de una regla.");
                        return;
                    }
                    const regla: ProfileRule = { pattern: o2["pattern"] };
                    if (o2["regex"] === true) {
                        regla.regex = true;
                        try {
                            new RegExp(o2["pattern"]);
                        }
                        catch (e) {
                            err(`${donde}.pattern`, `Expresión regular no válida: ${String((e as Error).message)}`);
                            return;
                        }
                    }
                    if (typeof o2["label"] === "string")
                        regla.label = o2["label"];
                    if (o2["caseSensitive"] === true)
                        regla.caseSensitive = true;
                    if (o2["action"] !== undefined) {
                        if (typeof o2["action"] !== "string" || !ACTIONS.includes(o2["action"] as ProfileAction)) {
                            err(`${donde}.action`, `Acción desconocida. Las que hay: ${ACTIONS.join(", ")}.`);
                            return;
                        }
                        regla.action = o2["action"] as ProfileAction;
                    }
                    if (o2["color"] !== undefined) {
                        if (typeof o2["color"] !== "string" || !HEX.test(o2["color"])) {
                            err(`${donde}.color`, "El color se escribe en hexadecimal de seis d\u00EDgitos, p. ej. \"#e53935\".");
                            return;
                        }
                        regla.color = o2["color"];
                    }
                    if (regla.action === "hide" && regla.color) {
                        warn(`${donde}.color`, "Una regla que OCULTA no pinta nada: el color no se va a usar.");
                    }
                    p.rules!.push(regla);
                });
            }
        }
        if (o["ai"] !== undefined) {
            const v = o["ai"];
            if (!v || typeof v !== "object" || Array.isArray(v))
                err("ai", "Tiene que ser un objeto.");
            else {
                const a = v as Record<string, unknown>;
                const ai: NonNullable<LogProfile["ai"]> = {};
                if (a["maxTokens"] !== undefined) {
                    const n = a["maxTokens"];
                    if (typeof n !== "number" || !Number.isFinite(n) || n < 200 || n > 1000000) {
                        err("ai.maxTokens", "Un n\u00FAmero entre 200 y 1000000. Por debajo de 200 no cabe nada \u00FAtil.");
                    }
                    else
                        ai.maxTokens = Math.round(n);
                }
                if (a["context"] !== undefined) {
                    const n = a["context"];
                    if (typeof n !== "number" || !Number.isFinite(n) || n < 0 || n > 50) {
                        err("ai.context", "Un n\u00FAmero entre 0 y 50: cu\u00E1ntos eventos conservar antes de cada error.");
                    }
                    else
                        ai.context = Math.round(n);
                }
                for (const b of ["redact", "digest", "keepTraces"] as const) {
                    if (a[b] === undefined)
                        continue;
                    if (typeof a[b] !== "boolean")
                        err(`ai.${b}`, "Tiene que ser true o false.");
                    else
                        ai[b] = a[b] as boolean;
                }
                if (Object.keys(ai).length)
                    p.ai = ai;
            }
        }
        const conocidos = new Set(["logprofile", "name", "format", "sourceZone", "displayZone", "appPrefixes", "eventStart", "rules", "levels", "ai"]);
        for (const k of Object.keys(o)) {
            if (!conocidos.has(k))
                warn(k, `Campo desconocido: se ignora. Los que hay: ${[...conocidos].join(", ")}.`);
        }
        return errors.length ? { ok: false, errors, warnings } : { ok: true, errors, warnings, profile: p };
    }
    suggest(events: LogEvent[], patterns: LogPattern[], format: LogFormat, name?: string): LogProfile {
        const p: LogProfile = { logprofile: LOG_PROFILE_VERSION };
        if (name)
            p.name = name;
        if (format !== "plain")
            p.format = format;
        const prefijos = new Map<string, number>();
        for (const e of events) {
            if (e.span < 2)
                continue;
            const t = this.traces.parse(e.raw);
            for (const pre of t?.appPrefixes ?? [])
                prefijos.set(pre, (prefijos.get(pre) ?? 0) + 1);
        }
        const top = [...prefijos.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
        if (top.length)
            p.appPrefixes = top.slice(0, 3).map(x => x[0]);
        const reglas: ProfileRule[] = [];
        const literal = (tpl: string, sample: string): string => {
            let mejor: string[] = [], actual: string[] = [];
            for (const tok of tpl.split(" ")) {
                if (!tok || tok.includes("<")) {
                    if (actual.join(" ").length > mejor.join(" ").length)
                        mejor = actual;
                    actual = [];
                }
                else
                    actual.push(tok);
            }
            if (actual.join(" ").length > mejor.join(" ").length)
                mejor = actual;
            const lit = mejor.slice(0, 8).join(" ");
            return lit.length > 3 && sample.includes(lit) ? lit : "";
        };
        for (const pat of patterns.filter(x => x.level === "error" || x.level === "fatal").slice(0, 3)) {
            const lit = literal(pat.template, pat.sample);
            if (lit)
                reglas.push({ label: lit.slice(0, 24), pattern: lit, action: "highlight", color: "#e53935" });
        }
        const inunda = patterns.find(x => events.length >= 50 && x.count / events.length > 0.4 && !x.overflow
            && x.level !== "error" && x.level !== "fatal");
        if (inunda) {
            const lit = literal(inunda.template, inunda.sample);
            if (lit)
                reglas.push({ label: "ruido", pattern: lit, action: "hide" });
        }
        if (reglas.length)
            p.rules = reglas;
        return p;
    }
}
