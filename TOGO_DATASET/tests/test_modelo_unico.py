"""
Pruebas del armado del dataset del modelo único (tools/train_unico.py), sin TensorFlow:

    python -m unittest discover -s tests
"""

import shutil
import sys
import tempfile
import unittest
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "tools"))

import datos_sinteticos as ds  # noqa: E402
import train_unico as tu  # noqa: E402
from togo_contexto import Contexto  # noqa: E402
from togo_features import (  # noqa: E402
    FRAME_DIM, POSE_DIM, SEQ_LEN, UNICO_DIM, V3_DIM, build_features_unico, letter_features_seq, mirror_features_unico,
)

ANCHO, ALTO = tu.ANCHO, tu.ALTO


def espejo_crudo(raw):
    """La misma toma vista en espejo (x -> 1 - x, mano izquierda <-> derecha)."""
    m = np.array(raw, copy=True)
    T = len(m)
    pose = m[:, :POSE_DIM].reshape(T, 33, 4)
    pose[:, :, 0] = np.where(pose[:, :, 0] != 0, 1 - pose[:, :, 0], 0)
    manos = m[:, POSE_DIM:].reshape(T, 2, 21, 3).copy()
    manos[..., 0] = np.where(np.abs(manos).sum(-1) > 0, 1 - manos[..., 0], 0)
    m[:, POSE_DIM:] = manos[:, ::-1].reshape(T, -1)
    return m


class Caracteristicas(unittest.TestCase):
    def setUp(self):
        self.raw = ds.toma("A", "letra", 1001, False, 0)

    def test_forma(self):
        f = build_features_unico(self.raw, ANCHO, ALTO)
        self.assertEqual(f.shape, (SEQ_LEN, UNICO_DIM))
        self.assertEqual(UNICO_DIM, V3_DIM + 63)
        self.assertTrue(np.isfinite(f).all())

    def test_letra_igual_en_espejo(self):
        """La parte de letra ve siempre una mano derecha: la misma letra con la otra mano da lo mismo."""
        a = letter_features_seq(self.raw, ANCHO, ALTO)
        b = letter_features_seq(espejo_crudo(self.raw), ANCHO, ALTO)
        self.assertLess(np.abs(a - b).max(), 1e-4)

    def test_espejo_no_toca_la_letra(self):
        f = build_features_unico(self.raw, ANCHO, ALTO)
        m = mirror_features_unico(f)
        np.testing.assert_array_equal(m[:, V3_DIM:], f[:, V3_DIM:])
        np.testing.assert_allclose(mirror_features_unico(m), f, atol=1e-6)

    def test_sin_mano_ceros(self):
        raw = self.raw.copy()
        raw[:, POSE_DIM:] = 0
        self.assertFalse(build_features_unico(raw, ANCHO, ALTO)[:, V3_DIM:].any())


class Carga(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.dir = Path(tempfile.mkdtemp(prefix="togo_prueba_unico_"))
        lm, web = cls.dir / "landmarks", cls.dir / "web"
        guardar = lambda ruta, raw: (ruta.parent.mkdir(parents=True, exist_ok=True), np.save(ruta, raw))  # noqa: E731
        for i in range(3):
            guardar(lm / "hola" / f"p1_{i:04d}.npy", ds.toma("hola", "sena", 1, False, i))
            guardar(web / "senas" / "hola" / f"p1001_h{i}.npy", ds.toma("hola", "sena", 1001, False, i))
            guardar(web / "senas" / "nada" / f"p1001_n{i}.npy", ds.toma("nada", "nada", 1001, False, i))
            guardar(web / "letras" / "A" / f"p1001_a{i}.npy", ds.toma("A", "letra", 1001, False, i))
            guardar(web / "letras" / "B" / f"p1002_b{i}.npy", ds.toma("B", "letra", 1002, False, i))
            guardar(web / "letras_mov" / "NN" / f"p1001_n{i}.npy", ds.toma("Ñ", "letra_mov", 1001, False, i))
        guardar(web / "_revision" / "hola" / "p1001_x.npy", ds.toma("hola", "sena", 1001, False, 9))   # no se entrena
        guardar(web / "letras" / "A" / "p1001_malo.npy", np.zeros((40, 100), np.float32))             # forma mala
        guardar(web / "letras" / "A" / "p1001_corto.npy", np.zeros((5, FRAME_DIM), np.float32))      # muy corto
        cls.tomas = tu.cargar_tomas(lm, web)

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.dir, ignore_errors=True)

    def test_tipos_personas_y_origen(self):
        t = self.tomas
        self.assertEqual(len(t), 18)   # sin _revision ni archivos malos
        cuenta = {}
        for x in t:
            cuenta[(x.clase, x.tipo)] = cuenta.get((x.clase, x.tipo), 0) + 1
        self.assertEqual(cuenta, {("hola", "sena"): 6, ("nada", "nada"): 3, ("A", "letra"): 3, ("B", "letra"): 3, ("Ñ", "letra_mov"): 3})
        self.assertEqual({x.persona for x in t if x.origen == "v3"}, {1})
        self.assertEqual({x.persona for x in t if x.clase == "B"}, {1002})
        self.assertTrue(all(x.raw.shape == (SEQ_LEN, FRAME_DIM) for x in t))

    def test_orden_de_clases(self):
        self.assertEqual(tu.ordenar_clases(self.tomas, minimo=3), ["hola", "A", "B", "Ñ", "nada"])
        self.assertEqual(tu.ordenar_clases(self.tomas, minimo=4), ["hola"])   # las demás tienen 3

    def test_armar_entrenamiento(self):
        clases = tu.ordenar_clases(self.tomas, minimo=3)
        rng = np.random.default_rng(0)
        X, y = tu.armar_entrenamiento(self.tomas, clases, rng, copias=1, copias_deletreo=2, transiciones=0.5)
        n_letras = 9
        # originales + 1 copia aumentada + 2 ventanas de deletreo por letra + transiciones -> "nada"
        self.assertEqual(len(X), 2 * len(self.tomas) + 2 * n_letras + round(0.5 * n_letras))
        self.assertEqual(X.shape[1:], (SEQ_LEN, UNICO_DIM))
        self.assertTrue(np.isfinite(X).all())
        self.assertEqual(set(y.tolist()), set(range(len(clases))))

    def test_decidir_con_umbrales(self):
        clases = ["hola", "A", "nada"]
        tipos = {"hola": "sena", "A": "letra", "nada": "nada"}
        self.assertEqual(tu.decidir(np.array([0.85, 0.1, 0.05]), clases, tipos), "hola")
        self.assertEqual(tu.decidir(np.array([0.78, 0.2, 0.02]), clases, tipos), "nada")    # seña bajo 0.82
        self.assertEqual(tu.decidir(np.array([0.1, 0.78, 0.12]), clases, tipos), "A")        # letra sobre 0.75
        self.assertEqual(tu.decidir(np.array([0.1, 0.5, 0.4]), clases, tipos), "nada")


class Deletreo(unittest.TestCase):
    def setUp(self):
        self.rng = np.random.default_rng(1)
        self.a = ds.toma("A", "letra", 1001, False, 0)
        self.b = ds.toma("B", "letra", 1001, False, 0)

    def test_la_letra_cubre_el_centro(self):
        for n in (10, 25, 40):
            obj = np.full((n, FRAME_DIM), 7.0, np.float32)            # marca: cuadros de la letra
            v = tu.componer_deletreo(obj, self.b[10:30], self.b[10:30], SEQ_LEN, self.rng)
            self.assertEqual(v.shape, (SEQ_LEN, FRAME_DIM))
            self.assertTrue((v[SEQ_LEN // 2] == 7.0).all(), f"n={n}: el centro no es la letra")
            self.assertEqual(int((v == 7.0).all(1).sum()), n)

    def test_sin_vecinas_repite_los_bordes(self):
        obj = tu.estirar(tu.tramo_letra(self.a, "letra"), 12, self.rng)
        v = tu.componer_deletreo(obj, None, None, SEQ_LEN, self.rng)
        self.assertEqual(len(v), SEQ_LEN)
        np.testing.assert_array_equal(v[0], obj[0])
        np.testing.assert_array_equal(v[-1], obj[-1])

    def test_transicion_no_mezcla_con_ceros(self):
        a, b = self.a[20].copy(), self.b[20].copy()
        b[POSE_DIM:] = 0                                              # en b no hay manos
        t = tu.transicion(a, b, 6)
        for f in t:
            mano = f[POSE_DIM + 63:]
            self.assertTrue(np.array_equal(mano, a[POSE_DIM + 63:]) or not mano.any(), "mano a medias")
        mitad = t[len(t) // 2, :POSE_DIM]                            # la pose sí se interpola
        self.assertTrue(np.all((mitad >= np.minimum(a[:POSE_DIM], b[:POSE_DIM]) - 1e-6) & (mitad <= np.maximum(a[:POSE_DIM], b[:POSE_DIM]) + 1e-6)))

    def test_alinear_lleva_el_cuerpo_al_de_referencia(self):
        otra = ds.toma("B", "letra", 1002, False, 0)
        movida = otra.copy()
        pose = movida[:, :POSE_DIM].reshape(len(movida), 33, 4)
        pose[:, :, 0] += 0.1                                          # persona corrida a la derecha
        movida[:, :POSE_DIM] = pose.reshape(len(movida), -1)
        al = tu.alinear(movida, self.a)
        (c1, w1), (c2, w2) = tu._hombros(al), tu._hombros(self.a)
        np.testing.assert_allclose(c1, c2, atol=1e-3)
        self.assertAlmostEqual(w1, w2, delta=0.5)

    def test_ventanas_y_transiciones(self):
        letras = [tu.Toma(ds.toma(c, "letra", 1001, False, i), c, "letra", 1001, "web") for c in "AB" for i in range(2)]
        crudos, clases = tu.ventanas_deletreo(letras, self.rng, copias=3, transiciones=1.0)
        self.assertEqual(clases.count("A"), 6)
        self.assertEqual(clases.count("B"), 6)
        self.assertEqual(clases.count("nada"), 4)
        self.assertTrue(all(c.shape == (SEQ_LEN, FRAME_DIM) for c in crudos))


class EfectoDelContexto(unittest.TestCase):
    def test_evaluar_contexto(self):
        clases = ["hola", "como_estas", "estoy_bien", "S", "si", "nada"]
        # El modelo duda entre "si" y "S" (la correcta es "S") y entre "hola" y "estoy_bien" (la correcta es estoy_bien).
        P = np.array([[0.0, 0.0, 0.0, 0.42, 0.48, 0.10], [0.50, 0.0, 0.40, 0.0, 0.0, 0.10]])
        y = np.array([3, 2])
        tipos = {"hola": "sena", "como_estas": "sena", "estoy_bien": "sena", "S": "letra", "si": "sena", "nada": "nada"}
        r = tu.evaluar_contexto(P, y, clases, Contexto(), tipos)
        self.assertEqual(r["a_favor"]["muestras"], 2)
        self.assertEqual(r["a_favor"]["sin_contexto"], 0.0)
        self.assertEqual(r["a_favor"]["con_contexto"], 1.0)
        self.assertEqual(r["a_favor"]["decision_sin"], 0.0)       # dudando, la app no confirma nada
        self.assertIn("decision_con", r["en_contra"])
        self.assertEqual(set(tu.barrido_fuerza(P, y, clases, tipos)), {"1.0", "1.5", "2.0", "3.0"})


if __name__ == "__main__":
    unittest.main()
