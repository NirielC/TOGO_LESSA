/**
 * Tokens de diseño de Togo. Toda la UI sale de aquí: si un color o un radio
 * aparece escrito a mano en un componente, es un error.
 *
 * Regla de canales: seña y voz se distinguen SIEMPRE por cuatro cosas a la
 * vez (lado, ícono, etiqueta y color), nunca solo por color.
 *
 * MODO CLARO Y OSCURO. `colors` y `type` cambian de valores con applyTheme()
 * (lo llama ThemeProvider según el ajuste "Apariencia"). Las hojas de estilo se
 * escriben con themed(() => StyleSheet.create({...})): se vuelven a calcular
 * solas la primera vez que se usan después de cambiar el tema. Un color usado
 * directo en el JSX (color={colors.text}) también sale bien, porque se lee al
 * dibujar. Lo único que NO se puede hacer es guardar un color en una constante
 * fuera de un componente: quedaría con el valor del tema de ese momento.
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

/** Mismas llaves, cualquier color: así el tema oscuro puede tener otros valores. */
const widen = <T extends Record<string, string>>(o: T): { [K in keyof T]: string } => o;

const LIGHT = widen({
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

  /** Texto sobre colores de marca que no cambian (sol, espuma, cielo): siempre oscuro. */
  onAccent: palette.deepOcean,
  /** Tarjetas grandes de los modos (Leer señas / Dar voz). */
  cardSign: palette.seafoam,
  cardVoice: palette.lightSky,
  /** Tonos suaves para íconos y avisos. */
  toneSun: '#FCEFD2',
  toneCoral: '#FBE3D8',
  /** Vidrio sobre una tarjeta de color. */
  glass: 'rgba(255,255,255,0.55)',
  glassSoft: 'rgba(255,255,255,0.35)',
  /** Palabra deletreada y la pista secreta de Togo. */
  gold: '#8A5A12',
  draftGlow: '#FDF3D6',
  errorBg: '#FDEDE8',
  /** Frases urgentes de "Dar voz": que se noten sin gritar. */
  urgentBg: '#F8EDE6',
  urgentBorder: '#E2B8A2',
  urgentIcon: '#C2714E',
  /** Velo detrás de ventanas y menús. */
  veil: 'rgba(13,43,69,0.45)',
  veilLight: 'rgba(0,0,0,0.25)',
  shadow: palette.deepOcean,
});

/** Modo oscuro: la noche en el mar, con los mismos colores de marca para seña y voz. */
const DARK: typeof LIGHT = {
  bg: '#0E1B26',
  surface: '#162838',
  surfaceAlt: '#1D3244',
  sand: '#8C7A5E',
  text: '#F1ECE2',
  textMuted: '#A9B9C6',
  textFaint: '#7A8D9C',
  primary: '#3C8FA3',
  onPrimary: palette.white,
  ink: '#07131D',
  onInk: palette.cream,

  sign: palette.seafoam,
  signSoft: '#183835',
  signInk: '#93D1C8',

  voice: palette.lightSky,
  voiceSoft: '#17304A',
  voiceInk: '#A8CBE4',

  live: palette.coral,
  celebrate: palette.sun,
  danger: '#E8795F',
  border: '#27415A',
  overlay: 'rgba(3,10,16,0.65)',

  onAccent: palette.deepOcean,
  cardSign: '#2A5C57',
  cardVoice: '#294C69',
  toneSun: '#3A3220',
  toneCoral: '#3D2A23',
  glass: 'rgba(255,255,255,0.12)',
  glassSoft: 'rgba(255,255,255,0.07)',
  gold: '#F2C46B',
  draftGlow: '#3A3220',
  errorBg: '#3A221D',
  urgentBg: '#2E2420',
  urgentBorder: '#7E5544',
  urgentIcon: '#E39A78',
  veil: 'rgba(0,0,0,0.6)',
  veilLight: 'rgba(0,0,0,0.45)',
  shadow: '#000000',
};

export type ThemeName = 'light' | 'dark';
export type Colors = { [K in keyof typeof LIGHT]: string };

/** Colores del tema actual (cambian con applyTheme). */
export const colors: Colors = { ...LIGHT };

export const fonts = {
  title: 'Fredoka_600SemiBold',
  titleMedium: 'Fredoka_500Medium',
  body: 'Nunito_400Regular',
  bodyMedium: 'Nunito_600SemiBold',
  bodyBold: 'Nunito_700Bold',
} as const;

const makeType = () => ({
  display: { fontFamily: fonts.title, fontSize: 34, lineHeight: 40, color: colors.text },
  h1: { fontFamily: fonts.title, fontSize: 26, lineHeight: 32, color: colors.text },
  h2: { fontFamily: fonts.titleMedium, fontSize: 20, lineHeight: 26, color: colors.text },
  body: { fontFamily: fonts.body, fontSize: 16, lineHeight: 23, color: colors.text },
  bodyStrong: { fontFamily: fonts.bodyBold, fontSize: 16, lineHeight: 23, color: colors.text },
  small: { fontFamily: fonts.bodyMedium, fontSize: 13, lineHeight: 18, color: colors.textMuted },
  label: { fontFamily: fonts.bodyBold, fontSize: 12, lineHeight: 16, letterSpacing: 0.6, color: colors.textMuted },
  // Texto de lo que dijo la persona oyente: tiene que leerse a un brazo de distancia.
  voiceBig: { fontFamily: fonts.bodyBold, fontSize: 24, lineHeight: 32, color: colors.text },
});

/** Estilos de texto del tema actual (cambian con applyTheme). */
export const type = makeType();

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 12, md: 18, lg: 26, xl: 34, pill: 999 } as const;

/** Tamaño mínimo de toque (Android recomienda 48dp). */
export const touch = 48;

// ------------------------------------------------------------------ tema

let current: ThemeName = 'light';
let version = 0;

export const themeName = () => current;

/** Cambia los colores de toda la app. Devuelve true si cambió algo. */
export function applyTheme(name: ThemeName): boolean {
  if (name === current) return false;
  current = name;
  Object.assign(colors, name === 'dark' ? DARK : LIGHT);
  Object.assign(type, makeType());
  version++;
  return true;
}

/**
 * Hoja de estilos que sigue al tema: `const st = themed(() => StyleSheet.create({...}))`.
 * Se usa igual que antes (st.tarjeta); se recalcula sola la primera vez que se lee
 * después de un cambio de tema.
 */
export function themed<T extends object>(make: () => T): T {
  let cache: T | null = null;
  let at = -1;
  const get = (): T => {
    if (!cache || at !== version) {
      cache = make();
      at = version;
    }
    return cache;
  };
  return new Proxy({} as T, {
    get: (_t, k) => (get() as Record<string | symbol, unknown>)[k],
    has: (_t, k) => k in get(),
    ownKeys: () => Reflect.ownKeys(get()),
    getOwnPropertyDescriptor: (_t, k) => {
      const d = Object.getOwnPropertyDescriptor(get(), k);
      return d ? { ...d, configurable: true } : undefined;
    },
  });
}
