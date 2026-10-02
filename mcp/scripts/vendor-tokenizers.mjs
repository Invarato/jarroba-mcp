import { brotliCompressSync, constants } from "node:zlib";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
export const TOKENIZADORES = [
    { id: "qwen3", repo: "Qwen/Qwen3-0.6B", revision: "c1899de289a04d12100db370d81485cdf75e47ca", licencia: "Apache-2.0" },
    { id: "mistral-v3", repo: "mistralai/Mistral-7B-Instruct-v0.3", revision: "c170c708c41dac9275d15a8fff4eca08d52bab71", licencia: "Apache-2.0" },
];
const destino = join(dirname(fileURLToPath(import.meta.url)), "..", "vendor", "tokenizers");
mkdirSync(destino, { recursive: true });
const lineas = ["Tokenizers bundled with @jarroba/mcp for `count_tokens`", "", "Downloaded from Hugging Face at a pinned revision by mcp/scripts/vendor-tokenizers.mjs.", ""];
for (const t of TOKENIZADORES) {
    const url = (f) => `https://huggingface.co/${t.repo}/resolve/${t.revision}/${f}`;
    const bajar = async (f) => { const r = await fetch(url(f)); if (!r.ok)
        throw new Error(`${url(f)}: ${r.status}`); return r.text(); };
    const tok = JSON.parse(await bajar("tokenizer.json"));
    const { chat_template: _, ...config } = JSON.parse(await bajar("tokenizer_config.json"));
    const datos = JSON.stringify({ tokenizer: tok, config });
    const br = brotliCompressSync(datos, { params: { [constants.BROTLI_PARAM_QUALITY]: 11, [constants.BROTLI_PARAM_SIZE_HINT]: datos.length } });
    writeFileSync(join(destino, `${t.id}.json.br`), br);
    const sha = createHash("sha256").update(br).digest("hex");
    console.log(`✔ ${t.id.padEnd(12)} ${(br.length / 1000000).toFixed(2)} MB  ${t.repo}@${t.revision.slice(0, 8)}  sha256 ${sha.slice(0, 12)}`);
    lineas.push("-".repeat(78), `${t.id}: tokenizer of ${t.repo}`, `  https://huggingface.co/${t.repo}/tree/${t.revision}`, `  License: ${t.licencia} (https://www.apache.org/licenses/LICENSE-2.0)`, `  sha256 of ${t.id}.json.br: ${sha}`, "");
}
writeFileSync(join(destino, "NOTICE.txt"), lineas.join("\n"));
