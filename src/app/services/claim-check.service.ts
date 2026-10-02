export type Nivel = "revisado" | "preprint" | "registro" | "autopublicado" | "sin-fuente";
export interface Fuente {
    cita: string;
    nivel: Nivel;
    motivo: string;
}
export type Fuerza = "categorica" | "matizada" | "descriptiva";
export interface Afirmacion {
    texto: string;
    fuerza: Fuerza;
    fuentes: Fuente[];
    sinRespaldo: boolean;
}
export interface Resumen {
    total: number;
    categoricas: number;
    sinRespaldo: number;
    conPreprint: number;
    niveles: Record<Nivel, number>;
}
const MATIZ = /\b(podría[ns]?|podria[ns]?|puede que|quizá|quizas|quizás|sugiere[n]?|sugerir|parece[n]?|se cree|suele[n]?|a menudo|en general|aproximadamente|estimad[oa]s?|probablemente|indicios|apunta[n]? a|haría falta|harian falta)(?![a-záéíóúüñ])/i;
const CATEGORICA = /\b(demuestra[n]?|demostrad[oa]s?|prueba que|siempre|nunca|todos los|ninguna?|es el único|garantiza[n]?|elimina[n]?|imposible|confirma[n]?|confirmó|confirmo|confirmad[oa]s?)(?![a-záéíóúüñ])/i;
const REVISADAS = /\b(nature\.com|science\.org|sciencedirect\.com|springer(link)?\.com|link\.springer|onlinelibrary\.wiley|acm\.org|ieee(xplore)?\.org|pnas\.org|cell\.com|thelancet\.com|nejm\.org|jmlr\.org|proceedings\.neurips\.cc|papers\.nips\.cc|aclanthology\.org|proceedings\.mlr\.press|openaccess\.thecvf\.com|ojs\.aaai\.org|ijcai\.org)\b/i;
const PREPRINTS = /\b(arxiv\.org|biorxiv\.org|medrxiv\.org|ssrn\.com|chemrxiv\.org)\b/i;
const AUTOPUB = /\b(medium\.com|substack\.com|linkedin\.com|dev\.to|hashnode|blogspot|wordpress\.com|reddit\.com|x\.com|twitter\.com)\b/i;
export class ClaimCheckService {
    separar(texto: string): string[] {
        return texto
            .split(/(?<=[.!?])\s+|\n+/)
            .map(t => t.trim())
            .filter(t => t.length > 12);
    }
    fuentes(frase: string): Fuente[] {
        const out: Fuente[] = [];
        const add = (cita: string, nivel: Nivel, motivo: string) => {
            if (!out.some(f => f.cita === cita))
                out.push({ cita, nivel, motivo });
        };
        for (const m of frase.matchAll(/\barXiv:\s*\d{4}\.\d{4,5}(v\d+)?\b/gi))
            add(m[0], "preprint", "arxiv-id");
        for (const m of frase.matchAll(/\bPMID:?\s*\d{4,9}\b/gi))
            add(m[0], "revisado", "pubmed");
        for (const m of frase.matchAll(/\bdoi:\s*10\.\d{4,9}\/\S+|10\.\d{4,9}\/[^\s,;)\]]+/gi)) {
            const cita = m[0];
            add(cita, /arxiv/i.test(cita) ? "preprint" : "registro", /arxiv/i.test(cita) ? "doi-arxiv" : "doi");
        }
        for (const m of frase.matchAll(/https?:\/\/[^\s,;)\]]+/gi)) {
            const url = m[0];
            if (PREPRINTS.test(url))
                add(url, "preprint", "dominio-preprint");
            else if (REVISADAS.test(url))
                add(url, "revisado", "dominio-revisado");
            else if (AUTOPUB.test(url))
                add(url, "autopublicado", "dominio-autopublicado");
            else
                add(url, "registro", "url-sin-clasificar");
        }
        return out;
    }
    fuerza(frase: string): Fuerza {
        const limpia = this.sinCitas(frase);
        if (MATIZ.test(limpia))
            return "matizada";
        if (CATEGORICA.test(limpia))
            return "categorica";
        return /\d/.test(limpia) ? "categorica" : "descriptiva";
    }
    private sinCitas(frase: string): string {
        let out = frase;
        for (const f of this.fuentes(frase))
            out = out.split(f.cita).join(" ");
        return out;
    }
    analizar(texto: string): Afirmacion[] {
        return this.separar(texto).map(t => {
            const fuentes = this.fuentes(t);
            const fuerza = this.fuerza(t);
            return { texto: t, fuerza, fuentes, sinRespaldo: fuerza === "categorica" && fuentes.length === 0 };
        });
    }
    resumen(a: Afirmacion[]): Resumen {
        const niveles: Record<Nivel, number> = {
            revisado: 0,
            preprint: 0,
            registro: 0,
            autopublicado: 0,
            "sin-fuente": 0,
        };
        for (const x of a) {
            if (!x.fuentes.length)
                niveles["sin-fuente"]++;
            for (const f of x.fuentes)
                niveles[f.nivel]++;
        }
        return {
            total: a.length,
            categoricas: a.filter(x => x.fuerza === "categorica").length,
            sinRespaldo: a.filter(x => x.sinRespaldo).length,
            conPreprint: a.filter(x => x.fuentes.some(f => f.nivel === "preprint")).length,
            niveles,
        };
    }
}
