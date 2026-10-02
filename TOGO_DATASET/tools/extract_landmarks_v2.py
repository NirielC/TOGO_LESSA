"""
EXTRACCIÓN v2: pose + manos con MediaPipe Tasks (sin malla facial).

Mismos videos, mismo orden de frames, pero 258 valores por frame en vez de 1662
y con los mismos modelos .task que usará el teléfono (pose lite + hand).

Salida: dataset/landmarks_<versión>/<clase>/<video>.npy  -> (cuadros, 258) crudo.
(La versión y el número de cuadros salen de config.py.)
Ver togo_features.py para el formato y la normalización.

Uso:
    python tools/extract_landmarks_v2.py            # todo, en paralelo
    python tools/extract_landmarks_v2.py --workers 4
Se puede interrumpir y relanzar: omite lo que ya existe.
"""

import argparse
import json
import os
import sys
import time
from concurrent.futures import ProcessPoolExecutor, as_completed
from pathlib import Path

os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "3")
os.environ.setdefault("GLOG_minloglevel", "2")

ROOT_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT_DIR))

from config import CLASSES, FRAMES_POR_VIDEO, FPS, LANDMARKS_DIR, MODELS_DIR, VIDEOS_DIR  # noqa: E402

OUT_DIR = LANDMARKS_DIR
POSE_MODEL = MODELS_DIR / "mediapipe" / "pose_landmarker_lite.task"
HAND_MODEL = MODELS_DIR / "mediapipe" / "hand_landmarker.task"

# Umbrales iguales a los que usará el plugin del teléfono.
MIN_POSE_DET = 0.5
MIN_HAND_DET = 0.5
MIN_TRACK = 0.5

_pose = None
_hands = None


def _init_worker():
    global _pose, _hands
    import mediapipe as mp
    from mediapipe.tasks.python import BaseOptions, vision

    _pose = vision.PoseLandmarker.create_from_options(
        vision.PoseLandmarkerOptions(
            base_options=BaseOptions(model_asset_path=str(POSE_MODEL)),
            running_mode=vision.RunningMode.VIDEO,
            num_poses=1,
            min_pose_detection_confidence=MIN_POSE_DET,
            min_tracking_confidence=MIN_TRACK,
        )
    )
    _hands = vision.HandLandmarker.create_from_options(
        vision.HandLandmarkerOptions(
            base_options=BaseOptions(model_asset_path=str(HAND_MODEL)),
            running_mode=vision.RunningMode.VIDEO,
            num_hands=2,
            min_hand_detection_confidence=MIN_HAND_DET,
            min_tracking_confidence=MIN_TRACK,
        )
    )
    globals()["_mp"] = mp


# Los landmarkers en modo VIDEO exigen timestamps crecientes en toda su vida,
# no solo dentro de un video: cada video arranca donde terminó el anterior.
_clock_ms = 0


def _process(video_path: str, out_path: str):
    global _clock_ms
    import cv2
    import numpy as np
    from togo_features import FRAME_DIM, frame_from_results

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return video_path, "error", "no se pudo abrir", None
    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    frames = []
    step_ms = int(1000 / FPS)
    _clock_ms += 1000  # separación entre videos: el tracker no arrastra el anterior
    while len(frames) < FRAMES_POR_VIDEO:
        ok, bgr = cap.read()
        if not ok:
            break
        rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
        image = _mp.Image(image_format=_mp.ImageFormat.SRGB, data=rgb)
        _clock_ms += step_ms
        pose_r = _pose.detect_for_video(image, _clock_ms)
        hand_r = _hands.detect_for_video(image, _clock_ms)
        frames.append(frame_from_results(pose_r, hand_r))
    cap.release()

    if len(frames) != FRAMES_POR_VIDEO:
        return video_path, "error", f"{len(frames)} frames", None

    seq = np.stack(frames).astype(np.float32)
    assert seq.shape == (FRAMES_POR_VIDEO, FRAME_DIM)
    Path(out_path).parent.mkdir(parents=True, exist_ok=True)
    np.save(out_path, seq)

    hands_any = float((np.abs(seq[:, 132:]).sum(axis=1) > 0).mean())
    return video_path, "ok", f"{w}x{h}", hands_any


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--workers", type=int, default=max(1, (os.cpu_count() or 2) - 1))
    args = ap.parse_args()

    for m in (POSE_MODEL, HAND_MODEL):
        if not m.exists():
            sys.exit(f"Falta el modelo {m}")

    jobs = []
    for clase in CLASSES:
        for v in sorted((VIDEOS_DIR / clase).glob("*.mp4")):
            out = OUT_DIR / clase / f"{v.stem}.npy"
            if not out.exists():
                jobs.append((str(v), str(out)))

    print(f"Togo extracción v2 | pendientes: {len(jobs)} | procesos: {args.workers}", flush=True)
    t0 = time.time()
    done = errors = 0
    low_hands = []
    sizes = {}

    with ProcessPoolExecutor(max_workers=args.workers, initializer=_init_worker) as ex:
        futures = [ex.submit(_process, v, o) for v, o in jobs]
        for f in as_completed(futures):
            path, status, info, hands_ratio = f.result()
            done += 1
            if status != "ok":
                errors += 1
                print(f"  [ERROR] {path}: {info}", flush=True)
            else:
                sizes[info] = sizes.get(info, 0) + 1
                if hands_ratio < 0.3:
                    low_hands.append((path, round(hands_ratio, 2)))
            if done % 100 == 0 or done == len(jobs):
                rate = done / max(1e-6, time.time() - t0)
                eta = (len(jobs) - done) / max(rate, 1e-6)
                print(f"  {done}/{len(jobs)}  {rate:.1f} videos/s  ETA {eta/60:.1f} min", flush=True)

    report = {
        "procesados": done,
        "errores": errors,
        "resoluciones": sizes,
        "videos_con_pocas_manos": low_hands,
    }
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUT_DIR / "reporte_extraccion.json").write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Listo en {(time.time()-t0)/60:.1f} min. Errores: {errors}. "
          f"Videos con manos en <30% de frames: {len(low_hands)} (ver reporte_extraccion.json)")


if __name__ == "__main__":
    main()
