import { Tokenizer } from "@huggingface/tokenizers";
import { readFile } from "node:fs/promises";
import { brotliDecompressSync } from "node:zlib";
const SITIOS = [new URL("./tokenizers/", import.meta.url), new URL("../vendor/tokenizers/", import.meta.url)];
const cargados = new Map<string, Promise<Tokenizer>>();
async function cargar(id: string): Promise<Tokenizer> {
    let ultimo: unknown;
    for (const base of SITIOS) {
        try {
            const { tokenizer, config } = JSON.parse(brotliDecompressSync(await readFile(new URL(`${id}.json.br`, base))).toString("utf8"));
            return new Tokenizer(tokenizer, config);
        }
        catch (e) {
            ultimo = e;
        }
    }
    throw ultimo;
}
export async function contarAbierto(id: string, texto: string): Promise<number> {
    let p = cargados.get(id);
    if (!p) {
        p = cargar(id);
        cargados.set(id, p);
        p.catch(() => cargados.delete(id));
    }
    return (await p).encode(texto, { add_special_tokens: false }).ids.length;
}
