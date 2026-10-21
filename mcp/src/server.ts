#!/usr/bin/env -S npx tsx
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { getMath } from "../../src/app/shared/mathjs-lazy";
import { importArchsim, dslErrorEn } from "../../src/app/features/archsim/archsim-dsl";
import { runtimeToSteady } from "../../src/app/features/archsim/archsim-runtime-sim";
import { runtimeInsights } from "../../src/app/features/archsim/archsim-insights";
import { costBreakdown } from "../../src/app/features/archsim/archsim-cloud-catalog";
import { measure } from "../../src/app/features/archsim/archsim-challenges";
import { evaluarSeguro, freeVars, simbolosUnidad } from "../../src/app/services/calc-eval.service";
import { evaluarHoja, monedasDeHoja, registraMonedas, resumirHoja, hojaAMarkdown } from "../../src/app/services/calc-sheet.service";
import { resolver as resolverEcuacion, resolverSistema } from "../../src/app/services/calc-solve.service";
import { derivar, MAX_ORDEN, explicarEcuacion, explicarDerivada, explicarGauss, COBERTURA, } from "../../src/app/services/calc-steps.service";
import { SubnetService } from "../../src/app/services/subnet.service";
import { PromptLintService, type SeccionPrompt } from "../../src/app/services/prompt-lint.service";
import { RagRetrievalService } from "../../src/app/services/rag-retrieval.service";
import { LogParseService, type LogFormat } from "../../src/app/services/log-parse.service";
import { LogPatternsService } from "../../src/app/services/log-patterns.service";
import { LogStacktraceService } from "../../src/app/services/log-stacktrace.service";
import { LogReduceService } from "../../src/app/services/log-reduce.service";
import { LogConvertService, type LogTarget } from "../../src/app/services/log-convert.service";
import { LogLintService } from "../../src/app/services/log-lint.service";
import { LogProfileService } from "../../src/app/services/log-profile.service";
import { ElectronConfigService } from "../../src/app/services/electron-config.service";
import { SpectrumService } from "../../src/app/services/spectrum.service";
import { SemiconductorService, MATERIALS, K_EV } from "../../src/app/services/semiconductor.service";
import { leerCurl, escribirCurl } from "../../src/app/services/api-curl";
import { esPostman, leerPostman, escribirPostman } from "../../src/app/services/api-postman";
import { escribirColeccionBru, leerColeccionBru, esBru, leerBru } from "../../src/app/services/api-bruno";
import { esInsomnia, leerInsomnia } from "../../src/app/services/api-insomnia";
import { esOpenApi, leerOpenApi, leerEspec } from "../../src/app/services/api-openapi";
import { esHar, leerHar } from "../../src/app/services/api-har";
import { LENGUAJES, type Lenguaje as LenguajeApi, generar } from "../../src/app/services/api-codegen";
import { comparar, informeMarkdown } from "../../src/app/services/api-diff";
import { necesitaPreflight } from "../../src/app/services/api-envio";
import { buscarSecretos, campo, type ApiColeccion } from "../../src/app/services/api-ir";
import { BondEnergyService } from "../../src/app/services/bond-energy.service";
import { BandFormationService } from "../../src/app/services/band-formation.service";
import { SingleElectronService, R_QUANTUM } from "../../src/app/services/single-electron.service";
import { GateGeometryService } from "../../src/app/services/gate-geometry.service";
import { SramService, type SramMode } from "../../src/app/services/sram.service";
import { PowerGridService } from "../../src/app/services/power-grid.service";
import { StdCellService } from "../../src/app/services/std-cell.service";
import { SenseAmpService } from "../../src/app/services/sense-amp.service";
import { TimingService, factorPorCaida } from "../../src/app/services/timing.service";
import { elementByZ, elementBySymbol, trendValue } from "../../src/app/services/elements-data";
import { groupRotations, looksLikeLog } from "../../src/app/services/log-rotation.service";
import { trends as minarTendencias, notable, around as alrededorDe } from "../../src/app/services/log-trends.service";
import { distinguir } from "../../src/app/services/log-distinguir";
import { diffPorClave } from "../../src/app/shared/data-engine/diff";
import { fileSource } from "../../src/app/shared/data-engine/file-source";
import { adivinarSeparador, detectarCodificacion, partirCsv } from "../../src/app/shared/data-engine/csv";
import { ClaimCheckService } from "../../src/app/services/claim-check.service";
import { EvalBankService, type Caso } from "../../src/app/services/eval-bank.service";
import { HashService } from "../../src/app/services/hash.service";
import { TokenCounterService, ENCODINGS, type Encoding } from "../../src/app/services/token-counter.service";
import { auditarCatalogo, parseToolsList } from "../../src/app/services/mcp-audit.service";
import { compararCatalogos } from "../../src/app/services/mcp-tool-poisoning.service";
import { JwtService } from "../../src/app/services/jwt.service";
import { TimestampService } from "../../src/app/services/timestamp.service";
import { RegexTesterService } from "../../src/app/services/regex-tester.service";
import { CronService } from "../../src/app/services/cron.service";
import { ColorService } from "../../src/app/services/color.service";
import { CoderDecoderService } from "../../src/app/services/coder-decoder.service";
import { JsonDiffService } from "../../src/app/services/json-diff.service";
import { StringEscapeService, type EscapeMode } from "../../src/app/services/string-escape.service";
import { UrlParserService } from "../../src/app/services/url-parser.service";
import { ChmodService } from "../../src/app/services/chmod.service";
import { UnitConversionService } from "../../src/app/services/unit-conversion.service";
import { HammingService } from "../../src/app/services/hamming.service";
import { Ieee754Service } from "../../src/app/services/ieee754.service";
import { SemverService } from "../../src/app/services/semver.service";
import { BinaryCalcService, type ArithOp, type BitOp, type BitWidth } from "../../src/app/services/binary-calc.service";
import { WcagContrastService } from "../../src/app/services/wcag-contrast.service";
import { FormatConverterService, type FormatType } from "../../src/app/services/format-converter.service";
import { UnicodeService } from "../../src/app/services/unicode.service";
import { SqlImportService } from "../../src/app/services/sql-import.service";
import { DesignCheckService } from "../../src/app/services/design-check.service";
import { SchemaDocService } from "../../src/app/services/schema-doc.service";
import { TestParseService, GRAMATICAS } from "../../src/app/services/test-parse.service";
import { TestAuditService } from "../../src/app/services/test-audit.service";
import { TestDiffService } from "../../src/app/services/test-diff.service";
import { TestCasesService, type Parametro } from "../../src/app/services/test-cases.service";
import { textoAvisoEn, textoCasoEn, textoPropiedadEn, textoTecnicaEn } from "../../src/app/services/test-cases-textos-en";
import { TestProjectService } from "../../src/app/services/test-project.service";
import type { Lenguaje } from "../../src/app/services/test-audit.model";
import { erlangB, mmc, mmck, mmcLoss, serversNeeded, simulateQueue, littleError } from "../../src/app/services/queueing.service";
import { rabbitRoute } from "../../src/app/services/brokers/rabbit-route";
import { partitionForKey } from "../../src/app/services/brokers/kafka-partition";
import { kafkaAssign } from "../../src/app/services/brokers/kafka-assign";
import { snsFilter } from "../../src/app/services/brokers/sns-filter";
import { rabbitEn, kafkaAssignEn, snsFilterEn } from "./brokers";
import { informeCatalogoEn } from "./mcp-audit-en";
import { secretosEn, informeApiEn } from "./api-en";
import { CodeGenService, type CodeTarget } from "../../src/app/services/code-gen.service";
import { CATALOG_QUERIES, assembleSchema, type SchemaModel } from "../../src/app/services/schema-catalog";
import { candidates as fkCandidates, evidenceSql, orphanSql, addFkSql, cobertura, ordenarPorEvidencia, esRelevante, type FkEvidence, } from "../../src/app/services/fk-infer.service";
import { findPaths, joinSql, joinCountSql, pathLabel, JoinPathService } from "../../src/app/services/join-path.service";
import { readRls, esquemasUsablesDe, superusuariosDe, diagnose as rlsDiagnose, simulateRls, tableId as rlsTableId, type RunnerSql, type RlsTable, } from "../../src/app/services/rls.service";
import { leerMakefile } from "../../src/app/services/makefile-parse";
import { planificar, type FicheroVirtual } from "../../src/app/services/makefile-plan";
import { revisar as revisarMakefile } from "../../src/app/services/makefile-lint";
import { generarMakefile, type Stack } from "../../src/app/services/makefile-gen";
import { diagnosticar as diagnosticarRol, convertir as convertirMake, type Destino } from "../../src/app/services/makefile-rol";
import { leerReglas, decidir, comparar as compararIgnore, revisarIgnore } from "../../src/app/services/ignore-rules";
import { leerDockerfile, simularCache, revisarDockerfile } from "../../src/app/services/dockerfile";
import { analizarLogDeMake } from "../../src/app/services/make-log";
import { avisoDfEn, diagMkEn, carreraEn, hallazgoMkEn, divergenciaEn, avisoIgnoreEn, senalEn, perdidaEn, omitidoEn, avisoConvEn } from "./proyecto-en";
import { PIPELINE_AZURE, crearMundoAzure } from "../../src/app/services/accesos-azure";
import { PIPELINE_AWS, crearMundoAws } from "../../src/app/services/accesos-aws";
import { PIPELINE_GCP, crearMundoGcp } from "../../src/app/services/accesos-gcp";
import { PIPELINE_K8S, crearMundoK8s } from "../../src/app/services/accesos-k8s";
import { evaluar as evaluarAcceso, quienPuede as quienPuedeAcceso } from "../../src/app/services/accesos-motor";
import { diffAcceso } from "../../src/app/services/accesos-hallazgos";
import { validateJtd } from "../../src/app/shared/jtd";
import { renderJtdSvg } from "../../src/app/features/diagram/jtd-svg";
let RdfStoreCache: any;
async function rdfStore(): Promise<any> {
    RdfStoreCache ??= (await import("oxigraph")).Store;
    return new RdfStoreCache();
}
import { validateShacl, type Row } from "../../src/app/services/shacl-core";
import { validateSemantic, findMetric, instantiateMetric, type SemanticLayer, } from "../../src/app/features/knowledge-graph/semantic-layer";
import { spawnSync } from "node:child_process";
import vm from "node:vm";
import { DOMINIOS, cuadrarCatalogo, anotacionesDe, recuento, dominiosPedidos, type Dominio } from "./catalogo";
import { textoEn, pegadoEn, accionesEn, cabecerasEn, correoEn, samlEn, agenteEn, cambiosCatalogoEn, oauthEn, oidcEn, AVISO_JWT, practicasEn, indicePracticasEn, AREA_PRACTICA, AREA_PRACTICA_ES, alcanceEn, explicacionEn, hallazgosK8sEn, resumenK8s, EXTERNO_EN, erroresEsquemaEn, pssEn, rbacEn } from "./seguridad";
import { comparacionEn, srmEn, multiEn, doraEn } from "./experimentos";
import { FACTOR_CLAUDE_CODE, FACTOR_CLAUDE_FUENTE } from "./factor-claude";
import { migracionEn, comprobacionEn, equivalenciaEn, impactoEn } from "./migracion";
import { medirMigracion } from "../../src/app/services/migration-impact.service";
import { writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const S = {
    promptLint: new PromptLintService(),
    rag: new RagRetrievalService(),
    claim: new ClaimCheckService(),
    evals: new EvalBankService(),
    subnet: new SubnetService(),
    hash: new HashService(),
    token: new TokenCounterService(),
    jwt: new JwtService(),
    ts: new TimestampService(),
    regex: new RegexTesterService(),
    cron: new CronService(),
    color: new ColorService(),
    codec: new CoderDecoderService(),
    jsonDiff: new JsonDiffService(),
    esc: new StringEscapeService(),
    url: new UrlParserService(),
    chmod: new ChmodService(),
    unit: new UnitConversionService(),
    hamming: new HammingService(),
    ieee: new Ieee754Service(),
    semver: new SemverService(),
    binary: new BinaryCalcService(),
    wcag: new WcagContrastService(),
    format: new FormatConverterService(),
    unicode: new UnicodeService(),
    sqlImport: new SqlImportService(),
    designCheck: new DesignCheckService(),
    schemaDoc: new SchemaDocService(),
    codeGen: new CodeGenService(),
    logParse: new LogParseService(),
    logPat: new LogPatternsService(),
    logTrace: new LogStacktraceService(),
    logRed: new LogReduceService(),
    logConv: new LogConvertService(),
    logLint: new LogLintService(),
    logProf: new LogProfileService(),
    econf: new ElectronConfigService(),
    spec: new SpectrumService(),
    semi: new SemiconductorService(),
    bond: new BondEnergyService(),
    band: new BandFormationService(),
    set: new SingleElectronService(),
    gate: new GateGeometryService(),
    sram: new SramService(),
    malla: new PowerGridService(),
    celda: new StdCellService(),
    lectura: new SenseAmpService(),
    timing: new TimingService(),
};
async function abrirPglite(): Promise<{
    db: any;
    error?: undefined;
} | {
    db?: undefined;
    error: string;
}> {
    try {
        const { PGlite } = await import("@electric-sql/pglite");
        const [{ unaccent }, { pg_trgm }] = await Promise.all([
            import("@electric-sql/pglite/contrib/unaccent"),
            import("@electric-sql/pglite/contrib/pg_trgm")
        ]);
        return { db: await PGlite.create({ extensions: { unaccent, pg_trgm } }) };
    }
    catch (e: any) {
        return { error: `Could not start the embedded PostgreSQL (pglite): ${String(e?.message ?? e)}` };
    }
}
function runDePglite(dbPg: any) {
    const db = dbPg as {
        exec(q: string): Promise<{
            rows?: unknown[];
            affectedRows?: number;
            fields?: {
                name: string;
                dataTypeID: number;
            }[];
        }[]>;
    };
    const detalle = (e: any) => (e && typeof e === "object" && typeof e.code === "string"
        ? { code: e.code, ...(e.position ? { position: Number(e.position) } : {}) } : undefined);
    return async (sql: string) => {
        try {
            let previo = 0;
            return (await db.exec(sql)).map((r) => {
                const total = r.affectedRows ?? 0;
                const affected = Math.max(0, total - previo);
                previo = Math.max(previo, total);
                return { rows: (r.rows ?? []) as Record<string, unknown>[], fields: (r.fields ?? []).map((f) => ({ name: f.name, typeId: f.dataTypeID })), affected } as {
                    rows: Record<string, unknown>[];
                    fields: {
                        name: string;
                        typeId: number;
                    }[];
                    affected: number;
                    error?: string;
                    errorInfo?: {
                        code?: string;
                        position?: number;
                    };
                };
            });
        }
        catch (e: any) {
            return [{ rows: [], fields: [], affected: 0, error: String(e?.message ?? e), errorInfo: detalle(e) }];
        }
    };
}
async function esquemaDesdeDdl(ddl: string): Promise<{
    schema: SchemaModel;
    error?: string;
}> {
    const abierta = await abrirPglite();
    if (abierta.error)
        return { schema: { schemas: [], tables: [], roles: [], enums: [] }, error: abierta.error };
    const db = abierta.db;
    try {
        try {
            await db.exec(ddl);
        }
        catch (e: any) {
            return { schema: { schemas: [], tables: [], roles: [], enums: [] }, error: String(e?.message ?? e) };
        }
        const r = await Promise.all(CATALOG_QUERIES.map((q) => db.query(q)));
        return { schema: assembleSchema({
                cols: r[0].rows,
                pks: r[1].rows,
                fks: r[2].rows,
                idx: r[3].rows,
                roles: r[4].rows,
                nss: r[5].rows,
                chk: r[6].rows,
                trg: r[7].rows,
                enm: r[8].rows,
                part: r[9].rows,
            }) };
    }
    finally {
        await (db as any).close?.();
    }
}
async function conPostgres<T>(sql: string, fn: (ctx: {
    schema: SchemaModel;
    run: RunnerSql;
}) => Promise<T>): Promise<{
    valor?: T;
    error?: string;
}> {
    const abierta = await abrirPglite();
    if (abierta.error)
        return { error: abierta.error };
    const db = abierta.db;
    try {
        try {
            await db.exec(sql);
        }
        catch (e: any) {
            return { error: String(e?.message ?? e) };
        }
        const r = await Promise.all(CATALOG_QUERIES.map((q) => db.query(q)));
        const schema = assembleSchema({
            cols: r[0].rows,
            pks: r[1].rows,
            fks: r[2].rows,
            idx: r[3].rows,
            roles: r[4].rows,
            nss: r[5].rows,
            chk: r[6].rows,
            trg: r[7].rows,
            enm: r[8].rows,
            part: r[9].rows,
        });
        const run: RunnerSql = {
            async query(q: string) {
                try {
                    const res = await db.query(q);
                    return { rows: res.rows as unknown[], affected: res.affectedRows };
                }
                catch (e: any) {
                    return { rows: [], error: String(e?.message ?? e) };
                }
            },
            async exec(q: string) { try {
                return await db.exec(q);
            }
            catch {
                return null;
            } },
        };
        return { valor: await fn({ schema, run }) };
    }
    finally {
        await (db as any).close?.();
    }
}
function idDeTabla(schema: SchemaModel, nombre: string): string | null {
    const n = nombre.trim();
    const t = schema.tables.find((x) => x.id === n)
        ?? schema.tables.find((x) => x.schema === "public" && x.name === n)
        ?? schema.tables.find((x) => x.name === n);
    return t?.id ?? null;
}
const resumen = (s: SchemaModel) => ({
    tables: s.tables.filter((t) => !t.isView).map((t) => ({
        name: t.schema === "public" ? t.name : `${t.schema}.${t.name}`,
        columns: t.columns.map((c) => ({
            name: c.name,
            type: c.type,
            notNull: c.notNull || undefined,
            pk: c.isPk || undefined,
            fk: c.isFk || undefined,
            unique: c.isUnique || undefined,
        })),
        relations: t.foreignKeys.map((f) => `${f.columns.join(",")} → ${f.refTable}(${f.refColumns.join(",")})`),
        indexes: (t.indexes ?? []).filter((i) => !i.primary).map((i) => `${i.name} (${i.columns.join(", ")})${i.unique ? " unique" : ""}`),
        checks: (t.checks ?? []).map((c) => c.def),
    })),
    views: s.tables.filter((t) => t.isView).map((t) => t.name),
    enums: (s.enums ?? []).map((e) => `${e.name}: ${e.values.join(", ")}`),
});
function noSeLee(ruta: string, e: unknown): string {
    const msg = String((e as Error)?.message ?? e);
    const pista = /ENOENT/.test(msg) && process.env["JARROBA_MCP_CONTAINER"] === "1"
        ? " This server is running in a container: it only sees folders mounted into it (e.g. -v \"$PWD:$PWD\" -w \"$PWD\")."
        : "";
    return `Could not read "${ruta}": ${msg}.${pista}`;
}
const ok = (data: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(data, (_k, v) => (typeof v === "bigint" ? v.toString() : v), 2) }] });
const err = (msg: string) => ({ content: [{ type: "text" as const, text: msg }], isError: true });
const nn = <T>(v: T | null, msg: string) => (v == null ? err(msg) : ok(v));
function conPresupuesto<T>(fn: () => T, ms: number): {
    valor: T;
} | {
    agotado: true;
} {
    try {
        return { valor: vm.runInNewContext("fn()", { fn }, { timeout: ms }) as T };
    }
    catch (e: any) {
        if (/timed out/i.test(String(e?.message)))
            return { agotado: true };
        throw e;
    }
}
const DOMINIO_EN: Record<Dominio, string> = {
    core: "core utilities (hash, regex, unit/base/CIDR conversion, JWT decode, timestamps\u2026)",
    calc: "math with units, equations, and sheets",
    diagram: "diagrams (JTD: validate, render, build incrementally; Mermaid: check it parses)",
    kg: "knowledge graphs (SPARQL/RDF query and validation)",
    db: "databases (SQL translation, schema review, docs, measured migration locks)",
    ai: "AI-on-AI review (prompt/RAG/claim checks, MCP catalogue audit)",
    logs: "log analysis (parsing, patterns, stack traces, rotation)",
    queue: "queueing and capacity math, RabbitMQ routing and Kafka partitioning",
    project: "project build tooling (Makefile/Docker simulation and lint, DORA metrics from gh/git)",
    tests: "test-suite auditing",
    chem: "chemistry and solid-state physics",
    api: "HTTP APIs (collections, CORS, breaking-change detection)",
    chip: "chip design (timing, IR drop, SRAM margins)",
    access: "identity/RBAC reasoning across Azure, AWS, GCP and Kubernetes on one neutral model",
    archsim: "architecture simulation (load, queues and lag, bottlenecks, cost; the archsim format)",
    experiments: "A/B experiment statistics (analysis with the right test and SRM, sample size, sequential looks)",
    security: "security checks before acting (hidden Unicode instructions, secrets in a paste/HAR, GitHub Actions, HTTP headers, SPF/DKIM/DMARC, SAML, agent configs)",
};
function instructionsDe(pedidos: Dominio[] | null): string {
    const { porDominio } = recuento();
    const activos = pedidos ? porDominio.filter((d) => pedidos.includes(d.dominio)) : porDominio;
    const total = activos.reduce((n, d) => n + d.n, 0);
    const lista = activos.map((d) => DOMINIO_EN[d.dominio]).join("; ");
    return `Jarroba Tools: ${total} deterministic, side-effect-free tools — ${lista}. Search here `
        + "whenever a task needs an exact, reproducible computation instead of your own estimate. Each "
        + "tool's own annotations say honestly whether it only reads, writes, or can be destructive.";
}
declare const __VERSION_PAQUETE__: string | undefined;
const server = new McpServer({ name: "jarroba-tools", version: typeof __VERSION_PAQUETE__ === "string" ? __VERSION_PAQUETE__ : "0.0.0-dev" }, { instructions: instructionsDe(dominiosPedidos()) });
const ESCAPE_MODES: [
    EscapeMode,
    ...EscapeMode[]
] = ["javascript", "json", "sql", "regex", "html", "url", "css"];
const REGISTRADAS = new Map<string, {
    update: (u: {
        annotations?: Record<string, unknown>;
    }) => void;
    remove: () => void;
}>();
for (const metodo of ["tool", "registerTool"] as const) {
    const original = (server as any)[metodo].bind(server);
    (server as any)[metodo] = (nombre: string, ...resto: unknown[]) => {
        const handle = original(nombre, ...resto);
        REGISTRADAS.set(nombre, handle);
        return handle;
    };
}
server.tool("cidr_info", "Analyze an IPv4 network from CIDR or IP+mask: network and broadcast addresses, first/last host, mask and wildcard, host count, class, private/special ranges, binary form and reverse PTR name.", { input: z.string().describe("e.g. \"192.168.1.10/24\" or \"10.0.0.0 255.255.255.0\"") }, async ({ input }) => nn(S.subnet.calculate(input), `Not a valid IPv4 input: "${input}"`));
server.tool("cidr_contains", "Is this IP inside that CIDR network? Returns true/false.", { cidr: z.string(), ip: z.string() }, async ({ cidr, ip }) => { const r = S.subnet.contains(cidr, ip); return r == null ? err("Invalid CIDR or IP") : ok({ cidr, ip, contains: r }); });
server.tool("cidr_vlsm", "Split a base network into variable-length subnets (VLSM) sized to the host counts you ask for.", { base: z.string(), requests: z.array(z.object({ name: z.string(), hosts: z.number().int().positive() })) }, async ({ base, requests }) => nn(S.subnet.vlsm(base, requests), "Invalid base network, or the subnets do not fit."));
const encIds = ENCODINGS.map(e => e.id) as [
    Encoding,
    ...Encoding[]
];
const ABIERTOS = { qwen3: { contextWindow: 32768 }, "mistral-v3": { contextWindow: 32768 } } as const;
const tokenizadoresMod = diferido(() => import("./tokenizadores.mjs"));
server.tool("count_tokens", "Count tokens with a model's real tokenizer: o200k_base (GPT-4o and later), cl100k_base (GPT-4/3.5), p50k_base, r50k_base; qwen3 (Qwen3/Qwen2.5 family) and mistral-v3 (Mistral 7B v0.3 and similar), run locally. Claude's tokenizer is not public: claude-estimate is o200k \u00D7 a measured factor, an estimate. Returns tokens, words, characters and % of the context window.", { text: z.string(), encoding: z.enum([...encIds, "qwen3", "mistral-v3", "claude-estimate"]).default("o200k_base") }, async ({ text, encoding }) => {
    if (!text.trim())
        return err("Empty text");
    const base = (tokens: number, contextWindow: number) => ({
        tokens,
        words: text.trim().split(/\s+/).filter(Boolean).length,
        chars: text.length,
        contextPercent: Math.min(100, (tokens / contextWindow) * 100),
        contextWindow,
    });
    if (encoding === "claude-estimate") {
        const r = await S.token.count(text, "o200k_base");
        if (!r)
            return err("Encoding not available");
        return ok({ encoding, ...base(Math.round(r.tokens * FACTOR_CLAUDE_CODE), 200000), o200kTokens: r.tokens, factor: FACTOR_CLAUDE_CODE, note: `Estimate, not a count: ${FACTOR_CLAUDE_FUENTE}. Other kinds of text (other languages, code) may differ.` });
    }
    if (encoding === "qwen3" || encoding === "mistral-v3") {
        const c = await tokenizadoresMod();
        if ("error" in c)
            return c.error;
        return ok({ encoding, ...base(await c.m.contarAbierto(encoding, text), ABIERTOS[encoding].contextWindow) });
    }
    const r = await S.token.count(text, encoding);
    return r ? ok({ encoding, ...r }) : err("Encoding not available");
});
server.tool("hash_text", "SHA-256, SHA-384 and SHA-512 (hex) of a UTF-8 string.", { text: z.string() }, async ({ text }) => ok({ length: text.length, ...(await S.hash.hash(text)) }));
server.tool("jwt_decode", "Decode a JSON Web Token WITHOUT verifying its signature \u2014 header, payload, expiry \u2014 and flag what makes it dangerous to accept (RFC 8725bis / RFC 9068): alg \"none\", no exp, exp that is not a NumericDate, alg differing only in letter case, a kid with path traversal or injection characters, a key or key URL carried in the header (jwk/jku/x5u), an access token without typ at+jwt, illegal characters. Give `expectedAlgorithm` (what your verifier uses) and, optionally, `key` to also catch algorithm confusion (HMAC verified with a public key) and HMAC secrets shorter than the hash. The key is only inspected locally, never sent anywhere.", {
    token: z.string(),
    expectedAlgorithm: z.string().optional().describe("The alg your verifier expects, e.g. RS256"),
    key: z.string().optional().describe("The secret or public key your verifier uses (PEM, JWK or HMAC secret)"),
    keyEncoding: z.enum(["text", "base64", "hex"]).default("text").describe("How an HMAC secret is encoded"),
}, async ({ token, expectedAlgorithm, key, keyEncoding }) => {
    const d = S.jwt.decode(token);
    if (!d)
        return err("Not a valid JWT");
    const c = await seguridadMod();
    if ("error" in c)
        return ok({ ...d, securityWarnings: "unavailable in this package (install @jarroba/mcp for them)" });
    const alg = String(d.header["alg"] ?? "");
    const avisos = c.m.avisosJwt({
        headerAlg: alg,
        algElegido: (expectedAlgorithm ?? alg) as never,
        claveTexto: key ?? "",
        formatoSecreto: ({ text: "texto", base64: "base64", hex: "hex" } as const)[keyEncoding],
        payload: d.payload,
        header: d.header,
        token,
    }).filter((a) => key !== undefined || (a !== "secreto-corto" && a !== "confusion-clave-publica"));
    const ahora = Math.floor(Date.now() / 1000);
    const temporal = (k: string) => ((k in d.payload) ? c.m.estadoTemporal(k, d.payload[k], ahora) : null);
    const EST: Record<string, string> = { ok: "ok", caducado: "expired", "aun-no": "not-yet-valid", "no-numerico": "not-a-numericdate" };
    return ok({
        ...d,
        warnings: [
            ...(alg.toLowerCase() === "none" ? [{ warning: "alg-none-unsigned", severe: true }] : []),
            ...avisos.map((a) => ({ warning: AVISO_JWT[a], severe: c.m.esAvisoGrave(a) })),
        ],
        timeClaims: { exp: temporal("exp") && EST[temporal("exp")!], nbf: temporal("nbf") && EST[temporal("nbf")!] },
        keyChecks: key === undefined ? "skipped: pass `key` to check algorithm confusion and HMAC secret length" : "done",
    });
});
server.tool("text_encode", "Encode a string to URL-encoding, Base64 and HTML-escape (all three at once).", { input: z.string() }, async ({ input }) => ok(S.codec.encode(input)));
server.tool("text_decode", "Try to decode a string from URL-encoding, Base64 and HTML entities.", { input: z.string() }, async ({ input }) => ok(S.codec.decode(input)));
server.tool("string_escape", "Escape a string for a target context: javascript, json, sql, regex, html, url or css.", { text: z.string(), mode: z.enum(ESCAPE_MODES) }, async ({ text, mode }) => ok({ mode, result: S.esc.escape(text, mode) }));
server.tool("string_unescape", "Unescape a string from a context (javascript, json, sql, regex, html, url, css).", { text: z.string(), mode: z.enum(ESCAPE_MODES) }, async ({ text, mode }) => ok({ mode, result: S.esc.unescape(text, mode) }));
const REGEX_MS = 2000;
server.tool("regex_test", "Test a regex against a string: whether it matches, every match and its capture groups. Exact matching, not guessed.", { pattern: z.string(), flags: z.string().default("g"), text: z.string() }, async ({ pattern, flags, text }) => {
    const r = conPresupuesto(() => S.regex.test(pattern, flags, text), REGEX_MS);
    if ("agotado" in r) {
        return err(`The pattern did not finish within ${REGEX_MS} ms and was cut off so it would not block the other tools.\n` +
            "This is almost always catastrophic backtracking: one quantifier nested inside another (e.g. `(a+)+`, " +
            "`(\\w*)*`, `(.*)*`) makes the engine try an exponential number of ways to split the input when the text " +
            "does NOT match. The fix is not a shorter input: remove the nesting (`a+`), narrow what the inner part " +
            "can match (`[^b]+` instead of `.+`), or use atomic groups where your flavour supports them.");
    }
    return nn(r.valor, "Invalid regex pattern");
});
server.tool("timestamp_convert", "Convert an instant between formats: Unix (s/ms), ISO 8601, human, log, and per-locale/timezone. Accepts a Unix number or a date string.", { input: z.string().describe("e.g. \"1700000000\" or \"2024-01-15T10:30:00Z\"") }, async ({ input }) => { const t = input.trim(); const asNum = /^-?\d+$/.test(t); return nn(asNum ? S.ts.fromUnix(Number(t)) : S.ts.fromDateString(t), "Could not interpret that date/timestamp"); });
server.tool("cron_next", "Next run times of a 5-field cron expression, as ISO dates. \"When does this actually fire?\" is a calculation LLMs routinely get wrong.", { expr: z.string().describe("e.g. \"*/15 9-17 * * 1-5\""), count: z.number().int().min(1).max(30).default(5), tz: z.string().optional().describe("IANA timezone, e.g. \"Europe/Madrid\"") }, async ({ expr, count, tz }) => { try {
    const d = S.cron.nextExecutions(expr, count, tz);
    return d.length ? ok({ expr, tz: tz ?? "local", next: d.map(x => x.toISOString()) }) : err("Invalid cron expression");
}
catch {
    return err("Invalid cron expression");
} });
server.tool("color_convert", "Convert a color between HEX, RGB and HSL. Accepts \"#3498db\", \"rgb(52,152,219)\", \"hsl(...)\" or CSS names.", { input: z.string() }, async ({ input }) => nn(S.color.parse(input), "Color not recognized"));
server.tool("url_parse", "Break a URL into protocol, host, port, path, query (parsed) and fragment.", { url: z.string() }, async ({ url }) => nn(S.url.parse(url), "Not a valid URL"));
server.tool("chmod_explain", "Read Unix permissions: takes octal (\"755\") or symbolic (\"rwxr-xr-x\") and returns both forms plus the breakdown (user/group/other, setuid/setgid/sticky).", { input: z.string().describe("\"755\" or \"rwxr-xr-x\"") }, async ({ input }) => { const t = input.trim(); const r = /^[0-7]{3,4}$/.test(t) ? S.chmod.fromOctal(t) : S.chmod.fromSymbolic(t); return nn(r, "Invalid permissions (use octal like \"755\" or symbolic like \"rwxr-xr-x\")"); });
server.tool("json_diff", "Structural differences between two JSON documents, by path: added / removed / changed / type changed.", { a: z.string().describe("JSON A"), b: z.string().describe("JSON B") }, async ({ a, b }) => nn(S.jsonDiff.diff(a, b), "One of the two is not valid JSON"));
server.tool("unit_convert", "Convert data sizes between SI multiples (kB/MB, base 1000) and IEC multiples (KiB/MiB, base 1024), and between bits and bytes. Settles the usual KB-vs-KiB confusion.", { input: z.string().describe("e.g. \"15 Mb\", \"1 GiB\", \"1500 kB\"") }, async ({ input }) => nn(S.unit.convert(input), "Could not parse that (try something like \"15 Mb\" or \"1 GiB\")"));
server.tool("hamming_encode", "Encode bits with a Hamming (SEC) code: inserts the parity bits. Input is a string of 0s and 1s.", { bits: z.string().describe("e.g. \"1011\"") }, async ({ bits }) => nn(S.hamming.encode(bits), "Input is not binary"));
server.tool("hamming_check", "Detect and correct a single-bit error in a received Hamming word: whether there is an error, which bit, and the corrected data.", { word: z.string().describe("The received Hamming word") }, async ({ word }) => nn(S.hamming.detectAndCorrect(word), "Input is not binary"));
server.tool("ieee754_from_decimal", "IEEE-754 representation of a decimal number in 32-bit (single) or 64-bit (double): sign, exponent, mantissa, raw bits, hex, and the value actually stored.", { number: z.number(), precision: z.union([z.literal(32), z.literal(64)]).default(64) }, async ({ number, precision }) => ok(S.ieee.fromDecimal(number, precision)));
const WIDTHS = [8, 16, 32, 64] as const;
server.tool("number_bases", "Show an integer in binary, octal, decimal and hex, plus its bit view (signed/unsigned, popcount, leading/trailing zeros) at the chosen width. Accepts decimal, 0x\u2026, 0b\u2026, 0o\u2026", { input: z.string().describe("e.g. \"255\", \"0xff\", \"0b1010\""), width: z.union([z.literal(8), z.literal(16), z.literal(32), z.literal(64)]).default(32) }, async ({ input, width }) => { const v = S.binary.parse(input); return v == null ? err("Not a valid number") : ok({ input, ...S.binary.view(v, width as BitWidth) }); });
const MS_CALC = 5000;
function calcConTiempo<T>(fn: () => T): T | null {
    const r = conPresupuesto(fn, MS_CALC);
    return "agotado" in r ? null : r.valor;
}
const cortado = (que: string) => err(`${que} took longer than ${MS_CALC} ms and was cut short`);
server.tool("calc_eval", "Evaluate a mathematical expression WITH UNITS and dimensional checking: \"100 km/h to m/s\", \"5 km + 300 m\", \"70 kg to lbs\", \"det([[1,2],[3,4]])\". Adding incompatible units is an error, not a silent number. Also flags results that are not finite (NaN, infinity).", { expression: z.string().describe("e.g. \"100 km/h to m/s\" or \"sqrt(2)^2 + 2^10\"") }, async ({ expression }) => {
    const mathjs = await getMath();
    const v = calcConTiempo(() => evaluarSeguro(mathjs as never, expression));
    if (v === null)
        return cortado("Evaluating");
    if (!v.ok) {
        if (v.fallo === "funcion-unidad") {
            return err(`"${v.simbolo}" is a FUNCTION here, not a unit: next to a number it means "times that function"`
                + (v.alternativa ? `. For the unit, write "${v.alternativa}"` : ""));
        }
        return err(v.fallo === "cota"
            ? "That expression would allocate too much memory to compute"
            : (v.mensaje ?? "Could not evaluate"));
    }
    const ambiguous = simbolosUnidad(mathjs as never, expression);
    return ok({
        expression,
        result: v.texto,
        ...(v.rareza ? { notFinite: v.rareza } : {}),
        ...(ambiguous.length ? { readAsUnits: ambiguous, note: "These names are units in this expression, not variables" } : {}),
        ...(freeVars(mathjs as never, expression).length ? { unknowns: freeVars(mathjs as never, expression) } : {}),
    });
});
server.tool("calc_solve", "Solve an equation in one unknown (\"x^2 - 5x + 6 = 0\", \"sin(x) = 0.5\") or a linear system (one equation per line). Says whether the answer is EXACT or an approximation, and over which interval it searched. Never invents a root it did not find.", {
    equations: z.string().describe("One equation, or several separated by newlines for a system"),
    unknown: z.string().optional().describe("Which variable to solve for (guessed if omitted)"),
    from: z.number().default(-100).describe("Lower bound for the numeric search"),
    to: z.number().default(100).describe("Upper bound for the numeric search"),
}, async ({ equations, unknown, from, to }) => {
    const lineas = equations.split("\n").filter((l) => l.trim() && !l.trim().startsWith("#"));
    if (!lineas.length)
        return err("No equation given");
    const mathjs = await getMath();
    if (lineas.length > 1) {
        const s = calcConTiempo(() => resolverSistema(mathjs as never, lineas));
        if (s === null)
            return cortado("Solving the system");
        if (!s.ok) {
            return err(s.error === "no-lineal"
                ? "Some equation is not linear: this only solves linear systems"
                : s.error === "sin-solucion-unica"
                    ? "The system has no unique solution (either none, or infinitely many)"
                    : "Could not solve the system");
        }
        return ok({
            method: "linear system by elimination",
            exact: true,
            solution: Object.fromEntries(s.variables!.map((v, i) => [v, s.valores![i]])),
        });
    }
    const s = calcConTiempo(() => resolverEcuacion(mathjs as never, lineas[0], unknown, [from, to]));
    if (s === null)
        return cortado("Solving");
    if (!s.ok) {
        return err(s.error === "sin-incognita" ? "There is no unknown to solve for"
            : s.error === "sin-solucion" ? `No solution found in [${from}, ${to}] — try a wider interval`
                : s.error === "cota" ? "That expression would allocate too much memory"
                    : "Could not solve it");
    }
    return ok({
        unknown: s.variable,
        roots: s.raices,
        method: s.metodo,
        exact: !s.aproximada,
        ...(s.sinSolucionReal ? { noRealSolution: true, note: "Proven: no real number satisfies this equation. Widening the interval will not help." } : {}),
        ...(s.aproximada ? { searchedIn: [from, to], note: "Approximate: only roots inside this interval, and only sign changes" } : {}),
        ...(s.grado ? { polynomialDegree: s.grado } : {}),
        ...(s.complejasDescartadas ? { complexRootsNotShown: s.complejasDescartadas } : {}),
    });
});
server.tool("calc_sheet", "Evaluate a multi-line calculation sheet and return the result of EVERY line. Variables carry downwards, units travel with the value, \"#\" starts a comment, \"ans\" is the previous result, and an error stays on its own line instead of killing the sheet. Declare currencies with \"# @moneda USD = 1.08 EUR\". Good for checking a quote or a budget line by line.", {
    sheet: z.string().describe("One expression per line, e.g. \"width = 3.5 m\nheight = 2.4 m\narea = width * height\""),
    as_markdown: z.boolean().default(false).describe("Also return the sheet as a Markdown table"),
}, async ({ sheet, as_markdown }) => {
    const mathjs = await getMath();
    const r = calcConTiempo(() => {
        const monedas = monedasDeHoja(sheet);
        let m: unknown = mathjs;
        let currenciesRejected: {
            codigo: string;
            motivo: string;
        }[] = [];
        if (monedas.length) {
            m = mathjs.create(mathjs.all);
            currenciesRejected = registraMonedas(m as never, monedas);
        }
        const lineas = evaluarHoja(m as never, sheet);
        return { lineas, currenciesRejected, markdown: as_markdown ? hojaAMarkdown(sheet, lineas) : null };
    });
    if (r === null)
        return cortado("Evaluating the sheet");
    const { lineas, currenciesRejected, markdown } = r;
    const texto = sheet.split("\n");
    return ok({
        lines: lineas.map((l, i) => ({
            n: i + 1,
            source: texto[i] ?? "",
            kind: l.tipo,
            ...(l.texto ? { result: l.texto } : {}),
            ...(l.nombre ? { assigns: l.nombre } : {}),
            ...(l.tipo === "error" ? { error: l.fallo === "cota" ? "too large to compute" : (l.mensaje ?? "cannot compute") } : {}),
            ...(l.rareza ? { notFinite: l.rareza } : {}),
            ...(l.aviso ? { warning: `"${l.simbolo}" is a unit; assigning it means you can no longer write that unit below` } : {}),
        })),
        summary: resumirHoja(lineas),
        ...(currenciesRejected.length
            ? { currenciesRejected: currenciesRejected.map(f => ({ currency: f.codigo, reason: MOTIVO_EN[f.motivo] ?? f.motivo })) }
            : {}),
        ...(markdown ? { markdown } : {}),
    });
});
server.tool("calc_derive", "Differentiate an expression symbolically, exactly: \"x^3 + 2x\", \"sin(x)*cos(x)\", \"x^x\". Keeps units, so d/dx (3 m * x) is \"3 m\" and not 3. Can take higher-order derivatives and evaluate the result at a point. Says which name it read as a unit, and refuses to answer \"0\" when the variable is not in the expression.", {
    expression: z.string().describe("e.g. \"x^3 + 2x\" or \"9.8 m/s^2 * t^2 / 2\""),
    variable: z.string().optional().describe("Differentiate with respect to this (guessed if omitted)"),
    order: z.number().int().default(1).describe(`1 = first derivative, 2 = second… up to ${MAX_ORDEN}`),
    at: z.number().optional().describe("Also evaluate the derivative at this value of the variable"),
}, async ({ expression, variable, order, at }) => {
    const mathjs = await getMath();
    const d = calcConTiempo(() => derivar(mathjs as never, expression, variable, order, at));
    if (d === null)
        return cortado("Differentiating");
    if (!d.ok) {
        return err(d.error === "orden" ? `order must be a whole number between 1 and ${MAX_ORDEN}`
            : d.error === "sin-variable" ? `"${d.variable}" does not appear in that expression — the derivative would be 0, which is probably not what you meant`
                : `Cannot differentiate that with respect to "${d.variable}"`);
    }
    return ok({
        expression,
        variable: d.variable,
        order: d.orden,
        derivative: d.simplificada ?? d.expr,
        ...(d.simplificada ? { beforeSimplifying: d.expr } : {}),
        ...(at !== undefined ? (d.error === "no-evaluable"
            ? { valueAt: null, note: `the derivative could not be evaluated at ${at}` }
            : { at, valueAt: d.valorEn }) : {}),
        ...(d.unidades?.length ? { readAsUnits: d.unidades, note: "These names are units here, not variables" } : {}),
    });
});
const REGLA_EN: Record<string, string> = {
    partida: "starting point",
    resultado: "result",
    simplificar: "simplify",
    "mover-termino": "move the term to the other side",
    dividir: "divide both sides",
    "forma-general": "write it in standard form",
    discriminante: "compute the discriminant",
    "formula-general": "apply the quadratic formula",
    "raiz-doble": "double root",
    "disc-negativo": "negative discriminant: no real solution",
    "matriz-aumentada": "augmented matrix",
    normalizar: "normalise the pivot row",
    eliminar: "eliminate the column below the pivot",
    intercambiar: "swap rows",
    suma: "sum rule",
    producto: "product rule",
    cociente: "quotient rule",
    cadena: "chain rule",
    potencia: "power rule",
    constante: "derivative of a constant",
    "constante-por": "constant multiple rule",
    identidad: "derivative of the variable itself",
    "derivada-directa": "known derivative",
    "raiz-probada": "this value makes the polynomial zero, so it is a root",
    ruffini: "divide by that factor (synthetic division); the remainder is zero",
    factorizado: "now factored",
    "producto-cero": "a product is zero when one of its factors is zero",
    "todas-las-raices": "all the roots together",
    sustitucion: "substitute to get a quadratic",
    "deshacer-sustitucion": "undo the substitution",
    "y-negativa": "a negative value gives no real solutions",
};
server.tool("calc_steps", "Show the WORKED STEPS of a calculation, verified step by step: a linear or quadratic equation, a derivative (naming which rule applies), or Gaussian elimination on a linear system row by row. Each step comes with the name of the rule used. When it cannot explain a case it says so (covered: false) instead of inventing a plausible-looking derivation \u2014 useful when you have to show your work to a person.", {
    input: z.string().describe("An equation (\"2x + 6 = 0\"), an expression to differentiate (\"sin(x)*x^2\"), or one equation per line for a system"),
    kind: z.enum(["equation", "derivative", "system"]).default("equation").describe("What to explain"),
    variable: z.string().optional().describe("The unknown or the variable to differentiate by (guessed if omitted)"),
}, async ({ input, kind, variable }) => {
    const mathjs = await getMath();
    const lineas = input.split("\n").filter((l) => l.trim() && !l.trim().startsWith("#"));
    if (!lineas.length)
        return err("Nothing to explain");
    const r = calcConTiempo(() => {
        if (kind === "derivative")
            return { exp: explicarDerivada(mathjs as never, input, variable), extra: {} };
        if (kind === "system") {
            const s = resolverSistema(mathjs as never, lineas);
            if (!s.aumentada || !s.variables)
                return null;
            return {
                exp: explicarGauss(s.aumentada, s.variables),
                extra: s.ok
                    ? { solution: Object.fromEntries(s.variables.map((v, i) => [v, s.valores![i]])) }
                    : { note: "The system has no unique solution; the elimination is shown anyway because that is where it becomes visible" },
            };
        }
        const sol = resolverEcuacion(mathjs as never, lineas[0], variable);
        return { exp: explicarEcuacion(mathjs as never, lineas[0], sol), extra: sol.ok ? { roots: sol.raices } : {} };
    });
    if (r === null)
        return err(kind === "system"
            ? "That does not look like a linear system, so there is no elimination to show"
            : `Explaining took longer than ${MS_CALC} ms and was cut short`);
    const { exp, extra } = r;
    return ok({
        kind,
        covered: exp.cubierto,
        ...(exp.caso ? { case: exp.caso } : {}),
        steps: exp.pasos.map((p) => ({
            latex: p.tex,
            rule: REGLA_EN[p.regla] ?? p.regla,
            ...(p.detalle ? { detail: p.detalle } : {}),
        })),
        ...extra,
        canExplain: COBERTURA.cubre,
        cannotExplain: COBERTURA.noCubre,
        ...(exp.cubierto ? {} : { note: "No step-by-step explanation for this case. The result above (if any) is still exact; what is missing is the reasoning, and it is not going to be made up." }),
    });
});
const MOTIVO_EN: Record<string, string> = {
    "repetida-distinta": "declared twice with different values; the first one wins",
    "nombre-ocupado": "that name is already a unit of measurement, pick another",
    "base-desconocida": "its base currency was never declared",
};
const ARITH = new Set(["add", "sub", "mul", "div", "mod", "pow"]);
server.tool("binary_calc", "Programmer's calculator on exact integers (BigInt): arithmetic (add/sub/mul/div/mod/pow) and bitwise (and/or/xor/nand/nor/xnor/shl/shr/sar/rol/ror). Returns the result in every base.", {
    a: z.string(),
    b: z.string(),
    op: z.enum(["add", "sub", "mul", "div", "mod", "pow", "and", "or", "xor", "nand", "nor", "xnor", "shl", "shr", "sar", "rol", "ror"]),
    width: z.union([z.literal(8), z.literal(16), z.literal(32), z.literal(64)]).default(32),
}, async ({ a, b, op, width }) => {
    const A = S.binary.parse(a), B = S.binary.parse(b);
    if (A == null || B == null)
        return err("Invalid operands (use decimal, 0x\u2026, 0b\u2026)");
    const res = ARITH.has(op) ? S.binary.arith(op as ArithOp, A, B) : S.binary.bitwise(op as BitOp, A, B, width as BitWidth);
    return res == null ? err("Invalid operation (division by zero?)") : ok({ a, op, b, width, result: S.binary.view(res, width as BitWidth) });
});
server.tool("semver_parse", "Parse a SemVer version (major.minor.patch + pre-release + build metadata).", { version: z.string().describe("e.g. \"1.4.2-beta.1+build.9\"") }, async ({ version }) => nn(S.semver.parseVersion(version), "Not a valid SemVer version"));
server.tool("semver_satisfies", "Given a list of versions, which ones satisfy a SemVer range (^, ~, >=, <, x, \u2026).", { range: z.string().describe("e.g. \"^1.2.0\""), versions: z.array(z.string()) }, async ({ range, versions }) => ok({ range, matching: S.semver.satisfies(range, versions) }));
server.tool("wcag_contrast", "WCAG contrast ratio between two colors, and whether it passes AA/AAA for normal and large text. Accepts #rgb/#rrggbb, rgb(), hsl() or CSS names.", { foreground: z.string().describe("e.g. \"#333\" or \"black\""), background: z.string().describe("e.g. \"#fff\" or \"white\"") }, async ({ foreground, background }) => {
    const fg = S.color.parse(foreground)?.hex, bg = S.color.parse(background)?.hex;
    if (!fg || !bg)
        return err("Color not recognized (use #rrggbb, rgb(), hsl() or a CSS name)");
    return ok({ foreground: fg, background: bg, ratio: +S.wcag.contrastRatio(fg, bg).toFixed(2), levels: S.wcag.evaluate(fg, bg) });
});
const FORMATS: [
    FormatType,
    ...FormatType[]
] = ["json", "yaml", "properties", "env", "csv", "markdown"];
server.tool("format_convert", "Convert data between formats: json, yaml, properties, env, csv, markdown.", { input: z.string(), from: z.enum(FORMATS), to: z.enum(FORMATS) }, async ({ input, from, to }) => nn(S.format.convert(input, from, to), `Could not convert from ${from} to ${to} (malformed input?)`));
server.tool("unicode_info", "Unicode details for every character in a string: code point (U+\u2026), name/category, UTF-8/16 bytes, HTML entity, escapes.", { input: z.string() }, async ({ input }) => nn(S.unicode.lookup(input), "No characters"));
server.tool("diagram_validate", "Validate a JTD (Jarroba Tools Diagram) document: structure, allowed shapes and chart types, and edge references. Returns {ok, errors, warnings, summary}. Spec: public/jtd.md. Use it to check your JSON before handing it to anyone.", { jtd: z.string().describe("The JTD document as JSON (an object with a \"jtd\" key).") }, async ({ jtd }) => ok(validateJtd(jtd)));
server.tool("diagram_svg", "Render a JTD to SVG with no browser and no dev server, so you get the actual drawing back and can check it. Validates first. This is the one to use to SEE what you built.", { jtd: z.string().describe("The JTD document as JSON.") }, async ({ jtd }) => {
    const v = validateJtd(jtd);
    if (!v.ok)
        return err("Invalid JTD:\n- " + v.errors.join("\n- "));
    const { svg, error } = renderJtdSvg(jtd);
    return svg ? ok({ svg, warnings: v.warnings }) : err(error ?? "Could not render to SVG.");
});
server.tool("diagram_render", "Render a JTD to PNG with the app's REAL engine (full fidelity; only needed to check skins and effects). Requires a checkout of the repo AND a running dev server. For everything else use diagram_svg, which needs neither.", { jtd: z.string(), baseUrl: z.string().optional().describe("Dev server URL (default http://localhost:4201)"), out: z.string().optional().describe("Output path: .png (default, full fidelity) or .svg for a vector image (no skins, images or icon glyphs). Default: a temp PNG") }, async ({ jtd, baseUrl, out }) => {
    const v = validateJtd(jtd);
    if (!v.ok)
        return err("Invalid JTD:\n- " + v.errors.join("\n- "));
    const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
    const guion = join(repoRoot, "scripts/render-jtd.mjs");
    if (!existsSync(guion)) {
        return err("diagram_render only works from a checkout of the repository: it needs `scripts/render-jtd.mjs`, " +
            `which is not at ${guion}.\nIf you installed this package from npm, use **diagram_svg** instead: it ` +
            "renders the same JTD in plain Node \u2014 no repo, no dev server, no browser. The only difference is that " +
            "diagram_render uses the web engine (Konva), which you only need to review skins and effects.");
    }
    const tmp = join(tmpdir(), `jtd-${Date.now()}.json`), outPath = out || join(tmpdir(), "jtd-render.png");
    writeFileSync(tmp, jtd);
    const r = spawnSync("node", [guion, tmp, outPath, baseUrl || "http://localhost:4201"], { cwd: repoRoot, encoding: "utf8", timeout: 90000 });
    if (r.status !== 0)
        return err(`Rendering failed. The dev server may not be running at that URL.\n${(r.stdout || "") + (r.stderr || "")}`);
    return ok({ image: outPath, stdout: (r.stdout || "").trim(), warnings: v.warnings });
});
type JtdScene = {
    layout?: string;
    title?: string;
    theme?: string;
    background?: string;
    nodes: unknown[];
    edges: unknown[];
    charts: unknown[];
};
let scene: JtdScene = { nodes: [], edges: [], charts: [] };
const sceneCounts = () => ({ nodes: scene.nodes.length, edges: scene.edges.length, charts: scene.charts.length });
const sceneJson = () => JSON.stringify({
    jtd: 1,
    ...(scene.layout ? { layout: scene.layout } : {}),
    ...(scene.title ? { title: scene.title } : {}),
    ...(scene.theme ? { theme: scene.theme } : {}),
    ...(scene.background ? { background: scene.background } : {}),
    nodes: scene.nodes,
    edges: scene.edges,
    charts: scene.charts,
});
server.tool("diagram_new", "Start an EMPTY JTD diagram in memory, discarding any previous one. Lets you build it piece by piece with diagram_add and look at it with diagram_preview, instead of writing the whole JSON in one shot.", { layout: z.string().optional().describe("flow-down|flow-right|free|grid|radial"), title: z.string().optional(), theme: z.string().optional(), background: z.string().optional() }, async ({ layout, title, theme, background }) => { scene = { layout, title, theme, background, nodes: [], edges: [], charts: [] }; return ok({ started: true, ...sceneCounts() }); });
server.tool("diagram_add", "Append the \"nodes\"/\"edges\"/\"charts\" of a JTD FRAGMENT (same format) to the diagram held in memory, on top of whatever is already there. Returns the new counts plus the warnings and errors of validating the result.", { jtd: z.string().describe("JTD fragment: {\"nodes\":[...],\"edges\":[...],\"charts\":[...]} \u2014 only what you want to add.") }, async ({ jtd }) => {
    let frag: {
        nodes?: unknown;
        edges?: unknown;
        charts?: unknown;
    };
    try {
        frag = JSON.parse(jtd);
    }
    catch {
        return err("The fragment is not valid JSON.");
    }
    if (Array.isArray(frag?.nodes))
        scene.nodes.push(...frag.nodes);
    if (Array.isArray(frag?.edges))
        scene.edges.push(...frag.edges);
    if (Array.isArray(frag?.charts))
        scene.charts.push(...frag.charts);
    const v = validateJtd(sceneJson());
    return ok({ ...sceneCounts(), warnings: v.warnings, errors: v.errors });
});
server.tool("diagram_get", "Return the COMPLETE JTD document built so far in memory, ready to save or paste into the web tool.", {}, async () => ok({ jtd: sceneJson(), ...sceneCounts() }));
server.tool("diagram_preview", "Validate and DRAW (SVG) the diagram held in memory, so you can look at it and keep adding or fixing in a loop. This is the generate \u2192 look \u2192 correct cycle; a model cannot judge a diagram by reading its JSON.", {}, async () => {
    const j = sceneJson();
    const v = validateJtd(j);
    if (!v.ok)
        return err("Invalid JTD:\n- " + v.errors.join("\n- "));
    const { svg, error } = renderJtdSvg(j);
    return svg ? ok({ svg, ...sceneCounts(), warnings: v.warnings }) : err(error ?? "Could not render.");
});
const RDF_MIME: Record<string, string> = {
    turtle: "text/turtle",
    ttl: "text/turtle",
    ntriples: "application/n-triples",
    nt: "application/n-triples",
    nquads: "application/n-quads",
    nq: "application/n-quads",
    trig: "application/trig",
    jsonld: "application/ld+json",
    rdfxml: "application/rdf+xml",
};
const RDF_FORMAT = z.enum(["turtle", "ntriples", "nquads", "trig", "jsonld", "rdfxml"]).default("turtle");
function rowOf(m: Map<string, any>): Row {
    const o: Row = {};
    for (const [k, v] of m)
        o[k] = { value: v.value, termType: v.termType };
    return o;
}
server.tool("kg_query", "Run SPARQL 1.1 (SELECT/ASK/CONSTRUCT/DESCRIBE) over in-memory RDF \u2014 a real engine, not pattern matching. Accepts Turtle, N-Triples, N-Quads, TriG, JSON-LD or RDF/XML. Returns rows (SELECT), a boolean (ASK) or Turtle (CONSTRUCT/DESCRIBE).", { data: z.string().describe("The RDF graph as text"), format: RDF_FORMAT, query: z.string().describe("SPARQL query") }, async ({ data, format, query }) => {
    try {
        const store = await rdfStore();
        store.load(data, { format: RDF_MIME[format] });
        const res: any = store.query(query);
        if (typeof res === "boolean")
            return ok({ type: "ask", value: res });
        if (Array.isArray(res) && res.length > 0 && res[0] instanceof Map) {
            const rows = (res as Map<string, any>[]).map((m) => {
                const r: Record<string, string> = {};
                for (const [k, v] of m)
                    r[k] = v.value;
                return r;
            });
            const vars = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
            return ok({ type: "select", vars, count: rows.length, rows });
        }
        if (Array.isArray(res)) {
            const tmp = await rdfStore();
            for (const q of res as any[])
                tmp.add(q);
            return ok({ type: "construct", count: (res as any[]).length, turtle: tmp.dump({ format: "text/turtle" }) });
        }
        return ok({ type: "select", vars: [], count: 0, rows: [] });
    }
    catch (e: any) {
        return err(String(e?.message ?? e));
    }
});
server.tool("kg_validate", "Validate RDF data against its SHACL shapes (core subset): sh:targetClass + sh:path with minCount, maxCount, datatype, class and nodeKind. Returns whether it conforms plus every violation (node, property, constraint, message).", { data: z.string().describe("The RDF graph (data + sh: shapes) as text"), format: RDF_FORMAT }, async ({ data, format }) => {
    try {
        const store = await rdfStore();
        store.load(data, { format: RDF_MIME[format] });
        const exec = async (sparql: string): Promise<Row[]> => {
            const res: any = store.query(sparql);
            return Array.isArray(res) ? (res as Map<string, any>[]).map(rowOf) : [];
        };
        const violations = await validateShacl(exec);
        return ok({ conforms: violations.length === 0, count: violations.length, violations });
    }
    catch (e: any) {
        return err(String(e?.message ?? e));
    }
});
const SEMANTIC_SCHEMA = z.object({
    glossary: z.array(z.object({
        term: z.string(),
        target: z.string(),
        synonyms: z.array(z.string()).optional(),
        note: z.string().optional(),
    })).default([]),
    metrics: z.array(z.object({
        name: z.string(),
        label: z.string().optional(),
        sparql: z.string(),
        note: z.string().optional(),
    })).default([]),
}).describe("Semantic layer: { glossary: [{term,target,synonyms?}], metrics: [{name,label?,sparql}] }");
server.tool("kg_semantic_validate", "Validate a SEMANTIC LAYER document (term\u2192predicate glossary + named SPARQL metrics) before trusting it: structure, required fields (term/target, name/sparql), metric names usable as identifiers, and uniqueness. Returns {ok, errors, warnings}. This is \"semantics as code\": define once, compute the same everywhere.", { semantic: SEMANTIC_SCHEMA }, async ({ semantic }) => {
    const v = validateSemantic(semantic as SemanticLayer);
    return ok(v);
});
server.tool("kg_metric", "Run a NAMED metric from the semantic layer against RDF data: fills its {{param}} placeholders from `args` and executes the resulting SPARQL. Use it so \"revenue\" or \"active users\" is computed from the AGREED definition instead of a query you invented \u2014 the fix for \"one number, three answers\". Returns the effective SPARQL and the result, or which parameters are missing.", {
    data: z.string().describe("The RDF graph as text"),
    format: RDF_FORMAT,
    semantic: SEMANTIC_SCHEMA,
    metric: z.string().describe("Name of the metric to run"),
    args: z.record(z.string()).default({}).describe("Values for the metric's {{...}} parameters"),
}, async ({ data, format, semantic, metric, args }) => {
    try {
        const layer = semantic as SemanticLayer;
        const v = validateSemantic(layer);
        if (!v.ok)
            return err("Invalid semantic layer: " + v.errors.join("; "));
        const m = findMetric(layer, metric);
        if (!m)
            return err(`No metric named "${metric}". Available: ${layer.metrics.map((x) => x.name).join(", ") || "(none)"}.`);
        const { sparql, missing } = instantiateMetric(m, args);
        if (missing.length)
            return err(`Missing parameters: ${missing.join(", ")}.`);
        const store = await rdfStore();
        store.load(data, { format: RDF_MIME[format] });
        const res: any = store.query(sparql);
        if (typeof res === "boolean")
            return ok({ metric, sparql, type: "ask", value: res });
        if (Array.isArray(res) && res.length > 0 && res[0] instanceof Map) {
            const rows = (res as Map<string, any>[]).map((mp) => {
                const r: Record<string, string> = {};
                for (const [k, val] of mp)
                    r[k] = val.value;
                return r;
            });
            const vars = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
            return ok({ metric, sparql, type: "select", vars, count: rows.length, rows });
        }
        if (Array.isArray(res)) {
            const tmp = await rdfStore();
            for (const q of res as any[])
                tmp.add(q);
            return ok({ metric, sparql, type: "construct", count: (res as any[]).length, turtle: tmp.dump({ format: "text/turtle" }) });
        }
        return ok({ metric, sparql, type: "select", vars: [], count: 0, rows: [] });
    }
    catch (e: any) {
        return err(String(e?.message ?? e));
    }
});
server.registerTool("db_translate_sql", {
    title: "Translate SQL from another engine to PostgreSQL",
    description: "Detect whether a SQL script comes from MySQL/MariaDB, SQLite, SQL Server or Oracle and translate it to PostgreSQL, explaining every change with its line number. Changes that are NOT exact equivalents are flagged as such.",
    inputSchema: {
        sql: z.string().describe("The source SQL script"),
        dialect: z.enum(["auto", "mysql", "sqlite", "mssql", "oracle"]).default("auto")
            .describe("Source engine; \"auto\" detects it from markers in the SQL itself"),
    },
}, ({ sql, dialect }) => {
    const det = S.sqlImport.detect(sql);
    const r = S.sqlImport.toPostgres(sql, dialect === "auto" ? undefined : dialect);
    return ok({
        detectedDialect: det.dialect,
        markers: det.markers,
        dialectUsed: r.dialect,
        changes: r.changes.map((c) => ({
            line: c.line,
            rule: c.ruleId,
            from: c.from,
            to: c.to,
            notAnExactEquivalent: S.sqlImport.isLossy(c.ruleId) || undefined,
        })),
        sql: r.sql,
    });
});
server.registerTool("db_schema_review", {
    title: "Review a database schema",
    description: "Run a DDL in an ephemeral PostgreSQL and return the REAL schema (tables, columns, keys, indexes, constraints) plus the design problems found: tables with no primary key, foreign keys with no index, money in floating point, timestamps without a time zone, types that do not match on the two sides of a relation, and redundant indexes. The schema is executed, not guessed with regular expressions.",
    inputSchema: { ddl: z.string().describe("CREATE TABLE\u2026 (PostgreSQL; for another engine, run db_translate_sql first)") },
}, async ({ ddl }) => {
    const { schema, error } = await esquemaDesdeDdl(ddl);
    if (error)
        return err(`The DDL could not be executed in PostgreSQL: ${error}`);
    const warnings = S.designCheck.check(schema).map((i) => ({
        level: i.level,
        table: i.table.replace(/^public\./, ""),
        rule: i.code,
        warning: i.text,
        fix: i.ddl,
    }));
    return ok({ schema: resumen(schema), warnings, totalWarnings: warnings.length });
});
server.registerTool("db_docs", {
    title: "Document a schema",
    description: "Turn a DDL into Markdown documentation, DBML (dbdiagram.io) or a Mermaid erDiagram, with relations and their 1:1 / 1:N cardinality derived from the keys.",
    inputSchema: {
        ddl: z.string().describe("CREATE TABLE\u2026 (PostgreSQL)"),
        format: z.enum(["markdown", "dbml", "mermaid"]).default("markdown"),
    },
}, async ({ ddl, format }) => {
    const { schema, error } = await esquemaDesdeDdl(ddl);
    if (error)
        return err(`The DDL could not be executed in PostgreSQL: ${error}`);
    const output = format === "dbml" ? S.schemaDoc.dbml(schema)
        : format === "mermaid" ? S.schemaDoc.mermaid(schema)
            : S.schemaDoc.markdown(schema);
    return ok({ format, output });
});
server.registerTool("db_entities", {
    title: "Generate code entities from a schema",
    description: "Turn a DDL into classes in your language: Java/JPA, TypeScript, Python (SQLAlchemy 2.0), C#/EF Core or Go. Types are respected \u2014 `numeric` becomes BigDecimal/decimal, never a double \u2014 and so is which fields are optional.",
    inputSchema: {
        ddl: z.string().describe("CREATE TABLE\u2026 (PostgreSQL)"),
        target: z.enum(["java", "typescript", "python", "csharp", "go"]).describe("Target language"),
        namespace: z.string().optional().describe("Package (Java) or namespace (C#)"),
    },
}, async ({ ddl, target, namespace }) => {
    const { schema, error } = await esquemaDesdeDdl(ddl);
    if (error)
        return err(`The DDL could not be executed in PostgreSQL: ${error}`);
    const files = S.codeGen.generate(schema, target as CodeTarget, namespace ? { namespace } : {});
    if (!files.length)
        return err("The DDL defines no tables to generate entities from.");
    return ok({ target, files });
});
server.registerTool("db_join_path", {
    title: "How two tables join",
    description: "Find the foreign-key paths between two tables and return the SELECT with the JOINs already written. If the script carries data, every path is EXECUTED and they are ranked by the rows they actually return \u2014 a short path that yields zero rows joins nothing. Hub tables (related to almost everything) can be set aside, since they connect any pair without explaining anything.",
    inputSchema: {
        sql: z.string().describe("CREATE TABLE\u2026 (PostgreSQL) plus its INSERTs, if you want ranking by real rows"),
        from: z.string().describe("Source table (\"orders\" or \"sales.orders\")"),
        to: z.string().describe("Target table"),
        avoidHubs: z.boolean().default(true)
            .describe("Set aside tables that are related to almost every other one"),
        maxHops: z.number().int().min(1).max(6).default(4).describe("Maximum hops per path"),
    },
}, async ({ sql, from: desde, to: hasta, avoidHubs, maxHops }) => {
    const r = await conPostgres(sql, async ({ schema, run }) => {
        const from = idDeTabla(schema, desde), to = idDeTabla(schema, hasta);
        if (!from || !to) {
            return { error: `Not in the schema: ${!from ? desde : hasta}. Available: ${schema.tables.map((t) => t.id).join(", ")}` };
        }
        const concentradores = new JoinPathService().hubs(schema);
        const ignore = new Set(avoidHubs ? concentradores.filter((h) => h !== from && h !== to) : []);
        const caminos = findPaths(schema, from, to, { maxLength: maxHops, ignore });
        const salida = [];
        for (const c of caminos) {
            const cuenta = await run.query(joinCountSql(c));
            const filas = cuenta.error ? null : Number((cuenta.rows as {
                n: number;
            }[])[0]?.n ?? 0);
            salida.push({ path: pathLabel(c), hops: c.steps.length, rows: filas, sql: joinSql(schema, c) });
        }
        salida.sort((a, b) => (b.rows ?? -1) - (a.rows ?? -1) || a.hops - b.hops);
        return { from, to, hubsSetAside: [...ignore], paths: salida };
    });
    if (r.error)
        return err(`The SQL could not be executed in PostgreSQL: ${r.error}`);
    if ((r.valor as any)?.error)
        return err((r.valor as any).error);
    return ok(r.valor);
});
server.registerTool("db_fk_infer", {
    title: "Relations that exist in the data but are not declared",
    description: "Propose the missing foreign keys: find by name and type the columns that look like they point at another table, then CHECK each one against the rows, counting how many of its values actually exist on the other side. The percentage is counted rows, not a hunch. At 100% the relation holds and the returned ALTER TABLE cannot fail; with orphan rows PostgreSQL would reject it, so how many and which ones are reported.",
    inputSchema: {
        sql: z.string().describe("CREATE TABLE\u2026 plus its INSERTs (PostgreSQL). With no data there is nothing to check against"),
        includeWeak: z.boolean().default(false)
            .describe("Also return the ones that do NOT hold (under 80% coverage), so you can rule them out by looking"),
        orphanSample: z.number().int().min(0).max(50).default(5)
            .describe("How many unmatched rows to bring back as evidence for each proposal"),
    },
}, async ({ sql, includeWeak, orphanSample }) => {
    const r = await conPostgres(sql, async ({ schema, run }) => {
        const cands = fkCandidates(schema);
        const evidencias: FkEvidence[] = [];
        for (const c of cands) {
            const res = await run.query(evidenceSql(c));
            if (res.error) {
                evidencias.push({ ...c, total: 0, orphans: 0, coverage: 0, error: res.error });
                continue;
            }
            const row = (res.rows as {
                total: number;
                huerfanas: number;
            }[])[0];
            const total = Number(row?.total ?? 0), orphans = Number(row?.huerfanas ?? 0);
            evidencias.push({ ...c, total, orphans, coverage: cobertura(total, orphans) });
        }
        const utiles = ordenarPorEvidencia(evidencias.filter((e) => includeWeak || esRelevante(e)));
        const salida = [];
        for (const e of utiles) {
            const huerfanas = e.orphans > 0 && orphanSample > 0
                ? (await run.query(orphanSql(e))).rows.slice(0, orphanSample)
                : undefined;
            salida.push({
                relation: `${e.childTable}.${e.childColumn} → ${e.parentTable}.${e.parentColumn}`,
                whyProposed: e.reason,
                rowsWithValue: e.total,
                unmatched: e.orphans,
                coverage: e.coverage,
                holds: e.orphans === 0 && e.total > 0,
                error: e.error,
                unmatchedExamples: huerfanas,
                ddl: addFkSql(e),
            });
        }
        return {
            candidatesByName: cands.length,
            proposals: salida,
            note: cands.length && !salida.length
                ? "Some columns look like foreign keys by name, but none of them holds up against the data (or there are no rows to check against)."
                : undefined,
        };
    });
    if (r.error)
        return err(`The SQL could not be executed in PostgreSQL: ${r.error}`);
    return ok(r.valor);
});
const RLS_AVISOS: Record<string, (t: string, s?: string) => string> = {
    "rol-superusuario": (_t, s) => `"${s}" is a SUPERUSER: it bypasses RLS entirely. No policy applies to it, however much things look like they work.`,
    "politicas-muertas": (t) => `${t}: policies are written but RLS is OFF. They do absolutely nothing.`,
    "sin-politicas": (t) => `${t}: RLS is on and there is not a single policy. Nobody sees anything (except the owner and superusers).`,
    "dueno-se-la-salta": (t, s) => `${t}: the owner ("${s}") bypasses the policies — FORCE ROW LEVEL SECURITY is missing. Development usually connects as the owner, so the policy "works" right up until one day it does not.`,
    "sin-usage": (t, s) => `${t}: "${s}" has no USAGE on the schema. It never gets as far as looking at the table, and PostgreSQL's error does not mention the table.`,
    "sin-select": (t, s) => `${t}: "${s}" is missing the SELECT grant. The zero rows are not the policy's doing.`,
    "sin-rls-legible": (t, s) => `${t}: has NO row-level security and "${s}" can read all of it, while other tables in the schema do use RLS. Usually the new table nobody protected.`,
    "ve-todo": (t, s) => `${t}: policy "${s}" lets the role SEE every row (USING true): RLS filters nothing on read.`,
    "escribe-todo": (t, s) => `${t}: policy "${s}" lets the role WRITE any row (its check is true): rows can be created or changed on someone else's behalf.`,
};
server.registerTool("db_rls_check", {
    title: "Review and simulate row-level security (RLS)",
    description: "Run the script in an ephemeral PostgreSQL and review row-level security, warning about the SILENT failures: RLS on with no policies, policies with RLS off, the owner bypassing them because FORCE is missing, a superuser role, or the missing GRANT/USAGE that makes \"zero rows\" not the policy's fault at all. Given a role and a table it also SIMULATES: it looks at the table through that role's eyes, inside a transaction that is rolled back, and reports how many rows it can see, update and delete.",
    inputSchema: {
        sql: z.string().describe("The complete script: CREATE TABLE, INSERT, CREATE ROLE, GRANT, ENABLE ROW LEVEL SECURITY and CREATE POLICY"),
        role: z.string().optional().describe("Role whose eyes to look through (your application's role, not the owner)"),
        table: z.string().optional().describe("Table to simulate. Without it, every table with RLS enabled is simulated"),
    },
}, async ({ sql, role: rol, table: tabla }) => {
    const r = await conPostgres(sql, async ({ schema, run }) => {
        const tablas: RlsTable[] = await readRls(run);
        let usables = new Set<string>(), supers = new Set<string>();
        if (rol) {
            usables = await esquemasUsablesDe(run, rol);
            supers = await superusuariosDe(run);
        }
        const puedeUsar = (t: RlsTable) => !rol || usables.has(t.schema);
        const puedeLeer = async (t: RlsTable) => {
            const res = await run.query(`SELECT has_table_privilege('${rol!.replace(/'/g, "''")}', '${rlsTableId(t).replace(/'/g, "''")}', 'SELECT') AS ok`);
            return !res.error && !!(res.rows as {
                ok: boolean;
            }[])[0]?.ok;
        };
        const lectura = new Map<string, boolean>();
        if (rol)
            for (const t of tablas)
                lectura.set(rlsTableId(t), await puedeLeer(t));
        const avisos = rlsDiagnose(tablas, rol ?? null, rol ? supers.has(rol) : false, (t) => lectura.get(rlsTableId(t)) ?? true, puedeUsar)
            .map((i) => ({ kind: i.kind, table: i.table || undefined, warning: RLS_AVISOS[i.kind](i.table, i.subject) }));
        const estado = tablas.map((t) => ({
            table: rlsTableId(t),
            owner: t.owner,
            rlsEnabled: t.enabled,
            appliesToOwner: t.forced,
            policies: t.policies.map((p) => ({
                name: p.name,
                command: p.cmd,
                kind: p.permissive ? "PERMISSIVE" : "RESTRICTIVE",
                roles: p.roles,
                using: p.using,
                withCheck: p.withCheck,
            })),
        }));
        let simulaciones;
        if (rol) {
            const objetivo = tabla
                ? tablas.filter((t) => rlsTableId(t) === idDeTabla(schema, tabla) || t.table === tabla)
                : tablas.filter((t) => t.enabled);
            if (tabla && !objetivo.length)
                return { error: `Table "${tabla}" is not in the schema` };
            simulaciones = [];
            for (const t of objetivo) {
                const s = await simulateRls(run, rol, rlsTableId(t), "The table has too many rows to test writes without touching all of them; only reads were simulated.");
                simulaciones.push({
                    table: s.table,
                    rows: s.total,
                    canSee: s.visibles,
                    canUpdate: s.actualizables,
                    canDelete: s.borrables,
                    error: s.error,
                    note: s.nota,
                    sample: s.filas.map((f) => ({ visible: f.visible, row: f.datos })),
                });
            }
        }
        return { role: rol ?? null, warnings: avisos, state: estado, simulations: simulaciones };
    });
    if (r.error)
        return err(`The SQL could not be executed in PostgreSQL: ${r.error}`);
    if ((r.valor as any)?.error)
        return err((r.valor as any).error);
    return ok(r.valor);
});
server.registerTool("prompt_review", {
    title: "Review a system prompt",
    description: "Check a system prompt against the rules that make it followable: an explicit output contract, a definition of done, what to do when the model does not know (the rule that prevents made-up answers), contradictions, unverifiable requirements, prohibitions with no alternative, example count and context budget. It does NOT judge whether the prompt is GOOD \u2014 that needs evals and a real model run \u2014 it is the deterministic layer underneath. Useful on your own system prompt.",
    inputSchema: {
        prompt: z.string().describe("The complete system prompt, exactly as it would be sent"),
        outputFormat: z.string().optional().describe("The part describing the output format, if it is kept separate from the prompt"),
        examples: z.number().int().min(0).default(0).describe("How many input\u2192output (few-shot) examples accompany the prompt"),
    },
}, ({ prompt, outputFormat: formato, examples: ejemplos }) => {
    const secciones: SeccionPrompt[] = [{ id: "todo", enabled: true, content: prompt }];
    if (formato?.trim())
        secciones.push({ id: "format", enabled: true, content: formato });
    const hallazgos = S.promptLint.lint(secciones, ejemplos, prompt);
    const r = S.promptLint.resumen(hallazgos);
    return ok({
        summary: { errors: r.errores, warnings: r.avisos, suggestions: r.sugerencias, clean: r.limpio },
        findings: hallazgos,
    });
});
server.registerTool("rag_prepare", {
    title: "Chunk a text and rank the chunks against a query",
    description: "Split a text on real boundaries (paragraph, else sentence, never mid-word) with the overlap you ask for, and optionally rank the chunks against a query with BM25. Use it to prepare a RAG corpus, or to see why a query fails to retrieve what it should. No model involved: this is the lexical half, the one that finds literal terms \u2014 a code, a surname, a version number \u2014 that an embedding dissolves.",
    inputSchema: {
        text: z.string().describe("The text to split"),
        size: z.number().int().min(50).max(4000).default(400).describe("Target size of each chunk, in characters"),
        overlap: z.number().int().min(0).default(80).describe("Overlap between consecutive chunks; capped at half the size"),
        query: z.string().optional().describe("If given, chunks come back ranked by BM25 against it"),
    },
}, ({ text, size, overlap, query }) => {
    const trozos = S.rag.trocear(text, { tamano: size, solape: overlap });
    const enIngles = (t: {
        texto: string;
        desde: number;
        hasta: number;
    }) => ({ text: t.texto, from: t.desde, to: t.hasta });
    if (!query?.trim())
        return ok({ chunks: trozos.map(enIngles) });
    const puntos = S.rag.bm25(query, trozos.map((t) => t.texto));
    const ordenados = trozos
        .map((t, i) => ({ ...enIngles(t), bm25: puntos[i] }))
        .sort((a, b) => b.bm25 - a.bm25);
    return ok({ query, chunks: ordenados });
});
const LOG_MAX = 32 * 1024 * 1024;
async function leerLog(texto?: string, ruta?: string, desde: "principio" | "final" = "final"): Promise<{
    texto: string;
    recortado: boolean;
    bytes: number;
} | {
    error: string;
}> {
    if (texto != null && texto !== "")
        return { texto, recortado: false, bytes: texto.length };
    if (!ruta)
        return { error: "Either `text` or `path` is required." };
    try {
        const { readFile, stat } = await import("node:fs/promises");
        const { size } = await stat(ruta);
        const buf = await readFile(ruta);
        if (size <= LOG_MAX)
            return { texto: buf.toString("utf8"), recortado: false, bytes: size };
        const trozo = desde === "final" ? buf.subarray(size - LOG_MAX) : buf.subarray(0, LOG_MAX);
        let s = trozo.toString("utf8");
        s = desde === "final" ? s.slice(s.indexOf("\n") + 1) : s.slice(0, s.lastIndexOf("\n") + 1);
        return { texto: s, recortado: true, bytes: size };
    }
    catch (e: any) {
        return { error: noSeLee(ruta, e) };
    }
}
const LOG_IN = {
    text: z.string().optional().describe("The log as text. Alternative to `path`."),
    path: z.string().optional().describe("Path to the log file. Use this for big logs: they do not fit in a tool call."),
    from: z.enum(["start", "end"]).default("end").describe("Which end to read if the file is over 32 MB"),
    format: z.enum(["json", "logfmt", "syslog5424", "syslog3164", "clf", "combined", "plain"]).optional()
        .describe("Force the format instead of detecting it"),
};
const entradaLog = (a: {
    text?: string;
    path?: string;
    from?: "start" | "end";
    format?: string;
}) => ({ texto: a.text, ruta: a.path, desde: a.from === "start" ? "principio" as const : "final" as const, formato: a.format });
async function prepararLog(a: {
    text?: string;
    path?: string;
    from?: "start" | "end";
    format?: string;
}) {
    const e = entradaLog(a);
    const r = await leerLog(e.texto, e.ruta, e.desde);
    if ("error" in r)
        return r;
    const parsed = S.logParse.parse(r.texto, { format: e.formato as LogFormat | undefined });
    const mined = S.logPat.mine(parsed.events);
    return { ...r, parsed, mined };
}
server.tool("log_analyze", "Understand a log without reading it: detected format, number of EVENTS (a 40-line stack trace counts as one), breakdown by level, time range, the errors with their ROOT CAUSE resolved, and the most frequent patterns. Accepts a file PATH \u2014 that is how you look at a log that does not fit in your context, such as a CI log of hundreds of MB. Logs WRAPPED by whatever collected them (Docker json-file, CRI/Kubernetes `P`/`F` lines, `journalctl -o json`, OpenTelemetry OTLP JSON, AWS CloudTrail) are unwrapped first and the pieces the runtime split are joined back, so a stack trace spread over 40 records is one event; `wrapper` says which.", LOG_IN, async (a) => {
    const p = await prepararLog(a);
    if ("error" in p)
        return err(p.error);
    const { parsed, mined } = p;
    return ok({
        format: parsed.info.format,
        wrapper: parsed.info.envoltorio,
        rejoinedPieces: parsed.info.unidos || undefined,
        timestamps: parsed.info.tsPattern
            ?? (parsed.events.some(e => e.ts != null) ? "from a field (no anchor pattern)" : "no recognizable date"),
        timeOnly: parsed.info.tsDateless || undefined,
        lines: parsed.lines,
        truncated: p.recortado || undefined,
        fileBytes: a.path ? p.bytes : undefined,
        report: S.logRed.digest(parsed.events, mined.patterns),
    });
});
server.tool("log_reduce", "Cut a log down to a CHARACTER budget while keeping what matters: errors with their full stack trace, the window of what happened just before, and anything that appears only once or twice. Repeats are collapsed with their count ([xN]) and gaps are marked ([...N]). Use it to hand a big log to a model without spending the context on the same line repeated.", {
    ...LOG_IN,
    maxChars: z.number().int().min(200).max(400000).default(12000).describe("Character budget for the output"),
    context: z.number().int().min(0).max(50).default(3).describe("Events kept before each error"),
    fullTraces: z.boolean().default(true).describe("false collapses each stack trace to its one-line summary"),
}, async (a) => {
    const p = await prepararLog(a);
    if ("error" in p)
        return err(p.error);
    const r = S.logRed.reduce(p.parsed.events, p.mined.patterns, {
        maxChars: a.maxChars,
        contextBefore: a.context,
        contextAfter: Math.min(1, a.context),
        keepTraces: a.fullTraces,
    });
    return ok({
        events: r.total,
        kept: r.kept,
        chars: r.chars,
        originalChars: r.originalChars,
        saved: `${Math.round(100 * r.saved)}%`,
        log: r.text,
    });
});
server.tool("log_patterns", "Group log lines into TEMPLATES (Drain algorithm): \"connected to 10.0.0.1\" and \"connected to 10.0.0.7\" are the same message. Turns a million lines into a few hundred readable things, each with its count, worst level and time range. Also returns the RARE ones (seen once or twice), which in a production log are usually what you were looking for.", { ...LOG_IN, limit: z.number().int().min(1).max(500).default(40).describe("How many patterns to return") }, async (a) => {
    const p = await prepararLog(a);
    if ("error" in p)
        return err(p.error);
    const fila = (x: {
        count: number;
        template: string;
        level: string | null;
        sample: string;
    }) => ({ times: x.count, level: x.level ?? undefined, template: x.template, sample: x.sample });
    return ok({
        events: p.parsed.events.length,
        patterns: p.mined.patterns.length,
        compression: Math.round(p.mined.compression),
        top: p.mined.patterns.slice(0, a.limit).map(fila),
        rare: S.logPat.rare(p.mined.patterns).slice(0, a.limit).map(fila),
    });
});
server.tool("log_stacktrace", "Read an exception stack trace (Java/JVM, Python, Node, Go, .NET, Rust, Ruby or PHP) and answer the only question anyone asks it: WHERE TO LOOK. Follows the \"Caused by\" chain to the root cause, separates your code from the framework, and points at your first frame. Infers which package is yours from the trace itself if you do not say.", {
    trace: z.string().describe("The stack trace, pasted as-is"),
    myPrefixes: z.array(z.string()).optional().describe("Prefixes of your own code, e.g. [\"com.acme.\", \"src/\"]"),
}, async ({ trace, myPrefixes }) => {
    const t = S.logTrace.parse(trace, myPrefixes?.length ? { appPrefixes: myPrefixes } : {});
    if (!t)
        return err("This does not look like a Java/JVM, Python, Node, Go or .NET stack trace.");
    return ok({
        language: t.lang,
        summary: S.logTrace.summary(t),
        rootCause: { type: t.root.type, message: t.root.message, omitted: t.root.omitted || undefined },
        chain: t.chain.map((c) => (c.message ? `${c.type}: ${c.message}` : c.type)),
        whereToLook: t.culprit
            ? `${t.culprit.fn} (${t.culprit.file}${t.culprit.line != null ? ":" + t.culprit.line : ""})`
            : "the whole trace is framework code: there is no application frame",
        frames: { total: t.totalFrames, yours: t.appFrames },
        prefixesUsed: t.appPrefixes,
    });
});
server.tool("log_lint", "Check whether the log is WELL WRITTEN \u2014 not what happened in the system: secrets or personal data printed, one line flooding the file, timestamps with no time zone (which make two machines impossible to correlate), the clock going backwards, everything at the same level, no request id, payload dumps, and orphan stack traces with no error line. Every finding comes with its count and a sample; secrets are masked.", LOG_IN, async (a) => {
    const p = await prepararLog(a);
    if ("error" in p)
        return err(p.error);
    const f = S.logLint.lint(p.parsed.events, p.mined.patterns);
    return ok({
        events: p.parsed.events.length,
        findings: f.map((x) => ({
            rule: x.id,
            severity: x.severity,
            times: x.count,
            of: x.of,
            detail: x.detail,
            sample: x.sample,
            atEvent: x.at,
        })),
    });
});
server.tool("log_convert", "Convert a log from one format to another through OpenTelemetry's Logs Data Model: JSON, logfmt, syslog RFC 5424, CSV, OpenTelemetry or Elastic Common Schema. Tells you UP FRONT what the conversion loses \u2014 syslog only has eight severities and a text body, so coming down to it from JSON drops fields.", {
    ...LOG_IN,
    target: z.enum(["json", "logfmt", "syslog5424", "csv", "otel", "ecs"]).describe("Output format"),
    columns: z.array(z.string()).optional().describe("CSV only: which fields become columns"),
    service: z.string().optional(),
    host: z.string().optional(),
}, async (a) => {
    const p = await prepararLog(a);
    if ("error" in p)
        return err(p.error);
    const opts = { columns: a.columns, service: a.service, host: a.host };
    return ok({
        events: p.parsed.events.length,
        loses: S.logConv.lossy(p.parsed.events, a.target as LogTarget, opts).counts,
        output: S.logConv.convert(p.parsed.events, a.target as LogTarget, opts),
    });
});
server.registerTool("claim_check", {
    title: "Separate what is backed from what is merely asserted",
    description: "Split a text into claims and say, for each, whether it comes with a source and of what kind: peer-reviewed, preprint (arXiv and friends), registry/link, or self-published. Flags the ABSOLUTE claims with NO source at all, which is the expensive failure mode because they sound exactly as confident as the backed ones. It does NOT say whether something is true \u2014 it cannot \u2014 it says whether it is supported, which is a different thing. An arXiv DOI is still a preprint: registration is not review. Worth running on your own answer before you send it.",
    inputSchema: {
        text: z.string().describe("The text to review, as-is"),
    },
}, ({ text }) => {
    const afirmaciones = S.claim.analizar(text);
    return ok({ summary: S.claim.resumen(afirmaciones), claims: afirmaciones });
});
server.registerTool("eval_check", {
    title: "Review and run an eval suite",
    description: "Review an eval suite and run it against the outputs you provide. The review catches what silently ruins a suite: assertions that CANNOT FAIL (an empty `contains`, a regex like `.*`, a case with no assertions) and ones that can never pass (requiring and forbidding the same thing, an inverted range). A suite with those scores 100% on day one and has measured nothing. Assertion types: contains, not-contains, regex, json, range, max-chars and supported (no absolute claim without a source). Calls no model: you pass the outputs in already produced.",
    inputSchema: {
        cases: z.array(z.object({
            id: z.string().describe("Case name; used to compare runs, so it must be unique"),
            input: z.string().default("").describe("What the model was asked"),
            output: z.string().default("").describe("What it answered"),
            assertions: z.array(z.object({
                type: z.enum(["contains", "not-contains", "regex", "json", "range", "max-chars", "supported"]),
                value: z.string().optional().describe("Text, pattern, or comma-separated JSON fields, depending on the type"),
                min: z.number().optional(),
                max: z.number().optional(),
            })),
        })).describe("The suite cases, with their outputs already obtained"),
        promptfoo: z.boolean().default(false).describe("If true, also return the equivalent promptfoo configuration"),
    },
}, ({ cases, promptfoo }) => {
    const TIPO: Record<string, string> = {
        contains: "contiene",
        "not-contains": "no-contiene",
        regex: "regex",
        json: "json",
        range: "rango",
        "max-chars": "max-caracteres",
        supported: "respaldado",
    };
    const banco = cases.map((c) => ({
        id: c.id,
        entrada: c.input,
        salida: c.output,
        aserciones: c.assertions.map((x) => ({ tipo: TIPO[x.type], valor: x.value, min: x.min, max: x.max })),
    })) as Caso[];
    const r = conPresupuesto(() => ({ revision: S.evals.revisar(banco), informe: S.evals.correr(banco) }), REGEX_MS);
    if ("agotado" in r)
        return err(`Checking the suite took longer than ${REGEX_MS / 1000} s and was stopped: a "regex" assertion is probably catastrophic on one of the outputs (e.g. nested quantifiers like (a+)+). Check it with regex_redos_check.`);
    const { revision, informe } = r.valor;
    return ok({
        review: revision,
        suiteTrustworthy: revision.length === 0,
        report: { total: informe.total, passed: informe.pasan, failed: informe.fallan, rate: informe.tasa, cases: informe.casos },
        ...(promptfoo ? { promptfoo: S.evals.exportarPromptfoo(banco) } : {}),
    });
});
server.registerTool("mcp_catalog_audit", {
    title: "Audit an MCP server catalogue for design quality",
    description: "Paste the `tools/list` response of an MCP server \u2014 yours, or a third party's you are "
        + "evaluating whether to install \u2014 and check its catalogue quality: missing descriptions or "
        + "annotations, a tool name that suggests it writes or deletes while its annotations say "
        + "otherwise, context cost per tool (real BPE tokenization), and whether the top-level "
        + "`instructions` field is set and fits under the ~2 KB some Tool Search clients trim. Add "
        + "`serverJson`/`packageJson` to also catch the official MCP registry's own field-length and "
        + "namespace-pattern limits, and a version mismatch between the two \u2014 the exact 422/403/400 "
        + "errors this project hit publishing its own packages. This is NOT an access-security review: "
        + "it does not evaluate what the tools are permitted to do, only how the catalogue is described. Add "
        + "`approvedToolsListJson` (the tools/list you reviewed and approved earlier) to catch a \"rug pull\": "
        + "tools added or removed since, descriptions that changed or gained poisoning signals, new parameters, "
        + "and annotations that became less cautious.",
    inputSchema: {
        toolsListJson: z.string().describe("The `tools/list` response, either `{\"tools\": [...]}` or the bare array"),
        serverJson: z.string().optional().describe("The registry manifest (server.json), to check its own limits"),
        packageJson: z.string().optional().describe("package.json, to cross-check its version against server.json"),
        instructions: z.string().optional().describe("The server-level `instructions` string, if you have it"),
        encoding: z.enum(encIds).default("o200k_base").describe("BPE encoding for the token-cost measurement"),
        approvedToolsListJson: z.string().optional().describe("The tools/list you approved earlier, to diff against today's"),
    },
}, async ({ toolsListJson, serverJson, packageJson, instructions, encoding, approvedToolsListJson }) => {
    const r = await auditarCatalogo({ toolsListJson, serverJson, packageJson, instructions, encoding }, S.token);
    if ("error" in r)
        return err("This is not a tools/list response: paste the whole JSON ({\"tools\": [...]}) or the bare array.");
    if (approvedToolsListJson === undefined)
        return ok(informeCatalogoEn(r));
    const antes = parseToolsList(approvedToolsListJson);
    if (!antes)
        return err("approvedToolsListJson is not a tools/list response: paste the whole JSON ({\"tools\": [...]}) or the bare array.");
    return ok({ ...informeCatalogoEn(r), changesSinceApproved: cambiosCatalogoEn(compararCatalogos(antes, parseToolsList(toolsListJson) ?? [])) });
});
server.tool("log_trends", "Answer WHEN IT STARTED, which is what a log is really asked. Compares each pattern against ITSELF rather than against total volume \u2014 in a busy service everything rises at 9am and nothing has happened \u2014 and returns three different things: what SPIKED relative to its own normal and at what time; what is NEW, which did not exist before and is usually what a deploy left behind; and what STOPPED APPEARING, which raises no counter and is often the worse news.", {
    ...LOG_IN,
    bucketSeconds: z.number().int().min(1).max(86400).optional().describe("Width of the time bucket; by default chosen from the log's own range"),
    minRatio: z.number().min(1.5).max(1000).default(4).describe("How many times its own normal counts as a spike"),
    limit: z.number().int().min(1).max(200).default(20).describe("How many findings to return"),
}, async (a) => {
    const p = await prepararLog(a);
    if ("error" in p)
        return err(p.error);
    const r = minarTendencias(p.parsed.events, p.mined.patterns, {
        bucketMs: a.bucketSeconds ? a.bucketSeconds * 1000 : undefined,
        minRatio: a.minRatio,
    });
    if (!r.count)
        return ok({ note: "The log has no recognizable timestamps, so there is no timeline to analyze.", undated: r.undated });
    const cuando = (ms: number) => new Date(ms).toISOString();
    return ok({
        from: cuando(r.from),
        bucketSeconds: r.bucketMs / 1000,
        buckets: r.count,
        undated: r.undated || undefined,
        findings: notable(r).slice(0, a.limit).map(t => ({
            template: t.template,
            level: t.level ?? undefined,
            what: t.spike ? "spiked" : t.novel ? "is new" : "stopped appearing",
            times: t.spike ? Math.round(t.spike.ratio * 10) / 10 : undefined,
            when: t.spike ? cuando(t.spike.at) : undefined,
            inThatBucket: t.spike?.count,
            itsNormal: t.spike ? t.baseline : undefined,
            first: cuando(t.firstTs),
            last: cuando(t.lastTs),
        })),
    });
});
server.tool("log_around", "What ELSE happened around a moment in time. Given an instant \u2014 the spike log_trends returned, or the time of an alert \u2014 find the patterns that cluster there and do not appear the same way in the rest of the log. Correlation is NOT causation, and what settles it is order: what started BEFORE comes first and is a candidate explanation; what came after is usually a consequence. Background noise is filtered out even when a narrow window lands on one of its bursts.", {
    ...LOG_IN,
    at: z.string().describe("Reference instant, in ISO 8601 (e.g. \"2026-08-27T10:40:00Z\")"),
    radiusSeconds: z.number().int().min(1).max(86400).default(60).describe("How far to look on each side"),
    limit: z.number().int().min(1).max(100).default(20),
}, async (a) => {
    const at = Date.parse(a.at);
    if (!Number.isFinite(at))
        return err(`I cannot read the date "${a.at}". Use ISO 8601, e.g. 2026-08-27T10:40:00Z`);
    const p = await prepararLog(a);
    if ("error" in p)
        return err(p.error);
    const c = alrededorDe(p.parsed.events, p.mined.patterns, at, a.radiusSeconds * 1000);
    if (!c.length)
        return ok({ matches: [], note: "Nothing clusters in that window. Try a wider radius, or check that the instant falls inside the log." });
    return ok({
        at: new Date(at).toISOString(),
        radiusSeconds: a.radiusSeconds,
        matches: c.slice(0, a.limit).map(x => ({
            template: x.template,
            level: x.level ?? undefined,
            when: `${Math.round(Math.abs(x.firstOffsetMs) / 100) / 10} s ${x.firstOffsetMs < 0 ? "BEFORE" : "after"}`,
            times: x.inWindow,
            concentration: Number.isFinite(x.lift) ? Math.round(x.lift * 10) / 10 : "only here",
            shareOfItsLifeHere: `${Math.round(x.share * 100)}%`,
        })),
        warning: "Correlation is not causation. What started before may explain the failure; what came after is usually a consequence of it.",
    });
});
server.tool("log_distinguish", "What sets a group of events APART from the rest of the log: the field=value pairs over-represented in the selection. E.g. of 300 errors, 92% have `version=2.4.1` against 4% of everything else \u2014 the deploy that broke it, found without reading 300 errors. Select by minimum level (default: errors), by text, or by one field=value; that selector is left out of the answer, since it would trivially top it. Fields that are unique per event (request ids, trace ids) are skipped: they identify, they do not distinguish. A difference in proportions, not causation.", {
    ...LOG_IN,
    minLevel: z.enum(["trace", "debug", "info", "warn", "error", "fatal"]).optional().describe("Select events at this level or above (default \"error\" if nothing else is given)"),
    contains: z.string().optional().describe("Select events whose raw text contains this (case-insensitive)"),
    field: z.string().optional().describe("Select events with this field\u2026"),
    value: z.string().optional().describe("\u2026equal to this value"),
    limit: z.number().int().min(1).max(50).default(10),
}, async (a) => {
    if ((a.field == null) !== (a.value == null))
        return err("`field` and `value` go together.");
    const p = await prepararLog(a);
    if ("error" in p)
        return err(p.error);
    const evs = p.parsed.events;
    const orden = ["trace", "debug", "info", "warn", "error", "fatal"];
    const nivel = a.minLevel ?? (a.contains == null && a.field == null ? "error" : undefined);
    const aguja = a.contains?.toLowerCase();
    const sel = (i: number) => {
        const e = evs[i];
        if (nivel && (!e.level || orden.indexOf(e.level) < orden.indexOf(nivel)))
            return false;
        if (aguja && !e.raw.toLowerCase().includes(aguja))
            return false;
        if (a.field != null && e.fields[a.field] !== a.value)
            return false;
        return true;
    };
    const excluir = [...(nivel ? ["level"] : []), ...(a.field ? [a.field] : [])];
    const r = distinguir(evs, sel, { excluir, max: a.limit });
    if (!r.seleccion)
        return ok({ selected: 0, note: "Nothing matches the selection." });
    if (!r.resto)
        return ok({ selected: r.seleccion, note: "Everything matches the selection: there is no rest to compare against." });
    return ok({
        selected: r.seleccion,
        rest: r.resto,
        distinguishing: r.distintivos.map(d => ({
            field: d.campo,
            value: d.valor,
            inSelection: `${Math.round(d.pctSeleccion * 100)}% (${d.enSeleccion})`,
            inRest: `${Math.round(d.pctResto * 100)}% (${d.enResto})`,
        })),
        skippedUniqueFields: r.descartados.length ? r.descartados : undefined,
        note: r.distintivos.length ? undefined : "No field=value stands out: the selection looks like the rest. If the log has no fields (plain text), convert it or try log_patterns.",
    });
});
server.tool("csv_diff", "Compare two CSV files by a KEY column, of ANY size: which rows are only in A, only in B, and which changed and in WHICH columns. Columns are matched by header name, so a re-exported file with reordered columns or rows is not \"everything changed\" (it is for a line diff). Both files are streamed from disk; only the keys of B are held in memory, so do not read them into your context \u2014 pass the paths. Quoted cells with commas or line breaks inside are handled (RFC 4180). Optionally writes the FULL difference, one row per changed cell (`estado,clave,columna,valor_a,valor_b`), to `outPath`.", {
    pathA: z.string().describe("First CSV (the reference, e.g. yesterday's export)"),
    pathB: z.string().describe("Second CSV (e.g. today's)"),
    key: z.string().describe("Key column: its header name, or its 1-based position if there is no header"),
    keyB: z.string().optional().describe("Key column in B, if named differently"),
    header: z.boolean().default(true).describe("Both files have a header row"),
    delimiter: z.string().optional().describe("Field delimiter (default: detected, e.g. \",\" \";\" or tab)"),
    trim: z.boolean().default(false).describe("Ignore leading/trailing spaces in values"),
    caseInsensitiveKey: z.boolean().default(false),
    outPath: z.string().optional().describe("Write the full long-format difference here (CSV)"),
    examples: z.number().int().min(0).max(100).default(10),
}, async (a) => {
    let blobA: Blob, blobB: Blob;
    try {
        const { openAsBlob } = await import("node:fs");
        blobA = await openAsBlob(a.pathA);
        blobB = await openAsBlob(a.pathB);
    }
    catch (e: any) {
        return err(noSeLee(e?.path ?? a.pathA, e));
    }
    const preparar = async (blob: Blob) => {
        const cab = new Uint8Array(await blob.slice(0, 1 << 16).arrayBuffer());
        const cod = detectarCodificacion(cab);
        if (cod.codificacion === "utf-16")
            return { error: "UTF-16 file: save it as UTF-8 first (it cannot be read in byte ranges)." } as const;
        const texto = new TextDecoder(cod.codificacion).decode(cab);
        const lineas = texto.split("\n").slice(0, 5).map(l => l.replace(/\r$/, ""));
        const d = a.delimiter ?? adivinarSeparador(lineas);
        return { src: fileSource(blob, "", cod.codificacion), d, cabecera: a.header ? partirCsv(lineas[0] ?? "", d) : [], cod: cod.codificacion };
    };
    const pa = await preparar(blobA), pb = await preparar(blobB);
    if ("error" in pa)
        return err(pa.error!);
    if ("error" in pb)
        return err(pb.error!);
    const columna = (nombre: string, cab: string[]) => {
        if (a.header) {
            const i = cab.indexOf(nombre);
            if (i >= 0)
                return i;
        }
        return /^\d+$/.test(nombre) ? +nombre - 1 : -1;
    };
    const ka = columna(a.key, pa.cabecera), kb = columna(a.keyB ?? a.key, pb.cabecera);
    if (ka < 0)
        return err(`Key column "${a.key}" not found in A. Header: ${pa.cabecera.join(", ")}`);
    if (kb < 0)
        return err(`Key column "${a.keyB ?? a.key}" not found in B. Header: ${pb.cabecera.join(", ")}`);
    let fd: number | null = null, pend = "";
    const fs = await import("node:fs");
    if (a.outPath) {
        try {
            fd = fs.openSync(a.outPath, "w");
        }
        catch (e: any) {
            return err(`Cannot write ${a.outPath}: ${e?.message ?? e}`);
        }
    }
    const writer = { write: (s: string) => { if (fd === null)
            return; pend += s; if (pend.length > 1 << 20) {
            fs.writeSync(fd, pend);
            pend = "";
        } } };
    try {
        const r = await diffPorClave(pa.src, pb.src, {
            aKeyCol: ka,
            bKeyCol: kb,
            aDelim: pa.d,
            bDelim: pb.d,
            aHeaderRows: a.header ? 1 : 0,
            bHeaderRows: a.header ? 1 : 0,
            trim: a.trim,
            caseInsensitive: a.caseInsensitiveKey,
            maxEjemplos: a.examples,
        }, writer);
        if (fd !== null) {
            if (pend)
                fs.writeSync(fd, pend);
            fs.closeSync(fd);
        }
        return ok({
            rowsA: r.filasA,
            rowsB: r.filasB,
            identical: r.iguales,
            changed: r.cambiadas,
            onlyInA: r.soloA,
            onlyInB: r.soloB,
            duplicateKeys: (r.duplicadasA || r.duplicadasB) ? { a: r.duplicadasA, b: r.duplicadasB, note: "first occurrence compared, the rest only counted" } : undefined,
            changedCellsByColumn: r.porColumna,
            columnsOnlyInA: r.soloColumnasA.length ? r.soloColumnasA : undefined,
            columnsOnlyInB: r.soloColumnasB.length ? r.soloColumnasB : undefined,
            examples: { changed: r.ejemplos.cambiadas, onlyInA: r.ejemplos.soloA, onlyInB: r.ejemplos.soloB },
            encoding: pa.cod !== "utf-8" || pb.cod !== "utf-8" ? { a: pa.cod, b: pb.cod } : undefined,
            fullDiff: a.outPath,
        });
    }
    catch (e: any) {
        if (fd !== null)
            try {
                fs.closeSync(fd);
            }
            catch { }
        return err(String(e?.message ?? e));
    }
});
server.tool("log_rotation", "Put a folder or a list of rotated logs into TIME ORDER, split into series. Rotation numbering runs BACKWARDS against time: `app.log.3.gz` is older than `app.log.1.gz`, and plain `app.log` is the newest; alphabetically `app.log.10` sorts before `app.log.9` while in time it comes after. Use this BEFORE reading several logs of one service, or you will read them backwards. Returns the paths already ordered, ready to feed to log_analyze one by one.", {
    directory: z.string().optional().describe("Folder to look in (does not recurse). Alternative to `names`."),
    names: z.array(z.string()).optional().describe("List of file names or paths, in any order"),
}, async (a) => {
    let entradas: string[];
    let base = "";
    if (a.directory) {
        const { readdir } = await import("node:fs/promises");
        try {
            entradas = await readdir(a.directory);
        }
        catch (e: any) {
            return err(`Could not read the folder "${a.directory}": ${String(e?.message ?? e)}`);
        }
        base = a.directory.replace(/\/+$/, "") + "/";
    }
    else if (a.names?.length) {
        entradas = a.names;
    }
    else {
        return err("Either `directory` or `names` is required.");
    }
    const porNombre = new Map<string, string>();
    for (const e of entradas) {
        const n = e.split("/").pop() ?? e;
        if (looksLikeLog(n))
            porNombre.set(n, base ? base + n : e);
    }
    const series = groupRotations([...porNombre.keys()]);
    if (!series.length)
        return ok({ series: [], note: "No name here looks like a log file." });
    return ok({
        series: series.map(s => ({
            series: s.name,
            files: s.files.map(f => ({
                path: porNombre.get(f.name)!,
                rotation: f.index ?? f.date ?? "the live file (most recent)",
                compressed: f.compressed || undefined,
                openable: f.compressed && !/\.gz$/i.test(f.name) ? false : undefined,
            })),
        })),
    });
});
server.tool("log_profile_check", "Validate a Jarroba Tools LOG PROFILE (the `logprofile: 1` JSON that configures the log tools: format, server time zone, own-code prefixes, rules and AI budget). Returns ALL errors at once, each with the exact field (`rules[2].pattern`) and what was expected, so you can fix them in one pass instead of one at a time. Format documented in `public/logprofile.md`.", { profile: z.string().describe("The profile as JSON") }, async ({ profile }) => {
    const r = S.logProf.check(profile);
    return ok({
        ok: r.ok,
        errors: r.errors.map((e) => `${e.where}: ${e.message}`),
        warnings: r.warnings.map((e) => `${e.where}: ${e.message}`),
        profile: r.profile,
    });
});
server.tool("log_profile_suggest", "Propose a LOG PROFILE from a real log: infers the format, the own-code prefix (read from the stack traces, which is where it is demonstrated) and a starting set of rules covering the most frequent errors and whatever floods the file. What it does NOT propose is the server time zone: that is not in the log, and inventing it shifts the entire timeline without anyone noticing. Accepts a file path.", { ...LOG_IN, name: z.string().optional().describe("Name for the profile") }, async (a) => {
    const p = await prepararLog(a);
    if ("error" in p)
        return err(p.error);
    const perfil = S.logProf.suggest(p.parsed.events, p.mined.patterns, p.parsed.info.format, a.name);
    const check = S.logProf.check(JSON.stringify(perfil));
    return ok({
        profile: perfil,
        valid: check.ok,
        missing: "sourceZone: you have to say it if the server was not on UTC \u2014 it cannot be inferred from the log",
    });
});
const tasas = {
    arrivalsPerHour: z.number().positive().describe("Arrivals per hour (lambda), e.g. 12 groups/hour."),
    avgServiceMinutes: z.number().positive().describe("Mean time one resource stays occupied, in minutes, e.g. 75."),
};
server.tool("queue_analyze", "M/M/c queue: with N resources, how many people wait, how long, and what fraction leaves without a place. With `waitingRoom` the model becomes M/M/c/K (finite waiting area \u2014 the realistic case); without it the queue is infinite. Output times are in MINUTES. Erlang and M/M/c are exactly the kind of arithmetic a model does \"from memory\" and gets wrong.", {
    ...tasas,
    servers: z.number().int().positive().describe("Resources: tables, beds, bays, checkouts\u2026"),
    waitingRoom: z.number().int().min(0).optional()
        .describe("Waiting places IN ADDITION to the resources. Omit for an unbounded queue (nobody leaves)."),
}, async ({ arrivalsPerHour, avgServiceMinutes, servers, waitingRoom }) => {
    const mu = 60 / avgServiceMinutes;
    const r = waitingRoom === undefined
        ? mmc(arrivalsPerHour, mu, servers)
        : mmck(arrivalsPerHour, mu, servers, servers + waitingRoom);
    if (!r) {
        return err(waitingRoom === undefined
            ? `Unstable system: with ${servers} resources and that demand the queue grows without bound. Add resources, or set a waitingRoom — then there is an answer, because people leave.`
            : "Invalid parameters.");
    }
    return ok({
        model: waitingRoom === undefined ? "M/M/c" : "M/M/c/K",
        servers: r.servers,
        offeredLoad_erlangs: r.offeredLoad,
        utilization: r.utilization,
        probabilityOfWaiting: r.pWait,
        probabilityOfBeingTurnedAway: r.pBlock,
        avgWaitMinutes: r.wq * 60,
        avgTimeInSystemMinutes: r.w * 60,
        avgQueueLength: r.lq,
        avgInSystem: r.l,
        servedPerHour: r.throughput,
        consistencyError: littleError(r),
    });
});
server.tool("queue_size", "How many resources do you need? Returns the MINIMUM that meets your target (max wait, max turned away, or max utilization) and how the system behaves at that number. This is the question asked before building a place, not after.", {
    ...tasas,
    maxWaitMinutes: z.number().positive().optional().describe("Maximum acceptable mean wait."),
    maxTurnedAway: z.number().min(0).max(1).optional().describe("Maximum fraction that leaves without a place (0-1)."),
    maxUtilization: z.number().min(0).max(1).optional()
        .describe("Maximum utilization per resource (0-1). The 0.85 rule for hospital beds is this number."),
    waitingRoom: z.number().int().min(0).optional().describe("Waiting places in addition to the resources."),
}, async ({ arrivalsPerHour, avgServiceMinutes, maxWaitMinutes, maxTurnedAway, maxUtilization, waitingRoom }) => {
    const mu = 60 / avgServiceMinutes;
    const objetivo = {
        ...(maxWaitMinutes !== undefined ? { maxWq: maxWaitMinutes / 60 } : {}),
        ...(maxTurnedAway !== undefined ? { maxBlock: maxTurnedAway } : {}),
        ...(maxUtilization !== undefined ? { maxUtilization } : {}),
    };
    const s = serversNeeded(arrivalsPerHour, mu, objetivo, waitingRoom === undefined ? {} : { waitingRoom });
    if (!s)
        return err("No reasonable number of resources meets that target. Usually this means the target is impossible (utilization 0, say) or demand is enormous relative to the service time.");
    return ok({
        serversNeeded: s.servers,
        withThat: {
            utilization: s.result.utilization,
            avgWaitMinutes: s.result.wq * 60,
            probabilityOfWaiting: s.result.pWait,
            probabilityOfBeingTurnedAway: s.result.pBlock,
            servedPerHour: s.result.throughput,
        },
    });
});
server.tool("queue_loss", "Pure LOSS system (Erlang B): there is no waiting area, so whoever finds no free resource leaves. Car parks, workshop bays, phone lines, critical-care beds.", { ...tasas, servers: z.number().int().positive() }, async ({ arrivalsPerHour, avgServiceMinutes, servers }) => {
    const mu = 60 / avgServiceMinutes;
    const r = mmcLoss(arrivalsPerHour, mu, servers);
    if (!r)
        return err("Invalid parameters.");
    return ok({
        model: "M/M/c/c (Erlang B)",
        servers,
        offeredLoad_erlangs: r.offeredLoad,
        probabilityOfBeingTurnedAway: r.pBlock,
        erlangB_crossCheck: erlangB(r.offeredLoad, servers),
        utilization: r.utilization,
        servedPerHour: r.throughput,
    });
});
server.tool("queue_simulate", "Simulate the queue customer by customer (discrete events, fixed seed, so the result is reproducible). Its job is to CROSS-CHECK the analytic answer: if the simulation and the formula disagree, one of them is wrong.", {
    ...tasas,
    servers: z.number().int().positive(),
    waitingRoom: z.number().int().min(0).optional(),
    customers: z.number().int().min(100).max(500000).default(50000),
    seed: z.number().int().min(0).default(1),
}, async ({ arrivalsPerHour, avgServiceMinutes, servers, waitingRoom, customers, seed }) => {
    const mu = 60 / avgServiceMinutes;
    const sim = simulateQueue(arrivalsPerHour, mu, servers, {
        customers,
        seed,
        ...(waitingRoom === undefined ? {} : { capacity: servers + waitingRoom }),
    });
    if (!sim)
        return err("Invalid parameters.");
    const teor = waitingRoom === undefined
        ? mmc(arrivalsPerHour, mu, servers)
        : mmck(arrivalsPerHour, mu, servers, servers + waitingRoom);
    return ok({
        simulated: {
            arrivals: sim.arrivals,
            served: sim.served,
            turnedAway: sim.blocked,
            probabilityOfBeingTurnedAway: sim.pBlock,
            probabilityOfWaiting: sim.pWait,
            avgWaitMinutes: sim.wq * 60,
            utilization: sim.utilization,
        },
        analytic: teor ? {
            probabilityOfBeingTurnedAway: teor.pBlock,
            probabilityOfWaiting: teor.pWait,
            avgWaitMinutes: teor.wq * 60,
            utilization: teor.utilization,
        } : null,
        note: "If the two columns disagree, suspect the model rather than the simulation: the simulation assumes nothing.",
    });
});
const HEADER_VALUE = z.union([z.string().max(1000), z.number(), z.boolean(), z.null()]);
server.tool("rabbit_route", "Which queues a RabbitMQ exchange delivers a message to, and why each binding matches or not: direct, topic (* and # words), fanout and headers (x-match all/any/all-with-x/any-with-x). Ported from RabbitMQ and calibrated against real 4.0.5 and 4.3.6 brokers (thousands of seeded cases, all equal). Unroutable means the message is dropped (or returned with mandatory). One difference: in headers, 1 and 1.0 are different values in RabbitMQ and equal here.", {
    type: z.enum(["direct", "topic", "fanout", "headers"]),
    version: z.enum(["4.0", "4.3"]).optional().describe("Broker line (default 4.3): from 4.3.5 a topic binding with more than two # is rejected"),
    bindings: z.array(z.object({
        queue: z.string().max(255),
        bindingKey: z.string().max(1000).optional().describe("direct/topic; ignored by fanout and headers"),
        arguments: z.record(HEADER_VALUE).optional().describe("headers: the binding arguments, x-match included"),
    })).max(10000),
    routingKey: z.string().max(1000).optional(),
    headers: z.record(HEADER_VALUE).optional().describe("headers exchange: the message headers"),
}, async (input) => ok(rabbitEn(rabbitRoute(input))));
server.tool("sns_filter", "Does an AWS SNS subscription filter policy let this message through, and which key decided it: exact values, prefix, suffix, equals-ignore-case, wildcard, cidr, numeric ranges, anything-but, exists and $or, on MessageAttributes or on the JSON body (FilterPolicyScope=MessageBody). Also rejects what SNS would reject: more than 5 keys, more than 150 combinations, a policy over 256 KB. Built from the AWS documentation; there is no emulator to calibrate it against, and the answer says so.", {
    policy: z.union([z.record(z.unknown()), z.string().max(300000)]).describe("The filter policy, as an object or JSON text"),
    message: z.union([z.record(z.unknown()), z.string().max(300000)])
        .describe("MessageAttributes scope: { name: { \"Type\": \"String\"|\"String.Array\"|\"Number\"|\"Binary\", \"Value\": \"...\" } }. MessageBody scope: the JSON body"),
    scope: z.enum(["MessageAttributes", "MessageBody"]).default("MessageAttributes"),
}, async ({ policy, message, scope }) => {
    const leer = (x: unknown) => { if (typeof x !== "string")
        return x; try {
        return JSON.parse(x);
    }
    catch {
        return x;
    } };
    const r = snsFilterEn(snsFilter(leer(policy), leer(message), scope));
    return "error" in r && r.error ? err(r.error) : ok(r);
});
server.tool("kafka_partition", "The partition Kafka's default partitioner picks for a message key: murmur2 over the UTF-8 bytes, made positive, modulo the partition count \u2014 with the intermediate numbers so the result can be checked. Ported from Kafka 4.3.1 and checked against its murmur2 test vectors. Only for messages WITH a key (without one, Kafka uses the sticky partitioner, which is not deterministic).", {
    key: z.string().max(100000),
    partitions: z.number().int().min(1).max(1000000),
}, async ({ key, partitions }) => nn(partitionForKey(key, partitions), "partitions must be an integer between 1 and 1,000,000"));
server.tool("kafka_assign", "How a Kafka consumer group splits partitions among its members with the classic protocol (the default in Kafka 4.3): range, roundrobin, sticky or cooperative-sticky, ported from Kafka 4.3.1 and checked against its tests. Returns each member's partitions, idle members and the order the assignor walked them; for the sticky strategies give each member's owned partitions (and generation) to see what moves, and with cooperative-sticky which partitions are revoked this round and handed over in the next. Not covered: rack awareness and the server-side assignors of KIP-848; sticky only when all members subscribe to the same topics.", {
    strategy: z.enum(["range", "roundrobin", "sticky", "cooperative-sticky"]),
    topics: z.array(z.object({ name: z.string().max(249), partitions: z.number().int().min(1) })).min(1).max(10000),
    members: z.array(z.object({
        id: z.string().max(255),
        topics: z.array(z.string().max(249)).max(10000).describe("The topics it subscribes to"),
        groupInstanceId: z.string().max(255).optional().describe("Static membership: changes the order, and so the split"),
        owned: z.array(z.object({ topic: z.string().max(249), partition: z.number().int().min(0) })).max(200000).optional()
            .describe("sticky strategies: the partitions it had before this rebalance"),
        generation: z.number().int().min(-1).optional().describe("The generation it owned them in (default -1)"),
    })).min(1).max(10000),
}, async (input) => ok(kafkaAssignEn(kafkaAssign(input))));
async function leerProyecto(dir: string, tope = 5000): Promise<{
    ficheros: FicheroVirtual[];
    error?: string;
}> {
    const { readdir, stat } = await import("node:fs/promises");
    const out: FicheroVirtual[] = [];
    const pendientes = [""];
    try {
        while (pendientes.length && out.length < tope) {
            const rel = pendientes.shift()!;
            const abs = rel ? dir.replace(/\/+$/, "") + "/" + rel : dir;
            for (const nombre of await readdir(abs)) {
                if (nombre === ".git")
                    continue;
                const hijoRel = rel ? rel + "/" + nombre : nombre;
                const st = await stat(dir.replace(/\/+$/, "") + "/" + hijoRel).catch(() => null);
                if (!st)
                    continue;
                out.push({ ruta: hijoRel, mtime: st.mtimeMs });
                if (st.isDirectory())
                    pendientes.push(hijoRel);
            }
        }
    }
    catch (e: any) {
        return { ficheros: out, error: noSeLee(dir, e) };
    }
    return { ficheros: out };
}
async function leerTexto(ruta: string): Promise<string | null> {
    const { readFile } = await import("node:fs/promises");
    try {
        return await readFile(ruta, "utf8");
    }
    catch {
        return null;
    }
}
async function contexto(a: {
    text?: string;
    file?: string;
    project?: string;
    files?: string[];
}, porDefecto: string) {
    let texto = a.text;
    if (!texto && a.file) {
        const t = await leerTexto(a.file);
        if (t === null)
            return { error: `Could not read "${a.file}".` };
        texto = t;
    }
    if (!texto && a.project) {
        const t = await leerTexto(a.project.replace(/\/+$/, "") + "/" + porDefecto);
        if (t !== null)
            texto = t;
    }
    if (!texto)
        return { error: `One of \`text\`, \`file\`, or a \`project\` containing a ${porDefecto} is required.` };
    let ficheros: FicheroVirtual[] = [];
    if (a.project) {
        const r = await leerProyecto(a.project);
        if (r.error)
            return { error: r.error };
        ficheros = r.ficheros;
    }
    else if (a.files?.length) {
        ficheros = a.files.map(ruta => ({ ruta, mtime: 1 }));
    }
    return { texto, ficheros };
}
server.tool("make_simulate", "Simulate `make` WITHOUT RUNNING ANYTHING: which targets would be rebuilt, in what order, and WHY, naming the file to blame. Answers the two questions no other tool answers: \"why is it rebuilding this when I changed nothing?\" and \"why is it NOT rebuilding it?\". With `project` it reads the Makefile and the REAL mtimes from disk; `touch` asks \"what if I changed this file?\" without changing it. The reasons use the same vocabulary as the Linux kernel's `make V=2`.", {
    project: z.string().optional().describe("Project folder: its Makefile and its files' real mtimes are read"),
    text: z.string().optional().describe("The Makefile pasted, if there is no folder"),
    file: z.string().optional().describe("Path to a specific Makefile"),
    files: z.array(z.string()).optional().describe("List of project paths, if no folder is given"),
    targets: z.array(z.string()).optional().describe("What to build. Empty = the Makefile's default target"),
    touch: z.array(z.string()).optional().describe("Files to treat as just-modified, WITHOUT actually touching them (like `make -W`)"),
    forceAll: z.boolean().optional().describe("Like `make -B`: rebuild everything without looking at dates"),
}, async (a) => {
    const ctx = await contexto(a, "Makefile");
    if ("error" in ctx)
        return err(ctx.error!);
    const mk = leerMakefile(ctx.texto!, { ficheros: ctx.ficheros!.map(f => f.ruta) });
    const plan = planificar(mk, ctx.ficheros!, {
        objetivos: a.targets,
        forzarTodo: a.forceAll,
        suponerNuevos: a.touch,
    });
    return ok({
        targets: plan.objetivosPedidos,
        willRun: plan.orden.length,
        steps: plan.orden.map((t, i) => {
            const n = plan.nodos.get(t)!;
            return {
                step: i + 1,
                target: t,
                reason: n.veredicto,
                toBlame: n.culpables.length ? n.culpables : undefined,
                recipe: n.receta,
                line: n.reglaLinea ?? undefined,
            };
        }),
        upToDate: [...plan.nodos.values()]
            .filter(n => !n.seReconstruye && n.veredicto !== "fuente")
            .map(n => ({ target: n.objetivo, reason: n.veredicto })),
        inParallel: plan.ondas.length > 1 ? {
            waves: plan.ondas,
            note: "Each wave can run at once with `make -j`. The number of waves is the critical path.",
        } : undefined,
        possibleRaces: plan.carreras.length ? plan.carreras.map(carreraEn) : undefined,
        errors: plan.diags.filter(d => d.gravedad === "error").map(diagMkEn),
        unreliable: plan.noFiable || undefined,
        note: plan.noFiable
            ? "The Makefile uses $(shell ...) or $(eval ...), which cannot be executed here: the result is INDICATIVE only."
            : undefined,
    });
});
server.tool("make_lint", "Review a Makefile and return the mistakes that actually bite, each with WHAT is wrong, HOW it breaks in practice and HOW to fix it: a recipe indented with spaces instead of a tab, a `cd` that does not persist to the next line, a `$` that make eats before the shell sees it, `$(shell ...)` inside a `=` variable (re-executed on every use), a pipeline without `pipefail`, a missing `.PHONY`, and a missing `.DELETE_ON_ERROR`. Calibrated NOT to complain about correct code: a well-written Makefile comes back with zero findings.", {
    project: z.string().optional().describe("Project folder (its Makefile is read)"),
    text: z.string().optional().describe("The Makefile pasted"),
    file: z.string().optional().describe("Path to a specific Makefile"),
    files: z.array(z.string()).optional().describe("Project paths: with them more cases are detected (e.g. a .PHONY that collides with a real file)"),
}, async (a) => {
    const ctx = await contexto(a, "Makefile");
    if ("error" in ctx)
        return err(ctx.error!);
    const rutas = ctx.ficheros!.map(f => f.ruta);
    const hallazgos = revisarMakefile(leerMakefile(ctx.texto!, { ficheros: rutas }), { ficheros: rutas });
    return ok({
        errors: hallazgos.filter(h => h.gravedad === "error").length,
        warnings: hallazgos.filter(h => h.gravedad === "aviso").length,
        findings: hallazgos.map(h => ({
            rule: h.regla,
            severity: h.gravedad,
            line: h.linea || undefined,
            ...hallazgoMkEn(h),
        })),
    });
});
server.tool("make_generate", "Generate a ready-to-use Makefile for a stack (node, python, go, rust, c, maven, gradle or generic). What it generates PASSES its own linter with zero findings: it always ships `.DELETE_ON_ERROR`, `SHELL := /bin/bash` with `.SHELLFLAGS := -eu -o pipefail -c`, and declared `.PHONY` targets \u2014 the three lines that are almost never there and that prevent the most expensive failures. With `withLogs`, targets record their output through `tee`, redirect stderr, timestamp the file name, and take the log directory as an order-only prerequisite.", {
    stack: z.enum(["generic", "node", "python", "go", "rust", "c", "maven", "gradle", "generico"]).describe("Project stack"),
    projectName: z.string().optional().describe("Project name (default \"mi-proyecto\")"),
    withLogs: z.boolean().optional().describe("Targets that record their output to files (default yes)"),
    withHelp: z.boolean().optional().describe("Self-documenting `make help` built from ## comments (default yes)"),
    withDocker: z.boolean().optional().describe("Docker image targets (default no)"),
}, async (a) => {
    const texto = generarMakefile({
        stack: (a.stack === "generic" ? "generico" : a.stack) as Stack,
        nombreProyecto: a.projectName ?? "mi-proyecto",
        conLogs: a.withLogs ?? true,
        conHelp: a.withHelp ?? true,
        conDocker: a.withDocker ?? false,
    });
    const hallazgos = revisarMakefile(leerMakefile(texto), {}).filter(h => h.gravedad !== "info");
    return ok({ makefile: texto, findingsFromItsOwnLinter: hallazgos.length ? hallazgos.map(h => ({ rule: h.regla, ...hallazgoMkEn(h) })) : 0 });
});
server.tool("make_role", "Answer the question that decides whether `make` is giving you anything: is this Makefile a BUILD, or a script LAUNCHER? make exists in order NOT to redo what is already done \u2014 mtimes, a dependency graph, skipping what did not change \u2014 and most Makefiles today use none of it: they are `make test`, `make lint`, `make docker-up`, all .PHONY, all running every time. Here each target is classified WITH THE SIGNAL that decided it (including the signals that pointed the other way: a .PHONY whose recipe creates that very file is a bug waiting to happen), what make is giving you TODAY is measured, and with `convertTo` it is converted to just, Taskfile or npm scripts. Whatever cannot be converted is OMITTED with its reason, rather than emitting a recipe that would look the same and rebuild every time. Honest caveat: `make` is POSIX and is everywhere; just and task have to be installed.", {
    project: z.string().optional().describe("Project folder: its Makefile and its real paths are read"),
    text: z.string().optional().describe("The Makefile pasted"),
    file: z.string().optional().describe("Path to a specific Makefile"),
    files: z.array(z.string()).optional().describe("Project paths: used to know whether a target already exists on disk"),
    convertTo: z.enum(["just", "task", "npm"]).optional().describe("If given, also convert to that format instead of only diagnosing"),
}, async (a) => {
    const ctx = await contexto(a, "Makefile");
    if ("error" in ctx)
        return err(ctx.error!);
    const rutas = ctx.ficheros!.map(f => f.ruta);
    const mk = leerMakefile(ctx.texto!, { ficheros: rutas });
    const d = diagnosticarRol(mk, { ficheros: rutas });
    const conv = a.convertTo ? convertirMake(mk, d, a.convertTo as Destino) : null;
    return ok({
        verdict: d.veredicto,
        counts: { file: d.ficheros, action: d.acciones, unclear: d.dudosos },
        whatMakeGivesYouToday: d.sePierde.map(perdidaEn),
        counterArgument: "make is POSIX and ships with any distro and any CI image. just and task have to be installed: on your machine, on the machine of whoever clones the repo, and on every runner. Converting has a real cost.",
        targets: d.objetivos.map(o => ({
            target: o.nombre,
            role: o.rol,
            line: o.linea || undefined,
            decidingSignal: ((x) => x ? senalEn(x.motivo, o.nombre) : undefined)(o.senales.find(s => s.decisiva)),
            otherSignals: o.senales.filter(s => !s.decisiva).map(s => `(${s.hacia}) ${senalEn(s.motivo, o.nombre)}`),
        })),
        conversion: conv ? {
            file: conv.nombreFichero,
            content: conv.texto,
            converted: conv.convertidos,
            omitted: conv.omitidos.map(o => ({ target: o.nombre, why: omitidoEn(o) })),
            warnings: conv.avisos.map(avisoConvEn),
        } : undefined,
        unreliable: d.noFiable || undefined,
        note: d.noFiable
            ? "The Makefile uses $(shell ...), which is not executed here: the numbers are INDICATIVE only."
            : undefined,
    });
});
server.tool("ignore_check", "Say which paths a `.gitignore` or `.dockerignore` ignores AND BY WHICH LINE \u2014 it is `git check-ignore -v` without git. And it does what no other tool does: it reads the SAME file as git and as Docker and points at where they do NOT decide the same. The two formats look alike and are not: a pattern with no slashes (`node_modules`) applies at any depth in git but ONLY at the root in Docker, so a `.dockerignore` copied from a `.gitignore` pulls into the build context exactly what you thought you had excluded. It also warns about the `!` that cannot work because its folder is already excluded, which is the number-one cause of \"my exception does nothing\".", {
    project: z.string().optional().describe("Project folder: its real paths are read and, failing anything else, its .gitignore"),
    text: z.string().optional().describe("The rules pasted"),
    file: z.string().optional().describe("Path to the rules file"),
    files: z.array(z.string()).optional().describe("Paths to evaluate, if no folder is given"),
    mode: z.enum(["git", "docker"]).optional().describe("Which rule dialect decides (default git)"),
}, async (a) => {
    const ctx = await contexto(a, ".gitignore");
    if ("error" in ctx)
        return err(ctx.error!);
    const modo = a.mode ?? "git";
    const rutas = ctx.ficheros!.map(f => f.ruta).sort();
    if (!rutas.length)
        return err("Either `project` or `files` is required: with no paths there is nothing to decide.");
    const dirs = new Set<string>();
    for (const r of rutas) {
        const partes = r.split("/");
        for (let i = 1; i < partes.length; i++)
            dirs.add(partes.slice(0, i).join("/"));
    }
    const reglas = leerReglas(ctx.texto!, modo);
    const decisiones = rutas.map(r => decidir(reglas, r, dirs.has(r), modo));
    const divergencias = compararIgnore(ctx.texto!, rutas, dirs);
    return ok({
        mode: modo,
        ignored: decisiones.filter(d => d.ignorado).length,
        total: rutas.length,
        detail: decisiones.map(d => ({
            path: d.ruta,
            ignored: d.ignorado,
            byLine: d.regla?.linea,
            rule: d.regla?.crudo.trim(),
            blockedByItsFolder: d.bloqueadoPor
                ? { folder: d.bloqueadoPor.ancestro, line: d.bloqueadoPor.regla.linea }
                : undefined,
        })),
        gitVersusDocker: divergencias.length
            ? divergencias.map(d => ({
                path: d.ruta,
                ignoredByGit: d.ignoradoGit,
                ignoredByDocker: d.ignoradoDocker,
                cause: d.causa,
                explanation: divergenciaEn(d),
            }))
            : undefined,
        warnings: revisarIgnore(ctx.texto!, modo, rutas, dirs).map(x => ({
            rule: x.regla,
            severity: x.gravedad,
            line: x.linea,
            ...avisoIgnoreEn(x),
        })),
    });
});
server.tool("dockerfile_cache", "Say which LAYERS of a Dockerfile would be rebuilt when given files change, and which come from cache. Dockerfile linters spot suspicious ordering patterns; this SIMULATES invalidation, which is a different thing: it needs to know which files exist and which changed. In Docker, when one layer is invalidated so is EVERY layer after it, so a `COPY . .` before the `RUN` that installs dependencies condemns you to reinstalling all of them every time you touch a line of code \u2014 and that shows up here as numbers. Respects the `.dockerignore`: what stays out of the context cannot invalidate anything.", {
    project: z.string().optional().describe("Project folder: its Dockerfile, .dockerignore and files are read"),
    text: z.string().optional().describe("The Dockerfile pasted"),
    file: z.string().optional().describe("Path to a specific Dockerfile"),
    files: z.array(z.string()).optional().describe("Project paths, if no folder is given"),
    changed: z.array(z.string()).optional().describe("Files changed since the last build. Empty = none"),
    dockerignore: z.string().optional().describe(".dockerignore rules pasted (otherwise looked up in the folder)"),
}, async (a) => {
    const ctx = await contexto(a, "Dockerfile");
    if ("error" in ctx)
        return err(ctx.error!);
    let reglasTexto = a.dockerignore;
    if (reglasTexto === undefined && a.project) {
        reglasTexto = await leerTexto(a.project.replace(/\/+$/, "") + "/.dockerignore") ?? "";
    }
    const reglas = leerReglas(reglasTexto ?? "", "docker");
    const dirs = new Set<string>();
    for (const f of ctx.ficheros!) {
        const partes = f.ruta.split("/");
        for (let i = 1; i < partes.length; i++)
            dirs.add(partes.slice(0, i).join("/"));
    }
    const contextoBuild = ctx.ficheros!.filter(f => !decidir(reglas, f.ruta, dirs.has(f.ruta), "docker").ignorado);
    const CORTE = 1000000;
    const cambiados = new Set(a.changed ?? []);
    const conFechas = contextoBuild.map(f => ({ ruta: f.ruta, mtime: cambiados.has(f.ruta) ? CORTE + 1 : 1 }));
    const df = leerDockerfile(ctx.texto!);
    const sim = simularCache(df, conFechas, CORTE);
    return ok({
        filesInContext: contextoBuild.length,
        excludedByDockerignore: ctx.ficheros!.length - contextoBuild.length,
        layersRebuilt: sim.rehechas,
        layersTotal: sim.total,
        firstToFall: sim.primeraRehecha
            ? { line: sim.primeraRehecha.linea, instruction: sim.primeraRehecha.crudo }
            : null,
        runsRepeated: sim.runsRehechos.map(r => ({ line: r.linea, command: r.argumentos })),
        layers: sim.capas.map(c => ({
            line: c.instruccion.linea,
            instruction: c.instruccion.crudo,
            rebuilt: c.rehecha,
            reason: c.motivo,
            becauseOfChangesIn: c.culpables.length ? c.culpables : undefined,
        })),
        warnings: revisarDockerfile(df, contextoBuild.map(f => f.ruta)).map(x => ({
            rule: x.regla,
            severity: x.gravedad,
            line: x.linea,
            ...avisoDfEn(x),
        })),
        note: "Docker compares CONTENTS (a checksum), not dates: here \"changed\" is whatever you say in `changed`.",
    });
});
const T = { parse: new TestParseService(), audit: new TestAuditService(), diff: new TestDiffService(), casos: new TestCasesService(), proy: new TestProjectService() };
let motorTestsListo = false;
async function rutaGramaticas(): Promise<string> {
    const { existsSync } = await import("node:fs");
    const { join, dirname } = await import("node:path");
    const { fileURLToPath } = await import("node:url");
    const aqui = dirname(fileURLToPath(import.meta.url));
    for (const c of [join(aqui, "tree-sitter"), join(aqui, "..", "..", "public", "tree-sitter")]) {
        if (existsSync(join(c, "web-tree-sitter.wasm")))
            return c;
    }
    throw new Error("tree-sitter grammars not found (public/tree-sitter/)");
}
async function motorTests(): Promise<void> {
    if (motorTestsListo)
        return;
    const base = await rutaGramaticas();
    const { readFile } = await import("node:fs/promises");
    const { join } = await import("node:path");
    const mod = await import("web-tree-sitter");
    await T.parse.init(mod, async (fichero) => new Uint8Array(await readFile(join(base, fichero))), () => join(base, "web-tree-sitter.wasm"));
    motorTestsListo = true;
}
const LENGUAJES_TEST = Object.keys(GRAMATICAS) as [
    Lenguaje,
    ...Lenguaje[]
];
async function codigoDeTest(texto: string | undefined, ruta: string | undefined, lenguaje?: Lenguaje): Promise<{
    error: string;
} | {
    src: string;
    lang: Lenguaje;
}> {
    let src = texto;
    let lang = lenguaje;
    if (!src && ruta) {
        const t = await leerTexto(ruta);
        if (t === null)
            return { error: `Could not read "${ruta}".` };
        src = t;
        lang ??= TestParseService.lenguajePorExtension(ruta) ?? undefined;
    }
    if (!src)
        return { error: "Either `text` or `path` is required." };
    if (!lang)
        return { error: "Could not infer the language from the extension: pass it in `language`." };
    return { src, lang };
}
const AUDIT_IN = {
    text: z.string().optional().describe("The test file as text. Alternative to `path`."),
    path: z.string().optional().describe("Path to the test file. The language is inferred from the extension."),
    language: z.enum(LENGUAJES_TEST).optional().describe("Required if you pass `text` without `path`."),
    dialects: z.array(z.object({
        nombre: z.string(),
        fuertes: z.array(z.string()).default([]).describe("Assert about a CONCRETE value"),
        debiles: z.array(z.string()).default([]).describe("Only say that something exists or is truthy"),
        llamadas: z.array(z.string()).default([]).describe("Only say that something was called"),
    })).optional().describe("Your own assertion helpers. If your team has a home-made expect(), declare it here and it will stop coming back as \"indeterminate\"."),
};
server.tool("test_audit", "Audit a test file and say, case by case, what it ACTUALLY checks: which ones assert about a value, which only check that something exists, which assert nothing at all, and which are disabled. Returns the EVIDENCE behind each verdict (the assertions it found) so you can check the checker. TypeScript, JavaScript, Python, Java and Go. Executes nothing. Run it on the tests you just wrote, BEFORE you hand them over: told to \"make the tests pass\", widening a matcher is cheaper than fixing the bug, and this is what notices.", AUDIT_IN, async (a) => {
    const c = await codigoDeTest(a.text, a.path, a.language as Lenguaje | undefined);
    if ("error" in c)
        return err(c.error);
    await motorTests();
    const extra = T.audit.dialectosValidos((a.dialects ?? []).map(d => ({ ...d, lenguaje: c.lang })));
    const suite = await T.parse.analizar(c.src, c.lang, extra);
    const veredictos = T.audit.auditar(suite);
    const r = T.audit.resumir(veredictos);
    return ok({
        language: suite.lenguaje,
        dialect: suite.dialecto,
        total: r.total,
        summary: r.porClase,
        withoutStrongAssertion: r.sinAsercionFuerte,
        indeterminate: r.indeterminados,
        cases: veredictos.map(v => ({
            name: v.caso.nombre,
            line: v.caso.linea,
            verdict: v.clase,
            why: v.porque,
            assertions: v.evidencia.encontradas.map(x => ({ matcher: x.nombre, strength: x.fuerza, line: x.linea, text: x.texto })),
            unrecognized: v.evidencia.noReconocidas.length ? v.evidencia.noReconocidas : undefined,
            warnings: (() => {
                const a = T.audit.avisos(v.caso);
                return a.length
                    ? a.map(x => ({ kind: x.tipo, what: x.que, whyItMatters: x.porque, fix: x.arreglo }))
                    : undefined;
            })(),
        })),
        note: "\"indeterminate\" is NOT a failure: it means we do not recognize that dialect. When in doubt we do not accuse. "
            + "If those calls do assert in your project, declare them in `dialects` and they will disappear.",
    });
});
server.tool("test_diff_audit", "Compare TWO versions of the same test file and say whether the change STRENGTHENED or WEAKENED the safety net: widened matchers (toBe -> toContain -> toBeGreaterThan), assertions that disappeared, and cases that stopped running. Call it on your own work after touching tests, and above all after fixing a red suite: reaching green by softening an assertion is cheaper than fixing the bug, and this is what catches it. Executes nothing.", {
    before: z.string().optional().describe("Previous version, as text."),
    after: z.string().optional().describe("New version, as text."),
    beforePath: z.string().optional().describe("Path to the previous version (e.g. what `git show HEAD:file` produced)."),
    afterPath: z.string().optional().describe("Path to the new version."),
    language: z.enum(LENGUAJES_TEST).optional().describe("Required if you pass the texts without paths."),
}, async (a) => {
    const A = await codigoDeTest(a.before, a.beforePath, a.language as Lenguaje | undefined);
    if ("error" in A)
        return err(`before: ${A.error}`);
    const B = await codigoDeTest(a.after, a.afterPath, (a.language as Lenguaje | undefined) ?? A.lang);
    if ("error" in B)
        return err(`after: ${B.error}`);
    if (A.lang !== B.lang)
        return err(`Both versions must be in the same language (${A.lang} vs ${B.lang}).`);
    await motorTests();
    const d = T.diff.comparar(await T.parse.analizar(A.src, A.lang), await T.parse.analizar(B.src, B.lang));
    return ok({
        verdict: d.veredicto,
        hasRegression: d.hayRegresion,
        regressions: d.regresiones,
        improvements: d.mejoras,
        changes: d.cambios.filter(c => c.tipo !== "sin-cambio").map(c => ({
            case: c.nombre,
            kind: c.tipo,
            detail: c.detalle,
            softened: c.ablandadas.length
                ? c.ablandadas.map(x => ({ before: x.antes.texto, after: x.despues.texto, from: x.antes.fuerza, to: x.despues.fuerza }))
                : undefined,
        })),
        note: d.hayRegresion
            ? "There are losses. If you were fixing a red suite, check that you did not reach green by softening the check instead of fixing the failure."
            : "No losses.",
    });
});
const elemento = (q: string) => {
    const t = (q ?? "").trim();
    const n = Number(t);
    return Number.isFinite(n) && n > 0 ? elementByZ(Math.floor(n)) : elementBySymbol(t);
};
server.tool("element_info", "Data sheet for an element by atomic number or symbol: name, mass, category, group/period/block, electronegativity, radius, ionization energy and electron affinity. Data that does NOT exist comes back as null, never as 0 \u2014 a noble gas has no electron affinity, and that is not \"zero\".", { element: z.string().describe("Atomic number (\"26\") or symbol (\"Fe\")") }, async ({ element }) => {
    const el = elemento(element);
    if (!el)
        return err(`I cannot find the element "${element}".`);
    const v = (k: "radius" | "ionization" | "affinity") => trendValue(el, k) ?? null;
    return ok({
        z: el.z,
        symbol: el.symbol,
        name: { es: el.es, en: el.en },
        mass: el.mass,
        category: el.category,
        group: el.group || null,
        period: el.period,
        block: el.block,
        electronegativity: el.electronegativity || null,
        radiusPm: v("radius"),
        ionizationEv: v("ionization"),
        affinityEv: v("affinity"),
        stableMassNumber: el.stableA || null,
        commonMassNumber: el.commonA,
        note: "null = there is no published value, or the property does not exist for that element. It is not 0.",
    });
});
server.tool("element_config", "Electron configuration of a neutral element, full and noble-gas abbreviated, with its shells and valence. Flags whether the element is one of the 20 real ANOMALIES (Cr, Cu, Nb, Ru, Pd...) \u2014 exactly where the Madelung rule fails and a language model tends to get the rule right and the element wrong.", { element: z.string().describe("Atomic number (\"24\") or symbol (\"Cr\")") }, async ({ element }) => {
    const el = elemento(element);
    if (!el)
        return err(`I cannot find the element "${element}".`);
    const st = S.econf.structure(el.z);
    return ok({
        z: el.z,
        symbol: el.symbol,
        config: st.config,
        configShort: st.configShort,
        anomalous: st.anomalous,
        madelungWouldPredict: st.madelungPrediction,
        valenceElectrons: st.valenceElectrons,
        valenceShell: st.valenceShellN,
        unpairedElectrons: st.unpaired,
        shells: st.shells.map(x => ({ n: x.n, electrons: x.electrons, capacity: x.capacity })),
        note: st.anomalous
            ? "ANOMALOUS: its configuration is NOT what the Madelung rule gives (madelungWouldPredict has that one). It is tabulated from measurements, not deduced from \"a half-filled shell is more stable\" \u2014 that rule is false and explains neither Nb nor Ru."
            : "Follows the Madelung (n+l) rule.",
    });
});
server.tool("element_ion_config", "Electron configuration of an ION. Electrons leave from the HIGHEST n shell, not from the last orbital that was filled: Fe2+ is [Ar]3d6, not [Ar]3d4 4s2. This is the classic mistake and the one seen most often in generated answers.", { element: z.string().describe("Atomic number or symbol"), charge: z.number().int().describe("Charge: +2 for Fe2+, -1 for Cl-") }, async ({ element, charge }) => {
    const el = elemento(element);
    if (!el)
        return err(`I cannot find the element "${element}".`);
    if (el.z - charge < 0)
        return err(`A ${el.symbol}${charge > 0 ? "+" : ""}${charge} would have a negative number of electrons.`);
    const st = S.econf.structure(el.z, charge);
    return ok({
        z: el.z,
        symbol: el.symbol,
        charge,
        electrons: st.electrons,
        config: st.config,
        configShort: st.configShort,
        valenceElectrons: st.valenceElectrons,
        unpairedElectrons: st.unpaired,
        note: "Ionizing removes the electrons with the highest n first (the outermost ones), not those of the last orbital filled by Madelung.",
    });
});
server.tool("hydrogen_spectrum", "Hydrogen spectral lines for a series (nLow=1 Lyman, 2 Balmer, 3 Paschen...). Gives the wavelength IN VACUUM and IN AIR, which are different numbers: H-alpha is 656.47 nm in vacuum and 656.28 in air, and confusing them is common. Uses the reduced-mass Rydberg constant (R_H), not R-infinity.", { nLow: z.number().int().min(1).max(10).describe("Landing level: 1=Lyman, 2=Balmer, 3=Paschen"), count: z.number().int().min(1).max(30).default(8) }, async ({ nLow, count }) => ok({
    series: nLow,
    seriesLimitNm: S.spec.seriesLimit(nLow),
    lines: S.spec.seriesLines(nLow, count).map(t => ({
        transition: `${t.nHigh} → ${t.nLow}`,
        energyEv: t.energy,
        wavelengthVacuumNm: t.wavelength,
        wavelengthAirNm: t.wavelengthAir,
        visible: t.wavelengthAir >= 380 && t.wavelengthAir <= 750,
    })),
    note: "Vacuum and air are NOT the same (refractive index 1.000277). Laboratory tables usually quote the air value.",
}));
server.tool("semiconductor_carriers", "Carrier concentrations in a doped semiconductor at a given temperature: n, p, band gap (Varshni), intrinsic concentration and Fermi level. The minority carrier is computed as ni^2/majority to avoid the catastrophic cancellation that destroys precision when subtracting nearly equal dopings.", {
    material: z.enum(["Si", "Ge", "GaAs"]).default("Si"),
    temperatureK: z.number().min(1).max(1000).default(300),
    donors: z.number().min(0).default(0).describe("Nd in cm^-3"),
    acceptors: z.number().min(0).default(0).describe("Na in cm^-3"),
}, async ({ material, temperatureK, donors, acceptors }) => {
    const mat = MATERIALS[material];
    const b = S.semi.bands(mat, temperatureK, donors, acceptors);
    return ok({
        material,
        temperatureK,
        bandGapEv: b.eg,
        intrinsicCm3: b.ni,
        electronsCm3: b.n,
        holesCm3: b.p,
        type: b.type,
        fermiMinusIntrinsicEv: b.efMinusEi,
        intrinsicAboveMidgapEv: (K_EV * temperatureK / 2) * Math.log(mat.nv300 / mat.nc300),
        conduction: S.semi.classify(b.eg),
        mobilityCm2Vs: { electrons: mat.muN, holes: mat.muP, ratio: mat.muN / mat.muP },
        note: "E_F is given relative to the INTRINSIC level E_i, not to the middle of the band gap: they are "
            + "not the same, and in GaAs they differ by ~38 meV (see `intrinsicAboveMidgapEv`). The mobility is that of "
            + "the BULK material at 300 K; in a transistor channel it is lower.",
    });
});
server.tool("bond_energy", "Energy curve between the two atoms of a measured diatomic molecule: bond length, well depth (De), REAL dissociation energy (D0) and zero-point energy. D0 is NOT De \u2014 the molecule is never at rest at the bottom of the well, not even at 0 K, and in H2 the difference is 0.27 eV. Covalent bonds use Morse, noble gases use Lennard-Jones.", { molecule: z.string().describe("H2, N2, O2, F2, Cl2, HF, HCl, Li2, Na2, He2, Ne2, Ar2, Kr2, Xe2"), temperatureK: z.number().min(1).max(5000).default(300) }, async ({ molecule, temperatureK }) => {
    const spec = S.bond.find(molecule) ?? S.bond.find(molecule.replace(/[₀-₉]/g, d => String("\u2080\u2081\u2082\u2083\u2084\u2085\u2086\u2087\u2088\u2089".indexOf(d))));
    if (!spec)
        return err(`I have no measured data for "${molecule}". Available: ${S.bond.list().map(d => d.id).join(", ")}.`);
    const c = S.bond.curve(spec, { tempK: temperatureK });
    return ok({
        molecule: spec.formula,
        bondType: spec.bond,
        model: spec.model,
        bondLengthPm: c.rMin,
        wellDepthEv: -c.vMin,
        dissociationEnergyEv: c.d0,
        zeroPointEnergyEv: c.zeroPoint,
        maxAttractionAtPm: c.rMaxForce,
        vibrationalLevels: c.levels.length,
        thermalEnergyEv: c.kT,
        wellOverKT: c.wellOverKT,
        note: spec.bond === "vdw"
            ? "Van der Waals: a well hundreds of times shallower than a covalent bond. Lennard-Jones carries no measured vibration, which is why there is no D0 and no levels."
            : "D0 = De minus the zero-point energy. Tables of \"bond energy\" quote D0, not De.",
    });
});
server.tool("band_formation", "A tight-binding chain of N atoms: the N levels it produces, the bandwidth, and the spacing between levels. Shows where a band COMES FROM \u2014 with 2 atoms the level splits in two (alpha +/- beta), and with many the spacing falls as 1/N until it drops below k_B*T, which is when talking about individual levels stops making sense.", {
    atoms: z.number().int().min(1).max(400).default(10),
    alpha: z.number().default(-5).describe("Energy of the isolated atomic orbital (eV)"),
    beta: z.number().default(-1).describe("Integral de salto \u03B2 (eV, negativa)"),
    electronsPerAtom: z.number().min(0).max(2).default(1),
}, async ({ atoms, alpha, beta, electronsPerAtom }) => {
    const r = S.band.analyze({ atoms, alpha, beta, electronsPerAtom });
    return ok({
        atoms,
        levels: r.levels.length,
        bandWidthEv: r.width,
        meanLevelGapEv: r.meanGap,
        minLevelGapEv: r.minGap,
        widthLimitEv: 4 * Math.abs(beta),
        fermiEv: r.fermi,
        filling: r.filling,
        conduction: r.conduction,
        gapVsThermalAt300K: r.meanGap / 0.025852,
        energies: r.levels.length <= 40 ? r.levels.map(l => l.e) : undefined,
        note: "This is a ONE-band model: with 2 electrons per atom it says \"insulator\", yet magnesium (which contributes 2) is a metal, because in reality the s and p bands overlap.",
    });
});
server.tool("coulomb_blockade", "Single-electron transistor: charging energy E_C, whether Coulomb blockade occurs, and why it does not when it fails. Checks BOTH conditions \u2014 E_C >> k_B*T and tunnel barriers above the resistance quantum R_K = h/e^2 ~ 25.8 kOhm. The second is almost never mentioned, and without it a design with perfect energy still does not blockade.", {
    radiusNm: z.number().min(0.1).max(1000).default(2),
    epsR: z.number().min(1).max(100).default(1).describe("Permittivity of the surroundings: 1 vacuum, 3.9 SiO2, 11.7 Si"),
    temperatureK: z.number().min(0.01).max(1000).default(300),
    tunnelKOhm: z.number().min(0).default(100).describe("Resistance of each tunnel barrier"),
    gateFraction: z.number().min(0.02).max(0.9).default(0.3),
}, async ({ radiusNm, epsR, temperatureK, tunnelKOhm, gateFraction }) => {
    const r = S.set.analyze({ radiusNm, epsR, tempK: temperatureK, tunnelKOhm, gateFraction });
    return ok({
        radiusNm,
        temperatureK,
        epsR,
        chargingEnergyEv: r.charging,
        thermalEv: r.kT,
        ratio: r.ratio,
        blockade: r.blockade === "ok",
        blockedBy: r.blockade === "ok" ? null : r.blockade,
        tunnelOverQuantum: r.tunnelOverQuantum,
        resistanceQuantumOhm: R_QUANTUM,
        gatePeriodV: r.gatePeriod,
        maxRadiusNmAtThisT: r.maxRadiusNm,
        atomsInIsland: S.set.atomCount(radiusNm),
        note: "At 300 K, blockade forces an island of \u22642.8 nm radius in vacuum. That number comes from e, \u03B5\u2080 and k_B; nobody picks it.",
    });
});
server.tool("gate_geometry", "Why the transistor changed shape: natural length lambda and minimum gate length (5*lambda) for each architecture \u2014 planar, FD-SOI, FinFET, GAA nanosheet, nanowire, forksheet and CFET \u2014 at the SAME dimensions, which is what isolates the effect of geometry alone. It does not tabulate real process-node dimensions, because those are not public.", {
    bodyNm: z.number().min(0.1).max(100).default(6).describe("Channel thickness (fin width or sheet thickness)"),
    oxideNm: z.number().min(0.1).max(20).default(1).describe("EOT"),
    gateLengthNm: z.number().min(0.1).max(500).default(20),
    temperatureK: z.number().min(1).max(1000).default(300),
}, async ({ bodyNm, oxideNm, gateLengthNm, temperatureK }) => {
    const r = S.gate.analyze({ bodyNm, oxideNm, gateLenNm: gateLengthNm, tempK: temperatureK });
    return ok({
        bodyNm,
        oxideNm,
        gateLengthNm,
        subthresholdLimitMvDec: r.ssLimit,
        best: r.best ? r.best.arch.id : null,
        architectures: r.archs.map(a => ({
            id: a.arch.id,
            gates: a.arch.gates,
            status: a.arch.status,
            year: a.arch.year,
            makers: a.arch.makers,
            lambdaNm: a.lambda,
            minGateLengthNm: a.minGateLenNm,
            marginLambdas: a.margin,
            holds: a.ok,
            bodyFeasible: a.bodyFeasible,
            comparable: !a.arch.cylindrical,
        })),
        note: "The \u03BB of the cylindrical wire comes from a different formula (Auth & Plummer) and is NOT comparable with the planar ones: it is always larger for a mathematical reason, not a physical one. That is why it is marked comparable:false and left out of the ranking.",
    });
});
const COMPONENTE_QUIMICA = z.object({
    substance: z.string().min(1).max(60).describe("A table id (\"acetico\", \"fosforico\"), the formula of one of its forms as sold (\"NaH2PO4\", \"NH4Cl\", \"NH3\") or a strong one (\"HCl\", \"NaOH\", \"AgNO3\")"),
    concentration: z.number().positive().max(20).describe("mol/L"),
});
const CONSTANTES_NOTA = "Every constant comes with the paper or critical compilation it was taken from.";
server.tool("chem_ph", "Exact pH of a mixture of acids, bases and salts by charge and mass balance \u2014 no \"x is negligible\", no \"only the first dissociation\" \u2014 with the speciation of each weak system and the textbook formula next to it, with its validity rule and how wrong it is here. " + CONSTANTES_NOTA + " Ideal solution at 25 \u00B0C. Give listSubstances: true (and no components) to get what it knows.", {
    components: z.array(COMPONENTE_QUIMICA).max(12).default([]).describe("What is in the beaker; empty = pure water"),
    listSubstances: z.boolean().optional(),
}, async ({ components, listSubstances }) => {
    const c = await quimicaMod();
    if ("error" in c)
        return c.error;
    if (listSubstances)
        return ok(c.m.aceptadas());
    const r = c.m.chemPh({ components });
    return "error" in r ? err(r.error as string) : ok(r);
});
server.tool("chem_titration", "Titration of what is in the beaker with a titrant from the burette: every equivalence point (volume and pH), the indicators ranked by titration error for each, and the curve. Polyprotic acids, mixtures and weak/weak included, computed exactly. " + CONSTANTES_NOTA, {
    analyte: z.array(COMPONENTE_QUIMICA).min(1).max(12),
    analyteVolumeMl: z.number().positive().max(10000),
    titrant: COMPONENTE_QUIMICA,
    maxVolumeMl: z.number().positive().max(10000).describe("How far to titrate"),
    points: z.number().int().min(2).max(400).optional().describe("Points of the returned curve (default 41)"),
}, async (input) => {
    const c = await quimicaMod();
    if ("error" in c)
        return c.error;
    const r = c.m.chemTitration(input);
    return "error" in r ? err(r.error as string) : ok(r);
});
server.tool("chem_solubility", "Does a sparingly soluble salt precipitate in this solution (Q vs Ksp), and if it does \u2014 or if you add the solid in excess \u2014 the equilibrium: how much dissolves or precipitates and the final pH, with the basicity of the anion and the common ion taken into account; next to it the textbook formula, which ignores the pH (the CaCO\u2083 lesson). " + CONSTANTES_NOTA, {
    salt: z.string().min(1).max(30).describe("Table id or formula: \"agcl\", \"CaCO3\", \"Mg(OH)2\"\u2026"),
    components: z.array(COMPONENTE_QUIMICA).max(12).default([]).describe("What is already in the beaker; empty = pure water"),
    solidInExcess: z.boolean().default(false).describe("Add the solid salt in excess (saturate) instead of only checking whether it precipitates"),
}, async (input) => {
    const c = await quimicaMod();
    if ("error" in c)
        return c.error;
    const r = c.m.chemSolubility(input);
    return "error" in r ? err(r.error as string) : ok(r);
});
server.tool("sram_noise_margin", "Static noise margin (SNM) of a 6T SRAM cell by the butterfly method: two cross-coupled transfer curves and the side of the largest inscribed square. Returns the margin per mode (hold/read/write), the per-lobe split (which side would flip) and, optionally, the margin expressed in sigmas and the array failure probability. NOT the diagonal shortcut, which returns twice the correct value. First-order Shichman-Hodges: no body effect, no process variation, no parasitics \u2014 it shows why the margin moves, it is not a silicon signature.", {
    mode: z.enum(["hold", "read", "write"]).default("read")
        .describe("read opens the word line with both bit lines precharged (read disturb); in write, 0 is the correct result"),
    vdd: z.number().min(0.1).max(5).default(1).describe("Supply voltage (V)"),
    cellRatio: z.number().min(0.05).max(20).default(2).describe("Pull-down / access width ratio. Rules read stability"),
    pullUpRatio: z.number().min(0.05).max(20).default(1.8).describe("Pull-up / access width ratio. Too high and the cell refuses to be written"),
    vth: z.number().min(0.01).max(2).default(0.3).describe("Threshold voltage, same for nMOS and pMOS (V)"),
    lambda: z.number().min(0).max(1).default(0.05).describe("Channel-length modulation (1/V)"),
    sigmaMv: z.number().min(0).max(500).optional().describe("Cell-to-cell spread of the margin (mV), to express the SNM in sigmas"),
    cells: z.number().min(1).max(1000000000000).optional().describe("Array size, with sigmaMv, for the probability that at least one cell fails"),
}, async ({ mode, vdd, cellRatio, pullUpRatio, vth, lambda, sigmaMv, cells }) => {
    const p = { vdd, cellRatio, pullUpRatio, kAccess: 0.0001, vthN: vth, vthP: vth, lambda };
    const b = S.sram.mariposa(mode as SramMode, p);
    if (!b)
        return ok({ error: "Physically meaningless parameters (all must be positive)." });
    const hold = S.sram.mariposa("hold", p);
    const est = sigmaMv !== undefined && cells !== undefined
        ? S.sram.estabilidad(b.snm, sigmaMv, cells) : null;
    return ok({
        mode,
        snmMv: b.snm * 1000,
        bistable: b.biestable,
        lobesMv: [b.snmLobulo1 * 1000, b.snmLobulo2 * 1000],
        snmHoldMv: hold ? hold.snm * 1000 : null,
        readDisturbLossPct: hold && hold.snm > 0 ? (1 - b.snm / hold.snm) * 100 : null,
        theoreticalCapMv: (vdd / 2) * 1000,
        stability: est && { sigmas: est.sigmas, pCellFails: est.pCelda, pArrayFails: est.pArray, cells: est.celdas },
        note: "A symmetric cell cannot exceed Vdd/2: that is the ideal-inverter bound. The sigma layer assumes normality and independence between cells \u2014 an illustration, not a foundry Monte-Carlo.",
    });
});
server.tool("sram_read_path", "SRAM read timing from dV = I*t/C: bit-line capacitance, signal needed, and how long before a 1 can be told from a 0. The signal needed is the amplifier sensitivity PLUS several sigmas of its offset, which usually dominates. Also returns the time for 1/2/4/8 banks. First-order: constant cell current, capacitance linear in cell count, no line resistance or column coupling. The reads-per-second figure is signal development only \u2014 a real read adds precharge, decoding and amplification.", {
    cellsPerColumn: z.number().min(1).max(8192).default(256).describe("Cells hanging off each bit line: this sets the capacitance"),
    cPerCellFf: z.number().min(0.01).max(50).default(1).describe("Capacitance each cell adds (fF)"),
    cellCurrentUa: z.number().min(0.1).max(2000).default(30).describe("Current with which the cell discharges the line"),
    sensitivityMv: z.number().min(0.1).max(500).default(50).describe("Smallest difference the amplifier resolves nominally"),
    offsetSigmaMv: z.number().min(0).max(200).default(10).describe("Amplifier offset, one sigma"),
    sigmas: z.number().min(0).max(12).default(6).describe("Sigmas of offset demanded as margin"),
    banks: z.number().int().min(1).max(64).default(1).describe("How many banks the column is split into"),
}, async ({ cellsPerColumn, cPerCellFf, cellCurrentUa, sensitivityMv, offsetSigmaMv, sigmas, banks }) => {
    const r = S.lectura.calcular({
        celdasPorColumna: cellsPerColumn,
        cPorCeldaFf: cPerCellFf,
        iCeldaUa: cellCurrentUa,
        sensibilidadMv: sensitivityMv,
        offsetSigmaMv,
        sigmas,
        bancos: banks,
    });
    if (!r)
        return ok({ error: "Physically meaningless parameters (zero current would mean infinite time)." });
    return ok({
        bitlineCapFf: r.cBitlineFf,
        signalNeededMv: r.deltaVRequeridoMv,
        offsetMarginMv: r.margenPorOffsetMv,
        timeNs: r.tiempoNs,
        readsPerSecondUpperBound: r.lecturasPorSegundo,
        byBanks: r.porBancos.map(b => ({ banks: b.bancos, timeNs: b.tiempoNs })),
        note: "Compare offsetMarginMv against sensitivityMv: at 6 sigma it is usually larger, so ignoring offset would halve the time. Splitting into banks divides the time and is paid for in area, since each bank needs its own amplifiers.",
    });
});
server.tool("ir_drop", "IR drop across a power delivery grid: worst and mean voltage lost, and where the worst is. Solves the 2D resistive network (GV=I) with sparse conjugate gradient. Use it to compare frontside delivery (entry points further apart) against backside (spread out, lower-resistance metal) at the SAME load, which is the only comparison that means anything. First-order: uniform single-layer mesh, static and equal load per region, no inductive coupling, no switching. Real designs are signed off at 0.5-2.5 % of Vdd.", {
    n: z.number().int().min(2).max(120).default(25).describe("Mesh side: n x n nodes. Each node is a REGION of the block, not one cell"),
    segmentOhm: z.number().min(0.000001).max(1000).default(0.2).describe("Metal resistance between two neighbouring nodes"),
    nodeCurrentMa: z.number().min(0).max(1000).default(2).describe("Load of each region"),
    vdd: z.number().min(0.1).max(5).default(1),
    sources: z.enum(["edge", "grid"]).default("grid")
        .describe("edge = current enters only around the perimeter; grid = entry points every `sourcePitch` nodes"),
    sourcePitch: z.number().int().min(1).max(60).default(4).describe("Spacing between entry points in grid mode. The lever that matters most"),
}, async ({ n, segmentOhm, nodeCurrentMa, vdd, sources, sourcePitch }) => {
    const r = S.malla.resolver({
        n,
        rSeg: segmentOhm,
        iCelda: nodeCurrentMa * 0.001,
        vdd,
        fuentes: sources === "edge" ? "borde" : "rejilla",
        pasoRejilla: sourcePitch,
    });
    if (!r)
        return ok({ error: "Impossible parameters, or a mesh with no entry point at all (it would float)." });
    return ok({
        worstDropMv: r.caidaMax * 1000,
        meanDropMv: r.caidaMedia * 1000,
        percentOfVdd: r.porcentajeMax,
        worstAt: { row: r.peor.fila, col: r.peor.col },
        entryPoints: r.nFuentes,
        totalCurrentMa: r.corrienteTotal * 1000,
        converged: r.convergio,
        iterations: r.iteraciones,
        relativeResidual: r.residuo,
        note: "The drop is LINEAR in current and resistance and grows fast with distance to the nearest entry point, so spreading entries wins more than thickening metal. Real designs are signed off at 0.5-2.5 % of Vdd. If converged is false the iteration cap was hit and the number is approximate.",
    });
});
server.tool("standard_cell", "Standard-cell geometry from its height in TRACKS: height, area, tracks left free for routing, fins per transistor, density and power-rail resistance \u2014 plus what you gain and lose against another height. The rail resistance it returns is what ir_drop consumes. Warns when the height does not land on the routing grid, which misaligns pins when alternate rows are flipped to share a rail. Idealised geometry: no real design rules, no vias, no parasitic extraction.", {
    tracks: z.number().min(4).max(16).default(9).describe("Height in routing tracks. Real libraries run ~6 to ~12; half tracks (7.5T) are legitimate"),
    pitchNm: z.number().min(1).max(500).default(40).describe("Routing-layer pitch: what one track is worth"),
    railTracks: z.number().min(0).max(8).default(1).describe("Tracks consumed by BOTH rails together (VDD and VSS)"),
    cppNm: z.number().min(1).max(500).default(50).describe("Contacted poly pitch"),
    widthCpp: z.number().min(1).max(64).default(2).describe("Cell width in CPP: an inverter is 2, a NAND2 is 3"),
    finPitchNm: z.number().min(1).max(200).default(27),
    rSheetOhmSq: z.number().min(0.000001).max(1000).default(0.6).describe("Sheet resistance of the rail metal (ohm/square)"),
    compareWithTracks: z.number().min(4).max(16).optional().describe("Compare against a cell of that height and return what is gained and lost"),
}, async ({ tracks, pitchNm, railTracks, cppNm, widthCpp, finPitchNm, rSheetOhmSq, compareWithTracks }) => {
    const p = { tracks, pitchNm, railTracks, cppNm, anchoCpp: widthCpp, finPitchNm, rSheetOhmSq };
    const c = S.celda.calcular(p);
    if (!c)
        return ok({ error: "Impossible geometry (check the rails do not exceed the height)." });
    const cmp = compareWithTracks !== undefined ? S.celda.comparar({ ...p, tracks: compareWithTracks }, p) : null;
    return ok({
        heightNm: c.alturaNm,
        widthNm: c.anchoNm,
        areaNm2: c.areaNm2,
        freeRoutingTracks: c.tracksRuteo,
        railWidthNm: c.anchoRailNm,
        finsPerTransistor: c.finsPorTransistor,
        cellsPerMm2: c.celdasPorMm2,
        railResistanceOhm: c.resistenciaRailOhm,
        warnings: c.avisos,
        comparison: cmp && {
            againstTracks: compareWithTracks,
            areaSavedPct: cmp.area,
            finsGained: cmp.fins,
            railResistanceAddedPct: cmp.rail,
        },
        note: "The warnings are not cosmetic: altura-no-multiplo means the library does not tile properly, and sin-carriles-de-ruteo means the cell cannot be wired internally. railResistanceOhm is the bridge to ir_drop: shrinking the cell narrows the rail and raises the droop.",
    });
});
server.tool("timing_path", "Synchronous path analysis: setup and hold slack, and maximum frequency. The clock period appears ONLY in the setup check, so a setup failure is fixed by lowering the frequency and a hold failure is not \u2014 no speed makes it work. Skew enters both with opposite signs. With irDropV+vdd+vth it also derates the logic by voltage (alpha-power law), connecting power delivery to the clock. First-order: ONE path, delays as numbers, no process variation, no jitter, no temperature derating.", {
    tclkNs: z.number().min(0.01).max(1000).default(2).describe("Clock period"),
    tcqNs: z.number().min(0).max(100).default(0.1).describe("Launch flop delay, edge to output"),
    tlogicNs: z.number().min(0).max(500).default(1.2).describe("Logic, LONG path. Rules setup"),
    tlogicMinNs: z.number().min(0).max(500).default(0.2).describe("Logic, SHORT path. Rules hold"),
    tsetupNs: z.number().min(0).max(100).default(0.08),
    tholdNs: z.number().min(0).max(100).default(0.05),
    tskewNs: z.number().min(-100).max(100).default(0).describe("Positive = the clock reaches the capturing flop LATER: gives setup, takes hold"),
    irDropV: z.number().min(0).max(5).optional().describe("With vdd and vth: slows the logic down by that voltage drop"),
    vdd: z.number().min(0.05).max(5).optional(),
    vth: z.number().min(0.01).max(3).optional(),
}, async (a) => {
    let tlogic = a.tlogicNs, factor: number | null = null;
    if (a.irDropV !== undefined && a.vdd !== undefined && a.vth !== undefined) {
        factor = factorPorCaida(a.vdd, a.irDropV, a.vth);
        if (factor === null) {
            return ok({ error: "That drop leaves no useful overdrive above threshold: the gate goes subthreshold and the alpha-power law stops describing anything. No factor is given because it would be meaningless." });
        }
        tlogic = a.tlogicNs * factor;
    }
    const r = S.timing.analizar({
        tclkNs: a.tclkNs,
        tcqNs: a.tcqNs,
        tlogicNs: tlogic,
        tlogicMinNs: Math.min(a.tlogicMinNs, tlogic),
        tsetupNs: a.tsetupNs,
        tholdNs: a.tholdNs,
        tskewNs: a.tskewNs,
    });
    if (!r)
        return ok({ error: "Meaningless parameters (is the short path longer than the long one?)." });
    return ok({
        setupSlackNs: r.slackSetupNs,
        holdSlackNs: r.slackHoldNs,
        setupMet: r.cumpleSetup,
        holdMet: r.cumpleHold,
        fmaxMhz: Number.isFinite(r.fmaxMhz) ? r.fmaxMhz : null,
        currentMhz: r.fActualMhz,
        pathNs: r.caminoNs,
        segmentsNs: r.tramos.map(t => ({ part: t.clave, ns: t.ns })),
        voltageDerating: factor === null ? null : { factor, effectiveLogicNs: tlogic },
        note: "If holdMet is false, lowering the frequency does NOT fix it: the period is not in that equation. Add delay to the short path or fix the clock. fmaxMhz null means that with this skew the path has stopped being the limiting one, not that it is infinitely fast.",
    });
});
server.tool("make_log_diff", "Compare the output of a REAL `make` run with what the simulation predicted, matching each command in the log to the Makefile rule that produced it. **What makes this useful, rather than any log analyzer, is the diff:** if make rebuilt something the simulation considered cached, that is the signature of an UNDECLARED DEPENDENCY \u2014 it raises no error, it just makes the build slower than it should be, or occasionally fails to rebuild what it should. Line-to-rule matching is APPROXIMATE and each match carries its confidence: recipes are echoed after variable expansion, a leading `@` suppresses them entirely, implicit rules produce commands that are not in the file, and with `-j` the output interleaves. make emits no timestamps, so nothing is said about how long anything took.", {
    log: z.string().optional().describe("make's output, pasted"),
    logFile: z.string().optional().describe("Path to a file with make's output"),
    project: z.string().optional().describe("Project folder: its Makefile and real mtimes are read"),
    makefile: z.string().optional().describe("The Makefile pasted, if no folder is given"),
    targets: z.array(z.string()).optional().describe("What was asked to be built, if known"),
}, async (a) => {
    let log = a.log;
    if (!log && a.logFile) {
        const t = await leerTexto(a.logFile);
        if (t === null)
            return err(`Could not read "${a.logFile}".`);
        log = t;
    }
    if (!log)
        return err("Either `log` or `logFile` is required.");
    const ctx = await contexto({ text: a.makefile, project: a.project }, "Makefile");
    if ("error" in ctx)
        return err(ctx.error!);
    const r = analizarLogDeMake(log, { makefile: ctx.texto!, ficheros: ctx.ficheros!, objetivos: a.targets });
    return ok({
        summary: {
            lines: r.lineasLog,
            events: r.eventos,
            errors: r.errores.length,
            warnings: r.avisos,
            commandsAttributed: r.ordenes.filter(o => o.objetivo).length,
            unattributed: r.sinAtribuir,
        },
        rebuiltUnexpectedly: r.diff.inesperados.length ? {
            targets: r.diff.inesperados,
            whatItMeans: "make rebuilt these and the simulation considered them cached. Either a dependency is not declared, or something touched those files from outside.",
        } : null,
        expectedButNotSeen: r.diff.noVistos.length ? {
            targets: r.diff.noVistos,
            whatItMeans: "The simulation expected to rebuild these and they do not appear in the log: it may be a different target, a different project state, or a recipe silenced with `@`.",
        } : null,
        errors: r.errores.map(e => ({
            logLine: e.lineaLog,
            text: e.texto,
            target: e.objetivo,
            makefileLine: e.lineaRegla,
        })),
        commands: r.ordenes.filter(o => o.objetivo).map(o => ({
            command: o.comando,
            target: o.objetivo,
            makefileLine: o.lineaRegla,
            confidence: o.confianza,
        })),
        mostRepeated: r.patrones,
        subMakes: r.subMakes.length ? r.subMakes : undefined,
        looksParallel: r.pareceParalelo || undefined,
        timings: r.tiempos.hayFechas
            ? "The log has timestamps: it can be ordered in time."
            : "This log has no timestamps, so it is NOT possible to say how long anything took. make does not emit them: to get them, pipe the output through `ts` (moreutils) or use `--output-sync` with markers.",
    });
});
server.tool("test_cases", "From a TYPE to the cases worth testing, with no model involved: equivalence partitions and boundary values derived from a TypeScript signature or a JSON Schema. For each parameter it returns the TECHNIQUE that applies and why \u2014 boundary values only mean something where there is an ordering, so they are NOT applied to a boolean or an enum. It adds the properties that can be asserted without knowing the domain, plus a fast-check test ready to paste. Use it BEFORE writing the tests, so you do not miss the cases everyone misses.", {
    signature: z.string().optional().describe("TypeScript signature, e.g. function calculate(price: number, kind: 'A' | 'B'): number"),
    schema: z.string().optional().describe("JSON Schema (an object with `properties`). Alternative to `signature`."),
    name: z.string().optional().describe("Function name for the generated code. Inferred from the signature if you pass one."),
}, async (a) => {
    let params: Parametro[];
    let nombre = a.name ?? "myFunction";
    if (a.schema) {
        try {
            params = T.casos.desdeJsonSchema(JSON.parse(a.schema));
        }
        catch (e: any) {
            return err(`The schema is not valid JSON: ${String(e?.message ?? e)}`);
        }
        if (!params.length)
            return err("The schema declares no `properties`, so there are no parameters to derive cases from.");
    }
    else if (a.signature) {
        await motorTests();
        const firmas = await T.parse.extraerFirmas(a.signature, "typescript");
        if (!firmas.length)
            return err("I found no function in `signature`. It must be a complete TypeScript declaration.");
        params = firmas[0].parametros;
        nombre = a.name ?? firmas[0].nombre;
    }
    else {
        return err("Either `signature` or `schema` is required.");
    }
    const plan = T.casos.planificar(params);
    return ok({
        function: nombre,
        totalCases: plan.total,
        hypothesis: "Single fault: ONE parameter is varied per case and the rest are left at a typical value. "
            + "The cartesian product explodes (5 parameters x 6 cases = 7,776) and nobody writes that. "
            + "If you suspect an interaction between two specific parameters, design that case by hand.",
        parameters: plan.parametros.map(p => ({
            parameter: p.parametro,
            type: p.tipo,
            technique: p.tecnica,
            whyThatTechnique: textoTecnicaEn(p.tecnicaKind),
            cases: p.casos.map(c => ({ value: c.valor, why: textoCasoEn(c.kind), invalid: c.invalido || undefined })),
        })),
        ifYouOnlyWriteFive: T.casos.prioritarios(plan, 5).map(c => ({
            parameter: c.parametro,
            value: c.valor,
            why: textoCasoEn(c.kind),
            invalid: c.invalido || undefined,
        })),
        properties: plan.propiedades.map(p => ({ name: p.nombre, ...textoPropiedadEn(p) })),
        propertyTest: T.casos.codigoPropiedades(nombre, params, plan.propiedades),
        warnings: plan.avisos.length ? plan.avisos.map(textoAvisoEn) : undefined,
    });
});
async function fechasPorLinea(carpeta: string, fichero: string): Promise<Map<number, number>> {
    const { execFile } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const ejecutar = promisify(execFile);
    const out = new Map<number, number>();
    try {
        const { stdout } = await ejecutar("git", ["blame", "--line-porcelain", "--", fichero], { cwd: carpeta, maxBuffer: 32 * 1024 * 1024 });
        let linea = 0;
        for (const l of stdout.split("\n")) {
            const cab = l.match(/^[0-9a-f]{40} \d+ (\d+)/);
            if (cab) {
                linea = Number(cab[1]);
                continue;
            }
            const t = l.match(/^author-time (\d+)/);
            if (t && linea)
                out.set(linea, Number(t[1]) * 1000);
        }
    }
    catch {
    }
    return out;
}
server.tool("test_debt", "A project's DISABLED-test debt, WITH ITS AGE. Walks the folder, finds every `it.skip`, `xit`, `@Ignore`, `@pytest.mark.skip` or `t.Skip`, and dates it with `git blame`. None of those cases appears in a coverage report, because as far as the runner is concerned they do not exist: this is the debt nobody measures and the one that lasts longest \u2014 disabled 'to fix later', and later never comes. Sorted oldest first, which is what makes it actionable.", {
    folder: z.string().describe("Root of the project (or subtree) to review."),
    maxFiles: z.number().int().min(1).max(5000).default(1500).describe("Cap on how many test files to read."),
}, async (a) => {
    const { readdir, readFile, stat } = await import("node:fs/promises");
    const { join, relative } = await import("node:path");
    const ficheros: string[] = [];
    const recorrer = async (dir: string): Promise<void> => {
        if (ficheros.length >= a.maxFiles)
            return;
        let entradas;
        try {
            entradas = await readdir(dir, { withFileTypes: true });
        }
        catch {
            return;
        }
        for (const e of entradas) {
            if (ficheros.length >= a.maxFiles)
                return;
            const p = join(dir, e.name);
            if (e.isDirectory()) {
                if (T.proy.carpetaExcluida(e.name))
                    continue;
                await recorrer(p);
            }
            else if (T.proy.esFicheroDeTest(relative(a.folder, p))) {
                ficheros.push(p);
            }
        }
    };
    try {
        await stat(a.folder);
    }
    catch (e) {
        return err(noSeLee(a.folder, e));
    }
    await recorrer(a.folder);
    if (!ficheros.length)
        return err("No test files found in that folder (conventions: .spec/.test, test_*.py, *_test.go, *Test.java).");
    await motorTests();
    const ahora = Date.now();
    const deuda: any[] = [];
    let casos = 0;
    let conFecha = 0;
    for (const f of ficheros) {
        const rel = relative(a.folder, f);
        const lenguaje = T.proy.lenguajeDe(rel);
        if (!lenguaje)
            continue;
        let suite;
        try {
            suite = await T.parse.analizar(await readFile(f, "utf8"), lenguaje);
        }
        catch {
            continue;
        }
        casos += suite.casos.length;
        const apagados = suite.casos.filter(c => c.inactivo);
        if (!apagados.length)
            continue;
        const fechas = await fechasPorLinea(a.folder, rel);
        for (const c of apagados) {
            const ms = fechas.get(c.linea);
            if (ms)
                conFecha++;
            deuda.push({
                file: rel,
                case: c.nombre,
                line: c.linea,
                marker: c.marcadorInactivo ?? c.inactivo,
                assertionsTurnedOff: c.aserciones.length,
                daysDisabled: ms ? Math.floor((ahora - ms) / 86400000) : null,
                since: ms ? new Date(ms).toISOString().slice(0, 10) : null,
            });
        }
    }
    deuda.sort((x, y) => (y.daysDisabled ?? -1) - (x.daysDisabled ?? -1));
    const conEdad = deuda.filter(d => d.daysDisabled !== null);
    return ok({
        filesReviewed: ficheros.length,
        cases: casos,
        disabled: deuda.length,
        assertionsTurnedOff: deuda.reduce((n, d) => n + d.assertionsTurnedOff, 0),
        oldestDays: conEdad.length ? conEdad[0].daysDisabled : null,
        medianDays: conEdad.length ? conEdad[Math.floor(conEdad.length / 2)].daysDisabled : null,
        withoutDate: deuda.length - conFecha,
        debt: deuda,
        note: conFecha === 0 && deuda.length
            ? "No dates: the folder does not look like a git repository, or the files are untracked. The debt is the same, but nothing can be said about how long it has been there."
            : "None of these cases appears in your coverage report: as far as the runner is concerned they do not exist.",
    });
});
function leerColeccion(texto: string): {
    ok: true;
    coleccion: ApiColeccion;
    formato: string;
    avisos: string[];
} | {
    ok: false;
    error: string;
} {
    const t = texto.trim();
    if (!t)
        return { ok: false, error: "Empty input" };
    let json: unknown = null;
    try {
        json = JSON.parse(t);
    }
    catch { }
    const intento = json && esPostman(json) ? { f: "postman", r: leerPostman(t) }
        : json && esInsomnia(json) ? { f: "insomnia", r: leerInsomnia(t) }
            : json && esHar(json) ? { f: "har", r: leerHar(t) }
                : json && esOpenApi(json) ? { f: "openapi", r: leerOpenApi(t) }
                    : esBru(t) ? { f: "bruno", r: unBruSuelto(t) }
                        : /^\s*(openapi|swagger)\s*:/m.test(t) ? { f: "openapi", r: leerOpenApi(t) }
                            : { f: "curl", r: leerCurl(t) };
    if (!intento.r.ok)
        return { ok: false, error: intento.r.error };
    return { ok: true, coleccion: intento.r.coleccion, formato: intento.f, avisos: intento.r.avisos };
}
function unBruSuelto(t: string) {
    const p = leerBru(t);
    return p
        ? { ok: true as const, avisos: [], coleccion: { nombre: p.nombre, variables: [], peticiones: [p] } }
        : leerColeccionBru([{ ruta: "pegado.bru", contenido: t }]);
}
server.tool("api_collection_convert", "Convert an API collection between formats, entirely offline. Reads Postman v2.1, Insomnia, Bruno .bru, OpenAPI 3.x / Swagger 2.0 (JSON or YAML), a browser HAR, or curl commands - the format is detected. Writes Postman, Bruno (as a file tree) or curl. Reports what cannot be translated (Postman/Bruno scripts, file fields, Insomnia templates) instead of dropping it silently.", {
    input: z.string().describe("The collection, specification or curl commands, as text"),
    to: z.enum(["postman", "bruno", "curl"]).default("bruno").describe("Output format"),
}, async ({ input, to }) => {
    const r = leerColeccion(input);
    if (!r.ok)
        return err(r.error);
    const salida = to === "postman" ? { file: `${r.coleccion.nombre}.postman_collection.json`, content: escribirPostman(r.coleccion) }
        : to === "curl" ? { file: `${r.coleccion.nombre}.sh`, content: r.coleccion.peticiones.map((p) => escribirCurl(p)).join("\n\n") }
            : { files: escribirColeccionBru(r.coleccion).map((f) => ({ path: f.ruta, content: f.contenido })) };
    return ok({
        detectedFormat: r.formato,
        requests: r.coleccion.peticiones.length,
        variables: r.coleccion.variables.length,
        warnings: r.avisos,
        ...salida,
    });
});
server.tool("api_collection_secrets", "List the credentials hidden inside an API collection before you share it: tokens, cookies, API keys and passwords, with their location and a MASKED sample. An exported collection carries its secrets with it, and this is the file people attach to tickets. Heuristic by name: it masks what it recognises, it never claims a file is clean.", { input: z.string().describe("The collection, specification or curl commands, as text") }, async ({ input }) => {
    const r = leerColeccion(input);
    if (!r.ok)
        return err(r.error);
    const h = buscarSecretos(r.coleccion);
    return ok({
        detectedFormat: r.formato,
        found: h.length,
        findings: secretosEn(h),
        note: "Heuristic by header/variable name. A secret with an unusual name will not show up here.",
    });
});
server.tool("api_code_generate", "Turn a request into pasteable code in one of eleven targets: curl, fetch, axios, Python requests, HTTPie, Go, Java, C#, PHP, PowerShell or Rust. Emits the import lines and escapes per language, and gets right the things that are habitually wrong (in C# the Content-Type belongs to the content, not the headers; in Go an unused import does not compile).", {
    input: z.string().describe("A curl command, or any supported collection (the first request is used)"),
    language: z.enum(LENGUAJES.map((l) => l.id) as [
        LenguajeApi,
        ...LenguajeApi[]
    ]).default("curl"),
    index: z.number().int().min(0).default(0).describe("Which request, if the input has several"),
}, async ({ input, language, index }) => {
    const r = leerColeccion(input);
    if (!r.ok)
        return err(r.error);
    const p = r.coleccion.peticiones[index];
    if (!p)
        return err(`No request at index ${index} (there are ${r.coleccion.peticiones.length})`);
    return ok({
        request: `${p.metodo} ${p.url}`,
        language,
        code: generar(p, language),
        requestsAvailable: r.coleccion.peticiones.length,
    });
});
server.tool("api_breaking_changes", "Compare two OpenAPI specifications and say which changes BREAK a client that already exists - which is the question you actually ask before deploying, and the one a colour diff does not answer. Tells apart pairs that look identical in a diff: adding an OPTIONAL parameter breaks nothing, adding a REQUIRED one does; ADDING an enum value is safe, REMOVING one is not; dropping a query parameter is ignored, dropping a path one changes the URL. Every finding says why.", {
    before: z.string().describe("The published specification (JSON or YAML)"),
    after: z.string().describe("The one you want to publish"),
    format: z.enum(["json", "markdown"]).default("json"),
}, async ({ before, after, format }) => {
    const a = leerEspec(before);
    if (!a.ok)
        return err(`before: ${a.error}`);
    const b = leerEspec(after);
    if (!b.ok)
        return err(`after: ${b.error}`);
    const inf = comparar(a.espec, b.espec);
    return format === "markdown"
        ? { content: [{ type: "text" as const, text: informeMarkdown(inf) }] }
        : ok(informeApiEn(inf));
});
server.tool("api_cors_preflight", "Will the browser send an OPTIONS preflight before this request, and WHY? Answers without touching the network. Half of \"it works in curl but not in my page\" is a preflight the server does not answer, and knowing which of the three things triggers it (the method, the Content-Type or a custom header) changes where to look. Also lists the headers the browser refuses to let a page set.", {
    method: z.string().default("GET"),
    headers: z.record(z.string()).default({}).describe("Request headers, as an object"),
}, async ({ method, headers }) => {
    const cs = Object.entries(headers).map(([n, v]) => campo(n, v));
    const pf = necesitaPreflight(method, cs);
    return ok({
        preflight: pf !== null,
        because: pf?.metodo ? `the method ${pf.metodo}`
            : pf?.cabecera ? `the custom header "${pf.cabecera}"`
                : pf?.contentType ? `the Content-Type "${pf.contentType}"`
                    : null,
        whatToDo: pf
            ? "The server must answer that OPTIONS with Access-Control-Allow-Methods and Access-Control-Allow-Headers, not only the real request."
            : "No preflight: the browser sends the request directly and then checks Access-Control-Allow-Origin on the response.",
    });
});
const ACCESS_PROVIDERS = ["azure", "aws", "gcp", "k8s"] as const;
type AccessProvider = typeof ACCESS_PROVIDERS[number];
function accessPipeline(provider: AccessProvider) {
    return provider === "azure" ? PIPELINE_AZURE
        : provider === "aws" ? PIPELINE_AWS
            : provider === "gcp" ? PIPELINE_GCP
                : PIPELINE_K8S;
}
function accessWorld(provider: AccessProvider, data: unknown) {
    const d = (data ?? {}) as Record<string, unknown>;
    return provider === "azure" ? crearMundoAzure(d as Parameters<typeof crearMundoAzure>[0])
        : provider === "aws" ? crearMundoAws(d as Parameters<typeof crearMundoAws>[0])
            : provider === "gcp" ? crearMundoGcp(d as Parameters<typeof crearMundoGcp>[0])
                : crearMundoK8s(d as Parameters<typeof crearMundoK8s>[0]);
}
function accessExtra(provider: AccessProvider, plane: "control" | "data" | undefined): Record<string, unknown> {
    return provider === "azure" ? { plano: plane === "data" ? "datos" : "control" } : {};
}
const ACCESS_EFFECT_EN: Record<string, string> = { permitido: "allowed", denegado: "denied", indeterminado: "indeterminate" };
function origenAwsEn(o: unknown): string {
    const s = String(o ?? "");
    const ORIGEN: Record<string, string> = { identidad: "identity-based", recurso: "resource-based", boundary: "permissions-boundary", sesion: "session" };
    const m = /^(scp|rcp):(.*)$/.exec(s);
    return m ? `${m[1].toUpperCase()} (at "${m[2]}")` : ORIGEN[s] ?? s;
}
const cap = (t: string) => t[0].toUpperCase() + t.slice(1);
const conArticulo = (o: unknown) => `${/^[aeiouAEIOU]/.test(String(o)) ? "an" : "a"} ${o}`;
const condicionEn = (v: Record<string, unknown>) => v["clave"] !== undefined
    ? `${v["operador"]} on ${v["clave"]}: expected ${v["esperado"]}, the request has ${v["recibido"]}`
    : String(v["condicion"] ?? "");
function accessExplainStep(p: {
    etapaId: string;
    detalleKey: string;
    params?: Record<string, unknown>;
    final: boolean;
}): string {
    const v: Record<string, unknown> = { ...(p.params ?? {}), ...(p.params?.["origen"] !== undefined ? { origen: origenAwsEn(p.params["origen"]) } : {}) };
    switch (p.detalleKey) {
        case "azure.denegadoPor": return `Denied by deny assignment "${v["asignacion"]}" at scope "${v["ambito"]}".`;
        case "azure.sinDenegacion": return "No deny assignment applies.";
        case "azure.concedidoPor": return `Granted by role "${v["rol"]}" (assignment "${v["asignacion"]}" at scope "${v["ambito"]}").`;
        case "azure.sinAsignacion": return "No role assignment grants this action.";
        case "azure.implicito": return "Nothing granted it: denied by default (Azure has no implicit allow).";
        case "azure.condicionDesconocida": return `Assignment "${v["asignacion"]}" carries a condition this model does not evaluate: ${v["condicion"]}.`;
        case "aws.denegadoPor": return `Explicitly denied by ${conArticulo(v["origen"])} policy.`;
        case "aws.sinDenegacion": return "No explicit Deny applies.";
        case "aws.scpNoAplicaGestion": return "This is the management account: SCPs don't affect it.";
        case "aws.scpSinAllowEnNivel": return `SCP level "${v["nivel"]}" doesn't include this action — an Allow is required at every level in the path.`;
        case "aws.scpNivelesOk": return "The SCPs allow this action at every level in the path.";
        case "aws.concedidoPorRecursoDirecto": return `Granted by a resource policy addressed to the ${v["via"]} ARN — not limited by the permissions boundary.`;
        case "aws.sinAllowDeIdentidadNiRecurso": return "Neither the identity policy nor the resource policy grants this action.";
        case "aws.concedidoPorRecursoRol": return "Granted by a resource policy to the role's ARN \u2014 the permissions boundary still applies.";
        case "aws.concedidoPorIdentidad": return "Granted by an identity-based policy.";
        case "aws.sinBoundary": return "No permissions boundary is attached.";
        case "aws.boundaryNoPermite": return "The permissions boundary doesn't include this action.";
        case "aws.boundaryOk": return "The permissions boundary allows this action.";
        case "aws.sinSesion": return "Not a session with a session policy.";
        case "aws.sesionNoPermite": return "The session policy does not include this action \u2014 session policies limit, they never grant.";
        case "aws.sesionOk": return "The session policy allows this action.";
        case "aws.implicito": return "Nothing denied it and it passed every gate: allowed (AWS has no implicit deny once identity/resource grants it).";
        case "aws.condicionDesconocida": return `${cap(conArticulo(v["origen"]))} policy carries a condition this model does not evaluate: ${v["condicion"]}. Pass requestContext to evaluate it.`;
        case "aws.condicionNoEvaluable": return `${cap(conArticulo(v["origen"]))} policy carries a condition with an operator this model cannot evaluate (${v["condicion"]}).`;
        case "aws.denegadoPorCondicion": return `Denied by ${conArticulo(v["origen"])} Deny whose condition DOES hold with this context (${v["condicion"]}).`;
        case "aws.denyNoAplicaPorCondicion": return `${cap(conArticulo(v["origen"]))} Deny covers this action but its condition does not hold, so it does not apply: ${condicionEn(v)}.`;
        case "aws.allowFueraPorCondicion": return `${cap(conArticulo(v["origen"]))} Allow covers this action but its condition does not hold with this context: ${condicionEn(v)}.`;
        case "gcp.denegadoPor": return `Denied by deny policy "${v["politica"]}" at scope "${v["ambito"]}" (deny policies are checked before allow policies).`;
        case "gcp.sinDenegacion": return "No deny policy applies.";
        case "gcp.concedidoPor": return `Granted by binding "${v["binding"]}" (role "${v["rol"]}" at scope "${v["ambito"]}").`;
        case "gcp.sinBinding": return "No allow binding grants this permission.";
        case "gcp.implicito": return "Nothing granted it: denied by default.";
        case "k8s.concedidoPor": return `Granted by binding "${v["binding"]}" (role "${v["rol"]}" at scope "${v["ambito"]}").`;
        case "k8s.sinBinding": return "No RoleBinding/ClusterRoleBinding grants this action.";
        case "k8s.implicito": return "Nothing granted it: denied by default (Kubernetes RBAC is purely additive \u2014 there is no deny rule to check).";
        case "motor.pipelineIncompleto": return "Internal: the pipeline for this provider never reached a decisive stage (a bug in the scenario data, not in your question).";
        default: return p.detalleKey;
    }
}
const ETAPA_EN: Record<string, string> = {
    "azure.denegacion": "azure.deny-assignments",
    "azure.asignaciones": "azure.role-assignments",
    "azure.implicito": "azure.default",
    "aws.denegacion": "aws.explicit-deny",
    "aws.scpNiveles": "aws.scp-levels",
    "aws.identidadRecurso": "aws.identity-and-resource",
    "aws.boundary": "aws.permissions-boundary",
    "aws.sesion": "aws.session-policy",
    "aws.implicito": "aws.default",
    "gcp.denegacion": "gcp.deny-policies",
    "gcp.binding": "gcp.allow-bindings",
    "gcp.implicito": "gcp.default",
    "k8s.binding": "k8s.bindings",
    "k8s.implicito": "k8s.default",
    "motor.pipelineIncompleto": "engine.incomplete",
};
function accessFormatVerdict(v: {
    efecto: string;
    traza: {
        etapaId: string;
        detalleKey: string;
        params?: Record<string, unknown>;
        final: boolean;
    }[];
}) {
    return {
        result: ACCESS_EFFECT_EN[v.efecto] ?? v.efecto,
        trace: v.traza.map((p) => ({ stage: ETAPA_EN[p.etapaId] ?? p.etapaId, explanation: accessExplainStep(p), decisive: p.final })),
    };
}
const accessWorldSchema = z.record(z.any()).describe("Scenario data. Shape depends on \"provider\" \u2014 azure: {ambitos, pertenencias?, roles?, asignaciones?, denegaciones?}; "
    + "aws: {ambitos, cuentasGestion?, identidades?, recursos?, scps?, boundaries?, rcps?, sesiones?}; "
    + "gcp: {ambitos, pertenencias?, roles?, bindings?, denyPolicies?}; "
    + "k8s: {ambitos, pertenencias?, roles?, bindings?}. "
    + "See access.md for the exact field shapes, worked examples and the official-docs citation behind every rule.");
server.tool("access_check", "Evaluate \"can this principal do this action on this scope, and WHY?\" against a vendor-neutral identity/RBAC model that mirrors Azure RBAC, AWS IAM/Organizations, GCP Resource Manager or Kubernetes RBAC \u2014 each rule verified against the official docs (access.md). Returns a three-valued verdict \u2014 allowed / denied / indeterminate (an unmodelled condition would decide it) \u2014 with a step-by-step trace of which rule decided and why. Nothing is looked up online: you must pass the scenario data yourself in \"world\".", {
    provider: z.enum(ACCESS_PROVIDERS),
    world: accessWorldSchema,
    principalId: z.string(),
    action: z.string().describe("e.g. \"Microsoft.Storage/storageAccounts/blobServices/containers/blobs/read\" (Azure), \"s3:GetObject\" (AWS), \"storage.objects.get\" (GCP), \"get:pods\" (Kubernetes: \"verb:resource\")"),
    scopeId: z.string(),
    plane: z.enum(["control", "data"]).optional().describe("Azure only: control-plane or data-plane action (Azure keeps them as separate grant sets; ignored for the other providers)."),
    requestContext: z.record(z.union([z.string(), z.array(z.string())])).optional()
        .describe("AWS only: the request context, so Condition blocks are evaluated instead of left indeterminate, e.g. {\"aws:SourceIp\": \"10.1.2.3\", \"aws:PrincipalTag/team\": \"data\", \"aws:MultiFactorAuthPresent\": \"true\"}"),
}, async ({ provider, world, principalId, action, scopeId, plane, requestContext }) => {
    try {
        const w = accessWorld(provider, world);
        const contexto = provider === "aws" && requestContext
            ? Object.fromEntries(Object.entries(requestContext).map(([k, x]) => [k.toLowerCase(), Array.isArray(x) ? x : [x]])) : undefined;
        const req = { principalId, accion: action, ambitoId: scopeId, ...accessExtra(provider, plane), ...(contexto ? { contexto } : {}) };
        const v = evaluarAcceso(accessPipeline(provider) as any, req, w as any);
        return ok(accessFormatVerdict(v));
    }
    catch (e) {
        return err(`Could not evaluate this scenario: ${e instanceof Error ? e.message : String(e)}`);
    }
});
server.tool("access_who_can", "The dual of access_check: given a list of candidate principals, returns which of them can do this action on this scope \u2014 each with its own verdict and trace, same shape as access_check.", {
    provider: z.enum(ACCESS_PROVIDERS),
    world: accessWorldSchema,
    principalIds: z.array(z.string()).min(1),
    action: z.string(),
    scopeId: z.string(),
    plane: z.enum(["control", "data"]).optional(),
}, async ({ provider, world, principalIds, action, scopeId, plane }) => {
    try {
        const w = accessWorld(provider, world);
        const extra = accessExtra(provider, plane);
        const resultados = quienPuedeAcceso(accessPipeline(provider) as any, w as any, principalIds, action, scopeId, extra);
        return ok(resultados.map((r) => ({ principalId: r.principalId, ...accessFormatVerdict(r.veredicto) })));
    }
    catch (e) {
        return err(`Could not evaluate this scenario: ${e instanceof Error ? e.message : String(e)}`);
    }
});
server.tool("access_diff", "\"What if\" access diff: compares two versions of the same scenario (e.g. before/after removing a role assignment, or offboarding a principal) against a list of (principal, action, scope) checks, and reports who gains access and who loses it. A check that flips to/from \"indeterminate\" counts as neither a gain nor a loss \u2014 only a genuine allowed<->denied flip does.", {
    provider: z.enum(ACCESS_PROVIDERS),
    worldBefore: accessWorldSchema,
    worldAfter: accessWorldSchema,
    checks: z.array(z.object({
        principalId: z.string(),
        action: z.string(),
        scopeId: z.string(),
        plane: z.enum(["control", "data"]).optional(),
    })).min(1),
}, async ({ provider, worldBefore, worldAfter, checks }) => {
    try {
        const wa = accessWorld(provider, worldBefore);
        const wb = accessWorld(provider, worldAfter);
        const combinaciones = checks.map((c) => ({ principalId: c.principalId, accion: c.action, ambitoId: c.scopeId, extra: accessExtra(provider, c.plane) }));
        const d = diffAcceso(accessPipeline(provider) as any, wa as any, wb as any, combinaciones);
        const fmt = (c: typeof d.ganan[number]) => ({
            principalId: c.principalId,
            action: c.accion,
            scopeId: c.ambitoId,
            before: ACCESS_EFFECT_EN[c.antes] ?? c.antes,
            after: ACCESS_EFFECT_EN[c.despues] ?? c.despues,
        });
        return ok({ gained: d.ganan.map(fmt), lost: d.pierden.map(fmt) });
    }
    catch (e) {
        return err(`Could not evaluate this scenario: ${e instanceof Error ? e.message : String(e)}`);
    }
});
const archsimScenario = z.object({
    loadMult: z.number().positive().optional().describe("Multiply legitimate traffic (e.g. 6 = a \u00D76 peak)."),
    attackRate: z.number().nonnegative().optional().describe("Attack rps injected at the clients (DDoS)."),
    downKinds: z.array(z.string()).optional().describe("Take down every node of these kinds (e.g. [\"ai_router\"])."),
}).optional();
const archsimLabel = (n: {
    label?: string;
    kind: string;
    id: string;
} | undefined) => n ? (n.label || n.kind) : undefined;
const r2 = (x: number) => Number.isFinite(x) ? Math.round(x * 100) / 100 : x;
server.tool("archsim_validate", "Validate an architecture-simulation document (the archsim format, spec: archsim.md next to llms.txt). Checks the JSON shape, known node kinds and edge references, and builds the graph with the type defaults. Returns {ok, error?, summary: {nodes by kind, edges, queues without consumers}}. Use it before archsim_simulate or before handing the JSON to a person.", { archsim: z.string().describe("The archsim document as JSON ({\"archsim\":1,\"nodes\":[\u2026],\"edges\":[\u2026]}).") }, async ({ archsim }) => {
    const r = importArchsim(archsim);
    if (r.error || !r.state)
        return ok({ ok: false, error: r.error ? dslErrorEn(r.error) : "Could not build the graph.", code: r.error?.code });
    const byKind: Record<string, number> = {};
    for (const n of r.state.nodes)
        byKind[n.kind] = (byKind[n.kind] ?? 0) + 1;
    const hasOut = new Set(r.state.edges.map(e => e.fromId));
    const noConsumers = r.state.nodes.filter(n => (n.kind === "queue" || n.kind === "pubsub") && !hasOut.has(n.id)).map(archsimLabel);
    return ok({ ok: true, summary: { nodes: r.state.nodes.length, byKind, edges: r.state.edges.length, queuesWithoutConsumers: noConsumers } });
});
server.tool("archsim_simulate", "Simulate an architecture (archsim format) with the Architecture Simulator's engine: steady-state throughput, p50/p95 RESPONSE latency (it ends at the first queue) and PROCESSING latency, availability, bottleneck, infrastructure cost per hour, per-queue lag / \"full in N s\" / silently lost messages, per-node utilization, and the Report's findings. Optionally also runs a timed phase with a scenario (peak, DDoS, LLM outage) and reports the worst of it. Deterministic; nothing leaves the machine.", {
    archsim: z.string().describe("The archsim document as JSON."),
    aiReqPerSec: z.number().nonnegative().optional().describe("Requests/s entering through AI sources (nodes with no input that are not clients). Default 0."),
    phase: z.object({
        seconds: z.number().positive().max(3600).describe("Simulated duration of the phase."),
        scenario: archsimScenario,
    }).optional().describe("Timed phase after steady state (e.g. {\"seconds\":60,\"scenario\":{\"loadMult\":6}}): queues fill, autoscaling lags (~60 s by default)."),
}, async ({ archsim, aiReqPerSec, phase }) => {
    const r = importArchsim(archsim);
    if (r.error || !r.state)
        return err(`Invalid archsim document: ${r.error ? dslErrorEn(r.error) : "could not build the graph"}`);
    const { nodes, edges } = r.state;
    const byId = new Map(nodes.map(n => [n.id, n]));
    const rr = aiReqPerSec ?? 0;
    const steady = runtimeToSteady(nodes, edges, rr);
    const served: Record<string, number> = {};
    for (const id in steady.perNode)
        served[id] = steady.perNode[id].served;
    const costHr = costBreakdown(nodes, served, "us").infraHr;
    const queues = Object.entries(steady.queues).map(([id, q]) => ({
        queue: archsimLabel(byId.get(id)),
        backlog: Math.round(q.backlog),
        inRate: r2(q.inRate),
        drainCap: r2(q.drainCap),
        lagSec: Number.isFinite(q.lagSec) ? r2(q.lagSec) : "infinite",
        fullInSec: q.fillInSec === null ? null : r2(q.fillInSec),
        lostPerSec: r2(q.lost),
        partitionLimited: q.partitionLimited,
    }));
    const out: Record<string, unknown> = {
        steady: {
            throughputRps: r2(steady.throughput),
            availability: r2(steady.availability),
            legitAvailability: r2(steady.legitAvailability),
            p50Ms: r2(steady.p50),
            p95Ms: r2(steady.p95),
            processingP95Ms: r2(steady.e2eP95),
            bottleneck: steady.bottleneck ? archsimLabel(byId.get(steady.bottleneck)) : null,
            infraCostPerHourUsd: r2(costHr),
            llmCostPerHourUsd: r2(steady.costPerHour),
            silentlyLostPerSec: r2(steady.asyncLost),
            queues,
            nodes: nodes.filter(n => steady.perNode[n.id]).map(n => ({
                node: archsimLabel(n),
                kind: n.kind,
                utilization: r2(steady.perNode[n.id].rho),
                inRps: r2(steady.perNode[n.id].lambdaIn),
                droppedRps: r2(steady.perNode[n.id].dropped),
            })),
        },
        findings: runtimeInsights(nodes, edges, steady, costHr).map(i => ({ severity: i.sev, key: i.key, params: i.params, title: i.title, detail: i.detail })),
    };
    if (phase) {
        const m = measure(nodes, edges, { seconds: phase.seconds, dt: phase.seconds > 120 ? 0.5 : 0.1, scenario: phase.scenario, reqRate: rr });
        out["phase"] = { seconds: phase.seconds, scenario: phase.scenario ?? {}, availability: r2(m.avail), legitAvailability: r2(m.legitAvail), worstP95Ms: r2(m.p95), worstQueueLagSec: m.lagSec >= 1000000000 ? "infinite" : r2(m.lagSec), messagesLostTotal: Math.round(m.lost), maxInfraCostPerHourUsd: r2(m.costHr) };
    }
    return ok(out);
});
function diferido<T>(cargar: () => Promise<T>) {
    let p: Promise<T> | null = null;
    return async (): Promise<{
        m: T;
    } | {
        error: ReturnType<typeof err>;
    }> => {
        p ??= cargar();
        try {
            return { m: await p };
        }
        catch (e) {
            p = null;
            return { error: err(`This tool is not available in this package (${(e as Error).message}). It ships only with the full @jarroba/mcp package.`) };
        }
    };
}
const mermaidMod = diferido(() => import("./mermaid-parse.mjs"));
const seguridadMod = diferido(() => import("./seguridad-motores.mjs"));
const esquemaMod = diferido(() => import("./esquema-json.mjs"));
const experimentosMod = diferido(() => import("./experimentos-motores.mjs"));
const redosMod = diferido(() => import("./regex-redos.mjs"));
const esquemasK8sMod = diferido(() => import("./k8s-esquemas.mjs"));
const dbMod = diferido(() => import("./db-motores.mjs"));
const hojaMod = diferido(() => import("./hoja-calculo.mjs"));
const cedarMod = diferido(() => import("./cedar.mjs"));
const practicasMod = diferido(() => import("./practicas.mjs"));
const quimicaMod = diferido(() => import("./quimica.mjs"));
server.tool("mermaid_validate", "Check that Mermaid code actually parses, with Mermaid's own parser (the same version the Jarroba Tools web uses), before you hand it to someone to render. Returns the detected diagram type, or the parser error with its line, column and the tokens it expected \u2014 feed that back and fix the diagram, instead of guessing. Catches what models typically get wrong: unquoted labels with parentheses, `end` used as a node id, full-width punctuation, a `%` inside a pie value, an unknown diagram keyword. Covers every diagram type Mermaid knows (flowchart, sequence, class, state, ER, gantt, pie, mindmap, gitGraph, C4, architecture\u2026). It parses only; it does not render.", { mermaid: z.string().max(500000).describe("The Mermaid source, without the ```mermaid fences") }, async ({ mermaid: fuente }) => {
    const c = await mermaidMod();
    if ("error" in c)
        return c.error;
    return ok(await c.m.validarMermaid(fuente.replace(/^\s*```(?:mermaid)?\s*\n|\n\s*```\s*$/g, "")));
});
server.tool("json_schema_validate", "Validate a JSON document against a JSON Schema \u2014 the check to run on your own structured output before handing it over, instead of eyeballing it. Supports draft 2020-12 (default), 2019-09 and draft-07, chosen from the schema's `$schema`; `format` (email, date-time, uri, uuid\u2026) is enforced. Returns `valid` and, if not, EVERY error with the JSON Pointer of the offending value, the keyword that failed and its parameters. Remote `$ref`s are NOT fetched: an unresolvable reference is reported as a schema error.", {
    json: z.string().max(5000000).describe("The JSON document to validate, as text"),
    schema: z.string().max(1000000).describe("The JSON Schema, as text"),
    maxErrors: z.number().int().min(1).max(500).default(50).describe("Cap on the number of errors returned"),
}, async ({ json, schema, maxErrors }) => {
    const c = await esquemaMod();
    if ("error" in c)
        return c.error;
    const r = conPresupuesto(() => c.m.validarConEsquema(json, schema, maxErrors), 10000);
    if ("agotado" in r)
        return err("Validation took longer than 10 s and was stopped: look for a catastrophic `pattern` in the schema.");
    return "error" in r.valor ? err(r.valor.error) : ok(r.valor);
});
server.tool("db_migration_measure", "Before proposing a PostgreSQL migration, MEASURE what each statement would lock, instead of guessing. Runs your schema (DDL + sample data) and then the migration in an ephemeral PostgreSQL (pglite, in memory) and reads, per statement: the strongest table lock actually taken (pg_locks), whether it rewrote the table, whether it scanned it in full, a risk level (lock mode \u00D7 duration), and the safer rewrite when there is one \u2014 CREATE INDEX CONCURRENTLY, ADD CONSTRAINT \u2026 NOT VALID + VALIDATE, NOT NULL NOT VALID (PG 18), lock_timeout, new column + backfill instead of ALTER TYPE \u2014 with the SQL written out. Nothing touches a real database.", {
    schema: z.string().max(2000000).describe("The starting schema: CREATE TABLE \u2026 plus a few INSERTs so scans and rewrites are visible. Can be empty"),
    migration: z.string().min(1).max(500000).describe("The migration to measure, one or more statements"),
    queries: z.array(z.object({ name: z.string().max(200), sql: z.string().max(100000) })).max(200).optional()
        .describe("Optional: the application's queries. Each one is run before and after the migration and reported as breaks / changes (columns removed or retyped) / widens / fixes / already-failing / same"),
}, async ({ schema, migration, queries }) => {
    const abierta = await abrirPglite();
    if (abierta.error)
        return err(abierta.error);
    const run = runDePglite(abierta.db);
    try {
        const m = await medirMigracion(run as never, (t) => S.sqlImport.split(t), schema, migration);
        if (m.schemaError)
            return err(`The starting schema does not run in PostgreSQL, so there is nothing to measure on top of it: ${m.schemaError}`);
        if (!queries?.length)
            return ok(migracionEn(m));
        const c = await dbMod();
        if ("error" in c)
            return c.error;
        const [antes, despues] = await Promise.all([abrirPglite(), abrirPglite()]);
        if (antes.error || despues.error)
            return err((antes.error ?? despues.error)!);
        try {
            const runAntes = runDePglite(antes.db), runDespues = runDePglite(despues.db);
            const errSchema = schema.trim() ? (await runDespues(schema)).find((r) => r.error)?.error : undefined;
            let errMig: string | undefined;
            if (!errSchema)
                for (const sentencia of S.sqlImport.split(migration)) {
                    const e = (await runDespues(sentencia.sql)).find((r) => r.error)?.error;
                    if (e) {
                        errMig = e;
                        break;
                    }
                }
            const impacto = errMig ? undefined : await c.m.compararBanco(runAntes as never, runDespues as never, schema, "", queries.map((q) => ({ nombre: q.name, sql: q.sql })));
            return ok({ ...migracionEn(m), queryImpact: impacto ? impactoEn(impacto) : { notChecked: `the migration fails, so there is no "after" to compare: ${errMig}` } });
        }
        finally {
            for (const d of [antes.db, despues.db])
                try {
                    await d?.close?.();
                }
                catch { }
        }
    }
    finally {
        try {
            await abierta.db.close?.();
        }
        catch { }
    }
});
server.tool("db_query_check", "Run a SQL query against your schema in an ephemeral PostgreSQL (pglite, in memory) before you hand it over, instead of guessing whether a column exists: does it run, which columns it returns with their real PostgreSQL types, how many rows, a small sample \u2014 or Postgres's own error with its SQLSTATE and position. Runs inside a transaction that is rolled back, so an UPDATE or DELETE is safe to check. Give `compareWith` (e.g. a reference query, or the version before your rewrite) to check both return the same rows: they are also run on adversarial data (NULLs, duplicates, empty tables), and if they differ you get the smallest counter-example with its INSERT statements \u2014 the classic NOT IN with a NULL.", {
    schema: z.string().max(2000000).describe("CREATE TABLE \u2026 plus INSERTs with some sample data. Can be empty"),
    sql: z.string().min(1).max(100000).describe("The query to check"),
    compareWith: z.string().max(100000).optional().describe("Optional second read-only query that should return the same rows"),
    ordered: z.boolean().default(false).describe("With compareWith: also compare row order (only if ORDER BY matters)"),
}, async ({ schema, sql, compareWith, ordered }) => {
    const c = await dbMod();
    if ("error" in c)
        return c.error;
    const [uno, dos] = await Promise.all([abrirPglite(), compareWith ? abrirPglite() : Promise.resolve(null)]);
    if (uno.error)
        return err(uno.error);
    if (dos?.error)
        return err(dos.error);
    try {
        const q = await c.m.comprobarConsulta(runDePglite(uno.db) as never, schema, sql);
        if (q.esquemaError)
            return err(`The schema does not run in PostgreSQL: ${q.esquemaError}`);
        const eq = compareWith && dos && !q.error
            ? await c.m.compararConsultas(runDePglite(dos.db) as never, schema, sql, compareWith, { ordenado: ordered, generarDatos: null })
            : undefined;
        return ok({ ...comprobacionEn(q), comparison: eq && equivalenciaEn(eq) });
    }
    finally {
        for (const d of [uno.db, dos?.db])
            try {
                await d?.close?.();
            }
            catch { }
    }
});
server.tool("spreadsheet_audit", "Audit a spreadsheet file (.xlsx, .xlsm, .ods, .xls) by RECALCULATING every formula and comparing it with the value saved in the file: cells whose saved value no longer matches its formula (stale or hand-overwritten results), real circular references, functions the recalculation engine does not support, and formula errors. Returns only the problem cells, each with sheet, address, formula, saved and recalculated value; healthy formulas are just counted. Reads the file from disk: pass its path.", {
    path: z.string().min(1).describe("Path to the spreadsheet file"),
    maxCells: z.number().int().min(1).max(2000).default(200).describe("Cap on problem cells returned"),
}, async ({ path: ruta, maxCells }) => {
    let datos: Buffer;
    try {
        datos = await (await import("node:fs/promises")).readFile(ruta);
    }
    catch (e) {
        return err(noSeLee(ruta, e));
    }
    const c = await hojaMod();
    if ("error" in c)
        return c.error;
    const r = conPresupuesto(() => c.m.auditarArchivo(datos.buffer.slice(datos.byteOffset, datos.byteOffset + datos.byteLength) as ArrayBuffer), 30000);
    if ("agotado" in r)
        return err("Recalculating the workbook took longer than 30 s and was stopped.");
    const a = r.valor;
    if (!a)
        return err("Not a spreadsheet this reader understands (.xlsx, .xlsm, .xlsb, .ods, .xls), or the file is damaged.");
    const ESTADO: Record<typeof a.celdas[number]["estado"], string> = {
        ok: "ok",
        divergencia: "saved-value-differs",
        ciclo: "circular-reference",
        "no-soportada": "unsupported-function",
        error: "error",
    };
    const problemas = a.celdas.filter((x) => x.estado !== "ok");
    const cuenta = (e: string) => a.celdas.filter((x) => x.estado === e).length;
    return ok({
        sheets: a.hojas,
        formulas: a.totalFormulas,
        ok: cuenta("ok"),
        savedValueDiffers: cuenta("divergencia"),
        circular: cuenta("ciclo"),
        unsupported: cuenta("no-soportada"),
        errors: cuenta("error"),
        truncated: a.truncado ? `stopped after ${c.m.LIMITE_FORMULAS} formulas` : undefined,
        problems: problemas.slice(0, maxCells).map((x) => ({
            sheet: x.hoja,
            cell: x.direccion,
            formula: `=${x.formula}`,
            status: ESTADO[x.estado],
            saved: x.valorGuardado,
            recalculated: x.valorRecalculado ?? undefined,
            detail: x.detalle,
        })),
        problemsOmitted: problemas.length > maxCells ? problemas.length - maxCells : undefined,
        unsupportedFunctions: [...new Set(problemas.filter((x) => x.estado === "no-soportada").map((x) => x.detalle))].filter(Boolean),
        note: a.totalFormulas ? undefined : "No formulas found. If this is not a spreadsheet, it was read as plain text/CSV.",
    });
});
const UID_CEDAR = z.string().max(500).describe("Entity UID in Cedar syntax, e.g. User::\"alice\"");
server.tool("cedar_check", "Check Cedar authorization policies (the language of AWS Verified Permissions) with the official Cedar engine, instead of reasoning about them: parse errors with their location; validation against your schema if you give one (wrong attribute, wrong entity type, impossible conditions), and of your entities against it; and, for each request, allow or deny with the policies that decided it \u2014 so you can tell a missing permit from a forbid that wins, and see a forbid that errored and so did not apply (fails open). Policies may carry @id(\"\u2026\") to name them in the answer.", {
    policies: z.string().min(1).max(500000).describe("Cedar policy set (text)"),
    schema: z.string().max(500000).optional().describe("Cedar schema, text or JSON. If given, policies are validated against it"),
    entities: z.array(z.record(z.unknown())).max(5000).default([]).describe("Entities in Cedar JSON format: {uid:{type,id}, attrs, parents}"),
    requests: z.array(z.object({
        principal: UID_CEDAR,
        action: UID_CEDAR,
        resource: UID_CEDAR,
        context: z.record(z.unknown()).default({}),
    })).max(200).default([]).describe("Authorization requests to decide"),
}, async ({ policies, schema, entities, requests }) => {
    const c = await cedarMod();
    if ("error" in c)
        return c.error;
    const { cedar, prepararCedar, decidirCedar, validarEntidadesCedar } = c.m;
    const conjunto = prepararCedar(cedar, policies, schema);
    if ("error" in conjunto) {
        const { tipo, detalles } = conjunto.error;
        if (tipo === "sintaxis")
            return ok({ valid: false, parseErrors: detalles });
        if (tipo === "id-repetido")
            return err(`Two policies share the same @id ("${detalles[0]}"): Cedar needs them unique.`);
        return err(`The schema does not parse: ${detalles.join(" | ")}`);
    }
    const resumen = Object.fromEntries(conjunto.politicas.map((p) => [p.id, p.resumen]));
    const erroresEntidades = entities.length ? validarEntidadesCedar(cedar, entities, schema) : [];
    const decisiones = [];
    for (const r of requests) {
        const peticion = `${r.principal} ${r.action} ${r.resource}`;
        const d = decidirCedar(cedar, conjunto, entities, { principal: r.principal, accion: r.action, recurso: r.resource, contexto: r.context });
        if ("error" in d) {
            if (d.error.tipo === "uid")
                return err(`Not a Cedar entity UID (expected Type::"id"): ${d.error.detalles[0]}`);
            decisiones.push({ request: peticion, error: d.error.detalles });
            continue;
        }
        decisiones.push({
            request: peticion,
            decision: d.decision,
            decidedBy: d.decidieron.map((id) => ({ id, policy: resumen[id] })),
            reason: d.motivo === "sin-permit" ? "no permit matched (default deny)" : undefined,
            evaluationErrors: d.erroresEvaluacion.length ? d.erroresEvaluacion.map((e) => ({ id: e.id, error: e.mensaje, ...(conjunto.politicas.find((p) => p.id === e.id)?.efecto === "forbid" ? { warning: "this forbid did not apply because it errored" } : {}) })) : undefined,
        });
    }
    return ok({
        valid: true,
        policies: conjunto.politicas.length,
        validation: conjunto.validacion && {
            errors: conjunto.validacion.errores.map((e) => ({ id: e.id, error: e.mensaje })),
            warnings: conjunto.validacion.avisos.map((e) => ({ id: e.id, warning: e.mensaje })),
        },
        entityErrors: erroresEntidades.length ? erroresEntidades : undefined,
        decisions: decisiones.length ? decisiones : undefined,
    });
});
server.tool("practice_check", "Before recommending a practice you learned in training, check whether it still holds: a curated, dated register of development and AI practices (still valid, superseded by what, anti-pattern, unnecessary since, or depends on the case), each with its evidence and how sure it is. Give `since` (your knowledge cutoff) to get only what changed after it. If the register has no entry, it says so instead of guessing \u2014 no entry means not reviewed, not \"fine\".", {
    topic: z.string().min(2).max(200).optional().describe("What to check, in English: e.g. \"chain of thought prompting\", \"jwt in localStorage\""),
    since: z.string().regex(/^\d{4}(-\d{2}(-\d{2})?)?$/).optional().describe("Your knowledge cutoff: YYYY, YYYY-MM or YYYY-MM-DD"),
    area: z.enum(Object.values(AREA_PRACTICA) as [
        string,
        ...string[]
    ]).optional()
        .describe("Without topic: list every entry of this area (id, title, verdict; ~2,000 tokens) to scan it yourself"),
}, async ({ topic, since, area }) => {
    const c = await practicasMod();
    if ("error" in c)
        return c.error;
    if (!topic) {
        if (!area)
            return err("Give a topic, or an area to list its entries");
        const entries = indicePracticasEn(c.m.indice(c.m.REGISTRO, AREA_PRACTICA_ES[area as keyof typeof AREA_PRACTICA_ES]));
        return ok({ area, entries, note: "Call practice_check again with an id as the topic to get its verdict, reasons and sources." });
    }
    const hoy = new Date().toISOString().slice(0, 10);
    return ok({ ...practicasEn(c.m.consultar(c.m.REGISTRO, topic, since, hoy)), register: `${c.m.REGISTRO.practicas.length} practices, as shipped with this version; the live one is at https://jarroba.com/tools/en/practices` });
});
const VARIANTES = z.array(z.object({
    name: z.string().max(80).optional(),
    visitors: z.number().int().min(1),
    conversions: z.number().int().min(0),
})).min(2).max(20);
server.tool("abtest_analyze", "Analyse a conversion A/B (or A/B/n) test the way a statistician would, instead of eyeballing two percentages. Two variants: difference and relative lift with confidence intervals, the right test (two-proportion z, or Fisher's exact when counts are low), p-value, significance and winner, plus the Bayesian probability that the variant beats control (Beta(1,1) priors). More than two: an omnibus chi-square and every variant against control with Holm or Benjamini-Hochberg correction. Always checks sample ratio mismatch (SRM) against the planned split \u2014 a broken split invalidates the result, however good it looks.", {
    variants: VARIANTES.describe("Control first unless `control` says otherwise"),
    control: z.number().int().min(0).default(0).describe("Index of the control variant"),
    alpha: z.number().gt(0).lt(0.5).default(0.05),
    correction: z.enum(["holm", "bh"]).default("holm"),
    plannedSplit: z.array(z.number().positive()).optional().describe("Planned split, e.g. [1,1,2]. Default: equal"),
}, async ({ variants, control, alpha, correction, plannedSplit }) => {
    const c = await experimentosMod();
    if ("error" in c)
        return c.error;
    if (control >= variants.length)
        return err(`control=${control} but there are only ${variants.length} variants.`);
    if (plannedSplit && plannedSplit.length !== variants.length)
        return err("plannedSplit must have one entry per variant.");
    if (variants.some((v) => v.conversions > v.visitors))
        return err("A variant has more conversions than visitors.");
    const nombres = variants.map((v, i) => v.name ?? String.fromCharCode(65 + i));
    const brazos = variants.map((v) => ({ n: v.visitors, x: v.conversions }));
    const reparto = plannedSplit ?? variants.map(() => 1);
    const s = c.m.srm(brazos.map((b) => b.n), reparto);
    const srmOut = s && { ...srmEn(s), note: s.descuadrado ? "The observed split does not match the plan: find the cause before trusting any result below." : undefined };
    if (variants.length === 2) {
        const otro = control === 0 ? 1 : 0;
        const a = c.m.analizar(brazos[control], brazos[otro], alpha);
        if (!a)
            return err("Impossible input (check visitors and conversions).");
        const pB = c.m.probBMejor(brazos[control], brazos[otro]);
        return ok({ ...comparacionEn(a, nombres[control], nombres[otro]), probabilityVariantBeatsControl: pB, sampleRatioMismatch: srmOut });
    }
    const m = c.m.analizarAbn(brazos, control, correction, alpha);
    if (!m)
        return err("Impossible input (check visitors and conversions).");
    return ok({ ...multiEn(m, nombres, control), sampleRatioMismatch: srmOut });
});
server.tool("abtest_sample_size", "Plan a conversion A/B test before running it: visitors per variant needed to detect a given relative lift (same formula as R's power.prop.test, two-sided), and how many days that takes with your traffic. Or the reverse: the smallest lift detectable with the visitors you can get.", {
    baselineRate: z.number().gt(0).lt(1).describe("Control conversion rate, e.g. 0.10"),
    relativeLift: z.number().gt(-1).optional().describe("Relative lift to detect: 0.1 = +10%. Or give visitorsPerVariant"),
    visitorsPerVariant: z.number().int().min(2).optional().describe("\u2192 minimum detectable lift instead"),
    power: z.number().gt(0).lt(1).default(0.8),
    alpha: z.number().gt(0).lt(0.5).default(0.05),
    variants: z.number().int().min(2).max(20).default(2),
    dailyVisitors: z.number().positive().optional().describe("Daily traffic, for the duration"),
    trafficFraction: z.number().gt(0).max(1).default(1),
}, async (a) => {
    const c = await experimentosMod();
    if ("error" in c)
        return c.error;
    if ((a.relativeLift === undefined) === (a.visitorsPerVariant === undefined))
        return err("Give exactly one of relativeLift or visitorsPerVariant.");
    let n: number | null;
    let lift: number | null;
    if (a.relativeLift !== undefined) {
        const p2 = a.baselineRate * (1 + a.relativeLift);
        if (p2 <= 0 || p2 >= 1)
            return err(`That lift takes the rate to ${p2}: it must stay between 0 and 1.`);
        n = c.m.muestraPorBrazo(a.baselineRate, p2, a.power, a.alpha);
        lift = a.relativeLift;
    }
    else {
        n = a.visitorsPerVariant!;
        lift = c.m.mdeRelativo(a.baselineRate, n, a.power, a.alpha);
    }
    if (n == null || lift == null)
        return err("Impossible input for this power and alpha.");
    const nEntero = Math.ceil(n);
    const d = a.dailyVisitors ? c.m.duracion(nEntero, a.dailyVisitors, a.trafficFraction, a.variants) : null;
    return ok({
        visitorsPerVariant: nEntero,
        totalVisitors: nEntero * a.variants,
        relativeLift: Math.round(lift * 10000) / 10000,
        detectableRate: Math.round(a.baselineRate * (1 + lift) * 1000000) / 1000000,
        duration: d && { days: d.dias, recommendedWholeWeeks: d.semanas, recommendedDays: d.diasRedondeados, note: "Run whole weeks: traffic and behaviour change by day of week." },
        note: a.variants > 2 ? "With more than two variants, alpha is not split here: correct for multiple comparisons when analysing (abtest_analyze does)." : undefined,
    });
});
server.tool("abtest_sequential", "Looking at an A/B test before it ends needs a stricter threshold per look, or false positives balloon. Returns the two-sided z boundary per look of a group-sequential design, Pocock or O'Brien-Fleming: equally spaced `looks`, or arbitrary `informationFractions` (Lan-DeMets alpha spending). Stop at look k only if |z| \u2265 its boundary.", {
    looks: z.number().int().min(1).max(20).optional().describe("Equally spaced looks, final one included"),
    informationFractions: z.array(z.number().gt(0).max(1)).min(1).max(20).optional().describe("Share of the planned sample at each look, increasing, e.g. [0.3,0.55,1]"),
    alpha: z.number().gt(0).lt(0.5).default(0.05),
    method: z.enum(["obf", "pocock"]).default("obf").describe("obf = O'Brien-Fleming, pocock = Pocock"),
}, async ({ looks, informationFractions, alpha, method }) => {
    const c = await experimentosMod();
    if ("error" in c)
        return c.error;
    if ((looks === undefined) === (informationFractions === undefined))
        return err("Give exactly one of looks or informationFractions.");
    if (informationFractions && informationFractions.some((t, i) => i > 0 && t <= informationFractions[i - 1]))
        return err("informationFractions must be strictly increasing.");
    const z = looks !== undefined ? c.m.fronterasSecuenciales(looks, alpha, method) : c.m.fronterasGastoAlfa(informationFractions!, alpha, method);
    if (!z)
        return err("Impossible input.");
    const t = informationFractions ?? Array.from({ length: looks! }, (_, i) => (i + 1) / looks!);
    return ok({
        method: method === "obf" ? "O'Brien-Fleming" : "Pocock",
        design: looks !== undefined ? "equally spaced looks" : "Lan-DeMets alpha spending",
        alpha,
        boundaries: z.map((b, i) => ({ look: i + 1, informationFraction: Math.round(t[i] * 10000) / 10000, zBoundary: Math.round(b * 10000) / 10000 })),
    });
});
server.tool("dora_metrics", "The four DORA delivery metrics (plus rework rate) from data you already have locally, without sending it anywhere: deployment frequency, lead time for changes, change failure rate and time to restore, computed from the JSON of `gh run list --workflow deploy.yml --branch main --limit 1000 --json databaseId,workflowName,headSha,displayTitle,conclusion,status,updatedAt` (or a CSV with a date column), optionally with `git log --first-parent --format=%H%x09%cI%x09%s main` for lead time. Says why each deploy counts as failed, and classifies the team against every State of DevOps report 2019-2024 \u2014 saying \"ambiguous\" or \"between bands\" when a report's table does not decide \u2014 plus the 2025 percentile.", {
    deployments: z.string().min(1).max(20000000).describe("Output of gh run list --json \u2026 (or the Actions REST workflow_runs JSON, or a CSV with a date column)"),
    workflow: z.string().optional().describe("Only count runs of this workflow name"),
    gitLog: z.string().max(20000000).optional().describe("Output of git log --first-parent --format='%H%x09%cI%x09%s' main, for lead time"),
    incidents: z.array(z.object({ start: z.string(), end: z.string().optional() })).optional().describe("Known incidents (ISO dates), to attribute failures and time to restore"),
}, async ({ deployments, workflow, gitLog, incidents }) => {
    const c = await experimentosMod();
    if ("error" in c)
        return c.error;
    const lectura = c.m.leerGhRuns(deployments, workflow);
    if (!lectura)
        return err("Could not read that as gh run list JSON, Actions workflow_runs JSON, or a CSV with a date column.");
    if (!lectura.despliegues.length)
        return err(`No successful completed runs found${workflow ? ` for workflow "${workflow}"` : ""}. Workflows seen: ${lectura.workflows.join(", ") || "(none)"}.`);
    const commits = gitLog ? c.m.leerGitLog(gitLog) : [];
    const inc = (incidents ?? []).map((i) => ({ inicio: new Date(i.start), fin: i.end ? new Date(i.end) : undefined }));
    const d = c.m.analizarDespliegues(lectura.despliegues, commits, inc);
    if (!d)
        return err("Not enough deployments to compute the metrics.");
    const metricas = { desplieguesDia: d.desplieguesDia, leadHoras: d.leadHoras ?? undefined, recuperacionHoras: d.recuperacionHoras ?? undefined, cfr: d.cfr, rework: d.rework };
    return ok({ ...doraEn(d, c.m.clasificarHistorico(metricas), c.m.percentil2025(metricas), gitLog ? 0 : 1), runsDiscarded: lectura.descartadas });
});
server.tool("oauth_audit", "Audit an OAuth 2.0 / OpenID Connect setup against RFC 9700 (OAuth 2.0 Security BCP), RFC 8414 and OIDC Discovery. Give an `authorizeUrl` (the /authorize request your app sends) to check PKCE present and S256, state and its entropy, nonce, PAR, redirect_uri over TLS / loopback / wildcards / fragments, secrets in the URL and scope breadth; and/or a `discoveryDocument` (the openid-configuration or oauth-authorization-server JSON, pasted \u2014 nothing is fetched) to check issuer, required fields, HTTPS endpoints, RS256, id_token alg \"none\", implicit and password grants, PKCE advertised (and \"plain\"), iss in responses, sender-constrained tokens and PAR. Each failed check carries its severity (must/should) and the RFC section.", {
    authorizeUrl: z.string().max(20000).optional().describe("The full /authorize URL with its query string"),
    discoveryDocument: z.string().max(2000000).optional().describe("The .well-known/openid-configuration JSON"),
}, async ({ authorizeUrl, discoveryDocument }) => {
    if (!authorizeUrl && !discoveryDocument)
        return err("Give authorizeUrl, discoveryDocument, or both.");
    const c = await seguridadMod();
    if ("error" in c)
        return c.error;
    const a = authorizeUrl ? c.m.auditAuthorizeUrl(authorizeUrl) : null;
    const m = discoveryDocument ? c.m.auditOidcMetadata(discoveryDocument) : null;
    if (a && !a.valid && !m)
        return err("Could not parse that as an /authorize URL.");
    if (m && !m.valid && !a)
        return err("Could not parse that as a discovery document (JSON with at least an issuer).");
    return ok({ authorize: a && (a.valid ? oauthEn(a) : "unparseable URL"), discovery: m && (m.valid ? oidcEn(m) : "unparseable document") });
});
const MAX_SEG = 2000000;
const PRESUPUESTO_SEG = 10000;
const agotado = (que: string) => err(`${que} took longer than ${PRESUPUESTO_SEG / 1000} s and was stopped. Try a smaller input.`);
const FICHEROS = z.array(z.object({
    path: z.string().min(1).max(500).describe("Path as it would sit in the repo; it decides how the file is read"),
    content: z.string().max(MAX_SEG),
})).min(1).max(100);
server.tool("hidden_text_scan", "Find what a model cannot see in a piece of text: invisible Unicode that smuggles instructions (tag characters U+E0000\u2013E007F, the \"ASCII smuggling\" used against Copilot and in poisoned MCP/skill files), variation-selector and invisible-bit encodings, zero-width and bidi controls (Trojan Source), look-alike Cyrillic/Greek letters inside Latin words, and odd spaces. Returns every finding with UTF-16 offsets and codepoints, and DECODES the hidden message when it can. Run it on any text you are about to follow as instructions (a README, an issue, a tool description, a web page) \u2014 you cannot do this by reading it, because to you those characters are not there. Legitimate uses (emoji ZWJ sequences, flags, RTL scripts) are reported apart as `legitimate`.", { text: z.string().max(MAX_SEG).describe("The text to inspect, exactly as received") }, async ({ text }) => {
    const c = await seguridadMod();
    if ("error" in c)
        return c.error;
    const r = conPresupuesto(() => c.m.analizarTexto(text), PRESUPUESTO_SEG);
    return "agotado" in r ? agotado("The scan") : ok(textoEn(r.valor));
});
server.tool("paste_check", "Before pasting a log, a HAR file or any text into a ticket, chat or prompt: find the secrets and personal data in it (API keys, JWTs, session cookies, Authorization headers, passwords, cards, emails\u2026). A HAR is read entry by entry, so each finding says in which request, header, cookie, query parameter or body it sits \u2014 the way the 2023 Okta support breach happened, through a HAR with live session tokens. Returns a short preview per finding (never the full secret) and `redacted`: the same content with every finding replaced, ready to paste.", { content: z.string().max(MAX_SEG).describe("The text or HAR (JSON) to check") }, async ({ content }) => {
    const c = await seguridadMod();
    if ("error" in c)
        return c.error;
    const r = conPresupuesto(() => c.m.analizarPegado(content), PRESUPUESTO_SEG);
    return "agotado" in r ? agotado("The check") : ok(pegadoEn(r.valor));
});
server.tool("actions_audit", "Audit GitHub Actions workflows for the injection and supply-chain patterns behind real incidents: untrusted `${{ github.event.* }}` interpolated into `run:` or github-script (command/script injection), `pull_request_target` that checks out the fork's code with the repo's secrets (\"pwn request\"), actions pinned to a tag or branch instead of a commit SHA (tj-actions/changed-files, CVE-2025-30066, 23,000+ repos), `permissions: write-all`, hard-coded secrets, curl-pipe-to-shell and suspicious hosts. Each finding carries a rule id, severity, confidence (structural vs heuristic), file, line and job. Static analysis of the YAML you pass: nothing is fetched or run.", { files: FICHEROS.describe("Workflow files, e.g. {\"path\": \".github/workflows/ci.yml\", \"content\": \"...\"}") }, async ({ files }) => {
    const c = await seguridadMod();
    if ("error" in c)
        return c.error;
    const r = conPresupuesto(() => c.m.auditarAcciones(files.map((f) => ({ ruta: f.path, contenido: f.content }))), PRESUPUESTO_SEG);
    return "agotado" in r ? agotado("The audit") : ok(accionesEn(r.valor));
});
server.tool("headers_audit", "Audit the HTTP response headers of a site as you pasted them (from curl -I, DevTools or a HAR): an A+\u2026F grade like /headers-audit; Content-Security-Policy (missing, unsafe-inline/eval, wildcards, missing object-src/base-uri/frame-ancestors), HSTS (missing, too short, invalid preload), nosniff, frame options, Referrer-Policy, the obsolete X-XSS-Protection, cookies without Secure/HttpOnly/SameSite, and a Server header that exposes the version. Nothing is requested over the network: it reads what you give it.", {
    headers: z.string().max(MAX_SEG).describe("Raw response headers, one per line; a status line is fine"),
    https: z.boolean().optional().describe("Whether the response came over HTTPS; decides if HSTS applies. Guessed from the input when omitted"),
}, async ({ headers, https }) => {
    const c = await seguridadMod();
    if ("error" in c)
        return c.error;
    const r = conPresupuesto(() => c.m.analizarCabeceras(headers, https), PRESUPUESTO_SEG);
    if ("agotado" in r)
        return agotado("The audit");
    return ok({ grade: c.m.notaDe(r.valor.porGravedad), gradeRule: "F: any critical \u00B7 D: 3+ high \u00B7 C: 1-2 high \u00B7 B: 4+ warnings \u00B7 A: 1-3 warnings \u00B7 A+: none", ...cabecerasEn(r.valor) });
});
server.tool("email_auth_audit", "Check the authentication of an email and of a domain's mail records: paste the raw headers of a message (Authentication-Results, DKIM-Signature, From, Reply-To, Return-Path) and/or the DNS TXT records (v=spf1, v=DMARC1, v=DKIM1). Finds SPF/DKIM/DMARC failures, a Reply-To or Return-Path on another domain, a DKIM signature that does not cover From or only part of the body (l=), weak or revoked keys, SPF +all / ?all / more than 10 DNS lookups, and DMARC p=none or without reports. Verifies DKIM key strength locally; it does NOT query DNS \u2014 paste the records you want checked.", { input: z.string().max(MAX_SEG).describe("Raw message headers, DNS TXT records, or both") }, async ({ input }) => {
    const c = await seguridadMod();
    if ("error" in c)
        return c.error;
    const r = await c.m.analizarCorreo(input);
    return r ? ok(correoEn(r)) : err("Nothing to analyze: paste raw email headers or v=spf1 / v=DMARC1 / v=DKIM1 records.");
});
server.tool("saml_audit", "Audit a SAML message: paste it as raw XML, as the base64 of an HTTP-POST binding, or as the deflated+base64 SAMLRequest/SAMLResponse of a Redirect binding (a whole URL works). Finds a missing signature, weak signature or digest algorithms (SHA-1), duplicate IDs and a signature that references a different element than the one being read (signature wrapping), no NotOnOrAfter, expired, no AudienceRestriction, no InResponseTo, unencrypted assertions, a non-success status and secrets in attributes. Returns issuer, NameID and attributes too. It does NOT verify the signature cryptographically against a certificate.", { input: z.string().max(MAX_SEG).describe("The SAML message: XML, base64 (POST binding) or a Redirect URL / deflated value") }, async ({ input }) => {
    const c = await seguridadMod();
    if ("error" in c)
        return c.error;
    const r = await c.m.analizarSaml(input);
    return r ? ok(samlEn(r)) : err("Could not decode that as SAML (XML, base64 POST or deflated Redirect).");
});
server.tool("agent_config_audit", "Audit the configuration an AI coding agent runs with, before you trust a repo or install something: Claude Code settings (hooks, permissions like Bash(*), bypass mode, environment variables that redirect the API), MCP server configs for any client (shell servers, unpinned packages, privileged Docker, plain HTTP, auto-approval), VS Code tasks that run when a folder opens and auto-approve settings, Codex and Gemini CLI configs, environment files, and instruction text (CLAUDE.md, AGENTS.md, skills, subagents) carrying hidden Unicode, instruction-override or fake-authority phrasing, data leaks through image links, or download-and-execute commands. Findings that run WITHOUT anyone approving (a hook, a task on open) come first in `runsWithoutAsking`.", { files: FICHEROS.describe("Config and instruction files with their real paths, e.g. {\"path\": \".claude/settings.json\", \"content\": \"...\"}") }, async ({ files }) => {
    const c = await seguridadMod();
    if ("error" in c)
        return c.error;
    const r = conPresupuesto(() => c.m.auditarAgente(files.map((f) => ({ ruta: f.path, contenido: f.content }))), PRESUPUESTO_SEG);
    return "agotado" in r ? agotado("The audit") : ok(agenteEn(r.valor));
});
server.tool("k8s_network_reach", "Which pods can actually reach which, according to the Kubernetes NetworkPolicies in the manifests you paste (multi-document YAML: Pods/Deployments/StatefulSets\u2026, Services, Namespaces, NetworkPolicies) \u2014 computed, not guessed, and checked against netpol-analyzer. Returns the pairs that CAN connect with their ports (everything else is blocked), plus findings: policies or peers that select no pods, the namespaceSelector/podSelector split-list trap, Services selecting no pods or exposing a missing targetPort, missing ConfigMap/Secret/ServiceAccount, unreachable pods, hostNetwork pods. Give `from` and `to` (\"namespace/name\", or \"external\") to explain one pair: which policies isolate each side and which rule lets it through. Out of scope: AdminNetworkPolicy, CNI-specific policies, node traffic.", {
    manifests: z.string().min(1).max(5000000).describe("Kubernetes YAML, several documents separated by ---"),
    from: z.string().optional().describe("Source \"namespace/name\" or \"external\", to explain one pair"),
    to: z.string().optional().describe("Destination \"namespace/name\" or \"external\""),
}, async ({ manifests, from, to }) => {
    const c = await seguridadMod();
    if ("error" in c)
        return c.error;
    if ((from === undefined) !== (to === undefined))
        return err("Give both from and to, or neither.");
    const r = conPresupuesto(() => {
        const m = c.m.leerK8s(manifests);
        const mx = c.m.matrizK8s(m);
        const nodo = (n: string) => (n === EXTERNO_EN ? c.m.EXTERNO_K8S
            : mx.nodos.includes(n) ? n : (mx.nodos.filter((x) => x.split("/")[1] === n).length === 1 ? mx.nodos.find((x) => x.split("/")[1] === n) : null));
        const o = from !== undefined ? nodo(from) : undefined;
        const d = to !== undefined ? nodo(to) : undefined;
        return { m, mx, o, d };
    }, PRESUPUESTO_SEG);
    if ("agotado" in r)
        return agotado("The analysis");
    const { m, mx, o, d } = r.valor;
    if (!m.cargas.length && !m.politicas.length)
        return err(`No workloads or NetworkPolicies found.${m.errores.length ? ` Parse errors: ${m.errores.slice(0, 3).join(" | ")}` : ""}`);
    const nombres = mx.nodos.map((n) => (n === c.m.EXTERNO_K8S ? EXTERNO_EN : n));
    if (from !== undefined && (!o || !d))
        return err(`Unknown ${!o ? `from "${from}"` : `to "${to}"`}. Known: ${nombres.join(", ")}`);
    return ok({
        ...resumenK8s(m),
        ...alcanceEn(mx, c.m.EXTERNO_K8S),
        findings: hallazgosK8sEn(c.m.hallazgosK8s(m)),
        explanation: o && d ? { from, to, ...explicacionEn(c.m.explicarK8s(m, o, d)) } : undefined,
        note: "Pairs not listed in `reachable` are blocked. \"all\" means every port and protocol.",
    });
});
const REDOS_ESTADO = { seguro: "safe", vulnerable: "vulnerable", desconocido: "unknown" } as const;
const REDOS_COMPLEJIDAD = { constante: "constant", lineal: "linear", seguro: "safe", exponencial: "exponential", polinomica: "polynomial" } as const;
const gravedadRedos = (d: {
    estado: string;
    complejidad?: string;
    grado?: number;
}) => d.estado !== "vulnerable" ? 0 : d.complejidad === "exponencial" ? 1000 : (d.grado ?? 2);
server.tool("regex_redos_check", "Check a regex for catastrophic backtracking (ReDoS) WITHOUT running it on any text: static analysis with recheck, the same engine the Jarroba Tools /regex page uses. Says whether the pattern is safe, exponential or polynomial (with its degree), which part of the pattern is to blame, and an attack string that triggers it. For the two shapes people type by accident \u2014 nested quantifiers like (a+)+ and (\\w+\\s?)+ \u2014 it proposes a rewrite, re-analyses it, and only offers it if it is actually better, saying what it becomes. Use it right after writing a regex that will run on untrusted input.", {
    pattern: z.string().min(1).max(10000).describe("The regex source, without slashes"),
    flags: z.string().default("").describe("JavaScript flags, e.g. \"i\" or \"u\""),
    timeoutMs: z.number().int().min(100).max(10000).default(5000).describe("Analysis time limit"),
}, async ({ pattern, flags, timeoutMs }) => {
    try {
        new RegExp(pattern, flags);
    }
    catch (e: any) {
        return err(`Invalid regex: ${e?.message ?? e}`);
    }
    const c = await redosMod();
    if ("error" in c)
        return c.error;
    const f = flags.replace(/[^dgimsuvy]/g, "");
    const analizar = (p: string) => {
        const r = conPresupuesto(() => c.m.traducirDiagnostico(c.m.checkSync(p, f, { timeout: timeoutMs })), timeoutMs + 1000);
        return "agotado" in r ? { estado: "desconocido" as const, zonas: [], motivo: "timeout" } : r.valor;
    };
    const d = analizar(pattern);
    let rewrite;
    if (d.estado === "vulnerable") {
        const p2 = c.m.sugerirReescritura(pattern);
        const d2 = p2 ? analizar(p2) : null;
        if (p2 && d2 && d2.estado !== "desconocido" && gravedadRedos(d2) < gravedadRedos(d)) {
            rewrite = {
                pattern: p2,
                status: REDOS_ESTADO[d2.estado],
                complexity: d2.complejidad && REDOS_COMPLEJIDAD[d2.complejidad],
                degree: d2.grado,
                note: d2.estado === "seguro" ? "Matches the same texts; a capture group may capture something different."
                    : "Better, but still not safe: the remaining problem usually needs an anchor or a narrower character class.",
            };
        }
    }
    return ok({
        status: REDOS_ESTADO[d.estado],
        complexity: d.complejidad && REDOS_COMPLEJIDAD[d.complejidad],
        degree: d.grado,
        hotspots: d.zonas.length ? d.zonas.map((z) => ({ start: z.inicio, end: z.fin, text: pattern.slice(z.inicio, z.fin) })) : undefined,
        attack: d.ataqueDescrito ? { build: d.ataqueDescrito, ...(d.ataque && d.ataque.length <= 300 ? { string: d.ataque } : { length: d.ataque?.length }) } : undefined,
        suggestedRewrite: rewrite,
        reason: d.motivo,
    });
});
const VERSIONES_K8S = ["1.33", "1.34", "1.35", "1.36", "1.37"] as const;
server.tool("k8s_manifest_check", "Will the cluster accept these Kubernetes manifests? Validates them against the OFFICIAL schema of the Kubernetes version you target (1.33\u20131.37; checked against kubeconform --strict): unknown fields with the one you probably meant (a typo in livenessProbe silently leaves the pod without a probe), wrong types (\"80\" where an integer goes), missing required fields, removed APIs with what to migrate to. And Pod Security Standards, ported from the official admission controller: the highest level each workload meets, what it violates (the controller's own check ids), and whether its namespace's pod-security.kubernetes.io labels would reject it. If you include RBAC (Roles, Bindings, ServiceAccounts), what each pod could do if compromised: read secrets, exec into pods, escalate\u2026. And reliability checks in the style of kube-score (probes, resources, :latest images, replicas without a PodDisruptionBudget\u2026), which do not affect acceptance. Not covered: CEL rules, formats, CRDs (reported as not validated). For who-can-reach-whom, use k8s_network_reach.", {
    manifests: z.string().min(1).max(5000000).describe("Kubernetes YAML, several documents separated by ---"),
    kubernetesVersion: z.enum(VERSIONES_K8S).default("1.37").describe("Target cluster version"),
    podSecurityLevel: z.enum(["baseline", "restricted"]).default("restricted").describe("Level to list violations against"),
}, async ({ manifests, kubernetesVersion, podSecurityLevel }) => {
    const [c, e] = [await seguridadMod(), await esquemasK8sMod()];
    if ("error" in c)
        return c.error;
    if ("error" in e)
        return e.error;
    const esq = e.m.ESQUEMAS_K8S[kubernetesVersion];
    const r = conPresupuesto(() => {
        const m = c.m.leerK8s(manifests);
        const rbac = c.m.analizarRbac(manifests, m);
        return { m, esquema: c.m.validarManifiestos(manifests, esq), pss: m.cargas.map(c.m.evaluarPss), rbac, fiabilidad: c.m.hallazgosFiabilidad(m), hallazgos: [...c.m.hallazgosPss(m), ...(rbac.hayRbac ? c.m.hallazgosRbac(rbac, m.cargas) : [])] };
    }, PRESUPUESTO_SEG);
    if ("agotado" in r)
        return agotado("The check");
    const { m, esquema, pss, rbac, hallazgos, fiabilidad } = r.valor;
    return ok({
        kubernetesVersion,
        accepted: !esquema.some((x) => x.tipo !== "sin-esquema") && !hallazgos.some((h) => h.regla === "pss-rechazado") && !m.errores.length,
        parseErrors: m.errores.length ? m.errores : undefined,
        schemaErrors: erroresEsquemaEn(esquema),
        podSecurity: pssEn(pss, podSecurityLevel),
        serviceAccounts: rbac.hayRbac ? rbacEn(rbac) : undefined,
        findings: hallazgosK8sEn(hallazgos),
        reliability: fiabilidad.length ? hallazgosK8sEn(fiabilidad) : undefined,
        note: "\"no-schema\" means the kind is not in the official API (e.g. a CRD) and was NOT validated.",
    });
});
const dominioDe = cuadrarCatalogo(REGISTRADAS.keys());
for (const [nombre, handle] of REGISTRADAS)
    handle.update({ annotations: anotacionesDe(nombre) });
const pedidos = dominiosPedidos();
if (pedidos) {
    const activos = new Set<Dominio>(pedidos);
    for (const [nombre, handle] of REGISTRADAS) {
        if (!activos.has(dominioDe.get(nombre)!))
            handle.remove();
    }
}
const canalRoto = (e: unknown) => ["EPIPE", "ERR_STREAM_DESTROYED", "ERR_STREAM_WRITE_AFTER_END", "ECONNRESET"].includes((e as {
    code?: string;
})?.code ?? "");
const avisa = (...a: unknown[]) => { try {
    console.error(...a);
}
catch {
    process.exit(0);
} };
process.stdout.on("error", (e) => { if (canalRoto(e))
    process.exit(0); });
process.stderr.on("error", () => process.exit(0));
process.stdin.on("end", () => process.exit(0));
process.stdin.on("close", () => process.exit(0));
process.on("unhandledRejection", (motivo) => {
    if (canalRoto(motivo))
        process.exit(0);
    avisa("[jarroba-mcp] promesa rechazada sin due\u00F1o (la sesi\u00F3n sigue):", motivo);
});
process.on("uncaughtException", (e) => {
    if (canalRoto(e))
        process.exit(0);
    avisa("[jarroba-mcp] excepci\u00F3n no capturada (la sesi\u00F3n sigue):", e);
});
const padreInicial = process.ppid;
setInterval(() => { if (process.ppid !== padreInicial)
    process.exit(0); }, 5000).unref();
{
    const proto = server.server as unknown as {
        _requestHandlers: Map<string, (req: unknown, extra: unknown) => Promise<unknown>>;
    };
    const original = proto._requestHandlers.get("tools/list");
    if (!original)
        throw new Error("[jarroba-mcp] el SDK ya no registra tools/list donde se esperaba: revisa este bloque");
    server.server.removeRequestHandler("tools/list");
    server.server.setRequestHandler(ListToolsRequestSchema, async (req, extra) => {
        const r = await original(req, extra) as {
            tools: {
                inputSchema?: Record<string, unknown>;
            }[];
        };
        for (const t of r.tools)
            if (t.inputSchema)
                delete t.inputSchema["$schema"];
        return r as never;
    });
}
await server.connect(new StdioServerTransport());
const catalogo = recuento();
const activos = catalogo.porDominio.filter((d) => !pedidos || pedidos.includes(d.dominio));
const publicadas = activos.reduce((n, d) => n + d.n, 0);
const desglose = [...activos].sort((a, b) => b.n - a.n).map((d) => `${d.n} de ${d.titulo}`).join(", ");
console.error(`[jarroba-mcp] listo — ${publicadas} herramientas (${desglose})`
    + (pedidos ? ` · filtrado a: ${pedidos.join(", ")} (de ${catalogo.total} en total)` : "")
    + ".");
