import { triar, esError, type ClaveModelo, type CodigoAviso, type CodigoError, type AvisoTriaje, type TipoColumna } from "../../src/app/services/ml-triaje";
const ERROR: Record<CodigoError, (objetivo?: string) => string> = {
    vacio: () => "No data.",
    "pocas-filas": () => "Too few rows: at least 20 data rows (after the header) are needed for cross-validation to mean anything.",
    "objetivo-no-existe": (o) => `There is no column named "${o}" (names are case-sensitive; the header is the first line).`,
    "objetivo-no-valido": () => "The target must be binary (exactly two distinct values) or numeric. Multiclass targets and free text are not supported.",
    "sin-variables": () => "No usable feature column: every other column is constant, an identifier, a date or free text.",
};
const CODIGO: Record<CodigoAviso, string> = {
    desbalance: "imbalance",
    constante: "constant",
    huecos: "missing",
    fuga: "leak",
    id: "identifier",
    muestreado: "sampled",
    "alta-cardinalidad": "high-cardinality",
    "pocas-filas": "few-rows",
};
const AVISO: {
    [K in CodigoAviso]: (a: AvisoTriaje) => string;
} = {
    desbalance: (a) => `The majority class is ${pct(a.valor)} of the rows: accuracy would flatter a model that always says the majority, so models are ranked by macro F1.`,
    constante: (a) => `"${a.columna}" has a single value: it carries no information and was dropped.`,
    huecos: (a) => `"${a.columna}" is ${pct(a.valor)} empty. Gaps are filled with the training-fold mean (or most common value) inside each fold, so the score is not inflated.`,
    fuga: (a) => `LIKELY LEAK: "${a.columna}" alone predicts the target (${a.valor} on its own). It is probably a copy of the target or something recorded after it; drop it, or every score here is too good to be true.`,
    id: (a) => `"${a.columna}" looks like an identifier (every value distinct): it was dropped, since a model would only memorise it.`,
    muestreado: (a) => `Large file: a random sample of ${a.valor} rows (seeded) was used, so the answer stays fast.`,
    "alta-cardinalidad": (a) => `"${a.columna}" is categorical with ${a.valor} values: one-hot encoding spreads it thin; consider grouping rare values.`,
    "pocas-filas": (a) => `Only ${a.valor} rows for the columns used (less than 10 per column): scores vary a lot between folds; trust the std.`,
};
const pct = (x?: number) => (x === undefined ? "?" : `${Math.round(x * 1000) / 10} %`);
const MODELO: Record<ClaveModelo, string> = {
    base: "baseline (majority class, or the mean)",
    lineal: "linear (logistic or least squares)",
    arbol: "decision tree (depth 4)",
    bosque: "random forest (40 trees)",
    boosting: "gradient boosting (40 trees)",
};
const TIPO: Record<TipoColumna, string> = { numerica: "numeric", categorica: "categorical", fecha: "date", texto: "text", id: "identifier" };
export interface EntradaTriaje {
    csv: string;
    target?: string;
    seed: number;
    folds: number;
}
export function triajeMl(e: EntradaTriaje) {
    const r = triar({ csv: e.csv, objetivo: e.target, semilla: e.seed, pliegues: e.folds });
    if (esError(r))
        return { error: ERROR[r.error](e.target) };
    const nombre = (c: ClaveModelo) => MODELO[c];
    const fuga = r.avisos.find((a) => a.codigo === "fuga");
    const rec = r.recomendado, mejor = r.modelos.find((m) => m.clave === rec.clave)!, metrica = r.modelos[0].metrica;
    const empate = rec.empataCon ? r.modelos.find((m) => m.clave === rec.empataCon) : undefined;
    const veredicto = [
        ...(fuga ? [`Suspected leak in "${fuga.columna}": fix that before believing any score below.`] : []),
        rec.bateALaBase
            ? `${nombre(rec.clave)} beats the baseline by ${rec.margen} ${metrica} — more than the fold-to-fold noise (std ${mejor.desv}).${empate ? ` ${nombre(empate.clave)} has a slightly higher mean (${empate.media} vs ${mejor.media}), but their mean ± std ranges overlap: in practice they tie, so the simpler model is recommended.` : ""}`
            : `No model beats the baseline by more than the noise between folds (best margin ${rec.margen} ${metrica}): with these columns, predicting the ${r.tarea === "clasificacion" ? "majority class" : "mean"} is as good. Look for better features before a better model.`,
    ].join(" ");
    return {
        task: r.tarea === "clasificacion" ? "binary classification" : "regression",
        target: r.objetivo,
        targetChosenBy: r.objetivoElegidoPor === "pedido" ? "given" : "last column",
        rows: r.filas,
        rowsUsed: r.filasUsadas,
        columns: r.columnas.map((c) => ({ name: c.nombre, type: TIPO[c.tipo], missing: Math.round(c.huecos * 1000) / 1000, distinct: c.distintos, used: c.usada })),
        warnings: r.avisos.map((a) => ({ code: CODIGO[a.codigo], ...(a.columna !== undefined ? { column: a.columna } : {}), ...(a.valor !== undefined ? { value: a.valor } : {}), detail: AVISO[a.codigo](a) })),
        models: r.modelos.map((m) => ({ model: m.clave === "base" ? "baseline" : m.clave === "lineal" ? "linear" : m.clave === "arbol" ? "tree" : m.clave === "bosque" ? "forest" : "boosting", label: nombre(m.clave), metric: m.metrica, mean: m.media, std: m.desv, folds: m.pliegues, ...(m.secundaria ? { secondary: { metric: m.secundaria.metrica, mean: m.secundaria.media } } : {}) })),
        recommended: { model: nombre(rec.clave), beatsBaseline: rec.bateALaBase, margin: rec.margen, ...(empate ? { tiesWith: nombre(empate.clave) } : {}) },
        verdict: veredicto,
        notes: [
            `Scores are ${r.modelos[0].pliegues}-fold cross-validation means (folds fixed by the seed: same input and seed, same answer). Gap filling and one-hot encoding are fitted inside each training fold.`,
            metrica === "r2" ? "Regression: R\u00B2 (1 = perfect, 0 = no better than the mean) ranks the models; MAE (lower is better, in the target's units) is the secondary." : "Higher is better. \"Beats the baseline\" means a margin above both 0.01 and the best model's std across folds. When two models' mean \u00B1 std ranges overlap, the simpler one is recommended (tiesWith names the one with the higher mean).",
            "Leak detection only catches flagrant cases (one column that alone scores \u2265 0.97 accuracy or \u2265 0.95 R\u00B2); a partial leak looks like a good feature. Dates and free text are not used as features. NA, null, ? and - are read as missing.",
            "The same engine as https://jarroba.com/tools/en/which-model \u2014 paste the CSV there to see the columns and models side by side.",
        ],
    };
}
