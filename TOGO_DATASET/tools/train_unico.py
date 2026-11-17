"""
ENTRENAMIENTO DEL MODELO ÚNICO: señas + 27 letras + "nada" en UN solo modelo.

Por qué: la app corría 3 modelos (señas, letras quietas, letras con movimiento),
cada uno con su propio softmax. Sus confianzas no se pueden comparar, y por eso
una seña y una letra parecidas se confundían (la app decidía con reglas de
tiempo y umbrales). Un solo modelo reparte la probabilidad entre TODAS las
clases a la vez: si duda entre "si" y la "S", lo dice.

  Entrada por cuadro (togo_features.build_features_unico), 447 valores:
    - las 384 del modelo v3 (pose + manos respecto a los hombros, forma de las
      dos manos, mano dominante normalizada),
    - + la forma de la mano que deletrea (hand_letter_features, 63): el detalle
      de los dedos que necesitan las letras.
  Ventana: 40 cuadros (2 s a 20 fps), igual que las tomas de la web.

  Datos: SOLO propios. Señas y "nada" de dataset/landmarks_v3 (capture_videos) y
  de las tomas de la web (dataset/web/senas); letras de dataset/web/letras
  (quietas) y dataset/web/letras_mov (con movimiento). Los 4000 videos originales
  del proyecto anterior no se usan (no hay permiso).

  Aumento de datos (solo entrenamiento):
    - Como train_senas: velocidad, corrimiento en la ventana, tamaño/posición/ruido.
    - DELETREO: cada letra se pega entre otras letras de la misma persona, como al
      deletrear un nombre: [letra anterior][transición][LETRA 0.5 a 2 s][transición]
      [letra siguiente]. La letra queda cubriendo el centro de la ventana: el
      modelo aprende a decir la letra que se sostiene en el centro.
    - Una parte de las ventanas centradas en una TRANSICIÓN entre dos letras va a
      "nada" (--transiciones): así una letra doble (LL, NN) se puede separar y el
      paso de una letra a otra no inventa letras.

  Salidas (models/<versión>/): lessa_unico.keras, lessa_unico.tflite,
  unico_labels.json, unico_meta.json (formato para la app) y reporte_unico.json:
  precisión total y por grupo (señas / letras / letras con movimiento / nada),
  matriz de confusión, confusiones seña<->letra, precisión en deletreo, efecto de
  la capa de contexto y (con --por-persona) precisión con persona no vista.

Uso:
    python tools/train_unico.py                     # datos reales (v3 + web)
    python tools/train_unico.py --por-persona       # + precisión con persona no vista
    python tools/train_unico.py --comparar          # + compara con los 3 modelos de la app
    python tools/train_unico.py --instalar          # + copia el modelo a la app
    python tools/train_unico.py --sintetico --epochs 15   # prueba de punta a punta con datos inventados

Ver docs/modelo-unico.md.
"""

import argparse
import json
import os
import shutil
import sys
import tempfile
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path

os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "2")

import numpy as np

ROOT_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT_DIR))
sys.path.insert(0, str(ROOT_DIR / "tools"))

from config import ALTO, ANCHO, CLASSES, FPS, LANDMARKS_DIR, LETRAS, MODELO_DIR, VERSION, WEB_DIR, persona_de_archivo  # noqa: E402
from togo_contexto import Contexto  # noqa: E402
from togo_features import (  # noqa: E402
    FRAME_DIM, HAND_DIM, POSE_DIM, SEQ_LEN, UNICO_DIM, build_features_unico, build_features_v3, hand_letter_features,
    normalize_sequence,
)
from train_senas import SEED, ajustar_largo, aumentar, confusiones, perturbar  # noqa: E402

APP_ASSETS = ROOT_DIR.parent / "TOGO_MOVIL" / "modules" / "togo-vision" / "android" / "src" / "main" / "assets"
NADA = "nada"
LETRAS_MODELO = [l for l in LETRAS if not l.startswith("_")]
MIN_TOMAS = 6          # una clase con menos tomas no se puede repartir en entrenamiento/validación/prueba
# Umbrales de la app (settings.tsx) para la "decisión": lo que de verdad se confirmaría.
UMBRAL = {"sena": 0.82, "letra": 0.75}
MARGEN = 0.2


@dataclass
class Toma:
    raw: np.ndarray      # (SEQ_LEN, 258) crudo
    clase: str           # "hola", "A", "Ñ", "nada"...
    tipo: str            # "sena" | "nada" | "letra" | "letra_mov"
    persona: int
    origen: str          # "v3" | "web"


def al_largo(raw, largo):
    """Como ajustar_largo, pero a cualquier largo (los modelos actuales pueden usar 30 o 40)."""
    T = len(raw)
    if T == largo:
        return raw
    if T > largo:
        ini = (T - largo) // 2
        return raw[ini:ini + largo]
    izq = (largo - T) // 2
    return np.concatenate([np.repeat(raw[:1], izq, 0), raw, np.repeat(raw[-1:], largo - T - izq, 0)])


def tipo_de(clase, letras_mov=()):
    if clase == NADA:
        return "nada"
    if clase in LETRAS_MODELO:
        return "letra_mov" if clase in letras_mov else "letra"
    return "sena"


# ------------------------------------------------------------------ datos

def _leer(f):
    try:
        raw = np.load(f)
    except Exception as e:  # archivo dañado: se avisa y se sigue
        print(f"  [no se pudo leer] {f.name}: {e}")
        return None
    if raw.ndim != 2 or raw.shape[1] != FRAME_DIM or len(raw) < SEQ_LEN * 0.6:
        return None
    return ajustar_largo(raw.astype(np.float32))


def cargar_tomas(landmarks_dir=LANDMARKS_DIR, web_dir=WEB_DIR):
    """Todas las tomas propias: señas y "nada" (v3 + web) y letras (web)."""
    tomas = []
    web_dir = Path(web_dir)
    for clase in CLASSES:
        for d, origen in ((Path(landmarks_dir), "v3"), (web_dir / "senas", "web")):
            for f in sorted((d / clase).glob("*.npy")):
                raw = _leer(f)
                if raw is not None:
                    tomas.append(Toma(raw, clase, "nada" if clase == NADA else "sena", persona_de_archivo(f.stem), origen))
    for sub, tipo in (("letras", "letra"), ("letras_mov", "letra_mov")):
        base = web_dir / sub
        for d in sorted(p for p in base.iterdir() if p.is_dir()) if base.exists() else []:
            letra = "Ñ" if d.name == "NN" else d.name
            clase, t = (NADA, "nada") if letra in ("_nada", NADA) else (letra, tipo)
            if clase != NADA and clase not in LETRAS_MODELO:
                print(f"  [omitida] carpeta {sub}/{d.name}: no es una letra")
                continue
            for f in sorted(d.glob("*.npy")):
                raw = _leer(f)
                if raw is not None:
                    tomas.append(Toma(raw, clase, t, persona_de_archivo(f.stem), "web"))
    return tomas


def ordenar_clases(tomas, minimo=MIN_TOMAS):
    """Señas (orden de config.CLASSES), letras (orden del abecedario) y "nada" al final.
    Las clases con menos de `minimo` tomas quedan fuera (se avisa)."""
    n = defaultdict(int)
    for t in tomas:
        n[t.clase] += 1
    for c in sorted(n):
        if n[c] < minimo:
            print(f"  [omitida] {c}: solo {n[c]} tomas (mínimo {minimo})")
    ok = {c for c in n if n[c] >= minimo}
    return [c for c in CLASSES if c != NADA and c in ok] + [l for l in LETRAS_MODELO if l in ok] + ([NADA] if NADA in ok else [])


def features(raw):
    return build_features_unico(raw, ANCHO, ALTO)


# ------------------------------------------------------------------ deletreo (aumento a nivel crudo)

_BLOQUES = [(0, POSE_DIM), (POSE_DIM, POSE_DIM + HAND_DIM), (POSE_DIM + HAND_DIM, FRAME_DIM)]


def _hombros(raw):
    """(centro (x, y) en 0..1, ancho en píxeles) medianos de una secuencia, o None."""
    ls, rs = raw[:, 44:46], raw[:, 48:50]   # puntos 11 y 12 de la pose
    ok = (np.abs(ls).sum(1) > 0) & (np.abs(rs).sum(1) > 0)
    if not ok.any():
        return None
    ancho = float(np.median(np.hypot((ls[ok, 0] - rs[ok, 0]) * ANCHO, (ls[ok, 1] - rs[ok, 1]) * ALTO)))
    return (np.median((ls[ok] + rs[ok]) / 2, axis=0), ancho) if ancho >= 1 else None


def alinear(seg, ref):
    """Lleva `seg` (cuadros de otra toma) al lugar y tamaño del cuerpo de `ref`: al
    pegar letras de tomas distintas, el cuerpo no salta."""
    a, b = _hombros(seg), _hombros(ref)
    if a is None or b is None:
        return seg
    (ca, wa), (cb, wb) = a, b
    k = wb / wa
    s = np.array(seg, dtype=np.float32, copy=True)
    pose = s[:, :POSE_DIM].reshape(len(s), 33, 4).copy()
    manos = s[:, POSE_DIM:].reshape(len(s), 42, 3).copy()
    for arr in (pose, manos):
        pres = np.abs(arr[..., :3]).sum(-1) > 0
        for eje in (0, 1):
            arr[..., eje] = np.where(pres, (arr[..., eje] - ca[eje]) * k + cb[eje], 0)
        arr[..., 2] = np.where(pres, arr[..., 2] * k, 0)
    s[:, :POSE_DIM] = pose.reshape(len(s), -1)
    s[:, POSE_DIM:] = manos.reshape(len(s), -1)
    return s


def transicion(a, b, n):
    """n cuadros de paso suave del cuadro `a` al `b`. Una mano que solo está en uno de
    los dos aparece (o se va) a mitad de camino; nunca se mezcla con ceros."""
    out = np.zeros((n, FRAME_DIM), np.float32)
    for i in range(n):
        t = (i + 1) / (n + 1)
        t = t * t * (3 - 2 * t)
        for ini, fin in _BLOQUES:
            pa, pb = bool(np.any(a[ini:fin])), bool(np.any(b[ini:fin]))
            if pa and pb:
                out[i, ini:fin] = (1 - t) * a[ini:fin] + t * b[ini:fin]
            elif pa or pb:
                out[i, ini:fin] = (a if t < 0.5 else b)[ini:fin]
    return out


def tramo_letra(raw, tipo):
    """Los cuadros que de verdad son la letra (al empezar la toma la mano sube)."""
    T = len(raw)
    a, b = (0.25, 0.9) if tipo == "letra" else (0.15, 0.95)
    seg = raw[int(T * a):max(int(T * a) + 2, int(T * b))]
    con_mano = np.abs(seg[:, POSE_DIM:]).sum(1) > 0
    return seg[con_mano] if con_mano.sum() >= 2 else seg


def estirar(seg, n, rng, quieta=True):
    """`seg` llevado a n cuadros. Quieta: un pedazo al azar recorrido despacio (la letra
    sostenida); con movimiento: todo el movimiento, más rápido o más lento."""
    if n <= 0:
        return np.zeros((0, FRAME_DIM), np.float32)
    L = len(seg)
    if quieta:
        i0 = rng.uniform(0, L - 1)
        idx = np.linspace(i0, rng.uniform(i0, L - 1), n)
    else:
        idx = np.linspace(0, L - 1, n)
    return seg[np.clip(np.round(idx).astype(int), 0, L - 1)]


def _relleno(otra, borde, m, rng, antes):
    """m cuadros junto a la letra: otra letra sostenida y la transición hacia/desde `borde`."""
    if m <= 0:
        return np.zeros((0, FRAME_DIM), np.float32)
    if otra is None or len(otra) == 0:          # empieza/termina la palabra: la mano sigue en la letra
        return np.repeat(borde[None], m, 0)
    k = min(m, int(rng.integers(2, 7)))         # 0.1 a 0.3 s de transición
    sost = estirar(otra, m - k, rng)
    if antes:
        return np.concatenate([sost, transicion(sost[-1] if len(sost) else otra[-1], borde, k)])
    return np.concatenate([transicion(borde, sost[0] if len(sost) else otra[0], k), sost])


def componer_deletreo(obj, antes, despues, T, rng):
    """
    Ventana de T cuadros como al deletrear: [anterior][transición][LETRA][transición][siguiente].
    obj: (n, 258) cuadros de la letra (0.5 a 2 s); queda cubriendo el centro de la ventana.
    antes/despues: cuadros de otras letras (ya alineados) o None (empieza/termina la palabra).
    """
    n = min(len(obj), T)
    obj = obj[:n]
    c = T // 2
    lo, hi = max(0, c - n + 2), min(c - 1, T - n)
    s = int(rng.integers(lo, hi + 1)) if hi >= lo else max(0, min(c - n // 2, T - n))
    return np.concatenate([
        _relleno(antes, obj[0], s, rng, antes=True), obj, _relleno(despues, obj[-1], T - s - n, rng, antes=False),
    ]).astype(np.float32)


def componer_transicion(antes, despues, T, rng):
    """Ventana centrada en el paso de una letra a otra: no es ninguna letra -> "nada"."""
    k = int(rng.integers(4, 9))
    s = T // 2 - k // 2
    a, d = estirar(antes, s, rng), estirar(despues, T - s - k, rng)
    return np.concatenate([a, transicion(a[-1], d[0], k), d]).astype(np.float32)


def ventanas_deletreo(letras, rng, copias, T=SEQ_LEN, transiciones=0.0, sin_vecina=0.2):
    """
    Para cada toma de letra, `copias` ventanas de deletreo con otras letras de la misma
    persona (si no hay, de cualquiera). Devuelve (crudos, clases); las ventanas de
    transición (fracción `transiciones` del total de letras) vienen con clase "nada".
    """
    por_persona = defaultdict(list)
    for t in letras:
        por_persona[t.persona].append(t)

    def vecina(t):
        if rng.random() < sin_vecina:
            return None
        otras = [o for o in por_persona[t.persona] if o.clase != t.clase] or [o for o in letras if o.clase != t.clase]
        if not otras:
            return None
        o = otras[int(rng.integers(len(otras)))]
        return alinear(tramo_letra(o.raw, o.tipo), t.raw)

    crudos, clases = [], []
    for t in letras:
        tramo = tramo_letra(t.raw, t.tipo)
        for _ in range(copias):
            n = int(rng.integers(int(0.5 * FPS), int(2 * FPS) + 1))   # 0.5 a 2 s
            obj = estirar(tramo, n, rng, quieta=t.tipo == "letra")
            crudos.append(componer_deletreo(obj, vecina(t), vecina(t), T, rng))
            clases.append(t.clase)
    n_trans = int(round(transiciones * len(letras)))
    for _ in range(n_trans):
        t = letras[int(rng.integers(len(letras)))]
        otra = None
        for _ in range(5):
            otra = vecina(t)
            if otra is not None:
                break
        if otra is None:
            continue
        crudos.append(componer_transicion(tramo_letra(t.raw, t.tipo), otra, T, rng))
        clases.append(NADA)
    return crudos, clases


# ------------------------------------------------------------------ armar los conjuntos

def armar_entrenamiento(tomas, clases, rng, copias=4, copias_deletreo=4, transiciones=0.3):
    """Tomas de entrenamiento -> (X aumentado (N, T, 447), y). Las letras suman ventanas de deletreo."""
    idx = {c: i for i, c in enumerate(clases)}
    tomas = [t for t in tomas if t.clase in idx]
    X = np.stack([features(t.raw) for t in tomas])
    y = np.array([idx[t.clase] for t in tomas])
    Xa, ya = aumentar(X, y, "v3", rng, copias)      # "v3": la mano dominante ya está normalizada, sin espejo
    letras = [t for t in tomas if t.tipo in ("letra", "letra_mov")]
    if letras and copias_deletreo > 0:
        trans = transiciones if NADA in idx else 0.0
        crudos, cl = ventanas_deletreo(letras, rng, copias_deletreo, transiciones=trans)
        Xd = np.stack([perturbar(features(r), rng) for r in crudos])
        Xa = np.concatenate([Xa, Xd])
        ya = np.concatenate([ya, np.array([idx[c] for c in cl])])
    return Xa, ya


def armar_prueba(tomas, clases):
    idx = {c: i for i, c in enumerate(clases)}
    tomas = [t for t in tomas if t.clase in idx]
    return np.stack([features(t.raw) for t in tomas]), np.array([idx[t.clase] for t in tomas]), tomas


# ------------------------------------------------------------------ evaluación

def grupo(tipo):
    return {"sena": "senas", "nada": "nada", "letra": "letras", "letra_mov": "letras_mov"}[tipo]


def decidir_top(top, tipos):
    """top [(clase, prob)] de mayor a menor -> lo que confirmaría la app: la 1.ª opción si
    pasa el umbral de su tipo y el margen sobre la 2.ª; si no, "nada"."""
    c, p1 = top[0]
    if c == NADA:
        return NADA
    umbral = UMBRAL["letra"] if tipos.get(c, "sena").startswith("letra") else UMBRAL["sena"]
    p2 = top[1][1] if len(top) > 1 else 0.0
    return c if p1 >= umbral and p1 - p2 >= MARGEN else NADA


def decidir(p, clases, tipos):
    o = np.argsort(-p)[:3]
    return decidir_top([(clases[i], float(p[i])) for i in o], tipos)


def resumen(pred, verdad, tomas):
    """Precisión total, por grupo y cuántas veces se cruzó seña <-> letra."""
    pred, verdad = list(pred), list(verdad)
    ok = [a == b for a, b in zip(pred, verdad)]
    por = defaultdict(list)
    for o, t in zip(ok, tomas):
        por[grupo(t.tipo)].append(o)
    es_letra = lambda c: c in LETRAS_MODELO  # noqa: E731
    cruces = sum(1 for a, b in zip(pred, verdad) if a != NADA and b != NADA and es_letra(a) != es_letra(b))
    return {
        "precision": round(float(np.mean(ok)), 4) if ok else None,
        "por_grupo": {g: round(float(np.mean(v)), 4) for g, v in sorted(por.items())},
        "confusiones_sena_letra": int(cruces),
        "n": len(ok),
    }


def evaluar_contexto(P, y, clases, ctx, tipos=None):
    """
    Efecto de la capa de contexto sobre las predicciones de prueba (top-3 reordenado):
      - a favor: lo de antes apoya la clase correcta (p. ej. "hola" antes de "como_estas"),
      - en contra: lo de antes apoya OTRA clase y no la correcta (el peor caso).
    En las mismas muestras se compara, sin y con contexto, la 1.ª opción y (con `tipos`)
    la DECISIÓN: lo que la app confirmaría con sus umbrales (un "nada" cuenta como no acierto
    salvo que la clase sea "nada").
    """
    tipos = tipos or {}
    claves = sorted({k for previos, _ in ctx.reglas for k in previos})
    # [n, 1.ª sin, 1.ª con, decisión sin, decisión con]
    r = {"a_favor": [0, 0, 0, 0, 0], "en_contra": [0, 0, 0, 0, 0]}
    cambios = 0
    for p, t in zip(P, y):
        verdad = clases[t]
        orden = np.argsort(-p)[:3]
        top = [(clases[i], float(p[i])) for i in orden]
        apoyo = {k: ctx.apoyo(verdad, [k]) for k in claves}
        k_fav = max(claves, key=lambda k: apoyo[k]) if claves and max(apoyo.values()) > 0 else None
        contra = [k for k in claves if apoyo[k] == 0 and any(ctx.apoyo(e, [k]) > 0 for e, _ in top if e != verdad)]
        k_contra = max(contra, key=lambda k: max(ctx.apoyo(e, [k]) for e, _ in top if e != verdad)) if contra else None
        for nombre, k in (("a_favor", k_fav), ("en_contra", k_contra)):
            if k is None:
                continue
            nuevo, cambio = ctx.reordenar(top, [k])
            cambios += int(cambio)
            v = r[nombre]
            v[0] += 1
            v[1] += int(top[0][0] == verdad)
            v[2] += int(nuevo[0][0] == verdad)
            v[3] += int(decidir_top(top, tipos) == verdad)
            v[4] += int(decidir_top(nuevo, tipos) == verdad)
    out = {}
    for nombre, (n, a, b, c, d) in r.items():
        q = lambda x: round(x / n, 4) if n else None  # noqa: E731
        out[nombre] = {"muestras": n, "sin_contexto": q(a), "con_contexto": q(b), "decision_sin": q(c), "decision_con": q(d)}
    out["reordenamientos"] = cambios
    return out


def barrido_fuerza(P, y, clases, tipos, fuerzas=(1.0, 1.5, 2.0, 3.0)):
    """El mismo efecto con otras fuerzas (para ajustar "fuerza" en contexto.json con datos reales)."""
    from togo_contexto import cargar_tabla

    out = {}
    for f in fuerzas:
        tabla = dict(cargar_tabla(), fuerza=f)
        e = evaluar_contexto(P, y, clases, Contexto(tabla), tipos)
        out[str(f)] = {"a_favor_decision": e["a_favor"]["decision_con"], "en_contra_decision": e["en_contra"]["decision_con"]}
    return out


class ModelosActuales:
    """Los 3 modelos de hoy (señas, letras quietas, letras con movimiento) con la
    regla de la app para elegir, para comparar en las mismas tomas de prueba."""

    def __init__(self, carpeta):
        import tensorflow as tf

        carpeta = Path(carpeta)
        self.m = {}
        for nombre, modelo, etiquetas in (
            ("senas", "lessa_signs.tflite", "signs_labels.json"),
            ("letras", "lessa_letters.tflite", "letters_labels.json"),
            ("letras_mov", "lessa_letters_motion.tflite", "letters_motion_labels.json"),
        ):
            if (carpeta / modelo).exists() and (carpeta / etiquetas).exists():
                it = tf.lite.Interpreter(model_path=str(carpeta / modelo))
                it.allocate_tensors()
                et = [NADA if e == "_nada" else e for e in json.loads((carpeta / etiquetas).read_text(encoding="utf-8"))]
                self.m[nombre] = (it, et)
        if "senas" not in self.m:
            raise FileNotFoundError(f"No está lessa_signs.tflite en {carpeta}")
        meta = carpeta / "signs_meta.json"
        self.meta = json.loads(meta.read_text(encoding="utf-8")) if meta.exists() else {"seq_len": 30, "features": "v2"}

    def _correr(self, nombre, x):
        it, et = self.m[nombre]
        ent, sal = it.get_input_details()[0], it.get_output_details()[0]
        it.set_tensor(ent["index"], np.asarray(x, np.float32)[None])
        it.invoke()
        return it.get_tensor(sal["index"])[0], et

    @staticmethod
    def _top(p, et):
        o = np.argsort(-p)
        return et[o[0]], float(p[o[0]]), float(p[o[0]] - (p[o[1]] if len(o) > 1 else 0))

    def decidir(self, raw):
        """Igual que SignEngine + ConversationProvider (aprox.): primero la seña; si no hay
        seña segura, la letra (con movimiento si las muñecas se mueven, si no la quieta)."""
        largo = self.meta.get("seq_len", 30)
        r = al_largo(raw, largo)
        x = build_features_v3(r, ANCHO, ALTO) if self.meta.get("features") == "v3" else normalize_sequence(r, ANCHO, ALTO)
        sena, conf, margen = self._top(*self._correr("senas", x))
        if sena != NADA and conf >= UMBRAL["sena"] and margen >= MARGEN:
            return sena
        cands = []
        if "letras" in self.m:
            fs = [f for f in (hand_letter_features(c, ANCHO, ALTO) for c in r[len(r) // 3:]) if f is not None]
            if fs:
                p = np.mean([self._correr("letras", f)[0] for f in fs], 0)
                cands.append(("quieta",) + self._top(p, self.m["letras"][1]))
        if "letras_mov" in self.m:
            cands.append(("mov",) + self._top(*self._correr("letras_mov", build_features_v3(r, ANCHO, ALTO))))
        if not cands:
            return NADA
        if len(cands) == 2:
            mov = self._movimiento(r)
            q, m = cands
            _, letra, conf, margen = m if (mov > 0.08 and m[2] >= q[2]) else q
        else:
            _, letra, conf, margen = cands[0]
        return letra if letra != NADA and conf >= UMBRAL["letra"] and margen >= MARGEN else NADA

    @staticmethod
    def _movimiento(raw):
        """Movimiento medio de las muñecas en la segunda mitad (como motionEma en el teléfono)."""
        n = normalize_sequence(raw, ANCHO, ALTO)
        ema, prev = 0.0, None
        for f in n[len(n) // 2:]:
            if prev is not None:
                m = []
                for k in (POSE_DIM, POSE_DIM + HAND_DIM):
                    if np.any(prev[k:k + 2]) and np.any(f[k:k + 2]):
                        m.append(float(np.hypot(*(prev[k:k + 2] - f[k:k + 2]))))
                ema = 0.6 * ema + 0.4 * (float(np.mean(m)) if m else 0.0)
            prev = f
        return ema


# ------------------------------------------------------------------ entrenamiento

def entrenar_unico(Xtr, ytr, Xva, yva, n, epochs, verbose=2):
    from train_senas import entrenar
    return entrenar(Xtr, ytr, Xva, yva, n, epochs, verbose=verbose)


def main():
    ap = argparse.ArgumentParser(description="Entrena el modelo único (señas + letras + nada).")
    ap.add_argument("--epochs", type=int, default=150)
    ap.add_argument("--copias", type=int, default=4, help="copias aumentadas por toma (velocidad, corrimiento, ruido)")
    ap.add_argument("--copias-deletreo", type=int, default=4, help="ventanas de deletreo por toma de letra")
    ap.add_argument("--transiciones", type=float, default=0.3,
                    help="ventanas de transición entre letras -> 'nada', como fracción de las tomas de letra")
    ap.add_argument("--por-persona", action="store_true", help="precisión dejando fuera a cada persona")
    ap.add_argument("--comparar", action="store_true", help="compara con los 3 modelos actuales de la app")
    ap.add_argument("--actuales", default=str(APP_ASSETS), help="carpeta con los modelos actuales (por defecto, los de la app)")
    ap.add_argument("--instalar", action="store_true", help="copia el modelo, etiquetas y formato a la app")
    ap.add_argument("--salida", default=None, help="carpeta de salida (por defecto models/<versión>)")
    ap.add_argument("--sintetico", action="store_true", help="prueba con datos INVENTADOS (no instala nada)")
    ap.add_argument("--tomas-sinteticas", type=int, default=6, help="con --sintetico: tomas por clase y persona")
    args = ap.parse_args()

    if VERSION == "v2":
        sys.exit("TOGO_VERSION=v2 son los videos originales: no se usan. Entrena con v3 (las tomas propias).")
    if args.sintetico and args.instalar:
        sys.exit("--sintetico es solo para probar el script: un modelo de datos inventados no se instala en la app.")

    from sklearn.metrics import confusion_matrix
    from sklearn.model_selection import train_test_split
    import tensorflow as tf
    from train_v2 import exportar_tflite

    datos_tmp = None
    if args.sintetico:
        import datos_sinteticos
        datos_tmp = Path(tempfile.mkdtemp(prefix="togo_unico_datos_"))   # se borra al terminar
        lm_dir, web_dir = datos_sinteticos.generar(datos_tmp, args.tomas_sinteticas)
        out_dir = Path(args.salida) if args.salida else Path(tempfile.gettempdir()) / "togo_unico_sintetico"
    else:
        lm_dir, web_dir = LANDMARKS_DIR, WEB_DIR
        out_dir = Path(args.salida) if args.salida else MODELO_DIR

    print(f"Modelo único · dataset {VERSION} ({SEQ_LEN} cuadros, {UNICO_DIM} valores por cuadro)")
    tomas = cargar_tomas(lm_dir, web_dir)
    if not tomas:
        sys.exit(f"No hay tomas en {lm_dir} ni en {web_dir}. Sincroniza la web (tools/sincronizar_web.py) o "
                 "prueba el script con --sintetico.")
    clases = ordenar_clases(tomas)
    tomas = [t for t in tomas if t.clase in clases]
    if len(clases) < 2:
        sys.exit("Hacen falta al menos 2 clases con tomas suficientes.")
    letras_mov = sorted({t.clase for t in tomas if t.tipo == "letra_mov"})
    tipos = {c: tipo_de(c, letras_mov) for c in clases}
    cuenta = defaultdict(int)
    for t in tomas:
        cuenta[t.clase] += 1
    personas = sorted({t.persona for t in tomas})
    print(f"Tomas: {len(tomas)} · clases: {len(clases)} · personas: {personas}")
    print("  " + " ".join(f"{c}:{cuenta[c]}" for c in clases))

    y_all = np.array([clases.index(t.clase) for t in tomas])
    i_tr, i_tmp = train_test_split(np.arange(len(tomas)), test_size=0.30, stratify=y_all, random_state=SEED)
    i_va, i_te = train_test_split(i_tmp, test_size=0.50, stratify=y_all[i_tmp], random_state=SEED)
    rng = np.random.default_rng(SEED)
    Xtr, ytr = armar_entrenamiento([tomas[i] for i in i_tr], clases, rng, args.copias, args.copias_deletreo, args.transiciones)
    Xva, yva, _ = armar_prueba([tomas[i] for i in i_va], clases)
    Xte, yte, tomas_te = armar_prueba([tomas[i] for i in i_te], clases)
    print(f"Entrenamiento (aumentado): {Xtr.shape}  val: {len(Xva)}  prueba: {len(Xte)}")

    model = entrenar_unico(Xtr, ytr, Xva, yva, len(clases), args.epochs)
    P = model.predict(Xte, verbose=0)
    pred = P.argmax(1)
    cm = confusion_matrix(yte, pred, labels=list(range(len(clases))))
    top1 = resumen([clases[i] for i in pred], [clases[i] for i in yte], tomas_te)
    decision = resumen([decidir(p, clases, tipos) for p in P], [clases[i] for i in yte], tomas_te)

    # Deletreo de prueba: ventanas armadas SOLO con letras de prueba.
    letras_te = [t for t in tomas_te if t.tipo in ("letra", "letra_mov")]
    deletreo = None
    if letras_te:
        crudos, cl = ventanas_deletreo(letras_te, np.random.default_rng(SEED + 1), 2)
        Pd = model.predict(np.stack([features(r) for r in crudos]), verbose=0)
        deletreo = {"precision": round(float(np.mean([clases[i] == c for i, c in zip(Pd.argmax(1), cl)])), 4), "ventanas": len(cl)}

    contexto = evaluar_contexto(P, yte, clases, Contexto(), tipos)
    contexto["barrido_fuerza"] = barrido_fuerza(P, yte, clases, tipos)

    out_dir.mkdir(parents=True, exist_ok=True)
    model.save(out_dir / "lessa_unico.keras")
    tfl, ops = exportar_tflite(model, out_dir / "lessa_unico.tflite", input_shape=(SEQ_LEN, UNICO_DIM))
    interp = tf.lite.Interpreter(model_content=tfl)
    interp.allocate_tensors()
    ent, sal = interp.get_input_details()[0], interp.get_output_details()[0]
    ok = 0
    for s, t in zip(Xte, yte):
        interp.set_tensor(ent["index"], s[None].astype(np.float32))
        interp.invoke()
        ok += int(interp.get_tensor(sal["index"])[0].argmax() == t)
    acc_tfl = ok / len(Xte)

    meta = {
        "seq_len": SEQ_LEN, "frame_dim": UNICO_DIM, "features": "unico", "canonical": True, "fps": FPS,
        "letter_dim": HAND_DIM, "no_sign": NADA if NADA in clases else None,
        "letters": [c for c in clases if tipos[c].startswith("letra")],
        "signs": [c for c in clases if tipos[c] == "sena"],
    }
    reporte = {
        "dataset": VERSION, "sintetico": args.sintetico, "features": "unico",
        "tomas_por_clase": {c: cuenta[c] for c in clases}, "personas": personas,
        "prueba_top1": top1,
        "prueba_decision": decision,
        "precision_tflite": round(acc_tfl, 4),
        "deletreo": deletreo,
        "contexto": contexto,
        "clases": clases, "matriz_confusion": cm.tolist(),
        "mas_confundidas": [f"{a} -> {b}: {c}" for c, a, b in confusiones(cm, clases, top=10)],
        "tflite_kb": round(len(tfl) / 1024, 1), "tflite_ops": ops, "formato": meta,
    }

    if args.comparar:
        try:
            actuales = ModelosActuales(args.actuales)
            pa = [actuales.decidir(t.raw) for t in tomas_te]
            reporte["comparacion"] = {
                "nota": "Mismas tomas de prueba. 'decision' = lo que se confirmaría con los umbrales de la app. "
                        "Si los modelos actuales se entrenaron con alguna de estas tomas, su número sale inflado.",
                "actuales_decision": resumen(pa, [t.clase for t in tomas_te], tomas_te),
                "unico_decision": decision,
            }
        except Exception as e:
            print(f"  (No se pudo comparar con los modelos actuales: {e})")
            reporte["comparacion"] = {"error": str(e)}

    if args.por_persona:
        pp = {}
        for p in [q for q in personas if q != 0]:
            fuera = [t for t in tomas if t.persona == p]
            dentro = [t for t in tomas if t.persona != p]
            cl_dentro = {t.clase for t in dentro}
            if len(personas) < 2 or not fuera or len(cl_dentro) < len(clases):
                print(f"  Persona {p}: se omite (las demás no tienen todas las clases)")
                continue
            yd = np.array([clases.index(t.clase) for t in dentro])
            try:
                a_tr, a_va = train_test_split(np.arange(len(dentro)), test_size=0.15, stratify=yd, random_state=SEED)
            except ValueError:
                a_tr, a_va = train_test_split(np.arange(len(dentro)), test_size=0.15, random_state=SEED)
            Xa, ya = armar_entrenamiento([dentro[i] for i in a_tr], clases, rng, args.copias, args.copias_deletreo, args.transiciones)
            Xv, yv, _ = armar_prueba([dentro[i] for i in a_va], clases)
            m = entrenar_unico(Xa, ya, Xv, yv, len(clases), min(args.epochs, 80), verbose=0)
            Xf, yf, tf_ = armar_prueba(fuera, clases)
            r = resumen([clases[i] for i in m.predict(Xf, verbose=0).argmax(1)], [clases[i] for i in yf], tf_)
            pp[f"persona_{p}"] = r
            print(f"  Persona {p} no vista: {r['precision']} {r['por_grupo']}")
        reporte["persona_no_vista"] = pp
        vals = [r["precision"] for r in pp.values() if r["precision"] is not None]
        reporte["promedio_persona_no_vista"] = round(float(np.mean(vals)), 4) if vals else None

    (out_dir / "unico_labels.json").write_text(json.dumps(clases, ensure_ascii=False, indent=2), encoding="utf-8")
    (out_dir / "unico_meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
    (out_dir / "reporte_unico.json").write_text(json.dumps(reporte, ensure_ascii=False, indent=2), encoding="utf-8")

    if args.instalar:
        APP_ASSETS.mkdir(parents=True, exist_ok=True)
        shutil.copy2(out_dir / "lessa_unico.tflite", APP_ASSETS / "lessa_unico.tflite")
        (APP_ASSETS / "unico_labels.json").write_text(json.dumps(clases, ensure_ascii=False), encoding="utf-8")
        shutil.copy2(out_dir / "unico_meta.json", APP_ASSETS / "unico_meta.json")
        print(f"Instalado en la app ({APP_ASSETS}). La app lo usa en vez de los 3 modelos. Vuelve a compilar la APK.")

    print("\n" + "=" * 60)
    print(f"Salida: {out_dir}")
    print(f"Prueba (1.ª opción): {top1['precision']}  {top1['por_grupo']}  · TFLite: {acc_tfl:.4f}")
    print(f"Prueba (decisión con umbrales de la app): {decision['precision']}  {decision['por_grupo']}")
    print(f"Confusiones seña<->letra: {top1['confusiones_sena_letra']}")
    if deletreo:
        print(f"Deletreo (letra entre otras letras): {deletreo['precision']} en {deletreo['ventanas']} ventanas")
    print(f"Contexto: a favor {contexto['a_favor']} · en contra {contexto['en_contra']}")
    if "comparacion" in reporte and "actuales_decision" in reporte["comparacion"]:
        c = reporte["comparacion"]
        print(f"Comparación (decisión): actuales {c['actuales_decision']['precision']} vs único {c['unico_decision']['precision']}")
    if "promedio_persona_no_vista" in reporte:
        print(f"Persona no vista (promedio): {reporte['promedio_persona_no_vista']}")
    print("Más confundidas (real -> predicha):")
    for c, a, b in confusiones(cm, clases, top=10):
        print(f"  {a} -> {b}: {c}")
    if datos_tmp is not None:
        shutil.rmtree(datos_tmp, ignore_errors=True)
        print("\n(Datos INVENTADOS: estos números solo prueban que el script funciona, no la calidad del modelo.)")


if __name__ == "__main__":
    main()
