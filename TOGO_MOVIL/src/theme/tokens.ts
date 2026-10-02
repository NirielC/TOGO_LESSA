/**
 * Tokens de diseño de Togo. Toda la UI sale de aquí: si un color o un radio
 * aparece escrito a mano en un componente, es un error.
 *
 * Regla de canales: seña y voz se distinguen SIEMPRE por cuatro cosas a la
 * vez (lado, ícono, etiqueta y color), nunca solo por color.
 */
export const palette = {
  deepOcean: '#0D2B45', // texto y ancla
  oceanTeal: '#1E5A6E', // primario
  seafoam: '#6BA7A0', // seña
  lightSky: '#B7D4E6', // voz
  sandyBeige: '#DCC8AA', // superficies
  cream: '#FBF7EE', // fondo
  coral: '#F08A5D', // en vivo
  sun: '#F6C453', // celebración
  white: '#FFFFFF',
} as const;

export const colors = {
  bg: palette.cream,
  surface: palette.white,
  surfaceAlt: '#F3EADB', // beige suave para tarjetas secundarias
  sand: palette.sandyBeige,
  text: palette.deepOcean,
  textMuted: '#4E6577',
  textFaint: '#8496A3',
  primary: palette.oceanTeal,
  onPrimary: palette.white,
  ink: palette.deepOcean, // superficies oscuras (cámara, botón principal)
  onInk: palette.cream,

  sign: palette.seafoam,
  signSoft: '#E3F0EE',
  signInk: '#2F6B64', // texto sobre fondo de seña, contraste AA

  voice: palette.lightSky,
  voiceSoft: '#E8F1F8',
  voiceInk: '#2B5873',

  live: palette.coral,
  celebrate: palette.sun,
  danger: '#C8553D',
  border: '#E7DDCB',
  overlay: 'rgba(13,43,69,0.55)',
} as const;

export const fonts = {
  title: 'Fredoka_600SemiBold',
  titleMedium: 'Fredoka_500Medium',
  body: 'Nunito_400Regular',
  bodyMedium: 'Nunito_600SemiBold',
  bodyBold: 'Nunito_700Bold',
} as const;

export const type = {
  display: { fontFamily: fonts.title, fontSize: 34, lineHeight: 40, color: colors.text },
  h1: { fontFamily: fonts.title, fontSize: 26, lineHeight: 32, color: colors.text },
  h2: { fontFamily: fonts.titleMedium, fontSize: 20, lineHeight: 26, color: colors.text },
  body: { fontFamily: fonts.body, fontSize: 16, lineHeight: 23, color: colors.text },
  bodyStrong: { fontFamily: fonts.bodyBold, fontSize: 16, lineHeight: 23, color: colors.text },
  small: { fontFamily: fonts.bodyMedium, fontSize: 13, lineHeight: 18, color: colors.textMuted },
  label: { fontFamily: fonts.bodyBold, fontSize: 12, lineHeight: 16, letterSpacing: 0.6, color: colors.textMuted },
  // Texto de lo que dijo la persona oyente: tiene que leerse a un brazo de distancia.
  voiceBig: { fontFamily: fonts.bodyBold, fontSize: 24, lineHeight: 32, color: colors.text },
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 12, md: 18, lg: 26, xl: 34, pill: 999 } as const;

/** Tamaño mínimo de toque (Android recomienda 48dp). */
export const touch = 48;
