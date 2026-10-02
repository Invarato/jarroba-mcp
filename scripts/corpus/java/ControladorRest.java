// **Código de PRODUCCIÓN, no un test. Este fichero no debe aportar ni un caso.**
//
// Su etiqueta en `etiquetas.json` es un objeto vacío a propósito: si el parser delimita aquí un
// caso, el corpus se pone rojo por «un caso que el corpus NO etiqueta».
//
// El fallo que fija: `/^test/i` sobre el nombre del método es la convención de JUnit 3, de cuando no
// había anotaciones, y aplicarla a secas mete controladores REST en la auditoría. En código real
// aparecieron métodos `@PostMapping` llamados `testSubirBytes` —endpoints de un sandbox, en
// `src/main/java`— contados como casos de prueba y acusados de no comprobar nada. Es el mismo error
// que `test.equal(...)` en JavaScript: confundir el NOMBRE con el papel.

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class ControladorRest {

  private Almacen almacen;

  @PostMapping("/sandbox/subir-bytes")
  public ResponseEntity<String> testSubirBytes(@RequestParam("nombre") String nombre) {
    almacen.guardar(nombre);
    return ResponseEntity.ok("subido");
  }

  @PostMapping("/sandbox/descargar")
  public ResponseEntity<String> testDescargar(@RequestParam("nombre") String nombre) {
    return ResponseEntity.ok(almacen.leer(nombre));
  }
}
