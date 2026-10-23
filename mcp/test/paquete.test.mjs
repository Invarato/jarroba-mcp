import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, readdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { probarHuerfano } from "./huerfano.mjs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { recuento, DOMINIOS } from "../src/catalogo.ts";
const npm = (args, opciones) => execFileSync("npm", args, { ...opciones, shell: process.platform === "win32" });
function binInstalado(caja, nombre) {
    const dir = join(caja, "node_modules", ...nombre.split("/"));
    const bin = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")).bin;
    return join(dir, typeof bin === "string" ? bin : Object.values(bin)[0]);
}
const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const caja = mkdtempSync(join(tmpdir(), "jarroba-mcp-paquete-"));
let fallos = 0;
const check = (nombre, cond, visto) => {
    console.log(`${cond ? "\u2713" : "\u2717"} ${nombre}${cond ? "" : "  visto=" + JSON.stringify(visto)?.slice(0, 300)}`);
    if (!cond)
        fallos++;
};
try {
    console.log(`· empaquetando e instalando en ${caja}`);
    npm(["run", "build"], { cwd: raiz, stdio: "pipe" });
    npm(["pack", "--pack-destination", caja], { cwd: raiz, stdio: "pipe" });
    const tgz = readdirSync(caja).find((f) => f.endsWith(".tgz"));
    writeFileSync(join(caja, "package.json"), JSON.stringify({ name: "caja", version: "1.0.0", private: true }));
    npm(["install", `./${tgz}`], { cwd: caja, stdio: "pipe" });
    const transporte = new StdioClientTransport({
        command: "node",
        args: [binInstalado(caja, "@jarroba/mcp")],
        cwd: caja,
    });
    const cliente = new Client({ name: "paquete", version: "0.0.0" });
    await cliente.connect(transporte);
    const llamar = async (nombre, args) => {
        const r = await cliente.callTool({ name: nombre, arguments: args }, undefined, { timeout: 60000 });
        const texto = r.content?.[0]?.text ?? "";
        try {
            return { o: JSON.parse(texto), texto, isError: !!r.isError };
        }
        catch {
            return { o: null, texto, isError: !!r.isError };
        }
    };
    const vPaquete = JSON.parse(readFileSync(join(caja, "node_modules", "@jarroba", "mcp", "package.json"), "utf8")).version;
    check("serverInfo anuncia la versi\u00F3n del paquete", cliente.getServerVersion()?.version === vPaquete, cliente.getServerVersion());
    const tools = (await cliente.listTools()).tools;
    check("el paquete instalado publica sus herramientas", tools.length > 0, tools.length);
    const db = await llamar("db_schema_review", { ddl: "CREATE TABLE cliente (id int primary key, nombre text);" });
    check("pglite: db_schema_review introspecciona de verdad (sus assets viajan en el paquete)", !db.isError && db.o?.schema?.tables?.[0]?.name === "cliente", db.texto.slice(0, 200));
    const kg = await llamar("kg_query", { data: "<http://a> <http://b> <http://c> .", query: "SELECT * WHERE { ?s ?p ?o }" });
    check("oxigraph: kg_query resuelve SPARQL", !kg.isError && kg.o?.count === 1, kg.texto.slice(0, 150));
    const ta = await llamar("test_audit", { text: "it('suma', () => { expect(1 + 1).toBe(2); });", language: "typescript" });
    check("tree-sitter: test_audit parsea (las gram\u00E1ticas .wasm viajan en el paquete)", !ta.isError && ta.o != null, ta.texto.slice(0, 200));
    const tk = await llamar("count_tokens", { text: "hola mundo", encoding: "o200k_base" });
    check("gpt-tokenizer: count_tokens cuenta con el BPE real", !tk.isError && tk.o?.tokens === 2, tk.texto.slice(0, 120));
    const ce = await llamar("calc_eval", { expression: "100 km/h to m/s" });
    check("mathjs: calc_eval resuelve su import din\u00E1mico en el paquete instalado", !ce.isError && /27\.7/.test(String(ce.o?.result)), ce.texto.slice(0, 150));
    const svg = await llamar("diagram_svg", { jtd: JSON.stringify({ jtd: 1, nodes: [{ id: "a", text: "A" }], edges: [] }) });
    check("motor propio: diagram_svg dibuja sin repo, sin dev server y sin navegador", !svg.isError && String(svg.o?.svg).startsWith("<svg"), svg.texto.slice(0, 120));
    const merOk = await llamar("mermaid_validate", { mermaid: "graph TD\n A[texto] --> B" });
    check("mermaid: mermaid_validate carga su parser aparte y acepta un flowchart v\u00E1lido", !merOk.isError && merOk.o?.valid === true, merOk.texto.slice(0, 200));
    const merMal = await llamar("mermaid_validate", { mermaid: "graph TD\n A[texto (con par\u00E9ntesis)]-->B" });
    check("mermaid: \u2026y rechaza el inv\u00E1lido con su l\u00EDnea", merMal.o?.valid === false && merMal.o?.line === 2, merMal.texto.slice(0, 200));
    {
        const { readdirSync, readFileSync, statSync, existsSync } = await import("node:fs");
        const patrones = join(dirname(fileURLToPath(import.meta.url)), "..", "scripts", "patrones-internos.mjs");
        if (!existsSync(patrones))
            console.log("\u00B7 nada interno: omitido (repo p\u00FAblico, revisado al generarlo)");
        else {
            const { PROHIBIDO } = await import(patrones);
            const raizPaquete = join(caja, "node_modules", "@jarroba", "mcp");
            const hallados = [];
            const recorrer = (d) => {
                for (const f of readdirSync(d)) {
                    const r = join(d, f);
                    if (statSync(r).isDirectory())
                        recorrer(r);
                    else if (/\.(m?js|txt|json|md)$/.test(f) && !/THIRD_PARTY_LICENSES/.test(f)) {
                        for (const linea of readFileSync(r, "utf8").split("\n"))
                            for (const [re, que] of PROHIBIDO) {
                                const m = linea.match(re);
                                if (m)
                                    hallados.push(`${r.slice(raizPaquete.length + 1)}: ${que} «${m[0].slice(0, 60)}»`);
                            }
                    }
                }
            };
            recorrer(raizPaquete);
            check("lo publicado no lleva nada interno (chats, tabl\u00F3n, rutas de la m\u00E1quina)", hallados.length === 0, hallados.slice(0, 5));
        }
    }
    const qw = await llamar("count_tokens", { text: "Hello, world!", encoding: "qwen3" });
    check("tokenizadores: count_tokens qwen3 funciona desde el paquete instalado", qw.o?.tokens === 4, qw.texto.slice(0, 200));
    const ced = await llamar("cedar_check", { policies: "permit(principal, action, resource);", requests: [{ principal: "User::\"a\"", action: "Action::\"v\"", resource: "Doc::\"d\"" }] });
    check("cedar: cedar_check decide desde el paquete instalado", ced.o?.decisions?.[0]?.decision === "allow", ced.texto.slice(0, 200));
    const qph = await llamar("chem_ph", { components: [{ substance: "CH3COOH", concentration: 0.1 }] });
    check("qu\u00EDmica: chem_ph calcula y cita desde el paquete instalado", Math.abs(qph.o?.pH - 2.88) < 0.01 && qph.o.constants?.[0]?.sources?.length > 0, qph.texto.slice(0, 200));
    const js = await llamar("json_schema_validate", { json: "{\"a\":\"x\"}", schema: "{\"properties\":{\"a\":{\"type\":\"number\"}}}" });
    check("ajv: json_schema_validate valida en el paquete instalado", js.o?.valid === false && js.o?.errors?.[0]?.path === "/a", js.texto.slice(0, 200));
    const acc = await llamar("actions_audit", { files: [{ path: ".github/workflows/a.yml", content: "on: push\njobs:\n  a:\n    runs-on: x\n    steps:\n      - uses: actions/checkout@v4\n" }] });
    check("js-yaml: actions_audit lee el YAML en el paquete instalado", !acc.isError && acc.o?.findings?.some((f) => f.rule === "unpinned-action"), acc.texto.slice(0, 200));
    const abp = await llamar("abtest_sample_size", { baselineRate: 0.1, relativeLift: 0.2 });
    check("experimentos: abtest_sample_size carga su m\u00F3dulo diferido (3841 por variante)", abp.o?.visitorsPerVariant === 3841, abp.texto.slice(0, 160));
    const mg = await llamar("db_migration_measure", { schema: "CREATE TABLE t (id int); INSERT INTO t SELECT generate_series(1,100);", migration: "CREATE INDEX i ON t (id);" });
    check("pglite: db_migration_measure mide el bloqueo en el paquete instalado", mg.o?.statements?.[0]?.tables?.[0]?.strongestLock === "Share", mg.texto.slice(0, 200));
    const b64 = (x) => Buffer.from(JSON.stringify(x)).toString("base64url");
    const jw = await llamar("jwt_decode", { token: `${b64({ alg: "none" })}.${b64({ sub: "1" })}.` });
    check("jwt_decode instalado: decodifica Y avisa (alg none, sin exp)", (jw.o?.warnings ?? []).some((w) => w.warning === "alg-none-unsigned") && jw.o?.payload?.sub === "1", jw.texto.slice(0, 200));
    const avisosTerceros = join(caja, "node_modules", "@jarroba", "mcp", "dist", "THIRD_PARTY_LICENSES.txt");
    const txtAvisos = existsSync(avisosTerceros) ? readFileSync(avisosTerceros, "utf8") : "";
    check("licencias: THIRD_PARTY_LICENSES.txt viaja en el paquete y cita lo empaquetado (mermaid, ajv, rxjs)", ["mermaid ", "ajv ", "rxjs "].every((n) => txtAvisos.includes(`\n${n}`)), txtAvisos.slice(0, 200));
    check("licencias: \u2026y no lleva elkjs (EPL-2.0), que no hace falta para parsear", !/\nelkjs /.test(txtAvisos));
    const render = await llamar("diagram_render", { jtd: JSON.stringify({ jtd: 1, nodes: [{ id: "a", text: "A" }], edges: [] }) });
    check("diagram_render instalado avisa de que necesita el repo\u2026", render.isError === true, render.texto.slice(0, 120));
    check("\u2026nombrando el fichero que falta, que es lo que se puede comprobar", /render-jtd\.mjs/.test(render.texto), render.texto.slice(0, 160));
    check("\u2026sin acusar al dev server, que puede estar perfectamente levantado", !/¿está el dev server/i.test(render.texto), render.texto.slice(0, 160));
    check("\u2026y mandando a diagram_svg, que s\u00ED funciona aqu\u00ED", /diagram_svg/.test(render.texto), render.texto.slice(0, 160));
    const vivo = await llamar("hash_text", { text: "sigue vivo" });
    check("la sesi\u00F3n sigue viva tras los fallos anteriores (nada mat\u00F3 el proceso)", !vivo.isError && typeof vivo.o?.sha256 === "string", vivo.texto.slice(0, 120));
    await cliente.close();
    const huerfano = await probarHuerfano("node", [binInstalado(caja, "@jarroba/mcp")]);
    if (huerfano.noAplica)
        console.log(`  · huérfano: omitido, ${huerfano.noAplica} (en el CI corre en Linux)`);
    else
        check("el paquete instalado SALE al perder la sesi\u00F3n (la 0.1.5 se quedaba al 100 % de CPU)", !huerfano.vivo, huerfano);
    for (const caso of [
        { dir: "packages/logs", tgz: "jarroba-mcp-logs", bin: "jarroba-mcp-logs", tools: DOMINIOS.logs.tools.length, prueba: ["log_analyze", { text: "2024-01-15T10:30:00Z ERROR boom" }], noDebe: "db_schema_review" },
        { dir: "packages/tests", tgz: "jarroba-mcp-tests", bin: "jarroba-mcp-tests", tools: DOMINIOS.tests.tools.length, prueba: ["test_audit", { text: "it('x', () => { expect(1).toBe(1); });", language: "typescript" }], noDebe: "log_analyze" },
        { dir: "packages/calc", tgz: "jarroba-mcp-calc", bin: "jarroba-mcp-calc", tools: DOMINIOS.calc.tools.length, prueba: ["calc_eval", { expression: "5 km + 300 m" }], noDebe: "log_analyze" },
    ]) {
        const cajaD = mkdtempSync(join(tmpdir(), `jarroba-${caso.tgz}-`));
        try {
            npm(["pack", "--pack-destination", cajaD], { cwd: join(raiz, caso.dir), stdio: "pipe" });
            const t = readdirSync(cajaD).find((f) => f.endsWith(".tgz"));
            writeFileSync(join(cajaD, "package.json"), JSON.stringify({ name: "caja", version: "1.0.0", private: true }));
            npm(["install", `./${t}`], { cwd: cajaD, stdio: "pipe" });
            const tr = new StdioClientTransport({ command: "node", args: [binInstalado(cajaD, `@jarroba/${caso.tgz.replace(/^jarroba-/, "")}`)], cwd: cajaD });
            const cl = new Client({ name: "paquete", version: "0.0.0" });
            await cl.connect(tr);
            const vD = JSON.parse(readFileSync(join(raiz, caso.dir, "package.json"), "utf8")).version;
            check(`${caso.tgz}: serverInfo anuncia SU versión (${vD})`, cl.getServerVersion()?.version === vD, cl.getServerVersion());
            const nombres = (await cl.listTools()).tools.map((x) => x.name);
            check(`${caso.tgz}: publica ${caso.tools} herramientas, no el catálogo entero`, nombres.length === caso.tools, nombres.length);
            check(`${caso.tgz}: y NO publica las de otros dominios (${caso.noDebe})`, !nombres.includes(caso.noDebe), nombres.slice(0, 6));
            const inst = cl.getInstructions();
            const totalCatalogo = recuento().total;
            check(`${caso.tgz}: sus instructions citan SU propio recuento (${caso.tools}), no el del catálogo (${totalCatalogo})`, inst?.includes(String(caso.tools)) && !inst?.includes(`${totalCatalogo} deterministic`), inst);
            const r = await cl.callTool({ name: caso.prueba[0], arguments: caso.prueba[1] }, undefined, { timeout: 60000 });
            check(`${caso.tgz}: su tool funciona con solo SUS dependencias instaladas`, !r.isError, (r.content?.[0]?.text ?? "").slice(0, 160));
            await cl.close();
        }
        finally {
            rmSync(cajaD, { recursive: true, force: true });
        }
    }
}
finally {
    rmSync(caja, { recursive: true, force: true });
}
console.log(fallos ? `\n${fallos} FALLO(S) en el paquete` : "\nPAQUETE OK");
process.exit(fallos ? 1 : 0);
