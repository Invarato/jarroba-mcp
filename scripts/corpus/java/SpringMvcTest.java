// Java de una aplicación web REAL, que es donde el vocabulario de JUnit + AssertJ + Mockito se
// queda corto. Todos estos casos salían mal antes de medir contra código de otra gente:
//
//   · `andExpect(...)` no disparaba la abstención, porque la regla buscaba el verbo AL PRINCIPIO
//     del nombre y el idioma de Java lo pone en medio. Tests de integración perfectos salían
//     acusados de «no comprueba nada».
//   · `value` metido en la lista plana daba por bueno cualquier `getType().value()`, que es un
//     getter. Un falso APROBADO, que no lo reclama nadie.
//   · `assertThat(x).matcherQueNoConocemos()` no abstenía: `baseDeCadena` buscaba un nodo con
//     «call» en el nombre y en Java se llama `method_invocation`, así que la red no llegaba a
//     cubrir NINGÚN test de Java.
//   · `.as("…")` de AssertJ hacía abstenerse: describir el fallo empeoraba la clasificación.

import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

public class SpringMvcTest {

  private MockMvc mockMvc;
  private Almacen almacen;

  @Test
  public void devuelveElRecursoConSusCampos() throws Exception {
    mockMvc.perform(get("/api/v1/recursos/{id}", 7))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.nombre").value("informe.pdf"))
        .andExpect(jsonPath("$.bloqueado").value(false));
  }

  @Test
  public void rechazaLaPeticionSinPermiso() throws Exception {
    mockMvc.perform(post("/api/v1/recursos"))
        .andExpect(status().isForbidden());
  }

  // Una FAMILIA de estados no es un estado: pasaría igual con un 400 que con un 404, y esa
  // diferencia suele ser justo la que el test quería fijar. Sigue siendo una aserción.
  @Test
  public void fallaConAlgunErrorDeCliente() throws Exception {
    mockMvc.perform(post("/api/v1/recursos"))
        .andExpect(status().is4xxClientError());
  }

  @Test
  public void devuelveElCuerpoExacto() throws Exception {
    mockMvc.perform(get("/api/v1/salud"))
        .andExpect(content().string("OK"));
  }

  // El matcher es de una librería que no conocemos: no sabemos qué comprueba, así que no se acusa.
  @Test
  public void usaUnMatcherQueNoConocemos() throws Exception {
    mockMvc.perform(get("/api/v1/recursos/7"))
        .andExpect(nuestroMatcherDeLaCasa("informe.pdf"));
  }

  // Prepara una petición con `contentType` y NO comprueba la respuesta. `contentType` colgando de
  // `post()` construye; colgando de `content()` afirma. Aquí construye.
  @Test
  public void soloPreparaLaPeticion() throws Exception {
    mockMvc.perform(post("/api/v1/recursos").contentType("application/json").content("{}"));
  }

  // `value()` aquí es un GETTER, no el matcher de jsonPath. La única aserción es DÉBIL a propósito:
  // si `value` volviera a contarse como exacta sin mirar de qué cuelga, este caso saltaría a
  // `afirma` y el corpus se pondría rojo. Con un `isTrue()` no serviría de guardia, porque desde que
  // «es cierto» es exacta el caso saldría `afirma` por los dos caminos y no distinguiría nada.
  @Test
  public void miraUnGetterLlamadoValue() {
    String tipo = almacen.buscar(7).getTipo().value();
    assertThat(tipo).isNotNull();
  }

  // `as(...)` describe el fallo, no afirma: sin declararlo neutro el caso se iría a `indeterminado`
  // y describir el fallo saldría penalizado.
  @Test
  public void describeElFalloConAs() {
    assertThat(almacen.buscar(7)).as("el recurso 7 debería existir").isNotNull();
  }

  // Para un booleano solo hay dos valores, así que «es cierto» es «vale true»: esto AFIRMA. Decirle
  // a alguien que no comprueba qué vale sería falso, y así estaba antes.
  @Test
  public void afirmaSobreUnBooleano() {
    assertTrue(almacen.existe(7));
  }

  // Y la otra cara: `assertNotNull` sí es débil de verdad, porque pasa con CUALQUIER objeto.
  @Test
  public void soloMiraQueNoEsNulo() {
    assertNotNull(almacen.buscar(7));
  }

  // Afirma exactamente igual, pero al fallar solo podrá decir «se esperaba true». Eso se cuenta por
  // el canal de AVISOS; el veredicto no se rebaja.
  @Test
  public void escondeLaComparacionDentroDelBooleano() {
    assertTrue(almacen.buscar(7).getNombre().equals("informe.pdf"));
  }

  @Test
  public void encadenaUnMatcherDesconocidoDeAssertJ() {
    assertThat(almacen.buscar(7)).cumpleNuestroContrato();
  }

  // Fija CON QUÉ se llamó: eso afirma sobre un valor.
  @Test
  public void compruebaConQueSeGuardo() {
    almacen.guardar(new Recurso(7));
    verify(almacen).guardar(new Recurso(7));
  }

  // Y sin argumentos solo comprueba QUE se llamó, que es la clase `solo-llamada`. Los dos casos van
  // juntos a propósito: son la pareja que distingue la regla 4, y con uno solo no se ve nada.
  @Test
  public void compruebaSoloQueSeLlamo() {
    almacen.limpiar();
    verify(almacen).limpiar();
  }
}
