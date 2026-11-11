# Togo móvil

Una sola app Android. La cámara lee las señas LESSA en el teléfono (MediaPipe + LSTM TFLite) y
las dice en voz alta; la voz se muestra en letra grande. Dos modos, según quién tiene el teléfono:

| Modo | Para | Qué hace |
|---|---|---|
| **Leer señas** | quien oye | Cámara trasera hacia quien seña → frase en curso → voz. Micrófono → pizarra en grande. |
| **Dar voz** | quien no habla | Escribir o frases rápidas → voz. "Escuchar respuesta" → pizarra en grande. |

La mascota es **Togo**, el torogoz gordito: asistente que indica el estado y da consejos.
Además: "¿Quisiste decir…?" antes de decir una frase en señas, Diccionario LESSA (animaciones
con datos reales del dataset), conversaciones guardadas y Sobre Togo.

**Foto del autor:** copiar a `assets/autor.jpg` (cuadrada, ~400×400) y descomentar la línea
`foto` en `src/data/app.ts`.

## Instalar en el teléfono

La APK está en la carpeta [`APK/`](../APK) de la raíz del repositorio (`Togo-Beta-0.7.apk`).
Cópiala al teléfono y ábrela (hay que permitir "instalar apps desconocidas"), o con el teléfono
por USB y depuración activada:

```bash
adb install -r APK/Togo-Beta-0.7.apk
```

## Compilar

Expo Go **no** sirve para el reconocimiento: el módulo `modules/togo-vision` es nativo (Kotlin).
En Expo Go solo se ve la interfaz; mantener presionada la cámara abre un simulador de señas para
probar el flujo completo.

En Windows, un solo comando (copia la app a `C:\L\TOGO_MOVIL` y compila ahí, porque las rutas
de `node_modules` pasan de 260 caracteres):

```powershell
powershell -ExecutionPolicy Bypass -File build-apk.ps1
```

La APK queda en `dist/Togo-<versión>.apk` (la versión sale de `APP_VERSION` en
`src/data/app.ts`). `dist/` no se sube a git: la APK de cada versión se copia a `APK/` en la raíz.

A mano (Linux/macOS, o para ver cada paso):

```bash
npx expo prebuild --platform android
```

```bash
cd android && ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a
```

La APK queda en `android/app/build/outputs/apk/release/app-release.apk`.

## Estructura

| Carpeta | Qué hay |
|---|---|
| `src/app/` | Pantallas: inicio (`index`), `senas`, `voz`, `diccionario/`, `guardadas`, `ajustes`, `acerca` |
| `src/core/conversation/` | Turnos, frase en curso y deletreo (`reducer.ts`, lógica pura) y su proveedor |
| `src/core/signs/` | Contrato del motor, estabilizador, vocabulario, puente al módulo nativo |
| `src/core/voice/` | Voz a texto (`expo-speech-recognition`) y texto a voz |
| `src/components/` | Togo, cámara, pizarra, línea de tiempo, barras, avatar de señas |
| `modules/togo-vision/` | Módulo nativo: CameraX + MediaPipe + TFLite + dibujo de manos |
| `modules/togo-vision/android/src/main/assets/` | Modelos (`.task`, `.tflite`) y etiquetas |
| `src/data/` | Versión y autor (`app.ts`), diccionario exportado del dataset, consejos de Togo |

## Reglas de conversación

- Una seña confirmada entra a la **frase en curso**; se dice al bajar las manos (1.5 s) o con
  **Decir**. Se puede quitar una seña antes.
- **Deletreo integrado**: si el modelo de señas no ve una seña y la mano forma una letra, la letra
  entra y las letras seguidas forman una palabra ("Mi nombre es" + A-N-A → "Mi nombre es Ana").
  Funciona en cuanto se instala el modelo del abecedario (`TOGO_DATASET/tools/train_abecedario.py --instalar`).
- **Micrófono = cambio de turno**: mientras escucha, las señas no cuentan.
- Una seña cuenta solo con manos visibles, clase distinta de `nada`, confianza, margen sobre la
  segunda opción, varias ventanas seguidas y sin repetirse sin soltarla.
- Voz a texto: primero sin internet; si falta el paquete de español, con internet (ajustable).
