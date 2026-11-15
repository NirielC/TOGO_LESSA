/** Datos del sitio público: se cambian aquí y en ningún otro lado. */
export const CONTACTO = 'elsnirielc@gmail.com';
export const AUTOR = 'Elías Niriel López Casoverde';

/** Enlace del APK (Drive, un repo público de versiones, etc.). Vacío = "muy pronto". */
export const APK_URL = import.meta.env.VITE_APK_URL || '';
export const APK_VERSION = 'Beta 0.8';
export const APK_PESO = '85 MB';

/** Pestañas públicas, en el orden de la barra. */
export const PESTANAS = [
  ['', 'Inicio'],
  ['app', 'La app'],
  ['colabora', 'Colabora'],
  ['proyecto', 'El proyecto'],
];
