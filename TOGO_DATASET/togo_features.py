"""
CONTRATO DE CARACTERÍSTICAS v2 (pose + manos, sin cara).

Este archivo es la referencia única. El plugin Kotlin del teléfono debe
producir exactamente los mismos números; si algo cambia aquí, cambia allá.

Vector crudo por frame (258 valores, lo que guarda la extracción):
    [  0:132]  pose     33 puntos x (x, y, z, visibility)
    [132:195]  mano "Left"  según MediaPipe, 21 x (x, y, z)
    [195:258]  mano "Right" según MediaPipe, 21 x (x, y, z)
Coordenadas tal cual las da MediaPipe Tasks (x, y normalizadas a la imagen).
Lo que no se detecta va en ceros.

Normalización (se aplica al entrenar y en el teléfono, no se guarda):
    1. x, y, z se pasan a píxeles (x*W, y*H, z*W) para que la relación de
       aspecto de la cámara no importe (640x480 del dataset vs. retrato).
    2. Se restan del centro de los hombros y se dividen entre el ancho de
       hombros. Así da igual lo cerca o lejos que esté la persona.
    3. Los puntos no detectados siguen en cero.
Por eso se guardan los datos crudos: si la normalización cambia, no hay que
volver a procesar los 4000 videos.

Temporal: 30 frames muestreados a 20 FPS (1.5 s), igual que los videos.
"""

import numpy as np

POSE_N = 33
HAND_N = 21
POSE_DIM = POSE_N * 4          # 132
HAND_DIM = HAND_N * 3          # 63
FRAME_DIM = POSE_DIM + 2 * HAND_DIM  # 258

from config import FPS as SEQ_FPS, FRAMES_POR_VIDEO as SEQ_LEN  # 30 en v2, 40 en v3

L_SHOULDER, R_SHOULDER = 11, 12

# Ancho de hombros mínimo aceptable, en píxeles. Por debajo, la referencia no
# es fiable (persona de perfil o pose mal detectada).
MIN_SHOULDER_PX = 20.0


def frame_from_results(pose_result, hand_result):
    """Convierte resultados de MediaPipe Tasks en el vector crudo de 258."""
    out = np.zeros(FRAME_DIM, dtype=np.float32)

    if pose_result is not None and pose_result.pose_landmarks:
        lms = pose_result.pose_landmarks[0]
        out[:POSE_DIM] = np.array(
            [[p.x, p.y, p.z, p.visibility if p.visibility is not None else 0.0] for p in lms],
            dtype=np.float32,
        ).reshape(-1)

    if hand_result is not None and hand_result.hand_landmarks:
        # Orden por confianza: la mano más segura reclama su lado primero. Si
        # MediaPipe etiqueta las dos con el mismo lado, la segunda toma el libre.
        hands = []
        for lms, handed in zip(hand_result.hand_landmarks, hand_result.handedness):
            hands.append((handed[0].score, handed[0].category_name, lms))
        hands.sort(key=lambda h: -h[0])

        taken = set()
        for _, side, lms in hands:
            slot = side if side not in taken else ("Right" if side == "Left" else "Left")
            if slot in taken:
                continue
            taken.add(slot)
            start = POSE_DIM if slot == "Left" else POSE_DIM + HAND_DIM
            out[start:start + HAND_DIM] = np.array(
                [[p.x, p.y, p.z] for p in lms], dtype=np.float32
            ).reshape(-1)

    return out


def normalize_sequence(seq, width, height):
    """
    seq: (T, 258) crudo -> (T, 258) normalizado. Funciona también con (258,).
    """
    seq = np.asarray(seq, dtype=np.float32)
    single = seq.ndim == 1
    if single:
        seq = seq[None, :]

    out = np.zeros_like(seq)
    pose = seq[:, :POSE_DIM].reshape(-1, POSE_N, 4)
    hands = seq[:, POSE_DIM:].reshape(-1, 2 * HAND_N, 3)

    pose_present = np.abs(pose[:, :, :3]).sum(axis=(1, 2)) > 0
    hand_present = np.abs(hands).sum(axis=2) > 0          # por punto

    scale = np.array([width, height, width], dtype=np.float32)
    pose_px = pose[:, :, :3] * scale
    hands_px = hands * scale

    ls, rs = pose_px[:, L_SHOULDER], pose_px[:, R_SHOULDER]
    center = (ls + rs) / 2.0
    center[:, 2] = 0.0
    shoulder = np.linalg.norm((ls - rs)[:, :2], axis=1)

    ok = pose_present & (shoulder >= MIN_SHOULDER_PX)
    # Sin referencia fiable: se usa el centro de la imagen y un ancho típico,
    # para no tirar el frame entero (las manos siguen aportando).
    center[~ok] = np.array([width / 2.0, height / 2.0, 0.0], dtype=np.float32)
    shoulder = np.where(ok, shoulder, width * 0.3)

    pose_n = (pose_px - center[:, None, :]) / shoulder[:, None, None]
    pose_n[~pose_present] = 0.0
    pose_out = np.concatenate([pose_n, pose[:, :, 3:4]], axis=2)

    hands_n = (hands_px - center[:, None, :]) / shoulder[:, None, None]
    hands_n[~hand_present] = 0.0

    out[:, :POSE_DIM] = pose_out.reshape(len(seq), -1)
    out[:, POSE_DIM:] = hands_n.reshape(len(seq), -1)
    return out[0] if single else out


def hands_visible(seq):
    """Por frame: cuántas manos hay (0, 1 o 2)."""
    seq = np.asarray(seq)
    left = np.abs(seq[..., POSE_DIM:POSE_DIM + HAND_DIM]).sum(axis=-1) > 0
    right = np.abs(seq[..., POSE_DIM + HAND_DIM:]).sum(axis=-1) > 0
    return left.astype(np.int32) + right.astype(np.int32)


def mirror_sequence(seq_norm):
    """
    Aumento de datos: espejo horizontal de una secuencia YA normalizada.
    Invierte x y cambia izquierda <-> derecha (manos y pose), para personas
    zurdas o cámaras que entregan la imagen volteada.
    """
    s = np.array(seq_norm, dtype=np.float32, copy=True)
    pose = s[:, :POSE_DIM].reshape(-1, POSE_N, 4)
    pose[:, :, 0] *= -1
    pose[:, :] = pose[:, _POSE_MIRROR]
    hands = s[:, POSE_DIM:].reshape(-1, 2, HAND_N, 3)
    hands[:, :, :, 0] *= -1
    hands = hands[:, ::-1]
    s[:, :POSE_DIM] = pose.reshape(len(s), -1)
    s[:, POSE_DIM:] = hands.reshape(len(s), -1)
    # Un punto ausente (0) sigue en 0 tras invertir el signo: nada que corregir.
    return s


# Pares izquierda/derecha de los 33 puntos de pose de MediaPipe.
_PAIRS = [(1, 4), (2, 5), (3, 6), (7, 8), (9, 10), (11, 12), (13, 14), (15, 16),
          (17, 18), (19, 20), (21, 22), (23, 24), (25, 26), (27, 28), (29, 30), (31, 32)]
_POSE_MIRROR = list(range(POSE_N))
for _a, _b in _PAIRS:
    _POSE_MIRROR[_a], _POSE_MIRROR[_b] = _b, _a


# ---------------------------------------------------------------- abecedario

def hand_letter_features(raw_frame, width, height):
    """
    Características de UNA mano para el abecedario (63 valores) o None.
    Igual que Features.letterFeatures() en Kotlin:
      - se elige la mano más grande en la imagen (la que está deletreando),
      - relativa a la muñeca, en píxeles, dividida entre el tamaño de la palma
        (muñeca -> nudillo del dedo medio),
      - la mano "Left" se espeja en x: el modelo ve siempre una mano derecha.
    """
    raw = np.asarray(raw_frame, dtype=np.float32)
    best, best_size = -1, 0.0
    for s in (0, 1):
        b = POSE_DIM + s * HAND_DIM
        if raw[b] == 0 and raw[b + 1] == 0:
            continue
        size = float(np.hypot((raw[b + 27] - raw[b]) * width, (raw[b + 28] - raw[b + 1]) * height))
        if size > best_size:
            best, best_size = s, size
    if best < 0 or best_size < 1.0:
        return None
    b = POSE_DIM + best * HAND_DIM
    hand = raw[b:b + HAND_DIM].reshape(HAND_N, 3) * np.array([width, height, width], dtype=np.float32)
    hand = (hand - hand[0]) / best_size
    if best == 0:  # "Left"
        hand[:, 0] *= -1
    return hand.reshape(-1).astype(np.float32)
