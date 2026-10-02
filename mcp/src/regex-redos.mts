import * as recheck from "recheck/lib/browser.js";
import { traducirDiagnostico as traducir } from "../../src/app/services/regex-redos.service";
export { traducirDiagnostico, sugerirReescritura } from "../../src/app/services/regex-redos.service";
type CheckSync = (source: string, flags: string, params?: Record<string, unknown>) => Parameters<typeof traducir>[0];
const mod = recheck as unknown as {
    checkSync?: CheckSync;
    default?: {
        checkSync?: CheckSync;
    };
};
export const checkSync = (mod.checkSync ?? mod.default?.checkSync)!;
