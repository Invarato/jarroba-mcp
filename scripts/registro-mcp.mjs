import { paquetesMcp } from "./lib/mcp-paquetes.mjs";
import { recuento } from "../mcp/src/catalogo.ts";
import { LIMITES_REGISTRO_MCP as LIMITES } from "../src/app/shared/mcp-registry-limits.ts";
const PAQUETES = paquetesMcp();
const problemas = [];
if (!PAQUETES.length)
    problemas.push("no encuentro ning\u00FAn paquete bajo mcp/ con package.json + server.json");
for (const { rel, pkg: p, server: s } of PAQUETES) {
    for (const [campo, r] of Object.entries(LIMITES)) {
        const v = s[campo];
        if (v === undefined)
            continue;
        if (r.maxLength && v.length > r.maxLength)
            problemas.push(`${rel} · ${campo}: ${v.length} caracteres, el máximo es ${r.maxLength}`);
        if (r.minLength && v.length < r.minLength)
            problemas.push(`${rel} · ${campo}: ${v.length} caracteres, el mínimo es ${r.minLength}`);
        if (r.pattern && !r.pattern.test(v))
            problemas.push(`${rel} · ${campo}: "${v}" no casa con ${r.pattern}`);
    }
    const url = typeof p.repository === "string" ? p.repository : (p.repository?.url ?? "");
    const dueño = url.match(/github\.com[:/]([^/]+)\//)?.[1];
    if (!dueño) {
        problemas.push(`${rel}: no puedo derivar el usuario de GitHub de repository.url ("${url}")`);
    }
    else {
        const esperado = `io.github.${dueño}/`;
        if (!s.name?.startsWith(esperado)) {
            const mismoSinCaso = s.name?.toLowerCase().startsWith(esperado.toLowerCase());
            problemas.push(`${rel} · name "${s.name}" no empieza por "${esperado}"`
                + (mismoSinCaso ? " \u2014 solo se diferencia en las MAY\u00DASCULAS, y el registro las distingue (403)" : ""));
        }
    }
    const npmPkg = s.packages?.[0] ?? {};
    if (s.name !== p.mcpName)
        problemas.push(`${rel} · server.json.name ("${s.name}") ≠ package.json.mcpName ("${p.mcpName}")`);
    if (npmPkg.identifier !== p.name)
        problemas.push(`${rel} · packages[0].identifier ("${npmPkg.identifier}") ≠ package.json.name ("${p.name}")`);
    if (npmPkg.version !== p.version)
        problemas.push(`${rel} · packages[0].version ("${npmPkg.version}") ≠ package.json.version ("${p.version}")`);
    if (s.version !== p.version)
        problemas.push(`${rel} · server.json.version ("${s.version}") ≠ package.json.version ("${p.version}")`);
    if (rel === "mcp") {
        const total = String(recuento().total);
        for (const [fichero, obj] of [["server.json", s], ["package.json", p]]) {
            const v = String(obj.description ?? "");
            if (!v.includes(total)) {
                const viejo = v.match(/\b(\d{2,3}) deterministic\b/)?.[1];
                problemas.push(`${rel}/${fichero} · description no cita el recuento real (${total})`
                    + (viejo ? ` — dice "${viejo}", desfasado` : ""));
            }
        }
    }
}
if (problemas.length) {
    console.error("\u2717 registro-mcp: estos `server.json` los rechazar\u00EDa el registro\n");
    for (const p of problemas)
        console.error(`   ${p}`);
    console.error("\n  El registro contesta 422 y de uno en uno, as\u00ED que sale m\u00E1s barato aqu\u00ED.");
    process.exit(1);
}
console.log(`✓ registro-mcp: los ${PAQUETES.length} server.json cuadran con su paquete y caben en los límites.`);
