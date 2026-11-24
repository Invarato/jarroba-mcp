import { planificar, type Algoritmo, type Proceso } from "../../src/app/services/planificacion.service";
import { reemplazo, type AlgoritmoReemplazo, MAX_MARCOS, MAX_REFERENCIAS } from "../../src/app/services/reemplazo-paginas.service";
import { seguridad, solicitud, deteccion, necesidad, MAX_PROCESOS_B, MAX_RECURSOS_B, type Recursos, type ResultadoRecorrido } from "../../src/app/services/interbloqueo.service";
import { leerRegex, thompson, subconjuntos, minimizar, simular, type Automata, EPS, MAX_REGEX, } from "../../src/app/services/automatas.service";
import { leerGramatica, cyk, trocearPalabra, MAX_PALABRA } from "../../src/app/services/cyk.service";
const WEB = "https://jarroba.com/tools/en";
type Fallo = {
    error: string;
};
const ALG: Record<string, Algoritmo> = { FCFS: "FCFS", SJF: "SJF", SRTF: "SRTF", RR: "RR", HRRN: "HRRN", PRIORITY: "PRIORIDAD", FB: "FB" };
const ALG_URL: Record<Algoritmo, string> = { FCFS: "fcfs", SJF: "sjf", SRTF: "srtf", RR: "rr", HRRN: "hrrn", PRIORIDAD: "priority", FB: "fb" };
export function leerProcesos(texto: string): Proceso[] | Fallo {
    const trozos = texto.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean);
    if (!trozos.length)
        return { error: "No processes. Write them as \"A:0:3, B:2:6\" (name:arrival:burst[:priority])." };
    const out: Proceso[] = [];
    for (const t of trozos) {
        const m = /^([A-Za-z]\w{0,7})[\s:]+(\d{1,4})[\s:]+(\d{1,4})(?:[\s:]+(-?\d{1,3}))?$/.exec(t);
        if (!m)
            return { error: `Cannot read "${t}". Each process is name:arrival:burst[:priority], e.g. "A:0:3".` };
        out.push({ id: m[1], llegada: +m[2], rafaga: +m[3], ...(m[4] !== undefined ? { prioridad: +m[4] } : {}) });
    }
    return out;
}
export function planificacion(procesosTexto: string, algoritmo: string, quantum?: number, quantumFB?: "1" | "2^i") {
    const ps = leerProcesos(procesosTexto);
    if ("error" in ps)
        return ps;
    const alg = ALG[algoritmo.toUpperCase()];
    if (!alg)
        return { error: `Unknown algorithm "${algoritmo}". Use FCFS, SJF, SRTF, RR, HRRN, PRIORITY or FB.` };
    if (alg === "PRIORIDAD" && ps.some(p => p.prioridad === undefined))
        return { error: "PRIORITY needs a fourth number per process (lower = higher priority), e.g. \"A:0:3:2\"." };
    const q = quantum ?? 1;
    const r = planificar(ps, { algoritmo: alg, quantum: q, quantumFB: quantumFB === "2^i" ? "potencia" : "uno" });
    if (!r)
        return { error: "The processes are not valid: names must be different, arrival \u2265 0 and burst \u2265 1 (and the quantum a whole number from 1 to 100)." };
    const p = ps.map(x => [x.id, x.llegada, x.rafaga, ...(alg === "PRIORIDAD" && x.prioridad !== undefined ? [x.prioridad] : [])].join(":")).join(",");
    const extra = alg === "RR" ? `&q=${q}` : alg === "FB" ? `&fbq=${quantumFB === "2^i" ? "2i" : "1"}` : "";
    return {
        algorithm: algoritmo.toUpperCase(),
        gantt: r.gantt.map(t => `${t.id ?? "idle"} ${t.inicio}-${t.fin}`).join(", "),
        processes: r.metricas.map(m => ({ id: m.id, finish: m.fin, turnaround: m.retorno, waiting: m.espera, response: m.respuesta })),
        averages: { turnaround: +r.media.retorno.toFixed(2), waiting: +r.media.espera.toFixed(2), response: +r.media.respuesta.toFixed(2) },
        conventions: CONVENCIONES[alg],
        stepByStep: `${WEB}/operating-systems?tab=scheduling&alg=${ALG_URL[alg]}${extra}&p=${encodeURIComponent(p)}`,
    };
}
const CONVENCIONES: Record<Algoritmo, string> = {
    FCFS: "Non-preemptive, in arrival order (ties: the order you listed them).",
    SJF: "Non-preemptive shortest burst first (= SPN). Ties: whoever arrived first.",
    SRTF: "Preemptive shortest remaining time (= SRT). An arrival that only TIES the running one does not preempt it.",
    RR: "When a quantum expires at the same instant another process arrives, the newcomer queues first (Stallings, 9th ed., table 9.5).",
    HRRN: "Non-preemptive highest response ratio (waiting + burst) / burst.",
    PRIORIDAD: "Non-preemptive; LOWER number = HIGHER priority (Silberschatz, slide 5.20).",
    FB: "Feedback (Stallings, table 9.5): one queue per level, a process drops a level each time it is preempted; quantum 1 or 2^i per queue.",
};
export function paginas(refsTexto: string, marcos: number, algoritmo: string) {
    const trozos = refsTexto.trim().split(/[\s,;-]+/).filter(Boolean);
    if (!trozos.length || trozos.length > MAX_REFERENCIAS || trozos.some(t => !/^\d{1,4}$/.test(t)))
        return { error: `References must be page numbers separated by spaces or commas (1 to ${MAX_REFERENCIAS}), e.g. "7 0 1 2 0 3".` };
    if (!Number.isInteger(marcos) || marcos < 1 || marcos > MAX_MARCOS)
        return { error: `Frames must be a whole number from 1 to ${MAX_MARCOS}.` };
    const refs = trozos.map(Number);
    const algs: AlgoritmoReemplazo[] = algoritmo.toUpperCase() === "ALL" ? ["FIFO", "LRU", "OPT", "CLOCK"] : [algoritmo.toUpperCase() as AlgoritmoReemplazo];
    if (!algs.every(a => ["FIFO", "LRU", "OPT", "CLOCK"].includes(a)))
        return { error: `Unknown algorithm "${algoritmo}". Use FIFO, LRU, OPT, CLOCK or ALL.` };
    const uno = (a: AlgoritmoReemplazo) => {
        const r = reemplazo(refs, marcos, a)!;
        return {
            algorithm: a,
            faults: r.fallos,
            faultsAfterFramesFilled: r.fallos - r.fallosConMarcoLibre,
            hits: refs.length - r.fallos,
            steps: algs.length === 1 && refs.length <= 60 ? r.pasos.map(p => ({
                page: p.pagina,
                fault: p.fallo,
                evicted: p.victima ?? undefined,
                frames: p.marcos.map(m => m ?? "-").join(" ") + (p.bitsUso ? `  (use bits ${p.bitsUso.map(b => (b ? 1 : 0)).join("")}, hand at ${p.puntero})` : ""),
            })) : undefined,
            stepByStep: `${WEB}/operating-systems?tab=memory&repl=${a.toLowerCase()}&frames=${marcos}&refs=${encodeURIComponent(refs.join(" "))}`,
        };
    };
    return {
        references: refs.length,
        frames: marcos,
        results: algs.map(uno),
        counting: "\"faults\" counts every fault, cold start included (Silberschatz, slides 8.33\u20138.37); \"faultsAfterFramesFilled\" only those after the frames are full (Stallings, 9th ed., fig. 8.14). Both conventions are in use: say which one your course uses.",
    };
}
function recorrido(r: ResultadoRecorrido) {
    return {
        sequence: r.secuencia,
        stuck: r.bloqueados.length ? r.bloqueados : undefined,
        steps: r.pasos.map(p => `${p.proceso}: needs [${p.pide.join(" ")}] vs work [${p.trabajo.join(" ")}] → ${p.puede ? `runs, work becomes [${p.trabajoDespues!.join(" ")}]` : "must wait"}`),
    };
}
export function banquero(e: {
    allocation: number[][];
    max?: number[][];
    requestMatrix?: number[][];
    available: number[];
    processes?: string[];
    resources?: string[];
    request?: {
        process: string;
        vector: number[];
    };
}) {
    const n = e.allocation.length, m = e.available.length;
    if (!n || n > MAX_PROCESOS_B || !m || m > MAX_RECURSOS_B)
        return { error: `From 1 to ${MAX_PROCESOS_B} processes and 1 to ${MAX_RECURSOS_B} resource types.` };
    const procesos = e.processes ?? Array.from({ length: n }, (_, i) => `P${i}`);
    const recursos = e.resources ?? Array.from({ length: m }, (_, j) => String.fromCharCode(65 + j));
    if (procesos.length !== n || recursos.length !== m)
        return { error: "processes / resources must have one name per row / column." };
    const r: Recursos = { procesos, recursos, asignado: e.allocation, disponible: e.available };
    const malas = (mat: number[][]) => mat.length !== n || mat.some(f => f.length !== m || f.some(x => !Number.isInteger(x) || x < 0));
    if (malas(e.allocation) || e.available.some(x => !Number.isInteger(x) || x < 0))
        return { error: `allocation must be ${n}×${m} and available ${m} long, all whole numbers ≥ 0.` };
    if (e.requestMatrix) {
        if (e.max || e.request)
            return { error: "Detection (requestMatrix) and the banker (max, request) are different questions: pass one or the other." };
        if (malas(e.requestMatrix))
            return { error: `requestMatrix must be ${n}×${m}, whole numbers ≥ 0.` };
        const d = deteccion(r, e.requestMatrix)!;
        return { mode: "detection (Silberschatz 7.37\u20137.38)", deadlock: !d.ok, ...recorrido(d), stepByStep: `${WEB}/operating-systems?tab=deadlock` };
    }
    if (!e.max)
        return { error: "Give max (the banker: is the state safe?) or requestMatrix (detection: is there a deadlock now?)." };
    if (malas(e.max))
        return { error: `max must be ${n}×${m}, whole numbers ≥ 0.` };
    const nec = necesidad(e.allocation, e.max);
    if (!nec)
        return { error: "Some allocation is greater than its max: need = max \u2212 allocation would be negative." };
    const s = seguridad(r, e.max)!;
    const base = { mode: "banker (Silberschatz 7.27\u20137.30)", need: nec, safe: s.ok, ...recorrido(s) };
    if (!e.request)
        return { ...base, stepByStep: `${WEB}/operating-systems?tab=deadlock` };
    const q = solicitud(r, e.max, e.request.process, e.request.vector);
    if (!q)
        return { error: `request: "${e.request.process}" is not one of ${procesos.join(", ")}, or the vector is not ${m} whole numbers ≥ 0.` };
    const veredicto = {
        "excede-necesidad": "ERROR: it asks for more than its declared need (max \u2212 allocation).",
        "esperar": "WAIT: not enough available right now.",
        "concedida": "GRANTED: pretending to give it leaves a safe state.",
        "denegada": "DENIED: giving it would leave an unsafe state, so the process waits.",
    }[q.resultado];
    return {
        ...base,
        request: { ...e.request, verdict: veredicto, ...("seguridad" in q ? { stateAfter: { available: q.estado.disponible, allocation: q.estado.asignado }, ...recorrido(q.seguridad) } : {}) },
        stepByStep: `${WEB}/operating-systems?tab=deadlock`,
    };
}
const ER_ERROR: Record<string, string> = {
    vacia: "The expression is empty.",
    larga: `The expression is longer than ${MAX_REGEX} characters.`,
    parentesis: "Unbalanced parentheses",
    operando: "An operator is missing its operand",
    caracter: "Unexpected character (symbols are single letters or digits; operators | * + ? ( ) and \u03B5)",
};
function tabla(a: Automata) {
    const alf = a.alfabeto.filter(s => s !== EPS);
    const fila = (s: string) => {
        const t: Record<string, string> = {};
        for (const x of alf)
            t[x] = a.trans.filter(z => z.de === s && z.sim === x).map(z => z.a).join(",") || "-";
        if (a.trans.some(z => z.sim === EPS))
            t["\u03B5"] = a.trans.filter(z => z.de === s && z.sim === EPS).map(z => z.a).join(",") || "-";
        return { state: (s === a.inicial ? "\u2192" : "") + s + (a.finales.includes(s) ? "*" : ""), ...t };
    };
    return { states: a.estados.length, alphabet: alf, start: a.inicial, accepting: a.finales, table: a.estados.map(fila) };
}
export function automataDeRegex(regex: string, palabras: string[] = []) {
    const raiz = leerRegex(regex);
    if ("error" in raiz)
        return { error: `${ER_ERROR[raiz.error] ?? raiz.error}${raiz.error === "vacia" || raiz.error === "larga" ? "" : ` at position ${raiz.pos + 1}`}.` };
    const t = thompson(raiz);
    if (!t)
        return { error: "The automaton would be too big for a worked example." };
    const s = subconjuntos(t.afn);
    if (!s)
        return { error: "The DFA would be too big for a worked example." };
    const min = minimizar(s.afd);
    const enlace = `${WEB}/automata?re=${encodeURIComponent(regex)}`;
    return {
        regex,
        nfa: { construction: "Thompson (Dragon book \u00A73.7.4)", ...tabla(t.afn) },
        dfa: { construction: "subset construction (Dragon book \u00A73.7.1); each DFA state is a set of NFA states", sets: Object.fromEntries(s.conjuntos.map(c => [c.nombre, c.estados.join(",") || "\u2205"])), ...tabla(s.afd) },
        minimalDfa: min ? { construction: "partition refinement", groups: min.final.map(g => g.join(",")), unreachableRemoved: min.inalcanzables.length ? min.inalcanzables : undefined, ...tabla(min.afd) } : undefined,
        words: palabras.length ? palabras.slice(0, 50).map(w => {
            const sim = simular(t.afn, w === "\u03B5" || w === "" ? [] : [...w]);
            return { word: w || "\u03B5", accepted: sim.acepta };
        }) : undefined,
        stepByStep: enlace + (palabras.length ? `&words=${encodeURIComponent(palabras.slice(0, 50).join(";"))}` : ""),
    };
}
const G_ERROR = (e: {
    error: string;
    linea?: number;
    regla?: string;
}) => ({
    vacia: "The grammar is empty.",
    linea: `Line ${e.linea}: write rules as "S -> AB | a".`,
    "no-fnc": `Line ${e.linea}: "${e.regla}" is not in Chomsky normal form (A → BC, A → a, and S → ε only for the start symbol). CYK needs CNF.`,
    grande: "Too many rules for a worked example (40 max).",
}[e.error] ?? e.error);
export function cykTabla(gramatica: string, palabra: string) {
    const g = leerGramatica(gramatica);
    if ("error" in g)
        return { error: G_ERROR(g) };
    const w = trocearPalabra(palabra);
    if (w.length > MAX_PALABRA)
        return { error: `The word is longer than ${MAX_PALABRA} symbols: the table would not be readable.` };
    const r = cyk(g, w);
    if (!r)
        return { error: "Could not run CYK on that word." };
    const n = r.palabra.length;
    const filas: Record<string, string>[] = [];
    for (let len = n; len >= 1; len--) {
        const f: Record<string, string> = { length: String(len) };
        for (let i = 1; i + len - 1 <= n; i++)
            f[`X${i},${i + len - 1}`] = `{${(r.tabla[i]?.[i + len - 1] ?? []).join(",")}}`;
        filas.push(f);
    }
    return {
        word: r.palabra.join(" "),
        accepted: r.acepta,
        start: g.inicial,
        table: filas,
        note: "Xi,j is the set of variables that derive symbols i..j (1-based, as in Sipser / UC Davis notes). The word is in the language iff the start symbol is in X1,n.",
        stepByStep: `${WEB}/automata?tab=cyk&g=${encodeURIComponent(gramatica.split("\n").map(l => l.trim()).filter(Boolean).join(";"))}&w=${encodeURIComponent(palabra)}`,
    };
}
