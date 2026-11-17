# Modelo único: señas + letras + "nada" en un solo modelo

Estado: **listo para entrenar, falta medir con tomas reales.** El script, la app y la capa de
contexto funcionan y están probados con datos sintéticos; la app sigue igual mientras no se
instale `lessa_unico.tflite`.

## Por qué

Hasta ahora la app corre 3 clasificadores TFLite:

| Modelo | Entrada | Qué reconoce |
|---|---|---|
| `lessa_signs.tflite` | 40 cuadros × 384 (v3) | 10 señas + "nada" |
| `lessa_letters.tflite` | 63 valores de una mano (un cuadro) | letras quietas + "_nada" |
| `lessa_letters_motion.tflite` | 40 cuadros × 384 | J, Ñ, Z + "_nada" |

Cada uno tiene su propio softmax: un 0.8 del modelo de señas y un 0.8 del de letras no
significan lo mismo. Por eso la app decide con reglas (umbral de movimiento 0.08 en
`SignEngine.kt` y la regla de 600 ms `signBusy` en `ConversationProvider.tsx`) y por eso se
confunden señas y letras parecidas (por ejemplo "si" y la "S").

Un solo modelo reparte la probabilidad entre **todas** las clases a la vez. Si duda entre "si" y
la "S", lo dice (0.5 / 0.4) y la capa de contexto puede desempatar.

## Diseño

### Entrada: 40 cuadros × 447 valores

| Valores | Qué es | De dónde |
|---|---|---|
| `[0:384]` | pose + manos respecto a los hombros, forma de las dos manos, mano dominante normalizada | igual que el modelo v3 (`build_features_v3` / `Features.v3Frame`) |
| `[384:447]` | forma de la mano que deletrea: la mano más grande, relativa a la muñeca, escala = palma, la izquierda espejada | igual que el modelo de letras (`hand_letter_features` / `Features.letterFeatures`) |

La parte de letra no cambia con el espejo (una "A" con la mano izquierda da los mismos 63
valores), así que el espejo de la mano dominante solo toca `[0:384]`.
Código: `togo_features.build_features_unico()` (Python) y `Features.unicoFrame()` (Kotlin).

### Clases

Señas de `config.CLASSES` (sin "nada"), las 27 letras (A–Z y Ñ) y "nada" al final. Una clase
con menos de 6 tomas queda fuera (no se puede repartir en entrenamiento/validación/prueba).
Las etiquetas de letras son la letra misma (`"A"`, `"Ñ"`): así la app las agrega al deletreo tal cual.

### Datos: solo propios

| Carpeta | Qué | Tipo |
|---|---|---|
| `dataset/landmarks_v3/<seña>/` | señas y "nada" grabadas con `capture_videos.py` | seña / nada |
| `dataset/web/senas/<seña>/` | tomas de la web (TOGO_COLABORA), ya aceptadas | seña / nada |
| `dataset/web/letras/<LETRA>/` | letras quietas de la web (Ñ = carpeta `NN`) | letra |
| `dataset/web/letras_mov/<LETRA>/` | letras con movimiento de la web | letra con movimiento |

`dataset/web/_revision/` no se usa. Los 4000 videos originales del proyecto anterior **no se
usan** (no hay permiso) y el script no tiene opción para usarlos.

### Aumento de datos (solo en entrenamiento)

1. Como `train_senas.py`: velocidad (0.8× a 1.25×), corrimiento dentro de la ventana, tamaño,
   posición y ruido leves.
2. **Deletreo.** Cada letra se pega entre otras letras de la misma persona, como al deletrear:

   ```
   [letra anterior][transición][   LETRA 0.5 a 2 s   ][transición][letra siguiente]
                                        ▲ centro de la ventana (2 s)
   ```

   La letra quieta se toma del tramo central de la toma (donde la mano ya está quieta) y se
   sostiene de 0.5 a 2 s; la letra con movimiento se acelera o frena para durar eso mismo. Las
   transiciones (0.1 a 0.3 s) son pasos suaves entre las dos formas de mano; el cuerpo de la otra
   toma se alinea al de esta (hombros) para que no salte. Una de cada 5 vecinas es "ninguna"
   (empieza o termina la palabra). El modelo aprende a decir **la letra que se sostiene en el
   centro de la ventana**.
3. **Transiciones → "nada"** (`--transiciones`, por defecto 0.3 por toma de letra): ventanas
   centradas en el paso de una letra a otra. Así el paso entre letras no inventa letras y una
   letra doble (LL, NN) puede separarse.

### Red y exportación

La misma de `train_senas.py`: Dense(128) por cuadro → LSTM(96) → LSTM(64) → Dense(64) → softmax,
con suavizado de etiquetas y pesos por clase. Se exporta con los LSTM desenrollados (solo ops
nativas de TFLite, como los modelos actuales). Con 38 clases pesa unos 950 KB.

## En la app

```
cámara ─► MediaPipe ─► cuadro 447 ─► ventana 40 ─► lessa_unico.tflite (1 inferencia cada 3 cuadros)
                                                        │ máscara (modo deletreo) + top-3
                                                        ▼
                       ConversationProvider: contexto.rerank ─► UN estabilizador ─► seña o letra
```

- **`SignEngine.kt`**: si en `assets` están `lessa_unico.tflite` y `unico_labels.json` (+
  `unico_meta.json`), carga solo ese modelo (los otros tres ni se cargan) y en cada paso entrega
  sus 3 opciones con su tipo (`sign`, `letter`, `none`). **Si no están, todo sigue como antes**
  (3 modelos, regla de movimiento, regla de 600 ms).
- **Modo deletreo** (opcional): botón **ABC** en la cámara, solo visible con el modelo único y si
  trae letras. Es una máscara sobre las salidas del mismo modelo (solo letras y "nada", y se
  reparte de nuevo la probabilidad), no otro modelo. Sin él, el modelo elige entre todo.
- **`ConversationProvider.tsx`**: con eventos `mode: 'unico'`, aplica la capa de contexto y
  un solo `PredictionStabilizer`. Los umbrales siguen siendo los de *Ajustes › Avanzado*: los de
  señas si la 1.ª opción es una seña, los de DELETREO si es una letra.

Archivos tocados: `Features.kt` (`unicoFrame`, espejo de 447), `SignEngine.kt`,
`TogoVisionView.kt` (evento `unico` con `top`, prop `spelling`), `TogoVisionModule.kt`,
`src/core/signs/engine.ts`, `native.ts`, `src/core/conversation/contexto.ts`,
`ConversationProvider.tsx`, `src/components/SignCamera.tsx`, `src/data/contexto.json`.

## Capa de contexto ("sentido lógico")

Tabla: **`TOGO_MOVIL/src/data/contexto.json`** (una sola, la leen la app y Python).

```json
{ "despues_de": "como_estas", "siguen": { "estoy_bien": 1, "estoy_mal": 1, "estoy_mas_o_menos": 1 } }
```

- `despues_de`: una etiqueta, una lista, o un grupo: `@inicio` (frase nueva), `@voz` (justo
  después de que habló la persona oyente), `@letra` (deletreando), `@sena` (cualquier seña).
- `siguen`: etiqueta → apoyo de 0 a 1; también `@letra` o `@sena`.
- Lo de antes es la última pieza de la frase en curso; si la frase está vacía y la persona oyente
  acaba de hablar, lo último que dijo que sea una seña conocida ("Hola, ¿cómo estás?" →
  `como_estas`), así se espera la respuesta.

Cómo actúa (`contexto.ts` y su gemela `TOGO_DATASET/togo_contexto.py`):

1. Solo si el modelo **duda**: 1.ª − 2.ª < `margen_duda` (0.25).
2. Nunca si lo más probable es "nada" (`no_tocar`): el contexto desempata, no inventa.
3. Cada una de las 3 opciones se multiplica por `1 + fuerza × apoyo` (`fuerza` 1.5: a lo más
   2.5 veces) y se reparte de nuevo la probabilidad. Nunca aparece una opción que no estaba en el
   top-3.
4. El estabilizador decide con esas probabilidades: si siguen bajo el umbral, no se confirma nada.

Para sumar reglas cuando haya más señas: agrega la línea en `contexto.json` y corre las pruebas
de `TOGO_DATASET` (revisan que cada etiqueta exista en `config.CLASSES`). Los casos de
`TOGO_DATASET/tests/casos_contexto.json` documentan el comportamiento esperado; la versión
TypeScript da exactamente lo mismo.

## Cómo entrenar

```
cd TOGO_DATASET
python tools/sincronizar_web.py                     # trae las tomas aceptadas de la web
python tools/train_unico.py --por-persona --comparar
python tools/train_unico.py --instalar              # cuando convenza: copia a la app
```

- Salida en `models/v3/`: `lessa_unico.keras`, `lessa_unico.tflite`, `unico_labels.json`,
  `unico_meta.json` y `reporte_unico.json`.
- `--instalar` copia `lessa_unico.tflite`, `unico_labels.json` y `unico_meta.json` a
  `TOGO_MOVIL/modules/togo-vision/android/src/main/assets/`. Después hay que compilar la APK
  (`TOGO_MOVIL/build-apk.ps1`) y revisar que el modelo esté dentro.
- Para volver a los 3 modelos: borra esos tres archivos de `assets` y compila de nuevo.
- Prueba del script sin datos reales (datos inventados, no instala nada):
  `python tools/train_unico.py --sintetico --epochs 15`
- Pruebas: `python -m unittest discover -s tests`.

Opciones útiles: `--epochs`, `--copias` (aumento por toma), `--copias-deletreo` (ventanas de
deletreo por letra), `--transiciones`, `--salida`.

## Cómo comparar con los modelos actuales

`--comparar` corre, **en las mismas tomas de prueba**, los 3 modelos actuales de la app con su
regla (seña segura primero; si no, letra con movimiento o quieta según el movimiento de las
muñecas) y el modelo único. Se compara la **decisión**: lo que la app confirmaría con sus
umbrales (seña ≥ 0.82, letra ≥ 0.75, margen ≥ 0.2; si no, "nada").

Qué mirar en `reporte_unico.json`:

| Campo | Qué dice |
|---|---|
| `prueba_top1` / `prueba_decision` | precisión total y por grupo (señas, letras, letras con movimiento, nada) |
| `confusiones_sena_letra` | cuántas veces una seña salió como letra o al revés (lo que se quiere bajar) |
| `deletreo` | precisión con la letra pegada entre otras letras (como al deletrear un nombre) |
| `comparacion` | `actuales_decision` contra `unico_decision` |
| `persona_no_vista` | precisión entrenando sin cada persona y probando con ella (la más honesta) |
| `contexto` | con lo de antes a favor y en contra: 1.ª opción y decisión, sin y con contexto |
| `contexto.barrido_fuerza` | la decisión con fuerza 1, 1.5, 2 y 3, para ajustar `fuerza` en `contexto.json` |
| `matriz_confusion`, `mas_confundidas` | qué se confunde con qué |

Ojo: si los modelos actuales se entrenaron con alguna de esas tomas, su número sale inflado. Lo
más justo es comparar con tomas de personas que ningún modelo vio (las que lleguen de la web
después de entrenar los actuales) y mirar `persona_no_vista`.

En el teléfono: instala el modelo único, compila y prueba lo que antes fallaba: "si" contra "S",
deletrear un nombre después de "Mi nombre es", letras con movimiento (J, Ñ, Z), y que con las
manos quietas o bajando no aparezcan letras. Para volver atrás, borra los tres archivos.

## Qué falta

- **Tomas reales de la web.** En esta PC todavía no hay dataset (`dataset/` no existe aquí), así que
  el modelo solo se probó con datos inventados: sus números no dicen nada de la calidad. Hacen
  falta al menos 6 tomas por letra y por seña (mejor 20 o más, de varias personas) para entrenarlo
  y medir con persona no vista si de verdad confunde menos que los 3 modelos.
- Ajustar con esos datos los umbrales (Ajustes › Avanzado) y `fuerza` / `margen_duda` del contexto
  (usar `barrido_fuerza`).
- Probarlo en un teléfono (el Kotlin compila; falta verlo funcionando con la cámara).
- Las fotos y clips de `capture_abecedario.py` (también propios) no entran por ahora: el modelo usa
  solo `landmarks_v3` y la web. Si hicieran falta más letras, se podrían sumar.
