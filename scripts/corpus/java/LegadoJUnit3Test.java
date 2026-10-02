// La otra cara de `ControladorRest.java`: aquí el nombre `testAlgo()` SÍ declara un caso, porque
// esto es JUnit 3 y no existían las anotaciones. Exigir `@Test` a secas dejaría fuera suites enteras
// de proyectos antiguos — que son justo los que más deuda de tests acumulan.
//
// Lo que separa un fichero del otro no es el nombre del método: es que este declara de dónde viene.

import junit.framework.TestCase;

public class LegadoJUnit3Test extends TestCase {

  public void testSumaDosNumeros() {
    assertEquals(5, Calculadora.suma(2, 3));
  }

  public void testConstruyeAlgo() {
    assertNotNull(Calculadora.nueva());
  }

  // Un método que no empieza por `test` es una ayuda, no un caso: JUnit 3 tampoco lo ejecutaba.
  public Calculadora crearCalculadora() {
    return Calculadora.nueva();
  }
}
