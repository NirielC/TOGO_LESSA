"""
ENTRENAMIENTO DEL MODELO DE SEÑAS (v3).

Qué mejora respecto a train_v2.py (que se conserva para reproducir el modelo actual):

  Características v3 (togo_features.build_features_v3), 384 por cuadro:
    - FORMA de la mano (dedos relativos a la muñeca): las señas que se confundían
      se parecen en posición pero no en forma de mano; ahora la red la ve.
    - Mano dominante normalizada: señas hechas con la izquierda se espejan, así
      diestros y zurdos se ven igual (y grabar mitad y mitad suma variedad real).
    - Sin piernas ni pies (ruido).

  Aumento de datos realista (solo en entrenamiento):
    - Velocidad distinta (0.8x a 1.25x): no todos señan al mismo ritmo.
    - Seña corrida dentro de la ventana: en el teléfono la ventana se desliza y
      la seña no siempre queda centrada.
    - Tamaño, posición y ruido leves.

  Dataset combinado: además de los videos nuevos (v3, 2 s) suma los 4000 videos
  originales (landmarks_v2, 1.5 s, centrados en la ventana de 2 s). Más personas,
  días, ropa y fondos. Validación y prueba se hacen solo con videos nuevos.
  (--sin-originales para entrenar solo con los nuevos.)

  Red: Dense(128) por cuadro -> LSTM(96) -> LSTM(64) -> Dense(64) -> softmax,
  con suavizado de etiquetas (no se pone 100% segura cuando duda) y pesos por clase.

  Salidas (models/<versión>/): lessa_signs.keras, lessa_signs.tflite, labels.json,
  signs_meta.json (formato para la app) y reporte.json (precisión, confusiones).

Uso:
    python tools/train_senas.py                    # dataset de config.VERSION (v3)
    python tools/train_senas.py --por-persona      # + precisión con persona no vista
    python tools/train_senas.py --instalar         # + copia el modelo a la app
    set TOGO_VERSION=v2 && python tools/train_senas.py   # con los 4000 videos originales
"""

import argparse
import json
import os
import shutil
import sys
from pathlib import Path

os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "2")

import numpy as np

ROOT_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT_DIR))
sys.path.insert(0, str(ROOT_DIR / "tools"))

from config import ALTO, ANCHO, CLASSES, DATASET_DIR, FPS, LANDMARKS_DIR, MODELO_DIR, VERSION, persona_de_archivo  # noqa: E402
from togo_features import (  # noqa: E402
    FRAME_DIM, SEQ_LEN, V3_DIM, build_features_v3, mirror_features_v3, mirror_sequence, normalize_sequence,
)

SEED = 42
APP_ASSETS = ROOT_DIR.parent / "TOGO_MOVIL" / "modules" / "togo-vision" / "android" / "src" / "main" / "assets"
LANDMARKS_V2_DIR = DATASET_DIR / "landmarks_v2"   # los 4000 videos originales (30 cuadros)
# Persona de los videos originales -> su número en el dataset nuevo (si es la misma
# persona). Solo sirve para que "persona no vista" no haga trampa. Ajustar si cambió.
V2_A_V3 = {1: 1, 2: 2, 3: 3, 4: 4}


# ------------------------------------------------------------------ datos

def ajustar_largo(raw):
    """Lleva una secuencia al largo del modelo: si es corta (videos v2 de 1.5 s) la
    centra repitiendo el primer y último cuadro; si es larga, toma el centro."""
    T = len(raw)
    if T == SEQ_LEN:
        return raw
    if T > SEQ_LEN:
        ini = (T - SEQ_LEN) // 2
        return raw[ini:ini + SEQ_LEN]
    izq = (SEQ_LEN - T) // 2
    return np.concatenate([np.repeat(raw[:1], izq, 0), raw, np.repeat(raw[-1:], SEQ_LEN - T - izq, 0)])


def cargar(features, con_v2):
    """Junta el dataset actual (v3) con los 4000 videos originales (v2) si existen.
    Los v2 se marcan con persona 100+N para no mezclarlos al medir."""
    fuentes = [(LANDMARKS_DIR, 0)]
    if con_v2 and VERSION != "v2" and LANDMARKS_V2_DIR.exists():
        fuentes.append((LANDMARKS_V2_DIR, 100))
    X, y, persona, origen, clases = [], [], [], [], []
    for clase in CLASSES:
        files = [(f, extra) for d, extra in fuentes for f in sorted((d / clase).glob("*.npy"))]
        if not files:
            print(f"  [omitida] {clase}: sin datos")
            continue
        clases.append(clase)
        n = {0: 0, 100: 0}
        for f, extra in files:
            raw = np.load(f)
            if raw.ndim != 2 or raw.shape[1] != FRAME_DIM or len(raw) < SEQ_LEN * 0.6:
                continue
            raw = ajustar_largo(raw)
            X.append(build_features_v3(raw, ANCHO, ALTO) if features == "v3" else normalize_sequence(raw, ANCHO, ALTO))
            y.append(len(clases) - 1)
            persona.append(persona_de_archivo(f.stem) + extra)
            origen.append(extra)
            n[extra] += 1
        print(f"  {clase}: {n[0]}" + (f" + {n[100]} originales" if n[100] else ""))
    return np.stack(X), np.array(y), np.array(persona), np.array(origen), clases


def espejo(seq, features):
    return mirror_features_v3(seq) if features == "v3" else mirror_sequence(seq)


def remuestrear(seq, factor, rng):
    """Cambia la velocidad: factor > 1 = más rápido. Vecino más cercano (no mezcla manos con ceros)."""
    T = len(seq)
    largo = max(2, int(round(T / factor)))
    idx = np.clip(np.round(np.linspace(0, T - 1, largo)).astype(int), 0, T - 1)
    s = seq[idx]
    if len(s) >= T:  # más lento: recorta una ventana de T al azar
        ini = int(rng.integers(0, len(s) - T + 1))
        return s[ini:ini + T]
    pad = T - len(s)  # más rápido: rellena repitiendo bordes
    izq = int(rng.integers(0, pad + 1))
    return np.concatenate([np.repeat(s[:1], izq, 0), s, np.repeat(s[-1:], pad - izq, 0)])


def correr(seq, k):
    if k > 0:
        return np.concatenate([np.repeat(seq[:1], k, 0), seq[:-k]])
    if k < 0:
        return np.concatenate([seq[-k:], np.repeat(seq[-1:], -k, 0)])
    return seq


def perturbar(seq, rng):
    """Tamaño/posición/ruido leves en la parte v2; ruido leve en la forma."""
    s = seq.copy()
    presente = s != 0
    T = len(s)
    pose = s[:, :132].reshape(T, 33, 4)
    manos = s[:, 132:FRAME_DIM].reshape(T, 42, 3)
    esc = rng.uniform(0.9, 1.1)
    mov = rng.normal(0, 0.05, size=3)
    pose[:, :, :3] = pose[:, :, :3] * esc + mov
    manos[:] = manos * esc + mov + rng.normal(0, 0.01, size=manos.shape)
    s[:, :132] = pose.reshape(T, -1)
    s[:, 132:FRAME_DIM] = manos.reshape(T, -1)
    if s.shape[1] > FRAME_DIM:
        s[:, FRAME_DIM:] += rng.normal(0, 0.02, size=s[:, FRAME_DIM:].shape)
    return np.where(presente, s, 0.0).astype(np.float32)


def aumentar(X, y, features, rng, copias=4):
    out_x, out_y = [X], [y]
    T = X.shape[1]
    for c in range(copias):
        nuevas = []
        for s in X:
            a = remuestrear(s, rng.uniform(0.8, 1.25), rng) if c % 2 == 0 else s
            a = correr(a, int(rng.integers(-T // 4, T // 4 + 1)))
            a = perturbar(a, rng)
            if features != "v3" and rng.random() < 0.5:  # v3 ya normaliza la mano dominante
                a = espejo(a, features)
            nuevas.append(a)
        out_x.append(np.stack(nuevas))
        out_y.append(y)
    return np.concatenate(out_x), np.concatenate(out_y)


# ------------------------------------------------------------------ modelo

def crear_modelo(T, D, n):
    from tensorflow import keras
    from tensorflow.keras import layers

    m = keras.Sequential([
        keras.Input(shape=(T, D)),
        layers.Dense(128, activation="relu"),      # proyección por cuadro
        layers.Dropout(0.2),
        layers.LSTM(96, return_sequences=True),
        layers.Dropout(0.3),
        layers.LSTM(64),
        layers.Dropout(0.3),
        layers.Dense(64, activation="relu"),
        layers.Dropout(0.3),
        layers.Dense(n, activation="softmax"),
    ])
    m.compile(
        optimizer=keras.optimizers.Adam(1e-3),
        loss=keras.losses.CategoricalCrossentropy(label_smoothing=0.1),
        metrics=["accuracy"],
    )
    return m


def entrenar(Xtr, ytr, Xva, yva, n, epochs, verbose=2):
    import tensorflow as tf
    from tensorflow import keras

    tf.random.set_seed(SEED)
    m = crear_modelo(Xtr.shape[1], Xtr.shape[2], n)
    conteo = np.bincount(ytr, minlength=n)
    pesos = {i: float(len(ytr) / (n * max(c, 1))) for i, c in enumerate(conteo)}
    m.fit(
        Xtr, keras.utils.to_categorical(ytr, n), validation_data=(Xva, keras.utils.to_categorical(yva, n)),
        epochs=epochs, batch_size=64, verbose=verbose, class_weight=pesos,
        callbacks=[
            keras.callbacks.EarlyStopping(monitor="val_loss", patience=20, restore_best_weights=True),
            keras.callbacks.ReduceLROnPlateau(monitor="val_loss", factor=0.5, patience=7, min_lr=1e-5),
        ],
    )
    return m


def confusiones(cm, clases, top=6):
    pares = []
    for i in range(len(clases)):
        for j in range(len(clases)):
            if i != j and cm[i, j]:
                pares.append((int(cm[i, j]), clases[i], clases[j]))
    return sorted(pares, reverse=True)[:top]


# ------------------------------------------------------------------ main

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--features", choices=["v3", "v2"], default="v3")
    ap.add_argument("--epochs", type=int, default=150)
    ap.add_argument("--por-persona", action="store_true", help="precisión dejando fuera a cada persona")
    ap.add_argument("--instalar", action="store_true", help="copia el modelo, etiquetas y formato a la app")
    ap.add_argument("--salida", default=None, help="carpeta de salida (por defecto models/<versión>)")
    ap.add_argument("--sin-originales", action="store_true", help="no sumar los 4000 videos originales (v2)")
    args = ap.parse_args()

    from sklearn.metrics import confusion_matrix
    from sklearn.model_selection import train_test_split
    import tensorflow as tf
    from train_v2 import exportar_tflite

    out_dir = Path(args.salida) if args.salida else MODELO_DIR
    print(f"Dataset {VERSION} ({SEQ_LEN} cuadros) · características {args.features}"
          + ("" if args.sin_originales else " · + videos originales v2"))
    X, y, persona, origen, clases = cargar(args.features, not args.sin_originales)
    D = X.shape[2]
    print(f"Total: {X.shape}  clases: {len(clases)}  personas: {sorted(set(persona.tolist()))}")

    # Validación y prueba solo con el dataset nuevo (es como se usará la app);
    # los videos originales van todos a entrenamiento.
    nuevos = np.where(origen == 0)[0] if (origen == 0).any() else np.arange(len(X))
    i_tr, i_tmp = train_test_split(nuevos, test_size=0.30, stratify=y[nuevos], random_state=SEED)
    i_va, i_te = train_test_split(i_tmp, test_size=0.50, stratify=y[i_tmp], random_state=SEED)
    i_tr = np.concatenate([i_tr, np.setdiff1d(np.arange(len(X)), nuevos)])
    rng = np.random.default_rng(SEED)
    Xtr, ytr = aumentar(X[i_tr], y[i_tr], args.features, rng)
    print(f"Entrenamiento (aumentado): {Xtr.shape}  val: {len(i_va)}  prueba: {len(i_te)}")

    model = entrenar(Xtr, ytr, X[i_va], y[i_va], len(clases), args.epochs)
    acc = float(model.evaluate(X[i_te], tf.keras.utils.to_categorical(y[i_te], len(clases)), verbose=0)[1])
    pred = model.predict(X[i_te], verbose=0).argmax(1)
    cm = confusion_matrix(y[i_te], pred, labels=list(range(len(clases))))
    # En v3 la mano dominante ya se normaliza (se espeja antes de entrar): la prueba
    # en espejo no aplica. En v2 mide si funciona con la otra mano.
    acc_espejo = None
    if args.features != "v3":
        Xm = np.stack([espejo(s, args.features) for s in X[i_te]])
        acc_espejo = float((model.predict(Xm, verbose=0).argmax(1) == y[i_te]).mean())

    out_dir.mkdir(parents=True, exist_ok=True)
    model.save(out_dir / "lessa_signs.keras")
    tfl, ops = exportar_tflite(model, out_dir / "lessa_signs.tflite", input_shape=(SEQ_LEN, D))

    interp = tf.lite.Interpreter(model_content=tfl)
    interp.allocate_tensors()
    inp, outp = interp.get_input_details()[0], interp.get_output_details()[0]
    ok = 0
    for s, t in zip(X[i_te], y[i_te]):
        interp.set_tensor(inp["index"], s[None].astype(np.float32))
        interp.invoke()
        ok += int(interp.get_tensor(outp["index"])[0].argmax() == t)
    acc_tfl = ok / len(i_te)

    meta = {"seq_len": SEQ_LEN, "frame_dim": D, "features": args.features, "canonical": args.features == "v3", "fps": FPS}
    reporte = {
        "dataset": VERSION, "features": args.features,
        "precision_prueba": round(acc, 4), "precision_tflite": round(acc_tfl, 4), "precision_espejo": None if acc_espejo is None else round(acc_espejo, 4),
        "clases": clases, "matriz_confusion": cm.tolist(),
        "mas_confundidas": [f"{a} -> {b}: {c}" for c, a, b in confusiones(cm, clases)],
        "tflite_kb": round(len(tfl) / 1024, 1), "tflite_ops": ops, "formato": meta,
    }

    if args.por_persona:
        pp = {}
        for p in sorted(set(persona[origen == 0].tolist()) - {0}):
            fuera = persona == p
            # Si esa persona también grabó los videos originales, se sacan para que de verdad sea "no vista".
            dentro = ~fuera & (persona != 100 + V2_A_V3.get(p, -1))
            i_d = np.where(dentro)[0]
            a_tr, a_va = train_test_split(i_d, test_size=0.15, stratify=y[i_d], random_state=SEED)
            Xa, ya = aumentar(X[a_tr], y[a_tr], args.features, rng)
            m = entrenar(Xa, ya, X[a_va], y[a_va], len(clases), min(args.epochs, 80), verbose=0)
            pp[f"persona_{p}"] = round(float((m.predict(X[fuera], verbose=0).argmax(1) == y[fuera]).mean()), 4)
            print(f"  Persona {p} no vista: {pp[f'persona_{p}']}")
        reporte["precision_persona_no_vista"] = pp
        reporte["promedio_persona_no_vista"] = round(float(np.mean(list(pp.values()))), 4) if pp else None

    (out_dir / "labels.json").write_text(json.dumps(clases, ensure_ascii=False, indent=2), encoding="utf-8")
    (out_dir / "signs_meta.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
    (out_dir / "reporte.json").write_text(json.dumps(reporte, ensure_ascii=False, indent=2), encoding="utf-8")

    if args.instalar:
        APP_ASSETS.mkdir(parents=True, exist_ok=True)
        shutil.copy2(out_dir / "lessa_signs.tflite", APP_ASSETS / "lessa_signs.tflite")
        (APP_ASSETS / "signs_labels.json").write_text(json.dumps(clases, ensure_ascii=False), encoding="utf-8")
        shutil.copy2(out_dir / "signs_meta.json", APP_ASSETS / "signs_meta.json")
        print(f"Instalado en la app ({APP_ASSETS}). Vuelve a compilar la APK.")

    print("\n" + "=" * 52)
    print(f"Precisión prueba: {acc:.4f}   TFLite: {acc_tfl:.4f}" + ("" if acc_espejo is None else f"   espejo: {acc_espejo:.4f}"))
    print("Más confundidas (real -> predicha):")
    for c, a, b in confusiones(cm, clases):
        print(f"  {a} -> {b}: {c}")
    if "promedio_persona_no_vista" in reporte:
        print(f"Persona no vista (promedio): {reporte['promedio_persona_no_vista']}")


if __name__ == "__main__":
    main()
