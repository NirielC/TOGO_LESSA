"""
TOGO - CAPTURA DEL ABECEDARIO  (v3, archivo único)

Este archivo funciona SOLO: no necesita config.py ni nada más del proyecto.
Requisitos:  pip install mediapipe opencv-python numpy
Uso:         python capture_abecedario.py

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
  Para juntarlo: copiar las carpetas  imagenes/  y  videos/  del zip dentro de
  TOGO_DATASET/dataset/abecedario/  (los nombres llevan el número de persona,
  no se pisan).
"""

import os
import shutil
import sys
import time
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

ANCHO, ALTO, FPS = 640, 480, 20
CUADROS_CLIP = 40          # 2 s a 20 fps (igual que el modelo de señas v3)

VARIACIONES = ["de frente, normal", "girala un poco", "un poco mas cerca", "un poco mas lejos"]
VARIACIONES_NADA = ["mano relajada", "entre dos letras", "mano medio cerrada", "gestos sueltos"]

MODELO_URL = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task"
VENTANA = "TOGO - Abecedario"
AQUI = Path(__file__).resolve().parent

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
    """Texto para pantalla (OpenCV no dibuja Ñ)."""
    return {"Ñ": "N~ (ENIE)", "_nada": "NADA"}.get(letra, letra)


def lado_txt(lado):
    return "DERECHA" if lado == "D" else "IZQUIERDA"


class Almacen:
    def __init__(self, raiz, persona):
        self.raiz, self.persona = raiz, persona

    def carpeta(self, letra):
        return self.raiz / ("videos" if es_clip(letra) else "imagenes") / ("NN" if letra == "Ñ" else letra)

    def archivos(self, letra, lado="*"):
        ext = "mp4" if es_clip(letra) else "jpg"
        return sorted(self.carpeta(letra).glob(f"p{self.persona}_*_{lado}.{ext}"))

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
        nums = [int(f.stem.split("_")[1]) for f in self.archivos(letra)]
        ext = "mp4" if es_clip(letra) else "jpg"
        return destino / f"p{self.persona}_{(max(nums) + 1 if nums else 1):04d}_{lado}.{ext}"


def carpeta_salida(persona):
    repo = AQUI.parent / "dataset"
    if (AQUI.parent / "config.py").exists() and repo.is_dir():
        return repo / "abecedario", False
    return AQUI / f"abecedario_p{persona}", True


def cargar_modelo():
    for c in (AQUI / "hand_landmarker.task", AQUI.parent / "models" / "mediapipe" / "hand_landmarker.task"):
        if c.exists():
            return c.read_bytes()
    destino = AQUI / "hand_landmarker.task"
    print("Descargando el modelo de manos de MediaPipe (una sola vez, ~8 MB)...")
    try:
        urllib.request.urlretrieve(MODELO_URL, destino)
    except Exception as e:
        sys.exit(f"No se pudo descargar ({e}).\nDescárgalo a mano de:\n  {MODELO_URL}\ny ponlo junto a este archivo.")
    return destino.read_bytes()


def abrir_camara():
    backends = [cv2.CAP_DSHOW, cv2.CAP_ANY] if os.name == "nt" else [cv2.CAP_ANY]
    for idx in (0, 1, 2):
        for be in backends:
            cap = cv2.VideoCapture(idx, be)
            if cap.isOpened() and cap.read()[0]:
                cap.set(cv2.CAP_PROP_FRAME_WIDTH, ANCHO)
                cap.set(cv2.CAP_PROP_FRAME_HEIGHT, ALTO)
                return cap
            cap.release()
    sys.exit("No se pudo abrir ninguna cámara.")


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
    if luz < MIN_LUZ:
        return "Necesito mas luz"
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

def texto(img, t, pos, color=BLANCO, escala=0.65, grosor=2, centrado=False):
    if centrado:
        (w, _), _ = cv2.getTextSize(t, cv2.FONT_HERSHEY_SIMPLEX, escala, grosor)
        pos = ((ANCHO - w) // 2, pos[1])
    cv2.putText(img, t, pos, cv2.FONT_HERSHEY_SIMPLEX, escala, (0, 0, 0), grosor + 4, cv2.LINE_AA)
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
        etiqueta = {"Ñ": "N~", "_nada": "-"}.get(l, l)
        cv2.putText(img, etiqueta, (x0 + 3, y0 + 15), cv2.FONT_HERSHEY_SIMPLEX, 0.4,
                    (0, 0, 0) if hecho >= meta else BLANCO, 1, cv2.LINE_AA)


# ============================================================ principal

def main():
    print("=" * 56)
    print("TOGO - CAPTURA DEL ABECEDARIO")
    print("=" * 56)
    while True:
        try:
            persona = int(input("Tu número de persona (1, 2, 3...): ").strip())
            if persona > 0:
                break
        except ValueError:
            pass
        print("  Escribe solo un número, por ejemplo 3")

    raiz, hacer_zip = carpeta_salida(persona)
    alm = Almacen(raiz, persona)
    print(f"Guardando en: {raiz}")
    print("Selecciona la ventana de la cámara para usar las teclas.\n")

    det = Detector()
    cap = abrir_camara()
    cv2.namedWindow(VENTANA, cv2.WINDOW_NORMAL)
    cv2.resizeWindow(VENTANA, 960, 720)

    idx = next((i for i, l in enumerate(LETRAS) if alm.lado_actual(l)), 0)
    estado, t_estado = "espera", time.monotonic()   # espera -> cuenta -> fotos|clip -> aviso -> espera
    pausa = False
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
            if not ok:
                print("La cámara dejó de enviar imagen.")
                break
            if frame.shape[1] != ANCHO or frame.shape[0] != ALTO:
                frame = cv2.resize(frame, (ANCHO, ALTO))
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
                        cv2.imwrite(str(ruta), frame, [cv2.IMWRITE_JPEG_QUALITY, 95])
                        paquete.append(ruta)
                        ultima_foto = ahora
                    lado_ahora = alm.lado_actual(letra)
                    if len(paquete) >= FOTOS_POR_PAQUETE or lado_ahora != lado_paquete:
                        ultimo, paquete = paquete, []
                        if lado_ahora is None:
                            a_estado("aviso", f"Letra {nombre(letra)} COMPLETA", VERDE)
                            siguiente = next((i for i in list(range(idx + 1, len(LETRAS))) + list(range(idx))
                                              if alm.lado_actual(LETRAS[i])), None)
                            if siguiente is None:
                                a_estado("aviso", "ABECEDARIO COMPLETO! Presiona ESC", VERDE)
                                pausa = True
                            else:
                                idx = siguiente
                        elif lado_ahora != lado_paquete:
                            a_estado("aviso", f"Ahora con la mano {lado_txt(lado_ahora)}", AMARILLO)
                        else:
                            a_estado("aviso", "Paquete listo. Cambia un poco la mano", VERDE)

                elif estado == "clip":
                    if ahora >= prox_cuadro:
                        clip.append((frame.copy(), manos))
                        prox_cuadro = max(prox_cuadro + 1.0 / FPS, ahora)
                    if len(clip) >= CUADROS_CLIP:
                        con_una = [m[0] for _, m in clip if len(m) == 1]
                        motivo = None
                        if sum(len(m) > 1 for _, m in clip) > CUADROS_CLIP * 0.2:
                            motivo = "se vieron dos manos"
                        elif len(con_una) < CUADROS_CLIP * 0.6:
                            motivo = "casi no se vio la mano"
                        elif recorrido(con_una) < MIN_MOV_CLIP:
                            motivo = "casi sin movimiento"
                        if motivo:
                            a_estado("aviso", f"Repetir: {motivo}", ROJO)
                        else:
                            ruta = alm.nueva_ruta(letra, lado_paquete)
                            w = cv2.VideoWriter(str(ruta), cv2.VideoWriter_fourcc(*"mp4v"), FPS, (ANCHO, ALTO))
                            for f, _ in clip:
                                w.write(f)
                            w.release()
                            ultimo = [ruta]
                            lado_ahora = alm.lado_actual(letra)
                            if lado_ahora is None:
                                a_estado("aviso", f"Letra {nombre(letra)} COMPLETA", VERDE)
                                siguiente = next((i for i in list(range(idx + 1, len(LETRAS))) + list(range(idx))
                                                  if alm.lado_actual(LETRAS[i])), None)
                                if siguiente is None:
                                    a_estado("aviso", "ABECEDARIO COMPLETO! Presiona ESC", VERDE)
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
                    texto(vista, "Pon la mano en la posicion inicial", (0, 330), BLANCO, 0.7, centrado=True)
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
                    texto(vista, "Mas despacio...", (0, 190), AMARILLO, 0.75, centrado=True)
                else:
                    texto(vista, "Mueve la mano MUY despacio", (0, 190), BLANCO, 0.65, centrado=True)
            elif estado == "clip":
                texto(vista, f"YA!  GRABANDO {len(clip)}/{CUADROS_CLIP}", (0, 150), ROJO, 1.1, 3, centrado=True)
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
                paquete, ultimo, clip = [], [], []
                a_estado("aviso", f"Borrado: {len(borrar)} archivo(s)" if borrar else "Nada que borrar", AMARILLO)
            if cv2.getWindowProperty(VENTANA, cv2.WND_PROP_VISIBLE) < 1:
                break
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


if __name__ == "__main__":
    main()
