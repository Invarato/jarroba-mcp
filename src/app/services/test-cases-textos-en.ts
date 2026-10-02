import type { Aviso, CasoKind, Propiedad, PropiedadKind, TecnicaKind } from "./test-cases.service";
export function textoCasoEn(kind: CasoKind): string {
    switch (kind) {
        case "opcional-null": return "The type allows absence of a value, so it is one more valid case.";
        case "bajo-min-invalido": return "Just below the minimum: must be rejected.";
        case "min-exacto": return "The exact minimum: the off-by-one error between < and <= lives here.";
        case "sobre-min": return "Just above the minimum.";
        case "bajo-max": return "Just below the maximum.";
        case "max-exacto": return "The exact maximum: the other spot where the < vs <= error lives.";
        case "sobre-max-invalido": return "Just above the maximum: must be rejected.";
        case "cero": return "Zero breaks divisions and flips the sign.";
        case "negativo": return "Negative: many functions assume it is impossible without checking.";
        case "positivo-pequeno": return "A small positive number, the typical case.";
        case "coma-flotante": return "Floating point: comparing with === fails here and nowhere else.";
        case "nan-invalido": return "Any comparison with NaN is false: it slips through every guard.";
        case "max-seguro": return "The largest integer JavaScript represents without losing precision.";
        case "bajo-min-longitud-invalido": return "One character below the minimum length.";
        case "min-longitud-exacta": return "The exact minimum length.";
        case "max-longitud-exacta": return "The exact maximum length.";
        case "sobre-max-longitud-invalido": return "One character above the maximum length.";
        case "cadena-vacia": return "The empty string: not the same as absent, and almost nobody tells them apart.";
        case "solo-espacios": return "Only spaces: passes an \"if not empty\" check and is worth nothing.";
        case "texto-normal": return "The typical case.";
        case "unicode-emoji-rtl": return "Accents, emoji (outside the basic plane) and right-to-left script.";
        case "texto-muy-largo": return "Very long: uncovers buffer and database limits.";
        case "bool-true": return "One of the two branches.";
        case "bool-false": return "The other one. With two values, exhaustive is the same as cheap.";
        case "valor-enum": return "Each value of the set is its own class: there is nothing between two of them.";
        case "fuera-enum-invalido": return "A value outside the set: checks that it is rejected instead of falling into the \"else\".";
        case "lista-vacia": return "Empty: the case that breaks every [0] and every reduce with no initial value.";
        case "lista-un-elemento": return "A single element: it does not tell first from last, and that is where separator bugs hide.";
        case "lista-varios": return "Several: the typical case.";
        case "lista-repetidos": return "Duplicates: uncovers code that assumes uniqueness without checking it.";
        case "objeto-vacio": return "With no properties at all.";
        case "objeto-completo": return "With every property.";
    }
}
export function textoTecnicaEn(kind: TecnicaKind): string {
    switch (kind) {
        case "rango-numerico": return "The range is declared and the numbers have an order, so \"the one just before\" "
            + "and \"the one just after\" exist. That is where off-by-one errors live.";
        case "particiones-numerico": return "The type declares no range, so there is no concrete boundary to probe. "
            + "The CLASSES that behave differently are tested instead. Declare a minimum and a maximum and "
            + "this becomes boundary values, which is finer-grained.";
        case "rango-texto": return "Length is a number with an order, so the limits apply to IT. "
            + "Careful: not to the text's content, which has no order.";
        case "particiones-texto": return "Text has no useful order to walk, so there are no boundary values worth "
            + "testing: the classes that are handled differently are tested instead.";
        case "booleano": return "Boundary values do NOT apply here: there is no \"just before\" between true and false. "
            + "With two values, both are tested, and what matters is how they COMBINE with the other conditions "
            + "\u2014 that is a decision table.";
        case "enum": return "An enum has no order, so boundary values mean nothing here (there is no "
            + "\"value before RED\"). All of them are tested, since there are few, plus the one outside the set.";
        case "lista": return "What has an order in a list is its SIZE, and the interesting classes are "
            + "none / one / several. The content has no boundary to probe.";
        case "objeto": return "An object with no schema only lets you tell empty from full apart. "
            + "Give me its schema and its fields can be derived one by one.";
        case "desconocido": return "I do not know what values this parameter accepts, so any case I gave you "
            + "would be made up. Better to say nothing than to say something that looks rigorous and is not.";
    }
}
export function textoAvisoEn(a: Aviso): string {
    switch (a.kind) {
        case "sin-tipo-derivable":
            return `Nothing can be derived from ${a.parametros.map((d) => `\`${d}\``).join(", ")}: the type does not say `
                + "which values are valid. Narrow it down (a range, an enum, a schema) and they come out on their own.";
        case "sin-parametros":
            return "With no parameters there are no partitions to derive: all that is left are the properties.";
    }
}
export function textoPropiedadEn(p: Propiedad): {
    que: string;
    porque: string;
} {
    return { que: queEn(p.kind, p), porque: porqueEn(p.kind) };
}
function queEn(kind: PropiedadKind, p: Propiedad): string {
    switch (kind) {
        case "total": return "For any valid input in the domain, the function does not throw.";
        case "determinista": return "Two calls with the same input return the same output.";
        case "honesta": return "It does not return NaN or Infinity for any valid input.";
        case "rango": {
            const r = p.rango!;
            return `Rejects every \`${r.parametro}\` outside [${r.min}, ${r.max}].`;
        }
    }
}
function porqueEn(kind: PropiedadKind): string {
    switch (kind) {
        case "total": return "The domain is declared by the type itself, so it can be fuzzed without knowing what it computes.";
        case "determinista": return "If this fails, there is hidden state, a clock or randomness inside \u2014 and then no example test is reliable.";
        case "honesta": return "A NaN does not throw: it propagates silently and shows up three layers away, with no trace of where it was born.";
        case "rango": return "The range is in the type: the check is objective and does not depend on the domain.";
    }
}
