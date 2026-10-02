import type { EsquemaVersion } from "../../src/app/services/k8s-esquema";
import v133 from "../../public/datos/k8s/esquema-1.33.json";
import v134 from "../../public/datos/k8s/esquema-1.34.json";
import v135 from "../../public/datos/k8s/esquema-1.35.json";
import v136 from "../../public/datos/k8s/esquema-1.36.json";
import v137 from "../../public/datos/k8s/esquema-1.37.json";
export const ESQUEMAS_K8S = { "1.33": v133, "1.34": v134, "1.35": v135, "1.36": v136, "1.37": v137 } as unknown as Record<string, EsquemaVersion>;
