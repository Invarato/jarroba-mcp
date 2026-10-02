export interface ChmodBit {
    read: boolean;
    write: boolean;
    execute: boolean;
}
export interface ChmodSpecial {
    setuid: boolean;
    setgid: boolean;
    sticky: boolean;
}
export interface ChmodState {
    owner: ChmodBit;
    group: ChmodBit;
    others: ChmodBit;
    special: ChmodSpecial;
}
const NO_SPECIAL: ChmodSpecial = { setuid: false, setgid: false, sticky: false };
export type ChmodAviso = "escritura-otros" | "setuid" | "setuid-escribible" | "setgid-escribible";
export class ChmodService {
    fromOctal(octal: string): ChmodState | null {
        if (!/^[0-7]{3,4}$/.test(octal))
            return null;
        const digits = octal.length === 4 ? octal : "0" + octal;
        const sp = parseInt(digits[0], 8);
        const parse = (n: number): ChmodBit => ({
            read: (n & 4) !== 0,
            write: (n & 2) !== 0,
            execute: (n & 1) !== 0,
        });
        return {
            special: { setuid: (sp & 4) !== 0, setgid: (sp & 2) !== 0, sticky: (sp & 1) !== 0 },
            owner: parse(parseInt(digits[1], 8)),
            group: parse(parseInt(digits[2], 8)),
            others: parse(parseInt(digits[3], 8)),
        };
    }
    fromSymbolic(sym: string): ChmodState | null {
        let s = (sym ?? "").trim();
        if (s.length === 10)
            s = s.slice(1);
        if (!/^[r-][w-][xsS-][r-][w-][xsS-][r-][w-][xtT-]$/.test(s))
            return null;
        const execOwner = (c: string) => ({ execute: c === "x" || c === "s", special: c === "s" || c === "S" });
        const execOther = (c: string) => ({ execute: c === "x" || c === "t", special: c === "t" || c === "T" });
        const o = execOwner(s[2]);
        const g = execOwner(s[5]);
        const t = execOther(s[8]);
        return {
            special: { setuid: o.special, setgid: g.special, sticky: t.special },
            owner: { read: s[0] === "r", write: s[1] === "w", execute: o.execute },
            group: { read: s[3] === "r", write: s[4] === "w", execute: g.execute },
            others: { read: s[6] === "r", write: s[7] === "w", execute: t.execute },
        };
    }
    private specialDigit(s: ChmodState): number {
        const sp = s.special ?? NO_SPECIAL;
        return (sp.setuid ? 4 : 0) + (sp.setgid ? 2 : 0) + (sp.sticky ? 1 : 0);
    }
    toOctal(s: ChmodState): string {
        const calc = (b: ChmodBit): number => (b.read ? 4 : 0) + (b.write ? 2 : 0) + (b.execute ? 1 : 0);
        const base = `${calc(s.owner)}${calc(s.group)}${calc(s.others)}`;
        const sp = this.specialDigit(s);
        return sp ? `${sp}${base}` : base;
    }
    toSymbolic(s: ChmodState): string {
        const sp = s.special ?? NO_SPECIAL;
        const triad = (b: ChmodBit, special: boolean, ch: string): string => `${b.read ? "r" : "-"}${b.write ? "w" : "-"}${this.execChar(b.execute, special, ch)}`;
        return triad(s.owner, sp.setuid, "s") + triad(s.group, sp.setgid, "s") + triad(s.others, sp.sticky, "t");
    }
    private execChar(execute: boolean, special: boolean, ch: string): string {
        if (special)
            return execute ? ch : ch.toUpperCase();
        return execute ? "x" : "-";
    }
    toBinary(s: ChmodState): string {
        const bin = (b: ChmodBit): string => `${b.read ? "1" : "0"}${b.write ? "1" : "0"}${b.execute ? "1" : "0"}`;
        const base = `${bin(s.owner)} ${bin(s.group)} ${bin(s.others)}`;
        if (!this.specialDigit(s))
            return base;
        const sp = s.special ?? NO_SPECIAL;
        return `${sp.setuid ? "1" : "0"}${sp.setgid ? "1" : "0"}${sp.sticky ? "1" : "0"} ${base}`;
    }
    toSymbolicAssignRecursivo(s: ChmodState): string {
        return this.toSymbolicAssign(s).replace(/x/g, "X");
    }
    avisos(s: ChmodState): ChmodAviso[] {
        const sp = s.special ?? NO_SPECIAL;
        const out: ChmodAviso[] = [];
        if (s.others.write && !sp.sticky)
            out.push("escritura-otros");
        if (sp.setuid && (s.group.write || s.others.write))
            out.push("setuid-escribible");
        else if (sp.setuid)
            out.push("setuid");
        if (sp.setgid && (s.group.write || s.others.write) && s.owner.execute)
            out.push("setgid-escribible");
        return out;
    }
    toSymbolicAssign(s: ChmodState): string {
        const sp = s.special ?? NO_SPECIAL;
        const part = (b: ChmodBit, special: boolean, ch: string): string => `${b.read ? "r" : ""}${b.write ? "w" : ""}${b.execute ? "x" : ""}${special ? ch : ""}`;
        return `u=${part(s.owner, sp.setuid, "s")},g=${part(s.group, sp.setgid, "s")},o=${part(s.others, sp.sticky, "t")}`;
    }
}
