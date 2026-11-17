"""
CAPA DE CONTEXTO ("sentido lógico") — gemela de TOGO_MOVIL/src/core/conversation/contexto.ts.

El modelo da sus 3 opciones más probables. Si duda (poca diferencia entre la 1.ª
y la 2.ª), esta capa las reordena según lo que tiene sentido en la conversación:
después de "mi nombre es" vienen letras; después de "¿cómo estás?", "estoy
bien/mal/más o menos". Si el modelo está seguro, no toca nada.

Cómo: cada opción se multiplica por (1 + fuerza × apoyo), donde apoyo (0 a 1)
sale de la tabla de reglas, y se vuelve a repartir la probabilidad (lo que no
está en el top-3 cuenta como "resto", sin apoyo). Es un empujón acotado: con
fuerza 1.5 una opción apoyada pesa a lo más 2.5 veces más.

Las reglas viven en TOGO_MOVIL/src/data/contexto.json (una sola tabla para la
app y para aquí). Si cambias el algoritmo, cámbialo también en contexto.ts.
"""

import json
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent
TABLA_APP = ROOT_DIR.parent / "TOGO_MOVIL" / "src" / "data" / "contexto.json"

GRUPOS_PREVIOS = {"@inicio", "@voz", "@letra", "@sena"}
GRUPOS_SIGUEN = {"@letra", "@sena"}


def cargar_tabla(ruta=TABLA_APP):
    return json.loads(Path(ruta).read_text(encoding="utf-8"))


def es_letra(etiqueta):
    """Las letras del modelo son una sola letra mayúscula (A..Z, Ñ)."""
    return len(etiqueta) == 1 and etiqueta.isalpha() and etiqueta.isupper()


class Contexto:
    def __init__(self, tabla=None, letra=es_letra):
        tabla = cargar_tabla() if tabla is None else tabla
        self.margen_duda = float(tabla.get("margen_duda", 0.25))
        self.fuerza = float(tabla.get("fuerza", 1.5))
        self.no_tocar = set(tabla.get("no_tocar", ["nada"]))
        self.reglas = []
        for r in tabla.get("reglas", []):
            previos = r["despues_de"]
            self.reglas.append((set([previos] if isinstance(previos, str) else previos), dict(r["siguen"])))
        self.es_letra = letra

    def apoyo(self, etiqueta, previos):
        """0..1: cuánto espera la tabla `etiqueta` después de lo que indican `previos`."""
        if etiqueta in self.no_tocar:
            return 0.0
        grupo = "@letra" if self.es_letra(etiqueta) else "@sena"
        mejor = 0.0
        for despues_de, siguen in self.reglas:
            if despues_de.isdisjoint(previos):
                continue
            mejor = max(mejor, float(siguen.get(etiqueta, 0.0)), float(siguen.get(grupo, 0.0)))
        return min(1.0, mejor)

    def reordenar(self, top, previos):
        """
        top: [(etiqueta, prob), ...] ordenado de mayor a menor (el top-3 del modelo).
        previos: claves de lo que vino antes, p. ej. ["mi_nombre_es", "@sena"] o ["@letra"].
        -> (nuevo top [(etiqueta, prob ajustada)], ¿cambió algo?)
        """
        top = [(e, float(p)) for e, p in top]
        if len(top) < 2 or top[0][0] in self.no_tocar or top[0][1] - top[1][1] >= self.margen_duda:
            return top, False
        apoyos = [self.apoyo(e, previos) for e, _ in top]
        if not any(apoyos):
            return top, False
        pesos = [p * (1.0 + self.fuerza * a) for (_, p), a in zip(top, apoyos)]
        resto = max(0.0, 1.0 - sum(p for _, p in top))
        total = sum(pesos) + resto
        nuevo = sorted(((e, w / total) for (e, _), w in zip(top, pesos)), key=lambda x: -x[1])
        return nuevo, True


ESPERA_LETRAS = 0.8


def espera_letras(previos, ctx=None):
    """¿Lo de antes pide letras? (después de "mi nombre es" o deletreando). Como expectsLetters() en contexto.ts:
    deletreando con la mano quieta, la app no deja que una seña interrumpa."""
    return (ctx or Contexto()).apoyo("A", previos) >= ESPERA_LETRAS


def normalizar(texto):
    """'¿Cómo estás?' -> 'como estas' (sin tildes, signos ni mayúsculas)."""
    import re
    import unicodedata

    t = unicodedata.normalize("NFD", texto.lower())
    t = "".join(c for c in t if unicodedata.category(c) != "Mn")
    return " ".join(re.sub(r"[^a-z0-9 ]+", " ", t).split())


def claves_previas(borrador, ultimo_mensaje=None, textos=None):
    """
    Lo que vino antes, como lo calcula la app (contexto.ts > previousKeys):
      borrador: etiquetas de la frase en curso; las letras deletreadas como '__letters'.
      ultimo_mensaje: (origen, texto) del último mensaje de la conversación, si lo hay.
      textos: etiqueta -> texto de la seña ("como_estas" -> "¿Cómo estás?"). Si quien
              habla dijo una de esas frases ("Hola, ¿cómo estás?"), cuenta como si se
              hubiera señado (la última que dijo): así se espera la respuesta.
    """
    if borrador:
        ultimo = borrador[-1]
        return ["@letra"] if ultimo == "__letters" else [ultimo, "@sena"]
    if ultimo_mensaje and ultimo_mensaje[0] == "voice":
        dicho = f" {normalizar(ultimo_mensaje[1])} "
        hallados = []
        for etiqueta, texto in (textos or {}).items():
            t = normalizar(texto)
            pos = dicho.rfind(f" {t} ") if t else -1
            if pos >= 0:
                hallados.append((pos + len(t), etiqueta))
        return ([max(hallados)[1]] if hallados else []) + ["@voz"]
    return ["@inicio"]
