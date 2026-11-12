"""
TOGO - CAPTURA DEL ABECEDARIO  (v3, archivo único)

Este archivo funciona SOLO: no necesita config.py ni nada más del proyecto.
Requisitos:  pip install mediapipe opencv-python numpy
Uso:         python capture_abecedario.py
             python capture_abecedario.py --persona 4 --camara 1     (opcional)
Empieza en pausa: presiona ESPACIO cuando estés en tu lugar.

CÓMO FUNCIONA (manos libres)
  Cada letra se hace por PAQUETES de 10 fotos:
    - Primero todos los paquetes con la mano DERECHA, luego los de la IZQUIERDA
      (solo se cambia de mano una vez por letra).
    - Antes de cada paquete hay una cuenta regresiva de 3 s para acomodar la mano.
    - Las fotos solo se toman con la mano quieta (sin borrosas). Entre foto y
      foto mueve la mano MUY despacio para que no salgan todas iguales.
    - Al terminar la letra pasa sola a la siguiente.
  Letras con movimiento (J, Ñ, Z): clips de 2 s, cada uno con su cuenta regresiva.
  Pon la mano en la posición inicial durante la cuenta y haz la letra al "YA".

TECLAS (con la ventana de la cámara seleccionada)
  ESPACIO  pausa / seguir          D o ->   letra siguiente
  U        borrar el último paquete    A o <-   letra anterior
  ESC o Q  salir (guarda todo)

DÓNDE SE GUARDA
  Junto a este archivo, en la carpeta  abecedario_p<persona>/
  Al salir se crea también  abecedario_p<persona>.zip  -> ese es el que se envía.
  (Si el archivo está dentro de TOGO_DATASET/tools, guarda directo en
  dataset/abecedario.)
  Usa el número de persona que te dieron (no el 1 "porque sí"): los nombres
  llevan ese número. Para juntarlo en el repo, sin pisar nada:
      python tools/juntar_datos.py abecedario_p<persona>.zip
"""

import argparse
import os
import re
import shutil
import sys
import time
import unicodedata
import urllib.request
from pathlib import Path

os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "3")
os.environ.setdefault("GLOG_minloglevel", "2")

try:
    import cv2
    import numpy as np
    import mediapipe as mp
    from mediapipe.tasks.python import BaseOptions, vision
except ImportError:
    sys.exit("Falta instalar librerías. Ejecuta:\n    pip install mediapipe opencv-python numpy")

# ============================================================ AJUSTES
LETRAS = [
    "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N",
    "Ñ", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z",
    "_nada",   # mano relajada / gestos sueltos: evita que la app invente letras
]
LETRAS_CON_MOVIMIENTO = ["J", "Ñ", "Z"]

FOTOS_POR_PAQUETE = 10
PAQUETES_POR_MANO = 2      # por letra: 2 paquetes derecha + 2 izquierda = 40 fotos
CLIPS_POR_MANO = 10        # letras con movimiento: 10 derecha + 10 izquierda

CUENTA_S = 3               # cuenta regresiva antes de cada paquete / clip
INTERVALO_FOTO_S = 0.35    # tiempo mínimo entre fotos
MAX_VELOCIDAD = 0.06       # mano más rápida que esto (palmas por cuadro) = borrosa, no se toma
MIN_LUZ = 55
MIN_MOV_CLIP = 1.0         # clips: recorrido mínimo de la mano, en palmas
MIN_FPS = 16               # clips: cuadros/s reales; con menos el clip dura más de 2 s
NEGRO = 8                  # brillo por debajo de esto = imagen negra (tapa, cámara equivocada)

ANCHO, ALTO, FPS = 640, 480, 20
CUADROS_CLIP = 40          # 2 s a 20 fps (igual que el modelo de señas v3)

VARIACIONES = ["de frente, normal", "gírala un poco", "un poco más cerca", "un poco más lejos"]
VARIACIONES_NADA = ["mano relajada", "entre dos letras", "mano medio cerrada", "gestos sueltos"]

MODELO_URL = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task"
VENTANA = "TOGO - Abecedario"
AQUI = Path(__file__).resolve().parent
NOMBRE = re.compile(r"^p(\d+)_(\d+)_([DI])$")   # p<persona>_<n>_<lado>
UTF8 = int(cv2.__version__.split(".")[0]) >= 5   # OpenCV 5 dibuja tildes y Ñ; el 4 solo ASCII

VERDE, ROJO, BLANCO = (80, 200, 120), (60, 60, 230), (255, 255, 255)
AMARILLO, GRIS, AZUL = (60, 200, 240), (150, 150, 150), (200, 150, 60)

# Teclas (waitKeyEx): flechas en Windows / Linux
FLECHA_IZQ = {2424832, 65361}
FLECHA_DER = {2555904, 65363}


# ============================================================ archivos

def es_clip(letra):
    return letra in LETRAS_CON_MOVIMIENTO


def meta_lado(letra):
    return CLIPS_POR_MANO if es_clip(letra) else FOTOS_POR_PAQUETE * PAQUETES_POR_MANO


def nombre(letra):
    """Texto para pantalla (OpenCV 4 no dibuja la Ñ)."""
    return {"Ñ": "Ñ" if UTF8 else "N~ (ENIE)", "_nada": "NADA"}.get(letra, letra)


def lado_txt(lado):
    return "DERECHA" if lado == "D" else "IZQUIERDA"


class Almacen:
    def __init__(self, raiz, persona):
        self.raiz, self.persona = raiz, persona
        self._cache = {}   # (letra, lado) -> archivos. Contar en disco en cada cuadro costaba ~25 ms.

    def carpeta(self, letra):
        return self.raiz / ("videos" if es_clip(letra) else "imagenes") / ("NN" if letra == "Ñ" else letra)

    def archivos(self, letra, lado="*"):
        """Solo p<persona>_<n>_<lado>: copias como 'p1_0005_D (2).jpg' no cuentan ni rompen nada."""
        if (letra, lado) not in self._cache:
            ext = "mp4" if es_clip(letra) else "jpg"
            self._cache[(letra, lado)] = sorted(
                f for f in self.carpeta(letra).glob(f"p{self.persona}_*_{lado}.{ext}") if NOMBRE.match(f.stem))
        return self._cache[(letra, lado)]

    def cambio(self, letra=None):
        """Llamar después de escribir (esa letra) o borrar (todas) archivos."""
        self._cache = {k: v for k, v in self._cache.items() if letra is not None and k[0] != letra}

    def cuenta(self, letra, lado):
        return len(self.archivos(letra, lado))

    def lado_actual(self, letra):
        """Primero completa la derecha, luego la izquierda. None = letra completa."""
        for lado in ("D", "I"):
            if self.cuenta(letra, lado) < meta_lado(letra):
                return lado
        return None

    def progreso(self, letra):
        return min(self.cuenta(letra, "D"), meta_lado(letra)) + min(self.cuenta(letra, "I"), meta_lado(letra))

    def nueva_ruta(self, letra, lado):
        destino = self.carpeta(letra)
        destino.mkdir(parents=True, exist_ok=True)
        n = max((int(NOMBRE.match(f.stem)[2]) for f in self.archivos(letra)), default=0) + 1
        ext = "mp4" if es_clip(letra) else "jpg"
        while any(destino.glob(f"p{self.persona}_{n:04d}_*.{ext}")):
            n += 1
        return destino / f"p{self.persona}_{n:04d}_{lado}.{ext}"


def carpeta_salida(persona):
    """Dentro del repo (junto a config.py y togo_features.py) guarda directo en
    dataset/abecedario, aunque esa carpeta todavía no exista (no está en git).
    Suelto en otra carpeta: abecedario_p<persona>/ junto a este archivo, y un zip."""
    if (AQUI.parent / "config.py").exists() and (AQUI.parent / "togo_features.py").exists():
        return AQUI.parent / "dataset" / "abecedario", False
    return AQUI / f"abecedario_p{persona}", True


def personas_en(raiz):
    """{persona: cantidad de archivos} que ya hay en la carpeta de salida."""
    cuenta = {}
    for f in raiz.glob("*/*/p*_*_*.*"):
        m = NOMBRE.match(f.stem)
        if m:
            cuenta[int(m[1])] = cuenta.get(int(m[1]), 0) + 1
    return cuenta


def pedir_persona(existentes):
    if existentes:
        print("Aquí ya hay archivos de: " + ", ".join(f"p{p} ({n})" for p, n in sorted(existentes.items())))
    print("Si te mandaron este archivo, usa el número de persona que te dieron.")
    while True:
        try:
            txt = input("Tu número de persona (1, 2, 3...): ").strip()
            if txt.isdigit() and int(txt) > 0:
                p = int(txt)
                if p not in existentes:
                    return p
                r = input(f"La persona {p} ya tiene {existentes[p]} archivos aquí; lo nuevo se suma (no se borra nada).\n"
                          f"¿Eres la persona {p}? (s/n): ").strip().lower()
                if r in ("s", "si", "sí", "y"):
                    return p
                continue
        except EOFError:
            sys.exit("\nSin número de persona.")
        print("  Escribe solo un número, por ejemplo 4")


def cargar_modelo():
    for c in (AQUI / "hand_landmarker.task", AQUI.parent / "models" / "mediapipe" / "hand_landmarker.task"):
        if c.exists() and c.stat().st_size > 1_000_000:   # uno más chico es una descarga cortada
            return c.read_bytes()
    destino = AQUI / "hand_landmarker.task"
    parcial = destino.with_suffix(".parcial")
    print("Descargando el modelo de manos de MediaPipe (una sola vez, ~8 MB)...")
    try:
        urllib.request.urlretrieve(MODELO_URL, parcial)
        if parcial.stat().st_size < 1_000_000:
            raise OSError("el archivo bajó incompleto")
        os.replace(parcial, destino)
    except Exception as e:
        parcial.unlink(missing_ok=True)
        sys.exit(f"No se pudo descargar ({e}).\nDescárgalo a mano de:\n  {MODELO_URL}\ny ponlo junto a este archivo.")
    return destino.read_bytes()


def abrir_camara(indice=None):
    """La cámara pedida o, si no se pide, la primera que dé imagen (no negra: algunas
    PC tienen una cámara virtual o infrarroja en el índice 0)."""
    backends = [cv2.CAP_DSHOW, cv2.CAP_MSMF] if os.name == "nt" else [cv2.CAP_ANY]
    reserva = None
    for idx in ([indice] if indice is not None else [0, 1, 2]):
        for be in backends:
            cap = cv2.VideoCapture(idx, be)
            if not cap.isOpened():
                cap.release()
                continue
            cap.set(cv2.CAP_PROP_FRAME_WIDTH, ANCHO)
            cap.set(cv2.CAP_PROP_FRAME_HEIGHT, ALTO)
            brillo, hasta = -1.0, time.monotonic() + 1.5
            for _ in range(5):   # los primeros cuadros a veces salen negros
                ok, f = cap.read()
                if ok and f is not None:
                    brillo = max(brillo, float(f.mean()))
                if time.monotonic() > hasta:
                    break
            if brillo < 0:
                cap.release()
                continue
            if brillo >= NEGRO or indice is not None:
                if reserva:
                    reserva[0].release()
                return cap, idx
            if reserva is None:
                reserva = (cap, idx)
            else:
                cap.release()
            break
    if reserva:
        return reserva
    sys.exit("No se pudo abrir ninguna cámara. Cierra otros programas que la usen (Zoom, Teams, Cámara),\n"
             "revisa Configuración > Privacidad > Cámara, o elige otra:  python capture_abecedario.py --camara 1")


def a_tamano(frame):
    """A ANCHO x ALTO recortando el centro si la cámara no es 4:3 (aplastar deforma la mano)."""
    h, w = frame.shape[:2]
    if (w, h) == (ANCHO, ALTO):
        return frame
    objetivo = ANCHO / ALTO
    if w / h > objetivo + 0.01:
        nw = int(round(h * objetivo))
        frame = frame[:, (w - nw) // 2:(w - nw) // 2 + nw]
    elif w / h < objetivo - 0.01:
        nh = int(round(w / objetivo))
        frame = frame[(h - nh) // 2:(h - nh) // 2 + nh]
    return cv2.resize(frame, (ANCHO, ALTO), interpolation=cv2.INTER_AREA)


def guardar_clip(cuadros, ruta):
    """Escribe a un temporal, comprueba que se lean todos los cuadros y recién
    ahí lo pone en su lugar (nunca queda un video a medias). None o el error."""
    tmp = ruta.parent.parent / "_escribiendo.mp4"
    w = cv2.VideoWriter(str(tmp), cv2.VideoWriter_fourcc(*"mp4v"), FPS, (ANCHO, ALTO))
    if not w.isOpened():
        return "OpenCV no pudo crear el video (códec mp4v)"
    for f in cuadros:
        w.write(f)
    w.release()
    leido, n = cv2.VideoCapture(str(tmp)), 0
    while leido.read()[0]:
        n += 1
    leido.release()
    if n != len(cuadros):
        tmp.unlink(missing_ok=True)
        return f"quedó con {n} cuadros en vez de {len(cuadros)}"
    os.replace(tmp, ruta)
    return None


# ============================================================ mano

class Detector:
    def __init__(self):
        self.det = vision.HandLandmarker.create_from_options(vision.HandLandmarkerOptions(
            base_options=BaseOptions(model_asset_buffer=cargar_modelo()), running_mode=vision.RunningMode.VIDEO,
            num_hands=2, min_hand_detection_confidence=0.5, min_tracking_confidence=0.5))
        self.t0, self.ult = time.monotonic(), -1

    def __call__(self, bgr):
        """Lista de manos, cada una 21 puntos (x, y) normalizados."""
        ts = max(int((time.monotonic() - self.t0) * 1000), self.ult + 1)
        self.ult = ts
        img = mp.Image(image_format=mp.ImageFormat.SRGB, data=cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB))
        r = self.det.detect_for_video(img, ts)
        return [[(p.x, p.y) for p in lms] for lms in (r.hand_landmarks or [])]


def px(puntos):
    return np.array(puntos) * np.array([ANCHO, ALTO])


def palma(a):
    return max(float(np.linalg.norm(a[9] - a[0])), 1.0)


def velocidad(actual, previa):
    if actual is None or previa is None:
        return 99.0
    a, b = px(actual), px(previa)
    return float(np.linalg.norm(a - b, axis=1).mean()) / palma(a)


def dentro(puntos, m=0.03):
    xs, ys = [p[0] for p in puntos], [p[1] for p in puntos]
    return min(xs) > m and max(xs) < 1 - m and min(ys) > m and max(ys) < 1 - m


def problema(manos, luz):
    if luz < NEGRO:
        return "Imagen negra: ¿tapa de la cámara? (o --camara 1)"
    if luz < MIN_LUZ:
        return "Necesito más luz"
    if not manos:
        return "No veo tu mano"
    if len(manos) > 1:
        return "Usa solo UNA mano"
    if not dentro(manos[0]):
        return "Mano completa dentro del cuadro"
    return None


def recorrido(secuencia):
    """Cuánto viajó el punto de la mano que más se movió, en palmas."""
    if len(secuencia) < 3:
        return 0.0
    a = np.array(secuencia) * np.array([ANCHO, ALTO])
    p = float(np.median(np.linalg.norm(a[:, 9] - a[:, 0], axis=1))) or 1.0
    return float(np.ptp(a, axis=0).sum(axis=1).max() / p)


# ============================================================ dibujo

def ascii_(t):
    """'más' -> 'mas' (solo con OpenCV 4, que pondría '??')."""
    return t if UTF8 else unicodedata.normalize("NFKD", t).encode("ascii", "ignore").decode()


def texto(img, t, pos, color=BLANCO, escala=0.65, grosor=2, centrado=False):
    t = ascii_(t)
    (w, _), _ = cv2.getTextSize(t, cv2.FONT_HERSHEY_SIMPLEX, escala, grosor)
    if w > ANCHO - 30:   # que nunca se salga de la imagen
        escala *= (ANCHO - 30) / w
        (w, _), _ = cv2.getTextSize(t, cv2.FONT_HERSHEY_SIMPLEX, escala, grosor)
    if centrado:
        pos = ((ANCHO - w) // 2, pos[1])
    # Contorno con el mismo grosor: en OpenCV 5 el grosor cambia el ancho de las letras.
    d = max(1, round(2 * escala))
    for dx, dy in ((-d, -d), (d, -d), (-d, d), (d, d)):
        cv2.putText(img, t, (pos[0] + dx, pos[1] + dy), cv2.FONT_HERSHEY_SIMPLEX, escala, (0, 0, 0), grosor, cv2.LINE_AA)
    cv2.putText(img, t, pos, cv2.FONT_HERSHEY_SIMPLEX, escala, color, grosor, cv2.LINE_AA)


def tira_letras(img, alm, actual):
    n = len(LETRAS)
    w = ANCHO // n
    y0 = ALTO - 58
    for i, l in enumerate(LETRAS):
        hecho, meta = alm.progreso(l), 2 * meta_lado(l)
        color = VERDE if hecho >= meta else AMARILLO if hecho else GRIS
        x0 = i * w + 1
        cv2.rectangle(img, (x0, y0), (x0 + w - 2, y0 + 20), color, -1 if hecho >= meta else 1)
        if i == actual:
            cv2.rectangle(img, (x0 - 1, y0 - 3), (x0 + w - 1, y0 + 23), BLANCO, 2)
        etiqueta = {"Ñ": "Ñ" if UTF8 else "N~", "_nada": "-"}.get(l, l)
        cv2.putText(img, etiqueta, (x0 + 3, y0 + 15), cv2.FONT_HERSHEY_SIMPLEX, 0.4,
                    (0, 0, 0) if hecho >= meta else BLANCO, 1, cv2.LINE_AA)


# ============================================================ principal

def main():
    ap = argparse.ArgumentParser(description="Fotos y clips del abecedario LESSA para Togo (manos libres).",
                                 epilog="Teclas: ESPACIO pausa, A/D o flechas letra, U borrar el último paquete, ESC salir.")
    ap.add_argument("--persona", type=int, help="tu número de persona (si no se da, lo pregunta)")
    ap.add_argument("--camara", type=int, help="índice de la cámara (0, 1, 2...); por defecto la primera que dé imagen")
    args = ap.parse_args()
    if args.persona is not None and args.persona < 1:
        ap.error("--persona debe ser 1 o más")

    print("=" * 56)
    print("TOGO - CAPTURA DEL ABECEDARIO")
    print("=" * 56)
    if args.persona:
        persona = args.persona
    else:
        raiz, suelto = carpeta_salida(0)
        if suelto:   # cada persona tiene su carpeta abecedario_p<N> junto a este archivo
            existentes = {int(m[1]): sum(1 for _ in d.glob("*/*/*.*")) for d in AQUI.glob("abecedario_p*")
                          if d.is_dir() and (m := re.fullmatch(r"abecedario_p(\d+)", d.name))}
        else:
            existentes = personas_en(raiz)
        persona = pedir_persona(existentes)

    raiz, hacer_zip = carpeta_salida(persona)
    alm = Almacen(raiz, persona)
    print(f"Guardando en: {raiz}")

    det = Detector()
    print("Abriendo la cámara...")
    cap, cam_idx = abrir_camara(args.camara)
    print(f"Cámara {cam_idx}. Selecciona su ventana para usar las teclas. ESPACIO para empezar.\n")
    cv2.namedWindow(VENTANA, cv2.WINDOW_NORMAL)
    cv2.resizeWindow(VENTANA, 960, 720)

    idx = next((i for i, l in enumerate(LETRAS) if alm.lado_actual(l)), 0)
    estado, t_estado = "aviso", time.monotonic()   # espera -> cuenta -> fotos|clip -> aviso -> espera
    pausa = True                     # empieza en pausa: que nadie arranque antes de estar en su lugar
    fallos_camara = 0
    paquete, ultimo = [], []         # archivos del paquete en curso / del último paquete
    previa, ultima_foto = None, 0.0
    clip, prox_cuadro = [], 0.0
    banner, banner_color = "", BLANCO
    lado_paquete = "D"

    def a_estado(nuevo, msg="", color=BLANCO):
        nonlocal estado, t_estado, banner, banner_color
        estado, t_estado = nuevo, time.monotonic()
        if msg:
            banner, banner_color = msg, color
            print(f"  {msg}")

    def cambiar_letra(nuevo_idx):
        nonlocal idx, paquete, clip, pausa
        idx = nuevo_idx % len(LETRAS)
        paquete, clip, pausa = [], [], False
        a_estado("aviso", f"Letra {nombre(LETRAS[idx])}", AMARILLO)

    try:
        while True:
            ok, frame = cap.read()
            if not ok or frame is None:
                fallos_camara += 1
                if fallos_camara > 40:   # ~2 s sin imagen
                    print("La cámara dejó de enviar imagen (¿se desconectó o la tomó otro programa?).")
                    break
                time.sleep(0.05)
                continue
            fallos_camara = 0
            frame = a_tamano(frame)
            ahora = time.monotonic()
            manos = det(frame)
            luz = float(cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)[::8, ::8].mean())
            una = manos[0] if len(manos) == 1 else None
            vel = velocidad(una, previa)
            previa = una
            mal = problema(manos, luz)

            letra = LETRAS[idx]
            clipmode = es_clip(letra)
            lado = alm.lado_actual(letra)
            en_curso = estado in ("fotos", "clip")
            lado_vista = lado_paquete if en_curso else lado

            # ------------------------------------------------ máquina de estados
            if not pausa:
                if estado == "aviso" and ahora - t_estado >= 1.8:
                    a_estado("espera")
                elif estado == "espera" and lado and mal is None:
                    lado_paquete = lado
                    a_estado("cuenta")
                elif estado == "cuenta" and ahora - t_estado >= CUENTA_S:
                    paquete, clip, ultima_foto, prox_cuadro = [], [], 0.0, ahora
                    a_estado("clip" if clipmode else "fotos")

                elif estado == "fotos":
                    lista = (mal is None and vel <= MAX_VELOCIDAD and ahora - ultima_foto >= INTERVALO_FOTO_S)
                    if lista:
                        ruta = alm.nueva_ruta(letra, lado_paquete)
                        if cv2.imwrite(str(ruta), frame, [cv2.IMWRITE_JPEG_QUALITY, 95]):
                            paquete.append(ruta)
                        else:
                            print(f"  ERROR: no se pudo escribir {ruta}")
                        alm.cambio(letra)
                        ultima_foto = ahora
                    lado_ahora = alm.lado_actual(letra)
                    if len(paquete) >= FOTOS_POR_PAQUETE or lado_ahora != lado_paquete:
                        ultimo, paquete = paquete, []
                        if lado_ahora is None:
                            a_estado("aviso", f"Letra {nombre(letra)} COMPLETA", VERDE)
                            siguiente = next((i for i in list(range(idx + 1, len(LETRAS))) + list(range(idx))
                                              if alm.lado_actual(LETRAS[i])), None)
                            if siguiente is None:
                                a_estado("aviso", "¡ABECEDARIO COMPLETO! Presiona ESC", VERDE)
                                pausa = True
                            else:
                                idx = siguiente
                        elif lado_ahora != lado_paquete:
                            a_estado("aviso", f"Ahora con la mano {lado_txt(lado_ahora)}", AMARILLO)
                        else:
                            a_estado("aviso", "Paquete listo. Cambia un poco la mano", VERDE)

                elif estado == "clip":
                    if ahora >= prox_cuadro:
                        clip.append((ahora, frame.copy(), manos))
                        prox_cuadro = max(prox_cuadro + 1.0 / FPS, ahora)
                    if len(clip) >= CUADROS_CLIP:
                        con_una = [m[0] for _, _, m in clip if len(m) == 1]
                        dur = clip[-1][0] - clip[0][0]
                        fps_clip = (len(clip) - 1) / dur if dur > 0 else float(FPS)
                        motivo = None
                        if fps_clip < MIN_FPS:
                            motivo = f"cámara o compu lenta ({fps_clip:.0f} cuadros/s, mínimo {MIN_FPS})"
                        elif sum(len(m) > 1 for _, _, m in clip) > CUADROS_CLIP * 0.2:
                            motivo = "se vieron dos manos"
                        elif len(con_una) < CUADROS_CLIP * 0.6:
                            motivo = "casi no se vio la mano"
                        elif recorrido(con_una) < MIN_MOV_CLIP:
                            motivo = "casi sin movimiento"
                        ruta = None
                        if not motivo:
                            ruta = alm.nueva_ruta(letra, lado_paquete)
                            error = guardar_clip([f for _, f, _ in clip], ruta)
                            alm.cambio(letra)
                            if error:
                                motivo = f"no se pudo guardar ({error})"
                                print(f"  ERROR al escribir {ruta}: {error}")
                        if motivo:
                            a_estado("aviso", f"Repetir: {motivo}", ROJO)
                        else:
                            ultimo = [ruta]
                            lado_ahora = alm.lado_actual(letra)
                            if lado_ahora is None:
                                a_estado("aviso", f"Letra {nombre(letra)} COMPLETA", VERDE)
                                siguiente = next((i for i in list(range(idx + 1, len(LETRAS))) + list(range(idx))
                                                  if alm.lado_actual(LETRAS[i])), None)
                                if siguiente is None:
                                    a_estado("aviso", "¡ABECEDARIO COMPLETO! Presiona ESC", VERDE)
                                    pausa = True
                                else:
                                    idx = siguiente
                            elif lado_ahora != lado_paquete:
                                a_estado("aviso", f"Ahora con la mano {lado_txt(lado_ahora)}", AMARILLO)
                            else:
                                a_estado("aviso", "Clip guardado", VERDE)
                        clip = []

            # ------------------------------------------------ dibujo
            letra = LETRAS[idx]
            lado = alm.lado_actual(letra)
            vista = cv2.flip(frame, 1)
            for puntos in manos:
                for x, y in puntos:
                    cv2.circle(vista, (int((1 - x) * ANCHO), int(y * ALTO)), 3, VERDE, -1)
            borde = {"espera": GRIS, "cuenta": AMARILLO, "fotos": VERDE, "clip": ROJO, "aviso": AZUL}[estado]
            cv2.rectangle(vista, (0, 0), (ANCHO - 1, ALTO - 1), GRIS if pausa else borde, 8)

            # Encabezado
            cv2.rectangle(vista, (8, 8), (ANCHO - 8, 92), (30, 30, 30), -1)
            texto(vista, nombre(letra), (20, 70), AMARILLO, 1.9, 4)
            tipo = "CLIPS" if es_clip(letra) else "FOTOS"
            texto(vista, f"{tipo}   persona {persona}   {alm.progreso(letra)}/{2 * meta_lado(letra)}", (230, 38), BLANCO, 0.6)
            lv = lado_vista if en_curso or estado == "cuenta" else lado
            if lv:
                hechos = alm.cuenta(letra, lv)
                if es_clip(letra):
                    det_lado = f"clip {min(hechos + 1, CLIPS_POR_MANO)}/{CLIPS_POR_MANO}"
                else:
                    det_lado = f"paquete {min(hechos // FOTOS_POR_PAQUETE + 1, PAQUETES_POR_MANO)}/{PAQUETES_POR_MANO}"
                texto(vista, f"MANO {lado_txt(lv)}  -  {det_lado}", (230, 74), VERDE, 0.7)
            else:
                texto(vista, "Letra completa (D = siguiente)", (230, 74), VERDE, 0.65)

            # Centro
            if pausa:
                texto(vista, "PAUSA", (0, 240), GRIS, 1.6, 4, centrado=True)
                texto(vista, "ESPACIO para seguir", (0, 280), BLANCO, 0.7, centrado=True)
            elif estado == "cuenta":
                n = max(1, int(np.ceil(CUENTA_S - (ahora - t_estado))))
                texto(vista, str(n), (0, 280), AMARILLO, 4.0, 8, centrado=True)
                if es_clip(letra):
                    texto(vista, "Pon la mano en la posición inicial", (0, 330), BLANCO, 0.7, centrado=True)
                else:
                    vars_ = VARIACIONES_NADA if letra == "_nada" else VARIACIONES
                    hechos = alm.cuenta(letra, lado_paquete)
                    var = vars_[(hechos // FOTOS_POR_PAQUETE + (0 if lado_paquete == "D" else 2)) % len(vars_)]
                    texto(vista, f"Forma la letra: {var}", (0, 330), BLANCO, 0.7, centrado=True)
            elif estado == "fotos":
                texto(vista, f"FOTO {len(paquete)}/{FOTOS_POR_PAQUETE}", (0, 150), VERDE, 1.2, 3, centrado=True)
                if mal:
                    texto(vista, mal, (0, 190), ROJO, 0.75, centrado=True)
                elif vel > MAX_VELOCIDAD:
                    texto(vista, "Más despacio...", (0, 190), AMARILLO, 0.75, centrado=True)
                else:
                    texto(vista, "Mueve la mano MUY despacio", (0, 190), BLANCO, 0.65, centrado=True)
            elif estado == "clip":
                texto(vista, f"¡YA!  GRABANDO {len(clip)}/{CUADROS_CLIP}", (0, 150), ROJO, 1.1, 3, centrado=True)
            elif estado == "aviso":
                texto(vista, banner, (0, 240), banner_color, 0.9, 2, centrado=True)
            elif estado == "espera" and lado:
                texto(vista, f"Levanta la mano {lado_txt(lado)}", (0, 240), BLANCO, 0.85, centrado=True)
                if manos and mal:
                    texto(vista, mal, (0, 280), ROJO, 0.75, centrado=True)

            tira_letras(vista, alm, idx)
            texto(vista, "ESPACIO pausa  A/D letra  U borrar paquete  ESC salir", (16, ALTO - 14), BLANCO, 0.5, 1)
            cv2.imshow(VENTANA, vista)

            # ------------------------------------------------ teclas
            k = cv2.waitKeyEx(1)
            if k == -1:
                pass
            elif k in (27, ord("q"), ord("Q")):
                break
            elif k == 32:
                pausa = not pausa
                paquete, clip = [], []
                a_estado("espera")
            elif k in (ord("d"), ord("D")) or k in FLECHA_DER:
                cambiar_letra(idx + 1)
            elif k in (ord("a"), ord("A")) or k in FLECHA_IZQ:
                cambiar_letra(idx - 1)
            elif k in (ord("u"), ord("U")):
                borrar = paquete or ultimo
                for f in borrar:
                    f.unlink(missing_ok=True)
                alm.cambio()
                paquete, ultimo, clip = [], [], []
                if borrar:
                    de = {"NN": "Ñ"}.get(borrar[0].parent.name, borrar[0].parent.name)
                    a_estado("aviso", f"Borrado: {len(borrar)} de {nombre(de)} ({lado_txt(NOMBRE.match(borrar[0].stem)[3])})", AMARILLO)
                else:
                    a_estado("aviso", "Nada que borrar", AMARILLO)
            if cv2.getWindowProperty(VENTANA, cv2.WND_PROP_VISIBLE) < 1:
                break
    except KeyboardInterrupt:
        pass   # Ctrl+C: igual muestra el resumen y arma el zip
    finally:
        cap.release()
        cv2.destroyAllWindows()

    print(f"\nResumen persona {persona}:")
    for l in LETRAS:
        d, i = alm.cuenta(l, "D"), alm.cuenta(l, "I")
        print(f"  {nombre(l):>10}: {d + i:3d}/{2 * meta_lado(l)}   (derecha {d}, izquierda {i})")

    if hacer_zip and raiz.exists():
        zip_ruta = shutil.make_archive(str(raiz), "zip", root_dir=raiz.parent, base_dir=raiz.name)
        print(f"\nListo. Envía este archivo:\n  {zip_ruta}")
    elif not hacer_zip:
        print(f"\nGuardado en {raiz}\nSiguiente paso: python tools/revisar_dataset.py")


if __name__ == "__main__":
    main()
