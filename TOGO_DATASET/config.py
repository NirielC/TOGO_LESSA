# config.py

from pathlib import Path

# ============================================================
# RUTAS
# ============================================================

ROOT_DIR = Path(__file__).resolve().parent

DATASET_DIR = ROOT_DIR / "dataset"
MODELS_DIR = ROOT_DIR / "models"

# ============================================================
# VERSIÓN DEL DATASET
# ============================================================
# "v2": los 4000 videos originales (30 cuadros = 1.5 s) -> modelo actual.
# "v3": dataset nuevo con capture_videos.py v3 (40 cuadros = 2 s, filtros de
#       calidad, más personas). Cambia esta línea para elegir con cuál trabajar:
#       extracción, entrenamiento y diccionario la siguen solos.
VERSION = "v3"

VIDEOS_DIR = DATASET_DIR / ("videos" if VERSION == "v2" else f"videos_{VERSION}")
LANDMARKS_DIR = DATASET_DIR / f"landmarks_{VERSION}"
MODELO_DIR = MODELS_DIR / VERSION
SEQUENCES_DIR = DATASET_DIR / "sequences"
PROCESSED_DIR = DATASET_DIR / "processed"


# ============================================================
# CLASES
# ============================================================

CLASSES = [
    "hola",
    "como_estas",
    "estoy_bien",
    "estoy_mas_o_menos",
    "estoy_mal",
    "mi_nombre_es",
    "si",
    "a_que_hora_es",
    "por_la_tarde",
    "ok_adios",
    # Clase negativa: manos en reposo, rascarse, acomodarse el pelo, moverlas
    # sin señar, transiciones. Sin ella el modelo SIEMPRE elige una de las 10
    # señas aunque no estés señando. Se captura con capture_videos.py igual que
    # las demás; mientras no tenga videos, el entrenamiento la omite.
    "nada",
]

# ============================================================
# CAPTURA
# ============================================================

PERSONAS = 4  # solo para el abecedario y el modelo v2; capture_videos v3 acepta cualquiera

VIDEOS_POR_PERSONA = 100

FPS = 20

# 2 s por seña en v3: algunas señas necesitan su tiempo. El teléfono lee el
# largo de la ventana del modelo, así que no hay que cambiar nada en la app.
FRAMES_POR_VIDEO = 30 if VERSION == "v2" else 40

DURACION_VIDEO = FRAMES_POR_VIDEO / FPS

ANCHO = 640
ALTO = 480

COUNTDOWN_SEGUNDOS = 3


# ============================================================
# RANGOS DE PERSONAS
# ============================================================

def persona_de_archivo(stem: str) -> int:
    """'p3_0017' -> 3 (v3 y abecedario); '217' -> 3 (v2, rangos de 100)."""
    try:
        if stem.startswith("p"):
            return int(stem[1:].split("_")[0])
        return (int(stem) - 1) // VIDEOS_POR_PERSONA + 1
    except ValueError:
        return 0


def obtener_rango_persona(persona: int):

    inicio = ((persona - 1) * VIDEOS_POR_PERSONA) + 1
    fin = persona * VIDEOS_POR_PERSONA

    return inicio, fin


# ============================================================
# CREAR DIRECTORIOS
# ============================================================

def crear_directorios():

    VIDEOS_DIR.mkdir(parents=True, exist_ok=True)
    SEQUENCES_DIR.mkdir(parents=True, exist_ok=True)
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    MODELS_DIR.mkdir(parents=True, exist_ok=True)

    for clase in CLASSES:
        (VIDEOS_DIR / clase).mkdir(parents=True, exist_ok=True)


# ============================================================
# ABECEDARIO (capture_abecedario.py)
# ============================================================

ABECEDARIO_DIR = DATASET_DIR / "abecedario"
ABC_IMAGENES_DIR = ABECEDARIO_DIR / "imagenes"   # letras estáticas (.jpg)
ABC_VIDEOS_DIR = ABECEDARIO_DIR / "videos"       # letras con movimiento (.mp4)

LETRAS = [
    "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N",
    "Ñ", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z",
    # Negativos: mano relajada, a medio camino entre letras, gestos sueltos.
    # Evita que el deletreo invente letras cuando no estás deletreando.
    "_nada",
]

# Letras que en LESSA se hacen con movimiento: se graban como clip de 30 frames
# (igual que las señas), no como foto. REVISAR con la persona que seña antes
# de capturar: si alguna más se mueve, agregarla aquí.
LETRAS_CON_MOVIMIENTO = ["J", "Ñ", "Z"]

# Por persona y por letra estática: ráfagas de 30 fotos, 5 ráfagas = 150.
# Cada ráfaga con una variación distinta (distancia, lado, giro de muñeca).
ABC_FOTOS_POR_RAFAGA = 30
ABC_RAFAGAS_POR_PERSONA = 5
ABC_INTERVALO_MS = 120          # entre fotos de una ráfaga

# Por persona y por letra con movimiento.
ABC_CLIPS_POR_PERSONA = 40


if __name__ == "__main__":
    crear_directorios()

    print("Estructura creada correctamente.")
