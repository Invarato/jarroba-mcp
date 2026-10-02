# unittest y pytest, que afirman de formas incompatibles: uno con métodos y otro con la SENTENCIA
# `assert`. Un clasificador que solo mire llamadas deja fuera al framework más usado de Python.

import unittest
import pytest

from .ayudas import comprueba_contrato


class TestUnittest(unittest.TestCase):
    def test_exacta(self):
        self.assertEqual(suma(2, 3), 5)

    def test_parcial(self):
        self.assertIn('a', listar())

    def test_umbral(self):
        self.assertGreater(medir(), 0)

    def test_debil(self):
        self.assertTrue(construir())

    def test_llamada(self):
        construir()
        espia.assert_called()

    def test_sin_asercion(self):
        suma(2, 3)
        print('hecho')

    @unittest.skip('pendiente desde hace meses')
    def test_desactivado(self):
        self.assertEqual(suma(2, 3), 5)


# ── pytest: aquí no se llama a nada, se usa la sentencia assert ──────────────────────────────────

def test_pytest_exacta():
    assert suma(2, 3) == 5


def test_pytest_parcial():
    assert 'a' in listar()


def test_pytest_umbral():
    assert medir() > 0


def test_pytest_debil():
    assert construir()


def test_pytest_sin_asercion():
    suma(2, 3)


@pytest.mark.skip(reason='se rompio al cambiar el requisito')
def test_pytest_desactivado():
    assert suma(2, 3) == 5


def test_helper_importado():
    comprueba_contrato('caso-1')
