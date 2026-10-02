import React from 'react';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';
import { palette } from '../theme/tokens';

/**
 * Escena del modo Dar voz. (La de Leer señas usa SignAvatar con datos reales.) Formas planas y redondas, la paleta completa y pocas
 * piezas: que se entienda de un vistazo qué hace el modo.
 */

/** LEER SEÑAS: alguien saluda, la app ve sus manos y el teléfono lo entiende. */
export function SignsScene({ width = 160, height = 120 }: { width?: number; height?: number }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 160 120">
      <Circle cx={128} cy={26} r={20} fill={palette.sun} />
      {/* Persona */}
      <Rect x={22} y={70} width={52} height={50} rx={22} fill={palette.oceanTeal} />
      <Circle cx={48} cy={50} r={17} fill={palette.deepOcean} />
      {/* Brazo y mano saludando (mano redondeada, sin dedos sueltos) */}
      <Path d="M68 82 C78 74 84 62 86 50" stroke={palette.oceanTeal} strokeWidth={11} strokeLinecap="round" fill="none" />
      <Rect x={78} y={26} width={18} height={26} rx={9} fill={palette.sandyBeige} />
      <Rect x={72} y={38} width={9} height={14} rx={4.5} fill={palette.sandyBeige} transform="rotate(-25 76 45)" />
      {/* Movimiento */}
      <G stroke={palette.cream} strokeWidth={2.6} strokeLinecap="round" fill="none">
        <Path d="M100 26 q5 6 0 12" />
        <Path d="M106 22 q8 10 0 20" opacity={0.7} />
      </G>
      {/* Puntos que detecta la app */}
      <G fill={palette.coral}>
        <Circle cx={82} cy={30} r={2.2} />
        <Circle cx={90} cy={29} r={2.2} />
        <Circle cx={87} cy={44} r={2.2} />
      </G>
      {/* Teléfono que lo entiende */}
      <G transform="translate(128 78) rotate(10)">
        <Rect x={-15} y={-26} width={30} height={52} rx={7} fill={palette.deepOcean} />
        <Rect x={-11} y={-20} width={22} height={37} rx={4} fill={palette.cream} />
        <Path d="M-6 -2 l4 4 l8 -9" stroke={palette.oceanTeal} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <Circle cx={0} cy={21} r={1.8} fill={palette.cream} />
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
