"""
TOGO - CAPTURA DEL ABECEDARIO

Letras estáticas  -> ráfagas de fotos (.jpg)   dataset/abecedario/imagenes/<letra>/
Letras con mov.   -> clips de 30 frames (.mp4) dataset/abecedario/videos/<letra>/

Por qué así:
  - Solo se guarda una foto si MediaPipe ve una mano en ese momento. Una foto
    sin mano no sirve para un clasificador de landmarks y ensucia el dataset.
  - Cada ráfaga pide una variación distinta (distancia, lado, giro), para que
    el modelo no aprenda una sola posición de la mano.
  - Se guardan las imágenes, no solo los landmarks: si la extracción cambia,
    se vuelve a procesar sin volver a grabar (igual que con los videos).
  - El nombre lleva la persona (p1_0001.jpg): nadie sobrescribe a nadie y se
    puede dividir train/test por persona.
  - La vista previa se muestra en espejo (natural para quien seña), pero se
    guarda la imagen sin voltear, igual que los videos de las señas.

Teclas:
  ESPACIO  grabar ráfaga / clip
  N / P    siguiente / anterior letra
  U        deshacer la última ráfaga o clip
  ESC      salir
"""

import os
import sys
import time
from pathlib import Path

os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "3")
os.environ.setdefault("GLOG_minloglevel", "2")

import cv2
import numpy as np

ROOT_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT_DIR))

from config import (  # noqa: E402
    ABC_CLIPS_POR_PERSONA,
    ABC_FOTOS_POR_RAFAGA,
    ABC_IMAGENES_DIR,
    ABC_INTERVALO_MS,
    ABC_RAFAGAS_POR_PERSONA,
    ABC_VIDEOS_DIR,
    ALTO,
    ANCHO,
    COUNTDOWN_SEGUNDOS,
    FPS,
    FRAMES_POR_VIDEO,
    LETRAS,
    LETRAS_CON_MOVIMIENTO,
    MODELS_DIR,
    PERSONAS,
)

HAND_MODEL = MODELS_DIR / "mediapipe" / "hand_landmarker.task"
VENTANA = "TOGO - Abecedario"

# Una variación por ráfaga. Se repite si hay más ráfagas que consejos.
VARIACIONES = [
    "Centrada, a distancia normal",
    "Un poco mas CERCA de la camara",
    "Un poco mas LEJOS de la camara",
    "Mano mas a la IZQUIERDA / mas arriba",
    "Mano mas a la DERECHA / gira un poco la muneca",
]
VARIACIONES_NADA = [
    "Mano relajada, sin letra",
    "Mano a medio camino entre dos letras",
    "Rascate, acomodate el pelo, toca la cara",
    "Mano bajando o subiendo",
    "Manos sueltas, sin intencion",
]

VERDE = (80, 200, 120)
ROJO = (60, 60, 230)
BLANCO = (255, 255, 255)
AMARILLO = (60, 200, 240)


# ------------------------------------------------------------------ utilidades

def es_dinamica(letra):
    return letra in LETRAS_CON_MOVIMIENTO


def carpeta(letra):
    base = ABC_VIDEOS_DIR if es_dinamica(letra) else ABC_IMAGENES_DIR
    # "Ñ" funciona como carpeta en Windows, pero se usa "NN" para evitar
    # problemas de codificación al copiar el dataset entre equipos.
    nombre = "NN" if letra == "Ñ" else letra
    return base / nombre


def archivos(letra, persona):
    ext = "mp4" if es_dinamica(letra) else "jpg"
    return sorted(carpeta(letra).glob(f"p{persona}_*.{ext}"))


def meta(letra):
    return ABC_CLIPS_POR_PERSONA if es_dinamica(letra) else ABC_FOTOS_POR_RAFAGA * ABC_RAFAGAS_POR_PERSONA


def siguiente_numero(letra, persona):
    existentes = archivos(letra, persona)
    if not existentes:
        return 1
    return int(existentes[-1].stem.split("_")[1]) + 1


def texto(img, t, pos, color=BLANCO, escala=0.7, grosor=2):
    cv2.putText(img, t, pos, cv2.FONT_HERSHEY_SIMPLEX, escala, (0, 0, 0), grosor + 3, cv2.LINE_AA)
    cv2.putText(img, t, pos, cv2.FONT_HERSHEY_SIMPLEX, escala, color, grosor, cv2.LINE_AA)


def preguntar_persona():
    while True:
        try:
            p = int(input(f"Persona (1-{PERSONAS}): "))
            if 1 <= p <= PERSONAS:
                return p
        except ValueError:
            pass
        print("Número inválido.")


# ------------------------------------------------------------- detector mano

class DetectorMano:
    def __init__(self):
        import mediapipe as mp
        from mediapipe.tasks.python import BaseOptions, vision

        self._mp = mp
        self._det = vision.HandLandmarker.create_from_options(
            vision.HandLandmarkerOptions(
                base_options=BaseOptions(model_asset_path=str(HAND_MODEL)),
                running_mode=vision.RunningMode.VIDEO,
                num_hands=2,
                min_hand_detection_confidence=0.5,
                min_tracking_confidence=0.5,
            )
        )
        self._t0 = time.monotonic()
        self._last = -1

    def detectar(self, bgr):
        """Devuelve lista de manos, cada una con 21 puntos (x, y) normalizados."""
        rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
        ts = int((time.monotonic() - self._t0) * 1000)
        ts = max(ts, self._last + 1)
        self._last = ts
        r = self._det.detect_for_video(self._mp.Image(image_format=self._mp.ImageFormat.SRGB, data=rgb), ts)
        return [[(p.x, p.y) for p in mano] for mano in (r.hand_landmarks or [])]


def dibujar_manos(vista, manos):
    """vista ya está en espejo: se invierte x al dibujar."""
    h, w = vista.shape[:2]
    for mano in manos:
        for x, y in mano:
            cv2.circle(vista, (int((1 - x) * w), int(y * h)), 3, VERDE, -1)


def mano_dentro(manos, margen=0.03):
    """La mano completa dentro del cuadro: si sale cortada, la foto no sirve."""
    if not manos:
        return False
    for mano in manos:
        xs = [p[0] for p in mano]
        ys = [p[1] for p in mano]
        if min(xs) < margen or max(xs) > 1 - margen or min(ys) < margen or max(ys) > 1 - margen:
            return False
    return True


# ------------------------------------------------------------------- captura

def leer(cap):
    ok, frame = cap.read()
    if not ok:
        raise RuntimeError("No se pudo leer la cámara.")
    if frame.shape[1] != ANCHO or frame.shape[0] != ALTO:
        frame = cv2.resize(frame, (ANCHO, ALTO))
    return frame


def cuenta_regresiva(cap, det, letra, consejo):
    fin = time.monotonic() + COUNTDOWN_SEGUNDOS
    while True:
        restante = fin - time.monotonic()
        if restante <= 0:
            return True
        frame = leer(cap)
        manos = det.detectar(frame)
        vista = cv2.flip(frame, 1)
        dibujar_manos(vista, manos)
        texto(vista, str(int(restante) + 1), (ANCHO // 2 - 25, ALTO // 2), AMARILLO, 3, 5)
        texto(vista, f"Letra {letra}: {consejo}", (20, ALTO - 20), AMARILLO, 0.65)
        cv2.imshow(VENTANA, vista)
        if (cv2.waitKey(1) & 0xFF) == 27:
            return False


def rafaga_fotos(cap, det, letra, persona, consejo):
    destino = carpeta(letra)
    destino.mkdir(parents=True, exist_ok=True)
    n = siguiente_numero(letra, persona)
    guardadas = []
    descartes = 0
    ultimo = 0.0
    limite = time.monotonic() + 15  # si la mano no aparece, no se queda colgado

    while len(guardadas) < ABC_FOTOS_POR_RAFAGA and time.monotonic() < limite:
        frame = leer(cap)
        manos = det.detectar(frame)
        vista = cv2.flip(frame, 1)
        dibujar_manos(vista, manos)
        ahora = time.monotonic()

        valida = mano_dentro(manos)
        if valida and (ahora - ultimo) * 1000 >= ABC_INTERVALO_MS:
            ruta = destino / f"p{persona}_{n:04d}.jpg"
            cv2.imwrite(str(ruta), frame, [cv2.IMWRITE_JPEG_QUALITY, 95])
            guardadas.append(ruta)
            n += 1
            ultimo = ahora
        elif not valida:
            descartes += 1

        color = VERDE if valida else ROJO
        cv2.rectangle(vista, (0, 0), (ANCHO - 1, ALTO - 1), color, 6)
        texto(vista, f"Letra {letra}  {len(guardadas)}/{ABC_FOTOS_POR_RAFAGA}", (20, 40), color, 0.9)
        texto(vista, consejo + " - mueve la mano un poco", (20, ALTO - 20), BLANCO, 0.6)
        if not valida:
            texto(vista, "No veo la mano completa", (20, 80), ROJO, 0.7)
        cv2.imshow(VENTANA, vista)
        if (cv2.waitKey(1) & 0xFF) == 27:
            break

    if len(guardadas) < ABC_FOTOS_POR_RAFAGA:
        print(f"  Ráfaga incompleta ({len(guardadas)}/{ABC_FOTOS_POR_RAFAGA}): se conserva lo guardado.")
    return guardadas


def clip_video(cap, det, letra, persona):
    destino = carpeta(letra)
    destino.mkdir(parents=True, exist_ok=True)
    ruta = destino / f"p{persona}_{siguiente_numero(letra, persona):04d}.mp4"
    writer = cv2.VideoWriter(str(ruta), cv2.VideoWriter_fourcc(*"mp4v"), FPS, (ANCHO, ALTO))
    con_mano = 0
    paso = 1.0 / FPS
    siguiente = time.monotonic()

    for i in range(FRAMES_POR_VIDEO):
        # Ritmo fijo de 20 FPS, igual que los videos de las señas.
        espera = siguiente - time.monotonic()
        if espera > 0:
            time.sleep(espera)
        siguiente += paso
        frame = leer(cap)
        writer.write(frame)
        manos = det.detectar(frame)
        con_mano += bool(manos)
        vista = cv2.flip(frame, 1)
        dibujar_manos(vista, manos)
        texto(vista, f"Grabando {letra}: {i + 1}/{FRAMES_POR_VIDEO}", (20, 40), ROJO, 0.9)
        cv2.imshow(VENTANA, vista)
        cv2.waitKey(1)
    writer.release()

    if con_mano < FRAMES_POR_VIDEO * 0.6:
        ruta.unlink(missing_ok=True)
        print(f"  Clip descartado: la mano se vio en {con_mano}/{FRAMES_POR_VIDEO} frames.")
        return []
    return [ruta]


# ---------------------------------------------------------------------- main

def main():
    if not HAND_MODEL.exists():
        sys.exit(f"Falta {HAND_MODEL}. Descárgalo según el README.")

    print("=" * 50)
    print("TOGO - CAPTURA DEL ABECEDARIO")
    print("=" * 50)
    persona = preguntar_persona()

    # Empieza en la primera letra que le falte a esta persona.
    idx = next((i for i, l in enumerate(LETRAS) if len(archivos(l, persona)) < meta(l)), 0)

    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        sys.exit("No se pudo abrir la cámara.")
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, ANCHO)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, ALTO)
    cap.set(cv2.CAP_PROP_FPS, FPS)

    det = DetectorMano()
    deshacer = []  # archivos de la última toma

    try:
        while True:
            letra = LETRAS[idx]
            hechos = len(archivos(letra, persona))
            objetivo = meta(letra)
            dinamica = es_dinamica(letra)

            if dinamica:
                consejo = "Haz la letra completa con su movimiento"
            else:
                lista = VARIACIONES_NADA if letra == "_nada" else VARIACIONES
                consejo = lista[(hechos // ABC_FOTOS_POR_RAFAGA) % len(lista)]

            frame = leer(cap)
            manos = det.detectar(frame)
            vista = cv2.flip(frame, 1)
            dibujar_manos(vista, manos)

            tipo = "CLIP (movimiento)" if dinamica else "FOTOS"
            color = VERDE if hechos >= objetivo else BLANCO
            texto(vista, f"Letra: {letra}   [{tipo}]", (20, 40), AMARILLO, 0.9)
            texto(vista, f"Persona {persona}   {hechos}/{objetivo}", (20, 75), color)
            texto(vista, f"Siguiente: {consejo}", (20, 110), BLANCO, 0.6)
            texto(vista, "ESPACIO grabar  N/P letra  U deshacer  ESC salir", (20, ALTO - 20), BLANCO, 0.55)
            texto(vista, "Mano OK" if mano_dentro(manos) else "Sin mano", (ANCHO - 150, 40),
                  VERDE if mano_dentro(manos) else ROJO, 0.7)
            cv2.imshow(VENTANA, vista)

            tecla = cv2.waitKey(1) & 0xFF
            if tecla == 27:
                break
            elif tecla in (ord("n"), ord("N")):
                idx = (idx + 1) % len(LETRAS)
            elif tecla in (ord("p"), ord("P")):
                idx = (idx - 1) % len(LETRAS)
            elif tecla in (ord("u"), ord("U")):
                for f in deshacer:
                    f.unlink(missing_ok=True)
                print(f"  Deshecho: {len(deshacer)} archivo(s) de la letra {letra}.")
                deshacer = []
            elif tecla == 32:
                if not cuenta_regresiva(cap, det, letra, consejo):
                    continue
                if dinamica:
                    deshacer = clip_video(cap, det, letra, persona)
                else:
                    deshacer = rafaga_fotos(cap, det, letra, persona, consejo)
                total = len(archivos(letra, persona))
                print(f"  {letra}: +{len(deshacer)}  (persona {persona}: {total}/{objetivo})")
                if total >= objetivo:
                    print(f"  Letra {letra} completa para la persona {persona}.")
    finally:
        cap.release()
        cv2.destroyAllWindows()

    print("\nResumen persona", persona)
    for l in LETRAS:
        print(f"  {l:>6}: {len(archivos(l, persona)):4d}/{meta(l)}")


if __name__ == "__main__":
    main()
