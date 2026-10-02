import * as jsYaml from "js-yaml";
export type FormatType = "json" | "yaml" | "properties" | "env" | "csv" | "markdown";
export interface FormatOption {
    value: FormatType;
    label: string;
}
function firstContentLine(text: string): string {
    for (const line of text.split("\n")) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith("#") && !trimmed.startsWith("!")) {
            return trimmed;
        }
    }
    return "";
}
function parseJson(text: string): unknown {
    return JSON.parse(text);
}
function parseYaml(text: string): unknown {
    return jsYaml.load(text);
}
function parseProperties(text: string): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const rawLine of text.split("\n")) {
        const line = rawLine.trim();
        if (!line || line.startsWith("#") || line.startsWith("!"))
            continue;
        const eqIdx = line.indexOf("=");
        if (eqIdx < 0)
            continue;
        const key = line.slice(0, eqIdx).trim();
        const value = line.slice(eqIdx + 1);
        setNestedKey(result, key.split("."), value);
    }
    return result;
}
function setNestedKey(obj: Record<string, unknown>, parts: string[], value: string): void {
    let current = obj;
    for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (typeof current[part] !== "object" || current[part] === null) {
            current[part] = {};
        }
        current = current[part] as Record<string, unknown>;
    }
    current[parts[parts.length - 1]] = value;
}
function parseEnv(text: string): Record<string, string> {
    const result: Record<string, string> = {};
    for (const rawLine of text.split("\n")) {
        const line = rawLine.trim();
        if (!line || line.startsWith("#"))
            continue;
        const eqIdx = line.indexOf("=");
        if (eqIdx < 0)
            continue;
        const key = line.slice(0, eqIdx).trim();
        let value = line.slice(eqIdx + 1);
        if ((value.startsWith("\"") && value.endsWith("\"")) ||
            (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }
        result[key] = value;
    }
    return result;
}
function parseCsvLine(line: string): string[] {
    const fields: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === "\"") {
            if (inQuotes && line[i + 1] === "\"") {
                current += "\"";
                i++;
            }
            else {
                inQuotes = !inQuotes;
            }
        }
        else if (ch === "," && !inQuotes) {
            fields.push(current);
            current = "";
        }
        else {
            current += ch;
        }
    }
    fields.push(current);
    return fields;
}
function parseSeparated(text: string, delim: "," | "\t"): Record<string, string>[] {
    const lines = text.split("\n").filter(l => l.trim() !== "");
    if (lines.length < 2)
        return [];
    const parseLine = delim === "," ? parseCsvLine : (l: string) => l.split("\t");
    const headers = parseLine(lines[0]).map(h => h.trim());
    const rows: Record<string, string>[] = [];
    for (let i = 1; i < lines.length; i++) {
        const values = parseLine(lines[i]);
        const row: Record<string, string> = {};
        headers.forEach((h, idx) => { row[h] = (values[idx] ?? "").trim(); });
        rows.push(row);
    }
    return rows;
}
function parseMarkdownTable(text: string): Record<string, string>[] {
    const lines = text.split("\n").map(l => l.trim()).filter(l => l !== "");
    if (lines.length < 2)
        return [];
    const parseRow = (line: string): string[] => line.replace(/^\||\|$/g, "").split("|").map(c => c.trim());
    const headers = parseRow(lines[0]);
    const rows: Record<string, string>[] = [];
    for (let i = 1; i < lines.length; i++) {
        if (/^\|[\s\-:|]+\|$/.test(lines[i]))
            continue;
        const values = parseRow(lines[i]);
        const row: Record<string, string> = {};
        headers.forEach((h, idx) => { row[h] = values[idx] ?? ""; });
        rows.push(row);
    }
    return rows;
}
function parseCsv(text: string): Record<string, string>[] {
    const raw = text.trim();
    const firstNonEmpty = raw.split("\n").find(l => l.trim() !== "") ?? "";
    if (firstNonEmpty.trimStart().startsWith("|"))
        return parseMarkdownTable(raw);
    const tabCount = (firstNonEmpty.match(/\t/g) ?? []).length;
    const commaCount = (firstNonEmpty.match(/,/g) ?? []).length;
    return parseSeparated(raw, tabCount > commaCount ? "\t" : ",");
}
function serializeJson(obj: unknown): string {
    return JSON.stringify(obj, null, 2);
}
function serializeYaml(obj: unknown): string {
    return jsYaml.dump(obj, { lineWidth: -1 });
}
function isScalar(v: unknown): boolean {
    return v === null || v === undefined || typeof v === "string" || typeof v === "number" || typeof v === "boolean";
}
function flattenToProperties(obj: unknown, prefix: string = ""): string[] {
    if (Array.isArray(obj))
        throw new Error("Arrays are not representable in Properties");
    const lines: string[] = [];
    if (obj !== null && typeof obj === "object") {
        for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
            const fullKey = prefix ? `${prefix}.${k}` : k;
            lines.push(...flattenToProperties(v, fullKey));
        }
    }
    else {
        lines.push(`${prefix}=${String(obj ?? "")}`);
    }
    return lines;
}
function serializeProperties(obj: unknown): string {
    return flattenToProperties(obj).join("\n");
}
function serializeEnv(obj: unknown): string {
    if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
        throw new Error("ENV serialization requires a flat object");
    }
    const entries = Object.entries(obj as Record<string, unknown>);
    if (!entries.every(([, v]) => isScalar(v))) {
        throw new Error("ENV serialization requires flat scalar values (no nested objects or arrays)");
    }
    return entries.map(([k, v]) => `${k.toUpperCase()}=${String(v ?? "")}`).join("\n");
}
function csvField(value: string): string {
    const str = String(value ?? "");
    return str.includes(",") || str.includes("\"") || str.includes("\n")
        ? `"${str.replace(/"/g, "\"\"")}"`
        : str;
}
const cell = (v: unknown): string => (isScalar(v) ? String(v ?? "") : JSON.stringify(v));
function isRowArray(a: unknown): a is Record<string, unknown>[] {
    return Array.isArray(a) && a.length > 0 && a.every(r => r !== null && typeof r === "object" && !Array.isArray(r));
}
export function toTabular(obj: unknown): Record<string, unknown>[] | null {
    if (isRowArray(obj))
        return obj;
    if (obj !== null && typeof obj === "object" && !Array.isArray(obj)) {
        const entries = Object.entries(obj as Record<string, unknown>);
        const arrays = entries.filter(([, v]) => isRowArray(v));
        if (arrays.length === 1)
            return arrays[0][1] as Record<string, unknown>[];
        if (arrays.length === 0 && entries.length > 0 && entries.every(([, v]) => isScalar(v)))
            return [obj as Record<string, unknown>];
    }
    return null;
}
function tableHeaders(rows: Record<string, unknown>[]): string[] {
    const seen = new Set<string>();
    const headers: string[] = [];
    for (const r of rows)
        for (const k of Object.keys(r))
            if (!seen.has(k)) {
                seen.add(k);
                headers.push(k);
            }
    return headers;
}
function serializeCsv(obj: unknown): string {
    const rows = toTabular(obj);
    if (!rows)
        throw new Error("CSV requires an array of objects (or an object containing one)");
    const headers = tableHeaders(rows);
    const lines: string[] = [headers.map(csvField).join(",")];
    for (const row of rows)
        lines.push(headers.map(h => csvField(cell(row[h]))).join(","));
    return lines.join("\n");
}
function serializeMarkdownTable(obj: unknown): string {
    const rows = toTabular(obj);
    if (!rows)
        throw new Error("Markdown table requires an array of objects (or an object containing one)");
    const headers = tableHeaders(rows);
    const headerRow = "| " + headers.join(" | ") + " |";
    const separator = "| " + headers.map(() => "---").join(" | ") + " |";
    const dataRows = rows.map(row => "| " + headers.map(h => cell(row[h])).join(" | ") + " |");
    return [headerRow, separator, ...dataRows].join("\n");
}
export class FormatConverterService {
    detect(text: string): FormatType {
        const trimmed = text.trim();
        if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
            return "json";
        }
        const nonEmptyLines = trimmed.split("\n").filter(l => l.trim() !== "");
        if (nonEmptyLines.length === 0)
            return "yaml";
        const firstLine = firstContentLine(trimmed) || nonEmptyLines[0].trim();
        if (firstLine.startsWith("|") && firstLine.endsWith("|")) {
            return "markdown";
        }
        if (/^[A-Z][A-Z0-9_]*=/.test(firstLine)) {
            return "env";
        }
        if (/^\w[\w.]*\w\s*=/.test(firstLine)) {
            return "properties";
        }
        if (nonEmptyLines.length >= 2) {
            const tabCount = (firstLine.match(/\t/g) ?? []).length;
            if (tabCount > 0 && nonEmptyLines[1].includes("\t")) {
                return "csv";
            }
            const countCommas = (line: string): number => {
                let count = 0;
                let inQ = false;
                for (const ch of line) {
                    if (ch === "\"")
                        inQ = !inQ;
                    else if (ch === "," && !inQ)
                        count++;
                }
                return count;
            };
            const firstCount = countCommas(firstLine);
            if (firstCount > 0 && nonEmptyLines.slice(1).every(l => countCommas(l) === firstCount)) {
                return "csv";
            }
        }
        return "yaml";
    }
    parseCsvPublic(input: string): unknown {
        return parseCsv(input);
    }
    parsePublic(input: string, from: FormatType): unknown | null {
        try {
            switch (from) {
                case "json": return parseJson(input);
                case "yaml": return parseYaml(input);
                case "properties": return parseProperties(input);
                case "env": return parseEnv(input);
                case "csv": return parseCsv(input);
                case "markdown": return parseMarkdownTable(input);
                default: return null;
            }
        }
        catch {
            return null;
        }
    }
    isTabular(obj: unknown): boolean { return toTabular(obj) !== null; }
    serializePublic(obj: unknown, to: FormatType): string | null {
        try {
            switch (to) {
                case "json": return serializeJson(obj);
                case "yaml": return serializeYaml(obj);
                case "properties": return serializeProperties(obj);
                case "env": return serializeEnv(obj);
                case "csv": return serializeCsv(obj);
                case "markdown": return serializeMarkdownTable(obj);
                default: return null;
            }
        }
        catch {
            return null;
        }
    }
    convert(input: string, from: FormatType, to: FormatType): string | null {
        if (!input.trim())
            return null;
        let parsed: unknown;
        try {
            switch (from) {
                case "json":
                    parsed = parseJson(input);
                    break;
                case "yaml":
                    parsed = parseYaml(input);
                    break;
                case "properties":
                    parsed = parseProperties(input);
                    break;
                case "env":
                    parsed = parseEnv(input);
                    break;
                case "csv":
                    parsed = parseCsv(input);
                    break;
                case "markdown":
                    parsed = parseMarkdownTable(input);
                    break;
            }
        }
        catch {
            return null;
        }
        try {
            switch (to) {
                case "json": return serializeJson(parsed);
                case "yaml": return serializeYaml(parsed);
                case "properties": return serializeProperties(parsed);
                case "env": return serializeEnv(parsed);
                case "csv": return serializeCsv(parsed);
                case "markdown": return serializeMarkdownTable(parsed);
            }
        }
        catch {
            return null;
        }
    }
}
