"""
TOGO - CAPTURA DE SEÑAS (dataset v3)

Graba clips de FRAMES_POR_VIDEO cuadros (40 = 2 s a 20 fps) sin tocar el teclado:

    manos abajo, fuera de la imagen  ->  LISTO (borde amarillo)
    sube las manos y haz la seña     ->  graba 2 s solo (borde rojo)
    se guarda (verde) o se descarta diciendo por qué -> baja las manos y repite

El clip se descarta solo si: falta luz, la cámara o la compu van lentas (menos de
MIN_FPS cuadros por segundo: el clip no duraría 2 s de verdad y la seña quedaría
acelerada), no se ven los hombros, estás muy cerca o muy lejos, casi no se ven
las manos, casi no hay movimiento o las manos se salen del cuadro. La clase
"nada" no exige manos ni movimiento y además arranca sola tras unos segundos.

Al completar VIDEOS_POR_PERSONA en una clase se PAUSA y avisa cuál sigue (así
nadie graba la seña anterior en la carpeta de la nueva). ESPACIO para seguir.

Salida (la que leen extract_landmarks_v2.py y train_senas.py; no cambia):
    dataset/videos_v3/<clase>/p<persona>_<nnnn>.mp4   640x480, 20 fps, 40 cuadros, sin espejo
Cualquier número de personas. En esta PC nadie pisa a nadie; para traer videos
grabados en otra PC usar tools/juntar_datos.py (nunca sobrescribe).

Uso:
    python tools/capture_videos.py
    python tools/capture_videos.py --persona 4
    python tools/capture_videos.py --persona 1 --clases por_la_tarde,ok_adios,nada
    python tools/capture_videos.py --camara 1
    python tools/capture_videos.py --video prueba.mp4 --salida C:/tmp/prueba    # probar sin cámara

Teclas (con la ventana de la cámara seleccionada):
    ESPACIO pausa/seguir · N o flecha derecha: clase siguiente · P o flecha izquierda: anterior
    U deshacer el último (se puede repetir) · F pantalla completa · ESC o Q salir
"""

import argparse
import os
import re
import sys
import threading
import time
import unicodedata
from collections import Counter
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
VENTANA = "Togo - Captura de videos"  # sin tildes: la barra de título no siempre las muestra
TAMANO_VENTANA = (960, 720)           # se ve desde lejos; se puede agrandar o usar F

# --- Filtros de calidad (ajustables) ---
MIN_POSE = 0.85          # fracción de cuadros con hombros visibles
MIN_MANOS = 0.70         # fracción de cuadros con al menos una mano
MIN_MOVIMIENTO = 0.25    # recorrido de las muñecas, en anchos de hombro
MAX_CORTADAS = 0.25      # fracción de cuadros con una mano tocando el borde
MIN_LUZ = 55             # brillo medio (0-255)
HOMBROS = (0.16, 0.60)   # ancho de hombros / ancho de imagen: ni muy lejos ni muy cerca
MIN_FPS = 16             # cuadros/s reales del clip. Con menos, 40 cuadros duran más de 2.4 s
                         # y la seña queda acelerada (el entrenamiento tolera ±25 %).

# --- Ritmo ---
MANOS_ABAJO_S = 0.6      # segundos sin manos para quedar LISTO
NADA_ARRANCA_S = 2.5     # clase "nada": empieza sola tras este tiempo con las manos abajo
INICIO_FALSO = 6         # si en los primeros 6 cuadros casi no hubo manos fue una falsa alarma
AVISO_S = 2.0            # cuánto se ve el aviso de guardado / descartado
AYUDA_MANOS_S = 4.0      # esperando con las manos a la vista más que esto: explica qué hacer
NEGRO = 8                # brillo por debajo de esto = imagen negra (tapa, cámara equivocada)

PASO = 1.0 / FPS
NOMBRE = re.compile(r"^p(\d+)_(\d+)$")   # p<persona>_<n>; otros nombres no se tocan

VERDE = (80, 200, 120)
ROJO = (60, 60, 230)
BLANCO = (255, 255, 255)
AMARILLO = (60, 200, 240)
GRIS = (170, 170, 170)
OSCURO = (30, 30, 30)

# Teclas especiales de waitKeyEx (Windows / Linux)
FLECHA_IZQ = {2424832, 65361}
FLECHA_DER = {2555904, 65363}

AYUDA_CAMARA = """No se pudo abrir la cámara. Revisa:
  - que ningún otro programa la esté usando (Zoom, Teams, Cámara de Windows, el navegador),
  - Configuración de Windows > Privacidad y seguridad > Cámara > permitir a las apps de escritorio,
  - si hay varias cámaras, elige otra:   python tools/capture_videos.py --camara 1"""


# ============================================================ texto en pantalla

# OpenCV 5 dibuja tildes y ñ; OpenCV 4 solo ASCII (pondría '??').
UTF8 = int(cv2.__version__.split(".")[0]) >= 5


def ascii_(t):
    """'más' -> 'mas', 'ñ' -> 'n' (solo hace falta con OpenCV 4)."""
    return t if UTF8 else unicodedata.normalize("NFKD", t).encode("ascii", "ignore").decode()


def texto(img, t, pos, color=BLANCO, escala=0.65, grosor=2, alinear="izq", max_ancho=None):
    """alinear: 'izq', 'centro' o 'der' (con 'der', pos[0] es el margen derecho)."""
    t = ascii_(t)
    fuente = cv2.FONT_HERSHEY_SIMPLEX
    (w, _), _ = cv2.getTextSize(t, fuente, escala, grosor)
    if max_ancho and w > max_ancho:
        escala *= max_ancho / w
        (w, _), _ = cv2.getTextSize(t, fuente, escala, grosor)
    x, y = pos
    if alinear == "centro":
        x = (img.shape[1] - w) // 2
    elif alinear == "der":
        x = img.shape[1] - x - w
    # Contorno negro con el MISMO grosor (en OpenCV 5 el grosor cambia el ancho de la letra).
    d = max(1, round(2 * escala))
    for dx, dy in ((-d, -d), (d, -d), (-d, d), (d, d)):
        cv2.putText(img, t, (x + dx, y + dy), fuente, escala, (0, 0, 0), grosor, cv2.LINE_AA)
    cv2.putText(img, t, (x, y), fuente, escala, color, grosor, cv2.LINE_AA)


def bonito(clase):
    return clase.replace("_", " ")


# ============================================================ cámara

def a_tamano(frame):
    """Lleva el cuadro a ANCHO x ALTO. Si la cámara no es 4:3 (p. ej. 1280x720) recorta
    el centro en vez de aplastarlo: aplastar deforma hombros y manos."""
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


def abrir_camara(indice=None):
    """Abre la cámara pedida o, si no se pide, la primera que dé imagen (no negra:
    algunas PC tienen una 'cámara virtual' o infrarroja en el índice 0)."""
    backends = [cv2.CAP_DSHOW, cv2.CAP_MSMF] if os.name == "nt" else [cv2.CAP_ANY]
    reserva = None
    for i in ([indice] if indice is not None else [0, 1, 2]):
        for be in backends:
            cap = cv2.VideoCapture(i, be)
            if not cap.isOpened():
                cap.release()
                continue
            cap.set(cv2.CAP_PROP_FRAME_WIDTH, ANCHO)
            cap.set(cv2.CAP_PROP_FRAME_HEIGHT, ALTO)
            # Sin pedir FPS: el clip toma un cuadro cada 1/FPS s por reloj, y pedir 20 c/s
            # deja a algunas cámaras en negro a 1 c/s (visto con la cámara virtual de Windows).
            brillo, forma, hasta = -1.0, None, time.monotonic() + 1.5
            for _ in range(5):  # los primeros cuadros a veces salen negros
                ok, f = cap.read()
                if ok and f is not None:
                    brillo, forma = max(brillo, float(f.mean())), f.shape
                if time.monotonic() > hasta:
                    break
            if brillo < 0:
                cap.release()
                continue
            if brillo >= NEGRO or indice is not None:
                if reserva:
                    reserva[0].release()
                return cap, i, forma
            if reserva is None:
                reserva = (cap, i, forma)
            else:
                cap.release()
            break  # este índice abre pero da negro: probar el siguiente
    if reserva:
        return reserva
    sys.exit(AYUDA_CAMARA)


class Camara:
    """Lee la cámara en un hilo aparte y entrega siempre el cuadro más reciente con
    la hora en que llegó. Así, si la detección tarda, no se acumulan cuadros viejos
    y el clip mide su duración real."""

    def __init__(self, cap):
        self.cap = cap
        self.cond = threading.Condition()
        self.frame, self.t, self.n, self.visto = None, 0.0, 0, 0
        self.vivo = True
        self.hilo = threading.Thread(target=self._leer, daemon=True)
        self.hilo.start()

    def _leer(self):
        while self.vivo:
            ok, f = self.cap.read()
            t = time.monotonic()
            if ok and f is not None:
                with self.cond:
                    self.frame, self.t, self.n = f, t, self.n + 1
                    self.cond.notify_all()
            else:
                time.sleep(0.05)

    def leer(self, espera=3.0):
        """(cuadro, t) nuevo, o (None, None) si la cámara no manda nada en `espera` s."""
        with self.cond:
            if not self.cond.wait_for(lambda: self.n != self.visto, timeout=espera):
                print("La cámara dejó de enviar imagen (¿se desconectó o la tomó otro programa?).")
                return None, None
            self.visto = self.n
            return self.frame, self.t

    def cerrar(self):
        self.vivo = False
        self.hilo.join(timeout=1.0)
        self.cap.release()


class ArchivoVideo:
    """Un video en lugar de la cámara, para probar sin cámara. El reloj es el del video."""

    def __init__(self, ruta, tiempo_real=False):
        self.cap = cv2.VideoCapture(str(ruta))
        if not self.cap.isOpened():
            sys.exit(f"No se pudo abrir el video {ruta}")
        self.fps = self.cap.get(cv2.CAP_PROP_FPS) or FPS
        self.i, self.tiempo_real, self.t0 = 0, tiempo_real, time.monotonic()

    def leer(self):
        ok, f = self.cap.read()
        if not ok:
            return None, None
        t = self.i / self.fps
        self.i += 1
        if self.tiempo_real:
            espera = self.t0 + t - time.monotonic()
            if espera > 0:
                time.sleep(espera)
        return f, t

    def cerrar(self):
        self.cap.release()


# ============================================================ detección y filtros

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
        self.last = -1

    def __call__(self, bgr, t):
        """-> (ancho de hombros o None, [mano: 21 (x, y)], brillo)"""
        ts = max(int(t * 1000), self.last + 1)
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


def evaluar(cuadros, clase, fps=FPS):
    """cuadros: lista de (hombros, manos, luz); fps: cuadros/s reales del clip.
    Devuelve (ok, motivo). Si no pasa, el motivo es "qué pasó: qué hacer"."""
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
        return False, f"Poca luz: prende una luz frente a ti (brillo {luz:.0f}, mínimo {MIN_LUZ})"
    if fps < MIN_FPS:
        return False, f"Cámara o compu lenta: {fps:.0f} cuadros/s (mínimo {MIN_FPS}). Más luz o cierra programas"
    if pose < MIN_POSE:
        return False, "No se ven bien tus hombros: céntrate y aléjate un poco"
    if not (HOMBROS[0] <= ancho <= HOMBROS[1]):
        return False, "Muy cerca: da un paso atrás" if ancho > HOMBROS[1] else "Muy lejos: acércate un paso"
    if clase != "nada":
        if con_manos < MIN_MANOS:
            return False, f"Casi no se vieron tus manos: solo en {con_manos:.0%} del clip"
        if mov < MIN_MOVIMIENTO:
            return False, "Casi sin movimiento: repite con el movimiento completo"
        if cort > MAX_CORTADAS:
            return False, "Las manos se salen del cuadro: aléjate un poco"
    return True, f"manos {con_manos:.0%}, mov {mov:.2f}, {fps:.0f} cuadros/s"


def guardar_clip(cuadros, ruta):
    """Escribe el clip primero a un archivo temporal (fuera de las carpetas de clase,
    así la extracción nunca ve un video a medias), comprueba que se lean los
    len(cuadros) cuadros y recién ahí lo mueve a su lugar. Devuelve None o el error."""
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
        return f"el video quedó con {n} cuadros en vez de {len(cuadros)}"
    os.replace(tmp, ruta)
    return None


# ============================================================ lógica de la captura

class Captura:
    """Máquina de estados de la captura, sin cámara ni ventana (se puede probar sola).

    esperando --(sin manos MANOS_ABAJO_S)--> listo --(aparecen manos)--> grabando
    grabando --(FRAMES_POR_VIDEO cuadros)--> se evalúa, se guarda o descarta --> esperando
    """

    def __init__(self, persona, clases, salida, meta=VIDEOS_POR_PERSONA, log=print):
        self.persona, self.clases, self.salida, self.meta, self.log = persona, list(clases), Path(salida), meta, log
        self.hechos = {c: len(self.archivos(c)) for c in self.clases}
        faltan = [i for i, c in enumerate(self.clases) if self.hechos[c] < meta]
        self.idx = faltan[0] if faltan else 0
        self.estado = "esperando"
        self.pausa = True           # empieza en pausa: confirma la clase y da tiempo a ubicarse
        self.abajo_desde = None     # desde cuándo no hay manos
        self.arriba_desde = None    # desde cuándo hay manos a la vista (para la ayuda)
        self.clip = []              # [(t, cuadro, info)]
        self.proximo = 0.0
        self.guardados = []         # pila (clase, ruta) para deshacer
        self.t = 0.0
        self.sesion = Counter()
        self.motivos = Counter()
        extra = "" if faltan else "\nYa están todas completas: lo que grabes es extra"
        self.aviso = (f"Persona {persona}\nEmpieza: {bonito(self.clase)} ({self.hechos[self.clase]}/{meta}){extra}",
                      AMARILLO, float("inf"))

    # --- archivos ---
    @property
    def clase(self):
        return self.clases[self.idx]

    def archivos(self, clase):
        d = self.salida / clase
        return [f for f in d.glob(f"p{self.persona}_*.mp4") if NOMBRE.match(f.stem)] if d.is_dir() else []

    def nueva_ruta(self, clase):
        n = max((int(NOMBRE.match(f.stem)[2]) for f in self.archivos(clase)), default=0) + 1
        destino = self.salida / clase
        destino.mkdir(parents=True, exist_ok=True)
        while (destino / f"p{self.persona}_{n:04d}.mp4").exists():
            n += 1
        return destino / f"p{self.persona}_{n:04d}.mp4"

    # --- avisos ---
    def avisar(self, msg, color=BLANCO, segundos=AVISO_S):
        """msg puede tener varias líneas (\n): la primera va más grande."""
        self.aviso = (msg, color, self.t + segundos)
        self.log(f"  [{self.clase}] " + msg.replace("\n", " - "))

    def reiniciar(self):
        self.estado, self.clip, self.abajo_desde, self.arriba_desde = "esperando", [], None, None

    # --- un cuadro ---
    def paso(self, frame, t, info):
        """Procesa un cuadro. info = (hombros, manos, luz) del Detector."""
        self.t = t
        if self.pausa:
            return
        manos = info[1]
        if self.estado == "grabando":
            # Un cuadro cada PASO segundos según el reloj, aunque la cámara mande 30/s.
            if t >= self.proximo - PASO / 4:
                self.clip.append((t, frame.copy(), info))
                self.proximo = max(self.proximo + PASO, t + PASO / 2)
            n = len(self.clip)
            if self.clase != "nada" and n == INICIO_FALSO and sum(bool(c[2][1]) for c in self.clip) < 3:
                self.reiniciar()   # una mano "vista" un instante (falsa alarma): sin aviso, de nuevo a esperar
            elif n >= FRAMES_POR_VIDEO:
                self.terminar_clip()
            return
        if manos:
            self.abajo_desde = None
            if self.arriba_desde is None:
                self.arriba_desde = t
            if self.estado == "listo":
                self.empezar(frame, t, info)
        else:
            self.arriba_desde = None
            if self.abajo_desde is None:
                self.abajo_desde = t
            quieto = t - self.abajo_desde
            if self.estado == "esperando" and quieto >= MANOS_ABAJO_S:
                self.estado = "listo"
            elif self.estado == "listo" and self.clase == "nada" and quieto >= NADA_ARRANCA_S and info[0] is not None:
                self.empezar(frame, t, info)   # "nada" arranca sola (si hay alguien en cuadro)

    def empezar(self, frame, t, info):
        self.estado, self.clip, self.proximo = "grabando", [(t, frame.copy(), info)], t + PASO

    def terminar_clip(self):
        clase = self.clase
        dur = self.clip[-1][0] - self.clip[0][0]
        fps = (len(self.clip) - 1) / dur if dur > 0 else float(FPS)
        ok, motivo = evaluar([c[2] for c in self.clip], clase, fps)
        ruta = None
        if ok:
            ruta = self.nueva_ruta(clase)
            error = guardar_clip([c[1] for c in self.clip], ruta)
            if error:
                ok, motivo = False, f"No se pudo guardar: {error}"
                print(f"  ERROR al escribir {ruta}: {error}")
        self.reiniciar()
        if not ok:
            self.sesion["descartados"] += 1
            que, _, hacer = motivo.partition(": ")
            self.motivos[que] += 1
            self.avisar(f"DESCARTADO: {que}\n{hacer}", ROJO)
            return
        self.sesion["guardados"] += 1
        self.guardados.append((clase, ruta))
        self.hechos[clase] += 1
        self.avisar(f"GUARDADO ({self.hechos[clase]}/{self.meta})\n{ruta.name} - {motivo}", VERDE)
        if self.hechos[clase] == self.meta:
            self.clase_completa()

    def clase_completa(self):
        hecha = self.clase
        faltan = [i for i, c in enumerate(self.clases) if self.hechos[c] < self.meta]
        self.pausa = True   # pausa obligada: que nadie siga con la seña anterior en la clase nueva
        if not faltan:
            self.avisar(f"{bonito(hecha).upper()} COMPLETA\n¡Todo listo! ESC para salir", VERDE, float("inf"))
            return
        self.idx = next((i for i in faltan if i > self.idx), faltan[0])
        self.avisar(f"{bonito(hecha).upper()} COMPLETA\nSigue: {bonito(self.clase)} ({self.hechos[self.clase]}/{self.meta})",
                    AMARILLO, float("inf"))

    # --- teclas ---
    def tecla(self, k):
        """Devuelve 'salir', 'pantalla' o None."""
        if k in (27, ord("q"), ord("Q")):
            return "salir"
        if k in (ord("f"), ord("F")):
            return "pantalla"
        if k == 32:
            self.pausa = not self.pausa
            self.reiniciar()
            if not self.pausa:
                self.aviso = ("", BLANCO, 0.0)
        elif k in (ord("n"), ord("N")) or k in FLECHA_DER:
            self.cambiar(+1)
        elif k in (ord("p"), ord("P")) or k in FLECHA_IZQ:
            self.cambiar(-1)
        elif k in (ord("u"), ord("U")):
            self.deshacer()
        return None

    def cambiar(self, d):
        self.idx = (self.idx + d) % len(self.clases)
        self.reiniciar()
        self.avisar(f"Clase: {bonito(self.clase)}\n{self.hechos[self.clase]}/{self.meta} grabados", AMARILLO)

    def deshacer(self):
        self.reiniciar()
        if not self.guardados:
            self.avisar("Nada que deshacer en esta sesión", GRIS)
            return
        clase, ruta = self.guardados.pop()
        ruta.unlink(missing_ok=True)
        self.hechos[clase] -= 1
        self.sesion["guardados"] -= 1
        self.sesion["deshechos"] += 1
        self.idx = self.clases.index(clase)
        self.avisar(f"BORRADO ({self.hechos[clase]}/{self.meta})\n{clase}/{ruta.name}", AMARILLO)


# ============================================================ dibujo

def dibujar(frame, info, cap, fps_vivo=None):
    hombros, manos, luz = info
    vista = cv2.flip(frame, 1)   # espejo solo para quien seña; el video se guarda sin voltear
    for h in manos:
        for x, y in h:
            cv2.circle(vista, (int((1 - x) * ANCHO), int(y * ALTO)), 3, VERDE, -1)
    color = GRIS if cap.pausa else {"esperando": GRIS, "listo": AMARILLO, "grabando": ROJO}[cap.estado]
    cv2.rectangle(vista, (0, 0), (ANCHO - 1, ALTO - 1), color, 10)

    # Encabezado: la clase en grande, para no grabar una seña en la carpeta equivocada.
    n = cap.hechos[cap.clase]
    cv2.rectangle(vista, (10, 10), (ANCHO - 10, 72), OSCURO, -1)
    texto(vista, bonito(cap.clase).upper(), (22, 54), AMARILLO, 1.15, 3, max_ancho=410)
    texto(vista, f"{n}/{cap.meta}", (22, 42), VERDE if n >= cap.meta else BLANCO, 0.85, 2, alinear="der")
    texto(vista, f"persona {cap.persona} - clase {cap.idx + 1}/{len(cap.clases)}", (22, 64), GRIS, 0.42, 1, alinear="der")
    cv2.rectangle(vista, (10, 72), (10 + int((ANCHO - 20) * min(n / cap.meta, 1.0)), 76), VERDE, -1)

    # Problemas de encuadre / luz, en vivo.
    if not cap.pausa:
        avisos = []
        if luz < NEGRO:
            avisos.append("Imagen negra: ¿tapa de la cámara? Otra cámara: --camara 1")
        elif luz < MIN_LUZ:
            avisos.append("Necesito más luz")
        if fps_vivo and fps_vivo < MIN_FPS:
            avisos.append(f"Cámara lenta: {fps_vivo:.0f} cuadros/s (mínimo {MIN_FPS})")
        if hombros is None:
            avisos.append("No veo tus hombros")
        elif not (HOMBROS[0] <= hombros <= HOMBROS[1]):
            avisos.append("Muy cerca: da un paso atrás" if hombros > HOMBROS[1] else "Muy lejos: acércate un paso")
        for i, a in enumerate(avisos):
            texto(vista, a, (22, 104 + 26 * i), ROJO, 0.6, 2, max_ancho=ANCHO - 44)

    # Aviso del último clip (o de clase completa).
    msg, col, hasta = cap.aviso
    if msg and cap.t < hasta:
        lineas, y0 = msg.split("\n"), 186
        cv2.rectangle(vista, (20, y0), (ANCHO - 20, y0 + 20 + 32 * len(lineas)), OSCURO, -1)
        for i, linea in enumerate(lineas):
            texto(vista, linea, (0, y0 + 40 + 32 * i), col if i == 0 else BLANCO, 0.85 if i == 0 else 0.6, 2,
                  alinear="centro", max_ancho=ANCHO - 60)

    # Qué hacer ahora, grande y abajo.
    y = ALTO - 72
    if cap.pausa:
        texto(vista, "PAUSA - ESPACIO para seguir", (0, y), BLANCO, 1.0, 3, alinear="centro", max_ancho=ANCHO - 40)
    elif cap.estado == "esperando":
        texto(vista, "BAJA LAS MANOS", (0, y), BLANCO, 1.1, 3, alinear="centro")
        if cap.arriba_desde is not None and cap.t - cap.arriba_desde > AYUDA_MANOS_S:
            texto(vista, "Todavía veo tus manos: bájalas hasta que salgan de la imagen", (0, y + 32), AMARILLO,
                  0.6, 2, alinear="centro", max_ancho=ANCHO - 40)
    elif cap.estado == "listo":
        if cap.clase == "nada":
            falta = int(np.ceil(max(0.0, NADA_ARRANCA_S - (cap.t - (cap.abajo_desde or cap.t)))))
            texto(vista, f"LISTO: empieza solo en {falta}", (0, y), AMARILLO, 1.0, 3, alinear="centro")
            texto(vista, "Muévete natural, como cuando no estás hablando", (0, y + 32), BLANCO, 0.6, 2, alinear="centro")
        else:
            texto(vista, "LISTO: sube las manos y haz la seña", (0, y), AMARILLO, 1.0, 3, alinear="centro", max_ancho=ANCHO - 40)
    else:
        texto(vista, "GRABANDO", (0, y), ROJO, 1.1, 3, alinear="centro")
        x0, x1 = 60, ANCHO - 60
        cv2.rectangle(vista, (x0, y + 14), (x1, y + 28), OSCURO, -1)
        cv2.rectangle(vista, (x0, y + 14), (x0 + int((x1 - x0) * len(cap.clip) / FRAMES_POR_VIDEO), y + 28), ROJO, -1)

    texto(vista, "ESPACIO pausa   N/P clase   U deshacer   F pantalla completa   ESC salir",
          (0, ALTO - 16), BLANCO, 0.45, 1, alinear="centro")
    return vista


# ============================================================ principal

def personas_en(salida):
    """{persona: cantidad de videos} que ya hay en la carpeta de salida."""
    cuenta = Counter()
    for c in CLASSES:
        for f in (Path(salida) / c).glob("p*_*.mp4"):
            m = NOMBRE.match(f.stem)
            if m:
                cuenta[int(m[1])] += 1
    return cuenta


def pedir_persona(existentes):
    if existentes:
        print("En esta PC ya hay videos de: " + ", ".join(f"p{p} ({n})" for p, n in sorted(existentes.items())))
        print(f"Si eres una persona nueva, usa el {max(existentes) + 1}.")
    while True:
        try:
            txt = input("Número de persona (1, 2, 3...): ").strip()
            if txt.isdigit() and int(txt) > 0:
                p = int(txt)
                if p not in existentes:
                    return p
                r = input(f"La persona {p} ya tiene {existentes[p]} videos aquí; los nuevos se suman (no se borra nada).\n"
                          f"¿Eres la persona {p}? (s/n): ").strip().lower()
                if r in ("s", "si", "sí", "y"):
                    return p
                continue
        except EOFError:
            sys.exit("\nSin número de persona.")
        print("  Escribe solo un número, por ejemplo 4")


def correr(fuente, det, cap, ventana=True, max_s=None):
    """Bucle principal: cuadro -> detección -> lógica -> pantalla -> teclas."""
    fps_vivo = t_prev = t_ini = None
    completa = False
    while True:
        frame, t = fuente.leer()
        if frame is None:
            break
        frame = a_tamano(frame)
        info = det(frame, t)
        if t_prev is not None and t > t_prev:
            fps_vivo = 1 / (t - t_prev) if fps_vivo is None else 0.9 * fps_vivo + 0.1 / (t - t_prev)
        t_prev = t
        t_ini = t if t_ini is None else t_ini
        cap.paso(frame, t, info)
        if max_s is not None and t - t_ini >= max_s:
            break
        if not ventana:
            continue
        cv2.imshow(VENTANA, dibujar(frame, info, cap, fps_vivo))
        k = cv2.waitKeyEx(1)
        if k != -1:
            r = cap.tecla(k)
            if r == "salir":
                break
            if r == "pantalla":
                completa = not completa
                cv2.setWindowProperty(VENTANA, cv2.WND_PROP_FULLSCREEN,
                                      cv2.WINDOW_FULLSCREEN if completa else cv2.WINDOW_NORMAL)
        if cv2.getWindowProperty(VENTANA, cv2.WND_PROP_VISIBLE) < 1:
            break   # cerraron la ventana con la X


def resumen(cap):
    s = cap.sesion
    print(f"\nResumen persona {cap.persona} - esta sesión: {s['guardados']} guardados, "
          f"{s['descartados']} descartados, {s['deshechos']} deshechos")
    if cap.motivos:
        print("  Motivos de descarte: " + ", ".join(f"{m} ({n})" for m, n in cap.motivos.most_common()))
    for c in cap.clases:
        n = cap.hechos[c]
        print(f"  {c:>18}: {n:4d}/{cap.meta}" + ("" if n >= cap.meta else f"   faltan {cap.meta - n}"))
    print(f"\nVideos en {cap.salida}\nSiguiente paso: python tools/revisar_dataset.py")


def main():
    ap = argparse.ArgumentParser(
        description="Graba clips de señas para el dataset de Togo, manos libres: manos abajo -> "
                    "LISTO -> sube las manos y seña -> se guarda solo.",
        epilog="Teclas: ESPACIO pausa, N/P clase, U deshacer, F pantalla completa, ESC salir.")
    ap.add_argument("--persona", type=int, help="número de persona (si no se da, lo pregunta)")
    ap.add_argument("--clases", help="solo estas clases, separadas por coma (p. ej. por_la_tarde,ok_adios,nada)")
    ap.add_argument("--camara", type=int, help="índice de la cámara (0, 1, 2...); por defecto la primera que dé imagen")
    ap.add_argument("--video", help="usar un archivo de video en vez de la cámara (para probar)")
    ap.add_argument("--salida", help=f"carpeta donde guardar (por defecto {VIDEOS_DIR})")
    args = ap.parse_args()

    if args.persona is not None and args.persona < 1:
        ap.error("--persona debe ser 1 o más")
    clases = list(CLASSES)
    if args.clases:
        clases = [c.strip() for c in args.clases.split(",") if c.strip()]
        malas = [c for c in clases if c not in CLASSES]
        if malas or not clases:
            ap.error(f"clases desconocidas: {', '.join(malas)}. Opciones: {', '.join(CLASSES)}")
    for m in (POSE_MODEL, HAND_MODEL):
        if not m.exists():
            sys.exit(f"Falta el modelo {m}")
    salida = Path(args.salida) if args.salida else VIDEOS_DIR

    print("=" * 60)
    print(f"TOGO - CAPTURA DE SEÑAS  (dataset {VERSION}, {FRAMES_POR_VIDEO} cuadros = {FRAMES_POR_VIDEO / FPS:.1f} s)")
    print("=" * 60)
    persona = args.persona or pedir_persona(personas_en(salida))

    if args.video:
        fuente = ArchivoVideo(args.video, tiempo_real=True)
        print(f"Probando con el video {args.video}")
    else:
        print("Abriendo la cámara...")
        cam, i, forma = abrir_camara(args.camara)
        print(f"Cámara {i}: {forma[1]}x{forma[0]}" + ("" if forma[:2] == (ALTO, ANCHO) else f" (se ajusta a {ANCHO}x{ALTO} sin deformar)"))
        fuente = Camara(cam)
    det = Detector()
    cap = Captura(persona, clases, salida)
    print(f"Guardando en {salida}")
    print("Selecciona la ventana de la cámara para usar las teclas. ESPACIO para empezar.\n")

    cv2.namedWindow(VENTANA, cv2.WINDOW_NORMAL | cv2.WINDOW_KEEPRATIO)
    cv2.resizeWindow(VENTANA, *TAMANO_VENTANA)
    try:
        correr(fuente, det, cap)
    except KeyboardInterrupt:
        pass
    finally:
        fuente.cerrar()
        cv2.destroyAllWindows()
    resumen(cap)


if __name__ == "__main__":
    main()
