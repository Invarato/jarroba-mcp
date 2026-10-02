export interface CoincidenciaCruda {
    index: number;
    value: string;
    groups: (string | undefined)[];
    indices: (number | undefined)[];
}
export interface ResultadoRegex {
    matches: CoincidenciaCruda[];
    output?: string;
    errorMsg?: string;
    truncado?: boolean;
}
export type ConLimite = {
    ok: true;
    valor: ResultadoRegex;
} | {
    ok: false;
    agotado: true;
};
const FUENTE = `
self.onmessage = (ev) => {
  const { pattern, flags, text, replacement, max } = ev.data;
  let re;
  // 'g' es OBLIGATORIA para matchAll: sin ella lanza TypeError. Se normaliza AQUÍ y no se confía en
  // quien llama — lo destapó un test que pasaba flags vacías: el patrón catastrófico no llegaba
  // siquiera a ejecutarse, así que el helper devolvía «error del motor» y NO cortaba nada. Un tope
  // que depende de un argumento de quien llama no es un tope.
  const busca = flags.indexOf('g') >= 0 ? flags : flags + 'g';
  // La 'd' (hasIndices) da la posición de cada grupo. Si el motor no la soporta se sigue sin
  // posiciones en vez de fallar: es un extra, no el resultado.
  try { re = new RegExp(pattern, busca + 'd'); }
  catch (_) {
    try { re = new RegExp(pattern, busca); }
    catch (e) { self.postMessage({ matches: [], errorMsg: String(e && e.message || e) }); return; }
  }
  try {
    const matches = [];
    let truncado = false;
    for (const m of String(text || '').matchAll(re)) {
      if (matches.length >= max) { truncado = true; break; }
      const groups = [], indices = [];
      for (let g = 1; g < m.length; g++) {
        groups.push(m[g]);
        indices.push(m.indices && m.indices[g] ? m.indices[g][0] : undefined);
      }
      matches.push({ index: m.index, value: m[0], groups: groups, indices: indices });
    }
    const out = {};
    out.matches = matches;
    if (truncado) out.truncado = true;
    if (typeof replacement === 'string') {
      // 'd' molesta en replace y no aporta nada, así que se recompila sin ella.
      out.output = String(text || '').replace(new RegExp(pattern, busca), replacement);
    }
    self.postMessage(out);
  } catch (e) {
    self.postMessage({ matches: [], errorMsg: String(e && e.message || e) });
  }
};
`;
function sincrono(pattern: string, flags: string, text: string, replacement: string | undefined, max: number): ResultadoRegex {
    let re: RegExp;
    const busca = flags.includes("g") ? flags : flags + "g";
    try {
        re = new RegExp(pattern, busca + "d");
    }
    catch {
        try {
            re = new RegExp(pattern, busca);
        }
        catch (e) {
            return { matches: [], errorMsg: (e as Error).message };
        }
    }
    try {
        const matches: CoincidenciaCruda[] = [];
        let truncado = false;
        for (const m of String(text || "").matchAll(re)) {
            if (matches.length >= max) {
                truncado = true;
                break;
            }
            const groups: (string | undefined)[] = [], indices: (number | undefined)[] = [];
            const ind = (m as RegExpMatchArray & {
                indices?: (number[] | undefined)[];
            }).indices;
            for (let g = 1; g < m.length; g++) {
                groups.push(m[g]);
                indices.push(ind?.[g]?.[0]);
            }
            matches.push({ index: m.index!, value: m[0], groups, indices });
        }
        const out: ResultadoRegex = { matches };
        if (truncado)
            out.truncado = true;
        if (typeof replacement === "string") {
            out.output = String(text || "").replace(new RegExp(pattern, busca), replacement);
        }
        return out;
    }
    catch (e) {
        return { matches: [], errorMsg: (e as Error).message };
    }
}
function enWorker<R>(fuente: string, mensaje: unknown, ms: number, sincrono: () => R): Promise<{
    ok: true;
    valor: R;
} | {
    ok: false;
    agotado: true;
}> {
    if (typeof Worker === "undefined" || typeof Blob === "undefined" || typeof URL === "undefined") {
        return Promise.resolve({ ok: true, valor: sincrono() });
    }
    return new Promise((resolve) => {
        const url = URL.createObjectURL(new Blob([fuente], { type: "application/javascript" }));
        const w = new Worker(url);
        let cerrado = false;
        const cerrar = () => { if (cerrado)
            return; cerrado = true; clearTimeout(tope); w.terminate(); URL.revokeObjectURL(url); };
        const tope = setTimeout(() => { cerrar(); resolve({ ok: false, agotado: true }); }, ms);
        w.onmessage = (ev: MessageEvent<R>) => { cerrar(); resolve({ ok: true, valor: ev.data }); };
        w.onerror = () => { cerrar(); resolve({ ok: true, valor: sincrono() }); };
        w.postMessage(mensaje);
    });
}
export function regexConLimite(pattern: string, flags: string, text: string, opciones: {
    ms?: number;
    replacement?: string;
    max?: number;
} = {}): Promise<ConLimite> {
    const max = opciones.max ?? Infinity;
    return enWorker<ResultadoRegex>(FUENTE, { pattern, flags, text, replacement: opciones.replacement, max }, opciones.ms ?? 2000, () => sincrono(pattern, flags, text, opciones.replacement, max));
}
export interface ResultadoPrueba {
    casa: boolean[];
    cuantas?: number[];
    errorMsg?: string;
}
export type PruebaConLimite = {
    ok: true;
    valor: ResultadoPrueba;
} | {
    ok: false;
    agotado: true;
};
const CUERPO_PRUEBA = `
  let re;
  try { re = new RegExp(pattern, todas ? (flags.indexOf('g') >= 0 ? flags : flags + 'g') : flags.replace(/g/g, '')); }
  catch (e) { return { casa: [], errorMsg: String(e && e.message || e) }; }
  try {
    const casa = new Array(textos.length);
    const cuantas = todas ? new Array(textos.length) : null;
    for (let i = 0; i < textos.length; i++) {
      re.lastIndex = 0;
      if (todas) { let n = 0; for (const _ of String(textos[i]).matchAll(re)) n++; cuantas[i] = n; casa[i] = n > 0; }
      else casa[i] = re.test(String(textos[i]));
    }
    return todas ? { casa: casa, cuantas: cuantas } : { casa: casa };
  } catch (e) { return { casa: [], errorMsg: String(e && e.message || e) }; }
`;
const FUENTE_PRUEBA = `
self.onmessage = (ev) => {
  const { pattern, flags, textos, todas } = ev.data;
  self.postMessage((() => {${CUERPO_PRUEBA}})());
};
`;
function pruebaSincrona(pattern: string, flags: string, textos: readonly string[], todas: boolean): ResultadoPrueba {
    let re: RegExp;
    try {
        re = new RegExp(pattern, todas ? (flags.includes("g") ? flags : flags + "g") : flags.replace(/g/g, ""));
    }
    catch (e) {
        return { casa: [], errorMsg: (e as Error).message };
    }
    try {
        const casa: boolean[] = [], cuantas: number[] = [];
        for (const t of textos) {
            re.lastIndex = 0;
            if (todas) {
                let n = 0;
                for (const _ of String(t).matchAll(re))
                    n++;
                cuantas.push(n);
                casa.push(n > 0);
            }
            else
                casa.push(re.test(String(t)));
        }
        return todas ? { casa, cuantas } : { casa };
    }
    catch (e) {
        return { casa: [], errorMsg: (e as Error).message };
    }
}
export function probarConLimite(pattern: string, flags: string, textos: readonly string[], opciones: {
    ms?: number;
    todas?: boolean;
} = {}): Promise<PruebaConLimite> {
    const todas = !!opciones.todas;
    return enWorker<ResultadoPrueba>(FUENTE_PRUEBA, { pattern, flags, textos, todas }, opciones.ms ?? 2000, () => pruebaSincrona(pattern, flags, textos, todas));
}
