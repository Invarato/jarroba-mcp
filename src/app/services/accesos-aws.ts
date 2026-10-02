import { Etapa } from "./accesos-motor";
import { Ambito, caminoDesdeRaiz, coincideAlgunPatron, pasoContinua, pasoFinal, pasoNoAplica } from "./accesos-modelo";
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
    return {
        ambitos: new Map((datos.ambitos ?? []).map(a => [a.id, a])),
        cuentasGestion: new Set(datos.cuentasGestion ?? []),
        identidades: new Map(Object.entries(datos.identidades ?? {})),
        recursos: new Map(Object.entries(datos.recursos ?? {})),
        scps: new Map(Object.entries(datos.scps ?? {})),
        boundaries: new Map(Object.entries(datos.boundaries ?? {})),
        rcps: new Map(Object.entries(datos.rcps ?? {})),
        sesiones: new Map(Object.entries(datos.sesiones ?? {})),
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
    for (const { origen, d } of fuentes) {
        if (d.efecto !== "denegar" || !coincideAlgunPatron(peticion.accion, d.acciones))
            continue;
        if (d.condicion) {
            return pasoFinal("aws.denegacion", "indeterminado", "aws.condicionDesconocida", { origen, condicion: d.condicion });
        }
        return pasoFinal("aws.denegacion", "deniega", "aws.denegadoPor", { origen });
    }
    return pasoNoAplica("aws.denegacion", "aws.sinDenegacion");
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
    const recursoAllow = (mundo.recursos.get(peticion.ambitoId) ?? [])
        .find(d => d.principalId === peticion.principalId && d.efecto === "permitir" && coincideAlgunPatron(peticion.accion, d.acciones));
    if (recursoAllow && recursoAllow.via !== "rol") {
        if (recursoAllow.condicion) {
            return pasoFinal("aws.identidadRecurso", "indeterminado", "aws.condicionDesconocida", { origen: "recurso", condicion: recursoAllow.condicion });
        }
        const sesion = mundo.sesiones.get(peticion.principalId);
        if (recursoAllow.via === "usuario" && sesion?.length) {
            const permite = sesion.find(d => d.efecto === "permitir" && coincideAlgunPatron(peticion.accion, d.acciones));
            if (!permite)
                return pasoFinal("aws.identidadRecurso", "deniega", "aws.sesionNoPermite");
            if (permite.condicion)
                return pasoFinal("aws.identidadRecurso", "indeterminado", "aws.condicionDesconocida", { origen: "sesion", condicion: permite.condicion });
        }
        return pasoFinal("aws.identidadRecurso", "permite", "aws.concedidoPorRecursoDirecto", { via: recursoAllow.via });
    }
    const decisivo = recursoAllow ?? (mundo.identidades.get(peticion.principalId) ?? [])
        .find(d => d.efecto === "permitir" && coincideAlgunPatron(peticion.accion, d.acciones));
    if (!decisivo) {
        return pasoFinal("aws.identidadRecurso", "deniega", "aws.sinAllowDeIdentidadNiRecurso");
    }
    if (decisivo.condicion) {
        return pasoFinal("aws.identidadRecurso", "indeterminado", "aws.condicionDesconocida", { origen: recursoAllow ? "recurso" : "identidad", condicion: decisivo.condicion });
    }
    return pasoContinua("aws.identidadRecurso", recursoAllow ? "aws.concedidoPorRecursoRol" : "aws.concedidoPorIdentidad");
};
export const boundaryAws: Etapa<MundoAws> = (peticion, mundo) => {
    const declaraciones = mundo.boundaries.get(peticion.principalId);
    if (!declaraciones || declaraciones.length === 0) {
        return pasoNoAplica("aws.boundary", "aws.sinBoundary");
    }
    const permite = declaraciones.find(d => d.efecto === "permitir" && coincideAlgunPatron(peticion.accion, d.acciones));
    if (!permite) {
        return pasoFinal("aws.boundary", "deniega", "aws.boundaryNoPermite");
    }
    if (permite.condicion) {
        return pasoFinal("aws.boundary", "indeterminado", "aws.condicionDesconocida", { origen: "boundary", condicion: permite.condicion });
    }
    return pasoContinua("aws.boundary", "aws.boundaryOk");
};
export const sesionAws: Etapa<MundoAws> = (peticion, mundo) => {
    const declaraciones = mundo.sesiones.get(peticion.principalId);
    if (!declaraciones || declaraciones.length === 0) {
        return pasoNoAplica("aws.sesion", "aws.sinSesion");
    }
    const permite = declaraciones.find(d => d.efecto === "permitir" && coincideAlgunPatron(peticion.accion, d.acciones));
    if (!permite) {
        return pasoFinal("aws.sesion", "deniega", "aws.sesionNoPermite");
    }
    if (permite.condicion) {
        return pasoFinal("aws.sesion", "indeterminado", "aws.condicionDesconocida", { origen: "sesion", condicion: permite.condicion });
    }
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
