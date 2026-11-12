# TOGO_DATASET

Datos y entrenamiento del modelo de señas LESSA. El resultado (`models/v3/`: `.tflite` + etiquetas)
se copia a la app `TOGO_MOVIL` con `--instalar`. Historial de modelos en `models/README.md`.

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
| Traer datos de otra PC o persona | `python tools/juntar_datos.py <zip o carpeta>` | Copia a `dataset/` sin pisar nada |
| Ver cuánto hay y qué falta | `python tools/revisar_dataset.py` | Tabla por persona |
| 2. Extraer puntos | `python tools/extract_landmarks_v2.py` | `landmarks_v3/<clase>/*.npy` |
| 3. Entrenar e instalar | `python tools/train_senas.py --instalar` | `models/v3/` + copia a la app |
| Prueba con persona no vista | `python tools/train_senas.py --por-persona` | Precisión dejando fuera a cada persona |
| Diccionario de la app | `python tools/export_diccionario.py` | `TOGO_MOVIL/src/data/diccionario.json` |
| Abecedario | `python tools/capture_abecedario.py` y luego `python tools/train_abecedario.py --instalar` | Modelos de letras + diccionario |

Después de `--instalar`, recompilar la APK (ver `TOGO_MOVIL/README.md`).

### Capturador de señas v3 (cómo se usa)

1. Elige el número de persona. Muestra qué personas ya tienen videos en esta PC y, si eliges una
   que ya existe, pregunta si de verdad eres esa persona (los nuevos se suman, no se borra nada).
2. Empieza en **pausa** con la clase en grande arriba: ubícate y presiona **ESPACIO**.
3. **Baja las manos** hasta que salgan de la imagen: el borde se pone amarillo (LISTO).
4. **Sube las manos y haz la seña**: graba solo 2 s (borde rojo, con barra de avance).
5. Si pasa los filtros se guarda (verde); si no, dice qué pasó y qué hacer (poca luz, muy lejos,
   sin movimiento, manos fuera del cuadro, cámara lenta…). Baja las manos y repite.
6. Al llegar a 100 en una clase se **pausa** y dice cuál sigue (así nadie graba la seña anterior en
   la carpeta nueva). ESPACIO para seguir.
7. Teclas: ESPACIO pausa · N/P (o flechas) clase · U deshace el último (se puede repetir) ·
   F pantalla completa · ESC o Q sale.

| Opción | Para qué |
|---|---|
| `--persona 4` | No preguntar el número |
| `--clases por_la_tarde,ok_adios,nada` | Grabar solo esas clases (p. ej. completar lo que falta) |
| `--camara 1` | Otra cámara. Sin esto usa la primera que dé imagen (salta cámaras virtuales en negro) |
| `--video prueba.mp4 --salida C:/tmp/x` | Probar sin cámara, sin tocar el dataset |

Detalles que cuidan los datos (el formato de salida no cambió: 640×480, 20 fps, 40 cuadros, sin espejo):
- Cada clip dura 2 s **reales**: la cámara se lee en un hilo aparte y se toma un cuadro cada 50 ms
  por reloj. Si la cámara o la PC no llegan a 16 cuadros/s (poca luz, PC ocupada), el clip se
  descarta y lo dice: la seña quedaría acelerada.
- Si la cámara entrega 16:9 (p. ej. 1280×720) se recorta el centro a 4:3 en vez de aplastarla.
- El video se escribe a un temporal, se comprueba que tenga los 40 cuadros y recién ahí se mueve a su
  carpeta: nunca queda un clip a medias.
- Una mano "vista" un instante (falsa alarma) no gasta un clip; la clase `nada` solo arranca sola si
  hay alguien en cuadro.

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
- `tools/revisar_dataset.py`: tabla de cuánto grabó cada persona y qué falta; lista aparte los nombres
  raros (copias de Windows como `p1_0005 (2).mp4`, que el entrenamiento sí usaría).
- `tools/juntar_datos.py <zip o carpeta>`: trae señas y abecedario de otra PC o persona. Nunca
  sobrescribe: lo idéntico se omite y si hay otro archivo distinto con el mismo nombre (la misma
  persona grabó en dos PC) lo copia con el siguiente número libre. `--prueba` muestra qué haría.
- La extracción vuelve a procesar un video más nuevo que sus puntos (regrabado con el mismo nombre) y
  avisa de `.npy` cuyo video ya no existe (`--limpiar` los borra). El abecedario rehace su caché de
  fotos sola cuando cambian las fotos (antes las de una persona nueva no entraban sin `--re-extraer`).
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

Empieza en pausa (ESPACIO para arrancar). Teclas: ESPACIO pausa · A/D (o flechas) letra · U borra el
último paquete · ESC sale. Opcional: `--persona 4`, `--camara 1`.
Dentro de `tools/` guarda en `dataset/abecedario/` (la crea si falta); suelto en otra carpeta guarda en
`abecedario_p<persona>/` y al salir (también con Ctrl+C) crea `abecedario_p<persona>.zip`. Para
juntarlo: `python tools/juntar_datos.py abecedario_p<persona>.zip` (si usó un número equivocado,
agregar `--persona N`).

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
