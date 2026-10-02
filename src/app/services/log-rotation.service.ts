export interface RotatedFile {
    name: string;
    family: string;
    order: number;
    index: number | null;
    date: string | null;
    compressed: boolean;
}
export interface RotationFamily {
    name: string;
    files: RotatedFile[];
}
const EXT_LOG = /\.(log|out|err|txt|jsonl|ndjson)$/i;
const SIN_EXT = /^(syslog|messages|dmesg|kern|auth|secure|daemon|debug|boot|faillog|lastlog)$/i;
const EXT_COMP = /\.(gz|bz2|xz|zst|zip|Z)$/i;
const NO_ES_LOG = /^(\.|~)|\.(pid|lock|sock|conf|cfg|ya?ml|json|db|sqlite3?|idx|swp|tmp)$/i;
const TRAMO_FECHA = -2000000000000000;
const TRAMO_INDICE = -1000000000000000;
export function looksLikeLog(name: string): boolean {
    const base = name.replace(/\.(gz|bz2|xz|zst|zip|Z)$/i, "");
    if (NO_ES_LOG.test(base))
        return false;
    if (EXT_LOG.test(base) || SIN_EXT.test(base))
        return true;
    return /\.(log|out|err)\.\d+$/i.test(base);
}
export function parseRotated(name: string): RotatedFile {
    const compressed = EXT_COMP.test(name);
    const sinComp = name.replace(EXT_COMP, "");
    const porIndice = /^(.*?)\.(\d{1,4})$/.exec(sinComp);
    if (porIndice && EXT_LOG.test(porIndice[1])) {
        const idx = Number(porIndice[2]);
        return { name, family: porIndice[1], order: TRAMO_INDICE - idx, index: idx, date: null, compressed };
    }
    const ext = EXT_LOG.exec(sinComp);
    const cuerpo = ext ? sinComp.slice(0, ext.index) : sinComp;
    const porFecha = /^(.*?)[-_.](\d{4})-?(\d{2})-?(\d{2})(?:[-_.]?(\d{2})[-_.]?(\d{2})?)?$/.exec(cuerpo);
    if (porFecha) {
        const [, base, a, m, d, h, mi] = porFecha;
        const fecha = `${a}-${m}-${d}`;
        const ms = Date.UTC(+a, +m - 1, +d, h ? +h : 0, mi ? +mi : 0);
        return {
            name,
            family: `${base}${ext ? ext[0] : ""}`,
            order: TRAMO_FECHA + ms,
            index: null,
            date: fecha,
            compressed,
        };
    }
    return { name, family: sinComp, order: 0, index: null, date: null, compressed };
}
export function groupRotations(names: string[]): RotationFamily[] {
    const porFamilia = new Map<string, RotatedFile[]>();
    for (const n of names) {
        if (!looksLikeLog(n))
            continue;
        const r = parseRotated(n);
        const lista = porFamilia.get(r.family);
        if (lista)
            lista.push(r);
        else
            porFamilia.set(r.family, [r]);
    }
    const familias: RotationFamily[] = [];
    for (const [name, files] of porFamilia) {
        files.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
        familias.push({ name, files });
    }
    familias.sort((a, b) => b.files.length - a.files.length || a.name.localeCompare(b.name));
    return familias;
}
export function sortChronologically(names: string[]): string[] {
    return [...names].sort((a, b) => {
        const ra = parseRotated(a), rb = parseRotated(b);
        return ra.order - rb.order || a.localeCompare(b);
    });
}
