# Retomar Togo en otra computadora

## 1. Instalar (una vez)

| Programa | Para qué |
|---|---|
| Git | Bajar el proyecto |
| Node.js 24 | La app |
| Python 3.12 | Dataset y entrenamiento |
| Android Studio (SDK) + JDK 21 | Compilar la APK |
| Docker Desktop (con WSL 2) | Solo para la versión web en contenedor |

## 2. Bajar y preparar

```bash
git clone https://github.com/NirielC/TOGO_LESSA.git
```

```bash
cd TOGO_LESSA/TOGO_MOVIL && npm install
```

```bash
cd TOGO_LESSA/TOGO_DATASET && pip install -r requirements.txt
```

## 3. Lo que NO está en GitHub (copiarlo a mano)

| Qué | Dónde va |
|---|---|
| Videos de señas (4000, ~950 MB) | `TOGO_DATASET/dataset/videos/<clase>/` |
| Puntos extraídos (opcional, se regeneran) | `TOGO_DATASET/dataset/landmarks_v2/` |
| Fotos/clips del abecedario y videos v3 | `TOGO_DATASET/dataset/abecedario/` y `dataset/videos_v3/` |
| Fotos del equipo | `TOGO_MOVIL/assets/equipo/` + descomentar `foto` en `src/data/equipo.ts` |

Se regenera solo (no copiar): `node_modules/`, `android/`, `dist/`, `.expo/`.

## 4. Uso diario

| Tarea | Comando |
|---|---|
| Ver la interfaz (Expo Go, sin reconocimiento) | `cd TOGO_MOVIL && npx expo start` |
| Compilar la APK (Windows) | `powershell -ExecutionPolicy Bypass -File TOGO_MOVIL/build-apk.ps1` |
| Grabar señas | `python TOGO_DATASET/tools/capture_videos.py` |
| Grabar abecedario | `python TOGO_DATASET/tools/capture_abecedario.py` |
| Re-entrenar todo y sacar APK | `python TOGO_DATASET/tools/actualizar_modelo.py --abecedario --apk` |
| Web en Docker | `cd TOGO_MOVIL && docker build -t togo . && docker run -it --rm -p 5173:5173 togo` |

La APK queda en `TOGO_MOVIL/dist/`.

## 5. Notas importantes

- **Versión del dataset:** `VERSION` en `TOGO_DATASET/config.py`. `v2` = 4000 videos originales (30 cuadros,
  modelo actual). `v3` = videos nuevos de 2 s (40 cuadros). Señas y abecedario se entrenan con la misma versión.
- **Contrato del modelo:** `TOGO_DATASET/togo_features.py` y `TOGO_MOVIL/modules/togo-vision/.../Features.kt`
  deben calcular lo mismo. Si cambias uno, cambia el otro.
- **Seña nueva:** agregarla en `CLASSES` (config.py), grabar videos, poner su texto en
  `TOGO_MOVIL/src/core/signs/vocabulary.ts` y correr `actualizar_modelo.py --apk`.
- **Windows, rutas largas:** `build-apk.ps1` ya compila desde una unidad corta (`L:`) y la quita al terminar.
- **Docker Desktop no arranca** ("The file cannot be accessed by the system"): ver el final de `TOGO_MOVIL/DOCKER.md`.
- **Precisión real (Alfa 0.5):** 98 % en prueba y 85.7 % con personas que el modelo no vio
  (antes 68–88 %). Detalle de cada versión en `TOGO_DATASET/models/README.md`.
- **APK:** `TOGO_MOVIL/dist/Togo-Alfa-0.5.apk` (modelo final) y `Togo-Alfa-0.5-modelo-anterior.apk`
  (misma app, modelo de Alfa 0.4) para comparar.
- **Pendiente:** videos de la persona 4; terminar los de la persona 1 (`por_la_tarde`, `ok_adios`, `nada`);
  J, Ñ, Z del abecedario de más personas; fotos del equipo.

## 6. Juntar los datos de otra persona y sacar el modelo

Cada persona graba con su número (`p1`, `p2`…), así los archivos nunca se pisan.

1. **Señas** (`capture_videos.py`): copiar las carpetas de clase de su `videos_v3/` dentro de
   `TOGO_DATASET/dataset/videos_v3/` (Windows pregunta "combinar carpetas": sí).
2. **Abecedario** (`capture_abecedario.py`, se le puede pasar solo ese archivo): manda
   `abecedario_p<N>.zip`; copiar sus carpetas `imagenes/` y `videos/` dentro de
   `TOGO_DATASET/dataset/abecedario/`.
3. Revisar cuánto hay de cada quien:
   ```bash
   python TOGO_DATASET/tools/revisar_dataset.py
   ```
4. Entrenar todo e instalarlo en la app (extrae solo lo nuevo; suma los 4000 videos originales):
   ```bash
   python TOGO_DATASET/tools/actualizar_modelo.py --abecedario --por-persona
   ```
5. Revisar `TOGO_DATASET/models/v3/reporte.json` y, si todo bien, compilar la APK
   (`build-apk.ps1` o el mismo comando con `--apk`).
