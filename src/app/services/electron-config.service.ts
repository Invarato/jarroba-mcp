import { Injectable } from "@angular/core";
export const SUBSHELL_LETTERS = ["s", "p", "d", "f", "g", "h"] as const;
export interface OrbitalBox {
    ml: number;
    label: string;
    up: boolean;
    down: boolean;
}
export interface Subshell {
    n: number;
    l: number;
    label: string;
    letter: string;
    orbitals: OrbitalBox[];
    electrons: number;
    capacity: number;
}
export interface Shell {
    n: number;
    subshells: Subshell[];
    electrons: number;
    capacity: number;
}
export interface AtomStructure {
    z: number;
    electrons: number;
    charge: number;
    shells: Shell[];
    valenceShellN: number;
    valenceElectrons: number;
    unpaired: number;
    config: string;
    configShort: string;
    anomalous: boolean;
    madelungPrediction: string | null;
}
export interface SubshellFill {
    n: number;
    l: number;
    count: number;
}
const ANOMALIES: Record<number, ReadonlyArray<readonly [
    n: number,
    l: number,
    count: number
]>> = {
    24: [[3, 2, 5], [4, 0, 1]],
    29: [[3, 2, 10], [4, 0, 1]],
    41: [[4, 2, 4], [5, 0, 1]],
    42: [[4, 2, 5], [5, 0, 1]],
    44: [[4, 2, 7], [5, 0, 1]],
    45: [[4, 2, 8], [5, 0, 1]],
    46: [[4, 2, 10]],
    47: [[4, 2, 10], [5, 0, 1]],
    78: [[4, 3, 14], [5, 2, 9], [6, 0, 1]],
    79: [[4, 3, 14], [5, 2, 10], [6, 0, 1]],
    57: [[5, 2, 1], [6, 0, 2]],
    58: [[4, 3, 1], [5, 2, 1], [6, 0, 2]],
    64: [[4, 3, 7], [5, 2, 1], [6, 0, 2]],
    89: [[6, 2, 1], [7, 0, 2]],
    90: [[6, 2, 2], [7, 0, 2]],
    91: [[5, 3, 2], [6, 2, 1], [7, 0, 2]],
    92: [[5, 3, 3], [6, 2, 1], [7, 0, 2]],
    93: [[5, 3, 4], [6, 2, 1], [7, 0, 2]],
    96: [[5, 3, 7], [6, 2, 1], [7, 0, 2]],
    103: [[5, 3, 14], [7, 0, 2], [7, 1, 1]],
};
const NOBLE_Z = [2, 10, 18, 36, 54, 86, 118];
const NOBLE_SYMBOL: Record<number, string> = {
    2: "He",
    10: "Ne",
    18: "Ar",
    36: "Kr",
    54: "Xe",
    86: "Rn",
    118: "Og",
};
export function subshellCapacity(l: number): number {
    return 2 * (2 * entero(l) + 1);
}
function entero(v: number): number {
    return Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0;
}
export function madelungOrder(maxN = 8): SubshellFill[] {
    const top = Number.isNaN(maxN) ? 8 : Math.min(10, Math.max(0, Math.floor(maxN)));
    const out: {
        n: number;
        l: number;
    }[] = [];
    for (let n = 1; n <= top; n++) {
        for (let l = 0; l < n; l++)
            out.push({ n, l });
    }
    out.sort((a, b) => (a.n + a.l) - (b.n + b.l) || a.n - b.n);
    return out.map(s => ({ ...s, count: 0 }));
}
@Injectable({ providedIn: "root" })
export class ElectronConfigService {
    madelungConfig(electrons: number): SubshellFill[] {
        const out: SubshellFill[] = [];
        let left = entero(electrons);
        for (const s of madelungOrder()) {
            if (left <= 0)
                break;
            const take = Math.min(left, subshellCapacity(s.l));
            out.push({ n: s.n, l: s.l, count: take });
            left -= take;
        }
        return out;
    }
    neutralConfig(z: number): SubshellFill[] {
        const anomaly = ANOMALIES[entero(z)];
        if (!anomaly)
            return this.madelungConfig(z);
        const core = NOBLE_Z.filter(n => n < z).pop() ?? 0;
        const base = this.madelungConfig(core);
        const out = base.map(s => ({ ...s }));
        for (const [n, l, count] of anomaly) {
            const hit = out.find(s => s.n === n && s.l === l);
            if (hit)
                hit.count = count;
            else
                out.push({ n, l, count });
        }
        return out.filter(s => s.count > 0);
    }
    ionConfig(z: number, charge: number): SubshellFill[] {
        const config = this.neutralConfig(z).map(s => ({ ...s }));
        let toRemove = Number.isFinite(charge) ? Math.floor(charge) : 0;
        if (toRemove > 0) {
            while (toRemove > 0) {
                const occupied = config.filter(s => s.count > 0);
                if (!occupied.length)
                    break;
                occupied.sort((a, b) => b.n - a.n || b.l - a.l);
                const target = occupied[0];
                const take = Math.min(toRemove, target.count);
                target.count -= take;
                toRemove -= take;
            }
            return config.filter(s => s.count > 0);
        }
        let toAdd = -toRemove;
        for (const slot of madelungOrder()) {
            if (toAdd <= 0)
                break;
            const cap = subshellCapacity(slot.l);
            const hit = config.find(s => s.n === slot.n && s.l === slot.l);
            const has = hit?.count ?? 0;
            const room = cap - has;
            if (room <= 0)
                continue;
            const put = Math.min(toAdd, room);
            if (hit)
                hit.count += put;
            else
                config.push({ n: slot.n, l: slot.l, count: has + put });
            toAdd -= put;
        }
        return config.filter(s => s.count > 0);
    }
    structure(z: number, charge = 0): AtomStructure {
        const electrons = entero(entero(z) - (Number.isFinite(charge) ? charge : 0));
        const fills = charge === 0 ? this.neutralConfig(z) : this.ionConfig(z, charge);
        const byN = new Map<number, Subshell[]>();
        let unpaired = 0;
        for (const f of [...fills].sort((a, b) => a.n - b.n || a.l - b.l)) {
            if (f.count <= 0)
                continue;
            const letter = SUBSHELL_LETTERS[f.l] ?? `l${f.l}`;
            const label = `${f.n}${letter}`;
            const nOrb = 2 * f.l + 1;
            const orbitals: OrbitalBox[] = [];
            for (let i = 0; i < nOrb; i++) {
                orbitals.push({ ml: i - f.l, label, up: false, down: false });
            }
            let left = f.count;
            for (let i = 0; i < nOrb && left > 0; i++) {
                orbitals[i].up = true;
                left--;
            }
            for (let i = 0; i < nOrb && left > 0; i++) {
                orbitals[i].down = true;
                left--;
            }
            unpaired += orbitals.filter(o => o.up !== o.down).length;
            const sub: Subshell = {
                n: f.n,
                l: f.l,
                label,
                letter,
                orbitals,
                electrons: f.count,
                capacity: subshellCapacity(f.l),
            };
            const list = byN.get(f.n) ?? [];
            list.push(sub);
            byN.set(f.n, list);
        }
        const shells: Shell[] = [...byN.entries()]
            .sort((a, b) => a[0] - b[0])
            .map(([n, subshells]) => ({
            n,
            subshells,
            electrons: subshells.reduce((acc, s) => acc + s.electrons, 0),
            capacity: 2 * n * n,
        }));
        const valence = shells.length ? shells[shells.length - 1] : null;
        const madelung = this.formatShort(this.madelungConfig(z));
        const real = this.formatConfig(fills);
        const anomalous = charge === 0 && !!ANOMALIES[z];
        return {
            z: entero(z),
            electrons,
            charge: Number.isFinite(charge) ? charge : 0,
            shells,
            valenceShellN: valence?.n ?? 0,
            valenceElectrons: valence?.electrons ?? 0,
            unpaired,
            config: real,
            configShort: this.formatShort(fills),
            anomalous,
            madelungPrediction: anomalous ? madelung : null,
        };
    }
    formatConfig(fills: SubshellFill[]): string {
        return [...fills]
            .filter(f => f.count > 0)
            .sort((a, b) => a.n - b.n || a.l - b.l)
            .map(f => `${f.n}${SUBSHELL_LETTERS[f.l] ?? "?"}${f.count}`)
            .join(" ");
    }
    formatShort(fills: SubshellFill[]): string {
        const total = fills.reduce((a, f) => a + f.count, 0);
        const core = NOBLE_Z.filter(n => n < total).pop();
        if (!core)
            return this.formatConfig(fills);
        const coreFills = this.madelungConfig(core);
        const rest = fills
            .map(f => {
            const inCore = coreFills.find(c => c.n === f.n && c.l === f.l)?.count ?? 0;
            return { ...f, count: f.count - inCore };
        })
            .filter(f => f.count > 0);
        return `[${NOBLE_SYMBOL[core]}] ${this.formatConfig(rest)}`.trim();
    }
    isAnomalous(z: number): boolean {
        return !!ANOMALIES[z];
    }
    anomalousZ(): number[] {
        return Object.keys(ANOMALIES).map(Number).sort((a, b) => a - b);
    }
}
