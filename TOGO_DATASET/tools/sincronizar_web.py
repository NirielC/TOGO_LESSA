"""
SINCRONIZAR LA PLATAFORMA DE COLABORACIÓN (Supabase) CON EL DATASET DE ESTA PC

Las tomas que la gente graba en la web (TOGO_COLABORA) llegan a Supabase como
puntos, nunca video. Este script las trae al dataset:

  1. Baja las tomas nuevas (.togo) y las convierte al formato del dataset: crudo
     (cuadros, 258) como el de extract_landmarks_v2.py, remuestreado a 20 fps
     exactos y llevado a una imagen "virtual" de 640×480 (ver a_640x480).
  2. Las valida con el modelo instalado en la app: si la seña sale entre las 3
     primeras opciones -> aceptada; si no -> revisión (se decide en el panel de
     la web). Las señas marcadas como "nueva" van siempre a revisión.
  3. Ordena el disco según lo decidido en el panel: aceptadas a dataset/web/...,
     en revisión a dataset/web/_revision/, rechazadas y retiradas se borran.
  4. --borrar-archivos (modo puente): borra de Supabase los archivos ya bajados y
     ya decididos (aceptados o rechazados). La fila queda para contar el avance.
  5. Escribe TOGO_MOVIL/src/data/colaboradores.json (créditos sin internet).

Carpetas (las leen train_senas.py y train_abecedario.py):
    dataset/web/senas/<seña>/p<1000+n>_<id>.npy
    dataset/web/letras/<LETRA>/p<1000+n>_<id>.npy        letras quietas
    dataset/web/letras_mov/<LETRA>/p<1000+n>_<id>.npy    letras con movimiento
    dataset/web/_revision/<seña>/...                     esperando revisión
    dataset/web/indice.json                              qué toma está en qué archivo
La persona n de la web es p<1000+n>: nunca choca con las personas grabadas en la PC.

Configuración: TOGO_DATASET/.env (NO se sube a git) o variables de entorno:
    SUPABASE_URL=https://vzptgcsgwvfrswzugcap.supabase.co
    SUPABASE_SERVICE_KEY=<clave secreta: Supabase > Project Settings > API Keys > secret>

Uso:
    python tools/sincronizar_web.py
    python tools/sincronizar_web.py --borrar-archivos   # libera espacio en Supabase
    python tools/sincronizar_web.py --sin-modelo        # no valida: todo lo nuevo a revisión
    python tools/sincronizar_web.py --prueba            # dice qué haría, sin tocar nada
"""

import argparse
import gzip
import json
import os
import shutil
import struct
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

ROOT_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT_DIR))

from config import ALTO, ANCHO, DATASET_DIR, FPS, FRAMES_POR_VIDEO  # noqa: E402
from togo_features import FRAME_DIM, build_features_v3, hand_letter_features  # noqa: E402

WEB_DIR = DATASET_DIR / "web"
INDICE = WEB_DIR / "indice.json"
APP_ASSETS = ROOT_DIR.parent / "TOGO_MOVIL" / "modules" / "togo-vision" / "android" / "src" / "main" / "assets"
COLABORADORES_APP = ROOT_DIR.parent / "TOGO_MOVIL" / "src" / "data" / "colaboradores.json"
PERSONA_BASE = 1000
TOP = 3


# ------------------------------------------------------------ configuración

def leer_env():
    env = ROOT_DIR / ".env"
    if env.exists():
        for linea in env.read_text(encoding="utf-8").splitlines():
            linea = linea.strip()
            if linea and not linea.startswith("#") and "=" in linea:
                k, v = linea.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
    url, clave = os.environ.get("SUPABASE_URL"), os.environ.get("SUPABASE_SERVICE_KEY")
    if not url or not clave:
        sys.exit("Falta SUPABASE_URL o SUPABASE_SERVICE_KEY (en TOGO_DATASET/.env). Ver el inicio de este archivo.")
    return url.rstrip("/"), clave


class Supabase:
    def __init__(self, url, clave):
        self.url = url
        self.h = {"apikey": clave}
        if not clave.startswith("sb_"):          # clave vieja (JWT): también va en Authorization
            self.h["Authorization"] = f"Bearer {clave}"

    def _pedir(self, metodo, ruta, cuerpo=None, extra=None, crudo=False):
        datos = json.dumps(cuerpo).encode() if cuerpo is not None else None
        h = {**self.h, **(extra or {})}
        if datos is not None:
            h["Content-Type"] = "application/json"
        req = urllib.request.Request(self.url + ruta, data=datos, method=metodo, headers=h)
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                b = r.read()
                return b if crudo else (json.loads(b) if b else None)
        except urllib.error.HTTPError as e:
            raise RuntimeError(f"{metodo} {ruta} -> {e.code}: {e.read().decode(errors='replace')[:300]}") from None

    def tomas(self):
        """Todas las tomas (paginado). Solo metadatos: unos cientos de bytes por fila."""
        sel = "id,sena,archivo,estado,descargada_en,archivo_borrado,perfiles!tomas_usuario_fkey(numero),senas(tipo,texto,nueva)"
        filas, desde = [], 0
        while True:
            q = f"/rest/v1/tomas?select={urllib.parse.quote(sel, safe=',()!')}&order=creado&offset={desde}&limit=1000"
            lote = self._pedir("GET", q)
            filas += lote
            if len(lote) < 1000:
                return filas
            desde += 1000

    def bajar(self, archivo):
        return self._pedir("GET", "/storage/v1/object/tomas/" + urllib.parse.quote(archivo), crudo=True)

    def actualizar(self, toma_id, cambios):
        self._pedir("PATCH", f"/rest/v1/tomas?id=eq.{toma_id}", cambios, {"Prefer": "return=minimal"})

    def borrar_archivos(self, archivos):
        for i in range(0, len(archivos), 100):
            self._pedir("DELETE", "/storage/v1/object/tomas", {"prefixes": archivos[i:i + 100]})

    def retiros(self):
        return {r["numero"] for r in self._pedir("GET", "/rest/v1/retiros?select=numero")}

    def colaboradores(self):
        return self._pedir("POST", "/rest/v1/rpc/colaboradores", {})


# ------------------------------------------------------------ formato .togo

def leer_togo(datos):
    """.togo (ver TOGO_COLABORA/src/captura/formato.js) -> (meta, crudo (n, 258) float32)."""
    if datos[:2] == b"\x1f\x8b":
        datos = gzip.decompress(datos)
    if datos[:4] != b"TOGO":
        raise ValueError("no es un archivo .togo")
    (largo,) = struct.unpack("<I", datos[4:8])
    meta = json.loads(datos[8:8 + largo].decode("utf-8"))
    n, dim = meta["n"], meta.get("dim", FRAME_DIM)
    if dim != FRAME_DIM:
        raise ValueError(f"dim {dim} != {FRAME_DIM}")
    crudo = np.frombuffer(datos, dtype="<i2", count=n * dim, offset=8 + largo).astype(np.float32)
    return meta, crudo.reshape(n, dim) / float(meta.get("escala", 10000))


def remuestrear(crudo, tiempos_ms, fps=FPS):
    """Cuadros a ritmo irregular (teléfono lento) -> fps exactos, eligiendo el cuadro
    más cercano a cada instante (sin promediar: un punto ausente sigue en cero)."""
    t = np.asarray(tiempos_ms, dtype=np.float64)
    if len(t) != len(crudo) or len(t) < 2:
        return crudo
    paso = 1000.0 / fps
    objetivo = np.arange(0, t[-1] + paso / 2, paso)
    idx = np.clip(np.searchsorted(t, objetivo), 1, len(t) - 1)
    idx = np.where(np.abs(t[idx - 1] - objetivo) <= np.abs(t[idx] - objetivo), idx - 1, idx)
    return crudo[idx]


def a_640x480(crudo, ancho, alto):
    """El entrenamiento convierte a píxeles con 640×480 (ANCHO, ALTO). Una toma de otra
    resolución (un teléfono vertical, 480×640) se reescala para que x*640 sea su píxel
    real: así las proporciones y la normalización por hombros dan exactamente igual."""
    if not ancho or not alto or (ancho, alto) == (ANCHO, ALTO):
        return crudo
    c = crudo.copy()
    sx, sy = ancho / ANCHO, alto / ALTO
    pose = c[:, :132].reshape(-1, 33, 4)
    manos = c[:, 132:].reshape(-1, 42, 3)
    for arr in (pose, manos):
        presente = np.abs(arr[..., :3]).sum(-1) > 0
        arr[..., 0] = np.where(presente, arr[..., 0] * sx, 0)
        arr[..., 1] = np.where(presente, arr[..., 1] * sy, 0)
        arr[..., 2] = np.where(presente, arr[..., 2] * sx, 0)
    return c


def ajustar_largo(raw, largo):
    """Igual que train_senas.ajustar_largo: centra (repite bordes) o toma el centro."""
    T = len(raw)
    if T == largo:
        return raw
    if T > largo:
        ini = (T - largo) // 2
        return raw[ini:ini + largo]
    izq = (largo - T) // 2
    return np.concatenate([np.repeat(raw[:1], izq, 0), raw, np.repeat(raw[-1:], largo - T - izq, 0)])


# ------------------------------------------------------------ modelo actual (el de la app)

class Validador:
    """Top-3 con los modelos instalados en la app. Si no hay TensorFlow, no valida."""

    def __init__(self):
        import tensorflow as tf  # noqa: F401  (pesado: solo si se usa)
        self.tf = tf
        self.m = {}
        for nombre, modelo, etiquetas in [
            ("senas", "lessa_signs.tflite", "signs_labels.json"),
            ("letras", "lessa_letters.tflite", "letters_labels.json"),
            ("letras_mov", "lessa_letters_motion.tflite", "letters_motion_labels.json"),
        ]:
            if (APP_ASSETS / modelo).exists() and (APP_ASSETS / etiquetas).exists():
                it = tf.lite.Interpreter(model_path=str(APP_ASSETS / modelo))
                it.allocate_tensors()
                self.m[nombre] = (it, json.loads((APP_ASSETS / etiquetas).read_text(encoding="utf-8")))
        meta = APP_ASSETS / "signs_meta.json"
        self.seq_len = json.loads(meta.read_text(encoding="utf-8"))["seq_len"] if meta.exists() else FRAMES_POR_VIDEO

    def _correr(self, nombre, x):
        it, etiquetas = self.m[nombre]
        ent, sal = it.get_input_details()[0], it.get_output_details()[0]
        probs = []
        for muestra in x:
            it.set_tensor(ent["index"], muestra[None].astype(np.float32))
            it.invoke()
            probs.append(it.get_tensor(sal["index"])[0])
        p = np.mean(probs, 0)
        orden = np.argsort(-p)[:TOP]
        return [[etiquetas[i], round(float(p[i]), 3)] for i in orden]

    def top(self, tipo, crudo):
        """-> [[etiqueta, prob] x3] o None si no hay modelo para ese tipo."""
        if tipo in ("sena", "nada") and "senas" in self.m:
            return self._correr("senas", [build_features_v3(ajustar_largo(crudo, self.seq_len), ANCHO, ALTO)])
        if tipo == "letra_mov" and "letras_mov" in self.m:
            return self._correr("letras_mov", [build_features_v3(ajustar_largo(crudo, self.seq_len), ANCHO, ALTO)])
        if tipo == "letra" and "letras" in self.m:
            feats = [f for f in (hand_letter_features(c, ANCHO, ALTO) for c in crudo[::2]) if f is not None]
            return self._correr("letras", feats) if feats else []
        return None


def etiqueta_esperada(t):
    s = t["senas"] or {}
    return s.get("texto") if s.get("tipo", "").startswith("letra") else t["sena"]


# ------------------------------------------------------------ disco

def carpeta(tipo, sena, texto):
    """Carpeta final (aceptadas) según el tipo de seña."""
    if tipo == "letra":
        return WEB_DIR / "letras" / ("NN" if texto == "Ñ" else texto)
    if tipo == "letra_mov":
        return WEB_DIR / "letras_mov" / ("NN" if texto == "Ñ" else texto)
    return WEB_DIR / "senas" / sena


def mover(origen, destino, prueba):
    if origen == destino or prueba:
        return
    destino.parent.mkdir(parents=True, exist_ok=True)
    shutil.move(str(origen), str(destino))


def main():
    ap = argparse.ArgumentParser(description="Trae las tomas de la plataforma web al dataset.")
    ap.add_argument("--borrar-archivos", action="store_true", help="borrar de Supabase los archivos ya bajados y decididos")
    ap.add_argument("--sin-modelo", action="store_true", help="no validar con el modelo: lo nuevo va a revisión")
    ap.add_argument("--prueba", action="store_true", help="solo mostrar qué haría")
    args = ap.parse_args()

    sb = Supabase(*leer_env())
    indice = json.loads(INDICE.read_text(encoding="utf-8")) if INDICE.exists() else {}
    print("Pidiendo la lista de tomas…")
    tomas = sb.tomas()
    retirados = sb.retiros()
    print(f"  {len(tomas)} tomas en la plataforma · {len(indice)} ya en esta PC · {len(retirados)} personas retiradas")

    validador = None
    if not args.sin_modelo:
        try:
            validador = Validador()
        except Exception as e:  # sin TensorFlow, sin modelos...
            print(f"  (Sin validación automática: {e}. Lo nuevo queda en revisión.)")

    cuenta = {"nuevas": 0, "aceptadas": 0, "revision": 0, "borradas_local": 0, "movidas": 0, "errores": 0, "sin_archivo": 0}
    ahora = datetime.now(timezone.utc).isoformat()
    vivas = set()
    para_borrar = []

    for t in tomas:
        tid = t["id"]
        vivas.add(tid)
        numero = (t.get("perfiles") or {}).get("numero")
        s = t.get("senas") or {}
        tipo, texto = s.get("tipo", "sena"), s.get("texto", t["sena"])
        nombre = f"p{PERSONA_BASE + (numero or 0)}_{tid[:8]}.npy"
        final = carpeta(tipo, t["sena"], texto) / nombre
        revision = WEB_DIR / "_revision" / t["sena"] / nombre
        estado = t["estado"]

        if numero in retirados or estado == "rechazada":
            if tid in indice:
                ruta = Path(indice.pop(tid))
                if ruta.exists() and not args.prueba:
                    ruta.unlink()
                cuenta["borradas_local"] += 1
            if estado == "rechazada" and args.borrar_archivos and not t["archivo_borrado"]:
                para_borrar.append(t)
            continue

        if tid not in indice:
            if t["archivo_borrado"]:
                continue  # ya bajada antes en otra PC: no hay archivo que traer
            try:
                meta, crudo = leer_togo(sb.bajar(t["archivo"]))
                crudo = a_640x480(remuestrear(crudo, meta.get("t", [])), meta.get("ancho"), meta.get("alto"))
            except Exception as e:
                if " 400:" in str(e) or " 404:" in str(e):
                    # Fila sin archivo: el teléfono la guardó sin internet y aún no la sube.
                    cuenta["sin_archivo"] += 1
                else:
                    print(f"  [error] {t['archivo']}: {e}")
                    cuenta["errores"] += 1
                continue
            cambios = {"descargada_en": ahora}
            if estado == "pendiente":
                top = validador.top(tipo, crudo) if validador and not s.get("nueva") else None
                ok = top is not None and etiqueta_esperada(t) in [e for e, _ in top]
                estado = "aceptada" if ok else "revision"
                cambios.update(estado=estado, modelo_top=top)
                cuenta["aceptadas" if ok else "revision"] += 1
            destino = final if estado == "aceptada" else revision
            if not args.prueba:
                destino.parent.mkdir(parents=True, exist_ok=True)
                np.save(destino, crudo.astype(np.float32))
                sb.actualizar(tid, cambios)
            indice[tid] = str(destino)
            cuenta["nuevas"] += 1
        else:
            # Ya estaba: ponerla donde corresponde según lo decidido en el panel.
            actual = Path(indice[tid])
            destino = final if estado == "aceptada" else revision
            if actual != destino and actual.exists():
                mover(actual, destino, args.prueba)
                indice[tid] = str(destino)
                cuenta["movidas"] += 1

        if args.borrar_archivos and estado == "aceptada" and not t["archivo_borrado"]:
            para_borrar.append(t)

    # Tomas que ya no existen en la plataforma (deshechas o de cuentas retiradas).
    for tid in [k for k in indice if k not in vivas]:
        ruta = Path(indice.pop(tid))
        if ruta.exists() and not args.prueba:
            ruta.unlink()
        cuenta["borradas_local"] += 1

    if para_borrar and not args.prueba:
        sb.borrar_archivos([t["archivo"] for t in para_borrar])
        for t in para_borrar:
            sb.actualizar(t["id"], {"archivo_borrado": True})
    if not args.prueba:
        WEB_DIR.mkdir(parents=True, exist_ok=True)
        INDICE.write_text(json.dumps(indice, indent=1), encoding="utf-8")
        try:
            nombres = [c["nombre"] for c in sb.colaboradores()]
            COLABORADORES_APP.write_text(json.dumps({"actualizado": ahora[:10], "nombres": nombres}, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
            print(f"  Créditos de la app: {len(nombres)} nombres -> {COLABORADORES_APP.name}")
        except Exception as e:
            print(f"  (No se pudieron actualizar los créditos: {e})")

    print(
        f"\nListo{' (PRUEBA: nada cambió)' if args.prueba else ''}: {cuenta['nuevas']} nuevas "
        f"({cuenta['aceptadas']} aceptadas por el modelo, {cuenta['revision']} a revisión) · "
        f"{cuenta['movidas']} movidas según el panel · {cuenta['borradas_local']} borradas de esta PC · "
        f"{len(para_borrar)} archivos {'por borrar' if args.prueba else 'borrados'} de Supabase · {cuenta['errores']} errores"
        + (f" · {cuenta['sin_archivo']} aún sin archivo (se suben solas desde el teléfono)" if cuenta["sin_archivo"] else "")
    )
    if cuenta["revision"]:
        print("Revisa las dudosas en la web: Panel > Revisión. Luego vuelve a correr este script.")


if __name__ == "__main__":
    main()
