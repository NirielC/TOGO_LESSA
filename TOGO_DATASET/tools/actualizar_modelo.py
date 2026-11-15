"""
ACTUALIZAR EL MODELO DE LA APP EN UN SOLO PASO.

Después de grabar videos nuevos (capture_videos.py) o agregar una seña:
  1. Extrae los puntos de los videos nuevos (los ya procesados se omiten).
  2. Entrena, exporta a TFLite y lo copia a la app (--instalar).
  3. Regenera el diccionario de la app (animaciones con datos reales).
  4. Con --apk, además compila la APK (TOGO_MOVIL/build-apk.ps1).

Agregar una seña nueva:
  - Agrégala a CLASSES en config.py y graba sus videos.
  - Agrega su texto en TOGO_MOVIL/src/core/signs/vocabulary.ts (si no, se muestra
    con el nombre de la carpeta, sin guiones bajos).
  - Corre este script.

Con tomas de la plataforma web (TOGO_COLABORA):
  --desde-supabase primero corre tools/sincronizar_web.py (baja, valida y ordena las
  tomas nuevas; ver ese archivo). Solo se entrenan las ACEPTADAS. Una seña nueva
  creada en el panel hay que agregarla también a CLASSES en config.py.

Uso:
    python tools/actualizar_modelo.py
    python tools/actualizar_modelo.py --desde-supabase
    python tools/actualizar_modelo.py --desde-supabase --borrar-archivos   # y libera Supabase
    python tools/actualizar_modelo.py --apk
    python tools/actualizar_modelo.py --abecedario --apk   # también el abecedario
"""

import argparse
import subprocess
import sys
from pathlib import Path

TOOLS = Path(__file__).resolve().parent
MOVIL = TOOLS.parents[1] / "TOGO_MOVIL"


def paso(nombre, cmd):
    print(f"\n=== {nombre} ===", flush=True)
    r = subprocess.run(cmd, cwd=TOOLS.parent)
    if r.returncode != 0:
        sys.exit(f"Falló: {nombre}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apk", action="store_true", help="compilar la APK al final")
    ap.add_argument("--abecedario", action="store_true", help="también entrenar e instalar el abecedario")
    ap.add_argument("--desde-supabase", action="store_true", help="traer antes las tomas de la plataforma web")
    ap.add_argument("--borrar-archivos", action="store_true", help="con --desde-supabase: borrar de Supabase lo ya bajado y decidido")
    ap.add_argument("--por-persona", action="store_true", help="medir precisión con persona no vista (más lento)")
    args = ap.parse_args()

    py = sys.executable
    if args.desde_supabase:
        paso("0/4 Traer las tomas de la plataforma web",
             [py, str(TOOLS / "sincronizar_web.py")] + (["--borrar-archivos"] if args.borrar_archivos else []))
    paso("1/4 Extraer puntos de los videos", [py, str(TOOLS / "extract_landmarks_v2.py")])
    entrenar = [py, str(TOOLS / "train_senas.py"), "--instalar"] + (["--por-persona"] if args.por_persona else [])
    paso("2/4 Entrenar e instalar el modelo de señas", entrenar)
    if args.abecedario:
        paso("2b Entrenar e instalar el abecedario", [py, str(TOOLS / "train_abecedario.py"), "--instalar"])
    paso("3/4 Actualizar el diccionario de la app", [py, str(TOOLS / "export_diccionario.py")])
    if args.apk:
        paso("4/4 Compilar la APK", ["powershell", "-ExecutionPolicy", "Bypass", "-File", str(MOVIL / "build-apk.ps1")])
    else:
        print("\nListo. Para la APK: python tools/actualizar_modelo.py --apk  (o TOGO_MOVIL/build-apk.ps1)")


if __name__ == "__main__":
    main()
