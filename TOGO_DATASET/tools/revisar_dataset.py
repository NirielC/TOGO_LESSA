"""
REVISAR EL DATASET: cuánto grabó cada persona y qué falta, antes de entrenar.

    python tools/revisar_dataset.py

Muestra tablas por persona para:
  - Señas (dataset/videos_v3/<clase>/p<N>_*.mp4)       meta: VIDEOS_POR_PERSONA por clase
  - Abecedario, fotos (dataset/abecedario/imagenes/)   meta: 40 por letra
  - Abecedario, clips (dataset/abecedario/videos/)     meta: 20 por letra
y avisa de archivos con nombre raro (sin número de persona).
"""

import sys
from collections import defaultdict
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT_DIR))

from config import ABC_IMAGENES_DIR, ABC_VIDEOS_DIR, CLASSES, LETRAS, LETRAS_CON_MOVIMIENTO, VIDEOS_DIR, VIDEOS_POR_PERSONA  # noqa: E402

META_FOTOS = 40
META_CLIPS = 20


def contar(carpeta: Path, ext: str):
    """{persona: n} y lista de archivos sin persona."""
    por, raros = defaultdict(int), []
    if carpeta.exists():
        for f in carpeta.glob(f"*.{ext}"):
            try:
                if not f.stem.startswith("p"):
                    raise ValueError
                por[int(f.stem.split("_")[0][1:])] += 1
            except ValueError:
                raros.append(f)
    return por, raros


def tabla(titulo, filas, meta):
    """filas: [(nombre, {persona: n})]"""
    personas = sorted({p for _, d in filas for p in d})
    print(f"\n=== {titulo} (meta {meta} por persona) ===")
    if not personas:
        print("  (vacío)")
        return
    print(f"  {'':18s}" + "".join(f"{'p' + str(p):>7s}" for p in personas))
    faltan = defaultdict(list)
    for nombre, d in filas:
        celdas = []
        for p in personas:
            n = d.get(p, 0)
            marca = " " if n >= meta else "*"
            if n < meta:
                faltan[p].append(nombre)
            celdas.append(f"{n:>6d}{marca}")
        print(f"  {nombre:18s}" + "".join(celdas))
    for p in personas:
        if faltan[p]:
            print(f"  -> p{p}: incompleto en {len(faltan[p])}: {', '.join(faltan[p][:12])}{'…' if len(faltan[p]) > 12 else ''}")
        else:
            print(f"  -> p{p}: completo")


def main():
    raros_total = []

    filas = []
    for c in CLASSES:
        d, r = contar(VIDEOS_DIR / c, "mp4")
        filas.append((c, d))
        raros_total += r
    tabla(f"SEÑAS  {VIDEOS_DIR.relative_to(ROOT_DIR)}", filas, VIDEOS_POR_PERSONA)

    fotos, clips = [], []
    for l in LETRAS:
        carpeta = "NN" if l == "Ñ" else l
        if l in LETRAS_CON_MOVIMIENTO:
            d, r = contar(ABC_VIDEOS_DIR / carpeta, "mp4")
            clips.append((l, d))
        else:
            d, r = contar(ABC_IMAGENES_DIR / carpeta, "jpg")
            fotos.append((l, d))
        raros_total += r
    tabla("ABECEDARIO - FOTOS", fotos, META_FOTOS)
    tabla("ABECEDARIO - CLIPS", clips, META_CLIPS)

    if raros_total:
        print(f"\nArchivos sin número de persona ({len(raros_total)}), revisar:")
        for f in raros_total[:10]:
            print(f"  {f.relative_to(ROOT_DIR)}")
    print("\n* = menos que la meta. Con todo listo: python tools/actualizar_modelo.py --abecedario --por-persona")


if __name__ == "__main__":
    main()
