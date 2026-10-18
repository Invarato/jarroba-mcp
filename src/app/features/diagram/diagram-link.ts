export type NodeLink = {
    kind: "url";
    url: string;
} | {
    kind: "page";
    id: string;
} | {
    kind: "frame";
    id: string;
};
export function safeUrl(raw: string | null | undefined): string | null {
    let s = (raw ?? "").trim();
    if (!s || s.length > 2048 || /\s/.test(s))
        return null;
    if (!/^[a-z][a-z0-9+.-]*:/i.test(s)) {
        if (!/^[\w-]+(\.[\w-]+)+([/:?#].*)?$/.test(s))
            return null;
        s = "https://" + s;
    }
    try {
        const u = new URL(s);
        if (u.protocol === "mailto:")
            return u.href;
        if ((u.protocol === "https:" || u.protocol === "http:") && u.hostname)
            return u.href;
    }
    catch { }
    return null;
}
export function parseLink(s: string | null | undefined): NodeLink | null {
    if (!s)
        return null;
    const m = /^(page|frame):(.+)$/.exec(s);
    if (m)
        return m[1] === "page" ? { kind: "page", id: m[2] } : { kind: "frame", id: m[2] };
    const url = safeUrl(s);
    return url ? { kind: "url", url } : null;
}
export function linkToString(l: NodeLink): string {
    return l.kind === "url" ? l.url : `${l.kind}:${l.id}`;
}
export interface LinkHitNode {
    id: string;
    x: number;
    y: number;
    w: number;
    h: number;
    rotation?: number;
    link?: string;
    hidden?: boolean;
}
export function linkAt(nodes: readonly LinkHitNode[], x: number, y: number): LinkHitNode | null {
    for (let i = nodes.length - 1; i >= 0; i--) {
        const n = nodes[i];
        if (n.hidden || !parseLink(n.link))
            continue;
        const a = -((n.rotation ?? 0) * Math.PI) / 180, dx = x - n.x, dy = y - n.y;
        const lx = dx * Math.cos(a) - dy * Math.sin(a), ly = dx * Math.sin(a) + dy * Math.cos(a);
        if (Math.abs(lx) <= n.w / 2 && Math.abs(ly) <= n.h / 2)
            return n;
    }
    return null;
}
