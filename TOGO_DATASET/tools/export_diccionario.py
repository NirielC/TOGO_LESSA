"""
EXPORTAR EL DICCIONARIO DE SEÑAS PARA LA APP.

Las animaciones del diccionario salen de los datos REALES del dataset (nada
inventado): para cada seña se elige la grabación más representativa (la más
parecida al promedio de su clase, con manos bien visibles) y se guarda su
movimiento simplificado: torso, brazos y las dos manos, 30 cuadros.

También se calculan pistas honestas a partir de los datos:
  - cuántas manos se usan,
  - si el movimiento es corto o amplio,
  - a qué altura se hace (cara, pecho, abajo).

Si ya existe el abecedario capturado (caché de train_abecedario.py), agrega
la forma de mano representativa de cada letra.

Uso:
    python tools/export_diccionario.py
Salida: TOGO_MOVIL/src/data/diccionario.json
"""

import json
import sys
from pathlib import Path

import numpy as np

ROOT_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT_DIR))

from config import ALTO, ANCHO, CLASSES, DATASET_DIR, LANDMARKS_DIR as _LM  # noqa: E402
from togo_features import HAND_DIM, POSE_DIM, normalize_sequence  # noqa: E402

# Usa la versión actual; si aún no tiene datos, la v2 (los 4000 videos originales).
LANDMARKS_DIR = _LM if any(_LM.glob("*/*.npy")) else DATASET_DIR / "landmarks_v2"
ABC_CACHE = DATASET_DIR / "abecedario" / "features_estaticas.npz"
OUT = ROOT_DIR.parent / "TOGO_MOVIL" / "src" / "data" / "diccionario.json"

# Puntos de pose que se dibujan: nariz, hombros, codos, muñecas, caderas.
POSE_POINTS = [0, 11, 12, 13, 14, 15, 16, 23, 24]


def cargar_clase(clase):
    seqs = []
    for f in sorted((LANDMARKS_DIR / clase).glob("*.npy")):
        seqs.append(normalize_sequence(np.load(f), ANCHO, ALTO))
    return np.stack(seqs) if seqs else None


def manos_por_frame(seq):
    l = np.abs(seq[:, POSE_DIM:POSE_DIM + HAND_DIM]).sum(1) > 0
    r = np.abs(seq[:, POSE_DIM + HAND_DIM:]).sum(1) > 0
    return l, r


def representativa(seqs):
    """La grabación más cercana al promedio, entre las que tienen manos en casi todo el clip."""
    cobertura = np.array([(lambda l, r: (l | r).mean())(*manos_por_frame(s)) for s in seqs])
    buenas = np.where(cobertura >= np.quantile(cobertura, 0.5))[0]
    media = seqs[buenas].mean(0)
    d = ((seqs[buenas] - media) ** 2).sum((1, 2))
    return seqs[buenas[int(np.argmin(d))]]


def simplificar(seq):
    """30 cuadros -> lista de {p: [[x,y]*9], l: [[x,y]*21]|None, r: ...} con 2 decimales."""
    frames = []
    for f in seq:
        pose = f[:POSE_DIM].reshape(33, 4)[POSE_POINTS, :2]
        hands = f[POSE_DIM:].reshape(2, 21, 3)[:, :, :2]
        def pts(a):
            return [[round(float(x), 2), round(float(y), 2)] for x, y in a]
        frames.append({
            "p": pts(pose),
            "l": pts(hands[0]) if np.abs(hands[0]).sum() > 0 else None,
            "r": pts(hands[1]) if np.abs(hands[1]).sum() > 0 else None,
        })
    return frames


def pistas(seqs):
    """Rasgos medidos sobre TODA la clase (no solo la representativa)."""
    dos = []
    mov = []
    alto = []
    for s in seqs:
        l, r = manos_por_frame(s)
        dos.append((l & r).mean())
        wr = s[:, [POSE_DIM, POSE_DIM + HAND_DIM]].copy()  # x de muñecas
        wy = s[:, [POSE_DIM + 1, POSE_DIM + HAND_DIM + 1]]
        presentes = np.stack([l, r], 1)
        if presentes.any():
            mov.append(np.nanstd(np.where(presentes, wr, np.nan)) + np.nanstd(np.where(presentes, wy, np.nan)))
            alto.append(np.nanmean(np.where(presentes, wy, np.nan)))
    manos = 2 if np.mean(dos) > 0.4 else 1
    m = float(np.nanmean(mov)) if mov else 0
    y = float(np.nanmean(alto)) if alto else 1
    movimiento = "amplio" if m > 0.45 else "medio" if m > 0.22 else "corto"
    # y en anchos de hombro: negativo = arriba de los hombros.
    zona = "la cara" if y < -0.35 else "el pecho" if y < 0.6 else "la cintura"
    return {"manos": manos, "movimiento": movimiento, "zona": zona}


def letras():
    if not ABC_CACHE.exists():
        return []
    d = np.load(ABC_CACHE, allow_pickle=True)
    X, y = d["X"], d["y"]
    out = []
    for letra in sorted(set(y.tolist())):
        if letra.startswith("_"):
            continue
        g = X[y == letra]
        rep = g[int(np.argmin(((g - g.mean(0)) ** 2).sum(1)))].reshape(21, 3)[:, :2]
        out.append({"letra": letra, "mano": [[round(float(a), 2), round(float(b), 2)] for a, b in rep]})
    return out


def main():
    senas = []
    for clase in CLASSES:
        if clase == "nada":  # no es una seña que se aprenda
            continue
        seqs = cargar_clase(clase)
        if seqs is None:
            continue
        senas.append({
            "id": clase,
            "frames": simplificar(representativa(seqs)),
            "pistas": pistas(seqs),
            "grabaciones": int(len(seqs)),
        })
        print(f"  {clase}: {len(seqs)} grabaciones · {senas[-1]['pistas']}")
    data = {"fps": 20, "senas": senas, "letras": letras()}
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"Listo: {OUT} ({OUT.stat().st_size / 1024:.0f} KB, {len(senas)} señas, {len(data['letras'])} letras)")


if __name__ == "__main__":
    main()
