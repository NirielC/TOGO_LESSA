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
| Foto del autor (opcional) | `TOGO_MOVIL/assets/autor.jpg` + descomentar `foto` en `src/data/app.ts` |

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

La APK queda en `TOGO_MOVIL/dist/`; la de cada versión publicada se copia a `APK/` en la raíz.

## 5. Notas importantes

- **Versión del dataset:** `VERSION` en `TOGO_DATASET/config.py`. `v2` = 4000 videos originales (30 cuadros,
  modelo actual). `v3` = videos nuevos de 2 s (40 cuadros). Señas y abecedario se entrenan con la misma versión.
- **Contrato del modelo:** `TOGO_DATASET/togo_features.py` y `TOGO_MOVIL/modules/togo-vision/.../Features.kt`
  deben calcular lo mismo. Si cambias uno, cambia el otro.
- **Seña nueva:** agregarla en `CLASSES` (config.py), grabar videos, poner su texto en
  `TOGO_MOVIL/src/core/signs/vocabulary.ts` y correr `actualizar_modelo.py --apk`.
- **Windows, rutas largas:** `build-apk.ps1` copia la app a `C:\L\TOGO_MOVIL` y compila ahí (el compilador
  de C++ no acepta rutas de más de 260 caracteres). Esa carpeta se puede borrar cuando quieras; se vuelve a crear.
- **Docker Desktop no arranca** ("The file cannot be accessed by the system"): ver el final de `TOGO_MOVIL/DOCKER.md`.
- **Precisión real (modelo `v3_alfa_0.5`, el de Beta 0.6 y 0.7):** 98 % en prueba y 85.7 % con personas que el modelo no vio
  (antes 68–88 %). Detalle de cada versión en `TOGO_DATASET/models/README.md`.
- **Versión de la app:** `APP_VERSION` en `TOGO_MOVIL/src/data/app.ts` (también `version` y
  `versionCode` en `TOGO_MOVIL/app.json`). La APK de la versión publicada va en `APK/`.
- **Pendiente:** videos de la persona 4; terminar los de la persona 1 (`por_la_tarde`, `ok_adios`, `nada`);
  J, Ñ, Z del abecedario de más personas.

## 6. Juntar los datos de otra persona y sacar el modelo

Cada persona graba con su número (`p1`, `p2`…), así los archivos nunca se pisan.

1. **Señas** (`capture_videos.py`) y **abecedario** (`capture_abecedario.py`, se le puede pasar solo ese
   archivo; manda `abecedario_p<N>.zip`). Juntarlos con un solo comando, que nunca sobrescribe (si la
   misma persona grabó en dos PC, renumera en vez de pisar) y se puede repetir sin duplicar:
   ```bash
   python TOGO_DATASET/tools/juntar_datos.py RUTA/abecedario_p4.zip
   ```
   ```bash
   python TOGO_DATASET/tools/juntar_datos.py RUTA/videos_v3
   ```
   `--prueba` muestra qué haría sin copiar; `--persona 4` si grabó con un número equivocado.
   No copiar a mano con el Explorador: "reemplazar" pisa videos y "conservar ambos" deja copias `(2)`.
2. Para completar clases sueltas: `python TOGO_DATASET/tools/capture_videos.py --persona 1 --clases por_la_tarde,ok_adios,nada`.
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
