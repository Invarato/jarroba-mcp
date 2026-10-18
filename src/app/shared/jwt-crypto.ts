import { base64url, fromBase64url } from "./b64url";
export type JwtAlg = "HS256" | "HS384" | "HS512" | "RS256" | "RS384" | "RS512" | "PS256" | "PS384" | "PS512" | "ES256" | "ES384" | "ES512";
export const JWT_ALGS: JwtAlg[] = [
    "HS256",
    "HS384",
    "HS512",
    "RS256",
    "RS384",
    "RS512",
    "PS256",
    "PS384",
    "PS512",
    "ES256",
    "ES384",
    "ES512",
];
export type AlgFamily = "HMAC" | "RSA" | "RSA-PSS" | "EC";
export function algFamily(alg: JwtAlg): AlgFamily {
    const p = alg.slice(0, 2);
    if (p === "HS")
        return "HMAC";
    if (p === "RS")
        return "RSA";
    if (p === "PS")
        return "RSA-PSS";
    return "EC";
}
export function isSymmetric(alg: JwtAlg): boolean { return algFamily(alg) === "HMAC"; }
const enc = new TextEncoder();
const dec = new TextDecoder();
export { base64url, fromBase64url } from "./b64url";
function fromBase64(b64: string): Uint8Array {
    const bin = atob(b64.replace(/\s+/g, ""));
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++)
        out[i] = bin.charCodeAt(i);
    return out;
}
const b64urlJson = (o: unknown) => base64url(enc.encode(JSON.stringify(o)));
const hashOf = (alg: JwtAlg) => `SHA-${alg.slice(2)}`;
const saltLen = (alg: JwtAlg) => Number(alg.slice(2)) / 8;
const curveOf = (alg: JwtAlg) => (({ ES256: "P-256", ES384: "P-384", ES512: "P-521" } as Record<string, string>)[alg] ?? "P-256");
function importAlg(alg: JwtAlg): AlgorithmIdentifier | RsaHashedImportParams | EcKeyImportParams | HmacImportParams {
    switch (algFamily(alg)) {
        case "HMAC": return { name: "HMAC", hash: hashOf(alg) };
        case "RSA": return { name: "RSASSA-PKCS1-v1_5", hash: hashOf(alg) };
        case "RSA-PSS": return { name: "RSA-PSS", hash: hashOf(alg) };
        case "EC": return { name: "ECDSA", namedCurve: curveOf(alg) };
    }
}
function signAlg(alg: JwtAlg): AlgorithmIdentifier | RsaPssParams | EcdsaParams {
    switch (algFamily(alg)) {
        case "HMAC": return { name: "HMAC" };
        case "RSA": return { name: "RSASSA-PKCS1-v1_5" };
        case "RSA-PSS": return { name: "RSA-PSS", saltLength: saltLen(alg) };
        case "EC": return { name: "ECDSA", hash: hashOf(alg) };
    }
}
function genAlg(alg: JwtAlg): RsaHashedKeyGenParams | EcKeyGenParams | HmacKeyGenParams {
    switch (algFamily(alg)) {
        case "HMAC": return { name: "HMAC", hash: hashOf(alg) };
        case "RSA": return { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: hashOf(alg) };
        case "RSA-PSS": return { name: "RSA-PSS", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: hashOf(alg) };
        case "EC": return { name: "ECDSA", namedCurve: curveOf(alg) };
    }
}
function pemToDer(pem: string): Uint8Array {
    const b64 = pem.replace(/-----(BEGIN|END)[^-]*-----/g, "").replace(/\s+/g, "");
    return fromBase64(b64);
}
export type FormatoSecreto = "texto" | "base64" | "hex";
export function bytesDeSecreto(texto: string, formato: FormatoSecreto): Uint8Array | null {
    if (formato === "texto")
        return new TextEncoder().encode(texto);
    const t = texto.trim();
    if (formato === "hex") {
        if (!/^([0-9a-fA-F]{2})*$/.test(t))
            return null;
        return Uint8Array.from(t.match(/../g) ?? [], h => parseInt(h, 16));
    }
    if (!/^[A-Za-z0-9+/_-]*={0,2}$/.test(t) || t.replace(/=+$/, "").length % 4 === 1)
        return null;
    try {
        const b64 = t.replace(/-/g, "+").replace(/_/g, "/").replace(/=+$/, "");
        const bin = atob(b64 + "===".slice((b64.length + 3) % 4));
        return Uint8Array.from(bin, c => c.charCodeAt(0));
    }
    catch {
        return null;
    }
}
export function importHmacKey(secret: string, alg: JwtAlg, usage: KeyUsage, formato: FormatoSecreto = "texto"): Promise<CryptoKey> {
    const bytes = bytesDeSecreto(secret, formato);
    if (!bytes)
        return Promise.reject(new Error(`secreto no válido en formato ${formato}`));
    return crypto.subtle.importKey("raw", bytes as BufferSource, importAlg(alg) as HmacImportParams, false, [usage]);
}
async function importAsymmetric(alg: JwtAlg, keyText: string, usage: "verify" | "sign"): Promise<CryptoKey> {
    const text = keyText.trim();
    if (text.startsWith("{")) {
        const jwk = JSON.parse(text) as JsonWebKey;
        return crypto.subtle.importKey("jwk", jwk, importAlg(alg) as RsaHashedImportParams | EcKeyImportParams, false, [usage]);
    }
    const der = pemToDer(text);
    const format = usage === "sign" ? "pkcs8" : "spki";
    return crypto.subtle.importKey(format, der as BufferSource, importAlg(alg) as RsaHashedImportParams | EcKeyImportParams, false, [usage]);
}
export function importVerifyKey(alg: JwtAlg, keyText: string, formato: FormatoSecreto = "texto"): Promise<CryptoKey> {
    return isSymmetric(alg) ? importHmacKey(keyText, alg, "verify", formato) : importAsymmetric(alg, keyText, "verify");
}
export function importSignKey(alg: JwtAlg, keyText: string, formato: FormatoSecreto = "texto"): Promise<CryptoKey> {
    return isSymmetric(alg) ? importHmacKey(keyText, alg, "sign", formato) : importAsymmetric(alg, keyText, "sign");
}
export async function signJwt(header: Record<string, unknown>, payload: Record<string, unknown>, alg: JwtAlg, key: CryptoKey): Promise<string> {
    const signingInput = `${b64urlJson({ ...header, alg })}.${b64urlJson(payload)}`;
    const sig = await crypto.subtle.sign(signAlg(alg), key, enc.encode(signingInput));
    return `${signingInput}.${base64url(new Uint8Array(sig))}`;
}
export async function signJwtWithKeyText(header: Record<string, unknown>, payload: Record<string, unknown>, alg: JwtAlg, keyText: string): Promise<string> {
    return signJwt(header, payload, alg, await importSignKey(alg, keyText));
}
export async function verifySignature(token: string, alg: JwtAlg, key: CryptoKey): Promise<boolean> {
    const parts = token.split(".");
    if (parts.length !== 3 || !parts[2])
        return false;
    return crypto.subtle.verify(signAlg(alg), key, fromBase64url(parts[2]) as BufferSource, enc.encode(`${parts[0]}.${parts[1]}`));
}
export function generateKeyPair(alg: JwtAlg): Promise<CryptoKeyPair> {
    return crypto.subtle.generateKey(genAlg(alg) as RsaHashedKeyGenParams | EcKeyGenParams, true, ["sign", "verify"]) as Promise<CryptoKeyPair>;
}
export function exportJwk(key: CryptoKey): Promise<JsonWebKey> {
    return crypto.subtle.exportKey("jwk", key) as Promise<JsonWebKey>;
}
export async function exportPem(key: CryptoKey): Promise<string> {
    const isPrivate = key.type === "private";
    const der = new Uint8Array(await crypto.subtle.exportKey(isPrivate ? "pkcs8" : "spki", key));
    const label = isPrivate ? "PRIVATE KEY" : "PUBLIC KEY";
    const b64 = btoa(String.fromCharCode(...der)).replace(/(.{64})/g, "$1\n");
    return `-----BEGIN ${label}-----\n${b64}\n-----END ${label}-----`;
}
export function decodeJson(part: string): Record<string, unknown> | null {
    try {
        return JSON.parse(dec.decode(fromBase64url(part)));
    }
    catch {
        return null;
    }
}
export interface DecodedToken {
    header: Record<string, unknown>;
    payload: Record<string, unknown>;
    signature: string;
}
export function decodeToken(token: string): DecodedToken | null {
    const parts = token.trim().split(".");
    if (parts.length !== 3)
        return null;
    const header = decodeJson(parts[0]);
    const payload = decodeJson(parts[1]);
    if (!header || !payload)
        return null;
    return { header, payload, signature: parts[2] };
}
