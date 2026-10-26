export type VersionMaven = "3" | "4";
export type Ciclo = "clean" | "default" | "site";
export const FASES: Record<Ciclo, readonly string[]> = {
    clean: ["pre-clean", "clean", "post-clean"],
    default: [
        "validate",
        "initialize",
        "generate-sources",
        "process-sources",
        "generate-resources",
        "process-resources",
        "compile",
        "process-classes",
        "generate-test-sources",
        "process-test-sources",
        "generate-test-resources",
        "process-test-resources",
        "test-compile",
        "process-test-classes",
        "test",
        "prepare-package",
        "package",
        "pre-integration-test",
        "integration-test",
        "post-integration-test",
        "verify",
        "install",
        "deploy",
    ],
    site: ["pre-site", "site", "post-site", "site-deploy"],
};
export function cicloDe(fase: string): Ciclo | null {
    for (const c of ["clean", "default", "site"] as const)
        if (FASES[c].includes(fase))
            return c;
    return null;
}
export const ALIAS_MAVEN_4: Record<string, string> = {
    "before:clean": "pre-clean",
    "after:clean": "post-clean",
    "sources": "generate-sources",
    "after:sources": "process-sources",
    "resources": "generate-resources",
    "after:resources": "process-resources",
    "after:compile": "process-classes",
    "test-sources": "generate-test-sources",
    "after:test-sources": "process-test-sources",
    "test-resources": "generate-test-resources",
    "after:test-resources": "process-test-resources",
    "after:test-compile": "process-test-classes",
    "before:package": "prepare-package",
    "before:integration-test": "pre-integration-test",
    "after:integration-test": "post-integration-test",
    "before:site": "pre-site",
    "after:site": "post-site",
};
export const FASES_SOLO_MAVEN_4 = ["all", "each", "build", "ready", "unit-test"] as const;
export function faseNormalizada(escrita: string, maven: VersionMaven): {
    fase: string;
    desfase: -1 | 0 | 1;
} | null {
    const f = quitarPrioridad(escrita).trim();
    if (cicloDe(f))
        return { fase: f, desfase: 0 };
    if (maven === "4") {
        const alias = ALIAS_MAVEN_4[f];
        if (alias)
            return { fase: alias, desfase: 0 };
        const m = /^(before|after):(.+)$/.exec(f);
        if (m && cicloDe(m[2]))
            return { fase: m[2], desfase: m[1] === "before" ? -1 : 1 };
    }
    return null;
}
export function prioridadDe(escrita: string): number {
    const m = /\[(-?\d+)\]\s*$/.exec(escrita);
    return m ? parseInt(m[1], 10) : 0;
}
export function quitarPrioridad(escrita: string): string {
    return escrita.replace(/\[-?\d+\]\s*$/, "");
}
export interface Vinculacion {
    fase: string;
    artefacto: string;
    goal: string;
}
const COMPILAR_Y_PROBAR: Vinculacion[] = [
    { fase: "process-resources", artefacto: "maven-resources-plugin", goal: "resources" },
    { fase: "compile", artefacto: "maven-compiler-plugin", goal: "compile" },
    { fase: "process-test-resources", artefacto: "maven-resources-plugin", goal: "testResources" },
    { fase: "test-compile", artefacto: "maven-compiler-plugin", goal: "testCompile" },
    { fase: "test", artefacto: "maven-surefire-plugin", goal: "test" },
];
const INSTALAR: Vinculacion[] = [
    { fase: "install", artefacto: "maven-install-plugin", goal: "install" },
    { fase: "deploy", artefacto: "maven-deploy-plugin", goal: "deploy" },
];
const empaqueta = (artefacto: string, goal: string): Vinculacion => ({ fase: "package", artefacto, goal });
export const VINCULACIONES: Record<string, Vinculacion[]> = {
    jar: [...COMPILAR_Y_PROBAR, empaqueta("maven-jar-plugin", "jar"), ...INSTALAR],
    war: [...COMPILAR_Y_PROBAR, empaqueta("maven-war-plugin", "war"), ...INSTALAR],
    ejb: [...COMPILAR_Y_PROBAR, empaqueta("maven-ejb-plugin", "ejb"), ...INSTALAR],
    rar: [...COMPILAR_Y_PROBAR, empaqueta("maven-rar-plugin", "rar"), ...INSTALAR],
    ear: [
        { fase: "generate-resources", artefacto: "maven-ear-plugin", goal: "generate-application-xml" },
        { fase: "process-resources", artefacto: "maven-resources-plugin", goal: "resources" },
        empaqueta("maven-ear-plugin", "ear"),
        ...INSTALAR,
    ],
    "maven-plugin": [
        COMPILAR_Y_PROBAR[0],
        COMPILAR_Y_PROBAR[1],
        { fase: "process-classes", artefacto: "maven-plugin-plugin", goal: "descriptor" },
        ...COMPILAR_Y_PROBAR.slice(2),
        empaqueta("maven-jar-plugin", "jar"),
        ...INSTALAR,
    ],
    pom: [...INSTALAR],
    bom: [...INSTALAR],
};
export const VINCULACIONES_FIJAS: Vinculacion[] = [
    { fase: "clean", artefacto: "maven-clean-plugin", goal: "clean" },
    { fase: "site", artefacto: "maven-site-plugin", goal: "site" },
    { fase: "site-deploy", artefacto: "maven-site-plugin", goal: "deploy" },
];
export const GRUPO_PLUGINS = "org.apache.maven.plugins";
