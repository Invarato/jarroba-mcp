import { bytesToHex } from "../shared/bytes";
export interface HashResult {
    sha256: string;
    sha384: string;
    sha512: string;
}
export class HashService {
    async hash(input: string): Promise<HashResult> {
        const data = new TextEncoder().encode(input);
        const [sha256, sha384, sha512] = await Promise.all([
            this.digest(data, "SHA-256"),
            this.digest(data, "SHA-384"),
            this.digest(data, "SHA-512"),
        ]);
        return { sha256, sha384, sha512 };
    }
    private async digest(data: BufferSource, algorithm: string): Promise<string> {
        const buffer = await crypto.subtle.digest(algorithm, data);
        return bytesToHex(new Uint8Array(buffer));
    }
}
