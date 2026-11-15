# Análisis de la app Togo (Beta 0.7) · 14-nov-2026

Revisión de la app desde varias perspectivas, probándola en el navegador (`npm run web`)
y leyendo el código. Conclusión: **la base visual es sólida y coherente** (paleta, Fredoka/Nunito,
torogoz, muñeco); no hace falta un rediseño, sino pulir detalles y conectar la app con la
plataforma de colaboración. Lo marcado ✅ ya quedó hecho (sin commit).

## Lo que cambié

- ✅ **Inicio:** fila nueva "Enséñale señas a Togo" (abre la web de colaboración con `?de=app`).
- ✅ **Inicio:** la etiqueta de las tarjetas ("PARA QUIEN NO HABLA") ya no se parte en dos líneas en
  teléfonos de 360-375 px: va arriba, a todo lo ancho.
- ✅ **Diccionario (seña y letra):** botón "Grabarla para enseñarle a Togo", que abre esa seña directo
  en la web (`?de=app-diccionario#/grabar/hola`). Quien acaba de aprender una seña es el mejor voluntario.
- ✅ **Sobre Togo:** sección Colaboradores (nombres al día si hay internet, guardados para sin internet).
- ✅ **Accesibilidad (TalkBack):** botones que no se anunciaban como botón ahora sí: pestañas del
  diccionario y de la ayuda (con "seleccionado"), "Avanzado" en ajustes (con "expandido"), burbujas de la
  conversación, frases rápidas ("Decir: …" y "mantén presionado para quitarla"), filas de inicio, etc.

## Perspectivas

| Perspectiva | Lo que funciona | Lo que propongo |
|---|---|---|
| Primera vez | Novedades, ayuda al entrar a cada modo, Togo saluda | Al subir a Beta 0.8, poner en Novedades: "Colabora", "Créditos" (texto abajo) |
| Persona sorda | Frases rápidas y urgentes, letra grande, sin internet | Probar con 2-3 personas sordas el flujo completo de "Leer señas" con la cámara frontal |
| Persona oyente | Tarjeta clara "Para quien oye", confirmación "¿Quisiste decir…?" | — |
| Accesibilidad | Botones de 48 dp, contraste AA en textos | ✅ roles para TalkBack · Revisar con letra del sistema al 130 % (tarjetas de inicio y "Dar voz") |
| Visual | Paleta y tipografía consistentes; muñeco y torogoz con mucha personalidad | En "Dar voz" la fila de 5 íconos + 2 botones arriba es densa: se podría agrupar Historial/Guardar/Borrar en un menú "Más" (cambio de hábito: decídelo tú) |
| Rendimiento | Todo local; diccionario de 184 KB | — |
| Privacidad | Nada sale del teléfono | La sección Colaboradores solo LEE nombres públicos; no envía nada (ya explicado en el código) |
| Crecimiento | — | ✅ Enlaces a la plataforma desde inicio, diccionario y "Sobre Togo", con su código de canal |

## Apps parecidas y qué tomar de ellas

- **Hand Talk** (Brasil, traduce a Libras con un personaje animado): un personaje como guía crea vínculo
  — Togo ya lo hace con el torogoz y el muñeco. Ellos invitan a la comunidad a sugerir señas: es lo mismo
  que ahora hace Togo con la plataforma.
- **Live Transcribe** (Google): texto muy grande, pocos controles, todo en una pantalla. "Dar voz" ya va por
  ahí; el siguiente paso sería el menú "Más" de arriba.
- **ASL Citizen** (Microsoft): invitar a grabar justo después de mirar una seña en el diccionario, y mostrar
  primero las que tienen menos ejemplos. ✅ Las dos cosas quedaron hechas (botón en el diccionario y orden
  "Las que más faltan" en la web).

## Texto para Novedades de la Beta 0.8 (cuando subas la versión)

En `TOGO_MOVIL/src/components/Novedades.tsx`, reemplazar la lista por:

```ts
{ icon: 'hand-heart-outline', texto: 'Enséñale señas a Togo: graba desde tu teléfono en 5 minutos', tono: '#FBE3D8' },
{ icon: 'account-group-outline', texto: 'Colaboradores: los nombres de quienes le enseñan a Togo', tono: colors.signSoft },
{ icon: 'gesture-tap-button', texto: 'Mejor lectura de pantalla: los botones se anuncian con TalkBack', tono: colors.voiceSoft },
```

y en `src/data/app.ts` poner `APP_VERSION = 'Beta 0.8'` antes de compilar la APK.
