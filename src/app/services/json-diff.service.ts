export type DiffType = "added" | "removed" | "changed" | "type-changed";
export interface JsonDiffEntry {
    path: string;
    type: DiffType;
    oldValue?: unknown;
    newValue?: unknown;
}
export class JsonDiffService {
    diff(jsonA: string, jsonB: string): JsonDiffEntry[] | null {
        let a: unknown, b: unknown;
        try {
            a = JSON.parse(jsonA);
        }
        catch {
            return null;
        }
        try {
            b = JSON.parse(jsonB);
        }
        catch {
            return null;
        }
        const entries: JsonDiffEntry[] = [];
        this.compare(a, b, "", entries);
        return entries;
    }
    private compare(a: unknown, b: unknown, path: string, entries: JsonDiffEntry[]): void {
        if (typeof a !== typeof b) {
            entries.push({ path: path || "(root)", type: "type-changed", oldValue: a, newValue: b });
            return;
        }
        if (a === null || b === null) {
            if (a !== b)
                entries.push({ path: path || "(root)", type: "changed", oldValue: a, newValue: b });
            return;
        }
        if (Array.isArray(a) && Array.isArray(b)) {
            const maxLen = Math.max(a.length, b.length);
            for (let i = 0; i < maxLen; i++) {
                const p = path ? `${path}[${i}]` : `[${i}]`;
                if (i >= a.length) {
                    entries.push({ path: p, type: "added", newValue: b[i] });
                }
                else if (i >= b.length) {
                    entries.push({ path: p, type: "removed", oldValue: a[i] });
                }
                else {
                    this.compare(a[i], b[i], p, entries);
                }
            }
            return;
        }
        if (typeof a === "object" && typeof b === "object" && !Array.isArray(a)) {
            const aObj = a as Record<string, unknown>;
            const bObj = b as Record<string, unknown>;
            const allKeys = new Set([...Object.keys(aObj), ...Object.keys(bObj)]);
            for (const key of allKeys) {
                const p = path ? `${path}.${key}` : key;
                if (!(key in aObj)) {
                    entries.push({ path: p, type: "added", newValue: bObj[key] });
                }
                else if (!(key in bObj)) {
                    entries.push({ path: p, type: "removed", oldValue: aObj[key] });
                }
                else {
                    this.compare(aObj[key], bObj[key], p, entries);
                }
            }
            return;
        }
        if (a !== b) {
            entries.push({ path: path || "(root)", type: "changed", oldValue: a, newValue: b });
        }
    }
}
