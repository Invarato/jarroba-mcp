import { Etapa } from "./accesos-motor";
import { Ambito, PeticionAcceso, caminoDesdeRaiz, coincideAlgunPatron, pasoContinua, pasoFinal, pasoNoAplica } from "./accesos-modelo";
import { ContextoAws, ResultadoCondicion, evaluarCondicionAws } from "./accesos-aws-condiciones";
export interface DeclaracionAws {
    efecto: "permitir" | "denegar";
    acciones: string[];
    condicion?: string;
}
export interface DeclaracionRecursoAws extends DeclaracionAws {
    principalId: string;
    via: "usuario" | "sesionDeRol" | "rol";
}
export interface MundoAws {
    ambitos: Map<string, Ambito>;
    cuentasGestion: Set<string>;
    identidades: Map<string, DeclaracionAws[]>;
    recursos: Map<string, DeclaracionRecursoAws[]>;
    scps: Map<string, DeclaracionAws[]>;
    boundaries: Map<string, DeclaracionAws[]>;
    rcps: Map<string, DeclaracionAws[]>;
    sesiones: Map<string, DeclaracionAws[]>;
}
export function crearMundoAws(datos: {
    ambitos?: Ambito[];
    cuentasGestion?: string[];
    identidades?: Record<string, DeclaracionAws[]>;
    recursos?: Record<string, DeclaracionRecursoAws[]>;
    scps?: Record<string, DeclaracionAws[]>;
    boundaries?: Record<string, DeclaracionAws[]>;
    rcps?: Record<string, DeclaracionAws[]>;
    sesiones?: Record<string, DeclaracionAws[]>;
}): MundoAws {
    const norm = <T extends DeclaracionAws>(r: Record<string, T[]> | undefined) => new Map(Object.entries(r ?? {}).map(([k, ds]) => [k, ds.map(d => (d.condicion !== undefined && typeof d.condicion !== "string" ? { ...d, condicion: JSON.stringify(d.condicion) } : d))]));
    return {
        ambitos: new Map((datos.ambitos ?? []).map(a => [a.id, a])),
        cuentasGestion: new Set(datos.cuentasGestion ?? []),
        identidades: norm(datos.identidades),
        recursos: norm(datos.recursos),
        scps: norm(datos.scps),
        boundaries: norm(datos.boundaries),
        rcps: norm(datos.rcps),
        sesiones: norm(datos.sesiones),
    };
}
export const FULL_AWS_ACCESS: DeclaracionAws[] = [{ efecto: "permitir", acciones: ["*"] }];
export const SERVICIOS_RCP: ReadonlySet<string> = new Set([
    "aoss",
    "appconfig",
    "appstream",
    "autoscaling",
    "autoscaling-plans",
    "budgets",
    "clouddirectory",
    "cloudfront",
    "cloudsearch",
    "cloudtrail-data",
    "codeartifact",
    "codebuild",
    "codecommit",
    "codepipeline",
    "cognito-identity",
    "cognito-idp",
    "comprehend",
    "comprehendmedical",
    "compute-optimizer",
    "cost-optimization-hub",
    "dax",
    "dsql",
    "dynamodb",
    "ecr",
    "ecr-public",
    "events",
    "firehose",
    "fis",
    "fms",
    "gamelift",
    "health",
    "inspector-scan",
    "kendra",
    "kinesisvideo",
    "kms",
    "logs",
    "memorydb",
    "networkmonitor",
    "notifications",
    "opensearch",
    "pca-connector-ad",
    "personalize",
    "polly",
    "pricing",
    "resource-groups",
    "rolesanywhere",
    "s3",
    "secretsmanager",
    "servicediscovery",
    "signin",
    "sqs",
    "sts",
    "support",
    "swf",
    "textract",
    "timestream-influxdb",
    "transcribe",
    "transfer",
    "translate",
    "wafv2",
    "workspaces",
    "xray",
]);
const contextoDe = (p: PeticionAcceso) => p["contexto"] as ContextoAws | undefined;
function porCondicion(d: DeclaracionAws, p: PeticionAcceso): ResultadoCondicion {
    if (!d.condicion)
        return { estado: "cumple" };
    const ctx = contextoDe(p);
    return ctx ? evaluarCondicionAws(d.condicion, ctx) : { estado: "indeterminado", motivo: "no-json" };
}
function datosCondicion(origen: string, d: DeclaracionAws, r: ResultadoCondicion): Record<string, string> {
    if (r.estado === "no-cumple") {
        return { origen, operador: r.operador, clave: r.clave, esperado: r.esperado.join(", "), recibido: r.recibido ? r.recibido.join(", ") : "\u2014" };
    }
    return { origen, condicion: d.condicion ?? "" };
}
function buscarAllow<T extends DeclaracionAws>(ds: readonly T[], p: PeticionAcceso): {
    d: T;
} | {
    indeterminado: T;
} | {
    descartado: T;
    r: ResultadoCondicion;
} | null {
    let indet: T | null = null, fuera: {
        d: T;
        r: ResultadoCondicion;
    } | null = null;
    for (const d of ds) {
        if (d.efecto !== "permitir" || !coincideAlgunPatron(p.accion, d.acciones))
            continue;
        const r = porCondicion(d, p);
        if (r.estado === "cumple")
            return { d };
        if (r.estado === "indeterminado")
            indet ??= d;
        else
            fuera ??= { d, r };
    }
    return indet ? { indeterminado: indet } : fuera ? { descartado: fuera.d, r: fuera.r } : null;
}
const pasoIndeterminado = (etapa: string, p: PeticionAcceso, origen: string, d: DeclaracionAws) => pasoFinal(etapa, "indeterminado", contextoDe(p) ? "aws.condicionNoEvaluable" : "aws.condicionDesconocida", { origen, condicion: d.condicion ?? "" });
function idDeCuenta(mundo: MundoAws, ambitoId: string): string | null {
    const camino = caminoDesdeRaiz(mundo.ambitos, ambitoId);
    for (let i = camino.length - 1; i >= 0; i--) {
        if (mundo.ambitos.get(camino[i])?.tipo === "cuenta")
            return camino[i];
    }
    return null;
}
function caminoOrganizativo(mundo: MundoAws, ambitoId: string): string[] {
    return caminoDesdeRaiz(mundo.ambitos, idDeCuenta(mundo, ambitoId) ?? ambitoId);
}
function esCuentaDeGestion(mundo: MundoAws, ambitoId: string): boolean {
    const cuenta = idDeCuenta(mundo, ambitoId);
    return cuenta != null && mundo.cuentasGestion.has(cuenta);
}
export const denegacionExplicitaAws: Etapa<MundoAws> = (peticion, mundo) => {
    const fuentes: {
        origen: string;
        d: DeclaracionAws;
    }[] = [
        ...(mundo.identidades.get(peticion.principalId) ?? []).map(d => ({ origen: "identidad", d })),
        ...(mundo.recursos.get(peticion.ambitoId) ?? [])
            .filter(d => d.principalId === peticion.principalId)
            .map(d => ({ origen: "recurso", d })),
        ...(mundo.boundaries.get(peticion.principalId) ?? []).map(d => ({ origen: "boundary", d })),
        ...(mundo.sesiones.get(peticion.principalId) ?? []).map(d => ({ origen: "sesion", d })),
    ];
    if (!esCuentaDeGestion(mundo, peticion.ambitoId)) {
        const rcpAplica = SERVICIOS_RCP.has(peticion.accion.split(":")[0].toLowerCase());
        for (const nivelId of caminoOrganizativo(mundo, peticion.ambitoId)) {
            for (const d of mundo.scps.get(nivelId) ?? FULL_AWS_ACCESS)
                fuentes.push({ origen: `scp:${nivelId}`, d });
            if (rcpAplica)
                for (const d of mundo.rcps.get(nivelId) ?? [])
                    fuentes.push({ origen: `rcp:${nivelId}`, d });
        }
    }
    let fueraPorCondicion: Record<string, string> | null = null;
    for (const { origen, d } of fuentes) {
        if (d.efecto !== "denegar" || !coincideAlgunPatron(peticion.accion, d.acciones))
            continue;
        const r = porCondicion(d, peticion);
        if (r.estado === "indeterminado")
            return pasoIndeterminado("aws.denegacion", peticion, origen, d);
        if (r.estado === "no-cumple") {
            fueraPorCondicion ??= datosCondicion(origen, d, r);
            continue;
        }
        return pasoFinal("aws.denegacion", "deniega", d.condicion ? "aws.denegadoPorCondicion" : "aws.denegadoPor", { origen, condicion: d.condicion ?? "" });
    }
    return fueraPorCondicion ? pasoNoAplica("aws.denegacion", "aws.denyNoAplicaPorCondicion", fueraPorCondicion) : pasoNoAplica("aws.denegacion", "aws.sinDenegacion");
};
export const scpNivelesAws: Etapa<MundoAws> = (peticion, mundo) => {
    if (esCuentaDeGestion(mundo, peticion.ambitoId)) {
        return pasoNoAplica("aws.scpNiveles", "aws.scpNoAplicaGestion");
    }
    for (const nivelId of caminoOrganizativo(mundo, peticion.ambitoId)) {
        const declaraciones = mundo.scps.get(nivelId) ?? FULL_AWS_ACCESS;
        const permite = declaraciones.some(d => d.efecto === "permitir" && coincideAlgunPatron(peticion.accion, d.acciones));
        if (!permite) {
            return pasoFinal("aws.scpNiveles", "deniega", "aws.scpSinAllowEnNivel", { nivel: nivelId });
        }
    }
    return pasoContinua("aws.scpNiveles", "aws.scpNivelesOk");
};
export const identidadYRecursoAws: Etapa<MundoAws> = (peticion, mundo) => {
    const delRecurso = (mundo.recursos.get(peticion.ambitoId) ?? []).filter(d => d.principalId === peticion.principalId);
    const rec = buscarAllow(delRecurso, peticion);
    const recursoAllow = rec && "d" in rec ? rec.d : null;
    if (recursoAllow && recursoAllow.via !== "rol") {
        const sesion = mundo.sesiones.get(peticion.principalId);
        if (recursoAllow.via === "usuario" && sesion?.length) {
            const s = buscarAllow(sesion, peticion);
            if (s && "indeterminado" in s)
                return pasoIndeterminado("aws.identidadRecurso", peticion, "sesion", s.indeterminado);
            if (!s || "descartado" in s)
                return pasoFinal("aws.identidadRecurso", "deniega", s ? "aws.allowFueraPorCondicion" : "aws.sesionNoPermite", s && "descartado" in s ? datosCondicion("sesion", s.descartado, s.r) : undefined);
        }
        return pasoFinal("aws.identidadRecurso", "permite", "aws.concedidoPorRecursoDirecto", { via: recursoAllow.via });
    }
    const ide = recursoAllow ? null : buscarAllow(mundo.identidades.get(peticion.principalId) ?? [], peticion);
    if (recursoAllow || (ide && "d" in ide)) {
        return pasoContinua("aws.identidadRecurso", recursoAllow ? "aws.concedidoPorRecursoRol" : "aws.concedidoPorIdentidad");
    }
    if (rec && "indeterminado" in rec)
        return pasoIndeterminado("aws.identidadRecurso", peticion, "recurso", rec.indeterminado);
    if (ide && "indeterminado" in ide)
        return pasoIndeterminado("aws.identidadRecurso", peticion, "identidad", ide.indeterminado);
    const fuera = (rec && "descartado" in rec ? { o: "recurso", x: rec } : null) ?? (ide && "descartado" in ide ? { o: "identidad", x: ide } : null);
    if (fuera)
        return pasoFinal("aws.identidadRecurso", "deniega", "aws.allowFueraPorCondicion", datosCondicion(fuera.o, fuera.x.descartado, fuera.x.r));
    return pasoFinal("aws.identidadRecurso", "deniega", "aws.sinAllowDeIdentidadNiRecurso");
};
export const boundaryAws: Etapa<MundoAws> = (peticion, mundo) => {
    const declaraciones = mundo.boundaries.get(peticion.principalId);
    if (!declaraciones || declaraciones.length === 0) {
        return pasoNoAplica("aws.boundary", "aws.sinBoundary");
    }
    const b = buscarAllow(declaraciones, peticion);
    if (b && "indeterminado" in b)
        return pasoIndeterminado("aws.boundary", peticion, "boundary", b.indeterminado);
    if (b && "descartado" in b)
        return pasoFinal("aws.boundary", "deniega", "aws.allowFueraPorCondicion", datosCondicion("boundary", b.descartado, b.r));
    if (!b)
        return pasoFinal("aws.boundary", "deniega", "aws.boundaryNoPermite");
    return pasoContinua("aws.boundary", "aws.boundaryOk");
};
export const sesionAws: Etapa<MundoAws> = (peticion, mundo) => {
    const declaraciones = mundo.sesiones.get(peticion.principalId);
    if (!declaraciones || declaraciones.length === 0) {
        return pasoNoAplica("aws.sesion", "aws.sinSesion");
    }
    const s = buscarAllow(declaraciones, peticion);
    if (s && "indeterminado" in s)
        return pasoIndeterminado("aws.sesion", peticion, "sesion", s.indeterminado);
    if (s && "descartado" in s)
        return pasoFinal("aws.sesion", "deniega", "aws.allowFueraPorCondicion", datosCondicion("sesion", s.descartado, s.r));
    if (!s)
        return pasoFinal("aws.sesion", "deniega", "aws.sesionNoPermite");
    return pasoContinua("aws.sesion", "aws.sesionOk");
};
export const implicitoAws: Etapa<MundoAws> = () => pasoFinal("aws.implicito", "permite", "aws.implicito");
export const PIPELINE_AWS: readonly Etapa<MundoAws>[] = [
    denegacionExplicitaAws,
    scpNivelesAws,
    identidadYRecursoAws,
    boundaryAws,
    sesionAws,
    implicitoAws,
];
