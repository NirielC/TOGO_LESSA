"""
TOGO - CAPTURA DE SEÑAS (v3)

Qué cambia respecto a la versión anterior y por qué:
  - Más tiempo por clip (FRAMES_POR_VIDEO en config.py, 2 s en v3): algunas
    señas necesitan su tiempo y antes se cortaban.
  - ARRANQUE AUTOMÁTICO: con las manos abajo queda "listo"; al subir las manos
    empieza a grabar. Así cada clip empieza igual (como en el teléfono, que
    reconoce cuando aparecen las manos) y se graba en ráfaga sin tocar el teclado:
        manos abajo -> sube y seña -> baja -> siguiente.
  - FILTROS: el clip se descarta solo, con el motivo en pantalla, si:
        no se ve bien a la persona (hombros) en casi todo el clip,
        las manos aparecen poco, hubo poco movimiento (no es una seña),
        las manos se salen del cuadro, o falta luz.
    (La clase "nada" no exige movimiento ni manos: es justo lo contrario.)
  - Cualquier número de personas. Archivos p<persona>_<n>.mp4: nadie pisa a nadie.
  - Vista en espejo para quien seña; se guarda sin voltear (como siempre).

Teclas:  ESPACIO pausar/reanudar · N / P clase siguiente/anterior · U deshacer · ESC salir
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

from config import ALTO, ANCHO, CLASSES, FPS, FRAMES_POR_VIDEO, MODELS_DIR, VERSION, VIDEOS_DIR, VIDEOS_POR_PERSONA  # noqa: E402

POSE_MODEL = MODELS_DIR / "mediapipe" / "pose_landmarker_lite.task"
HAND_MODEL = MODELS_DIR / "mediapipe" / "hand_landmarker.task"
VENTANA = "TOGO - Captura de señas v3"

# --- Filtros de calidad (ajustables) ---
MIN_POSE = 0.85          # fracción de cuadros con hombros visibles
MIN_MANOS = 0.70         # fracción de cuadros con al menos una mano
MIN_MOVIMIENTO = 0.25    # recorrido de las muñecas, en anchos de hombro
MAX_CORTADAS = 0.25      # fracción de cuadros con una mano tocando el borde
MIN_LUZ = 55             # brillo medio (0-255)
HOMBROS = (0.16, 0.60)   # ancho de hombros / ancho de imagen: ni muy lejos ni muy cerca
MANOS_ABAJO_S = 0.6      # segundos con las manos abajo para quedar "listo"

VERDE = (80, 200, 120)
ROJO = (60, 60, 230)
BLANCO = (255, 255, 255)
AMARILLO = (60, 200, 240)
GRIS = (170, 170, 170)


def texto(img, t, pos, color=BLANCO, escala=0.65, grosor=2):
    cv2.putText(img, t, pos, cv2.FONT_HERSHEY_SIMPLEX, escala, (0, 0, 0), grosor + 3, cv2.LINE_AA)
    cv2.putText(img, t, pos, cv2.FONT_HERSHEY_SIMPLEX, escala, color, grosor, cv2.LINE_AA)


class Detector:
    """Pose + manos en vivo (mismos modelos que la extracción y el teléfono)."""

    def __init__(self):
        import mediapipe as mp
        from mediapipe.tasks.python import BaseOptions, vision

        self.mp = mp
        self.pose = vision.PoseLandmarker.create_from_options(vision.PoseLandmarkerOptions(
            base_options=BaseOptions(model_asset_path=str(POSE_MODEL)), running_mode=vision.RunningMode.VIDEO, num_poses=1))
        self.hands = vision.HandLandmarker.create_from_options(vision.HandLandmarkerOptions(
            base_options=BaseOptions(model_asset_path=str(HAND_MODEL)), running_mode=vision.RunningMode.VIDEO, num_hands=2))
        self.t0 = time.monotonic()
        self.last = -1

    def __call__(self, bgr):
        ts = max(int((time.monotonic() - self.t0) * 1000), self.last + 1)
        self.last = ts
        img = self.mp.Image(image_format=self.mp.ImageFormat.SRGB, data=cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB))
        p = self.pose.detect_for_video(img, ts)
        h = self.hands.detect_for_video(img, ts)
        hombros = None
        if p.pose_landmarks:
            lm = p.pose_landmarks[0]
            if min(lm[11].visibility or 0, lm[12].visibility or 0) > 0.5:
                hombros = abs(lm[11].x - lm[12].x)
        manos = [[(q.x, q.y) for q in m] for m in (h.hand_landmarks or [])]
        luz = float(cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)[::8, ::8].mean())
        return hombros, manos, luz


def cortada(manos, m=0.02):
    return any(min(x for x, _ in h) < m or max(x for x, _ in h) > 1 - m or min(y for _, y in h) < m or max(y for _, y in h) > 1 - m for h in manos)


def muñecas(manos):
    return [h[0] for h in manos]


def evaluar(cuadros, clase):
    """cuadros: lista de (hombros, manos, luz). Devuelve (ok, motivo)."""
    n = len(cuadros)
    pose = sum(c[0] is not None for c in cuadros) / n
    con_manos = sum(bool(c[1]) for c in cuadros) / n
    cort = sum(cortada(c[1]) for c in cuadros if c[1]) / max(1, sum(bool(c[1]) for c in cuadros))
    luz = float(np.mean([c[2] for c in cuadros]))
    anchos = [c[0] for c in cuadros if c[0]]
    ancho = float(np.median(anchos)) if anchos else 0.3
    # Recorrido de las muñecas, en anchos de hombro.
    pts = [w for c in cuadros for w in muñecas(c[1])]
    mov = 0.0
    if len(pts) > 2:
        a = np.array(pts)
        mov = float((a.max(0) - a.min(0)).sum() / max(ancho, 0.05))

    if luz < MIN_LUZ:
        return False, f"Poca luz ({luz:.0f})"
    if pose < MIN_POSE:
        return False, "No se ven bien los hombros"
    if not (HOMBROS[0] <= ancho <= HOMBROS[1]):
        return False, "Muy cerca" if ancho > HOMBROS[1] else "Muy lejos"
    if clase != "nada":
        if con_manos < MIN_MANOS:
            return False, f"Manos en solo {con_manos:.0%} del clip"
        if mov < MIN_MOVIMIENTO:
            return False, "Casi sin movimiento"
        if cort > MAX_CORTADAS:
            return False, "Las manos se salen del cuadro"
    return True, f"OK  manos {con_manos:.0%} - mov {mov:.2f}"


def archivos(clase, persona):
    return sorted((VIDEOS_DIR / clase).glob(f"p{persona}_*.mp4"))


def siguiente(clase, persona):
    a = archivos(clase, persona)
    return int(a[-1].stem.split("_")[1]) + 1 if a else 1


def main():
    for m in (POSE_MODEL, HAND_MODEL):
        if not m.exists():
            sys.exit(f"Falta {m}")
    print("=" * 52)
    print(f"TOGO - CAPTURA DE SEÑAS  (dataset {VERSION}, {FRAMES_POR_VIDEO} cuadros = {FRAMES_POR_VIDEO / FPS:.1f} s)")
    print("=" * 52)
    while True:
        try:
            persona = int(input("Número de persona (1, 2, 3...): "))
            if persona > 0:
                break
        except ValueError:
            pass
    idx = next((i for i, c in enumerate(CLASSES) if len(archivos(c, persona)) < VIDEOS_POR_PERSONA), 0)

    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        sys.exit("No se pudo abrir la cámara.")
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, ANCHO)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, ALTO)
    cap.set(cv2.CAP_PROP_FPS, FPS)
    det = Detector()

    estado = "esperando"   # esperando (manos arriba) -> listo (manos abajo) -> grabando
    pausa = False
    abajo_desde = None
    grabados = []          # (frame, info) del clip en curso
    ultimo = None          # último archivo guardado (para deshacer)
    aviso, aviso_color, aviso_hasta = "", BLANCO, 0.0
    paso = 1.0 / FPS
    proximo = time.monotonic()

    try:
        while True:
            if estado == "grabando":
                espera = proximo - time.monotonic()
                if espera > 0:
                    time.sleep(espera)
                proximo += paso
            ok, frame = cap.read()
            if not ok:
                print("No se pudo leer la cámara.")
                break
            if frame.shape[1] != ANCHO or frame.shape[0] != ALTO:
                frame = cv2.resize(frame, (ANCHO, ALTO))
            info = det(frame)
            hombros, manos, luz = info
            clase = CLASSES[idx]
            ahora = time.monotonic()

            if estado == "grabando":
                grabados.append((frame.copy(), info))
                if len(grabados) >= FRAMES_POR_VIDEO:
                    ok_clip, motivo = evaluar([g[1] for g in grabados], clase)
                    if ok_clip:
                        destino = VIDEOS_DIR / clase
                        destino.mkdir(parents=True, exist_ok=True)
                        ruta = destino / f"p{persona}_{siguiente(clase, persona):04d}.mp4"
                        w = cv2.VideoWriter(str(ruta), cv2.VideoWriter_fourcc(*"mp4v"), FPS, (ANCHO, ALTO))
                        for f, _ in grabados:
                            w.write(f)
                        w.release()
                        ultimo = ruta
                        aviso, aviso_color = f"Guardado {ruta.name}  ({motivo})", VERDE
                    else:
                        aviso, aviso_color = f"Descartado: {motivo}", ROJO
                    aviso_hasta = ahora + 2.0
                    print(f"  {clase}: {aviso}")
                    grabados = []
                    estado = "esperando"
                    abajo_desde = None
            elif not pausa:
                # Sin manos un momento -> listo. Con manos estando listo -> grabar.
                if not manos:
                    abajo_desde = abajo_desde or ahora
                    if estado == "esperando" and ahora - abajo_desde >= MANOS_ABAJO_S:
                        estado = "listo"
                else:
                    abajo_desde = None
                    if estado == "listo":
                        estado = "grabando"
                        proximo = time.monotonic()
                        grabados = [(frame.copy(), info)]
                # "nada" también se graba sin subir las manos: tras 2.5 s listo, arranca solo.
                if clase == "nada" and estado == "listo" and abajo_desde and ahora - abajo_desde > 2.5:
                    estado = "grabando"
                    proximo = time.monotonic()
                    grabados = [(frame.copy(), info)]

            # ---------------- dibujo ----------------
            vista = cv2.flip(frame, 1)
            for h in manos:
                for x, y in h:
                    cv2.circle(vista, (int((1 - x) * ANCHO), int(y * ALTO)), 3, VERDE, -1)
            color = {"esperando": GRIS, "listo": AMARILLO, "grabando": ROJO}[estado]
            cv2.rectangle(vista, (0, 0), (ANCHO - 1, ALTO - 1), color, 8)
            hechos = len(archivos(clase, persona))
            texto(vista, f"{clase}   persona {persona}   {hechos}/{VIDEOS_POR_PERSONA}", (16, 34), AMARILLO, 0.75)
            if pausa:
                texto(vista, "PAUSA - ESPACIO para seguir", (16, 70), GRIS)
            elif estado == "esperando":
                texto(vista, "Baja las manos para empezar", (16, 70))
            elif estado == "listo":
                texto(vista, "LISTO: sube las manos y haz la seña" if clase != "nada" else "LISTO: muevete natural, sin señar", (16, 70), AMARILLO)
            else:
                texto(vista, f"GRABANDO {len(grabados)}/{FRAMES_POR_VIDEO}", (16, 70), ROJO)
            # Guía de encuadre
            if hombros is None:
                texto(vista, "No veo tus hombros", (16, 104), ROJO, 0.6)
            elif not (HOMBROS[0] <= hombros <= HOMBROS[1]):
                texto(vista, "Muy cerca" if hombros > HOMBROS[1] else "Muy lejos", (16, 104), ROJO, 0.6)
            if luz < MIN_LUZ:
                texto(vista, "Necesito mas luz", (16, 132), ROJO, 0.6)
            if ahora < aviso_hasta:
                texto(vista, aviso, (16, ALTO - 50), aviso_color, 0.6)
            texto(vista, "ESPACIO pausa  N/P clase  U deshacer  ESC salir", (16, ALTO - 16), BLANCO, 0.5)
            cv2.imshow(VENTANA, vista)

            k = cv2.waitKey(1) & 0xFF
            if k == 27:
                break
            if k == 32:
                pausa = not pausa
                estado, grabados = "esperando", []
            elif k in (ord("n"), ord("N"), ord("p"), ord("P")) and estado != "grabando":
                idx = (idx + (1 if k in (ord("n"), ord("N")) else -1)) % len(CLASSES)
                estado = "esperando"
            elif k in (ord("u"), ord("U")) and ultimo is not None:
                ultimo.unlink(missing_ok=True)
                aviso, aviso_color, aviso_hasta = f"Deshecho {ultimo.name}", AMARILLO, time.monotonic() + 2
                ultimo = None
    finally:
        cap.release()
        cv2.destroyAllWindows()

    print(f"\nResumen persona {persona}:")
    for c in CLASSES:
        print(f"  {c:>18}: {len(archivos(c, persona)):4d}/{VIDEOS_POR_PERSONA}")


if __name__ == "__main__":
    main()
