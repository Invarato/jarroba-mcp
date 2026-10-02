import { Injectable } from "@angular/core";
export interface ParsedVersion {
    major: number;
    minor: number;
    patch: number;
    prerelease: string[];
}
function parseVersion(v: string): ParsedVersion | null {
    const m = v.trim().match(/^v?(\d+)\.(\d+)\.(\d+)(?:-([^\+]*))?/);
    if (!m)
        return null;
    return {
        major: +m[1],
        minor: +m[2],
        patch: +m[3],
        prerelease: m[4] ? m[4].split(".") : [],
    };
}
function coerce(v: string): string | null {
    const m = v.trim().match(/(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
    if (!m)
        return null;
    return `${+m[1]}.${+(m[2] ?? 0)}.${+(m[3] ?? 0)}`;
}
function compareVersions(a: ParsedVersion, b: ParsedVersion): number {
    if (a.major !== b.major)
        return a.major - b.major;
    if (a.minor !== b.minor)
        return a.minor - b.minor;
    if (a.patch !== b.patch)
        return a.patch - b.patch;
    if (a.prerelease.length === 0 && b.prerelease.length > 0)
        return 1;
    if (a.prerelease.length > 0 && b.prerelease.length === 0)
        return -1;
    const len = Math.max(a.prerelease.length, b.prerelease.length);
    for (let i = 0; i < len; i++) {
        const ai = a.prerelease[i];
        const bi = b.prerelease[i];
        if (ai === undefined)
            return -1;
        if (bi === undefined)
            return 1;
        const na = +ai, nb = +bi;
        if (!isNaN(na) && !isNaN(nb)) {
            if (na !== nb)
                return na - nb;
        }
        else {
            if (ai < bi)
                return -1;
            if (ai > bi)
                return 1;
        }
    }
    return 0;
}
function satisfiesComparator(ver: ParsedVersion, op: string, comp: ParsedVersion): boolean {
    const c = compareVersions(ver, comp);
    switch (op) {
        case ">=": return c >= 0;
        case "<=": return c <= 0;
        case ">": return c > 0;
        case "<": return c < 0;
        case "=":
        case "==":
        case "": return c === 0;
        default: return false;
    }
}
function satisfiesSingle(ver: ParsedVersion, range: string): boolean {
    range = range.trim();
    if (!range || range === "*")
        return true;
    const hyphenM = range.match(/^(.+?)\s+-\s+(.+)$/);
    if (hyphenM) {
        const lo = parseVersion(hyphenM[1]);
        const hi = parseVersion(hyphenM[2]);
        if (!lo || !hi)
            return false;
        return compareVersions(ver, lo) >= 0 && compareVersions(ver, hi) <= 0;
    }
    const caretM = range.match(/^\^(\d+)\.(\d+)\.(\d+)/);
    if (caretM) {
        const major = +caretM[1], minor = +caretM[2], patch = +caretM[3];
        const lo: ParsedVersion = { major, minor, patch, prerelease: [] };
        const hi: ParsedVersion = { major: major + 1, minor: 0, patch: 0, prerelease: [] };
        return compareVersions(ver, lo) >= 0 && compareVersions(ver, hi) < 0;
    }
    const caretMinor = range.match(/^\^(\d+)\.(\d+)$/);
    if (caretMinor) {
        const major = +caretMinor[1], minor = +caretMinor[2];
        const lo: ParsedVersion = { major, minor, patch: 0, prerelease: [] };
        const hi: ParsedVersion = { major: major + 1, minor: 0, patch: 0, prerelease: [] };
        return compareVersions(ver, lo) >= 0 && compareVersions(ver, hi) < 0;
    }
    const caretMaj = range.match(/^\^(\d+)$/);
    if (caretMaj) {
        const major = +caretMaj[1];
        const lo: ParsedVersion = { major, minor: 0, patch: 0, prerelease: [] };
        const hi: ParsedVersion = { major: major + 1, minor: 0, patch: 0, prerelease: [] };
        return compareVersions(ver, lo) >= 0 && compareVersions(ver, hi) < 0;
    }
    const tildeM = range.match(/^~(\d+)\.(\d+)\.(\d+)/);
    if (tildeM) {
        const major = +tildeM[1], minor = +tildeM[2], patch = +tildeM[3];
        const lo: ParsedVersion = { major, minor, patch, prerelease: [] };
        const hi: ParsedVersion = { major, minor: minor + 1, patch: 0, prerelease: [] };
        return compareVersions(ver, lo) >= 0 && compareVersions(ver, hi) < 0;
    }
    const tildeMinor = range.match(/^~(\d+)\.(\d+)$/);
    if (tildeMinor) {
        const major = +tildeMinor[1], minor = +tildeMinor[2];
        const lo: ParsedVersion = { major, minor, patch: 0, prerelease: [] };
        const hi: ParsedVersion = { major, minor: minor + 1, patch: 0, prerelease: [] };
        return compareVersions(ver, lo) >= 0 && compareVersions(ver, hi) < 0;
    }
    const tildeMaj = range.match(/^~(\d+)$/);
    if (tildeMaj) {
        const major = +tildeMaj[1];
        const lo: ParsedVersion = { major, minor: 0, patch: 0, prerelease: [] };
        const hi: ParsedVersion = { major: major + 1, minor: 0, patch: 0, prerelease: [] };
        return compareVersions(ver, lo) >= 0 && compareVersions(ver, hi) < 0;
    }
    const wildcardM = range.match(/^(\d+|\*)\.(\d+|\*)(?:\.(\d+|\*))?$/);
    if (wildcardM) {
        const maj = wildcardM[1], min = wildcardM[2], pat = wildcardM[3];
        if (maj === "*")
            return true;
        if (+maj !== ver.major)
            return false;
        if (!min || min === "*")
            return true;
        if (+min !== ver.minor)
            return false;
        if (!pat || pat === "*")
            return true;
        return +pat === ver.patch;
    }
    const compM = range.match(/^(>=|<=|>|<|=|==)?\s*v?(\d+\.\d+\.\d+(?:-[^\s+]*)?)/);
    if (compM) {
        const comp = parseVersion(compM[2]);
        if (!comp)
            return false;
        return satisfiesComparator(ver, compM[1] ?? "", comp);
    }
    return false;
}
function satisfiesRange(ver: ParsedVersion, range: string): boolean {
    const orParts = range.split("||");
    if (orParts.length > 1) {
        return orParts.some(part => satisfiesRange(ver, part.trim()));
    }
    const trimmed = range.trim();
    if (/^\S.*\s+-\s+\S.*$/.test(trimmed))
        return satisfiesSingle(ver, trimmed);
    const andParts = trimmed.split(/\s+(?=[>=<!^~]|\d)/);
    return andParts.every(part => satisfiesSingle(ver, part.trim()));
}
@Injectable({ providedIn: "root" })
export class SemverService {
    check(version: string, range: string): boolean | null {
        try {
            const coerced = coerce(version);
            if (!coerced)
                return null;
            const v = parseVersion(coerced);
            if (!v)
                return null;
            return satisfiesRange(v, range.trim());
        }
        catch {
            return null;
        }
    }
    satisfies(range: string, versions: string[]): string[] {
        return versions.filter(v => {
            try {
                const coerced = coerce(v);
                if (!coerced)
                    return false;
                const pv = parseVersion(coerced);
                if (!pv)
                    return false;
                return satisfiesRange(pv, range.trim());
            }
            catch {
                return false;
            }
        });
    }
    parseVersion(v: string): ParsedVersion | null {
        return parseVersion(v);
    }
}
