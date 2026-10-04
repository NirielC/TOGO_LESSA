# Togo

App Android para conversar entre personas sordas y oyentes en El Salvador: lee la
**Lengua de Señas Salvadoreña (LESSA)** con la cámara, la dice en voz alta y muestra en
grande lo que se responde. Si alguien no habla, el teléfono habla por esa persona.
Funciona sin internet. Versión **Alfa 0.5**.

| Carpeta | Qué hay |
|---|---|
| [`TOGO_MOVIL/`](TOGO_MOVIL/README.md) | La app (Expo SDK 57 + módulo nativo Kotlin: CameraX + MediaPipe + TFLite). Docker: [`DOCKER.md`](TOGO_MOVIL/DOCKER.md) |
| [`TOGO_DATASET/`](TOGO_DATASET/README.md) | Captura de videos y abecedario, extracción de puntos, entrenamiento y exportación del modelo |
| [`TOGO_PANTALLA/`](TOGO_PANTALLA/) | Pantalla decorativa animada para el monitor de la presentación |
| `TOGO_MOVIL/dist/` | APK listas: `Togo-Alfa-0.5.apk` (modelo final) y `Togo-Alfa-0.5-modelo-anterior.apk` |

## Pantalla para el monitor (presentación)

Pantalla horizontal y animada, en bucle: **TOGO** en grande arriba, el torogoz en su rama
saludando y hablando, un teléfono que lee una mano y arma una conversación, los tres pasos
de la app y una cinta con mensajes. Funciona **sin internet** (fuentes incluidas).

1. Abrir la carpeta `TOGO_PANTALLA/`.
2. Doble clic en **`abrir.bat`**: se abre en Edge (o Chrome) a pantalla completa.
   - Otra forma: abrir `index.html` en el navegador y presionar **F11** (o doble clic en la página).
3. Para salir: **Alt+F4** (o F11 / Esc si se abrió en el navegador).

Se adapta sola a cualquier monitor horizontal (está hecha a 1920×1080 y se escala). Cada
cierto tiempo Togo se vuelve de 8 bits un momento. Los textos están al final de `index.html`
(`FRASES` = lo que dice Togo, `CHAT` = la conversación del teléfono, `CINTA` = la cinta de abajo).

Actualizar el modelo y la APK en un solo paso:

```bash
python TOGO_DATASET/tools/actualizar_modelo.py --apk
```

**Autor:** Elías Niriel López Casoverde

Togo™ · © 2026
