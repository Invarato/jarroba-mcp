export function bytesToHex(bytes: Uint8Array | ArrayBuffer, opts: {
    upper?: boolean;
    sep?: string;
} = {}): string {
    const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    const sep = opts.sep ?? "";
    let out = "";
    for (let i = 0; i < arr.length; i++) {
        const h = arr[i].toString(16).padStart(2, "0");
        out += (i && sep ? sep : "") + (opts.upper ? h.toUpperCase() : h);
    }
    return out;
}
export function hexToBytes(hex: string): Uint8Array {
    const clean = hex.replace(/[^0-9a-fA-F]/g, "");
    const out = new Uint8Array(Math.floor(clean.length / 2));
    for (let i = 0; i < out.length; i++)
        out[i] = parseInt(clean.substr(i * 2, 2), 16);
    return out;
}
