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

export const APP_VERSION = 'Beta 0.7';
export const APP_YEAR = 2026;
