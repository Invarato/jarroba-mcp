export interface MotorCedar {
    policySetTextToParts(texto: string): {
        type: "success";
        policies: string[];
    } | {
        type: "failure";
        errors: ErrorCedar[];
    };
    validate(llamada: unknown): {
        type: "success";
        validationErrors: AvisoPolitica[];
        validationWarnings: AvisoPolitica[];
    } | {
        type: "failure";
        errors: ErrorCedar[];
    };
    checkParseEntities?(llamada: unknown): {
        type: "success";
    } | {
        type: "failure";
        errors: ErrorCedar[];
    };
    isAuthorized(llamada: unknown): {
        type: "success";
        response: {
            decision: "allow" | "deny";
            diagnostics: {
                reason: string[];
                errors: AvisoPolitica[];
            };
        };
    } | {
        type: "failure";
        errors: ErrorCedar[];
    };
}
interface ErrorCedar {
    message: string;
    help: string | null;
    sourceLocations?: {
        start: number;
        end: number;
    }[];
}
interface AvisoPolitica {
    policyId: string;
    error: ErrorCedar;
}
export interface UidCedar {
    type: string;
    id: string;
}
export function uidCedar(texto: string): UidCedar | null {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*(?:::[A-Za-z_][A-Za-z0-9_]*)*)::"((?:[^"\\]|\\.)*)"\s*$/.exec(texto);
    if (!m)
        return null;
    try {
        return { type: m[1], id: JSON.parse(`"${m[2]}"`) as string };
    }
    catch {
        return null;
    }
}
export interface PoliticaCedar {
    id: string;
    efecto: "permit" | "forbid";
    texto: string;
    resumen: string;
}
export interface ProblemaCedar {
    id: string;
    mensaje: string;
}
export type MotivoCedar = "forbid" | "permit" | "sin-permit";
export interface DecisionCedar {
    decision: "allow" | "deny";
    motivo: MotivoCedar;
    decidieron: string[];
    erroresEvaluacion: ProblemaCedar[];
}
export interface ConjuntoCedar {
    politicas: PoliticaCedar[];
    validacion?: {
        errores: ProblemaCedar[];
        avisos: ProblemaCedar[];
    };
}
const texto = (e: ErrorCedar) => (e.help ? `${e.message} (${e.help})` : e.message);
export interface FalloCedar {
    error: {
        tipo: "sintaxis" | "esquema" | "id-repetido" | "uid" | "motor";
        detalles: string[];
    };
}
export function prepararCedar(cedar: MotorCedar, politicas: string, esquema?: string): ConjuntoCedar | FalloCedar {
    const partes = cedar.policySetTextToParts(politicas);
    if (partes.type === "failure")
        return { error: { tipo: "sintaxis", detalles: partes.errors.map(texto) } };
    const lista = partes.policies.map((t, i): PoliticaCedar => {
        const id = /@id\(\s*"((?:[^"\\]|\\.)*)"\s*\)/.exec(t)?.[1] ?? `policy${i}`;
        const sinAnotaciones = t.replace(/^\s*@[^\n]*\n/gm, "").trim();
        return { id, efecto: /^forbid\b/.test(sinAnotaciones) ? "forbid" : "permit", texto: t, resumen: sinAnotaciones.split("\n")[0].slice(0, 160) };
    });
    const repetido = lista.find((p, i) => lista.findIndex(q => q.id === p.id) !== i);
    if (repetido)
        return { error: { tipo: "id-repetido", detalles: [repetido.id] } };
    const conjunto: ConjuntoCedar = { politicas: lista };
    if (esquema?.trim()) {
        const v = cedar.validate({ validationSettings: { mode: "strict" }, schema: esquema, policies: estatico(lista) });
        if (v.type === "failure")
            return { error: { tipo: "esquema", detalles: v.errors.map(texto) } };
        conjunto.validacion = {
            errores: v.validationErrors.map(e => ({ id: e.policyId, mensaje: texto(e.error) })),
            avisos: v.validationWarnings.map(e => ({ id: e.policyId, mensaje: texto(e.error) })),
        };
    }
    return conjunto;
}
const estatico = (ps: PoliticaCedar[]) => ({ staticPolicies: Object.fromEntries(ps.map(p => [p.id, p.texto])) });
export function decidirCedar(cedar: MotorCedar, conjunto: ConjuntoCedar, entidades: unknown[], peticion: {
    principal: string;
    accion: string;
    recurso: string;
    contexto?: Record<string, unknown>;
}): DecisionCedar | FalloCedar {
    const [principal, action, resource] = [uidCedar(peticion.principal), uidCedar(peticion.accion), uidCedar(peticion.recurso)];
    const malo = [peticion.principal, peticion.accion, peticion.recurso].find(x => !uidCedar(x));
    if (!principal || !action || !resource)
        return { error: { tipo: "uid", detalles: [malo ?? ""] } };
    const r = cedar.isAuthorized({ principal, action, resource, context: peticion.contexto ?? {}, policies: estatico(conjunto.politicas), entities: entidades });
    if (r.type === "failure")
        return { error: { tipo: "motor", detalles: r.errors.map(texto) } };
    const { decision, diagnostics } = r.response;
    return {
        decision,
        motivo: decision === "allow" ? "permit" : diagnostics.reason.length ? "forbid" : "sin-permit",
        decidieron: diagnostics.reason,
        erroresEvaluacion: diagnostics.errors.map(e => ({ id: e.policyId, mensaje: texto(e.error) })),
    };
}
export function validarEntidadesCedar(cedar: MotorCedar, entidades: unknown[], esquema?: string): string[] {
    if (!esquema?.trim() || !cedar.checkParseEntities)
        return [];
    const r = cedar.checkParseEntities({ entities: entidades, schema: esquema });
    return r.type === "failure" ? r.errors.map(texto) : [];
}
