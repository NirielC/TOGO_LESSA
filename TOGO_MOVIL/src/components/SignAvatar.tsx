import React, { useEffect, useMemo, useRef, useState } from 'react';
import Svg, { Circle, G, Line, Path } from 'react-native-svg';
import dict from '../data/diccionario.json';
import { palette } from '../theme/tokens';

/**
 * Dibuja una seña con el movimiento REAL de una grabación del dataset
 * (ver TOGO_DATASET/tools/export_diccionario.py). Coordenadas en anchos de
 * hombro, con el centro de los hombros en (0, 0).
 */
type Pt = [number, number];
interface Frame {
  p: Pt[]; // nariz, hombro I, hombro D, codo I, codo D, muñeca I, muñeca D, cadera I, cadera D
  l: Pt[] | null;
  r: Pt[] | null;
}
export interface SignEntry {
  id: string;
  frames: Frame[];
  pistas: { manos: number; movimiento: string; zona: string };
  grabaciones: number;
}
export interface LetterEntry {
  letra: string;
  mano: Pt[];
}

export const SIGNS = (dict as unknown as { senas: SignEntry[] }).senas;
export const LETTERS = (dict as unknown as { letras: LetterEntry[] }).letras;
const FPS = (dict as unknown as { fps: number }).fps;

const FINGERS = [
  [0, 1, 2, 3, 4],
  [0, 5, 6, 7, 8],
  [9, 10, 11, 12],
  [13, 14, 15, 16],
  [0, 17, 18, 19, 20],
];
const PALM = [0, 5, 9, 13, 17];

interface Props {
  sign: SignEntry;
  size?: number;
  /** Velocidad: 1 normal, 0.5 lento para aprender. */
  speed?: number;
  /** Como en un espejo (para copiar la seña) en vez de como se ve de frente. */
  mirror?: boolean;
  playing?: boolean;
  /** Medio cuerpo, más cerca (para ilustraciones pequeñas). */
  closeUp?: boolean;
}

export function SignAvatar({ sign, size = 220, speed = 1, mirror = false, playing = true, closeUp = false }: Props) {
  const [i, setI] = useState(0);
  const n = sign.frames.length;
  const lastHands = useRef<{ l: Pt[] | null; r: Pt[] | null }>({ l: null, r: null });

  useEffect(() => {
    if (!playing) return;
    // Pausa breve al final de cada repetición: se entiende dónde empieza.
    const t = setInterval(() => setI((x) => (x + 1) % (n + 8)), 1000 / (FPS * speed));
    return () => clearInterval(t);
  }, [playing, speed, n]);

  const f = sign.frames[Math.min(i, n - 1)];
  // Si una mano se pierde 1-2 cuadros, se mantiene la anterior (sin parpadeos).
  const l = f.l ?? lastHands.current.l;
  const r = f.r ?? lastHands.current.r;
  lastHands.current = { l: f.l ?? lastHands.current.l, r: f.r ?? lastHands.current.r };

  const vb = closeUp ? '-2.1 -2.7 4.2 3.9' : '-2.2 -2.1 4.4 4.6';
  const X = (p: Pt): Pt => [mirror ? -p[0] : p[0], p[1]];

  return (
    <Svg width={size} height={size * (closeUp ? 0.85 : 1.05)} viewBox={vb}>
      <Body pose={f.p.map(X)} closeUp={closeUp} />
      {l && <Hand pts={l.map(X)} color={palette.sandyBeige} />}
      {r && <Hand pts={r.map(X)} color="#EAD8BC" />}
    </Svg>
  );
}

function Body({ pose, closeUp }: { pose: Pt[]; closeUp: boolean }) {
  const [nose, ls, rs, le, re, lw, rw, lh, rh] = pose;
  const valid = (p: Pt) => p && (p[0] !== 0 || p[1] !== 0);
  // Caderas: si no se ven, se dibujan bajo los hombros.
  const hipL: Pt = valid(lh) ? lh : [ls[0] * 0.8, 2.4];
  const hipR: Pt = valid(rh) ? rh : [rs[0] * 0.8, 2.4];
  const torso = `M${ls[0]} ${ls[1]} L${rs[0]} ${rs[1]} L${hipR[0]} ${hipR[1]} L${hipL[0]} ${hipL[1]} Z`;
  const head: Pt = valid(nose) ? nose : [0, -0.9];
  return (
    <G>
      <Path d={torso} fill={closeUp ? palette.cream : palette.seafoam} stroke={closeUp ? palette.cream : palette.seafoam} strokeWidth={0.35} strokeLinejoin="round" />
      <Line x1={0} y1={0} x2={head[0]} y2={head[1] + 0.25} stroke={closeUp ? palette.cream : palette.seafoam} strokeWidth={0.28} />
      <Circle cx={head[0]} cy={head[1] - 0.05} r={0.42} fill={palette.oceanTeal} />
      {[
        [ls, le, lw],
        [rs, re, rw],
      ].map((arm, k) =>
        valid(arm[1]) ? (
          <Path
            key={k}
            d={`M${arm[0][0]} ${arm[0][1]} L${arm[1][0]} ${arm[1][1]}${valid(arm[2]) ? ` L${arm[2][0]} ${arm[2][1]}` : ''}`}
            stroke={palette.oceanTeal}
            strokeWidth={0.26}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        ) : null,
      )}
    </G>
  );
}

/**
 * Mano: palma + dedos como "huesos" redondeados con contorno, para que se
 * distinga cada dedo. Se agranda desde la muñeca (como en las ilustraciones de
 * lengua de señas): a escala real la forma de la mano no se alcanza a leer.
 */
function Hand({ pts: raw, color, scale = 1.7, w = 0.1 }: { pts: Pt[]; color: string; scale?: number; w?: number }) {
  const [wx, wy] = raw[0];
  const pts = raw.map(([x, y]) => [wx + (x - wx) * scale, wy + (y - wy) * scale] as Pt);
  const palm = PALM.map((k) => `${pts[k][0]} ${pts[k][1]}`).join(' L');
  const chains = FINGERS.map((chain) => chain.map((j, n) => `${n ? 'L' : 'M'}${pts[j][0]} ${pts[j][1]}`).join(' '));
  const edge = palette.deepOcean;
  return (
    <G>
      {/* contorno */}
      <Path d={`M${palm} Z`} fill={edge} stroke={edge} strokeWidth={w * 1.9} strokeLinejoin="round" opacity={0.35} />
      {chains.map((d, k) => (
        <Path key={`e${k}`} d={d} stroke={edge} strokeWidth={w * 1.6} strokeLinecap="round" strokeLinejoin="round" fill="none" opacity={0.35} />
      ))}
      {/* relleno */}
      <Path d={`M${palm} Z`} fill={color} stroke={color} strokeWidth={w * 1.2} strokeLinejoin="round" />
      {chains.map((d, k) => (
        <Path key={k} d={d} stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      ))}
      {[4, 8, 12, 16, 20].map((j) => (
        <Circle key={j} cx={pts[j][0]} cy={pts[j][1]} r={w * 0.55} fill={palette.coral} />
      ))}
    </G>
  );
}

/** Mano estática de una letra (forma relativa a la muñeca, escala de palma). */
export function LetterHand({ letter, size = 120 }: { letter: LetterEntry; size?: number }) {
  const pts = letter.mano.map(([x, y]) => [x, y] as Pt);
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const pad = 0.4;
  const vb = `${Math.min(...xs) - pad} ${Math.min(...ys) - pad} ${Math.max(...xs) - Math.min(...xs) + pad * 2} ${Math.max(...ys) - Math.min(...ys) + pad * 2}`;
  return (
    <Svg width={size} height={size} viewBox={vb}>
      <Hand pts={pts} color={palette.sandyBeige} scale={1} w={0.22} />
    </Svg>
  );
}

export function useSign(id: string) {
  return useMemo(() => SIGNS.find((s) => s.id === id) ?? null, [id]);
}
