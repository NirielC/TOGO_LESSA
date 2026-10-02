import type { ImageSourcePropType } from 'react-native';

/**
 * EQUIPO TOGO. El orden es el que se muestra.
 *
 * FOTOS: copia cada foto a TOGO_MOVIL/assets/equipo/ con el nombre indicado
 * (cuadrada, ~400×400, .jpg) y descomenta su línea `foto`. Mientras no haya
 * foto se muestran sus iniciales.
 */
export interface Miembro {
  nombre: string;
  correo: string;
  rol: string;
  color: string;
  foto?: ImageSourcePropType;
}

export const EQUIPO: Miembro[] = [
  {
    nombre: 'Elías Niriel López Casoverde',
    correo: 'elsnirielc@gmail.com',
    rol: 'Creador · desarrollo, modelo y diseño',
    color: '#1E5A6E',
    // foto: require('../../assets/equipo/elias.jpg'),
  },
];

export const APP_VERSION = 'Alfa 0.3';
export const APP_YEAR = 2026;
