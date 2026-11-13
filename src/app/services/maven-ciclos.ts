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
export const ORDEN_MAVEN_4: readonly string[] = [
    "before:all",
    "before:initialize",
    "before:validate",
    "validate",
    "after:validate",
    "initialize",
    "after:initialize",
    "before:build",
    "before:sources",
    "sources",
    "after:sources",
    "before:resources",
    "resources",
    "after:resources",
    "before:compile",
    "compile",
    "after:compile",
    "before:ready",
    "ready",
    "after:ready",
    "before:test-sources",
    "test-sources",
    "after:test-sources",
    "before:test-resources",
    "test-resources",
    "after:test-resources",
    "before:test-compile",
    "test-compile",
    "after:test-compile",
    "before:test",
    "test",
    "after:test",
    "before:unit-test",
    "unit-test",
    "after:unit-test",
    "before:package",
    "package",
    "after:package",
    "build",
    "after:build",
    "before:verify",
    "before:integration-test",
    "integration-test",
    "after:integration-test",
    "verify",
    "after:verify",
    "before:install",
    "install",
    "after:install",
    "before:deploy",
    "deploy",
    "after:deploy",
    "all",
    "after:all",
];
export const PIDE_MAVEN_4: Readonly<Record<string, readonly [
    number,
    readonly string[]
]>> = {
    "before:all": [54, []],
    "before:initialize": [7, ["after:all"]],
    "before:validate": [5, ["after:initialize", "after:all"]],
    "validate": [5, ["after:initialize", "after:all"]],
    "after:validate": [5, ["after:initialize", "after:all"]],
    "initialize": [7, ["after:all"]],
    "after:initialize": [7, ["after:all"]],
    "before:build": [40, ["after:all"]],
    "before:sources": [11, ["after:build", "after:all"]],
    "sources": [11, ["after:build", "after:all"]],
    "after:sources": [11, ["after:build", "after:all"]],
    "before:resources": [14, ["after:build", "after:all"]],
    "resources": [14, ["after:build", "after:all"]],
    "after:resources": [14, ["after:build", "after:all"]],
    "before:compile": [17, ["after:build", "after:all"]],
    "compile": [17, ["after:build", "after:all"]],
    "after:compile": [17, ["after:build", "after:all"]],
    "before:ready": [20, ["after:build", "after:all"]],
    "ready": [20, ["after:build", "after:all"]],
    "after:ready": [20, ["after:build", "after:all"]],
    "before:test-sources": [23, ["after:build", "after:all"]],
    "test-sources": [23, ["after:build", "after:all"]],
    "after:test-sources": [23, ["after:build", "after:all"]],
    "before:test-resources": [26, ["after:build", "after:all"]],
    "test-resources": [26, ["after:build", "after:all"]],
    "after:test-resources": [26, ["after:build", "after:all"]],
    "before:test-compile": [29, ["after:build", "after:all"]],
    "test-compile": [29, ["after:build", "after:all"]],
    "after:test-compile": [29, ["after:build", "after:all"]],
    "before:test": [32, ["after:build", "after:all"]],
    "test": [32, ["after:build", "after:all"]],
    "after:test": [32, ["after:build", "after:all"]],
    "before:unit-test": [35, ["after:build", "after:all"]],
    "unit-test": [35, ["after:build", "after:all"]],
    "after:unit-test": [35, ["after:build", "after:all"]],
    "before:package": [38, ["after:build", "after:all"]],
    "package": [38, ["after:build", "after:all"]],
    "after:package": [38, ["after:build", "after:all"]],
    "build": [40, ["after:all"]],
    "after:build": [40, ["after:all"]],
    "before:verify": [46, ["after:all"]],
    "before:integration-test": [44, ["after:verify", "after:all"]],
    "integration-test": [44, ["after:verify", "after:all"]],
    "after:integration-test": [44, ["after:verify", "after:all"]],
    "verify": [46, ["after:all"]],
    "after:verify": [46, ["after:all"]],
    "before:install": [49, ["after:all"]],
    "install": [49, ["after:all"]],
    "after:install": [49, ["after:all"]],
    "before:deploy": [52, ["after:all"]],
    "deploy": [52, ["after:all"]],
    "after:deploy": [52, ["after:all"]],
    "all": [54, []],
    "after:all": [54, []],
    "generate-sources": [11, ["after:build", "after:all"]],
    "process-sources": [11, ["after:build", "after:all"]],
    "generate-resources": [14, ["after:build", "after:all"]],
    "process-resources": [14, ["after:build", "after:all"]],
    "process-classes": [17, ["after:build", "after:all"]],
    "generate-test-sources": [23, ["after:build", "after:all"]],
    "process-test-sources": [23, ["after:build", "after:all"]],
    "generate-test-resources": [26, ["after:build", "after:all"]],
    "process-test-resources": [26, ["after:build", "after:all"]],
    "process-test-classes": [29, ["after:build", "after:all"]],
    "prepare-package": [38, ["after:build", "after:all"]],
    "pre-integration-test": [44, ["after:verify", "after:all"]],
    "post-integration-test": [44, ["after:verify", "after:all"]],
};
const CLEAN_MAVEN_4 = ["pre-clean", "clean", "post-clean", "before:clean", "after:clean"];
const NOMBRE_MAVEN_3: Record<string, string> = { ...ALIAS_MAVEN_4 };
export function nombreVisible(fase4: string): string { return NOMBRE_MAVEN_3[fase4] ?? fase4; }
export function esFaseMaven4(f: string): boolean { return f in PIDE_MAVEN_4 || CLEAN_MAVEN_4.includes(f) || FASES.site.includes(f); }
export function fasesMaven4(fase: string): string[] | null {
    if (CLEAN_MAVEN_4.includes(fase))
        return ["pre-clean", "clean", "post-clean"];
    const d = PIDE_MAVEN_4[fase];
    if (!d)
        return null;
    return [...ORDEN_MAVEN_4.slice(0, d[0]), ...d[1]].map(nombreVisible);
}
export function antesDeMaven4(fase: string): string {
    const m4 = Object.entries(ALIAS_MAVEN_4).find(([, m3]) => m3 === fase)?.[0] ?? fase;
    const m = /^before:(.+)$/.exec(m4);
    return m && m[1] !== "all" ? m[1] : "";
}
export function faseNormalizada(escrita: string, maven: VersionMaven): {
    fase: string;
    desfase: -1 | 0 | 1;
} | null {
    const f = quitarPrioridad(escrita).trim();
    if (cicloDe(f))
        return { fase: f, desfase: 0 };
    if (maven === "4") {
        if (ALIAS_MAVEN_4[f])
            return { fase: ALIAS_MAVEN_4[f], desfase: 0 };
        if (ORDEN_MAVEN_4.includes(f))
            return { fase: nombreVisible(f), desfase: 0 };
        const m = /^(before|after):(.+)$/.exec(f);
        if (m && FASES.site.includes(m[2]))
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
