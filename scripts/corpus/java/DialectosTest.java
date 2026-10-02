// JUnit 4/5, AssertJ y Mockito. Incluye el caso que más se olvida: `assertThat` SIN matcher
// encadenado no afirma nada por sí solo, aunque lo parezca por el nombre.

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Disabled;
import static org.assertj.core.api.Assertions.assertThat;

public class DialectosTest {

  @Test
  public void testExacta() {
    assertEquals(5, suma(2, 3));
  }

  @Test
  public void testParcial() {
    assertThat(listar()).contains("a");
  }

  @Test
  public void testUmbral() {
    assertThat(medir()).isGreaterThan(0);
  }

  @Test
  public void testDebil() {
    assertNotNull(construir());
  }

  @Test
  public void testLlamada() {
    construir();
    verify(espia).construir();
  }

  @Test
  public void testSinAsercion() {
    suma(2, 3);
  }

  @Test
  @Disabled("se comento al cambiar el requisito")
  public void testDesactivado() {
    assertEquals(5, suma(2, 3));
  }
}
