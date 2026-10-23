import { build } from "esbuild";
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, readdirSync, rmSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
const EXTERNAS_TODAS = ["@modelcontextprotocol/server", "zod", "oxigraph", "gpt-tokenizer", "web-tree-sitter", "@electric-sql/pglite", "mathjs"];
const PAQUETES = [
    {
        nombre: "@jarroba/mcp",
        entrada: "src/server.ts",
        salida: "dist/server.mjs",
        externas: EXTERNAS_TODAS,
        gramaticas: true,
        manifiesto: null,
        topeMB: 3.5,
    },
    {
        nombre: "@jarroba/mcp-logs",
        entrada: "src/bin-logs.ts",
        salida: "packages/logs/dist/logs.mjs",
        externas: EXTERNAS_TODAS,
        gramaticas: false,
        manifiesto: "packages/logs/package.json",
        topeMB: 3.6,
    },
    {
        nombre: "@jarroba/mcp-tests",
        entrada: "src/bin-tests.ts",
        salida: "packages/tests/dist/tests.mjs",
        externas: EXTERNAS_TODAS,
        gramaticas: true,
        manifiesto: "packages/tests/package.json",
        topeMB: 3.6,
    },
    {
        nombre: "@jarroba/mcp-calc",
        entrada: "src/bin-calc.ts",
        salida: "packages/calc/dist/calc.mjs",
        externas: EXTERNAS_TODAS,
        gramaticas: false,
        manifiesto: "packages/calc/package.json",
        topeMB: 3.6,
    },
];
for (const d of ["dist", "packages/logs/dist", "packages/tests/dist", "packages/calc/dist"]) {
    rmSync(d, { recursive: true, force: true });
    mkdirSync(d, { recursive: true });
}
const DIFERIDOS = [
    { entrada: "src/mermaid-parse.mts", salida: "dist/mermaid-parse.mjs", topeMB: 4.5, alias: { "elkjs/lib/elk.bundled.js": "./src/sin-elk.mjs" } },
    { entrada: "src/seguridad-motores.mts", salida: "dist/seguridad-motores.mjs", topeMB: 0.6 },
    { entrada: "src/esquema-json.mts", salida: "dist/esquema-json.mjs", topeMB: 0.4 },
    { entrada: "src/experimentos-motores.mts", salida: "dist/experimentos-motores.mjs", topeMB: 0.5 },
    { entrada: "src/regex-redos.mts", salida: "dist/regex-redos.mjs", topeMB: 3.2 },
    { entrada: "src/k8s-esquemas.mts", salida: "dist/k8s-esquemas.mjs", topeMB: 0.7 },
    { entrada: "src/db-motores.mts", salida: "dist/db-motores.mjs", topeMB: 1.2 },
    { entrada: "src/hoja-calculo.mts", salida: "dist/hoja-calculo.mjs", topeMB: 0.9 },
    { entrada: "src/tokenizadores.mts", salida: "dist/tokenizadores.mjs", topeMB: 0.5 },
    { entrada: "src/cedar.mts", salida: "dist/cedar.mjs", topeMB: 0.1 },
    { entrada: "src/practicas.mts", salida: "dist/practicas.mjs", topeMB: JSON.stringify(JSON.parse(readFileSync("../public/practicas.json", "utf8"))).length / 1048576 + 0.15 },
    { entrada: "src/quimica.mts", salida: "dist/quimica.mjs", topeMB: 0.3 },
];
if (existsSync("../public/datos/manifiesto.json")) {
    const actual = JSON.parse(readFileSync("../public/datos/manifiesto.json", "utf8")).entradas.find((e) => e.id === "quimica-constantes")?.actual;
    if (!readFileSync("src/quimica.mts", "utf8").includes(`/datos/quimica/${actual}'`)) {
        throw new Error(`src/quimica.mts no importa la tabla de química vigente (${actual}, según public/datos/manifiesto.json): cambia el import y TABLA_FICHERO.`);
    }
}
const EXTERNOS_DIFERIDOS = DIFERIDOS.map((d) => "./" + d.salida.split("/").pop());
const COPYLEFT = /\b(A?GPL|LGPL|SSPL|EUPL|CC-BY-SA|EPL|MPL|CDDL)\b/i;
const ficheroDe = (dir, patron) => readdirSync(dir).find((f) => patron.test(f));
const avisos = new Map();
function raizPaquete(fichero) {
    let d = dirname(resolve(fichero));
    while (d !== dirname(d)) {
        if (/node_modules$/.test(dirname(d)) || /node_modules\/@[^/]+$/.test(dirname(d))) {
            if (existsSync(join(d, "package.json")))
                return d;
        }
        d = dirname(d);
    }
    return null;
}
function anotar(dist, metafile) {
    const m = avisos.get(dist) ?? new Map();
    for (const f of Object.keys(metafile.inputs)) {
        if (!f.includes("node_modules/"))
            continue;
        const dir = raizPaquete(f);
        if (!dir)
            continue;
        const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
        let licencia = typeof pkg.license === "string" ? pkg.license : pkg.license?.type
            ?? (Array.isArray(pkg.licenses) ? pkg.licenses.map((l) => l.type).join(" OR ") : undefined);
        if (!licencia) {
            const f = ficheroDe(dir, /^licen[cs]e(\.(md|txt|markdown))?$/i);
            const t = f ? readFileSync(join(dir, f), "utf8") : "";
            const deducida = /\bMIT License\b|Permission is hereby granted, free of charge/i.test(t) ? "MIT"
                : /Apache License,?\s+Version 2\.0/i.test(t) ? "Apache-2.0"
                    : /\bISC License\b/i.test(t) ? "ISC"
                        : /Redistribution and use in source and binary forms/i.test(t) ? "BSD" : null;
            if (deducida)
                licencia = `${deducida} (read from the license file; package.json declares none)`;
        }
        m.set(`${pkg.name}@${pkg.version}`, { nombre: pkg.name, version: pkg.version, licencia, dir });
    }
    avisos.set(dist, m);
}
const excedidos = [];
const sinComentarioJson = { name: "sin-comentario-json", setup(b) {
        b.onLoad({ filter: /\.json$/ }, (args) => {
            if (args.path.includes("node_modules"))
                return undefined;
            const j = JSON.parse(readFileSync(args.path, "utf8"));
            if (!j || typeof j !== "object" || Array.isArray(j) || !("_comentario" in j))
                return undefined;
            delete j._comentario;
            return { contents: JSON.stringify(j), loader: "json" };
        });
    } };
for (const p of PAQUETES) {
    const r = await build({ metafile: true, entryPoints: [p.entrada], bundle: true, platform: "node", format: "esm", target: "node20", outfile: p.salida, external: [...p.externas, ...EXTERNOS_DIFERIDOS], plugins: [sinComentarioJson], define: { __VERSION_PAQUETE__: JSON.stringify(JSON.parse(readFileSync(p.manifiesto ?? "package.json", "utf8")).version) }, minifyWhitespace: true, legalComments: "external", preserveSymlinks: true,
    });
    anotar(dirname(p.salida), r.metafile);
    const src = readFileSync(p.salida, "utf8").replace(/^#!.*\n/, "");
    writeFileSync(p.salida, "#!/usr/bin/env node\n" + src);
    if (p.salida === "dist/server.mjs") {
        mkdirSync("dist/tokenizers", { recursive: true });
        for (const f of readdirSync("vendor/tokenizers"))
            copyFileSync(`vendor/tokenizers/${f}`, `dist/tokenizers/${f}`);
        const cedar = "node_modules/@cedar-policy/cedar-wasm";
        mkdirSync("dist/cedar-wasm", { recursive: true });
        for (const f of ["cedar_wasm.js", "cedar_wasm_bg.wasm", "package.json"])
            copyFileSync(`${cedar}/nodejs/${f}`, `dist/cedar-wasm/${f}`);
        const vCedar = JSON.parse(readFileSync(`${cedar}/package.json`, "utf8")).version;
        writeFileSync("dist/cedar-wasm/NOTICE.txt", `Cedar ${vCedar} (@cedar-policy/cedar-wasm), https://github.com/cedar-policy/cedar\n`
            + "Copyright Cedar Contributors. Licensed under the Apache License, Version 2.0:\nhttps://www.apache.org/licenses/LICENSE-2.0\n");
    }
    if (p.gramaticas) {
        const destino = p.salida.replace(/\/[^/]+$/, "") + "/tree-sitter";
        mkdirSync(destino, { recursive: true });
        let n = 0, aviso = false;
        for (const f of readdirSync("../public/tree-sitter")) {
            if (f.endsWith(".wasm")) {
                copyFileSync(`../public/tree-sitter/${f}`, `${destino}/${f}`);
                n++;
            }
            else if (f === "NOTICE.txt") {
                copyFileSync(`../public/tree-sitter/${f}`, `${destino}/${f}`);
                aviso = true;
            }
        }
        if (!aviso)
            throw new Error("falta public/tree-sitter/NOTICE.txt \u2192 node scripts/vendor-grammars.mjs");
        console.log(`✔ ${destino}/ (${n} gramáticas + NOTICE.txt)`);
    }
    const mb = readFileSync(p.salida).length / 1048576;
    console.log(`✔ ${p.salida.padEnd(30)} ${mb.toFixed(2).padStart(5)} MB  (tope ${p.topeMB})  → ${p.nombre}`);
    if (mb > p.topeMB)
        excedidos.push(`${p.nombre}: ${mb.toFixed(2)} MB > tope ${p.topeMB} MB`);
}
for (const d of DIFERIDOS) {
    const r = await build({ metafile: true, entryPoints: [d.entrada], bundle: true, platform: "node", format: "esm", target: "node20", outfile: d.salida, minify: true, legalComments: "external", alias: d.alias, plugins: [sinComentarioJson, ...(d.plugins ?? [])], external: EXTERNAS_TODAS,
    });
    anotar(dirname(d.salida), r.metafile);
    const mb = readFileSync(d.salida).length / 1048576;
    console.log(`✔ ${d.salida.padEnd(30)} ${mb.toFixed(2).padStart(5)} MB  (tope ${+d.topeMB.toFixed(2)})  → solo @jarroba/mcp, cargado en diferido`);
    if (mb > d.topeMB)
        excedidos.push(`${d.salida}: ${mb.toFixed(2)} MB > tope ${d.topeMB} MB`);
}
const sinLicencia = [], conCopyleft = [];
for (const [dist, m] of avisos) {
    const lista = [...m.values()].sort((x, y) => x.nombre.localeCompare(y.nombre));
    const partes = [
        "Third-party software bundled in this package",
        "=============================================",
        "",
        "Generated by mcp/build.mjs from what esbuild actually bundled (its metafile), not from a list",
        "kept by hand. The dependencies installed next to this package by npm carry their own licenses.",
        "",
    ];
    for (const x of lista) {
        if (!x.licencia)
            sinLicencia.push(`${x.nombre}@${x.version} (${dist})`);
        else if (COPYLEFT.test(x.licencia) && !/\bOR\b/.test(x.licencia))
            conCopyleft.push(`${x.nombre}@${x.version}: ${x.licencia}`);
        partes.push("-".repeat(78), `${x.nombre} ${x.version} — ${x.licencia ?? "UNKNOWN"}`, "");
        for (const patron of [/^licen[cs]e(\.(md|txt|markdown))?$/i, /^notice(\.(md|txt))?$/i]) {
            const f = ficheroDe(x.dir, patron);
            if (f)
                partes.push(readFileSync(join(x.dir, f), "utf8").trim(), "");
        }
    }
    writeFileSync(join(dist, "THIRD_PARTY_LICENSES.txt"), partes.join("\n") + "\n");
    console.log(`✔ ${join(dist, "THIRD_PARTY_LICENSES.txt").padEnd(40)} ${lista.length} paquetes de terceros empaquetados`);
}
if (sinLicencia.length || conCopyleft.length) {
    throw new Error("c\u00F3digo de terceros empaquetado que no se puede redistribuir as\u00ED:\n"
        + sinLicencia.map((x) => `  sin licencia declarada: ${x}`).join("\n")
        + conCopyleft.map((x) => `  copyleft: ${x}`).join("\n")
        + "\n  S\u00E1calo del bundle (externa o diferida con otra fuente) o decide con el mantenedor y d\u00E9jalo escrito aqu\u00ED.");
}
console.log(`  deps externas (se resuelven en runtime desde node_modules): ${EXTERNAS_TODAS.join(", ")}`);
if (excedidos.length) {
    throw new Error(`paquete(s) por encima de su tope de tamaño:\n  ${excedidos.join("\n  ")}\n`
        + "  Mira si una dep pesada entr\u00F3 como import EST\u00C1TICO: el filtro por dominio es de runtime, as\u00ED\n"
        + "  que todo lo que no sea externo viaja en los TRES paquetes. Si el peso est\u00E1 justificado, sube\n"
        + "  el `topeMB` de ese paquete en build.mjs y di por qu\u00E9.");
}
