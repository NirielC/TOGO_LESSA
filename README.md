# Togo

App Android para conversar entre personas sordas y oyentes en El Salvador: lee la
**Lengua de Señas Salvadoreña (LESSA)** con la cámara, la dice en voz alta y muestra en
grande lo que se responde. Si alguien no habla, el teléfono habla por esa persona.
Funciona sin internet. Versión **Alfa 0.3**.

| Carpeta | Qué hay |
|---|---|
| [`TOGO_MOVIL/`](TOGO_MOVIL/README.md) | La app (Expo SDK 57 + módulo nativo Kotlin: CameraX + MediaPipe + TFLite). Docker: [`DOCKER.md`](TOGO_MOVIL/DOCKER.md) |
| [`TOGO_DATASET/`](TOGO_DATASET/README.md) | Captura de videos y abecedario, extracción de puntos, entrenamiento y exportación del modelo |

Actualizar el modelo y la APK en un solo paso:

```bash
python TOGO_DATASET/tools/actualizar_modelo.py --apk
```

**Autor:** Elías Niriel López Casoverde

Togo™ · © 2026
