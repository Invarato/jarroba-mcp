export function partirCsv(fila: string, separador: string): string[] {
    if (fila.indexOf("\"") < 0)
        return fila.split(separador);
    const celdas: string[] = [];
    const n = fila.length, s = separador, ls = s.length;
    let i = 0;
    for (;;) {
        let celda = "";
        if (fila[i] === "\"") {
            i++;
            for (;;) {
                const q = fila.indexOf("\"", i);
                if (q < 0) {
                    celda += fila.slice(i);
                    i = n;
                    break;
                }
                celda += fila.slice(i, q);
                if (fila[q + 1] === "\"") {
                    celda += "\"";
                    i = q + 2;
                    continue;
                }
                i = q + 1;
                break;
            }
            const fin = fila.indexOf(s, i);
            if (fin < 0) {
                celda += fila.slice(i);
                celdas.push(celda);
                return celdas;
            }
            celda += fila.slice(i, fin);
            celdas.push(celda);
            i = fin + ls;
        }
        else {
            const fin = fila.indexOf(s, i);
            if (fin < 0) {
                celdas.push(fila.slice(i));
                return celdas;
            }
            celdas.push(fila.slice(i, fin));
            i = fin + ls;
        }
        if (i > n)
            return celdas;
        if (i === n) {
            celdas.push("");
            return celdas;
        }
    }
}
export function escaparCsv(celda: string, separador: string): string {
    if (celda.includes("\"") || celda.includes(separador) || celda.includes("\n") || celda.includes("\r")) {
        return "\"" + celda.replace(/"/g, "\"\"") + "\"";
    }
    return celda;
}
export function unirCsv(celdas: readonly string[], separador: string): string {
    return celdas.map(c => escaparCsv(c, separador)).join(separador);
}
export type Codificacion = "utf-8" | "windows-1252";
export function detectarCodificacion(bytes: Uint8Array): {
    codificacion: Codificacion | "utf-16";
    primerByteMalo?: number;
} {
    if (bytes.length >= 2 && ((bytes[0] === 255 && bytes[1] === 254) || (bytes[0] === 254 && bytes[1] === 255))) {
        return { codificacion: "utf-16" };
    }
    const mirar = bytes.length > 4 ? bytes.subarray(0, bytes.length - 3) : bytes;
    try {
        new TextDecoder("utf-8", { fatal: true }).decode(mirar);
        return { codificacion: "utf-8" };
    }
    catch { }
    for (let i = 0; i < mirar.length; i++) {
        const b = mirar[i];
        if (b < 128)
            continue;
        const largo = b >= 240 && b <= 244 ? 4 : b >= 224 ? 3 : b >= 194 && b <= 223 ? 2 : 0;
        let ok = largo > 0 && i + largo <= mirar.length;
        for (let k = 1; ok && k < largo; k++)
            ok = (mirar[i + k] & 192) === 128;
        if (!ok)
            return { codificacion: "windows-1252", primerByteMalo: i };
        i += largo - 1;
    }
    return { codificacion: "windows-1252" };
}
export function adivinarSeparador(lineas: readonly string[], candidatos: readonly string[] = [",", "\t", ";", "|"]): string {
    let mejor = candidatos[0], max = -1;
    for (const d of candidatos) {
        let c = 0;
        for (const l of lineas)
            c += partirCsv(l, d).length;
        if (c > max) {
            max = c;
            mejor = d;
        }
    }
    return mejor;
}
