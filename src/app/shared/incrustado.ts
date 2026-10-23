interface EstadoIncrustado {
    part: string | null;
    theme: string | null;
}
const estado = (): EstadoIncrustado | null => typeof window === "undefined" ? null : ((window as unknown as {
    __jtIncrustado?: EstadoIncrustado;
}).__jtIncrustado ?? null);
export function esIncrustado(): boolean { return estado() !== null; }
export function vistaIncrustada(): string | null { return estado()?.part ?? null; }
export function temaIncrustado(): "dark" | "light" | null {
    const t = estado()?.theme;
    return t === "dark" || t === "light" ? t : null;
}
const DEL_MARCO = ["embed", "part", "theme"];
export function enlaceCompleto(href: string): string {
    try {
        const u = new URL(href);
        for (const p of DEL_MARCO)
            u.searchParams.delete(p);
        return u.toString();
    }
    catch {
        return href;
    }
}
export const VERSION_CONTRATO = 1;
export function avisarAltura(el: HTMLElement): () => void {
    if (typeof window === "undefined" || window.parent === window)
        return () => { };
    const enviar = (msg: Record<string, unknown>) => { try {
        window.parent.postMessage({ v: VERSION_CONTRATO, ...msg }, location.origin);
    }
    catch { } };
    enviar({ jt: "listo" });
    let ultima = -1;
    const medir = () => {
        const h = Math.ceil(el.scrollHeight);
        if (h !== ultima) {
            ultima = h;
            enviar({ jt: "altura", h });
        }
    };
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    medir();
    return () => ro.disconnect();
}
export function escucharTema(): () => void {
    if (typeof window === "undefined")
        return () => { };
    const f = (e: MessageEvent) => {
        if (e.origin !== location.origin)
            return;
        const d = e.data as {
            jt?: string;
            valor?: string;
        } | null;
        if (d?.jt === "tema" && (d.valor === "dark" || d.valor === "light")) {
            document.documentElement.setAttribute("data-theme", d.valor);
            const s = estado();
            if (s)
                s.theme = d.valor;
        }
    };
    window.addEventListener("message", f);
    return () => window.removeEventListener("message", f);
}
