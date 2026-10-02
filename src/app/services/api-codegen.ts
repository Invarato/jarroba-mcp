import { ApiCampo, ApiPeticion, unirUrl } from "./api-ir";
export type Lenguaje = "curl" | "fetch" | "axios" | "python" | "httpie" | "go" | "java" | "csharp" | "php" | "powershell" | "rust";
export interface InfoLenguaje {
    id: Lenguaje;
    etiqueta: string;
    modo: string;
}
export const LENGUAJES: InfoLenguaje[] = [
    { id: "curl", etiqueta: "cURL", modo: "shell" },
    { id: "fetch", etiqueta: "JavaScript (fetch)", modo: "javascript" },
    { id: "axios", etiqueta: "JavaScript (axios)", modo: "javascript" },
    { id: "python", etiqueta: "Python (requests)", modo: "python" },
    { id: "httpie", etiqueta: "HTTPie", modo: "shell" },
    { id: "go", etiqueta: "Go", modo: "go" },
    { id: "java", etiqueta: "Java (HttpClient)", modo: "java" },
    { id: "csharp", etiqueta: "C# (HttpClient)", modo: "csharp" },
    { id: "php", etiqueta: "PHP (cURL)", modo: "php" },
    { id: "powershell", etiqueta: "PowerShell", modo: "powershell" },
    { id: "rust", etiqueta: "Rust (reqwest)", modo: "rust" },
];
export function cabecerasEfectivas(p: ApiPeticion): ApiCampo[] {
    const out = p.headers.filter(h => h.activo).map(h => ({ ...h }));
    const a = p.auth;
    const ya = (n: string) => out.some(h => h.nombre.toLowerCase() === n.toLowerCase());
    if (a.tipo === "bearer" && a.clave && !ya("Authorization")) {
        out.push({ nombre: "Authorization", valor: `Bearer ${a.clave}`, activo: true });
    }
    else if (a.tipo === "basic" && !ya("Authorization")) {
        out.push({ nombre: "Authorization", valor: `Basic ${basicB64(a.clave ?? "", a.secreto ?? "")}`, activo: true });
    }
    else if (a.tipo === "apikey" && a.clave && a.donde !== "query" && !ya(a.clave)) {
        out.push({ nombre: a.clave, valor: a.secreto ?? "", activo: true });
    }
    return out;
}
export function urlEfectiva(p: ApiPeticion): string {
    const q = [...p.query];
    if (p.auth.tipo === "apikey" && p.auth.donde === "query" && p.auth.clave) {
        q.push({ nombre: p.auth.clave, valor: p.auth.secreto ?? "", activo: true });
    }
    return unirUrl(p.url, q);
}
export function basicB64(usuario: string, clave: string): string {
    const bytes = new TextEncoder().encode(`${usuario}:${clave}`);
    const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let out = "";
    for (let i = 0; i < bytes.length; i += 3) {
        const b0 = bytes[i], b1 = bytes[i + 1], b2 = bytes[i + 2];
        out += A[b0 >> 2];
        out += A[((b0 & 3) << 4) | ((b1 ?? 0) >> 4)];
        out += b1 === undefined ? "=" : A[((b1 & 15) << 2) | ((b2 ?? 0) >> 6)];
        out += b2 === undefined ? "=" : A[b2 & 63];
    }
    return out;
}
function cuerpoTexto(p: ApiPeticion): string | null {
    const c = p.cuerpo;
    if (c.tipo === "ninguno")
        return null;
    if (c.tipo === "urlencoded") {
        return (c.campos ?? []).filter(f => f.activo)
            .map(f => `${encodeURIComponent(f.nombre)}=${encodeURIComponent(f.valor)}`).join("&");
    }
    if (c.tipo === "form-data" || c.tipo === "binario")
        return null;
    return c.texto ?? null;
}
function notaCuerpo(p: ApiPeticion, comentario: string): string {
    const c = p.cuerpo;
    if (c.tipo === "form-data") {
        const n = (c.campos ?? []).filter(f => f.activo).map(f => f.nombre).join(", ");
        return `${comentario} Cuerpo multipart con: ${n || "(sin campos)"} — los ficheros hay que adjuntarlos a mano.\n`;
    }
    if (c.tipo === "binario") {
        return `${comentario} Cuerpo binario (${c.texto || "fichero"}): su contenido no está en la petición.\n`;
    }
    return "";
}
const esc = {
    doble: (s: string) => s
        .replace(/\\/g, "\\\\").replace(/"/g, "\\\"")
        .replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\t/g, "\\t"),
    simple: (s: string) => s
        .replace(/\\/g, "\\\\").replace(/'/g, "\\'")
        .replace(/\n/g, "\\n").replace(/\r/g, "\\r"),
    shell: (s: string) => `'${s.replace(/'/g, `'\\''`)}'`,
    ps: (s: string) => `'${s.replace(/'/g, "''")}'`,
    py: (s: string) => {
        const q = s.includes("'") && !s.includes("\"") ? "\"" : "'";
        const cuerpo = s.replace(/\\/g, "\\\\").replace(new RegExp(q, "g"), `\\${q}`)
            .replace(/\n/g, "\\n").replace(/\r/g, "\\r");
        return `${q}${cuerpo}${q}`;
    },
};
export function generar(p: ApiPeticion, lenguaje: Lenguaje): string {
    const url = urlEfectiva(p);
    const headers = cabecerasEfectivas(p);
    const cuerpo = cuerpoTexto(p);
    const m = p.metodo || "GET";
    switch (lenguaje) {
        case "curl": return genCurl(m, url, headers, cuerpo, p);
        case "fetch": return genFetch(m, url, headers, cuerpo, p);
        case "axios": return genAxios(m, url, headers, cuerpo, p);
        case "python": return genPython(m, url, headers, cuerpo, p);
        case "httpie": return genHttpie(m, url, headers, cuerpo, p);
        case "go": return genGo(m, url, headers, cuerpo, p);
        case "java": return genJava(m, url, headers, cuerpo, p);
        case "csharp": return genCsharp(m, url, headers, cuerpo, p);
        case "php": return genPhp(m, url, headers, cuerpo, p);
        case "powershell": return genPowershell(m, url, headers, cuerpo, p);
        case "rust": return genRust(m, url, headers, cuerpo, p);
    }
}
type Gen = (m: string, url: string, h: ApiCampo[], cuerpo: string | null, p: ApiPeticion) => string;
const genCurl: Gen = (m, url, h, cuerpo, p) => {
    const l = [`curl -X ${m} ${esc.shell(url)}`];
    for (const x of h)
        l.push(`  -H ${esc.shell(`${x.nombre}: ${x.valor}`)}`);
    if (cuerpo !== null)
        l.push(`  -d ${esc.shell(cuerpo)}`);
    if (p.cuerpo.tipo === "form-data") {
        for (const f of (p.cuerpo.campos ?? []).filter(c => c.activo)) {
            l.push(`  -F ${esc.shell(`${f.nombre}=${f.valor}`)}`);
        }
    }
    return notaCuerpo(p, "#").replace(/form-data[\s\S]*/, "") + l.join(" \\\n");
};
const genFetch: Gen = (m, url, h, cuerpo, p) => {
    const partes = [`  method: "${m}"`];
    if (h.length) {
        partes.push(`  headers: {\n${h.map(x => `    "${esc.doble(x.nombre)}": "${esc.doble(x.valor)}"`).join(",\n")}\n  }`);
    }
    if (cuerpo !== null)
        partes.push(`  body: ${plantillaJs(cuerpo)}`);
    return notaCuerpo(p, "//")
        + `const res = await fetch("${esc.doble(url)}", {\n${partes.join(",\n")},\n});\n`
        + `const data = await res.json();\n`;
};
const genAxios: Gen = (m, url, h, cuerpo, p) => {
    const cfg = [`  method: "${m.toLowerCase()}"`, `  url: "${esc.doble(url)}"`];
    if (h.length) {
        cfg.push(`  headers: {\n${h.map(x => `    "${esc.doble(x.nombre)}": "${esc.doble(x.valor)}"`).join(",\n")}\n  }`);
    }
    if (cuerpo !== null)
        cfg.push(`  data: ${p.cuerpo.tipo === "json" ? objetoJsOJson(cuerpo) : plantillaJs(cuerpo)}`);
    return notaCuerpo(p, "//")
        + `import axios from "axios";\n\n`
        + `const { data } = await axios({\n${cfg.join(",\n")},\n});\n`;
};
const genPython: Gen = (m, url, h, cuerpo, p) => {
    const l = ["import requests", ""];
    if (h.length) {
        l.push("headers = {");
        for (const x of h)
            l.push(`    ${esc.py(x.nombre)}: ${esc.py(x.valor)},`);
        l.push("}", "");
    }
    const args = [esc.py(url)];
    if (h.length)
        args.push("headers=headers");
    if (cuerpo !== null) {
        if (p.cuerpo.tipo === "json") {
            l.push(`payload = ${esc.py(cuerpo)}`, "");
            args.push("data=payload");
        }
        else if (p.cuerpo.tipo === "urlencoded") {
            l.push("data = {");
            for (const f of (p.cuerpo.campos ?? []).filter(c => c.activo)) {
                l.push(`    ${esc.py(f.nombre)}: ${esc.py(f.valor)},`);
            }
            l.push("}", "");
            args.push("data=data");
        }
        else {
            args.push(`data=${esc.py(cuerpo)}`);
        }
    }
    l.push(`res = requests.${m.toLowerCase()}(${args.join(", ")})`, "print(res.status_code, res.text)");
    return notaCuerpo(p, "#") + l.join("\n") + "\n";
};
const genHttpie: Gen = (m, url, h, cuerpo, p) => {
    const l = [`http ${m} ${esc.shell(url)}`];
    for (const x of h)
        l.push(`  ${esc.shell(`${x.nombre}:${x.valor}`)}`);
    const pre = cuerpo !== null && p.cuerpo.tipo !== "urlencoded" ? `echo ${esc.shell(cuerpo)} | ` : "";
    if (cuerpo !== null && p.cuerpo.tipo === "urlencoded") {
        l[0] = `http --form ${m} ${esc.shell(url)}`;
        for (const f of (p.cuerpo.campos ?? []).filter(c => c.activo)) {
            l.push(`  ${esc.shell(`${f.nombre}=${f.valor}`)}`);
        }
    }
    return notaCuerpo(p, "#") + pre + l.join(" \\\n");
};
const genGo: Gen = (m, url, h, cuerpo, p) => {
    const l = ["package main", "", "import (", "\t\"fmt\"", "\t\"io\"", "\t\"net/http\""];
    if (cuerpo !== null)
        l.push("\t\"strings\"");
    l.push(")", "", "func main() {");
    l.push(cuerpo !== null
        ? `\tbody := strings.NewReader(${"`"}${cuerpo.replace(/`/g, "` + \"`\" + `")}${"`"})`
        : "");
    l.push(`\treq, _ := http.NewRequest("${m}", "${esc.doble(url)}", ${cuerpo !== null ? "body" : "nil"})`);
    for (const x of h)
        l.push(`\treq.Header.Set("${esc.doble(x.nombre)}", "${esc.doble(x.valor)}")`);
    l.push("", "\tres, err := http.DefaultClient.Do(req)", "\tif err != nil {", "\t\tpanic(err)", "\t}", "\tdefer res.Body.Close()", "", "\tout, _ := io.ReadAll(res.Body)", "\tfmt.Println(res.Status, string(out))", "}");
    return notaCuerpo(p, "//") + l.join("\n") + "\n";
};
const genJava: Gen = (m, url, h, cuerpo, p) => {
    const l = ["import java.net.URI;", "import java.net.http.*;", "", "HttpRequest req = HttpRequest.newBuilder()", `    .uri(URI.create("${esc.doble(url)}"))`];
    for (const x of h)
        l.push(`    .header("${esc.doble(x.nombre)}", "${esc.doble(x.valor)}")`);
    l.push(cuerpo !== null
        ? `    .method("${m}", HttpRequest.BodyPublishers.ofString("${esc.doble(cuerpo)}"))`
        : `    .method("${m}", HttpRequest.BodyPublishers.noBody())`);
    l.push("    .build();", "", "HttpResponse<String> res = HttpClient.newHttpClient()", "    .send(req, HttpResponse.BodyHandlers.ofString());", "System.out.println(res.statusCode() + \" \" + res.body());");
    return notaCuerpo(p, "//") + l.join("\n") + "\n";
};
const genCsharp: Gen = (m, url, h, cuerpo, p) => {
    const l = ["using System.Net.Http;", "", "using var client = new HttpClient();", `var req = new HttpRequestMessage(new HttpMethod("${m}"), "${esc.doble(url)}");`];
    const ct = h.find(x => x.nombre.toLowerCase() === "content-type");
    for (const x of h) {
        if (x.nombre.toLowerCase() === "content-type")
            continue;
        l.push(`req.Headers.Add("${esc.doble(x.nombre)}", "${esc.doble(x.valor)}");`);
    }
    if (cuerpo !== null) {
        l.push(`req.Content = new StringContent("${esc.doble(cuerpo)}", System.Text.Encoding.UTF8, "${esc.doble(ct?.valor.split(";")[0] ?? "text/plain")}");`);
    }
    l.push("", "var res = await client.SendAsync(req);", "Console.WriteLine((int)res.StatusCode + \" \" + await res.Content.ReadAsStringAsync());");
    return notaCuerpo(p, "//") + l.join("\n") + "\n";
};
const genPhp: Gen = (m, url, h, cuerpo, p) => {
    const l = ["<?php", "$ch = curl_init();", `curl_setopt($ch, CURLOPT_URL, '${esc.simple(url)}');`, "curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);", `curl_setopt($ch, CURLOPT_CUSTOMREQUEST, '${m}');`];
    if (h.length) {
        l.push("curl_setopt($ch, CURLOPT_HTTPHEADER, [");
        for (const x of h)
            l.push(`    '${esc.simple(`${x.nombre}: ${x.valor}`)}',`);
        l.push("]);");
    }
    if (cuerpo !== null)
        l.push(`curl_setopt($ch, CURLOPT_POSTFIELDS, '${esc.simple(cuerpo)}');`);
    l.push("", "$res = curl_exec($ch);", "echo curl_getinfo($ch, CURLINFO_HTTP_CODE), \" \", $res;", "curl_close($ch);");
    return notaCuerpo(p, "//") + l.join("\n") + "\n";
};
const genPowershell: Gen = (m, url, h, cuerpo, p) => {
    const l: string[] = [];
    if (h.length) {
        l.push("$headers = @{");
        for (const x of h)
            l.push(`    ${esc.ps(x.nombre)} = ${esc.ps(x.valor)}`);
        l.push("}", "");
    }
    const args = [`-Method ${esc.ps(m)}`, `-Uri ${esc.ps(url)}`];
    if (h.length)
        args.push("-Headers $headers");
    if (cuerpo !== null) {
        l.push(`$body = ${esc.ps(cuerpo)}`, "");
        args.push("-Body $body");
    }
    l.push(`$res = Invoke-RestMethod ${args.join(" ")}`, "$res | ConvertTo-Json -Depth 10");
    return notaCuerpo(p, "#") + l.join("\n") + "\n";
};
const genRust: Gen = (m, url, h, cuerpo, p) => {
    const l = ["use reqwest::Client;", "", "#[tokio::main]", "async fn main() -> Result<(), Box<dyn std::error::Error>> {", "    let client = Client::new();", `    let res = client`, `        .request(reqwest::Method::${m.toUpperCase()}, "${esc.doble(url)}")`];
    for (const x of h)
        l.push(`        .header("${esc.doble(x.nombre)}", "${esc.doble(x.valor)}")`);
    if (cuerpo !== null)
        l.push(`        .body("${esc.doble(cuerpo)}")`);
    l.push("        .send()", "        .await?;", "", "    println!(\"{} {}\", res.status(), res.text().await?);", "    Ok(())", "}");
    return notaCuerpo(p, "//") + l.join("\n") + "\n";
};
function plantillaJs(s: string): string {
    if (!s.includes("\n"))
        return `"${esc.doble(s)}"`;
    return "`" + s.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${") + "`";
}
function objetoJsOJson(s: string): string {
    try {
        const v: unknown = JSON.parse(s);
        if (typeof v === "object" && v !== null)
            return JSON.stringify(v, null, 2).replace(/\n/g, "\n  ");
    }
    catch { }
    return plantillaJs(s);
}
