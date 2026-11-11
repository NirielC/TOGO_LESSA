/**
 * EL DIBUJO DE TOGO, como datos. Lo usan la app (Torogoz.tsx) y las herramientas
 * que generan el ícono, la pantalla de carga y el logo (tools/iconos.mjs), así un
 * cambio aquí llega a todos lados.
 *
 * Coordenadas 0-100 y tres capas que se animan por separado:
 *   cuerpo  cola con raqueta, cuerpo, panza y patas
 *   ala     se agita desde el hombro
 *   cabeza  gira desde el cuello; ojo y pico cambian según el estado
 * y "extras" que flotan alrededor (burbuja de pensamiento, Zzz, ?, destellos, ondas).
 *
 * Sin dependencias de pantalla: Node lo puede importar directamente.
 */

export type Estado = 'sleeping' | 'attentive' | 'thinking' | 'celebrating' | 'confused' | 'listening';

export interface Forma {
  t: 'path' | 'circle' | 'ellipse' | 'g';
  d?: string;
  cx?: number;
  cy?: number;
  r?: number;
  rx?: number;
  ry?: number;
  /** Color, o "grad:<nombre>" para un degradado de GRADIENTES. */
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  strokeLinecap?: 'round';
  strokeLinejoin?: 'round';
  opacity?: number;
  strokeOpacity?: number;
  transform?: string;
  hijos?: Forma[];
}

export const COLOR = {
  deepOcean: '#0D2B45',
  oceanTeal: '#1E5A6E',
  cream: '#FBF7EE',
  white: '#FFFFFF',
  sun: '#F6C453',
  coral: '#F08A5D',
  lightSky: '#B7D4E6',
  brillo: '#3E8597',
  coronilla: '#1E5A6E',
  turquesa: '#2E92A3',
  negro: '#0D2B45',
  mandibula: '#1B3549',
  boca: '#2E4A5E',
  lengua: '#E6735A',
  pluma: '#4AA9B6',
  ala1: '#1D576A',
} as const;

export interface Gradiente {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  stops: [number, string][];
}

export const GRADIENTES: Gradiente[] = [
  { id: 'cuerpo', x1: 0.2, y1: 0, x2: 0.8, y2: 1, stops: [[0, '#2A6E80'], [1, '#174B5C']] },
  { id: 'panza', x1: 0.3, y1: 0, x2: 0.6, y2: 1, stops: [[0, '#F0E0C4'], [1, '#D6BA92']] },
  { id: 'cabeza', x1: 0.25, y1: 0, x2: 0.65, y2: 1, stops: [[0, '#88C2B9'], [1, '#5E9A92']] },
  { id: 'ala', x1: 0.4, y1: 0, x2: 0.5, y2: 1, stops: [[0, COLOR.ala1], [0.55, '#227F8E'], [1, '#227F8E']] },
  { id: 'ceja', x1: 0, y1: 0, x2: 1, y2: 0, stops: [[0, '#5DB6CC'], [0.45, '#C6EDF4'], [1, '#5DB6CC']] },
];

const P = (d: string, x: Partial<Forma> = {}): Forma => ({ t: 'path', d, ...x });
const trazo = (d: string, stroke: string, strokeWidth: number, x: Partial<Forma> = {}): Forma =>
  P(d, { stroke, strokeWidth, strokeLinecap: 'round', fill: 'none', ...x });

/** Cola (pluma turquesa con banda negra, dos varillas y raqueta), cuerpo, panza y patas. */
export const CUERPO: Forma[] = [
  P('M33.6 77.6 C28.6 82 25 85 22 87.2 C24.1 89.2 27.3 88.8 30.1 87 C33.1 85 35.7 82.2 37.9 79.6 Z', { fill: COLOR.turquesa }),
  P('M22 87.2 C24.1 89.2 27.3 88.8 30.1 87 C28.9 86 27.7 85.6 26.5 85.8 C24.9 86.2 23.5 86.8 22 87.2 Z', { fill: COLOR.negro }),
  trazo('M24.5 87.6 C20 91 16.1 93.4 12.1 95 M26.1 88.2 C21.9 91.6 18.3 94.2 14.3 96', COLOR.negro, 0.9),
  P('M13.9 94.2 C9.7 91.4 4.9 93.6 5.3 98 C8.7 100.8 14.5 99.2 13.9 94.2 Z', { fill: COLOR.turquesa }),
  P('M5.5 96.8 C5.1 98.9 6.5 100.1 8.9 99.7 C7.3 99 6.3 98.1 5.5 96.8 Z', { fill: COLOR.negro }),
  P('M46 40.5 C34.5 44.5 25.5 56 26.5 69.5 C27.2 78.5 32.5 85 40 87.6 C48.5 90.4 59.5 88.6 66.4 81 C72.6 74 73.4 62.5 69 53 C64.6 44 55.5 38.2 46 40.5 Z', { fill: 'grad:cuerpo' }),
  trazo('M36 48.5 C31 53.5 28.4 60 28.6 67', COLOR.brillo, 1.6, { opacity: 0.7 }),
  P('M60.5 50.5 C68.6 54.4 72 64.4 69 73.6 C66 82.8 57.6 88 48.6 87.6 C45 81.4 45.2 72.2 48.8 64.2 C51.4 58.2 55.4 52.8 60.5 50.5 Z', { fill: 'grad:panza' }),
  trazo('M55 60 C58 58 61.6 57.6 64.2 58.6', COLOR.white, 1.5, { strokeOpacity: 0.38 }),
  {
    t: 'g',
    stroke: COLOR.deepOcean,
    strokeWidth: 1.9,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    fill: 'none',
    hijos: [
      P('M47.5 88.6 L46.2 93.4 M46.2 93.4 L43.6 94.4 M46.2 93.4 L48.2 94.9'),
      P('M55.2 87.6 L56.4 92.6 M56.4 92.6 L54.2 94.2 M56.4 92.6 L58.9 93.4'),
    ],
  },
];

/** Ala plegada: cobertoras, plumas de vuelo turquesa y punta negra hacia la cola. */
export const ALA: Forma[] = [
  P('M47.5 48.5 C55.5 52.5 57.6 63.2 53.6 72 C50.4 79.2 43 83.8 32.4 86.6 C35 83.8 36 81.4 35.6 79.4 C32.8 80.4 30.8 79.4 31.2 76.8 C28.8 75.8 28.6 72.6 30.6 70 C32 60 38.6 50.2 47.5 48.5 Z', { fill: 'grad:ala' }),
  P('M32.4 86.6 C35 83.8 36 81.4 35.6 79.4 C37.8 80.8 40 81.4 42.6 81.2 C39.8 83.6 36.4 85.4 32.4 86.6 Z', { fill: COLOR.negro }),
  P('M47.2 49 C53.6 52.6 55.4 59.6 53.8 64.8 C51.6 66 49.4 65.6 48.2 64.2 C46.6 66.4 43.8 66.6 42.2 64.8 C40.4 66.8 37.4 66.6 36 64.6 C34.2 65.6 32.4 65 32 63.2 C34.6 55.4 40.2 49.8 47.2 49 Z', { fill: COLOR.ala1, opacity: 0.9 }),
  {
    t: 'g',
    stroke: COLOR.pluma,
    strokeWidth: 1.1,
    strokeLinecap: 'round',
    fill: 'none',
    opacity: 0.8,
    hijos: [P('M51.4 70.4 C47.6 76 42 80.2 35 83.4'), P('M47.4 70.8 C43.6 75 38.8 78 33.4 80')],
  },
];

const OJO = { cx: 63.5, cy: 34.8 };

export function ojo(estado: Estado, parpadeo = false): Forma[] {
  const { cx, cy } = OJO;
  if (estado === 'sleeping' || parpadeo) return [trazo(`M${cx - 4.8} ${cy + 0.4} Q${cx} ${cy + 4.2} ${cx + 4.8} ${cy + 0.4}`, COLOR.cream, 2)];
  if (estado === 'celebrating') return [trazo(`M${cx - 4.8} ${cy + 2} Q${cx} ${cy - 3.8} ${cx + 4.8} ${cy + 2}`, COLOR.cream, 2.2)];
  const [mx, my] = estado === 'thinking' ? [0.6, -1.9] : estado === 'listening' ? [-1.6, 0] : [1.2, 0.2];
  return [
    { t: 'circle', cx, cy, r: 5.6, fill: COLOR.cream },
    { t: 'circle', cx: cx + mx, cy: cy + my, r: 3.5, fill: COLOR.negro },
    { t: 'circle', cx: cx + mx + 1.35, cy: cy + my - 1.35, r: 1.3, fill: COLOR.white },
    { t: 'circle', cx: cx + mx - 1.15, cy: cy + my + 1.25, r: 0.55, fill: COLOR.white, opacity: 0.8 },
    ...(estado === 'confused' ? [trazo('M58.4 27.6 L67.4 25.8', COLOR.deepOcean, 1.6)] : []),
  ];
}

/**
 * Cabeza: coronilla y ceja clara; antifaz que empieza a media cabeza (punta redondeada),
 * pasa por el ojo y sigue en la mandíbula de arriba; la de abajo en otro tono y la línea
 * de la boca. Al celebrar se abre el pico.
 */
export function cabeza(estado: Estado, parpadeo = false, conOjo = true): Forma[] {
  const abierto = estado === 'celebrating';
  const mandibula = P('M73.2 39.4 C80.8 39.8 88 40.6 93.2 41.6 C87.2 43.6 80.4 44.2 73.6 43.2 C72.4 42 72.4 40.4 73.2 39.4 Z', { fill: COLOR.mandibula });
  return [
    {
      t: 'g',
      transform: 'rotate(-6 56 46)',
      hijos: [
        P('M57.5 15.2 C69 15.2 77.4 23.6 76.8 34.6 C76.2 45.4 68 52.6 57.6 52.6 C46.6 52.6 38.6 45 38.6 34.4 C38.6 23.4 46.2 15.2 57.5 15.2 Z', { fill: 'grad:cabeza' }),
        P('M38.8 32 C39.6 21.4 48.6 14.8 59 15 C67.2 15.2 73.6 19.6 76 25.6 C67 20.8 52.6 21.2 38.8 32 Z', { fill: COLOR.coronilla, opacity: 0.7 }),
        estado === 'confused'
          ? P('M46.8 27.6 C53.8 21.2 64.6 19.4 73.6 22.4 C64.8 22.6 56 24.8 48.4 30 Z', { fill: 'grad:ceja' })
          : P('M46.4 29.4 C53.4 23.8 63.8 22.4 73.2 25.6 C64.6 25 55.8 26.8 48 31.6 Z', { fill: 'grad:ceja' }),
        ...(abierto
          ? [trazo('M74.4 40.6 C79 41.2 83.2 42.4 86.4 44', COLOR.lengua, 2.6), { t: 'g' as const, transform: 'rotate(13 73.6 40)', hijos: [mandibula] }]
          : [mandibula]),
        P('M53.5 31.8 C60 30.4 67 30.2 72.8 32.2 C81.4 33.2 89.6 36 94.6 41.2 C88.4 40.6 81 39.8 73.4 39.4 C66.2 39.8 59.6 40.4 54 40.8 C50.8 41 49.2 39 49.4 36.6 C49.6 34 51.2 32.4 53.5 31.8 Z', { fill: COLOR.negro }),
        ...(abierto ? [] : [trazo('M73.6 39.5 C80.6 39.9 87 40.6 92.6 41.4', COLOR.boca, 0.8)]),
        ...(conOjo ? ojo(estado, parpadeo) : []),
      ],
    },
  ];
}

/** Una "Z" dibujada (no depende de fuentes): esquina superior izquierda y tamaño. */
const zeta = (x: number, y: number, s: number) => `M${x} ${y} h${s} l${-s} ${s} h${s}`;

/** Lo que flota alrededor según el estado. */
export function extras(estado: Estado): Forma[] {
  switch (estado) {
    case 'sleeping':
      return [
        { t: 'g', stroke: COLOR.oceanTeal, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none', hijos: [
          P(zeta(78, 20, 4), { strokeWidth: 1.6 }),
          P(zeta(84.5, 11.5, 5.5), { strokeWidth: 1.9, opacity: 0.85 }),
          P(zeta(91.5, 1.5, 7), { strokeWidth: 2.2, opacity: 0.7 }),
        ] },
      ];
    case 'thinking':
      // Burbuja de pensamiento con puntitos y dos bolitas hacia la cabeza.
      return [
        { t: 'circle', cx: 75.6, cy: 21.8, r: 1.4, fill: COLOR.white, stroke: COLOR.oceanTeal, strokeWidth: 0.8 },
        { t: 'circle', cx: 78.8, cy: 17.4, r: 2.1, fill: COLOR.white, stroke: COLOR.oceanTeal, strokeWidth: 0.8 },
        P('M80.6 9.8 C80.4 6.4 84 4.6 86.8 6 C88.2 3.2 92.8 3.2 94.2 6 C97.4 5.6 99.2 8.8 97.8 11.4 C99.2 14.2 96.4 16.8 93.6 15.6 C92.2 17.8 88 17.8 86.6 15.8 C83.4 16.8 80.6 14 81.6 11.6 C81 11.2 80.6 10.6 80.6 9.8 Z', { fill: COLOR.white, stroke: COLOR.oceanTeal, strokeWidth: 0.9 }),
        { t: 'g', fill: COLOR.oceanTeal, hijos: [
          { t: 'circle', cx: 85.6, cy: 11, r: 1 },
          { t: 'circle', cx: 89.4, cy: 11, r: 1 },
          { t: 'circle', cx: 93.2, cy: 11, r: 1 },
        ] },
      ];
    case 'celebrating':
      return [
        { t: 'g', fill: COLOR.sun, hijos: [
          P('M84 12 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2 z'),
          P('M26 20 l1.4 3.4 3.4 1.4 -3.4 1.4 -1.4 3.4 -1.4 -3.4 -3.4 -1.4 3.4 -1.4 z'),
          { t: 'circle', cx: 94, cy: 26, r: 1.8, fill: COLOR.coral },
          { t: 'circle', cx: 33, cy: 12, r: 1.4, fill: COLOR.coral },
        ] },
      ];
    case 'confused':
      return [trazo('M82 10 c0 -5 9 -5 9 0 c0 3 -4.5 3.5 -4.5 7 M86.5 21 v0.5', COLOR.coral, 2.4)];
    case 'listening':
      return [
        { t: 'g', stroke: COLOR.lightSky, strokeWidth: 2.4, strokeLinecap: 'round', fill: 'none', hijos: [
          P('M34 26 q-5 6 0 12'),
          P('M28 22 q-8 10 0 20'),
        ] },
      ];
    default:
      return [];
  }
}

/** El nombre: cada letra con su color y su ladeo (grados) y cuánto baja (en tamaños de letra). */
export const NOMBRE: { l: string; color: string; giro: number; baja: number }[] = [
  { l: 'T', color: '#1E5A6E', giro: -4, baja: 0 },
  { l: 'o', color: '#2E92A3', giro: 3, baja: 0.03 },
  { l: 'g', color: '#E3A24E', giro: -3, baja: 0 },
  { l: 'o', color: '#F08A5D', giro: 4, baja: 0.03 },
];
export const LEMA = ['señas', 'voz', 'texto'];

/** Sombra en el suelo (capa aparte: no salta con Togo). */
export const SOMBRA: Forma[] = [{ t: 'ellipse', cx: 48, cy: 95.5, rx: 15, ry: 2.6, fill: COLOR.deepOcean, opacity: 0.13 }];

/** Togo completo en un estado (las tres capas juntas), para íconos y logos. */
export const togoCompleto = (estado: Estado = 'attentive'): Forma[] => [...CUERPO, ...ALA, ...cabeza(estado)];

// ---------------------------------------------------------------------------
// Para herramientas (Node): convertir formas a texto SVG.
const kebab = (k: string) => k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);

/** Los degradados como <defs>, con un sufijo para que los ids no choquen entre dibujos. */
export function defsSvg(sufijo = ''): string {
  return `<defs>${GRADIENTES.map(
    (g) =>
      `<linearGradient id="${g.id}${sufijo}" x1="${g.x1}" y1="${g.y1}" x2="${g.x2}" y2="${g.y2}">${g.stops
        .map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`)
        .join('')}</linearGradient>`,
  ).join('')}</defs>`;
}

/** Formas → texto SVG. Los "grad:<id>" se vuelven url(#<id><sufijo>). */
export function formasSvg(formas: Forma[], sufijo = ''): string {
  return formas
    .map(({ t, hijos, ...props }) => {
      const attrs = Object.entries(props)
        .map(([k, v]) => {
          const valor = typeof v === 'string' && v.startsWith('grad:') ? `url(#${v.slice(5)}${sufijo})` : v;
          return `${kebab(k)}="${valor}"`;
        })
        .join(' ');
      return t === 'g' ? `<g ${attrs}>${formasSvg(hijos ?? [], sufijo)}</g>` : `<${t} ${attrs}/>`;
    })
    .join('');
}
