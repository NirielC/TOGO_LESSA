import React, { useEffect, useState } from 'react';
import Svg, { Rect } from 'react-native-svg';
import { PIXEL_A, PIXEL_B, PIXEL_COLOR } from './togoArte';

/** Togo en 8 bits: los píxeles están en togoArte.ts (los comparte la pantalla del monitor). */
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

  const rows = alt ? PIXEL_B : PIXEL_A;
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16">
      {rows.flatMap((row, y) =>
        row.split('').map((c, x) => (PIXEL_COLOR[c] ? <Rect key={`${x}-${y}`} x={x} y={y} width={1.04} height={1.04} fill={PIXEL_COLOR[c]} /> : null)),
      )}
    </Svg>
  );
}
