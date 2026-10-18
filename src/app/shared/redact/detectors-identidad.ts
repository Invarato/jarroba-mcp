import type { Detector } from "./detectors";
const digitos = (s: string) => s.replace(/\D/g, "");
const todosIguales = (s: string) => /^(.)\1*$/.test(s);
export function cpfValido(raw: string): boolean {
    const d = digitos(raw).slice(-11);
    if (d.length !== 11 || todosIguales(d))
        return false;
    const dv = (n: number) => {
        let s = 0;
        for (let i = 0; i < n; i++)
            s += +d[i] * (n + 1 - i);
        const r = s % 11;
        return r < 2 ? 0 : 11 - r;
    };
    return dv(9) === +d[9] && dv(10) === +d[10];
}
export function cnpjValido(raw: string): boolean {
    const c = raw.toUpperCase().replace(/[^0-9A-Z]/g, "").slice(-14);
    if (c.length !== 14 || !/^[0-9A-Z]{12}\d{2}$/.test(c) || todosIguales(c))
        return false;
    const val = (ch: string) => ch.charCodeAt(0) - 48;
    const dv = (pesos: number[]) => {
        let s = 0;
        pesos.forEach((p, i) => { s += val(c[i]) * p; });
        const r = s % 11;
        return r < 2 ? 0 : 11 - r;
    };
    return dv([5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) === +c[12] && dv([6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) === +c[13];
}
export function nifPtValido(raw: string): boolean {
    const d = digitos(raw).slice(-9);
    if (d.length !== 9 || !/^(?:[1235689]|45|7[0-9])/.test(d))
        return false;
    let s = 0;
    for (let i = 0; i < 8; i++)
        s += +d[i] * (9 - i);
    const r = s % 11;
    return (r < 2 ? 0 : 11 - r) === +d[8];
}
export function nirValido(raw: string): boolean {
    const s = raw.toUpperCase().replace(/\s/g, "");
    if (!/^[12478]\d{4}(?:\d{2}|2[AB])\d{8}$/.test(s))
        return false;
    const n13 = s.slice(0, 13).replace(/^(.{5})2A/, "$119").replace(/^(.{5})2B/, "$118");
    let r = 0;
    for (const ch of n13)
        r = (r * 10 + +ch) % 97;
    return 97 - r === +s.slice(13);
}
export function steuerIdValido(raw: string): boolean {
    const d = digitos(raw).slice(-11);
    if (d.length !== 11 || d[0] === "0")
        return false;
    const cuenta = new Map<string, number>();
    for (const ch of d.slice(0, 10))
        cuenta.set(ch, (cuenta.get(ch) ?? 0) + 1);
    const rep = [...cuenta.values()].filter(n => n > 1);
    if (rep.length !== 1 || (rep[0] !== 2 && rep[0] !== 3))
        return false;
    let prod = 10;
    for (let i = 0; i < 10; i++) {
        let sum = (+d[i] + prod) % 10;
        if (sum === 0)
            sum = 10;
        prod = (sum * 2) % 11;
    }
    let check = 11 - prod;
    if (check === 10)
        check = 0;
    return check === +d[10];
}
export function nhsValido(raw: string): boolean {
    const d = digitos(raw).slice(-10);
    if (d.length !== 10 || todosIguales(d))
        return false;
    let s = 0;
    for (let i = 0; i < 9; i++)
        s += +d[i] * (10 - i);
    let c = 11 - (s % 11);
    if (c === 11)
        c = 0;
    return c !== 10 && c === +d[9];
}
export function bsnValido(raw: string): boolean {
    const d = digitos(raw).slice(-9);
    if (d.length !== 9 || todosIguales(d))
        return false;
    let s = 0;
    for (let i = 0; i < 8; i++)
        s += +d[i] * (9 - i);
    s -= +d[8];
    return s % 11 === 0;
}
export function cifValido(raw: string): boolean {
    const s = raw.toUpperCase().replace(/-/g, "");
    const m = /^([ABCDEFGHJNPQRSUVW])(\d{7})([0-9A-J])$/.exec(s);
    if (!m)
        return false;
    const [, tipo, num, ctrl] = m;
    let suma = 0;
    for (let i = 0; i < 7; i++) {
        const n = +num[i];
        if (i % 2 === 1)
            suma += n;
        else {
            const x = n * 2;
            suma += Math.floor(x / 10) + (x % 10);
        }
    }
    const dc = (10 - (suma % 10)) % 10;
    const letra = "JABCDEFGHI"[dc];
    if ("KPQSNW".includes(tipo))
        return ctrl === letra;
    if ("ABEH".includes(tipo))
        return ctrl === String(dc);
    return ctrl === String(dc) || ctrl === letra;
}
const HUECO = "[^\\n\\d]{0,20}";
const HUECO_SIN_LETRAS = "[^\\n\\dA-Za-z]{0,12}";
export const DETECTORES_IDENTIDAD: Detector[] = [
    { id: "cpf", label: "CPF (Brasil)", category: "id", validate: cpfValido, regex: /(?<![\d.])\d{3}\.\d{3}\.\d{3}-\d{2}(?![\d-])/g, placeholder: "000.000.000-00" },
    { id: "cpf", label: "CPF (Brasil)", category: "id", validate: cpfValido, keywords: ["cpf"], group: 1, regex: new RegExp(`\\bCPF\\b${HUECO}(\\d{3}\\.?\\d{3}\\.?\\d{3}-?\\d{2})(?![\\d-])`, "gi"), placeholder: "000.000.000-00" },
    { id: "cnpj", label: "CNPJ (Brasil)", category: "id", validate: cnpjValido, regex: /(?<![\dA-Za-z.])[\dA-Z]{2}\.[\dA-Z]{3}\.[\dA-Z]{3}\/[\dA-Z]{4}-\d{2}(?![\d-])/g, placeholder: "00.000.000/0000-00" },
    { id: "cnpj", label: "CNPJ (Brasil)", category: "id", validate: cnpjValido, keywords: ["cnpj"], group: 1, regex: new RegExp(`\\bCNPJ\\b${HUECO_SIN_LETRAS}([\\dA-Z]{2}\\.?[\\dA-Z]{3}\\.?[\\dA-Z]{3}\\/?[\\dA-Z]{4}-?\\d{2})(?![\\dA-Za-z])`, "gi"), placeholder: "00.000.000/0000-00" },
    { id: "cif", label: "CIF (Espa\u00F1a)", category: "id", validate: cifValido, regex: /\b[ABCDEFGHJNPQRSUVW]-?\d{7}-?[0-9A-J]\b/g, placeholder: "X0000000X" },
    { id: "nif-pt", label: "NIF (Portugal)", category: "id", validate: nifPtValido, keywords: ["nif", "nipc", "contribuinte"], group: 1, regex: new RegExp(`\\b(?:NIF|NIPC|contribuinte)\\b${HUECO}(\\d{3} ?\\d{3} ?\\d{3})(?!\\d)`, "gi"), placeholder: "000000000" },
    { id: "nif-pt", label: "NIF (Portugal)", category: "id", validate: nifPtValido, regex: /\bPT ?\d{9}\b/g, placeholder: "PT000000000" },
    { id: "nir", label: "NIR (Francia)", category: "id", validate: nirValido, regex: /(?<![\dA-Za-z])[12478] ?\d{2} ?\d{2} ?(?:\d{2}|2[ABab]) ?\d{3} ?\d{3} ?\d{2}(?!\d)/g, placeholder: "0 00 00 00 000 000 00" },
    { id: "steuer-id", label: "Steuer-ID (Alemania)", category: "id", validate: steuerIdValido, keywords: ["steuer", "idnr", "identifikationsnummer"], group: 1, regex: new RegExp(`\\b(?:Steuer-?ID|Steuer-?Identifikationsnummer|Steueridentifikationsnummer|IdNr|Identifikationsnummer)\\b${HUECO}(\\d{2} ?\\d{3} ?\\d{3} ?\\d{3})(?!\\d)`, "gi"), placeholder: "00000000000" },
    { id: "nhs", label: "NHS (Reino Unido)", category: "id", validate: nhsValido, keywords: ["nhs"], group: 1, regex: new RegExp(`\\bNHS\\b${HUECO}(\\d{3}[ -]?\\d{3}[ -]?\\d{4})(?!\\d)`, "gi"), placeholder: "000 000 0000" },
    { id: "bsn", label: "BSN (Pa\u00EDses Bajos)", category: "id", validate: bsnValido, keywords: ["bsn", "burgerservicenummer", "sofinummer"], group: 1, regex: new RegExp(`\\b(?:BSN|burgerservicenummer|sofinummer)\\b${HUECO}(\\d{4}\\.\\d{2}\\.\\d{3}|\\d{3}[ .]?\\d{3}[ .]?\\d{3})(?!\\d)`, "gi"), placeholder: "000000000" },
];
