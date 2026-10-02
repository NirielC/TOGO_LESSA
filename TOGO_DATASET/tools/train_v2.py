"""
ENTRENAMIENTO v2: LSTM sobre pose + manos (258) y exportación a TFLite.

Hace en un solo paso lo que antes eran prepare_dataset + train + test:
  1. Carga dataset/landmarks_<versión> (crudo) y normaliza con togo_features.
  2. División estratificada 70/15/15 con la misma semilla que v1 (comparable).
  3. Aumento de datos SOLO en entrenamiento: espejo (zurdos), escala, ruido y
     desfase temporal leve.
  4. Entrena la misma arquitectura que v1 (2x LSTM 64 + Dense 64).
  5. Exporta a .tflite con forma fija (1, 30, 258) y verifica que NO usa
     Flex ops (si los usa, falla: en el teléfono no funcionarían).
  6. Prueba extra honesta: entrenar con 3 personas y evaluar con la 4.ª
     (--por-persona). Dice cuánto se generaliza a alguien que el modelo no vio.

Salidas en models/v2/: lessa_signs.keras, lessa_signs.tflite, labels.json,
reporte.json (precisión, matriz de confusión).
"""

import argparse
import json
import os
import sys
from pathlib import Path

os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "2")

import numpy as np

ROOT_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT_DIR))

from config import ALTO, ANCHO, CLASSES, LANDMARKS_DIR, MODELO_DIR, persona_de_archivo  # noqa: E402
from togo_features import FRAME_DIM, SEQ_LEN, mirror_sequence, normalize_sequence  # noqa: E402

OUT_DIR = MODELO_DIR
SEED = 42


def cargar():
    X, y, persona, clases = [], [], [], []
    for clase in CLASSES:
        files = sorted((LANDMARKS_DIR / clase).glob("*.npy"))
        if not files:
            print(f"  [omitida] {clase}: sin datos")
            continue
        idx = len(clases)
        clases.append(clase)
        for f in files:
            seq = np.load(f)
            if seq.shape != (SEQ_LEN, FRAME_DIM):
                continue
            X.append(normalize_sequence(seq, ANCHO, ALTO))
            y.append(idx)
            persona.append(persona_de_archivo(f.stem))
        print(f"  {clase}: {len(files)}")
    return np.stack(X), np.array(y), np.array(persona), clases


def aumentar(X, y, rng):
    """Copia espejada + una copia con perturbaciones leves."""
    out_x, out_y = [X], [y]
    out_x.append(np.stack([mirror_sequence(s) for s in X]))
    out_y.append(y)

    pert = []
    for s in X:
        s = s.copy()
        present = s != 0
        scale = rng.uniform(0.9, 1.1)
        shift = rng.normal(0, 0.05, size=3)
        # pose: x,y,z,vis -> solo x,y,z (visibility no se toca)
        pose = s[:, :132].reshape(SEQ_LEN, 33, 4).copy()
        pose[:, :, :3] = pose[:, :, :3] * scale + shift
        hands = s[:, 132:].reshape(SEQ_LEN, 42, 3)
        hands = hands * scale + shift + rng.normal(0, 0.01, size=hands.shape)
        coords = np.concatenate([pose.reshape(SEQ_LEN, -1), hands.reshape(SEQ_LEN, -1)], axis=1)
        coords = np.where(present, coords, 0.0)  # lo ausente sigue en cero
        # desfase temporal de hasta 2 frames (repite el borde)
        k = int(rng.integers(-2, 3))
        if k > 0:
            coords = np.concatenate([np.repeat(coords[:1], k, 0), coords[:-k]])
        elif k < 0:
            coords = np.concatenate([coords[-k:], np.repeat(coords[-1:], -k, 0)])
        pert.append(coords.astype(np.float32))
    out_x.append(np.stack(pert))
    out_y.append(y)
    return np.concatenate(out_x), np.concatenate(out_y)


def crear_modelo(n):
    import tensorflow as tf
    from tensorflow import keras
    from tensorflow.keras import layers

    m = keras.Sequential([
        keras.Input(shape=(SEQ_LEN, FRAME_DIM)),
        layers.LSTM(64, return_sequences=True),
        layers.Dropout(0.3),
        layers.LSTM(64),
        layers.Dropout(0.3),
        layers.Dense(64, activation="relu"),
        layers.Dropout(0.3),
        layers.Dense(n, activation="softmax"),
    ])
    m.compile(optimizer=keras.optimizers.Adam(1e-3), loss="sparse_categorical_crossentropy", metrics=["accuracy"])
    return m


def entrenar(Xtr, ytr, Xva, yva, n, epochs, verbose=1):
    import tensorflow as tf
    from tensorflow import keras

    tf.random.set_seed(SEED)
    m = crear_modelo(n)
    m.fit(
        Xtr, ytr, validation_data=(Xva, yva), epochs=epochs, batch_size=32, verbose=verbose,
        callbacks=[
            keras.callbacks.EarlyStopping(monitor="val_loss", patience=25, restore_best_weights=True),
            keras.callbacks.ReduceLROnPlateau(monitor="val_loss", factor=0.5, patience=8, min_lr=1e-5),
        ],
    )
    return m


def desenrollar(model, input_shape=(SEQ_LEN, FRAME_DIM)):
    """
    Copia del modelo con los LSTM desenrollados (unroll=True), mismos pesos.
    Con 30 pasos fijos, cada paso queda como ops simples (FULLY_CONNECTED,
    LOGISTIC, TANH, MUL, ADD): nada de bucles WHILE ni variables, que el
    intérprete de TFLite del teléfono no ejecuta bien.
    """
    from tensorflow import keras
    from tensorflow.keras import layers

    capas = [keras.Input(shape=input_shape, batch_size=1)]
    for l in model.layers:
        cfg = l.get_config()
        if isinstance(l, layers.LSTM):
            cfg["unroll"] = True
        capas.append(l.__class__.from_config(cfg))
    copia = keras.Sequential(capas)
    copia.set_weights(model.get_weights())
    return copia


def keras_export_archive(model, input_shape=(SEQ_LEN, FRAME_DIM)):
    from tensorflow import keras
    import tensorflow as tf

    exp = keras.export.ExportArchive()
    exp.track(model)
    exp.add_endpoint(
        name="serve",
        fn=lambda x: model(x, training=False),
        input_signature=[tf.TensorSpec([1, *input_shape], tf.float32, name="entrada")],
    )
    return exp


def exportar_tflite(model, ruta, input_shape=(SEQ_LEN, FRAME_DIM)):
    """Forma fija (1,30,258), solo ops nativas de TFLite (sin Flex)."""
    import tensorflow as tf

    plano = desenrollar(model, input_shape)

    # Vía SavedModel: el convertidor congela los pesos como constantes (con
    # from_concrete_functions quedaban como variables: READ_VARIABLE).
    import tempfile
    tmp = Path(tempfile.mkdtemp()) / "saved"
    exp = keras_export_archive(plano, input_shape)
    exp.write_out(str(tmp))
    conv = tf.lite.TFLiteConverter.from_saved_model(str(tmp))
    conv.target_spec.supported_ops = [tf.lite.OpsSet.TFLITE_BUILTINS]  # sin SELECT_TF_OPS = sin Flex
    tfl = conv.convert()
    Path(ruta).write_bytes(tfl)

    interp = tf.lite.Interpreter(model_content=tfl)
    ops = sorted({d["op_name"] for d in interp._get_ops_details()})
    prohibidas = [o for o in ops if o.lower().startswith("flex") or o in ("WHILE", "READ_VARIABLE", "VAR_HANDLE")]
    if prohibidas:
        raise RuntimeError(f"El .tflite usa ops no aptas para el teléfono: {prohibidas}")
    return tfl, ops


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--epochs", type=int, default=200)
    ap.add_argument("--por-persona", action="store_true", help="además, validación dejando una persona fuera")
    ap.add_argument("--solo-exportar", action="store_true", help="no entrena: carga models/v2/lessa_signs.keras")
    ap.add_argument("--instalar", action="store_true", help="copia el .tflite y las etiquetas a la app")
    args = ap.parse_args()

    from sklearn.metrics import confusion_matrix
    from sklearn.model_selection import train_test_split
    import tensorflow as tf

    print("Cargando landmarks v2...")
    X, y, persona, clases = cargar()
    print(f"Total: {X.shape}  clases: {len(clases)}")

    idx = np.arange(len(X))
    i_tr, i_tmp = train_test_split(idx, test_size=0.30, stratify=y, random_state=SEED)
    i_va, i_te = train_test_split(i_tmp, test_size=0.50, stratify=y[i_tmp], random_state=SEED)

    rng = np.random.default_rng(SEED)
    Xtr, ytr = aumentar(X[i_tr], y[i_tr], rng)
    print(f"Entrenamiento (aumentado): {Xtr.shape}  val: {len(i_va)}  test: {len(i_te)}")

    if args.solo_exportar:
        from tensorflow import keras
        model = keras.models.load_model(OUT_DIR / "lessa_signs.keras")
    else:
        model = entrenar(Xtr, ytr, X[i_va], y[i_va], len(clases), args.epochs)
    loss, acc = model.evaluate(X[i_te], y[i_te], verbose=0)
    pred = model.predict(X[i_te], verbose=0).argmax(1)
    cm = confusion_matrix(y[i_te], pred, labels=list(range(len(clases))))
    # Robustez: el mismo test en espejo (persona zurda / cámara volteada).
    Xte_m = np.stack([mirror_sequence(s) for s in X[i_te]])
    acc_mirror = float((model.predict(Xte_m, verbose=0).argmax(1) == y[i_te]).mean())

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    if not args.solo_exportar:
        model.save(OUT_DIR / "lessa_signs.keras")
    tfl, ops = exportar_tflite(model, OUT_DIR / "lessa_signs.tflite")

    # El .tflite debe dar lo mismo que Keras.
    interp = tf.lite.Interpreter(model_content=tfl)
    interp.allocate_tensors()
    inp, out = interp.get_input_details()[0], interp.get_output_details()[0]
    ok = 0
    for s, t in zip(X[i_te], y[i_te]):
        interp.set_tensor(inp["index"], s[None].astype(np.float32))
        interp.invoke()
        ok += int(interp.get_tensor(out["index"])[0].argmax() == t)
    acc_tflite = ok / len(i_te)

    reporte = {
        "precision_test_keras": round(float(acc), 4),
        "precision_test_tflite": round(acc_tflite, 4),
        "precision_test_espejo": round(acc_mirror, 4),
        "clases": clases,
        "matriz_confusion": cm.tolist(),
        "tflite_kb": round(len(tfl) / 1024, 1),
        "tflite_ops": ops,
        "entrada": [1, SEQ_LEN, FRAME_DIM],
    }

    if args.por_persona:
        por_persona = {}
        for p in sorted(set(persona) - {0}):
            tr = persona != p
            Xa, ya = aumentar(X[tr], y[tr], rng)
            m = entrenar(Xa, ya, X[~tr], y[~tr], len(clases), min(args.epochs, 80), verbose=0)
            por_persona[f"persona_{p}"] = round(float(m.evaluate(X[~tr], y[~tr], verbose=0)[1]), 4)
            print(f"  Persona {p} fuera: {por_persona[f'persona_{p}']}")
        reporte["precision_persona_no_vista"] = por_persona

    (OUT_DIR / "labels.json").write_text(json.dumps(clases, ensure_ascii=False, indent=2), encoding="utf-8")
    (OUT_DIR / "reporte.json").write_text(json.dumps(reporte, ensure_ascii=False, indent=2), encoding="utf-8")

    if args.instalar:
        import shutil
        assets = ROOT_DIR.parent / "TOGO_MOVIL" / "modules" / "togo-vision" / "android" / "src" / "main" / "assets"
        shutil.copy2(OUT_DIR / "lessa_signs.tflite", assets / "lessa_signs.tflite")
        (assets / "signs_labels.json").write_text(json.dumps(clases, ensure_ascii=False), encoding="utf-8")
        print(f"Instalado en la app: {assets}. Vuelve a compilar la APK.")

    print("\n" + "=" * 50)
    print(f"Precisión test  Keras: {acc:.4f}   TFLite: {acc_tflite:.4f}   espejo: {acc_mirror:.4f}")
    print(f"TFLite: {reporte['tflite_kb']} KB, ops: {', '.join(ops) or '(no listadas)'}")
    print("Matriz de confusión (filas = real):")
    for c, row in zip(clases, cm):
        print(f"  {c:>18} {row}")


if __name__ == "__main__":
    main()
