import registro from "../../public/practicas.json";
import type { Registro } from "../../src/app/shared/practicas/practicas";
export { consultar } from "../../src/app/shared/practicas/practicas";
export const REGISTRO = registro as unknown as Registro;
