import React, { useEffect, useState } from 'react';
import Svg, { Rect } from 'react-native-svg';
import { palette } from '../theme/tokens';

/**
 * TOGO EN 8 BITS. Mismo torogoz (cabeza seafoam, antifaz, ceja celeste, pecho
 * arena, cola de raqueta), en una cuadrícula de 16×16. Parpadea y aletea en dos
 * cuadros, como un sprite de consola vieja.
 */
const FRAME_A = [
  '................',
  '......TTTT......',
  '.....TSSSSS.....',
  '....FFFFFFFF....',
  '....DDDDWWDD....',
  '....DDDDWKDDDDD.',
  '....FFFFFFFF....',
  '.....FFFFFF.....',
  '....TTTTTTTT....',
  '...TGGTTTBBBT...',
  '..TGGGTTBBBBBT..',
  '..TGGGTTBBBBBT..',
  '..TTGGTTTBBBT...',
  '...TTTTTTTTT....',
  '..T...D..D......',
  '.DD.............',
];
// Ala arriba y ojo cerrado.
const FRAME_B = FRAME_A.map((row, y) => {
  if (y === 4) return '....DDDDDDDD....';
  if (y === 5) return '....DDDDDDDDDDD.';
  if (y === 9) return '..GGGTTTTBBBT...';
  if (y === 10) return '.GGGTTTTBBBBBT..';
  if (y === 11) return '..TTTTTTBBBBBT..';
  if (y === 12) return '..TTTTTTTBBBT...';
  return row;
});

const COLORS: Record<string, string> = {
  T: palette.oceanTeal,
  S: palette.lightSky,
  F: palette.seafoam,
  D: palette.deepOcean,
  W: palette.cream,
  K: palette.deepOcean,
  G: '#174A5B',
  B: palette.sandyBeige,
};

export function PixelTogo({ size = 64, animate = true }: { size?: number; animate?: boolean }) {
  const [alt, setAlt] = useState(false);
  useEffect(() => {
    if (!animate) return;
    let t: ReturnType<typeof setTimeout>;
    // Cuadro A casi siempre; cuadro B un instante (parpadeo + aleteo).
    const tick = (on: boolean) => {
      setAlt(on);
      t = setTimeout(() => tick(!on), on ? 180 : 700 + Math.random() * 900);
    };
    tick(false);
    return () => clearTimeout(t);
  }, [animate]);

  const rows = alt ? FRAME_B : FRAME_A;
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16">
      {rows.flatMap((row, y) =>
        row.split('').map((c, x) => (COLORS[c] ? <Rect key={`${x}-${y}`} x={x} y={y} width={1.04} height={1.04} fill={COLORS[c]} /> : null)),
      )}
    </Svg>
  );
}
