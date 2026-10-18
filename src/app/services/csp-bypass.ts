import { JSONP_NECESITA_EVAL, URLS_ANGULAR, URLS_JSONP } from "./csp-bypass-datos";
export interface BypassCsp {
    fuente: string;
    url: string;
    tipo: "jsonp" | "angular";
}
const conEsquema = (u: string) => (u.startsWith("//") ? "https:" + u : /^[a-z][a-z0-9+.-]*:\/\//i.test(u) ? u : "https://" + u);
export function casaFuente(fuente: string, lista: readonly string[]): URL | null {
    let csp: URL;
    try {
        csp = new URL(conEsquema(fuente.replace(":*", "").replace("*", "comodin-jt")));
    }
    catch {
        return null;
    }
    const host = csp.hostname.toLowerCase();
    const conComodin = host.startsWith("comodin-jt.");
    const sinComodin = host.replace(/^comodin-jt/, "");
    const ruta = csp.pathname, conRuta = ruta !== "/";
    for (const u of lista) {
        let url: URL;
        try {
            url = new URL(conEsquema(u));
        }
        catch {
            continue;
        }
        if (!url.hostname.endsWith(sinComodin))
            continue;
        if (!conComodin && host !== url.hostname)
            continue;
        if (conRuta && (ruta.endsWith("/") ? !url.pathname.startsWith(ruta) : url.pathname !== ruta))
            continue;
        return url;
    }
    return null;
}
export function bypassesCsp(fuentesScript: readonly string[]): BypassCsp[] {
    if (fuentesScript.includes("'none'") || fuentesScript.includes("'strict-dynamic'"))
        return [];
    const hayEval = fuentesScript.includes("'unsafe-eval'");
    const out: BypassCsp[] = [];
    for (const f of fuentesScript) {
        if (f.startsWith("'") || !f.includes(".") || /^[a-z][a-z0-9+.-]*:$/i.test(f))
            continue;
        let jsonp = casaFuente(f, URLS_JSONP);
        if (jsonp && JSONP_NECESITA_EVAL.includes(jsonp.hostname) && !hayEval)
            jsonp = null;
        const angular = casaFuente(f, URLS_ANGULAR);
        if (jsonp)
            out.push({ fuente: f, url: jsonp.href, tipo: "jsonp" });
        if (angular)
            out.push({ fuente: f, url: angular.href, tipo: "angular" });
    }
    return out;
}
