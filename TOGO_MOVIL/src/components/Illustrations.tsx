import React from 'react';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';
import { palette } from '../theme/tokens';

/**
 * Escenas de los dos modos. Formas planas y redondas, la paleta completa y
 * pocas piezas: que se entienda de un vistazo qué hace cada modo.
 */

/**
 * LEER SEÑAS: el teléfono ve una mano como la ve la app, con sus puntos
 * (muñeca, nudillos, puntas) y lo convierte en un mensaje que suena.
 */
const HAND: [number, number][] = [
  [0, 30],
  [-10, 22], [-18, 14], [-23, 7], [-27, 1],
  [-7, 5], [-9, -6], [-10, -14], [-11, -21],
  [0, 3], [0, -9], [0, -18], [0, -26],
  [7, 5], [9, -5], [10, -13], [11, -20],
  [13, 10], [17, 3], [19, -3], [21, -9],
];
const BONES = [
  [0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [0, 17], [17, 18], [18, 19], [19, 20],
];
const TIPS = new Set([4, 8, 12, 16, 20]);

export function SignsScene({ width = 160, height = 120 }: { width?: number; height?: number }) {
  const pt = (i: number) => ({ x: 58 + HAND[i][0] * 0.95, y: 64 + HAND[i][1] * 0.95 });
  return (
    <Svg width={width} height={height} viewBox="0 0 160 120">
      <Circle cx={134} cy={92} r={20} fill={palette.sun} opacity={0.9} />
      {/* Teléfono */}
      <Rect x={24} y={6} width={70} height={110} rx={14} fill={palette.deepOcean} />
      <Rect x={29} y={14} width={60} height={94} rx={9} fill={palette.cream} />
      {/* Esquinas del visor */}
      <G stroke={palette.seafoam} strokeWidth={2.6} strokeLinecap="round" fill="none">
        <Path d="M34 26 v-6 h6" />
        <Path d="M84 26 v-6 h-6" />
        <Path d="M34 96 v6 h6" />
        <Path d="M84 96 v6 h-6" />
      </G>
      {/* Mano: puntos y líneas, como la dibuja la app */}
      <G stroke={palette.oceanTeal} strokeWidth={2.4} strokeLinecap="round">
        {BONES.map(([a, b]) => (
          <Path key={`${a}-${b}`} d={`M${pt(a).x} ${pt(a).y} L${pt(b).x} ${pt(b).y}`} />
        ))}
      </G>
      {HAND.map((_, i) => (
        <Circle key={i} cx={pt(i).x} cy={pt(i).y} r={TIPS.has(i) ? 3 : 2.1} fill={TIPS.has(i) ? palette.coral : palette.sun} />
      ))}
      {/* Saludo en movimiento */}
      <G stroke={palette.coral} strokeWidth={2} strokeLinecap="round" fill="none" opacity={0.8}>
        <Path d="M70 30 q5 -4 9 0" />
        <Path d="M73 24 q6 -5 12 0" />
      </G>
      {/* Lo que entendió: un globo que suena */}
      <G>
        <Rect x={102} y={18} width={48} height={34} rx={13} fill={palette.white} />
        <Path d="M108 50 L100 62 L120 51 Z" fill={palette.white} />
        <Rect x={111} y={28} width={30} height={5} rx={2.5} fill={palette.oceanTeal} />
        <Rect x={111} y={38} width={20} height={5} rx={2.5} fill={palette.seafoam} />
      </G>
      <G stroke={palette.deepOcean} strokeWidth={2.6} fill="none" strokeLinecap="round">
        <Path d="M154 26 q5 8 0 16" />
      </G>
    </Svg>
  );
}

/** DAR VOZ: un globo de diálogo que suena; teclado y frases. */
export function VoiceScene({ width = 160, height = 120 }: { width?: number; height?: number }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 160 120">
      <Circle cx={36} cy={28} r={22} fill={palette.coral} opacity={0.85} />
      {/* Globo principal */}
      <G>
        <Rect x={46} y={20} width={86} height={52} rx={18} fill={palette.white} />
        <Path d="M66 70 L58 86 L80 70 Z" fill={palette.white} />
        <Rect x={60} y={34} width={52} height={7} rx={3.5} fill={palette.oceanTeal} />
        <Rect x={60} y={48} width={36} height={7} rx={3.5} fill={palette.seafoam} />
      </G>
      {/* Ondas de sonido */}
      <G stroke={palette.deepOcean} strokeWidth={4} fill="none" strokeLinecap="round">
        <Path d="M140 36 q8 10 0 20" />
        <Path d="M148 30 q13 16 0 32" opacity={0.6} />
      </G>
      {/* Teclas */}
      <G>
        <Rect x={20} y={84} width={18} height={14} rx={4} fill={palette.sun} />
        <Rect x={42} y={88} width={18} height={14} rx={4} fill={palette.sandyBeige} />
        <Rect x={102} y={86} width={34} height={14} rx={4} fill={palette.sun} />
      </G>
    </Svg>
  );
}
