declare module "https://cdn.jsdelivr.net/pyodide/*/full/pyodide.mjs" {
    export function loadPyodide(opciones: {
        indexURL: string;
    }): Promise<unknown>;
}
