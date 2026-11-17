"""
DATOS SINTÉTICOS para probar train_unico.py de punta a punta (sin tomas reales).

NO sirven para entrenar un modelo de verdad: son cuerpos y manos inventados con
geometría simple. Solo comprueban que el camino completo funciona (cargar,
armar el deletreo, entrenar, exportar a TFLite, reportar).

Escribe la misma estructura que el dataset real, en una carpeta aparte:
    <carpeta>/landmarks/<seña>/p<n>_<i>.npy           como LANDMARKS_DIR (v3, señas)
    <carpeta>/web/senas/<seña>/p<1000+n>_<id>.npy      como WEB_DIR
    <carpeta>/web/letras/<LETRA>/...                    letras quietas
    <carpeta>/web/letras_mov/<LETRA>/...                letras con movimiento (J, Ñ, Z)
Formato crudo (cuadros, 258), 2 s a 20 fps, coordenadas como MediaPipe (0..1).

Uso:  python tools/datos_sinteticos.py <carpeta> [--tomas 5]
"""

import argparse
import sys
import zlib
from pathlib import Path

import numpy as np

ROOT_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT_DIR))

from config import ALTO, ANCHO, CLASSES, LETRAS, LETRAS_CON_MOVIMIENTO  # noqa: E402
from togo_features import FRAME_DIM, HAND_DIM, POSE_DIM, SEQ_LEN  # noqa: E402

# Personas inventadas: (número, origen, zurda). Las del origen "v3" solo graban señas.
PERSONAS = [(1, "v3", False), (2, "v3", False), (1001, "web", False), (1002, "web", False), (1003, "web", True)]

# Base de cada dedo (en palmas, muñeca en 0, "arriba" = y negativa) y largo de sus 3 huesos.
_BASES = [(-0.30, -0.20), (-0.25, -0.95), (0.0, -1.0), (0.22, -0.92), (0.42, -0.80)]
_LARGOS = [(0.40, 0.35, 0.30), (0.45, 0.30, 0.25), (0.50, 0.32, 0.26), (0.45, 0.30, 0.25), (0.35, 0.24, 0.22)]
_DIRS = [(-0.75, -0.65), (-0.12, -1.0), (0.0, -1.0), (0.12, -1.0), (0.25, -1.0)]


def _rng_de(nombre, extra=0):
    return np.random.default_rng(zlib.crc32(nombre.encode("utf-8")) + extra)


def forma_de(clase):
    """Forma de mano propia de cada clase: flexión de los 5 dedos y giro de la mano."""
    r = _rng_de(clase)
    return {"flex": r.uniform(0, 1, 5), "giro": r.uniform(-0.6, 0.6), "abre": r.uniform(-0.2, 0.3)}


def mano(muneca_px, forma, palma_px, zurda, rng, ruido=0.02):
    """21 puntos (x, y, z) normalizados a la imagen, con la geometría de `forma`."""
    pts = np.zeros((21, 3), np.float32)
    flex = np.clip(forma["flex"] + rng.normal(0, ruido * 2, 5), 0, 1)
    for d in range(5):
        bx, by = _BASES[d]
        dx, dy = _DIRS[d]
        dx += forma["abre"] * (d - 2) * 0.15
        n = np.hypot(dx, dy)
        dx, dy = dx / n, dy / n
        p = np.array([bx, by, 0.0])
        pts[1 + 4 * d] = p                  # base del dedo: 1 (pulgar), 5, 9, 13, 17
        acum = 0.0
        for k, largo in enumerate(_LARGOS[d]):
            acum += flex[d] * 0.9           # doblar = el hueso se acerca a la cámara y se ve más corto
            p = p + np.array([dx * largo * np.cos(acum), dy * largo * np.cos(acum), -largo * np.sin(acum) * 0.5])
            pts[2 + 4 * d + k] = p
    g = forma["giro"] + rng.normal(0, ruido)
    c, s = np.cos(g), np.sin(g)
    x, y = pts[:, 0].copy(), pts[:, 1].copy()
    pts[:, 0], pts[:, 1] = c * x - s * y, s * x + c * y
    if zurda:
        pts[:, 0] *= -1
    pts *= palma_px * (1 + rng.normal(0, ruido))
    pts[:, 0] += muneca_px[0]
    pts[:, 1] += muneca_px[1]
    pts += rng.normal(0, ruido * palma_px * 0.15, pts.shape)
    out = pts.copy()
    out[:, 0] /= ANCHO
    out[:, 1] /= ALTO
    out[:, 2] /= ANCHO
    return out


def cuerpo(cx, ancho, rng):
    """33 puntos de pose (x, y, z, visibilidad) de una persona de frente."""
    p = np.zeros((33, 4), np.float32)
    p[:, 3] = 0.9
    hy = 0.55
    p[0, :2] = (cx, hy - 0.22)                                   # nariz
    for i, dx in zip(range(1, 11), (-0.02, -0.03, -0.04, 0.02, 0.03, 0.04, -0.06, 0.06, -0.015, 0.015)):
        p[i, :2] = (cx + dx * ancho * 4, hy - 0.25 + (0.05 if i >= 9 else 0))
    p[11, :2] = (cx + ancho / 2, hy)
    p[12, :2] = (cx - ancho / 2, hy)
    p[23, :2] = (cx + ancho * 0.35, hy + 0.35)
    p[24, :2] = (cx - ancho * 0.35, hy + 0.35)
    for i in range(25, 33):
        p[i, :2] = (cx + (0.1 if i % 2 else -0.1) * ancho * 3, 1.05 + 0.05 * ((i - 25) // 2))
        p[i, 3] = 0.1
    p[:, :2] += rng.normal(0, 0.003, (33, 2))
    return p


def toma(clase, tipo, persona, zurda, i, T=SEQ_LEN):
    """Una toma cruda (T, 258) de `clase`."""
    r = np.random.default_rng(persona * 100_000 + zlib.crc32(clase.encode()) % 10_000 * 10 + i)
    rc = _rng_de(clase, 7)                  # trayectoria propia de la clase
    cx = 0.5 + r.normal(0, 0.03)
    ancho = 0.28 + r.normal(0, 0.02)
    hombro_px = ancho * ANCHO
    palma_px = hombro_px * 0.28 * (1 + r.normal(0, 0.05))
    forma = forma_de(clase)
    forma2 = forma_de(clase + "_2")
    dos_manos = tipo == "sena" and rc.random() < 0.4
    lado = 1 if not zurda else -1           # la mano dominante va del lado de su hombro
    base = np.array([cx * ANCHO + lado * hombro_px * 0.35, 0.50 * ALTO])
    meta = base + np.array([lado * rc.uniform(-0.3, 0.3), rc.uniform(-0.6, 0.1)]) * hombro_px
    amp = rc.uniform(0.05, 0.35) * hombro_px if tipo in ("sena", "letra_mov") else 0.01 * hombro_px
    frec = rc.uniform(0.5, 2.0)
    fase = rc.uniform(0, 2 * np.pi)
    sube = int(r.integers(3, 8))            # cuadros en que la mano sube
    vel = r.uniform(0.85, 1.15)
    raw = np.zeros((T, FRAME_DIM), np.float32)
    for t in range(T):
        pose = cuerpo(cx, ancho, r)
        tt = t * vel / T
        if tipo == "nada":
            hay = r.random() < 0.6
            mun = np.array([cx * ANCHO + lado * hombro_px * 0.4, 0.85 * ALTO]) + r.normal(0, 8, 2)
            f = {"flex": r.uniform(0.2, 0.6, 5), "giro": r.uniform(-0.3, 0.3), "abre": 0.0}
        else:
            hay = t >= sube // 2
            k = min(1.0, t / sube)
            mun = (1 - k) * np.array([base[0], 0.9 * ALTO]) + k * meta
            mun = mun + amp * np.array([np.cos(2 * np.pi * frec * tt + fase), np.sin(2 * np.pi * frec * 1.3 * tt + fase)])
            f = forma
        manos = []
        if hay:
            manos.append((1 if not zurda else 0, mano(mun, f, palma_px, zurda, r)))
            if dos_manos and t >= sube:
                m2 = mun + np.array([-lado * hombro_px * 0.6, 0.0])
                manos.append((0 if not zurda else 1, mano(m2, forma2, palma_px, not zurda, r)))
        for slot, puntos in manos:
            b = POSE_DIM + slot * HAND_DIM
            raw[t, b:b + HAND_DIM] = puntos.reshape(-1)
            pose[15 + (1 - slot), :2] = puntos[0, :2]   # la muñeca de la pose sigue a la mano
        raw[t, :POSE_DIM] = pose.reshape(-1)
    return raw


def generar(carpeta, tomas=5):
    """Escribe el dataset sintético en `carpeta` y devuelve (landmarks_dir, web_dir)."""
    carpeta = Path(carpeta)
    lm, web = carpeta / "landmarks", carpeta / "web"
    letras = [l for l in LETRAS if not l.startswith("_")]
    n = 0
    for persona, origen, zurda in PERSONAS:
        trabajos = [(c, "nada" if c == "nada" else "sena") for c in CLASSES]
        if origen == "web":
            trabajos += [(l, "letra_mov" if l in LETRAS_CON_MOVIMIENTO else "letra") for l in letras]
        for clase, tipo in trabajos:
            for i in range(tomas):
                raw = toma(clase, tipo, persona, zurda, i)
                if origen == "v3":
                    destino = lm / clase / f"p{persona}_{i:04d}.npy"
                else:
                    sub = {"sena": "senas", "nada": "senas", "letra": "letras", "letra_mov": "letras_mov"}[tipo]
                    nombre = "NN" if clase == "Ñ" else clase
                    destino = web / sub / nombre / f"p{persona}_{zlib.crc32(f'{clase}{i}'.encode()):08x}.npy"
                destino.parent.mkdir(parents=True, exist_ok=True)
                np.save(destino, raw)
                n += 1
    print(f"Datos sintéticos: {n} tomas en {carpeta}")
    return lm, web


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("carpeta")
    ap.add_argument("--tomas", type=int, default=5, help="tomas por clase y persona")
    a = ap.parse_args()
    generar(a.carpeta, a.tomas)
