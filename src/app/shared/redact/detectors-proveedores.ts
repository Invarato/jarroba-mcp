import { Detector } from "./detectors";
import { GITLEAKS_VERSION, REGLAS_GITLEAKS } from "./detectors-gitleaks";
export { GITLEAKS_VERSION };
export const ID_PROVEEDORES = "proveedores";
export const DETECTORES_PROVEEDORES: readonly Detector[] = REGLAS_GITLEAKS.map(r => ({
    id: r.id,
    label: r.id.slice(3),
    category: "secret",
    regex: r.regex,
    group: r.group,
    entropyMin: r.entropyMin,
    keywords: r.keywords,
    placeholder: "REDACTED",
}));
export function esDeProveedor(id: string): boolean { return id.startsWith("gl:"); }
