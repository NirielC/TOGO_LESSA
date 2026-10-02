"""
ENTRENAMIENTO DEL ABECEDARIO (después de capture_abecedario.py).

Dos modelos, ambos opcionales para la app (se activan solos si existen):

  1. Letras estáticas -> lessa_letters.tflite
     Fotos de dataset/abecedario/imagenes/<letra>/  ->  MediaPipe (manos)  ->
     63 valores de una mano (hand_letter_features)  ->  red densa pequeña.

  2. Letras con movimiento (J, Ñ, Z...) -> lessa_letters_motion.tflite
     Clips de dataset/abecedario/videos/<letra>/ -> mismos 30×258 que las señas
     -> LSTM pequeño. Como "_nada" usa videos de señas: una seña no es una letra.

Uso:
    python tools/train_abecedario.py              # entrena y reporta
    python tools/train_abecedario.py --instalar   # además copia los modelos a la app

La app (TOGO_MOVIL) los busca en modules/togo-vision/android/src/main/assets/.
Después de --instalar hay que volver a compilar la APK.
"""

import argparse
import json
import os
import shutil
import sys
from pathlib import Path

os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "2")
os.environ.setdefault("GLOG_minloglevel", "2")

import cv2
import numpy as np

ROOT_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT_DIR))
sys.path.insert(0, str(ROOT_DIR / "tools"))

from config import ABC_IMAGENES_DIR, ABC_VIDEOS_DIR, ALTO, ANCHO, DATASET_DIR, LANDMARKS_DIR, MODELO_DIR, MODELS_DIR, persona_de_archivo  # noqa: E402
from togo_features import (  # noqa: E402
    FRAME_DIM, HAND_DIM, SEQ_LEN, frame_from_results, hand_letter_features, normalize_sequence,
)

OUT_DIR = MODELO_DIR
APP_ASSETS = ROOT_DIR.parent / "TOGO_MOVIL" / "modules" / "togo-vision" / "android" / "src" / "main" / "assets"
HAND_MODEL = MODELS_DIR / "mediapipe" / "hand_landmarker.task"
CACHE = DATASET_DIR / "abecedario" / "features_estaticas.npz"
SEED = 42


def etiqueta(carpeta: str) -> str:
    return "Ñ" if carpeta == "NN" else carpeta


persona_de = persona_de_archivo


# ------------------------------------------------------------ 1. estáticas

def extraer_estaticas():
    """Fotos -> 63 valores por foto. Se guarda en caché: re-entrenar no re-procesa."""
    import mediapipe as mp
    from mediapipe.tasks.python import BaseOptions, vision

    det = vision.HandLandmarker.create_from_options(
        vision.HandLandmarkerOptions(
            base_options=BaseOptions(model_asset_path=str(HAND_MODEL)),
            running_mode=vision.RunningMode.IMAGE,
            num_hands=2,
            min_hand_detection_confidence=0.5,
        )
    )
    X, y, personas, sin_mano = [], [], [], 0
    carpetas = sorted(d for d in ABC_IMAGENES_DIR.iterdir() if d.is_dir()) if ABC_IMAGENES_DIR.exists() else []
    for d in carpetas:
        fotos = sorted(d.glob("*.jpg"))
        print(f"  {d.name}: {len(fotos)} fotos")
        for f in fotos:
            bgr = cv2.imread(str(f))
            if bgr is None:
                continue
            h, w = bgr.shape[:2]
            rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
            res = det.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb))
            feats = hand_letter_features(frame_from_results(None, res), w, h)
            if feats is None:
                sin_mano += 1
                continue
            X.append(feats)
            y.append(etiqueta(d.name))
            personas.append(persona_de(f.stem))
    det.close()
    print(f"  Fotos sin mano detectada (descartadas): {sin_mano}")
    return np.array(X, dtype=np.float32), np.array(y), np.array(personas)


def aumentar_mano(X, rng, copias=3):
    """Giro leve en el plano, escala y ruido: la misma letra hecha un poco distinta."""
    out = [X]
    for _ in range(copias):
        pts = X.reshape(-1, 21, 3).copy()
        ang = rng.uniform(-0.25, 0.25, size=(len(X), 1))
        c, s = np.cos(ang), np.sin(ang)
        x, yv = pts[:, :, 0].copy(), pts[:, :, 1].copy()
        pts[:, :, 0] = c * x - s * yv
        pts[:, :, 1] = s * x + c * yv
        pts *= rng.uniform(0.92, 1.08, size=(len(X), 1, 1))
        pts += rng.normal(0, 0.02, size=pts.shape)
        out.append(pts.reshape(len(X), -1).astype(np.float32))
    return np.concatenate(out)


def entrenar_estaticas(args):
    from sklearn.model_selection import train_test_split
    from tensorflow import keras
    from tensorflow.keras import layers
    from train_v2 import exportar_tflite

    if CACHE.exists() and not args.re_extraer:
        d = np.load(CACHE, allow_pickle=True)
        X, y, personas = d["X"], d["y"], d["personas"]
        print(f"Usando caché {CACHE.name}: {X.shape}")
    else:
        print("Extrayendo manos de las fotos...")
        X, y, personas = extraer_estaticas()
        if len(X):
            CACHE.parent.mkdir(parents=True, exist_ok=True)
            np.savez(CACHE, X=X, y=y, personas=personas)
    if len(X) == 0:
        print("No hay fotos del abecedario todavía. Captura con tools/capture_abecedario.py")
        return None

    clases = sorted(set(y.tolist()), key=lambda c: (c == "_nada", c))
    idx = {c: i for i, c in enumerate(clases)}
    yi = np.array([idx[c] for c in y])
    print(f"Clases ({len(clases)}): {' '.join(clases)}")

    i_tr, i_te = train_test_split(np.arange(len(X)), test_size=0.2, stratify=yi, random_state=SEED)
    rng = np.random.default_rng(SEED)
    Xtr = aumentar_mano(X[i_tr], rng)
    ytr = np.tile(yi[i_tr], len(Xtr) // len(i_tr))

    m = keras.Sequential([
        keras.Input(shape=(HAND_DIM,)),
        layers.Dense(128, activation="relu"),
        layers.Dropout(0.3),
        layers.Dense(64, activation="relu"),
        layers.Dropout(0.2),
        layers.Dense(len(clases), activation="softmax"),
    ])
    m.compile(optimizer="adam", loss="sparse_categorical_crossentropy", metrics=["accuracy"])
    m.fit(Xtr, ytr, validation_data=(X[i_te], yi[i_te]), epochs=args.epochs, batch_size=64, verbose=2,
          callbacks=[keras.callbacks.EarlyStopping(monitor="val_loss", patience=15, restore_best_weights=True)])
    acc = float(m.evaluate(X[i_te], yi[i_te], verbose=0)[1])

    # Prueba honesta: si hay varias personas, entrenar sin una y probar con ella.
    por_persona = {}
    for p in sorted(set(personas.tolist()) - {0}):
        if len(set(personas.tolist())) < 2:
            break
        tr = personas != p
        mp_ = keras.models.clone_model(m)
        mp_.compile(optimizer="adam", loss="sparse_categorical_crossentropy", metrics=["accuracy"])
        mp_.fit(aumentar_mano(X[tr], rng), np.tile(yi[tr], 4), epochs=min(args.epochs, 40), batch_size=64, verbose=0)
        por_persona[f"persona_{p}"] = round(float(mp_.evaluate(X[~tr], yi[~tr], verbose=0)[1]), 4)
        print(f"  Persona {p} fuera: {por_persona[f'persona_{p}']}")

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    tfl, ops = exportar_tflite(m, OUT_DIR / "lessa_letters.tflite", input_shape=(HAND_DIM,))
    (OUT_DIR / "letters_labels.json").write_text(json.dumps(clases, ensure_ascii=False), encoding="utf-8")
    print(f"Estáticas: precisión {acc:.4f} · {len(tfl) / 1024:.0f} KB · ops {', '.join(ops)}")
    return {"precision": round(acc, 4), "clases": clases, "persona_no_vista": por_persona, "muestras": int(len(X))}


# ---------------------------------------------------------- 2. con movimiento

def entrenar_movimiento(args):
    from sklearn.model_selection import train_test_split
    from tensorflow import keras
    from tensorflow.keras import layers
    import extract_landmarks_v2 as ext
    from train_v2 import exportar_tflite

    carpetas = sorted(d for d in ABC_VIDEOS_DIR.iterdir() if d.is_dir()) if ABC_VIDEOS_DIR.exists() else []
    clips = [(c, v) for c in carpetas for v in sorted(c.glob("*.mp4"))]
    if not clips:
        print("No hay clips de letras con movimiento todavía.")
        return None

    print(f"Extrayendo {len(clips)} clips de letras con movimiento...")
    ext._init_worker()
    X, y = [], []
    cache_dir = DATASET_DIR / "abecedario" / "landmarks_movimiento"
    for carpeta, v in clips:
        out = cache_dir / carpeta.name / f"{v.stem}.npy"
        if not out.exists():
            _, status, _, _ = ext._process(str(v), str(out))
            if status != "ok":
                continue
        X.append(normalize_sequence(np.load(out), ANCHO, ALTO))
        y.append(etiqueta(carpeta.name))

    # "_nada" = señas: el modelo aprende que una seña no es una letra.
    # Deben tener el mismo largo que los clips: misma versión del dataset.
    senas = sorted(LANDMARKS_DIR.glob("*/*.npy"))
    if not senas:
        print("  Sin landmarks de señas en esta versión: '_nada' sin ejemplos de señas.")
    rng = np.random.default_rng(SEED)
    n_nada = min(len(senas), max(100, len(X)))
    for f in rng.choice(senas, size=n_nada, replace=False):
        X.append(normalize_sequence(np.load(f), ANCHO, ALTO))
        y.append("_nada")

    X = np.stack(X)
    clases = sorted(set(y), key=lambda c: (c == "_nada", c))
    yi = np.array([clases.index(c) for c in y])
    i_tr, i_te = train_test_split(np.arange(len(X)), test_size=0.2, stratify=yi, random_state=SEED)

    m = keras.Sequential([
        keras.Input(shape=(SEQ_LEN, FRAME_DIM)),
        layers.LSTM(48),
        layers.Dropout(0.3),
        layers.Dense(32, activation="relu"),
        layers.Dense(len(clases), activation="softmax"),
    ])
    m.compile(optimizer="adam", loss="sparse_categorical_crossentropy", metrics=["accuracy"])
    m.fit(X[i_tr], yi[i_tr], validation_data=(X[i_te], yi[i_te]), epochs=args.epochs, batch_size=32, verbose=2,
          callbacks=[keras.callbacks.EarlyStopping(monitor="val_loss", patience=15, restore_best_weights=True)])
    acc = float(m.evaluate(X[i_te], yi[i_te], verbose=0)[1])

    tfl, ops = exportar_tflite(m, OUT_DIR / "lessa_letters_motion.tflite")
    (OUT_DIR / "letters_motion_labels.json").write_text(json.dumps(clases, ensure_ascii=False), encoding="utf-8")
    print(f"Movimiento: precisión {acc:.4f} · {len(tfl) / 1024:.0f} KB")
    return {"precision": round(acc, 4), "clases": clases, "muestras": int(len(X))}


def instalar():
    APP_ASSETS.mkdir(parents=True, exist_ok=True)
    copiados = []
    for f in ["lessa_letters.tflite", "letters_labels.json", "lessa_letters_motion.tflite", "letters_motion_labels.json"]:
        src = OUT_DIR / f
        if src.exists():
            shutil.copy2(src, APP_ASSETS / f)
            copiados.append(f)
    print(f"Copiado a la app: {', '.join(copiados) or 'nada'}")
    # El diccionario de la app muestra la forma de mano de cada letra.
    import export_diccionario
    export_diccionario.main()
    print("Ahora vuelve a compilar la APK (ver TOGO_MOVIL/README.md).")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--epochs", type=int, default=150)
    ap.add_argument("--re-extraer", action="store_true", help="ignora la caché de fotos")
    ap.add_argument("--instalar", action="store_true", help="copia los modelos a la app")
    args = ap.parse_args()

    reporte = {"estaticas": entrenar_estaticas(args), "movimiento": entrenar_movimiento(args)}
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUT_DIR / "reporte_abecedario.json").write_text(json.dumps(reporte, ensure_ascii=False, indent=2), encoding="utf-8")
    if args.instalar:
        instalar()


if __name__ == "__main__":
    main()
