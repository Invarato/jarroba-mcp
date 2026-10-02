// La stdlib de Go no tiene aserciones: se afirma con `if cond { t.Errorf(...) }`. Un clasificador
// que busque matchers no encuentra NADA en una suite de Go idiomática.

package suma

import "testing"

func TestExacta(t *testing.T) {
	if r := Suma(2, 3); r != 5 {
		t.Errorf("esperaba 5, salio %d", r)
	}
}

func TestParcial(t *testing.T) {
	assert.Contains(t, Listar(), "a")
}

func TestUmbral(t *testing.T) {
	assert.InDelta(t, 1.0, Medir(), 0.01)
}

func TestDebil(t *testing.T) {
	if Construir() == nil {
		t.Fail()
	}
}

func TestSinAsercion(t *testing.T) {
	Suma(2, 3)
}

func TestDesactivado(t *testing.T) {
	t.Skip("pendiente")
	if r := Suma(2, 3); r != 5 {
		t.Errorf("mal")
	}
}
