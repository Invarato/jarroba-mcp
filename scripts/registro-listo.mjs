import { paquetesMcp } from "./lib/mcp-paquetes.mjs";
const TOPE_MS = Number(process.env.REGISTRO_LISTO_MIN || 6) * 60 * 1000;
const CADA_MS = 10 * 1000;
const paquetes = paquetesMcp();
if (!paquetes.length) {
    console.error("\u2717 no encuentro ning\u00FAn paquete publicable bajo mcp/ (package.json + server.json)");
    process.exit(1);
}
async function mira({ rel, pkg }) {
    const url = `https://registry.npmjs.org/${pkg.name}/${pkg.version}`;
    let r;
    try {
        r = await fetch(url);
    }
    catch (e) {
        return { espera: `${pkg.name}@${pkg.version}: sin red (${String(e.message ?? e).slice(0, 60)})` };
    }
    if (r.status === 404)
        return { espera: `${pkg.name}@${pkg.version}: todavía no la sirve npm` };
    if (!r.ok)
        return { espera: `${pkg.name}@${pkg.version}: npm contestó ${r.status}` };
    const publicado = await r.json();
    if (publicado.mcpName !== pkg.mcpName) {
        return { error: `${pkg.name}@${pkg.version}: el mcpName PUBLICADO es "${publicado.mcpName}" y aquí dice "${pkg.mcpName}".`
                + " El registro leer\u00E1 el publicado y contestar\u00E1 403. Sube una versi\u00F3n y vuelve a publicar en npm." };
    }
    return { ok: `${pkg.name}@${pkg.version} · ${publicado.mcpName}  (${rel})` };
}
const t0 = Date.now();
let vuelta = 0;
for (;;) {
    vuelta++;
    const res = await Promise.all(paquetes.map(mira));
    const errores = res.filter((x) => x.error).map((x) => x.error);
    if (errores.length) {
        console.error("\u2717 registro:listo \u2014 esto no se arregla esperando:\n");
        for (const e of errores)
            console.error(`   ${e}`);
        process.exit(1);
    }
    const listos = res.filter((x) => x.ok).map((x) => x.ok);
    const faltan = res.filter((x) => x.espera).map((x) => x.espera);
    if (!faltan.length) {
        for (const l of listos)
            console.log(`  ✓ ${l}`);
        console.log(`\n✓ npm sirve las ${listos.length} versiones. Ya puedes lanzar la ronda del registro:\n`);
        console.log("    mcp-publisher login github \\");
        for (const p of paquetes) {
            const cd = p.rel === "mcp" ? "" : `cd ${p.rel.replace(/^mcp\//, "")} && `;
            console.log(`      && (${cd}mcp-publisher publish) \\`);
        }
        console.log("      && curl -s \"https://registry.modelcontextprotocol.io/v0.1/servers?search=io.github.Invarato\"\n");
        process.exit(0);
    }
    if (Date.now() - t0 > TOPE_MS) {
        console.error(`\n✗ registro:listo — ${Math.round(TOPE_MS / 60000)} minutos y npm sigue sin servir:\n`);
        for (const f of faltan)
            console.error(`   ${f}`);
        console.error("\n  Con esta espera ya no es propagaci\u00F3n: comprueba que `npm publish` lleg\u00F3 a terminar");
        console.error("  para ese paquete (el que pide reautenticaci\u00F3n por navegador se puede quedar a medias).");
        process.exit(1);
    }
    const seg = Math.round((Date.now() - t0) / 1000);
    console.log(`· vuelta ${vuelta} (${seg}s) — listos ${listos.length}/${paquetes.length}; falta: ${faltan.join(" \u00B7 ")}`);
    await new Promise((r) => setTimeout(r, CADA_MS));
}
