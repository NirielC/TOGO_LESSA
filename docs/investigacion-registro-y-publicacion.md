# Investigación: registro, dominio, correo y tiendas (14-nov-2026)

Resumen para decidir. Los montos son los publicados en guías; **confírmalos en ventanilla**,
porque cambian y algunas fuentes no coinciden.

## 1. Derecho de autor de Togo (código y app) — CNR

- **Qué protege:** en El Salvador el programa de ordenador es una *obra literaria* (Ley de
  Propiedad Intelectual). El derecho nace **al crearla**; registrarla no lo crea, pero te da
  **fecha cierta y prueba de autoría** (el depósito es un acto *declarativo*).
- **Dónde:** Registro de la Propiedad Intelectual del CNR (en transición al **Instituto
  Salvadoreño de la Propiedad Intelectual, ISPI**, por una ley nueva: pregunta si el trámite ya
  cambió). Se puede **en línea** (crear usuario en el portal del CNR › "Depósito de Obra") o en
  ventanilla.
- **Qué llevar:**
  1. Formulario de solicitud de depósito (FSPI06 en las guías del CNR), como **autor y titular**.
  2. Recibo de pago: entre **$3.43 y $11.43** según la fuente (confirmar).
  3. **Dos ejemplares** de la obra. Para software se acostumbra: descripción y manual corto,
     capturas, y el **código fuente** (o extractos: primeras y últimas páginas de cada parte) y el
     ejecutable (APK) en digital. En línea, el archivo no puede pasar de 75 MB.
  4. DUI. Si va un apoderado, copia certificada del poder.
- **Qué registrar:** "Togo — traductor de LESSA a voz" (app + modelo + web Colabora) como una
  obra, a tu nombre. Puedes registrar versiones nuevas después.
- **Tus excompañeros:** si el proyecto anterior solo era la idea general ("analizar LESSA") y el
  código, el nombre, el diseño y la app son tuyos, **las ideas no se protegen**: se protege la obra
  concreta. Lo prudente: guarda pruebas (historial de GitHub con fechas, que ya tienes) y, si
  alguno aportó código o material que siga en la app, pídele una **cesión de derechos** firmada.
  Pregúntale a la abogada si hace falta incluso así.
- **Ojo:** los 4000 videos originales y lo que salió de ellos (el modelo que trae hoy la app y las
  animaciones del muñeco del diccionario) **no son tuyos**. Hay que reemplazarlos con tomas
  propias antes de publicar en grande. La plataforma Colabora ya sirve para eso.

## 2. Marca "Togo" — CNR

- **Para qué:** que nadie más use "Togo" para una app parecida en El Salvador. Dura **10 años**
  y se renueva.
- **Pasos:**
  1. **Búsqueda fonética previa** (~$20 por clase): saber si ya existe "Togo" o algo parecido.
     "Togo" también es un país, y eso puede complicar: considera **"Togo LESSA"** o el logo
     (marca mixta: nombre + torogoz).
  2. **Solicitud** (formulario FSPI01) con la clase de Niza: **clase 9** (software y apps
     descargables). Opcional: clase 42 (servicios de software) o 41 (educación).
  3. **Edictos** en el Diario Oficial y otro medio (~$70), luego **2 meses** para oposiciones.
  4. **Derechos de registro** (~$80–100 por clase) y certificado.
- **Total aproximado:** **$150–200 por una clase**, en 4 a 8 meses.

## 3. Dominio propio

- **Qué es:** el nombre de tu sitio (p. ej. `togolessa.com`). Se **alquila por año**. Sirve a la vez
  para la **web** (Vercel) y para el **correo** (Resend): son lo mismo, un dominio, con registros
  DNS distintos.
- **Dónde comprar:** **Cloudflare Registrar** (precio de costo, ~$10.50–11.20/año, igual al
  renovar) o **Porkbun** (~$11/año). Evita los que cobran barato el primer año y caro después.
  `.app` (~$14) obliga a usar HTTPS, que Vercel ya da. `.sv` es más caro y con más trámite.
- **Cómo queda:**
  1. Compras el dominio.
  2. En Vercel › Domains lo agregas y copias 1 o 2 registros DNS al registrador.
  3. En Resend lo agregas y copias 3 registros más (SPF, DKIM): así los correos no caen en spam.
- **Mi recomendación:** `togolessa.com` (o `.app`) en Cloudflare. Web en
  `togolessa.com`, correos desde `hola@togolessa.com`.
- **Aparecer en Google:** con el dominio, más **Google Search Console** (gratis): agregas el
  sitio, verificas con un registro DNS y envías el mapa del sitio. Tarda días o semanas en salir.

## 4. Correo de la plataforma (sin quitar "Confirm email")

| Opción | Costo | Límite | A favor | En contra |
|---|---|---|---|---|
| **Resend + dominio propio** | $0 + dominio | 3000/mes, 100/día | Correos desde `hola@tudominio`, no caen en spam, se ve profesional | Hay que configurar DNS (10 min) |
| **Gmail del proyecto** (`togo.lessa@gmail.com`) + contraseña de aplicación | $0 | ~500/día | Sin dominio, rápido | Puede caer en spam; Google puede bloquear envíos automáticos |

**Recomiendo Resend + dominio.** Y, aparte, crea igual un **Gmail del proyecto** para recibir
mensajes y registrarte en servicios (Play Console, Resend, Vercel), así no expones tu correo
personal. Con dominio también puedes reenviar `hola@tudominio` a ese Gmail (Cloudflare Email
Routing, gratis).

## 5. Distribuir la app

- **APK directo (ya):** desde la web, con pasos: descargar › permitir "instalar apps de esta
  fuente" › instalar. Play Protect puede avisar "app no reconocida": es normal y se toca
  "Instalar de todas formas".
  - **Ojo 2027:** Google exigirá que toda app instalada en Android certificado venga de un
    **desarrollador verificado**, aunque no esté en Play. Ya rige en Brasil, Indonesia,
    Singapur y Tailandia (sept-2026); en el resto, en 2027. Conviene verificarte como
    desarrollador cuando abras la cuenta.
  - **Dónde poner el APK:** el repo es privado, así que no sirve un enlace de GitHub. Opciones:
    Google Drive, o un repo **público** aparte solo con versiones (Releases), o Vercel si el APK
    pesa menos de ~100 MB.
- **Google Play:** pago único de **$25**. Con cuenta personal nueva, antes de publicar hay que
  hacer una **prueba cerrada con 12 personas durante 14 días seguidos**. Calcula unas 3 semanas
  la primera vez. Para eso sirven las personas de la plataforma.
- **App Store (iPhone):** $99 al año y requiere Mac o compilar en la nube (EAS). Más adelante.

## 6. Estructura de carpetas (pendiente de decidir)

Hoy: un solo repo privado con `TOGO_MOVIL` (app), `TOGO_DATASET` (entrenamiento),
`TOGO_COLABORA` (web) y `docs`. Vercel publica solo `TOGO_COLABORA` (Root Directory), así que
**no hace falta separar repos**. Si quieres nombres más claros (`TOGO_APP`, `TOGO_WEB`), se
renombra en un commit aparte cuando termine la sesión del modelo único, y se ajustan
`build-apk.ps1` y las rutas de los scripts.

## Fuentes

- CNR, servicios del Registro de Propiedad Intelectual: https://www.cnr.gob.sv/servicios/detalle-de-servicios-del-instituto-salvadoreno-de-la-propiedad-intelectual/
- Registro de software (foro El Salvador Lex): http://elsalvadorlex.org/index.php/foro/5-noticias-de-el-salvador-lex/50813-como-registrar-un-programa-de-software
- Cartilla de derechos de autor El Salvador (Sura): https://suramericana.com/content/uploads/2021/04/Cartilla-Derechos-de-autor-El-Salvador.pdf
- Nueva ley e ISPI: https://www.elsalvador.com/noticias/nacional/instituto-reemplazara-al-registro-de-la-propiedad-intelectual-en-nueva-ley/1153590/2024/
- Registro de marca: https://www.elsalvador.com/dinero-y-negocios/vision-empresarial/emprendedor-comercio-exterior-interior/1237739/2025/ y https://tramitesypermisos.org/registro-de-marca-el-salvador/
- Precios de dominios: https://dev.to/pickuma/porkbun-vs-cloudflare-registrar-where-to-buy-domains-in-2026-1ae5
- Supabase y SMTP propio: https://github.com/orgs/supabase/discussions/29370 y https://www.resend.com/docs/knowledge-base/getting-started-with-resend-and-supabase
- Prueba cerrada de Google Play: https://support.google.com/googleplay/android-developer/answer/14151465
- Verificación de desarrolladores Android: https://www.androidauthority.com/android-sideloading-changes-timeline-3679204/ y https://thehackernews.com/2026/06/google-sets-sept-30-deadline-for.html
