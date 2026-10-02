import { DETECTORS } from "../shared/redact/detectors";
export type Gravedad = "critico" | "alto" | "aviso" | "info";
export type ReglaSaml = "sin-firma" | "algoritmo-firma-debil" | "algoritmo-digest-debil" | "ids-duplicados" | "referencia-no-coincide" | "sin-notonorafter" | "expirado" | "sin-audience" | "sin-inresponseto" | "sin-cifrar" | "estado-no-exito" | "secreto-en-atributo" | "xml-invalido" | "doctype-presente" | "comentario-en-identidad" | "transformacion-peligrosa" | "sin-recipient" | "sin-destination" | "recipient-no-coincide" | "issuer-no-coincide";
export interface HallazgoSaml {
    regla: ReglaSaml;
    gravedad: Gravedad;
    fragmento: string;
    datos?: Record<string, string>;
}
export type Binding = "redirect" | "post" | "xml";
export interface CampoSaml {
    nombre: string;
    valor: string;
}
export interface AnalisisSaml {
    binding: Binding;
    xml: string;
    tipo: "Response" | "Request" | "Assertion" | "desconocido";
    issuer: string;
    nameId: string;
    atributos: CampoSaml[];
    hallazgos: HallazgoSaml[];
    porGravedad: Record<Gravedad, number>;
}
const ORDEN: Record<Gravedad, number> = { critico: 0, alto: 1, aviso: 2, info: 3 };
export interface NodoXml {
    nombre: string;
    atributos: Record<string, string>;
    texto: string;
    hijos: NodoXml[];
}
const MAX_XML = 4000000;
const MAX_HONDO = 200;
const ENTIDADES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'" };
export function decodificarEntidades(s: string): string {
    const t = typeof s === "string" ? s : "";
    if (t.indexOf("&") < 0)
        return t;
    return t.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (todo, cuerpo: string) => {
        if (cuerpo[0] === "#") {
            const hex = cuerpo[1] === "x" || cuerpo[1] === "X";
            const n = parseInt(hex ? cuerpo.slice(2) : cuerpo.slice(1), hex ? 16 : 10);
            if (!Number.isFinite(n) || n < 0 || n > 1114111)
                return todo;
            try {
                return String.fromCodePoint(n);
            }
            catch {
                return todo;
            }
        }
        return ENTIDADES[cuerpo] ?? todo;
    });
}
const limpiarNombre = (bruto: string): string => {
    const dosp = bruto.lastIndexOf(":");
    return dosp >= 0 ? bruto.slice(dosp + 1) : bruto;
};
function leerAtributos(bruto: string): Record<string, string> {
    const atributos: Record<string, string> = {};
    const re = /([\w:.-]+)\s*=\s*("([^"]*)"|'([^']*)')/g;
    for (const m of bruto.matchAll(re)) {
        atributos[limpiarNombre(m[1])] = decodificarEntidades(m[3] ?? m[4] ?? "");
    }
    return atributos;
}
export function leerXml(fuente: string): NodoXml | null {
    const src = typeof fuente === "string" ? fuente.slice(0, MAX_XML) : "";
    let raiz: NodoXml | null = null;
    const pila: NodoXml[] = [];
    let i = 0;
    const cima = (): NodoXml | undefined => pila[pila.length - 1];
    while (i < src.length) {
        const lt = src.indexOf("<", i);
        if (lt < 0) {
            const c = cima();
            if (c)
                c.texto += src.slice(i);
            break;
        }
        if (lt > i) {
            const c = cima();
            if (c)
                c.texto += src.slice(i, lt);
        }
        if (src.startsWith("<!--", lt)) {
            const fin = src.indexOf("-->", lt + 4);
            i = fin < 0 ? src.length : fin + 3;
            continue;
        }
        if (src.startsWith("<![CDATA[", lt)) {
            const fin = src.indexOf("]]>", lt + 9);
            const c = cima();
            if (c)
                c.texto += src.slice(lt + 9, fin < 0 ? src.length : fin);
            i = fin < 0 ? src.length : fin + 3;
            continue;
        }
        if (src.startsWith("<?", lt)) {
            const fin = src.indexOf("?>", lt + 2);
            i = fin < 0 ? src.length : fin + 2;
            continue;
        }
        if (src.startsWith("<!", lt)) {
            const fin = src.indexOf(">", lt + 2);
            i = fin < 0 ? src.length : fin + 1;
            continue;
        }
        const gt = src.indexOf(">", lt + 1);
        if (gt < 0)
            break;
        const bruto = src.slice(lt + 1, gt).trim();
        i = gt + 1;
        if (!bruto)
            continue;
        if (bruto[0] === "/") {
            const nombre = limpiarNombre(bruto.slice(1).trim());
            for (let k = pila.length - 1; k >= 0; k--) {
                if (pila[k].nombre === nombre) {
                    pila.length = k;
                    break;
                }
            }
            continue;
        }
        const auto = bruto.endsWith("/");
        const cuerpo = (auto ? bruto.slice(0, -1) : bruto).trim();
        const espacio = cuerpo.search(/\s/);
        const nombreCrudo = espacio < 0 ? cuerpo : cuerpo.slice(0, espacio);
        const nombre = limpiarNombre(nombreCrudo);
        if (!nombre)
            continue;
        const atributos = espacio < 0 ? {} : leerAtributos(cuerpo.slice(espacio + 1));
        const nodo: NodoXml = { nombre, atributos, texto: "", hijos: [] };
        const padre = cima();
        if (padre)
            padre.hijos.push(nodo);
        else if (!raiz)
            raiz = nodo;
        else
            continue;
        if (!auto && pila.length < MAX_HONDO)
            pila.push(nodo);
    }
    return raiz;
}
export function buscar(nodo: NodoXml | null, nombre: string): NodoXml | null {
    if (!nodo)
        return null;
    if (nodo.nombre === nombre)
        return nodo;
    for (const h of nodo.hijos) {
        const r = buscar(h, nombre);
        if (r)
            return r;
    }
    return null;
}
export function buscarTodos(nodo: NodoXml | null, nombre: string): NodoXml[] {
    if (!nodo)
        return [];
    const out: NodoXml[] = nodo.nombre === nombre ? [nodo] : [];
    for (const h of nodo.hijos)
        out.push(...buscarTodos(h, nombre));
    return out;
}
const textoDe = (nodo: NodoXml | null): string => (nodo?.texto ?? "").trim();
export async function decodificarEntrada(entrada: string): Promise<{
    xml: string;
    binding: Binding;
} | null> {
    const t = entrada.trim();
    if (!t)
        return null;
    if (t.startsWith("<"))
        return { xml: t, binding: "xml" };
    const m = /(?:^|[?&#])(?:SAMLRequest|SAMLResponse)=([^&\s]+)/.exec(t);
    const crudo = m ? m[1] : t.replace(/\s+/g, "");
    let base64 = crudo;
    try {
        if (/%[0-9a-fA-F]{2}/.test(crudo))
            base64 = decodeURIComponent(crudo);
    }
    catch { }
    base64 = base64.replace(/ /g, "+");
    let bytes: Uint8Array;
    try {
        bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    }
    catch {
        return null;
    }
    const comoTexto = new TextDecoder().decode(bytes);
    if (comoTexto.trimStart().startsWith("<"))
        return { xml: comoTexto, binding: "post" };
    if (typeof DecompressionStream === "undefined")
        return null;
    try {
        const inflado = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
        const xml = await new Response(inflado).text();
        return xml.trimStart().startsWith("<") ? { xml, binding: "redirect" } : null;
    }
    catch {
        return null;
    }
}
const SECRETOS = DETECTORS.filter(d => d.category === "secret");
function pareceSecreto(valor: string): boolean {
    if (!valor)
        return false;
    return SECRETOS.some(d => { d.regex.lastIndex = 0; const m = d.regex.exec(valor); return !!m && (!d.validate || d.validate(m[0])); });
}
const ALGORITMO_DEBIL = /(#|\/)(rsa-sha1|hmac-sha1|dsa-sha1|sha1)$/i;
function auditar(raiz: NodoXml, xml: string): HallazgoSaml[] {
    const hallazgos: HallazgoSaml[] = [];
    const emitir = (h: HallazgoSaml) => hallazgos.push(h);
    const dtd = /<!(?:DOCTYPE|ENTITY)\b[^>]{0,120}/i.exec(xml);
    if (dtd)
        emitir({ regla: "doctype-presente", gravedad: "alto", fragmento: dtd[0] });
    const comentario = /<(?:[\w.-]+:)?(NameID|Issuer)\b[^>]*>([^<]{0,80})<!--/.exec(xml);
    if (comentario) {
        emitir({ regla: "comentario-en-identidad", gravedad: "critico", fragmento: `<${comentario[1]}>${comentario[2]}<!--`, datos: { elemento: comentario[1] } });
    }
    const assertion = buscar(raiz, "Assertion");
    const foco = assertion ?? raiz;
    const firmas = buscarTodos(raiz, "Signature");
    if (!firmas.length) {
        emitir({ regla: "sin-firma", gravedad: "critico", fragmento: "" });
    }
    else {
        for (const firma of firmas) {
            const metodoFirma = buscar(firma, "SignatureMethod");
            const alg = metodoFirma?.atributos["Algorithm"] ?? "";
            if (alg && ALGORITMO_DEBIL.test(alg)) {
                emitir({ regla: "algoritmo-firma-debil", gravedad: "alto", fragmento: alg, datos: { algoritmo: alg } });
            }
            for (const tr of buscarTodos(firma, "Transform")) {
                const tAlg = tr.atributos["Algorithm"] ?? "";
                if (/xslt|xpath/i.test(tAlg))
                    emitir({ regla: "transformacion-peligrosa", gravedad: "alto", fragmento: tAlg, datos: { algoritmo: tAlg } });
            }
            const metodoDigest = buscar(firma, "DigestMethod");
            const digAlg = metodoDigest?.atributos["Algorithm"] ?? "";
            if (digAlg && ALGORITMO_DEBIL.test(digAlg)) {
                emitir({ regla: "algoritmo-digest-debil", gravedad: "alto", fragmento: digAlg, datos: { algoritmo: digAlg } });
            }
            const referencia = buscar(firma, "Reference");
            const uri = (referencia?.atributos["URI"] ?? "").replace(/^#/, "");
            const idDelFoco = foco.atributos["ID"] ?? "";
            if (uri && idDelFoco && uri !== idDelFoco) {
                emitir({
                    regla: "referencia-no-coincide",
                    gravedad: "critico",
                    fragmento: `<Reference URI="#${uri}"> ≠ ID="${idDelFoco}"`,
                    datos: { uriFirmada: uri, idLeido: idDelFoco },
                });
            }
        }
    }
    const ids = new Map<string, number>();
    const todos: NodoXml[] = [];
    (function recorrer(n: NodoXml) { todos.push(n); for (const h of n.hijos)
        recorrer(h); })(raiz);
    for (const n of todos) {
        const id = n.atributos["ID"];
        if (id)
            ids.set(id, (ids.get(id) ?? 0) + 1);
    }
    const idsRepetidos = [...ids.entries()].filter(([, n]) => n > 1);
    if (idsRepetidos.length) {
        emitir({ regla: "ids-duplicados", gravedad: "critico", fragmento: idsRepetidos.map(([id, n]) => `${id} (${n}×)`).join(", "), datos: { ids: idsRepetidos.map(([id]) => id).join(",") } });
    }
    const condiciones = buscar(foco, "Conditions");
    if (!condiciones || !condiciones.atributos["NotOnOrAfter"]) {
        emitir({ regla: "sin-notonorafter", gravedad: "alto", fragmento: "" });
    }
    else {
        const fin = new Date(condiciones.atributos["NotOnOrAfter"]);
        if (!Number.isNaN(fin.getTime()) && fin.getTime() < Date.now()) {
            emitir({ regla: "expirado", gravedad: "info", fragmento: `NotOnOrAfter="${condiciones.atributos["NotOnOrAfter"]}"`, datos: { notOnOrAfter: condiciones.atributos["NotOnOrAfter"] } });
        }
    }
    if (!buscar(foco, "AudienceRestriction")) {
        emitir({ regla: "sin-audience", gravedad: "aviso", fragmento: "" });
    }
    const datosConfirmacion = buscar(foco, "SubjectConfirmationData");
    const recipient = datosConfirmacion?.atributos["Recipient"] ?? "";
    if (assertion && !recipient)
        emitir({ regla: "sin-recipient", gravedad: "aviso", fragmento: "" });
    if (raiz.nombre === "Response") {
        const destination = raiz.atributos["Destination"] ?? "";
        const responseFirmado = raiz.hijos.some(h => h.nombre === "Signature");
        if (responseFirmado && !destination)
            emitir({ regla: "sin-destination", gravedad: "aviso", fragmento: "" });
        if (destination && recipient && destination !== recipient) {
            emitir({ regla: "recipient-no-coincide", gravedad: "alto", fragmento: `Destination="${destination}" ≠ Recipient="${recipient}"`, datos: { destination, recipient } });
        }
        const issuerResp = raiz.hijos.find(h => h.nombre === "Issuer")?.texto.trim() ?? "";
        const issuerAser = assertion?.hijos.find(h => h.nombre === "Issuer")?.texto.trim() ?? "";
        if (issuerResp && issuerAser && issuerResp !== issuerAser) {
            emitir({ regla: "issuer-no-coincide", gravedad: "alto", fragmento: `${issuerResp} ≠ ${issuerAser}`, datos: { issuerResponse: issuerResp, issuerAssertion: issuerAser } });
        }
    }
    if (raiz.nombre === "Response" && !raiz.atributos["InResponseTo"]) {
        emitir({ regla: "sin-inresponseto", gravedad: "aviso", fragmento: "" });
    }
    if (raiz.nombre === "Response" && !buscar(raiz, "EncryptedAssertion") && assertion) {
        emitir({ regla: "sin-cifrar", gravedad: "info", fragmento: "" });
    }
    if (raiz.nombre === "Response") {
        const statusCode = buscar(raiz, "StatusCode");
        const valorEstado = statusCode?.atributos["Value"] ?? "";
        if (valorEstado && !/:Success$/.test(valorEstado)) {
            emitir({ regla: "estado-no-exito", gravedad: "info", fragmento: valorEstado.split(":").pop() ?? valorEstado, datos: { estado: valorEstado } });
        }
    }
    for (const attr of buscarTodos(raiz, "Attribute")) {
        const nombreAttr = attr.atributos["Name"] ?? attr.atributos["FriendlyName"] ?? "?";
        for (const valorNodo of buscarTodos(attr, "AttributeValue")) {
            const valor = textoDe(valorNodo);
            if (pareceSecreto(valor)) {
                emitir({ regla: "secreto-en-atributo", gravedad: "alto", fragmento: `${nombreAttr}: ${valor.slice(0, 4)}…`, datos: { atributo: nombreAttr } });
            }
        }
    }
    return hallazgos;
}
export async function analizarSaml(entrada: string): Promise<AnalisisSaml | null> {
    const decodificado = await decodificarEntrada(entrada);
    if (!decodificado)
        return null;
    const { xml, binding } = decodificado;
    const raiz = leerXml(xml);
    if (!raiz) {
        return {
            binding,
            xml,
            tipo: "desconocido",
            issuer: "",
            nameId: "",
            atributos: [],
            hallazgos: [{ regla: "xml-invalido", gravedad: "info", fragmento: "" }],
            porGravedad: { critico: 0, alto: 0, aviso: 0, info: 1 },
        };
    }
    const tipo = raiz.nombre === "Response" ? "Response" : raiz.nombre === "AuthnRequest" || raiz.nombre === "LogoutRequest" ? "Request"
        : raiz.nombre === "Assertion" ? "Assertion" : "desconocido";
    const assertion = buscar(raiz, "Assertion");
    const foco = assertion ?? raiz;
    const issuer = textoDe(buscar(raiz, "Issuer"));
    const nameId = textoDe(buscar(foco, "NameID")) || textoDe(buscar(raiz, "NameID"));
    const atributos: CampoSaml[] = buscarTodos(raiz, "Attribute").map(a => ({
        nombre: a.atributos["FriendlyName"] || a.atributos["Name"] || "?",
        valor: buscarTodos(a, "AttributeValue").map(textoDe).join(", "),
    }));
    const hallazgos = auditar(raiz, xml).sort((a, b) => ORDEN[a.gravedad] - ORDEN[b.gravedad]);
    const porGravedad: Record<Gravedad, number> = { critico: 0, alto: 0, aviso: 0, info: 0 };
    for (const h of hallazgos)
        porGravedad[h.gravedad]++;
    return { binding, xml, tipo, issuer, nameId, atributos, hallazgos, porGravedad };
}
