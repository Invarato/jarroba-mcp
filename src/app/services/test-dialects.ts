import type { Fuerza, Lenguaje, MotivoInactivo } from "./test-audit.model";
export interface Dialecto {
    nombre: string;
    lenguaje: Lenguaje;
    exactas?: readonly string[];
    parciales?: readonly string[];
    umbral?: readonly string[];
    fuertes?: readonly string[];
    debiles: readonly string[];
    llamadas: readonly string[];
    condicionadas?: readonly {
        nombre: string;
        cabezas: readonly string[];
        fuerza: Fuerza;
    }[];
}
const JS_EXACTAS = [
    "toBe",
    "toEqual",
    "toStrictEqual",
    "toBeTrue",
    "toBeFalse",
    "isTrue",
    "isFalse",
    "toBeNull",
    "toBeUndefined",
    "toBeNaN",
    "toHaveBeenCalledWith",
    "toHaveBeenNthCalledWith",
    "toHaveBeenLastCalledWith",
    "toBeResolvedTo",
    "toBeRejectedWith",
    "equal",
    "equals",
    "notEqual",
    "strictEqual",
    "notStrictEqual",
    "deepEqual",
    "deepStrictEqual",
    "notDeepEqual",
    "notDeepStrictEqual",
    "same",
    "notSame",
    "is",
    "isNot",
    "eql",
    "ifError",
] as const;
const JS_PARCIALES = [
    "toContain",
    "toContainEqual",
    "toMatch",
    "toMatchObject",
    "toHaveProperty",
    "toHaveLength",
    "toThrow",
    "toThrowError",
    "match",
    "doesNotMatch",
    "throws",
    "doesNotThrow",
    "rejects",
    "doesNotReject",
    "include",
    "fail",
    "toBeRejectedWithError",
] as const;
export const NEUTRALES: readonly string[] = [
    "withContext",
    "not",
    "resolves",
    "and",
    "that",
    "to",
    "be",
    "have",
    "with",
    "which",
    "a",
    "an",
    "as",
    "describedAs",
] as const;
const JS_UMBRAL = [
    "toBeCloseTo",
    "toBeGreaterThan",
    "toBeLessThan",
    "toBeGreaterThanOrEqual",
    "toBeLessThanOrEqual",
] as const;
const JS_DEBILES = [
    "ok",
    "notOk",
    "assert",
    "truthy",
    "falsy",
    "isOk",
    "exists",
    "toBeDefined",
    "toBeTruthy",
    "toBeFalsy",
    "toBeInstanceOf",
    "toExist",
    "toBeResolved",
    "toBeRejected",
    "toBePending",
    "toMatchSnapshot",
    "toMatchInlineSnapshot",
] as const;
const JS_LLAMADAS = [
    "toHaveBeenCalled",
    "toHaveBeenCalledTimes",
    "toBeCalled",
    "toBeCalledTimes",
    "called",
    "calledOnce",
    "calledTwice",
    "callCount",
    "toHaveBeenCalledOnce",
] as const;
const PY_EXACTAS = [
    "assertEqual",
    "assertNotEqual",
    "assertListEqual",
    "assertDictEqual",
    "assertSetEqual",
    "assertTupleEqual",
    "assertCountEqual",
    "assertMultiLineEqual",
    "assertSequenceEqual",
    "assertIs",
    "assertIsNot",
    "assertIsNone",
    "assert_called_with",
    "assert_called_once_with",
    "assert_has_calls",
    "assert_array_equal",
    "assert_frame_equal",
    "assert_series_equal",
    "assert_index_equal",
    "assert_equal",
    "assert_array_less",
    "assertJSONEqual",
    "assertHTMLEqual",
    "assertXMLEqual",
] as const;
const PY_PARCIALES = [
    "assertIn",
    "assertNotIn",
    "assertRaises",
    "assertRaisesRegex",
    "assertWarns",
    "assertRegex",
    "assertNotRegex",
    "assert_raises",
    "assert_warns",
    "assert_string_equal",
    "fnmatch_lines",
    "re_match_lines",
    "no_fnmatch_line",
    "fnmatch_lines_random",
    "assert_outcomes",
    "assertContains",
    "assertNotContains",
    "assertRaisesMessage",
    "assertWarnsMessage",
    "assertRedirects",
    "assertTemplateUsed",
    "assertFormError",
    "assertInHTML",
    "assertQuerySetEqual",
    "assertNumQueries",
] as const;
const PY_UMBRAL = [
    "assertAlmostEqual",
    "assertNotAlmostEqual",
    "assertGreater",
    "assertGreaterEqual",
    "assertLess",
    "assertLessEqual",
    "assert_array_almost_equal",
    "assert_allclose",
] as const;
const PY_DEBILES = [
    "assert_",
    "assertTrue",
    "assertFalse",
    "assertIsNotNone",
    "assertIsInstance",
    "assertNotIsInstance",
    "fail",
] as const;
const PY_LLAMADAS = [
    "assert_called",
    "assert_called_once",
    "assert_any_call",
    "assert_not_called",
] as const;
const JAVA_EXACTAS = [
    "assertEquals",
    "assertNotEquals",
    "assertArrayEquals",
    "assertSame",
    "assertNotSame",
    "assertIterableEquals",
    "assertLinesMatch",
    "isEqualTo",
    "isNotEqualTo",
    "isEqualByComparingTo",
    "containsExactly",
    "isSameAs",
    "hasFieldOrPropertyWithValue",
    "containsEntry",
    "containsOnly",
    "hasValue",
    "isOk",
    "isCreated",
    "isAccepted",
    "isNoContent",
    "isNotFound",
    "isBadRequest",
    "isUnauthorized",
    "isForbidden",
    "isConflict",
    "isGone",
    "isNotModified",
    "isPreconditionFailed",
    "isInternalServerError",
    "isUnprocessableEntity",
    "isMethodNotAllowed",
    "isTooManyRequests",
    "isPartialContent",
    "assertTrue",
    "assertFalse",
    "isTrue",
    "isFalse",
    "assertNull",
    "isNull",
    "isEmpty",
] as const;
const JAVA_PARCIALES = [
    "assertThrows",
    "assertTimeout",
    "contains",
    "containsExactlyInAnyOrder",
    "hasSize",
    "startsWith",
    "endsWith",
    "matches",
    "isInstanceOf",
    "hasMessage",
    "hasMessageContaining",
    "extracting",
    "usingRecursiveComparison",
    "redirectedUrl",
    "doesNotContain",
    "is2xxSuccessful",
    "is3xxRedirection",
    "is4xxClientError",
    "is5xxServerError",
] as const;
const JAVA_UMBRAL = [
    "isCloseTo",
    "isGreaterThan",
    "isLessThan",
    "isGreaterThanOrEqualTo",
    "isLessThanOrEqualTo",
    "isBetween",
    "isAfter",
    "isBefore",
    "hasSizeGreaterThan",
] as const;
const JAVA_DEBILES = [
    "assertNotNull",
    "assertDoesNotThrow",
    "isNotNull",
    "isNotEmpty",
    "fail",
    "assertThat",
    "exists",
    "doesNotExist",
    "isPresent",
    "assertThatThrownBy",
    "assertThatExceptionOfType",
] as const;
const JAVA_LLAMADAS = ["verify", "verifyNoInteractions", "verifyNoMoreInteractions", "should"] as const;
const JAVA_CONDICIONADAS = [
    { nombre: "value", cabezas: ["jsonPath", "header", "cookie"], fuerza: "exacta" },
    { nombre: "string", cabezas: ["content", "header", "cookie"], fuerza: "exacta" },
    { nombre: "json", cabezas: ["content"], fuerza: "exacta" },
    { nombre: "xml", cabezas: ["content"], fuerza: "exacta" },
    { nombre: "bytes", cabezas: ["content"], fuerza: "exacta" },
    { nombre: "contentType", cabezas: ["content"], fuerza: "parcial" },
] as const satisfies readonly {
    nombre: string;
    cabezas: readonly string[];
    fuerza: Fuerza;
}[];
const GO_EXACTAS = [
    "Errorf",
    "Fatalf",
    "Equal",
    "EqualValues",
    "NotEqual",
    "JSONEq",
    "EqualError",
    "ErrorIs",
    "True",
    "False",
    "Nil",
    "Empty",
    "NoError",
    "Zero",
] as const;
const GO_PARCIALES = [
    "Contains",
    "NotContains",
    "Len",
    "ErrorAs",
    "ElementsMatch",
    "Regexp",
    "ErrorContains",
    "NotErrorIs",
    "Subset",
    "IsType",
    "PanicsWithError",
    "PanicsWithValue",
    "Implements",
    "FileExists",
    "DirExists",
    "YAMLEq",
    "Same",
    "NotSame",
    "Eventually",
    "Never",
    "WithinDuration",
] as const;
const GO_UMBRAL = [
    "Greater",
    "Less",
    "GreaterOrEqual",
    "LessOrEqual",
    "Positive",
    "Negative",
    "InDelta",
    "InEpsilon",
] as const;
const GO_DEBILES = [
    "Panics",
    "NotPanics",
    "Fail",
    "FailNow",
    "NotNil",
    "NotEmpty",
] as const;
const GO_CONDICIONADAS = [
    { nombre: "Error", cabezas: ["t", "b", "tb", "f", "tt"], fuerza: "exacta" },
    { nombre: "Fatal", cabezas: ["t", "b", "tb", "f", "tt"], fuerza: "exacta" },
    { nombre: "Error", cabezas: ["require", "assert"], fuerza: "debil" },
] as const satisfies readonly {
    nombre: string;
    cabezas: readonly string[];
    fuerza: Fuerza;
}[];
const PY_CONDICIONADAS = [
    { nombre: "raises", cabezas: ["pytest"], fuerza: "parcial" },
    { nombre: "warns", cabezas: ["pytest"], fuerza: "parcial" },
    { nombre: "deprecated_call", cabezas: ["pytest"], fuerza: "parcial" },
] as const satisfies readonly {
    nombre: string;
    cabezas: readonly string[];
    fuerza: Fuerza;
}[];
const GO_LLAMADAS = ["AssertCalled", "AssertExpectations", "AssertNumberOfCalls"] as const;
export const DIALECTOS: readonly Dialecto[] = [
    { nombre: "jasmine/jest/vitest/chai/tape", lenguaje: "typescript", exactas: JS_EXACTAS, parciales: JS_PARCIALES, umbral: JS_UMBRAL, debiles: JS_DEBILES, llamadas: JS_LLAMADAS },
    { nombre: "jasmine/jest/vitest/chai/tape", lenguaje: "javascript", exactas: JS_EXACTAS, parciales: JS_PARCIALES, umbral: JS_UMBRAL, debiles: JS_DEBILES, llamadas: JS_LLAMADAS },
    { nombre: "unittest/pytest/numpy/django", lenguaje: "python", exactas: PY_EXACTAS, parciales: PY_PARCIALES, umbral: PY_UMBRAL, debiles: PY_DEBILES, llamadas: PY_LLAMADAS, condicionadas: PY_CONDICIONADAS },
    { nombre: "junit/assertj/mockito/mockmvc", lenguaje: "java", exactas: JAVA_EXACTAS, parciales: JAVA_PARCIALES, umbral: JAVA_UMBRAL, debiles: JAVA_DEBILES, llamadas: JAVA_LLAMADAS, condicionadas: JAVA_CONDICIONADAS },
    { nombre: "go test/testify", lenguaje: "go", exactas: GO_EXACTAS, parciales: GO_PARCIALES, umbral: GO_UMBRAL, debiles: GO_DEBILES, llamadas: GO_LLAMADAS, condicionadas: GO_CONDICIONADAS },
];
export const MARCADORES_INACTIVOS: Readonly<Record<Lenguaje, readonly {
    patron: RegExp;
    motivo: MotivoInactivo;
}[]>> = {
    typescript: [
        { patron: /^(xit|xdescribe|xtest)$/, motivo: "skip" },
        { patron: /^(it|test|describe)\.(skip|todo|failing)$/, motivo: "skip" },
        { patron: /^(it|test)\.skip$/, motivo: "skip" },
        { patron: /^pending$/, motivo: "pendiente" },
    ],
    javascript: [
        { patron: /^(xit|xdescribe|xtest)$/, motivo: "skip" },
        { patron: /^(it|test|describe)\.(skip|todo|failing)$/, motivo: "skip" },
        { patron: /^pending$/, motivo: "pendiente" },
    ],
    python: [
        { patron: /^@?pytest\.mark\.skip(if)?$/, motivo: "skip" },
        { patron: /^@?unittest\.skip(If|Unless)?$/, motivo: "skip" },
        { patron: /^@?pytest\.mark\.xfail$/, motivo: "pendiente" },
    ],
    java: [
        { patron: /^@?Ignore$/, motivo: "ignorado" },
        { patron: /^@?Disabled$/, motivo: "ignorado" },
    ],
    go: [
        { patron: /^t\.Skip(Now|f)?$/, motivo: "skip" },
    ],
};
export function vocabulario(lenguaje: Lenguaje, extra: readonly Dialecto[] = []): Map<string, Fuerza> {
    const m = new Map<string, Fuerza>();
    const aplicables = [...DIALECTOS, ...extra].filter((d) => d.lenguaje === lenguaje);
    for (const d of aplicables) {
        for (const n of d.llamadas)
            m.set(n, "llamada");
        for (const n of d.debiles)
            m.set(n, "debil");
        for (const n of d.umbral ?? [])
            m.set(n, "umbral");
        for (const n of d.parciales ?? [])
            m.set(n, "parcial");
        for (const n of d.exactas ?? [])
            m.set(n, "exacta");
        for (const n of d.fuertes ?? [])
            m.set(n, "exacta");
    }
    return m;
}
export function vocabularioCondicionado(lenguaje: Lenguaje, extra: readonly Dialecto[] = []): Map<string, readonly {
    cabezas: ReadonlySet<string>;
    fuerza: Fuerza;
}[]> {
    const m = new Map<string, {
        cabezas: ReadonlySet<string>;
        fuerza: Fuerza;
    }[]>();
    for (const d of [...DIALECTOS, ...extra].filter((x) => x.lenguaje === lenguaje)) {
        for (const c of d.condicionadas ?? []) {
            const lista = m.get(c.nombre) ?? [];
            lista.push({ cabezas: new Set(c.cabezas), fuerza: c.fuerza });
            m.set(c.nombre, lista);
        }
    }
    return m;
}
export function nombreDialecto(lenguaje: Lenguaje): string | null {
    return DIALECTOS.find((d) => d.lenguaje === lenguaje)?.nombre ?? null;
}
