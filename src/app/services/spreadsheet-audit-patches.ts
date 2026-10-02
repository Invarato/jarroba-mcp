import FormulaParser, { FormulaError } from "fast-formula-parser";
const H = FormulaParser.FormulaHelpers;
const T = FormulaParser.Types;
function numeros(args: unknown[]): number[] {
    const out: number[] = [];
    H.flattenParams(args, T.NUMBER, true, (item: unknown) => {
        if (typeof item === "number")
            out.push(item);
    });
    return out;
}
function vector(arg: unknown): unknown[] {
    const v = H.accept(arg, T.ARRAY, undefined, true);
    if (Array.isArray(v))
        return (v as unknown[]).flat(2);
    return [v];
}
export const PARCHES_SPREADSHEET_AUDIT: Record<string, (...args: unknown[]) => unknown> = {
    MIN: (...args: unknown[]) => {
        const ns = numeros(args);
        return ns.length ? Math.min(...ns) : 0;
    },
    MAX: (...args: unknown[]) => {
        const ns = numeros(args);
        return ns.length ? Math.max(...ns) : 0;
    },
    MATCH: (lookupValue: unknown, lookupArray: unknown, matchType: unknown) => {
        const valor = H.accept(lookupValue);
        const vec = vector(lookupArray);
        const tipo = matchType === undefined ? 1 : (H.accept(matchType, T.NUMBER) as number);
        if (tipo === 0) {
            const i = vec.findIndex(v => coincide(v, valor));
            if (i === -1)
                throw FormulaError.NA;
            return i + 1;
        }
        let mejor = -1;
        for (let i = 0; i < vec.length; i++) {
            const v = vec[i];
            if (typeof v !== typeof valor && !(typeof v === "number" && typeof valor === "number"))
                continue;
            if (tipo > 0 ? (v as number) <= (valor as number) : (v as number) >= (valor as number))
                mejor = i;
            else if (tipo > 0)
                break;
        }
        if (mejor === -1)
            throw FormulaError.NA;
        return mejor + 1;
    },
    LOOKUP: (lookupValue: unknown, lookupVector: unknown, resultVector: unknown) => {
        const valor = H.accept(lookupValue);
        const vec = vector(lookupVector);
        const res = resultVector === undefined ? vec : vector(resultVector);
        let mejor = -1;
        for (let i = 0; i < vec.length; i++) {
            const v = vec[i];
            if (typeof v === "number" && typeof valor === "number" && v <= valor)
                mejor = i;
            else if (typeof v === "string" && typeof valor === "string" && v <= valor)
                mejor = i;
        }
        if (mejor === -1)
            throw FormulaError.NA;
        return res[mejor] ?? FormulaError.NA;
    },
    HYPERLINK: (linkLocation: unknown, friendlyName: unknown) => {
        if (friendlyName !== undefined)
            return H.accept(friendlyName, T.STRING);
        return H.accept(linkLocation, T.STRING);
    },
    SUBTOTAL: (functionNum: unknown, ...refs: unknown[]) => {
        const num = H.accept(functionNum, T.NUMBER) as number;
        const ns = numeros(refs);
        switch (num) {
            case 1: return ns.length ? ns.reduce((a, b) => a + b, 0) / ns.length : 0;
            case 2: return ns.length;
            case 3: return vector(refs[0]).filter(v => v !== undefined && v !== null && v !== "").length;
            case 4: return ns.length ? Math.max(...ns) : 0;
            case 5: return ns.length ? Math.min(...ns) : 0;
            case 9: return ns.reduce((a, b) => a + b, 0);
            default: throw FormulaError.VALUE;
        }
    },
};
function coincide(a: unknown, b: unknown): boolean {
    if (typeof a === "string" && typeof b === "string")
        return a.toLowerCase() === b.toLowerCase();
    return a === b;
}
