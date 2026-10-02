# TOGO_DATASET

Datos y entrenamiento del modelo de señas LESSA. El resultado (`models/v2/lessa_signs.tflite` +
`labels.json`) es lo que usa la app `TOGO_MOVIL`.

```bash
pip install -r requirements.txt
```

## Versión del dataset

`VERSION` en `config.py` decide con qué se trabaja; extracción, entrenamiento y diccionario la siguen solos.

| Versión | Videos | Cuadros | Uso |
|---|---|---|---|
| `v2` | `dataset/videos/` (los 4000 originales) | 30 (1.5 s) | Modelo actual de la app |
| `v3` | `dataset/videos_v3/` | 40 (2 s) | Dataset nuevo con el capturador v3 (activa) |

La app lee el largo de la ventana del modelo: re-entrenar con 40 cuadros no requiere cambiar nada en el teléfono.
Señas y letras con movimiento deben entrenarse con la **misma** versión.

## Flujo

| Paso | Comando | Resultado |
|---|---|---|
| 1. Grabar señas | `python tools/capture_videos.py` | `videos_v3/<clase>/p<persona>_<n>.mp4` |
| 2. Extraer puntos | `python tools/extract_landmarks_v2.py` | `landmarks_v3/<clase>/*.npy` |
| 3. Entrenar e instalar | `python tools/train_v2.py --instalar` | `models/v3/` + copia a la app |
| Prueba con persona no vista | `python tools/train_v2.py --solo-exportar --por-persona` | Precisión dejando fuera a cada persona |
| Diccionario de la app | `python tools/export_diccionario.py` | `TOGO_MOVIL/src/data/diccionario.json` |
| Abecedario | `python tools/capture_abecedario.py` y luego `python tools/train_abecedario.py --instalar` | Modelos de letras + diccionario |

Después de `--instalar`, recompilar la APK (ver `TOGO_MOVIL/README.md`).

### Capturador de señas v3 (cómo se usa)

1. Elige el número de persona (cualquiera: 1, 2, 3… sirven más personas, no menos).
2. **Baja las manos**: el borde se pone amarillo (LISTO).
3. **Sube las manos y haz la seña**: graba solo 2 s (borde rojo).
4. Si pasa los filtros se guarda (verde); si no, dice por qué se descartó (poca luz, muy lejos,
   sin movimiento, manos fuera del cuadro…). Baja las manos y repite.
5. Teclas: ESPACIO pausa · N/P cambia de clase · U deshace el último · ESC sale.

Consejos para un dataset mejor: varias personas (lo que más ayuda), fondos y luz distintos,
distancias distintas, ritmo natural (ni lento ni apurado), y la clase `nada` (manos en reposo,
rascarse, moverse sin señar) que evita que el modelo "invente" señas.

## Archivos clave

- `config.py`: rutas, clases, personas, parámetros de captura y del abecedario.
- `togo_features.py`: **contrato con el teléfono.** Formato del vector por frame (pose 33×4 +
  mano izquierda 21×3 + mano derecha 21×3 = 258, sin cara) y su normalización (centro y ancho de
  hombros). El módulo Kotlin de la app debe calcular exactamente lo mismo.
- `models/mediapipe/`: `pose_landmarker_lite.task` y `hand_landmarker.task`, los mismos que usa el teléfono.

Se guardan landmarks **crudos**: si cambia la normalización no hay que re-extraer los videos.

## Resultados actuales (v2, 10 clases)

| Prueba | Precisión |
|---|---|
| Prueba (división aleatoria 70/15/15) | 97.8 % (Keras = TFLite) |
| Prueba en espejo (zurdos) | 97.5 % |
| Persona no vista (1 / 2 / 3 / 4) | 88 / 85 / 85 / 68 % |

La última fila es la realista: con gente nueva baja. Lo que más ayuda es grabar a más personas.

## Pendiente de captura

- **Clase `nada`** (ya en `config.py`): manos en reposo, rascarse, acomodarse el pelo, mover las
  manos sin intención. Sin ella el modelo siempre elige una de las 10 señas. En el capturador v3,
  con la clase `nada` la grabación arranca sola tras 2.5 s en LISTO.
- **Abecedario** con `capture_abecedario.py`:
  - Letras estáticas: 5 ráfagas de 30 fotos por persona, cada una con una variación (cerca, lejos,
    a un lado, girando la muñeca). Solo guarda la foto si ve la mano completa.
  - Letras con movimiento (`LETRAS_CON_MOVIMIENTO`, hoy J, Ñ, Z — **revisar con quien seña**):
    clips de 30 frames, 40 por persona.
  - `_nada`: mano relajada o entre letras.
  - Teclas: ESPACIO grabar · N/P cambiar letra · U deshacer · ESC salir.
