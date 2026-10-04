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
| 3. Entrenar e instalar | `python tools/train_senas.py --instalar` | `models/v3/` + copia a la app |
| Prueba con persona no vista | `python tools/train_senas.py --por-persona` | Precisión dejando fuera a cada persona |
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

### Modelo de señas v3 (`train_senas.py`)

- **Forma de la mano** además de su posición: los dedos relativos a la muñeca (lo que distingue
  señas parecidas en posición, como «mi nombre es» y «por la tarde»).
- **Mano dominante normalizada**: si la seña se hizo con la izquierda, se espeja. Diestros y
  zurdos se ven igual; grabar mitad con cada mano suma variedad.
- Sin piernas ni pies; aumento de datos con velocidad distinta y seña corrida en la ventana.
- Escribe `signs_meta.json`: la app lee de ahí el formato (sin él, usa el formato v2 original).
- **Dataset combinado**: suma los 4000 videos originales (`landmarks_v2`, 1.5 s, centrados en la
  ventana de 2 s) a los nuevos. Validación y prueba solo con videos nuevos. `--sin-originales` lo apaga.
  `V2_A_V3` (arriba del script) dice qué persona original es cuál en v3, para que "persona no vista"
  no haga trampa.
- `tools/revisar_dataset.py`: tabla de cuánto grabó cada persona y qué falta.
- `train_v2.py` queda para reproducir el modelo original.

### Abecedario (`capture_abecedario.py`, archivo único)

Funciona solo (no usa `config.py`): se le puede pasar el archivo a quien no tenga el repo.
Requisitos: `pip install mediapipe opencv-python numpy`; el modelo de manos se descarga solo si falta.

| | Letras estáticas (fotos) | Letras con movimiento (clips) |
|---|---|---|
| Cuáles | Todas menos `LETRAS_CON_MOVIMIENTO` (+ `_nada`) | J, Ñ, Z (**confirmar**) |
| Por persona | Paquetes de 10: 2 con la derecha y luego 2 con la izquierda = 40 | 10 derecha + 10 izquierda |
| Cómo | Cuenta regresiva de 3 s por paquete; solo toma fotos con la mano quieta (sin borrosas) | Cuenta de 3 s en la posición inicial, al "YA" haz la letra (2 s) |
| Modelo | Red densa sobre la forma de una mano (`lessa_letters.tflite`) | LSTM con el mismo formato que las señas (`lessa_letters_motion.tflite`) |

Teclas: ESPACIO pausa · A/D (o flechas) letra · U borra el último paquete · ESC sale.
Dentro de `tools/` guarda en `dataset/abecedario/`; suelto en otra carpeta guarda en
`abecedario_p<persona>/` y al salir crea `abecedario_p<persona>.zip`. Para juntarlo, copiar sus
carpetas `imagenes/` y `videos/` dentro de `dataset/abecedario/`.

Después: `python tools/train_abecedario.py --instalar` (o `actualizar_modelo.py --abecedario --apk`).

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
- **Abecedario** con `capture_abecedario.py` (ver arriba). Confirmar con quien seña qué letras llevan movimiento.
