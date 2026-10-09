import { createRequire } from "node:module";
import type * as Cedar from "@cedar-policy/cedar-wasm/nodejs";
const requerir = createRequire(import.meta.url);
function cargar(): typeof Cedar {
    let ultimo: unknown;
    for (const p of ["./cedar-wasm/cedar_wasm.js", "@cedar-policy/cedar-wasm/nodejs"]) {
        try {
            return requerir(p);
        }
        catch (e) {
            ultimo = e;
        }
    }
    throw ultimo;
}
export const cedar = cargar();
export { prepararCedar, decidirCedar, validarEntidadesCedar } from "../../src/app/services/cedar";
