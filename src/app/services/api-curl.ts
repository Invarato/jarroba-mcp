import { ApiCampo, ApiColeccion, ApiPeticion, ResultadoImport, campo, cuerpoVacio, authVacia, peticionVacia, partirUrl, unirUrl, } from "./api-ir";
export interface Token {
    texto: string;
    entrecomillado: boolean;
}
export function tokenizar(texto: string): Token[] {
    const out: Token[] = [];
    let cur = "";
    let hay = false;
    let comillado = false;
    let q: "\"" | "'" | null = null;
    for (let i = 0; i < texto.length; i++) {
        const c = texto[i];
        if (q === "'") {
            if (c === "'") {
                q = null;
            }
            else {
                cur += c;
            }
            continue;
        }
        if (q === "\"") {
            if (c === "\\" && ["\"", "\\", "$", "`", "\n"].includes(texto[i + 1])) {
                i++;
                if (texto[i] !== "\n")
                    cur += texto[i];
                continue;
            }
            if (c === "\"") {
                q = null;
                continue;
            }
            cur += c;
            continue;
        }
        if (c === "\\") {
            if (texto[i + 1] === "\n" || (texto[i + 1] === "\r" && texto[i + 2] === "\n")) {
                i += texto[i + 1] === "\r" ? 2 : 1;
                continue;
            }
            if (i + 1 < texto.length) {
                cur += texto[++i];
                hay = true;
                continue;
            }
            continue;
        }
        if (c === "\"" || c === "'") {
            q = c;
            hay = true;
            comillado = true;
            continue;
        }
        if (/\s/.test(c)) {
            if (cur === "^" && (c === "\n" || c === "\r")) {
                cur = "";
                hay = false;
                comillado = false;
                continue;
            }
            if (hay) {
                out.push({ texto: cur, entrecomillado: comillado });
                cur = "";
                hay = false;
                comillado = false;
            }
            continue;
        }
        cur += c;
        hay = true;
    }
    if (hay)
        out.push({ texto: cur, entrecomillado: comillado });
    return out;
}
const SIN_VALOR = new Set([
    "-L",
    "--location",
    "-k",
    "--insecure",
    "--compressed",
    "-s",
    "--silent",
    "-v",
    "--verbose",
    "-i",
    "--include",
    "-f",
    "--fail",
    "-g",
    "--globoff",
    "-S",
    "--show-error",
    "-#",
    "--progress-bar",
    "-N",
    "--no-buffer",
    "--http1.1",
    "--http2",
    "--http3",
    "--no-keepalive",
    "-4",
    "-6",
    "--path-as-is",
    "--tlsv1.2",
    "--tlsv1.3",
    "--raw",
    "--anyauth",
    "--negotiate",
    "--ntlm",
    "--digest",
]);
const VALOR_IRRELEVANTE = new Set([
    "-o",
    "--output",
    "-w",
    "--write-out",
    "--max-time",
    "-m",
    "--connect-timeout",
    "--retry",
    "--cacert",
    "--cert",
    "--key",
    "--proxy",
    "-x",
    "--resolve",
    "--interface",
]);
export interface OpcionesCurl {
    nombrePorDefecto?: string;
}
export function leerCurl(texto: string, op: OpcionesCurl = {}): ResultadoImport {
    const bruto = texto.trim();
    if (!bruto)
        return { ok: false, error: "No hay nada que convertir." };
    const trozos = partirComandos(bruto);
    if (!trozos.length)
        return { ok: false, error: "No se encontr\u00F3 ning\u00FAn comando curl." };
    const avisos: string[] = [];
    const peticiones: ApiPeticion[] = [];
    for (const t of trozos) {
        const r = unComando(t, avisos, peticiones.length + 1);
        if (r)
            peticiones.push(r);
    }
    if (!peticiones.length) {
        return { ok: false, error: "Se encontr\u00F3 un comando curl, pero sin URL: no hay petici\u00F3n que construir." };
    }
    return {
        ok: true,
        avisos,
        coleccion: {
            nombre: op.nombrePorDefecto ?? "Importado de curl",
            variables: [],
            peticiones,
        },
    };
}
function partirComandos(texto: string): string[] {
    const cortes: number[] = [];
    let q: "\"" | "'" | null = null;
    for (let i = 0; i < texto.length; i++) {
        const c = texto[i];
        if (q) {
            if (c === "\\" && q === "\"") {
                i++;
                continue;
            }
            if (c === q)
                q = null;
            continue;
        }
        if (c === "\"" || c === "'") {
            q = c;
            continue;
        }
        if (c === "\\") {
            i++;
            continue;
        }
        const inicioLinea = i === 0 || texto[i - 1] === "\n";
        if (inicioLinea && texto.startsWith("curl", i) && /[\s\\]/.test(texto[i + 4] ?? " "))
            cortes.push(i);
    }
    if (!cortes.length)
        return [texto];
    return cortes.map((ini, k) => texto.slice(ini, cortes[k + 1] ?? texto.length).trim()).filter(Boolean);
}
function unComando(texto: string, avisos: string[], n: number): ApiPeticion | null {
    avisarDeLoQueNoSePuedeSaber(texto, avisos, n);
    const tk = tokenizar(texto);
    if (!tk.length)
        return null;
    const p = peticionVacia({ nombre: `Petición ${n}` });
    let metodoExplicito = "";
    let url = "";
    const datos: {
        valor: string;
        urlencode: boolean;
    }[] = [];
    const form: ApiCampo[] = [];
    let usarGet = false, soloCabeceras = false, subirFichero = "";
    for (let i = tk.length && tk[0].texto === "curl" ? 1 : 0; i < tk.length; i++) {
        const a = tk[i].texto;
        const sig = () => tk[++i]?.texto ?? "";
        if (SIN_VALOR.has(a))
            continue;
        if (VALOR_IRRELEVANTE.has(a)) {
            sig();
            continue;
        }
        let flag = a, pegado: string | null = null;
        const eq = a.startsWith("--") ? a.indexOf("=") : -1;
        if (eq > 0) {
            flag = a.slice(0, eq);
            pegado = a.slice(eq + 1);
        }
        const val = () => pegado ?? sig();
        switch (flag) {
            case "-X":
            case "--request":
                metodoExplicito = val().toUpperCase();
                break;
            case "-H":
            case "--header": {
                const h = val();
                const sinDosPuntos = h.trim();
                if (!sinDosPuntos.includes(":") && sinDosPuntos.endsWith(";")) {
                    p.headers.push(campo(sinDosPuntos.slice(0, -1).trim(), ""));
                    break;
                }
                const j = h.indexOf(":");
                if (j < 0) {
                    avisos.push(`Petición ${n}: cabecera sin «:», ignorada: «${h}».`);
                    break;
                }
                p.headers.push(campo(h.slice(0, j).trim(), h.slice(j + 1).trim()));
                break;
            }
            case "-d":
            case "--data":
            case "--data-raw":
            case "--data-ascii":
                datos.push({ valor: val(), urlencode: false });
                break;
            case "--data-binary":
                datos.push({ valor: val(), urlencode: false });
                break;
            case "--data-urlencode":
                datos.push({ valor: val(), urlencode: true });
                break;
            case "-F":
            case "--form": {
                const f = val();
                const j = f.indexOf("=");
                if (j < 0) {
                    avisos.push(`Petición ${n}: campo de formulario sin «=», ignorado: «${f}».`);
                    break;
                }
                form.push(campo(f.slice(0, j), f.slice(j + 1)));
                break;
            }
            case "-u":
            case "--user": {
                const u = val();
                const j = u.indexOf(":");
                p.auth = { tipo: "basic", clave: j < 0 ? u : u.slice(0, j), secreto: j < 0 ? "" : u.slice(j + 1) };
                break;
            }
            case "-b":
            case "--cookie":
                p.headers.push(campo("Cookie", val()));
                break;
            case "-A":
            case "--user-agent":
                p.headers.push(campo("User-Agent", val()));
                break;
            case "-e":
            case "--referer":
                p.headers.push(campo("Referer", val()));
                break;
            case "-T":
            case "--upload-file":
                subirFichero = val();
                break;
            case "-G":
            case "--get":
                usarGet = true;
                break;
            case "-I":
            case "--head":
                soloCabeceras = true;
                break;
            case "--url":
                url = val();
                break;
            default:
                if (flag.startsWith("-")) {
                    avisos.push(`Petición ${n}: opción «${flag}» no reconocida, ignorada.`);
                }
                else if (!url) {
                    url = a;
                }
                else {
                    avisos.push(`Petición ${n}: «${a}» sobra (ya había URL), ignorado.`);
                }
        }
    }
    if (!url)
        return null;
    if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(url))
        url = `https://${url}`;
    const { base, query } = partirUrl(url);
    p.url = base;
    p.query = query;
    if (usarGet && datos.length) {
        for (const d of datos)
            p.query.push(...comoCampos(d.valor));
    }
    else if (form.length) {
        p.cuerpo = { tipo: "form-data", campos: form };
    }
    else if (subirFichero) {
        p.cuerpo = { tipo: "binario", texto: subirFichero };
        avisos.push(`Petición ${n}: sube el fichero «${subirFichero}»; el contenido no está en el comando.`);
    }
    else if (datos.length) {
        const junto = datos.map(d => d.valor).join("&");
        const ct = (p.headers.find(h => h.nombre.toLowerCase() === "content-type")?.valor ?? "").toLowerCase();
        if (ct.includes("json") || pareceJson(junto))
            p.cuerpo = { tipo: "json", texto: junto };
        else if (ct.includes("xml"))
            p.cuerpo = { tipo: "xml", texto: junto };
        else if (ct.includes("urlencoded") || datos.some(d => d.urlencode) || pareceUrlencoded(junto)) {
            p.cuerpo = { tipo: "urlencoded", campos: comoCampos(junto) };
        }
        else
            p.cuerpo = { tipo: "texto", texto: junto };
    }
    else {
        p.cuerpo = cuerpoVacio();
    }
    p.metodo = metodoExplicito
        || (soloCabeceras ? "HEAD"
            : subirFichero ? "PUT"
                : (!usarGet && (datos.length || form.length)) ? "POST" : "GET");
    const iAuth = p.headers.findIndex(h => h.nombre.toLowerCase() === "authorization");
    if (iAuth >= 0 && p.auth.tipo === "ninguna") {
        const v = p.headers[iAuth].valor;
        const m = /^Bearer\s+(.+)$/i.exec(v);
        if (m) {
            p.auth = { tipo: "bearer", clave: m[1] };
            p.headers.splice(iAuth, 1);
        }
    }
    p.nombre = nombreDesdeUrl(base, p.metodo, n);
    return p;
}
function avisarDeLoQueNoSePuedeSaber(texto: string, avisos: string[], n: number): void {
    const fuera = sinComillasSimples(texto);
    if (/\$\(|`[^`]*`/.test(fuera)) {
        avisos.push(`Petición ${n}: lleva sustitución de comandos ($(…) o \`…\`). Se copia tal cual: su valor real solo existe al ejecutarla.`);
    }
    if (/\$\{?[A-Za-z_][A-Za-z0-9_]*/.test(fuera)) {
        avisos.push(`Petición ${n}: usa variables de entorno ($VAR). Se copian tal cual, sin resolver.`);
    }
    if (/(?:^|[^|])\|(?!\|)|(?:^|\s)>>?\s/.test(fuera)) {
        avisos.push(`Petición ${n}: hay una tubería o una redirección. No forman parte de la petición y se ignoran.`);
    }
}
function sinComillasSimples(s: string): string {
    return s.replace(/'[^']*'/g, "''");
}
function pareceJson(s: string): boolean {
    try {
        const v: unknown = JSON.parse(s);
        return typeof v === "object" && v !== null;
    }
    catch {
        return false;
    }
}
function pareceUrlencoded(s: string): boolean {
    return /^[^=&\s]+=[^&]*(&[^=&\s]+=[^&]*)*$/.test(s.trim());
}
function comoCampos(s: string): ApiCampo[] {
    return partirUrl(`?${s}`).query;
}
function nombreDesdeUrl(url: string, metodo: string, n: number): string {
    try {
        const sinProto = url.replace(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//, "");
        const barra = sinProto.indexOf("/");
        if (barra < 0)
            return `${metodo} ${sinProto}`;
        const tramos = sinProto.slice(barra + 1).split("/").filter(Boolean);
        const esRelleno = (t: string) => /^\{\{.*\}\}$/.test(t) || /^[0-9a-f-]{8,}$/i.test(t) || /^\d+$/.test(t) || /^:/.test(t);
        const ultimo = [...tramos].reverse().find(t => !esRelleno(t));
        return `${metodo} ${ultimo ?? sinProto.slice(0, barra)}`;
    }
    catch {
        return `Petición ${n}`;
    }
}
export interface OpcionesEscribirCurl {
    multilinea?: boolean;
    comilla?: "'" | "\"";
}
export function escribirCurl(p: ApiPeticion, op: OpcionesEscribirCurl = {}): string {
    const multi = op.multilinea ?? true;
    const q = op.comilla ?? "'";
    const cita = (s: string) => entrecomillar(s, q);
    const partes: string[] = ["curl"];
    if (p.metodo && p.metodo !== "GET")
        partes.push(`-X ${p.metodo}`);
    partes.push(cita(unirUrl(p.url, p.query)));
    for (const h of p.headers) {
        if (h.activo)
            partes.push(`-H ${cita(`${h.nombre}: ${h.valor}`)}`);
    }
    if (p.auth.tipo === "bearer" && p.auth.clave) {
        partes.push(`-H ${cita(`Authorization: Bearer ${p.auth.clave}`)}`);
    }
    else if (p.auth.tipo === "basic") {
        partes.push(`-u ${cita(`${p.auth.clave ?? ""}:${p.auth.secreto ?? ""}`)}`);
    }
    else if (p.auth.tipo === "apikey" && p.auth.clave && p.auth.donde !== "query") {
        partes.push(`-H ${cita(`${p.auth.clave}: ${p.auth.secreto ?? ""}`)}`);
    }
    const c = p.cuerpo;
    if (c.tipo === "form-data") {
        for (const f of c.campos ?? [])
            if (f.activo)
                partes.push(`-F ${cita(`${f.nombre}=${f.valor}`)}`);
    }
    else if (c.tipo === "urlencoded") {
        for (const f of c.campos ?? [])
            if (f.activo)
                partes.push(`--data-urlencode ${cita(`${f.nombre}=${f.valor}`)}`);
    }
    else if (c.tipo === "binario") {
        partes.push(`-T ${cita(c.texto ?? "")}`);
    }
    else if (c.texto) {
        partes.push(`-d ${cita(c.texto)}`);
    }
    return partes.join(multi ? " \\\n  " : " ");
}
export function entrecomillar(s: string, q: "'" | "\"" = "'"): string {
    if (q === "'")
        return `'${s.replace(/'/g, `'\\''`)}'`;
    return `"${s.replace(/[\\"$`]/g, m => `\\${m}`)}"`;
}
