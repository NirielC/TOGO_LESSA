"""
Pruebas de la capa de contexto (togo_contexto.py), sin TensorFlow:

    python -m unittest discover -s tests

Los casos de casos_contexto.json usan la tabla real de la app
(TOGO_MOVIL/src/data/contexto.json); contexto.ts debe dar lo mismo.
"""

import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from config import CLASSES, LETRAS  # noqa: E402
from togo_contexto import GRUPOS_PREVIOS, GRUPOS_SIGUEN, TABLA_APP, Contexto, cargar_tabla, claves_previas, espera_letras, normalizar  # noqa: E402

CASOS = json.loads((Path(__file__).parent / "casos_contexto.json").read_text(encoding="utf-8"))
# Textos de las señas como en TOGO_MOVIL/src/core/signs/vocabulary.ts (los que importan aquí).
TEXTOS = {
    "hola": "Hola", "como_estas": "¿Cómo estás?", "estoy_bien": "Estoy bien", "estoy_mal": "Estoy mal",
    "estoy_mas_o_menos": "Estoy más o menos", "mi_nombre_es": "Mi nombre es", "si": "Sí",
    "a_que_hora_es": "¿A qué hora es?", "por_la_tarde": "Por la tarde", "ok_adios": "Ok, adiós",
}


class TablaDeLaApp(unittest.TestCase):
    def test_existe_y_se_lee(self):
        self.assertTrue(TABLA_APP.exists(), f"falta {TABLA_APP}")
        t = cargar_tabla()
        self.assertGreater(len(t["reglas"]), 0)
        self.assertTrue(0 < t["margen_duda"] < 1)

    def test_solo_etiquetas_conocidas(self):
        """Al sumar señas: cada etiqueta de la tabla debe existir en config.CLASSES o ser letra/grupo."""
        conocidas = set(CLASSES) | {l for l in LETRAS if not l.startswith("_")}
        for r in cargar_tabla()["reglas"]:
            previos = [r["despues_de"]] if isinstance(r["despues_de"], str) else r["despues_de"]
            for e in previos:
                self.assertIn(e, conocidas | GRUPOS_PREVIOS, f"despues_de desconocido: {e}")
            for e, apoyo in r["siguen"].items():
                self.assertIn(e, conocidas | GRUPOS_SIGUEN, f"siguen desconocido: {e}")
                self.assertTrue(0 <= apoyo <= 1, f"apoyo fuera de 0..1: {e}={apoyo}")

    def test_nada_nunca_recibe_apoyo(self):
        ctx = Contexto()
        for k in GRUPOS_PREVIOS | set(CLASSES):
            self.assertEqual(ctx.apoyo("nada", [k]), 0.0)


class Reordenar(unittest.TestCase):
    def test_casos(self):
        ctx = Contexto()
        for c in CASOS["reordenar"]:
            with self.subTest(c["nombre"]):
                top = [(e, p) for e, p, _ in c["top"]]
                nuevo, cambio = ctx.reordenar(top, c["previos"])
                self.assertEqual(nuevo[0][0], c["primero"])
                self.assertEqual(cambio, c["cambio"])
                self.assertLessEqual(sum(p for _, p in nuevo), 1.0 + 1e-6)
                self.assertEqual(sorted(e for e, _ in nuevo), sorted(e for e, _ in top), "no inventa opciones")

    def test_empujon_acotado(self):
        """Con apoyo máximo una opción pesa a lo más (1 + fuerza) veces más: no voltea una diferencia grande."""
        tabla = {"margen_duda": 0.9, "fuerza": 1.0, "reglas": [{"despues_de": "x", "siguen": {"b": 1}}]}
        ctx = Contexto(tabla)
        nuevo, _ = ctx.reordenar([("a", 0.7), ("b", 0.3)], ["x"])
        self.assertEqual(nuevo[0][0], "a")          # 0.7 > 0.3 × 2
        nuevo, _ = ctx.reordenar([("a", 0.55), ("b", 0.45)], ["x"])
        self.assertEqual(nuevo[0][0], "b")          # 0.55 < 0.45 × 2

    def test_grupos_y_listas(self):
        tabla = {"reglas": [{"despues_de": ["p", "q"], "siguen": {"@letra": 0.5, "@sena": 0.2, "hola": 1}}]}
        ctx = Contexto(tabla)
        self.assertEqual(ctx.apoyo("A", ["q"]), 0.5)
        self.assertEqual(ctx.apoyo("si", ["p"]), 0.2)
        self.assertEqual(ctx.apoyo("hola", ["p"]), 1.0)
        self.assertEqual(ctx.apoyo("hola", ["otra"]), 0.0)

    def test_una_sola_opcion(self):
        self.assertEqual(Contexto().reordenar([("hola", 0.4)], ["@inicio"]), ([("hola", 0.4)], False))


class Claves(unittest.TestCase):
    def test_casos(self):
        for c in CASOS["claves"]:
            with self.subTest(c["nombre"]):
                msg = tuple(c["mensaje"]) if c["mensaje"] else None
                self.assertEqual(claves_previas(c["borrador"], msg, TEXTOS), c["claves"])

    def test_espera_letras(self):
        self.assertTrue(espera_letras(["mi_nombre_es", "@sena"]))
        self.assertTrue(espera_letras(["@letra"]))
        self.assertFalse(espera_letras(["hola", "@sena"]))
        self.assertFalse(espera_letras(["@inicio"]))

    def test_normalizar(self):
        self.assertEqual(normalizar("¿Cómo estás?"), "como estas")
        self.assertEqual(normalizar("Ok, adiós."), "ok adios")


if __name__ == "__main__":
    unittest.main()
