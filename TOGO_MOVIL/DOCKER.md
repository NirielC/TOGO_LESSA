# Togo en Docker

Se dockeriza la **versión web** de Togo (Expo para web). Dentro del contenedor se genera la web de
producción y se sirve en el puerto **5173**. Funciona toda la interfaz (inicio, Dar voz, frases rápidas,
pizarra, diccionario con animaciones, el torogoz, ajustes, Sobre Togo). El reconocimiento de señas con la
cámara usa un módulo nativo de Android, por eso ese queda en la APK.

## Archivos

| Archivo | Para qué |
|---|---|
| `Dockerfile` | Receta de la imagen: Node 24 Alpine → instalar dependencias → generar la web → servirla |
| `.dockerignore` | Lo que **no** se copia a la imagen: `node_modules`, `android/`, `dist/`, logs, llaves… |

### Dockerfile, paso por paso

| Instrucción | Qué hace |
|---|---|
| `FROM node:24-alpine` | Imagen base: Node.js 24 sobre Alpine Linux (ligera) |
| `WORKDIR /app` | Carpeta de trabajo dentro del contenedor |
| `ENV CI=1 EXPO_NO_TELEMETRY=1` | Sin preguntas interactivas ni telemetría al construir |
| `COPY package*.json ./` | Copia primero solo las dependencias: si no cambian, Docker reutiliza esa capa |
| `RUN npm install` | Instala las dependencias dentro de la imagen |
| `COPY . .` | Copia el resto del proyecto (menos lo de `.dockerignore`) |
| `RUN npx expo export --platform web --output-dir dist` | Genera la web de producción en `dist/` |
| `RUN npm install -g serve` | Servidor estático para `dist/` |
| `EXPOSE 5173` | Documenta el puerto en el que escucha |
| `CMD ["serve", "-s", "dist", "-l", "tcp://0.0.0.0:5173"]` | Al arrancar: sirve la web en todas las interfaces. `-s` = modo SPA (rutas como `/voz` funcionan al recargar) |

## Comandos

Desde la carpeta `TOGO_MOVIL` (con Docker Desktop abierto):

```bash
docker --version
```

```bash
docker build -t togo .
```

```bash
docker images
```

```bash
docker run -it --rm -p 5173:5173 togo
```

Abrir **http://localhost:5173**. (`-p 5173:5173` = puerto de tu PC : puerto del contenedor; `--rm` borra el
contenedor al detenerlo; `-it` muestra la salida y permite cortarlo con Ctrl+C.)

En segundo plano, con nombre:

```bash
docker run -d --name togo-web -p 5173:5173 togo
```

```bash
docker ps
```

```bash
docker logs togo-web
```

```bash
docker stop togo-web
```

```bash
docker rm togo-web
```

### Docker Hub (Guía 2)

```bash
docker login
```

```bash
docker build -t TU_USUARIO/togo:v1 .
```

```bash
docker push TU_USUARIO/togo:v1
```

En otra computadora (solo con Docker instalado):

```bash
docker pull TU_USUARIO/togo:v1
```

```bash
docker run -it --rm -p 5173:5173 TU_USUARIO/togo:v1
```

Nueva versión: cambiar algo, `docker build -t TU_USUARIO/togo:v2 .` y `docker push TU_USUARIO/togo:v2`.

## Si Docker Desktop no arranca ("The file cannot be accessed by the system")

Docker deja archivos de sockets dañados cuando se cierra mal, y en el siguiente arranque no puede
reemplazarlos. Con Docker cerrado (Quit), en PowerShell:

```powershell
wsl --shutdown; Rename-Item "$env:LOCALAPPDATA\Docker\run" "run.viejo"; Rename-Item "$env:LOCALAPPDATA\docker-secrets-engine" "docker-secrets-engine.viejo"
```

Y volver a abrir Docker Desktop. (No hace falta "Reset to factory defaults".)
