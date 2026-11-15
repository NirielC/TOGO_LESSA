# Plataforma de colaboración de Togo — definición final

Web para que voluntarios aporten tomas de señas al dataset de Togo. Código en
[`TOGO_COLABORA/`](../TOGO_COLABORA/README.md); sincronización en
[`TOGO_DATASET/tools/sincronizar_web.py`](../TOGO_DATASET/tools/sincronizar_web.py).

Estado (13-nov-2026): **construida y probada en local, sin publicar**. La base
de datos ya está creada en Supabase. Falta lo de la sección "Pendiente".

## Decisiones

| # | Tema | Decisión |
|---|---|---|
| 1 | Plataforma | Web (Vite + React) en Vercel. MediaPipe (wasm y modelos) se carga de los CDN de jsDelivr y Google, no de Vercel. Datos en Supabase (proyecto existente, reactivado). |
| 2 | Identidad | Correo y contraseña. **Sin DUI** (solo si el abogado lo exige). Google queda preparado pero apagado. |
| 3 | Menores | Menos de 18 años: el tutor confirma desde un enlace que el menor le comparte (WhatsApp, copiar). Hasta entonces no puede grabar. Cuando haya SMTP, el enlace puede ir por correo. |
| 4 | Duración | **Cada seña la suya** (0.8 a 5 s, se edita en el panel). Señas 2 s, letras quietas 1.5 s. Se guarda tal cual; el entrenamiento la ajusta a la ventana del modelo (40 cuadros). |
| 5 | Metas | 400 tomas por seña, de al menos 30 personas, **15 por persona** (30 × 15 = 450). Cada toma se sube al momento: se puede pausar y seguir otro día. |
| 6 | Filtros | **Amables**: solo se descarta una toma sin manos, sin cuerpo o incompleta. Luz, distancia, manos cortadas y poco movimiento son sugerencias; la toma se envía igual. |
| 7 | Validación | En tu PC, con el modelo instalado en la app: si la seña sale en el top 3 → aceptada; si no → revisión. Señas marcadas "nueva" → siempre revisión. |
| 8 | Revisores | Tú (admin) y quien nombres en el panel (intérpretes, personas sordas). Ven el muñeco de la toma junto al ejemplo; teclas A/R. |
| 9 | Canales | La web (Android, iPhone, PC). La app solo muestra los créditos y un botón "Colaborar" que abre la web. |
| 10 | Modelo | El reentreno lo controlas tú: `actualizar_modelo.py --desde-supabase`, pruebas internas, luego publicas. Los 4000 videos originales no se usan. |
| a | Dirección | Gratis: `togo-colabora.vercel.app`. |
| b | Señas iniciales | Las 10 del modelo + "Sin seña" (negativos) + las 27 letras. Las nuevas las agregas desde el panel. |
| c | Acuerdo | Borrador en [`TOGO_COLABORA/src/acuerdo.md`](../TOGO_COLABORA/src/acuerdo.md): consentimiento del tutor, uso de datos, crédito sin propiedad, retiro de datos. Es el mismo texto que muestra la web. |
| — | Supabase como puente | Por defecto las tomas se quedan (pesan poco). `sincronizar_web.py --borrar-archivos` las borra de Supabase una vez bajadas y decididas; la fila queda para contar el avance. |
| — | Administración | Panel en la propia web (`#/admin`): resumen y uso del plan gratis, señas (crear, editar, activar, videos de ejemplo), revisión, personas y roles. |

## Experiencia del voluntario

1. Portada → "Quiero colaborar" (o "Probar sin cuenta").
2. Cuenta con correo → perfil (nombre para créditos, mano, relación con LESSA, ¿mayor de edad?) → acuerdo en corto + completo.
3. Lista de señas con la **sugerida** (la que más falta), su avance y el de todos.
4. Grabar: muñeco de ejemplo (espejo, lento, video si hay) · cámara con avisos en vivo · botón grande con cuenta 3-2-1 · repaso con el muñeco de su propia toma · Enviar o Repetir · "Deshacer" la última.
   - La **primera toma es de práctica** (no se envía).
   - **Modo rápido**: con las manos abajo queda lista; al subirlas graba sola y envía sola si salió bien.
   - Controles fijos abajo: Pausa · Grabar · Salir. En PC: Espacio graba/envía, R repite.
5. "Mi cuenta": sus tomas, editar nombre, cambiar contraseña, **retirar mis datos**.

## Agregado después (14-nov-2026)

- **Sin internet no se pierde nada:** la toma se guarda en el teléfono y se envía sola al volver la conexión (aviso "⟳ N por enviar").
- **Revisión en cuadrícula:** 24 tomas animadas a la vez, todas marcadas para aceptar; se tocan las malas y un botón decide el lote.
- **Las señas que más faltan van primero** (como en ASL Citizen), para que el dataset quede parejo.
- **Canal de llegada (`?de=`):** cada QR o enlace lleva su código; el panel muestra qué difusión funciona.
- **Difusión:** plan completo, textos, stickers, afiche, publicaciones y QR por academia en [`docs/difusion/`](difusion/plan-de-difusion.md) y en Panel › Difusión.
- **Video del acuerdo en LESSA:** espacio listo; poner su dirección en `VITE_VIDEO_ACUERDO` (`TOGO_COLABORA/.env`).
- **Guía de la primera vez:** 3 pasos (apoyar el teléfono, que se vean cara/hombros/manos, tocar Grabar) antes de la toma de práctica.
- **Constancia de colaboración** imprimible (Mi cuenta, desde 15 tomas): agradecimiento útil para estudiantes (horas sociales, si la universidad la acepta).
- **App Togo:** enlaces a la plataforma desde Inicio, Diccionario y "Sobre Togo", créditos y mejoras de accesibilidad. Ver [`analisis-app.md`](analisis-app.md).
- **Pruebas:** `npm test` (web) y `python -m unittest discover -s tests` (TOGO_DATASET). Las reglas de Storage también se probaron
  (cada quien sube solo a su carpeta; nadie ve archivos ajenos; solo admin sube ejemplos).

## Datos (Supabase)

| Tabla | Para qué |
|---|---|
| `perfiles` | Nombre público, crédito sí/no, mano, relación con LESSA, menor, roles. `numero` = persona p1001, p1002… en el dataset. |
| `consentimientos` | Versión del acuerdo aceptada, datos y confirmación del tutor, retiro. |
| `senas` | Catálogo editable: tipo, texto, descripción, duración, metas, video de ejemplo, activa, nueva. |
| `tomas` | Una fila por toma: estado (pendiente/aceptada/revision/rechazada), calidad, top 3 del modelo, si ya se bajó. |
| `retiros` | Solo el número de persona de quien se retiró (para limpiar las copias locales). |

Buckets: `tomas` (privado, máx. 256 KB por archivo) y `ejemplos` (público, videos de máx. 15 MB).
Reglas en la base (no se pueden saltar desde la web): nadie ve ni toca datos ajenos,
nadie se hace admin solo, no se graba sin acuerdo (o sin tutor), tope de 15 por
persona y seña, 400 tomas al día por persona. Probadas con 22 casos (todos bien).

## Costos (planes gratis)

- **Vercel Hobby**: la web pesa ~250 KB por visitante nuevo (MediaPipe ~28 MB viene de CDN). Unos 100 GB/mes alcanzan para cientos de miles de visitas.
- **Supabase gratis**: 1 GB de archivos ≈ 60 000 tomas de ~15 KB; 500 MB de base (cada fila ~1 KB). La salida (5 GB/mes) la gastan sobre todo los videos de ejemplo: cortos y livianos. El panel muestra el uso.
- Si algo se pasa, el plan gratis se corta hasta el siguiente ciclo; no cobra. Se pausa tras 7 días sin actividad: entrar al panel de Supabase lo reactiva.

## Pendiente

1. Revisar el código y el texto del acuerdo (abogado/notario: completar los [ ] del acuerdo).
2. Correo: desactivar "Confirm email" o configurar SMTP (ver `TOGO_COLABORA/README.md`).
3. Crear tu cuenta en la web y hacerte admin (una línea SQL en el README).
4. `TOGO_DATASET/.env` con la clave secreta, para `sincronizar_web.py`.
5. Publicar en Vercel desde GitHub (Root Directory `TOGO_COLABORA`).
6. Probar con tu cámara en un teléfono Android y un iPhone (en esta PC se probó con una cámara simulada).
7. Videos de ejemplo de las señas que no tienen animación (letras con movimiento y señas nuevas).
8. `train_senas.py` entrena **solo con tomas propias**; los 4000 videos originales ya no se pueden usar. El modelo y las animaciones que trae hoy la app salieron de ellos: se reemplazan cuando haya tomas nuevas.
9. Aplicar en Supabase `005_foto_y_muneco_ejemplo.sql` (foto de perfil opcional y "Usar de ejemplo" en Panel › Revisar).
