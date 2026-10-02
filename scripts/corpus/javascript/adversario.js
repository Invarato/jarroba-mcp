const test = require("tape");
const { runTest } = require("./helpers");
test("tape afirma con t.equal", (t) => {
    t.equal(suma(2, 3), 5);
    t.end();
});
test("tape con deepEqual", (t) => {
    t.deepEqual(partir("a,b"), ["a", "b"]);
    t.end();
});
function compruebaPar(t, entrada, esperado) {
    t.equal(normaliza(entrada), esperado);
}
test("helper del mismo fichero", (t) => {
    compruebaPar(t, "A", "a");
    t.end();
});
function expect(arr, enc) {
    if (arr.join("") !== enc)
        throw new Error("no casa");
}
test("expect casero de hpack.js", (t) => {
    codifica([1, 2, 3]);
    expect([1, 2, 3], "123");
    t.end();
});
test("helper importado", (t) => {
    runTest(t, "caso-1");
    t.end();
});
test("no afirma nada de nada", (t) => {
    suma(2, 3);
    t.end();
});
test("solo comprueba que existe", (t) => {
    t.ok(suma(2, 3));
    t.end();
});
function comprobarContrato(v, esperado) {
    if (v !== esperado)
        throw new Error("no cumple");
}
test("expect casero con nombre en espa\u00F1ol", (t) => {
    comprobarContrato(pago(), "ok");
    t.end();
});
test("protobufjs afirma con test.equal", (t) => {
    test.equal(codifica("a"), "YQ==", "deber\u00EDa codificar");
    t.end();
});
