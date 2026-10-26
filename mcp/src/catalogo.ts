export type Dominio = "core" | "calc" | "api" | "diagram" | "kg" | "db" | "ai" | "logs" | "queue" | "project" | "tests" | "chem" | "chip" | "access" | "archsim" | "security" | "experiments" | "payroll";
export const DOMINIOS: Record<Dominio, {
    titulo: string;
    tools: readonly string[];
}> = {
    core: { titulo: "utilidades deterministas de toda la vida", tools: [
            "cidr_info",
            "cidr_contains",
            "cidr_vlsm",
            "count_tokens",
            "hash_text",
            "jwt_decode",
            "text_encode",
            "text_decode",
            "string_escape",
            "string_unescape",
            "regex_test",
            "regex_redos_check",
            "spreadsheet_audit",
            "timestamp_convert",
            "cron_next",
            "color_convert",
            "url_parse",
            "chmod_explain",
            "json_diff",
            "unit_convert",
            "hamming_encode",
            "hamming_check",
            "ieee754_from_decimal",
            "number_bases",
            "binary_calc",
            "semver_parse",
            "semver_satisfies",
            "wcag_contrast",
            "format_convert",
            "unicode_info",
            "json_schema_validate",
            "csv_diff"
        ] },
    calc: { titulo: "c\u00E1lculo con unidades, hojas y ecuaciones", tools: [
            "calc_eval",
            "calc_solve",
            "calc_sheet",
            "calc_derive",
            "calc_steps"
        ] },
    diagram: { titulo: "diagramas JTD y Mermaid", tools: [
            "diagram_validate",
            "diagram_svg",
            "diagram_render",
            "diagram_new",
            "diagram_add",
            "diagram_get",
            "diagram_preview",
            "mermaid_validate"
        ] },
    kg: { titulo: "grafos de conocimiento", tools: [
            "kg_query",
            "kg_validate",
            "kg_semantic_validate",
            "kg_metric"
        ] },
    db: { titulo: "bases de datos", tools: [
            "db_translate_sql",
            "db_schema_review",
            "db_docs",
            "db_entities",
            "db_join_path",
            "db_fk_infer",
            "db_rls_check",
            "db_migration_measure",
            "db_query_check"
        ] },
    ai: { titulo: "IA sobre la propia IA", tools: [
            "prompt_review",
            "rag_prepare",
            "claim_check",
            "eval_check",
            "mcp_catalog_audit",
            "practice_check"
        ] },
    logs: { titulo: "logs", tools: [
            "log_analyze",
            "log_reduce",
            "log_patterns",
            "log_stacktrace",
            "log_lint",
            "log_convert",
            "log_trends",
            "log_around",
            "log_distinguish",
            "log_rotation",
            "log_profile_check",
            "log_profile_suggest"
        ] },
    queue: { titulo: "colas, dimensionado y br\u00F3keres de mensajes", tools: [
            "queue_analyze",
            "queue_size",
            "queue_loss",
            "queue_simulate",
            "rabbit_route",
            "kafka_partition",
            "kafka_assign",
            "sns_filter"
        ] },
    project: { titulo: "taller de proyecto", tools: [
            "make_simulate",
            "make_lint",
            "make_generate",
            "make_role",
            "ignore_check",
            "dockerfile_cache",
            "make_log_diff",
            "dora_metrics",
            "maven_plan",
            "gradle_plan"
        ] },
    tests: { titulo: "auditor\u00EDa de tests", tools: [
            "test_audit",
            "test_diff_audit",
            "test_cases",
            "test_debt"
        ] },
    api: { titulo: "APIs HTTP", tools: [
            "api_collection_convert",
            "api_collection_secrets",
            "api_code_generate",
            "api_breaking_changes",
            "api_cors_preflight"
        ] },
    chip: { titulo: "dise\u00F1o de chip", tools: [
            "standard_cell",
            "ir_drop",
            "sram_noise_margin",
            "sram_read_path",
            "timing_path"
        ] },
    chem: { titulo: "qu\u00EDmica y f\u00EDsica del estado s\u00F3lido", tools: [
            "element_info",
            "element_config",
            "element_ion_config",
            "hydrogen_spectrum",
            "semiconductor_carriers",
            "bond_energy",
            "band_formation",
            "coulomb_blockade",
            "gate_geometry",
            "chem_ph",
            "chem_titration",
            "chem_solubility"
        ] },
    access: { titulo: "identidad, RBAC y gobernanza (Azure/AWS/GCP/K8s)", tools: [
            "access_check",
            "access_who_can",
            "access_diff",
            "cedar_check"
        ] },
    archsim: { titulo: "simulaci\u00F3n de arquitecturas (carga, colas, coste)", tools: [
            "archsim_validate",
            "archsim_simulate"
        ] },
    security: { titulo: "seguridad: lo que un agente debe mirar ANTES de actuar", tools: [
            "hidden_text_scan",
            "paste_check",
            "actions_audit",
            "headers_audit",
            "email_auth_audit",
            "saml_audit",
            "agent_config_audit",
            "oauth_audit",
            "k8s_network_reach",
            "k8s_manifest_check"
        ] },
    experiments: { titulo: "experimentos A/B: an\u00E1lisis, tama\u00F1o de muestra, miradas secuenciales", tools: [
            "abtest_analyze",
            "abtest_sample_size",
            "abtest_sequential"
        ] },
    payroll: { titulo: "n\u00F3minas y pensiones (Espa\u00F1a)", tools: ["pension_base"] },
};
export const NO_SOLO_LECTURA = new Set(["diagram_render", "diagram_new", "diagram_add"]);
export const DESTRUCTIVAS = new Set(["diagram_render"]);
export const NO_IDEMPOTENTES = new Set([
    "cron_next",
    "diagram_add",
    ...DOMINIOS.logs.tools,
    ...DOMINIOS.project.tools,
    "test_audit",
    "test_debt",
    "spreadsheet_audit",
]);
export const MUNDO_ABIERTO = new Set([
    ...DOMINIOS.logs.tools,
    ...DOMINIOS.project.tools,
    "test_audit",
    "test_debt",
    "test_diff_audit",
    "spreadsheet_audit",
    "diagram_render",
]);
export function mapaDeDominios(): Map<string, Dominio> {
    const m = new Map<string, Dominio>();
    for (const d of Object.keys(DOMINIOS) as Dominio[]) {
        for (const t of DOMINIOS[d].tools) {
            if (m.has(t))
                throw new Error(`[jarroba-mcp] «${t}» está declarada en dos dominios: ${m.get(t)} y ${d}`);
            m.set(t, d);
        }
    }
    return m;
}
export function cuadrarCatalogo(registradas: Iterable<string>): Map<string, Dominio> {
    const declaradas = mapaDeDominios();
    const puestas = [...registradas];
    const sinDominio = puestas.filter((t) => !declaradas.has(t));
    const fantasmas = [...declaradas.keys()].filter((t) => !puestas.includes(t));
    if (sinDominio.length || fantasmas.length) {
        throw new Error("[jarroba-mcp] el cat\u00E1logo (DOMINIOS) y las herramientas registradas no coinciden.\n" +
            (sinDominio.length ? `  registradas sin dominio declarado: ${sinDominio.join(", ")}\n` : "") +
            (fantasmas.length ? `  declaradas pero no registradas: ${fantasmas.join(", ")}\n` : "") +
            "  A\u00F1ade la tool a su dominio en DOMINIOS (src/catalogo.ts). Si no encaja en ninguno, hace falta uno nuevo.");
    }
    return declaradas;
}
export const anotacionesDe = (nombre: string) => ({
    readOnlyHint: !NO_SOLO_LECTURA.has(nombre),
    destructiveHint: DESTRUCTIVAS.has(nombre),
    idempotentHint: !NO_IDEMPOTENTES.has(nombre),
    openWorldHint: MUNDO_ABIERTO.has(nombre),
});
export const recuento = () => ({
    total: (Object.keys(DOMINIOS) as Dominio[]).reduce((n, d) => n + DOMINIOS[d].tools.length, 0),
    porDominio: (Object.keys(DOMINIOS) as Dominio[]).map((d) => ({
        dominio: d,
        titulo: DOMINIOS[d].titulo,
        n: DOMINIOS[d].tools.length,
        tools: DOMINIOS[d].tools,
    })),
});
export function dominiosPedidos(env = process.env["JARROBA_MCP_DOMAINS"]): Dominio[] | null {
    const bruto = (env ?? "").trim();
    if (!bruto)
        return null;
    const validos = Object.keys(DOMINIOS) as Dominio[];
    const pedidos = bruto.split(/[,\s]+/).filter(Boolean);
    const malos = pedidos.filter((d) => !validos.includes(d as Dominio));
    if (malos.length) {
        throw new Error(`[jarroba-mcp] dominio desconocido en JARROBA_MCP_DOMAINS: ${malos.join(", ")}.\n` +
            `  Válidos: ${validos.join(", ")}.`);
    }
    return pedidos as Dominio[];
}
