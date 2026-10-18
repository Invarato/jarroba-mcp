export interface FileSource {
    readonly size: number;
    readonly name: string;
    readRange(start: number, end: number): Promise<Uint8Array>;
    readonly encoding?: string;
}
export function decodificador(src: Pick<FileSource, "encoding">): TextDecoder {
    return new TextDecoder(src.encoding ?? "utf-8");
}
export function fileSource(blob: Blob, name = "", encoding?: string): FileSource {
    const size = blob.size;
    return {
        size,
        name: name || ((blob as File).name ?? ""),
        encoding,
        async readRange(start: number, end: number): Promise<Uint8Array> {
            const a = Math.max(0, Math.min(start, size));
            const b = Math.max(a, Math.min(end, size));
            if (b === a)
                return new Uint8Array(0);
            return new Uint8Array(await blob.slice(a, b).arrayBuffer());
        },
    };
}
