import { CoincidenciaCruda, regexConLimite } from "../regex-limite";
export interface RegexPropio {
    pattern: string;
    replacement: string;
    flags?: string;
}
export interface PropiosCalculados {
    coincidencias: (CoincidenciaCruda[] | null)[][];
    agotados: Set<string>;
}
const PARALELO = 4;
export async function calcularPropios(textos: readonly string[], propios: readonly RegexPropio[], opciones: {
    ms?: number;
} = {}): Promise<PropiosCalculados> {
    const agotados = new Set<string>();
    const coincidencias = textos.map(() => propios.map((): CoincidenciaCruda[] | null => []));
    for (let r = 0; r < propios.length; r++) {
        const p = propios[r];
        if (!p.pattern)
            continue;
        let i = 0;
        const trabajador = async () => {
            while (i < textos.length && !agotados.has(p.pattern)) {
                const k = i++;
                const res = await regexConLimite(p.pattern, p.flags ?? "g", textos[k], { ms: opciones.ms });
                if (!res.ok) {
                    agotados.add(p.pattern);
                    return;
                }
                coincidencias[k][r] = res.valor.errorMsg ? [] : res.valor.matches;
            }
        };
        await Promise.all(Array.from({ length: Math.min(PARALELO, textos.length) }, trabajador));
        if (agotados.has(p.pattern))
            for (const fila of coincidencias)
                fila[r] = null;
    }
    return { coincidencias, agotados };
}
