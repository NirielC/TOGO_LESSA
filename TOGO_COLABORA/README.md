# TOGO_COLABORA · plataforma de colaboración

Web donde voluntarios graban señas de LESSA para entrenar a Togo. Funciona en
Android, iPhone y computadora. **El video nunca sale del dispositivo**: MediaPipe
corre en el navegador y solo se envían los puntos del cuerpo y las manos.

- Definición completa (decisiones, costos, privacidad): [`docs/plataforma-colaboracion.md`](../docs/plataforma-colaboracion.md)
- Acuerdo de colaboración (borrador para el abogado): [`src/acuerdo.md`](src/acuerdo.md)

## Probar en esta PC

```bash
cd TOGO_COLABORA
npm install
npm run dev            # http://localhost:5180
```

Direcciones útiles:

| Dirección | Qué hace |
|---|---|
| `http://localhost:5180/` | La web real, conectada a Supabase |
| `…/?demo` | Sin Supabase: datos de ejemplo en memoria (incluye el panel) |
| `…/?demo&camara=prueba` | Además, una cámara falsa que repite "hola": prueba todo sin encender la cámara |
| `…/#/practica` | Grabar sin cuenta (nada se envía) |
| `…/?demo&camara=prueba&sinred` | Además, simula que no hay internet (para probar la cola de envío) |
| `…/#/admin` | Panel de administración (solo admin o revisores) |
| `…/?de=sticker` | Cualquier enlace con `?de=` guarda por qué canal llegó la persona (ver Panel › Resumen) |

```bash
npm test                 # pruebas de la captura (formato, filtros, cuadros)
npm run difusion         # regenera stickers, afiche, publicaciones y la vista previa (docs/difusion/)
```

## Cómo está hecho

```
src/
  main.jsx            rutas (#/...), sesión, perfil y acuerdo
  api.js              todo lo que se pide a Supabase (demo.js = lo mismo en memoria)
  captura/
    detector.js       MediaPipe (pose + manos) desde CDN, cámara, cámara de prueba
    calidad.js        revisión AMABLE de la toma: solo descarta sin manos/cuerpo/incompleta
    formato.js        archivo .togo (puntos comprimidos, ~15 KB por toma)
    cuadro.js         resultado de MediaPipe -> vector crudo de 258 (igual que togo_features.py)
    cola.js           sin internet: la toma se guarda en el teléfono y se envía sola después
  paginas/            Inicio, Entrar, Unirme (perfil + acuerdo), Señas, Grabar, Cuenta, Tutor
  admin/Admin.jsx     Resumen, Señas (crear/editar/videos de ejemplo), Revisión (cuadrícula o una por una), Personas
  admin/Difusion.jsx  QR y enlaces por canal (?de=...)
difusion/generar.mjs  genera el material de difusión con la marca de Togo
test/                 pruebas (npm test)
  componentes/        Muneco.jsx (versión web de SignAvatar), ui.jsx
supabase/migrations/  esquema, señas iniciales y permisos (ya aplicados al proyecto)
public/diccionario.json  copia de TOGO_MOVIL/src/data/diccionario.json (animaciones de ejemplo)
```

El archivo `.togo` guarda el vector **crudo** de 258 valores por cuadro de
`TOGO_DATASET/togo_features.py` (lo mismo que `extract_landmarks_v2.py`), con
los tiempos reales de cada cuadro. `TOGO_DATASET/tools/sincronizar_web.py` lo
remuestrea a 20 fps exactos y lo lleva a 640×480 "virtual", así el entrenamiento
y el teléfono calculan exactamente lo mismo.

## Pendiente de hacer tú (una sola vez)

1. **Correo de Supabase.** El correo gratis de Supabase solo llega a tu equipo
   (y unos pocos por hora): no sirve para el público. Opciones:
   - Rápida: Supabase › Authentication › Sign In / Providers › Email › desactivar
     **Confirm email** (las cuentas quedan sin verificar el correo).
   - Mejor: crear una cuenta gratis en un servicio SMTP (p. ej. Resend, 3000
     correos/mes) y ponerlo en Authentication › Emails › SMTP Settings. Así
     funcionan "olvidé mi contraseña" y la verificación.
2. **Direcciones permitidas.** Authentication › URL Configuration: *Site URL* =
   la dirección final (p. ej. `https://togo-colabora.vercel.app`) y en *Redirect
   URLs* agregar también `http://localhost:5180`.
3. **Hacerte administrador.** Crea tu cuenta en la web y luego, en Supabase ›
   SQL Editor (cambia el correo por el tuyo):
   ```sql
   update public.perfiles set es_admin = true
   where id = (select id from auth.users where email = 'TU_CORREO');
   ```
   Desde el panel › Personas ya puedes nombrar revisores u otros admins.
4. **Clave para la sincronización.** Supabase › Project Settings › API Keys ›
   *secret* → crea `TOGO_DATASET/.env` (está en `.gitignore`):
   ```
   SUPABASE_URL=https://vzptgcsgwvfrswzugcap.supabase.co
   SUPABASE_SERVICE_KEY=sb_secret_...
   ```
5. **Publicar en Vercel** (cuando la revises y la subas a GitHub): Vercel › Add
   New › Project › importar `NirielC/TOGO_LESSA` › *Root Directory* =
   `TOGO_COLABORA` › Deploy. Nombre del proyecto `togo-colabora` → queda en
   `togo-colabora.vercel.app`. No hacen falta variables de entorno (la URL y la
   clave publicable están en `.env`, que es público a propósito).
6. **Google (opcional).** Requiere crear credenciales OAuth en Google Cloud y
   activarlas en Supabase › Providers › Google. Luego poner `VITE_GOOGLE=1` en `.env`.

## Flujo de datos

1. La persona graba → la web valida lo mínimo → sube la toma (fila en `tomas` + archivo en el bucket `tomas`).
2. La base revisa el acuerdo, el tope de 15 por persona y seña, y un máximo de 400 al día.
3. En tu PC: `python tools/sincronizar_web.py` baja las tomas, el modelo actual
   decide (top 3 → aceptada; si no → revisión) y las ordena en `dataset/web/`.
4. Revisas las dudosas en el panel (A acepta, R rechaza) y vuelves a sincronizar.
5. `python tools/actualizar_modelo.py --desde-supabase` hace todo y entrena.
   Las señas nuevas también van en `CLASSES` de `TOGO_DATASET/config.py`.
