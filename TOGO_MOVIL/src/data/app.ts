import type { ImageSourcePropType } from 'react-native';

/**
 * DATOS DE LA APP: versión, año y autor. `build-apk.ps1` lee APP_VERSION de
 * aquí para nombrar la APK.
 *
 * FOTO: copia la foto a TOGO_MOVIL/assets/autor.jpg (cuadrada, ~400×400) y
 * descomenta la línea `foto`. Mientras no haya foto se muestran las iniciales.
 */
export interface Autor {
  nombre: string;
  correo: string;
  rol: string;
  color: string;
  foto?: ImageSourcePropType;
}

export const AUTOR: Autor = {
  nombre: 'Elías Niriel López Casoverde',
  correo: 'elsnirielc@gmail.com',
  rol: 'Diseño y desarrollo',
  color: '#1E5A6E',
  // foto: require('../../assets/autor.jpg'),
};

export const APP_VERSION = 'Beta 0.8';
export const APP_YEAR = 2026;

/**
 * PLATAFORMA DE COLABORACIÓN (TOGO_COLABORA): la web donde voluntarios graban
 * tomas para entrenar a Togo. La app solo la abre y lee los nombres de los
 * colaboradores (si hay internet); no envía nada.
 * La clave es la PUBLICABLE de Supabase (pública por diseño; la protegen las reglas RLS).
 */
export const COLABORA = {
  web: 'https://togo-colabora.vercel.app',
  supabaseUrl: 'https://vzptgcsgwvfrswzugcap.supabase.co',
  supabaseKey: 'sb_publishable_DTBcQZq7ai-BvBp0DKl2UQ_Lg2E9nzk',
};

/** Enlace a la web de colaboración. `de` dice desde dónde llegó (se ve en el panel); `sena` abre directo esa seña. */
export function urlColaborar(de: string, sena?: string) {
  return `${COLABORA.web}/?de=${de}${sena ? `#/grabar/${sena}` : ''}`;
}

/** Identificador de una letra en la plataforma: A -> letra_a, Ñ -> letra_enie. */
export const idLetra = (letra: string) => `letra_${letra === 'Ñ' ? 'enie' : letra.toLowerCase()}`;
