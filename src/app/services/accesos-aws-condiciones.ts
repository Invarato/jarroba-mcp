export type ContextoAws = Record<string, string[]>;
export function leerContextoAws(texto: string): ContextoAws {
    const ctx: ContextoAws = {};
    for (const linea of texto.split(/\r?\n/)) {
        const l = linea.trim();
        if (!l || l.startsWith("#"))
            continue;
        const eq = l.indexOf("=");
        const dos = l.search(/:\s/);
        const i = eq > 0 ? eq : dos;
        if (i <= 0)
            continue;
        const clave = l.slice(0, i).trim().toLowerCase();
        const resto = l.slice(i + 1).trim();
        ctx[clave] = resto === "" ? [] : resto.split(",").map(v => v.trim()).filter(v => v !== "");
    }
    return ctx;
}
const NEGADOS = new Set(["StringNotEquals", "StringNotEqualsIgnoreCase", "StringNotLike", "NumericNotEquals", "DateNotEquals", "NotIpAddress", "ArnNotEquals", "ArnNotLike"]);
const glob = (patron: string, valor: string, mayus = true) => {
    const re = new RegExp("^" + patron.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".") + "$", mayus ? "" : "i");
    return re.test(valor);
};
function fecha(v: string): number {
    if (/^\d+(\.\d+)?$/.test(v.trim()))
        return Number(v) * 1000;
    return Date.parse(v);
}
function ipABigInt(ip: string): {
    v: bigint;
    bits: number;
} | null {
    if (ip.includes(":")) {
        let [cab, cola] = ip.split("::");
        const a = cab ? cab.split(":") : [];
        const b = cola !== undefined ? (cola ? cola.split(":") : []) : [];
        const grupos = cola !== undefined ? [...a, ...Array(8 - a.length - b.length).fill("0"), ...b] : a;
        if (grupos.length !== 8 || grupos.some(g => !/^[0-9a-f]{1,4}$/i.test(g)))
            return null;
        return { v: grupos.reduce((acc, g) => (acc << 16n) + BigInt(parseInt(g, 16)), 0n), bits: 128 };
    }
    const p = ip.split(".");
    if (p.length !== 4 || p.some(x => !/^\d{1,3}$/.test(x) || Number(x) > 255))
        return null;
    return { v: p.reduce((acc, x) => (acc << 8n) + BigInt(Number(x)), 0n), bits: 32 };
}
export function ipEnCidr(cidr: string, ip: string): boolean {
    const [red, pref] = cidr.trim().split("/");
    const r = ipABigInt(red), x = ipABigInt(ip.trim());
    if (!r || !x || r.bits !== x.bits)
        return false;
    const n = pref === undefined ? r.bits : Number(pref);
    if (!(n >= 0 && n <= r.bits))
        return false;
    const mascara = n === 0 ? 0n : ((1n << BigInt(n)) - 1n) << BigInt(r.bits - n);
    return (r.v & mascara) === (x.v & mascara);
}
const componentesArn = (arn: string) => {
    const p = arn.split(":");
    return p.length < 6 ? null : [...p.slice(0, 5), p.slice(5).join(":")];
};
function casa(base: string, pol: string, req: string): boolean | undefined {
    switch (base) {
        case "StringEquals":
        case "BinaryEquals": return pol === req;
        case "StringEqualsIgnoreCase": return pol.toLowerCase() === req.toLowerCase();
        case "StringLike": return glob(pol, req);
        case "NumericEquals": return Number(req) === Number(pol);
        case "NumericLessThan": return Number(req) < Number(pol);
        case "NumericLessThanEquals": return Number(req) <= Number(pol);
        case "NumericGreaterThan": return Number(req) > Number(pol);
        case "NumericGreaterThanEquals": return Number(req) >= Number(pol);
        case "DateEquals": return fecha(req) === fecha(pol);
        case "DateLessThan": return fecha(req) < fecha(pol);
        case "DateLessThanEquals": return fecha(req) <= fecha(pol);
        case "DateGreaterThan": return fecha(req) > fecha(pol);
        case "DateGreaterThanEquals": return fecha(req) >= fecha(pol);
        case "Bool": return pol.toLowerCase() === req.toLowerCase();
        case "IpAddress": return ipEnCidr(pol, req);
        case "ArnEquals":
        case "ArnLike": {
            const a = componentesArn(pol), b = componentesArn(req);
            return !!a && !!b && a.every((c, i) => glob(c, b[i]));
        }
        default: return undefined;
    }
}
const positivo = (op: string) => ({
    StringNotEquals: "StringEquals",
    StringNotEqualsIgnoreCase: "StringEqualsIgnoreCase",
    StringNotLike: "StringLike",
    NumericNotEquals: "NumericEquals",
    DateNotEquals: "DateEquals",
    NotIpAddress: "IpAddress",
    ArnNotEquals: "ArnEquals",
    ArnNotLike: "ArnLike",
} as Record<string, string>)[op] ?? op;
export type ResultadoCondicion = {
    estado: "cumple";
} | {
    estado: "no-cumple";
    operador: string;
    clave: string;
    esperado: string[];
    recibido: string[] | null;
} | {
    estado: "indeterminado";
    motivo: "no-json" | "operador";
    operador?: string;
};
const lista = (x: unknown): string[] => (Array.isArray(x) ? x : [x]).map(v => String(v));
const conVariables = (v: string, ctx: ContextoAws) => v.replace(/\$\{([^}]+)\}/g, (m, k) => ctx[String(k).toLowerCase()]?.[0] ?? m);
export function evaluarCondicionAws(condicion: string, ctx: ContextoAws): ResultadoCondicion {
    let bloque: Record<string, Record<string, unknown>>;
    try {
        bloque = JSON.parse(condicion);
    }
    catch {
        return { estado: "indeterminado", motivo: "no-json" };
    }
    if (!bloque || typeof bloque !== "object" || Array.isArray(bloque))
        return { estado: "indeterminado", motivo: "no-json" };
    for (const [opCompleto, claves] of Object.entries(bloque)) {
        const m = /^(ForAllValues:|ForAnyValue:)?(.+?)(IfExists)?$/.exec(opCompleto);
        if (!m || !claves || typeof claves !== "object")
            return { estado: "indeterminado", motivo: "operador", operador: opCompleto };
        const conjunto = m[1]?.slice(0, -1) as "ForAllValues" | "ForAnyValue" | undefined;
        const op = m[2];
        const siExiste = !!m[3];
        const negado = NEGADOS.has(op);
        const base = positivo(op);
        if (op !== "Null" && casa(base, "", "") === undefined)
            return { estado: "indeterminado", motivo: "operador", operador: opCompleto };
        for (const [claveOriginal, valoresPol] of Object.entries(claves)) {
            const clave = claveOriginal.toLowerCase();
            const pol = lista(valoresPol).map(v => conVariables(v, ctx));
            const req = ctx[clave];
            const presente = req !== undefined && req.length > 0;
            let ok: boolean;
            if (op === "Null") {
                ok = pol.some(p => (p.toLowerCase() === "true") === !presente);
            }
            else if (!presente) {
                ok = conjunto === "ForAllValues" || siExiste || (negado && conjunto !== "ForAnyValue");
            }
            else {
                const algunoCasa = (r: string) => pol.some(p => casa(base, p, r) === true);
                if (conjunto === "ForAllValues")
                    ok = req.every(r => (negado ? !algunoCasa(r) : algunoCasa(r)));
                else
                    ok = req.some(r => (negado ? !algunoCasa(r) : algunoCasa(r)));
            }
            if (!ok)
                return { estado: "no-cumple", operador: opCompleto, clave: claveOriginal, esperado: pol, recibido: presente ? req : null };
        }
    }
    return { estado: "cumple" };
}
