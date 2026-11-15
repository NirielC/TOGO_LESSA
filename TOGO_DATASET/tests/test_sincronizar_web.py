"""
Pruebas de tools/sincronizar_web.py (sin Supabase ni TensorFlow):

    python -m unittest discover -s tests
"""

import gzip
import json
import struct
import sys
import unittest
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "tools"))

from sincronizar_web import a_640x480, ajustar_largo, carpeta, leer_togo, remuestrear  # noqa: E402


def hacer_togo(crudo, tiempos, comprimir=True, **meta):
    """Escribe un .togo según el formato de TOGO_COLABORA/src/captura/formato.js."""
    enc = json.dumps({"v": 1, "n": len(crudo), "dim": 258, "escala": 10000, "t": tiempos, **meta}).encode()
    if len(enc) % 2:
        enc += b" "
    datos = np.clip(np.round(np.asarray(crudo) * 10000), -32767, 32767).astype("<i2").tobytes()
    b = b"TOGO" + struct.pack("<I", len(enc)) + enc + datos
    return gzip.compress(b) if comprimir else b


class Formato(unittest.TestCase):
    def test_ida_y_vuelta(self):
        crudo = np.random.default_rng(0).uniform(-1, 1, (40, 258)).astype(np.float32)
        for comprimir in (True, False):
            meta, vuelta = leer_togo(hacer_togo(crudo, list(range(0, 2000, 50)), comprimir, sena="hola", ancho=640, alto=480))
            self.assertEqual(meta["sena"], "hola")
            self.assertEqual(vuelta.shape, (40, 258))
            self.assertLess(np.abs(vuelta - crudo).max(), 1e-4)

    def test_rechaza_otro_archivo(self):
        with self.assertRaises(ValueError):
            leer_togo(b"NOPE" + b"\0" * 20)


class Conversiones(unittest.TestCase):
    def test_remuestrear_a_20fps(self):
        crudo = np.arange(30, dtype=np.float32)[:, None].repeat(258, 1)
        t = [i * 66 for i in range(30)]          # teléfono lento: ~15 fps
        r = remuestrear(crudo, t)
        self.assertEqual(len(r), int(t[-1] // 50) + 1)
        self.assertEqual(r[0, 0], 0)
        self.assertEqual(r[-1, 0], 29)

    def test_640x480_vertical(self):
        c = np.zeros((1, 258), np.float32)
        c[0, 0:4] = [0.5, 0.5, 0.1, 0.9]         # nariz
        v = a_640x480(c, 480, 640)
        self.assertAlmostEqual(v[0, 0], 0.375)   # x * 480/640
        self.assertAlmostEqual(v[0, 1], 0.5 * 640 / 480, places=5)
        self.assertAlmostEqual(v[0, 3], 0.9)     # la visibilidad no cambia
        self.assertTrue((v[0, 132:] == 0).all(), "lo ausente sigue en cero")

    def test_ajustar_largo(self):
        self.assertEqual(len(ajustar_largo(np.zeros((30, 258)), 40)), 40)
        self.assertEqual(len(ajustar_largo(np.zeros((60, 258)), 40)), 40)

    def test_carpetas(self):
        self.assertTrue(str(carpeta("letra", "letra_enie", "Ñ")).endswith(str(Path("letras") / "NN")))
        self.assertTrue(str(carpeta("sena", "hola", "Hola")).endswith(str(Path("senas") / "hola")))


if __name__ == "__main__":
    unittest.main()
