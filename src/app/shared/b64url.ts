export function base64url(bytes: Uint8Array): string {
    let s = "";
    for (const b of bytes)
        s += String.fromCharCode(b);
    return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export function fromBase64url(s: string): Uint8Array {
    const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
    const bin = atob(b64.replace(/\s+/g, ""));
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++)
        out[i] = bin.charCodeAt(i);
    return out;
}
export function aB64url(texto: string): string {
    return base64url(new TextEncoder().encode(texto));
}
export function deB64url(b64: string): string | null {
    if (!/^[A-Za-z0-9_-]*$/.test(b64))
        return null;
    try {
        return new TextDecoder("utf-8", { fatal: true }).decode(fromBase64url(b64));
    }
    catch {
        return null;
    }
}
