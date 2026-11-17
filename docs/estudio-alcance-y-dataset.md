# Estudio: a quién sirve Togo, quién puede ayudar y cuántos datos hacen falta

Noviembre de 2026. Cifras de fuentes públicas; donde no hay dato oficial se dice y se usa una
estimación con su origen. Los escenarios de alcance son supuestos para planificar, no mediciones.

## Resumen

- **No hay un conteo oficial de personas sordas en El Salvador.** El Censo 2024 registró 48 948
  personas con dificultad para oír (0.8 % de 6 029 976), pero eso incluye pérdida leve y personas
  mayores que no usan lengua de señas.
- **Quienes usan LESSA:** se estima que hay unas 15 000 personas sordas que usan lengua de señas
  (~11 000 de ellas usan LESSA). Si se cuentan también las personas oyentes que la usan, son entre 26 000 y 48 000.
- **Con teléfono inteligente** (77.5 % según el censo): unas **8 500 personas sordas que usan LESSA** podrían
  usar Togo. A ellas se suman las personas oyentes que hablan con ellas: familias, docentes y gente que atiende al público.
- **Alcance realista el primer año:** entre 400 y 2 500 personas sordas, y entre 1 000 y 7 000 oyentes,
  según cuántas alianzas se logren (ver escenarios).
- **Para el dataset importa más tener muchas personas que muchas tomas por persona.** Meta: **40–50 personas
  por seña × 5 tomas** (200–250 tomas por seña), con al menos 10 personas sordas por seña. Unas 230–250
  personas en total, la misma cifra del plan de difusión, pero repartidas en más señas cada una.

## 1. ¿Cuántas personas usan LESSA?

| Dato | Cifra | Fuente | Ojo |
|---|---|---|---|
| Población de El Salvador | 6 029 976 | Censo 2024 | oficial |
| Personas con alguna discapacidad | 281 456 (4.9 %) | Censo 2024 (BCR) | oficial |
| Personas con dificultad para oír | 48 948 (0.8 %) | Censo 2024 | incluye pérdida leve; no es "personas sordas" |
| Personas sordas que usan lengua de señas | ~15 000 (0.25 %) | Joshua Project / Wikipedia | estimación secundaria |
| De ellas: LESSA / ASL salvadoreña / LESSA+LESCO | ~65 % / ~20 % / ~10 % | Joshua Project | estimación secundaria |
| Usuarios de LESSA (sordos y oyentes) | 26 000 (2020) – 48 000 | Ethnologue vía Wikipedia; Joshua Project | no confirmado en Ethnologue directo |
| Personas con teléfono inteligente | 77.5 % (más de 4.3 millones) | Censo 2024 | oficial; menor en zona rural |
| Intérpretes de LESSA | muy pocos; primera promoción de un diplomado: 36 | Infobae 2026, Comunica | no hay registro |

LESSA es lengua oficial de las personas sordas desde 2014 (reconocida por la Asamblea). No hay un
censo específico de personas sordas: el mismo sector lo ha pedido.

**Cálculo base:** 15 000 personas sordas que usan señas × 75 % que usa LESSA (sola o con LESCO) ≈ 11 000;
× 77.5 % con teléfono inteligente ≈ **8 500 personas sordas que podrían usar Togo hoy**.

## 2. ¿A cuántas personas puede llegar Togo? (primer año)

Togo sirve a los dos lados de la conversación: la persona sorda (cámara frontal, ella misma) y la
persona oyente que apunta su teléfono a quien seña.

| Escenario | Qué supone | Personas sordas | Personas oyentes |
|---|---|---|---|
| Conservador | Solo redes y boca a boca | ~400 (5 %) | ~1 000 |
| Medio | + 1–2 alianzas (Asociación de Sordos, una escuela, academias de LESSA) | ~1 300 (15 %) | ~3 000 |
| Optimista | + instituciones (CONAIPD, educación, Cancillería, salud) que lo recomienden | ~2 500 (30 %) | ~7 000 |

**Límite real hoy:** con 10 señas y el abecedario, Togo sirve para saludar, presentarse y deletrear.
Para el uso diario hacen falta muchas más señas. Por eso el alcance crece al ritmo del dataset, y
el dataset crece al ritmo de la comunidad. Las dos campañas son la misma.

**Más allá de El Salvador:** cada país de Centroamérica tiene su propia lengua de señas (LESCO en
Costa Rica, por ejemplo). La app y la plataforma sirven igual, pero cada lengua necesita su propio dataset.

## 3. ¿Quién puede ayudar con el dataset?

| Grupo | Cuántas personas hay (aprox.) | Qué aportan | Participación realista |
|---|---|---|---|
| Personas sordas que usan LESSA | ~11 000 | Las señas como de verdad se hacen. Son las más valiosas y también revisan | 50–150 (con alianzas y confianza) |
| Oyentes que usan LESSA (intérpretes, docentes, familias, estudiantes) | 11 000 – 33 000 | Buenas tomas y revisión | 100–300 |
| Voluntarios que no saben LESSA (aprenden con el video de ejemplo) | miles (universidades, horas sociales, iglesias) | Variedad de manos, piel, cámaras y luz; sobre todo en el **abecedario** (fácil de aprender bien) y en "nada" | muchas, pero sus señas necesitan revisión |

Ejemplos de proyectos parecidos: ASL Citizen (Microsoft) juntó 83 000 videos de 52 personas sordas
con una plataforma web, y LSA64 (Argentina) usó 10 personas que no sabían la lengua y aprendieron
cada seña de un video. Se puede aprender con video, pero **la prueba final ("persona no vista") debe
hacerse con personas sordas**, que son quienes usarán la app.

## 4. ¿Cuántos datos hacen falta?

Referencias de datasets de señas aisladas:

| Dataset | Señas | Personas | Tomas por seña | Nota |
|---|---|---|---|---|
| LSA64 (Argentina) | 64 | 10 | 50 (5 por persona) | personas sin experiencia, guantes de color |
| AUTSL (Turquía) | 226 | 43 | ~170 | separa personas: 31 entrenan, 6 validan, 6 prueban |
| CSL (China) | 500 | 50 | 250 | |
| MS-ASL | 1000 | 222 | ~25 | pocas tomas por seña: cuesta con personas nuevas |
| WLASL | 2000 | — | ~10 | muy pocas por seña: precisión baja |

**Lo que se aprende de ahí:** a partir de unas 5 tomas por persona, cada toma nueva aporta poco: se
parece a las anteriores. Lo que sube la precisión con una persona nueva es la cantidad de
**personas distintas** (manos, piel, ropa, cámaras, luz, forma de señar). Con 10–25 tomas por seña
(WLASL, MS-ASL) a los modelos les cuesta mucho reconocer a personas nuevas.

**Recomendación para Togo** (38 clases: 10 señas, 27 letras y "nada"):

| | Mínimo (modelo usable) | Meta (bueno con persona nueva) |
|---|---|---|
| Tomas por persona y seña | 3 | 5 (no más de 6) |
| Personas por seña | 20 | 40–50, con 10 o más personas sordas |
| Tomas por seña | 60 | 200–250 |
| "nada" | 2× una seña | 3× una seña: manos en reposo, rascarse, acomodarse el pelo, transiciones |
| Total | ~2 300 tomas | ~9 500–12 000 tomas |
| Personas en total (cada una hace ~8 señas) | ~100 | ~230–250 |
| Personas solo para la prueba | 3 (1 sorda) | 6–8 (3 sordas); nunca entran al entrenamiento |

**Comparación con el plan de difusión** (400 tomas por seña, 30 personas por seña, 230 personas, 5 señas
por persona con 15 tomas cada una): el número de personas está bien. Conviene **bajar a 5 tomas por seña y
subir a ~8 señas por persona**: el mismo tiempo de grabación da más personas por seña (≈50 en vez de 30),
y eso es lo que más ayuda. La web ya ordena "las que más faltan", así que reparte sola.

**Decisión (16-nov-2026):** se permiten **de 15 a 30 tomas por persona y seña**, sin obligación (se
puede pausar cuando se quiera), para que cada aporte sea completo y no un "micro aporte". Irá con
**logros y avance a la vista** (porcentaje, insignias, tipo logros de Steam) en la web y en la app,
para que cada persona vea su aporte y los cambios que genera, sin sentirse obligada. Nota técnica:
para que una persona con 30 tomas no pese más que una con 5, el entrenamiento debe igualar el peso
por persona (todavía no está hecho en `train_unico.py`). Se sigue buscando el máximo de personas por seña.

**Señas nuevas:** con el mismo criterio, cada seña nueva necesita unas 200 tomas de 40 o más personas
antes de entrar al modelo. Sin eso, la mejor opción es que salga solo en el Diccionario y no se reconozca.

## 5. Señas y letras que se parecen: análisis de la lógica

### El problema

- Algunas letras y señas tienen casi la misma forma de mano: por ejemplo la **E** y el puño de **"Sí"**.
- Hoy la app tiene 3 modelos que no pueden comparar sus confianzas entre sí. La regla actual da prioridad a la seña si el modelo de señas
  está seguro. Al sostener la E, la ventana de 2 s se llena de "puño quieto"; hacia el 75–80 % de la
  confirmación el modelo de señas se convence de "Sí" y le quita el turno a la letra.
- Con más vocabulario habrá más pares parecidos.

### Opciones

| Opción | Qué hace | A favor | En contra |
|---|---|---|---|
| A. Reglas duras ("después de *Mi nombre es* solo letras hasta terminar") | Prohíbe señas en ciertos momentos | Elimina la confusión en ese caso | **Rompe casos reales:** muchas personas sordas tienen *nombre en seña* (no deletrean); también "Mi nombre es Ana, ¿y el tuyo?". Con más señas, las excepciones crecen y las reglas se contradicen |
| B. Contexto suave (ya hecho, `contexto.json`) | Si el modelo duda, empuja lo que tiene sentido | Nunca inventa; se le pueden sumar reglas | Si el modelo está seguro de lo equivocado, no lo corrige |
| C. Movimiento (hecho hoy) | Las letras se sostienen quietas y las señas se mueven: deletreando, una seña solo cuenta si la mano se mueve | Es físico y no depende del vocabulario. Corrige justo el caso E → Sí | Falla con señas quietas (habrá algunas) y con letras con movimiento (J, Ñ, Z; esas las cubre su propio modelo) |
| D. "Quien va adelante, se queda" (hecho hoy) | Si una letra ya va a más de la mitad y la mano está quieta, una seña no se la roba | Evita los cambios a mitad de confirmación | Si la letra iba mal, hay que borrarla (el botón ya existe) |
| E. Modelo único (listo, falta dataset) | Un solo modelo compara señas y letras con la misma vara | Es el arreglo de fondo | Necesita tomas reales de letras y señas |
| F. Modo deletreo a mano (botón ABC, con el modelo único) | Solo letras mientras está activo | Control total para nombres largos | Un toque más |

### Qué se aplicó hoy y por qué

Se aplicaron C + D + B, que funcionan con los modelos de hoy y con el modelo único.
Un deletreo solo es esperable donde `contexto.json` lo dice (después de *Mi nombre es* o de otra letra).
Ahí, una seña con la mano quieta no cuenta; si la mano se mueve, la seña entra normal.
Así **no se prohíbe nada**: "Mi nombre es" + nombre en seña sigue funcionando si la seña se mueve.

A medida que crezca el vocabulario:
1. El modelo único y más personas en el dataset bajan las confusiones de raíz.
2. La tabla de contexto crece de a poco: solo con pares que de verdad se confundan en el reporte (`mas_confundidas`).
3. Cuando haya muchas señas quietas, el umbral de movimiento se mide con datos (en `STILL_MOTION` y en el reporte).

### Cómo medirlo (en el teléfono)

Con la APK nueva, 20 intentos de cada caso, contando cuántas veces sale bien:

| Caso | Qué hacer | Antes | Ahora |
|---|---|---|---|
| E sola | Sostener la E hasta que confirme | | |
| E después de "Mi nombre es" | Seña *Mi nombre es* + E | | |
| "Sí" después de un nombre | *Mi nombre es* + A-N-A + seña *Sí* (con movimiento) | | |
| S / A / E seguidas | Deletrear "SEA" | | |
| Tiempo hasta confirmar | Seña *Hola* sostenida (cronómetro) | ~0.6 s | ~0.45 s |

Si "Sí" después de un nombre no entra, el umbral de mano quieta (`STILL_MOTION = 0.02` en
`ConversationProvider.tsx`) está alto para esa persona: se baja a 0.015.

## Fuentes

- [El Salvador tiene 6 029 976 habitantes, según el censo de 2024](https://www.elsalvador.com/h-noticias/h-nacional/resultados-censo-poblacion-vivienda-2024-total/1177883/2024/) (El Diario de Hoy)
- [La discapacidad afecta más a adultos mayores y a las mujeres](https://www.elsalvador.com/h-noticias/h-nacional/dispacidad-afecta-mas-mujeres-adultos/1151852/2024/) (Censo 2024, dificultades para oír)
- [El Salvador carece de un censo nacional sobre personas con discapacidad](https://www.infobae.com/el-salvador/2026/05/05/el-salvador-carece-de-un-censo-nacional-sobre-personas-con-discapacidad/) (Infobae)
- [Deaf in El Salvador](https://joshuaproject.net/people_groups/19007/ES) (Joshua Project) y [Salvadoran Sign Language](https://wikipedia.com/wiki/ISO_639:esn) (Wikipedia, cita a Ethnologue)
- [El 80 % de los salvadoreños usa internet y el 77 % tiene smartphone](https://diario.elmundo.sv/economia/el-80-de-los-salvadorenos-usa-internet-y-el-77-tiene-smartphones-segun-censo-de-poblacion) (Diario El Mundo, Censo 2024)
- [La labor de una intérprete salvadoreña por la comunidad sorda](https://www.infobae.com/el-salvador/2026/09/24/la-discapacidad-auditiva-es-invisible-la-labor-de-una-interprete-salvadorena-por-la-comunidad-sorda/) y [Becky Soundy](https://www.infobae.com/el-salvador/2026/09/24/becky-soundy-la-voz-de-la-comunidad-sorda-que-transforma-la-educacion-en-el-salvador/) (Infobae)
- [Aprender a hablar con las manos](https://comunica.edu.sv/archivo/aprender-a-hablar-con-las-manos/) (Comunica; reconocimiento de LESSA en 2014)
- [WHO: World report on hearing](https://cdn.who.int/media/docs/default-source/documents/health-topics/deafness-and-hearing-loss/world-report-on-hearing/wrh-executive-summary2-en.pdf) y [ONU: Día Internacional de las Lenguas de Señas](https://www.un.org/en/observances/sign-languages-day) (70 millones de personas sordas en el mundo)
- [AUTSL](https://arxiv.org/pdf/2008.00932), [ChaLearn LAP (señas aisladas, personas separadas)](https://arxiv.org/pdf/2105.05066), [LSA64](https://facundoq.github.io/datasets/lsa64), [Revisión de datasets de señas](https://arxiv.org/pdf/2204.03328)
