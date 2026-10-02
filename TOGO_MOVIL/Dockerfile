# Togo en Docker: versión web de la app (Expo para web).
#
# El contenedor genera la versión web de Togo y la sirve en el puerto 5173.
# (En la web funciona toda la interfaz: inicio, Dar voz, frases, diccionario,
# Togo, conversación... El reconocimiento de señas con la cámara usa un módulo
# nativo de Android, así que ese queda solo en la APK.)
#
#   docker build -t togo .
#   docker run -it --rm -p 5173:5173 togo
#   -> http://localhost:5173

# 1. Imagen base: Node.js 24 sobre Alpine Linux (ligera)
FROM node:24-alpine

# 2. Directorio de trabajo dentro del contenedor
WORKDIR /app

# Sin telemetría ni preguntas interactivas durante la construcción
ENV CI=1 EXPO_NO_TELEMETRY=1

# 3. Copiar primero solo package.json y package-lock.json:
#    si no cambian, Docker reutiliza la capa de npm install (construye más rápido)
COPY package*.json ./

# 4. Instalar dependencias
RUN npm install

# 5. Copiar el resto del proyecto (lo que excluye .dockerignore no se copia)
COPY . .

# 6. Construir la versión web de producción en /app/dist
RUN npx expo export --platform web --output-dir dist

# 7. Servidor estático para la carpeta dist
RUN npm install -g serve

# 8. Puerto en el que escucha el contenedor (documentación para -p)
EXPOSE 5173

# 9. Comando de inicio: servir dist en todas las interfaces (0.0.0.0), puerto 5173.
#    -s = modo SPA: rutas como /voz o /diccionario devuelven index.html.
CMD ["serve", "-s", "dist", "-l", "tcp://0.0.0.0:5173"]
