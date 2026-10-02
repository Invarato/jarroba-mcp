export interface JwtResult {
    header: Record<string, unknown>;
    payload: Record<string, unknown>;
    signature: string;
    expiresAt: Date | null;
    isExpired: boolean | null;
}
export class JwtService {
    decode(token: string): JwtResult | null {
        const parts = token.trim().split(".");
        if (parts.length !== 3)
            return null;
        try {
            const header = JSON.parse(this.b64urlDecode(parts[0]));
            const payload = JSON.parse(this.b64urlDecode(parts[1]));
            const exp = typeof payload["exp"] === "number" ? payload["exp"] : null;
            const expiresAt = exp !== null ? new Date(exp * 1000) : null;
            return {
                header,
                payload,
                signature: parts[2],
                expiresAt,
                isExpired: expiresAt !== null ? expiresAt < new Date() : null,
            };
        }
        catch {
            return null;
        }
    }
    private b64urlDecode(str: string): string {
        str = str.replace(/-/g, "+").replace(/_/g, "/");
        while (str.length % 4)
            str += "=";
        const binary = atob(str);
        const bytes = Uint8Array.from(binary, m => m.codePointAt(0)!);
        return new TextDecoder().decode(bytes);
    }
}
