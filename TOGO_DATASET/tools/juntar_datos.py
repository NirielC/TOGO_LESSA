"""
JUNTAR DATOS DE OTRA PERSONA U OTRA PC, SIN PISAR NADA.

    python tools/juntar_datos.py abecedario_p4.zip
    python tools/juntar_datos.py D:/de_maria/videos_v3
    python tools/juntar_datos.py D:/otra_pc/TOGO_DATASET/dataset --prueba     # solo muestra qué haría
    python tools/juntar_datos.py abecedario_p1.zip --persona 4               # grabó con el número equivocado

Reconoce, dentro de la carpeta o del zip y a cualquier profundidad:
  - Señas:       <clase>/p<N>_<n>.mp4                    -> dataset/videos_v3/<clase>/
  - Abecedario:  imagenes/<letra>/p<N>_<n>_<D|I>.jpg     -> dataset/abecedario/imagenes/<letra>/
                 videos/<letra>/p<N>_<n>_<D|I>.mp4       -> dataset/abecedario/videos/<letra>/
  (clases y letras de config.py; la Ñ va en la carpeta NN)

Reglas:
  - Nunca sobrescribe ni borra. Si el archivo ya está (mismo contenido, con cualquier
    nombre) se omite; si hay otro DISTINTO con el mismo nombre (la misma persona grabó
    en dos PC), se copia con el siguiente número libre de esa persona.
  - Los clips que no tienen FRAMES_POR_VIDEO cuadros se omiten (no sirven para entrenar).
  - --persona N copia todo como persona N, numerado después de lo que ya tenga.
  - Lo demás (landmarks .npy, modelos, videos v2 sin p<N>_, carpetas desconocidas)
    se cuenta y se omite.
Se puede correr dos veces sin duplicar nada. Después: python tools/revisar_dataset.py
"""

import argparse
import filecmp
import re
import shutil
import sys
import tempfile
import zipfile
from collections import Counter, defaultdict
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT_DIR))

from config import ABECEDARIO_DIR, CLASSES, DATASET_DIR, FRAMES_POR_VIDEO, LETRAS, VERSION, VIDEOS_DIR  # noqa: E402

SENA = re.compile(r"^p(\d+)_(\d+)$")
LETRA = re.compile(r"^p(\d+)_(\d+)_([DI])$")
CARPETAS_LETRA = {"NN" if l == "Ñ" else l for l in LETRAS}


def clasificar(f):
    """-> ('senas' | 'abecedario', subcarpeta de destino) o (None, motivo para omitirlo)."""
    padre, abuelo, ext = f.parent.name, f.parent.parent.name, f.suffix.lower()
    if abuelo in ("imagenes", "videos") and padre in CARPETAS_LETRA:
        if (abuelo, ext) not in (("imagenes", ".jpg"), ("videos", ".mp4")):
            return None, "otro tipo de archivo"
        if not LETRA.match(f.stem):
            return None, "nombre que no es p<N>_<n>_<D|I>"
        return "abecedario", Path(abuelo) / padre
    if padre in CLASSES:
        if ext != ".mp4":
            return None, "otro tipo de archivo"
        if not SENA.match(f.stem):
            return None, "nombre que no es p<N>_<n> (¿videos v2 originales?)"
        return "senas", Path(padre)
    if ext in (".mp4", ".jpg"):
        return None, "carpeta que no es una clase ni una letra"
    return None, "otro tipo de archivo"


class Destino:
    """Una carpeta de destino: qué contenido tiene (por tamaño) y qué números usa cada persona.
    En --prueba también anota lo que 'se habría copiado', para decidir igual que de verdad."""

    def __init__(self, carpeta, patron):
        self.carpeta, self.patron = carpeta, patron
        self.por_tamano = defaultdict(list)   # tamaño -> archivos con ese contenido posible
        self.nombres = set()
        self.max_num = Counter()              # persona -> número más alto usado
        if carpeta.is_dir():
            for f in carpeta.iterdir():
                if f.is_file():
                    self.agregar(f.name, f.stat().st_size, f)

    def agregar(self, nombre, tamano, contenido):
        self.nombres.add(nombre.lower())
        self.por_tamano[tamano].append(contenido)
        m = self.patron.match(Path(nombre).stem)
        if m:
            self.max_num[int(m[1])] = max(self.max_num[int(m[1])], int(m[2]))

    def igual_a(self, f):
        return next((g for g in self.por_tamano.get(f.stat().st_size, []) if filecmp.cmp(f, g, shallow=False)), None)

    def nombre_libre(self, persona, lado, ext):
        n = self.max_num[persona] + 1
        while True:
            nombre = f"p{persona}_{n:04d}" + (f"_{lado}" if lado else "") + ext
            if nombre.lower() not in self.nombres:
                return nombre
            n += 1


def cuadros(video):
    import cv2
    c = cv2.VideoCapture(str(video))
    n = int(c.get(cv2.CAP_PROP_FRAME_COUNT)) if c.isOpened() else -1
    c.release()
    return n


def juntar(origen, destino_raiz, persona_nueva=None, prueba=False):
    destino_raiz = Path(destino_raiz)
    bases = {"senas": destino_raiz / VIDEOS_DIR.relative_to(DATASET_DIR),
             "abecedario": destino_raiz / ABECEDARIO_DIR.relative_to(DATASET_DIR)}
    destinos, resumen = {}, defaultdict(Counter)
    omitidos, ejemplos, renombres = Counter(), defaultdict(list), []

    def omitir(motivo, f):
        omitidos[motivo] += 1
        if len(ejemplos[motivo]) < 3:
            ejemplos[motivo].append(f.relative_to(origen))

    for f in sorted(p for p in origen.rglob("*") if p.is_file()):
        tipo, sub = clasificar(f)
        if tipo is None:
            omitir(sub, f)
            continue
        if tipo == "senas" and VERSION == "v2":
            sys.exit("VERSION es v2 en config.py, pero los videos de capture_videos.py son v3 (40 cuadros).\n"
                     "Corre sin TOGO_VERSION=v2.")
        carpeta = bases[tipo] / sub
        if carpeta.resolve() == f.parent.resolve():
            omitir("ya está en el destino (es la misma carpeta)", f)
            continue
        if f.suffix.lower() == ".mp4":
            n = cuadros(f)
            if n >= 0 and n != FRAMES_POR_VIDEO:
                omitir(f"clip de {n} cuadros (se esperan {FRAMES_POR_VIDEO})" if n else "video que no se puede leer", f)
                continue
        patron = SENA if tipo == "senas" else LETRA
        d = destinos.setdefault(carpeta, Destino(carpeta, patron))
        etiqueta = str(carpeta.relative_to(destino_raiz)).replace("\\", "/")
        if d.igual_a(f):
            resumen[etiqueta]["ya estaban"] += 1
            continue
        m = patron.match(f.stem)
        persona = persona_nueva or int(m[1])
        lado = m[3] if tipo == "abecedario" else None
        nombre = f.name
        if persona != int(m[1]) or nombre.lower() in d.nombres:
            nombre = d.nombre_libre(persona, lado, f.suffix.lower())
            renombres.append(f"{etiqueta}/{f.name} -> {nombre}")
            resumen[etiqueta]["renombrados"] += 1
        else:
            resumen[etiqueta]["nuevos"] += 1
        if prueba:
            d.agregar(nombre, f.stat().st_size, f)
        else:
            carpeta.mkdir(parents=True, exist_ok=True)
            shutil.copy2(f, carpeta / nombre)
            d.agregar(nombre, f.stat().st_size, carpeta / nombre)
    return resumen, omitidos, ejemplos, renombres


def main():
    ap = argparse.ArgumentParser(description="Copia señas y abecedario de otra persona o PC a dataset/, sin sobrescribir.")
    ap.add_argument("origen", help="carpeta o .zip (p. ej. abecedario_p4.zip, una carpeta videos_v3, otro dataset/)")
    ap.add_argument("--persona", type=int, help="copiar todo como esta persona (si grabó con un número equivocado)")
    ap.add_argument("--prueba", action="store_true", help="solo mostrar qué haría, sin copiar")
    ap.add_argument("--destino", default=str(DATASET_DIR), help=f"carpeta dataset de destino (por defecto {DATASET_DIR})")
    args = ap.parse_args()
    if args.persona is not None and args.persona < 1:
        ap.error("--persona debe ser 1 o más")
    origen = Path(args.origen)
    if not origen.exists():
        sys.exit(f"No existe {origen}")

    with tempfile.TemporaryDirectory(prefix="togo_juntar_") as tmp:
        if origen.is_file():
            if not zipfile.is_zipfile(origen):
                sys.exit(f"{origen} no es una carpeta ni un .zip")
            with zipfile.ZipFile(origen) as z:
                z.extractall(tmp)   # extractall descarta rutas absolutas y '..'
            carpeta = Path(tmp)
        else:
            carpeta = origen
        resumen, omitidos, ejemplos, renombres = juntar(carpeta, args.destino, args.persona, args.prueba)

    print(f"Origen:  {origen}\nDestino: {args.destino}" + ("   (PRUEBA: no se copia nada)" if args.prueba else ""))
    if resumen:
        print(f"\n  {'carpeta':32s} {'nuevos':>7s} {'renombrados':>12s} {'ya estaban':>11s}")
        for etiqueta in sorted(resumen):
            r = resumen[etiqueta]
            print(f"  {etiqueta:32s} {r['nuevos']:7d} {r['renombrados']:12d} {r['ya estaban']:11d}")
        total = sum(r["nuevos"] + r["renombrados"] for r in resumen.values())
        print(f"\n  {'Se copiarían' if args.prueba else 'Copiados'}: {total} archivos.")
    else:
        print("\n  No encontré señas ni abecedario con el formato esperado.")
    if renombres:
        print(f"\nRenombrados ({len(renombres)}): ya había otro archivo distinto con ese nombre o se cambió la persona.")
        for r in renombres[:8]:
            print(f"  {r}")
        if len(renombres) > 8:
            print(f"  ... y {len(renombres) - 8} más")
    if omitidos:
        print("\nOmitidos:")
        for motivo, n in omitidos.most_common():
            print(f"  {n:6d}  {motivo}   (p. ej. {', '.join(str(e) for e in ejemplos[motivo])})")
    if resumen and not args.prueba:
        print("\nSiguiente paso: python tools/revisar_dataset.py")


if __name__ == "__main__":
    main()
