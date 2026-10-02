import { UnServicio } from "./un-servicio";
import { montaEscenario } from "./ayudas";
describe("escala de fuerza", () => {
    it("exacta: afirma qu\u00E9 vale", () => {
        expect(suma(2, 3)).toBe(5);
    });
    it("parcial: afirma que contiene", () => {
        expect(listar()).toContain("a");
    });
    it("umbral: afirma que cae en un rango", () => {
        expect(medir()).toBeGreaterThan(0);
    });
    it("debil: afirma que existe", () => {
        expect(construir()).toBeDefined();
    });
    it("llamada: solo que se llam\u00F3", () => {
        construir();
        expect(espia).toHaveBeenCalled();
    });
    it("sin nada", () => {
        construir();
    });
});
describe("falso numero 1 del prototipo", () => {
    it("expectAsync resuelto", async () => {
        await expectAsync(cargar()).toBeResolvedTo(42);
    });
    it("expectAsync rechazado", async () => {
        await expectAsync(cargar()).toBeRejectedWith(new Error("no"));
    });
});
describe("casos desactivados", () => {
    xit("desactivado con xit", () => {
        expect(suma(2, 3)).toBe(5);
    });
    it.skip("desactivado con it.skip", () => {
        expect(suma(2, 3)).toBe(5);
    });
});
describe("helpers", () => {
    function compruebaRedondeo(entrada: number, esperado: number): void {
        expect(redondear(entrada)).toBe(esperado);
    }
    it("afirma a traves de helper local", () => {
        compruebaRedondeo(1.4, 1);
    });
    it("helper importado de modulo local", () => {
        montaEscenario("vacio");
    });
});
describe("matchers que faltaban", () => {
    it("toBeTrue de jasmine", () => {
        expect(todosPositivos([1, 2])).toBeTrue();
    });
    it("toBeFalse de jasmine", () => {
        expect(hayHuecos([1, 2])).toBeFalse();
    });
    it("withContext en medio de la cadena", () => {
        expect(sumar(2, 3)).withContext("2+3").toBe(5);
    });
    it("matcher de un framework que no conocemos", () => {
        expect(sumar(2, 3)).toBeQuiteCloseToFive();
    });
});
