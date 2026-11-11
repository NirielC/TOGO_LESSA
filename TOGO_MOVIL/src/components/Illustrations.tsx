import { useFocusEffect } from 'expo-router';
import React, { useCallback, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';
import { useMenosMovimiento } from '../core/movimiento';
import { palette } from '../theme/tokens';

/**
 * Escenas de los dos modos. Formas planas y redondas, la paleta completa y
 * pocas piezas: que se entienda de un vistazo qué hace cada modo.
 *
 * Están en capas (cada una su propio Svg) para animarlas con el driver nativo:
 * un solo reloj por escena que gira solo mientras el inicio está a la vista, y
 * nada se mueve si el teléfono pide reducir movimiento.
 */

/** Reloj 0 → 1 en bucle mientras la pantalla está a la vista. */
function useReloj(ms: number) {
  const t = useRef(new Animated.Value(0)).current;
  const menos = useMenosMovimiento();
  useFocusEffect(
    useCallback(() => {
      if (menos) return;
      const loop = Animated.loop(Animated.timing(t, { toValue: 1, duration: ms, easing: Easing.linear, useNativeDriver: true }));
      loop.start();
      return () => loop.stop();
    }, [menos, ms, t]),
  );
  return t;
}

/** Curva seno muestreada para `interpolate`: `vueltas` ciclos por vuelta del reloj. */
function seno(min: number, max: number, vueltas = 1, fase = 0, n = 24) {
  const inputRange = Array.from({ length: n + 1 }, (_, i) => i / n);
  const outputRange = inputRange.map((x) => min + (max - min) * (0.5 + 0.5 * Math.sin(2 * Math.PI * (vueltas * x + fase))));
  return { inputRange, outputRange };
}

/** Un golpe corto alrededor de `en` (0-1): de `base` a `pico` y de vuelta. */
function pulso(en: number, base: number, pico: number, ancho = 0.06) {
  return { inputRange: [0, en - ancho, en, en + ancho, 1], outputRange: [base, base, pico, base, base] };
}

const capa = (width: number, height: number) => ({ position: 'absolute' as const, left: 0, top: 0, width, height });

/**
 * LEER SEÑAS: el teléfono ve una mano como la ve la app, con sus puntos
 * (muñeca, nudillos, puntas) y lo convierte en un mensaje que suena.
 * Animación: la mano saluda desde la muñeca y el globo "suena".
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
  const t = useReloj(2600);
  const pt = (i: number) => ({ x: 58 + HAND[i][0] * 0.95, y: 64 + HAND[i][1] * 0.95 });
  const L = capa(width, height);
  const lienzo = (children: React.ReactNode) => (
    <Svg width={width} height={height} viewBox="0 0 160 120">
      {children}
    </Svg>
  );
  const s = seno(-6, 6, 2);
  const saludo = t.interpolate({ inputRange: s.inputRange, outputRange: s.outputRange.map((v) => `${v}deg`) });
  const lineas = t.interpolate(seno(0.25, 1, 2, 0.25));
  const pop = t.interpolate(pulso(0.62, 1, 1.12));
  const sonido = t.interpolate({ inputRange: [0, 0.6, 0.68, 0.85, 1], outputRange: [0.25, 0.25, 1, 0.25, 0.25] });

  return (
    <View style={{ width, height }}>
      <View style={L}>
        {lienzo(
          <>
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
          </>,
        )}
      </View>
      {/* Mano: puntos y líneas, como la dibuja la app; saluda girando desde la muñeca */}
      <Animated.View style={[L, { transformOrigin: '36.25% 77.1%', transform: [{ rotate: saludo }] }]}>
        {lienzo(
          <>
            <G stroke={palette.oceanTeal} strokeWidth={2.4} strokeLinecap="round">
              {BONES.map(([a, b]) => (
                <Path key={`${a}-${b}`} d={`M${pt(a).x} ${pt(a).y} L${pt(b).x} ${pt(b).y}`} />
              ))}
            </G>
            {HAND.map((_, i) => (
              <Circle key={i} cx={pt(i).x} cy={pt(i).y} r={TIPS.has(i) ? 3 : 2.1} fill={TIPS.has(i) ? palette.coral : palette.sun} />
            ))}
          </>,
        )}
      </Animated.View>
      {/* Saludo en movimiento */}
      <Animated.View style={[L, { opacity: lineas }]}>
        {lienzo(
          <G stroke={palette.coral} strokeWidth={2} strokeLinecap="round" fill="none">
            <Path d="M70 30 q5 -4 9 0" />
            <Path d="M73 24 q6 -5 12 0" />
          </G>,
        )}
      </Animated.View>
      {/* Lo que entendió: un globo que suena */}
      <Animated.View style={[L, { transformOrigin: '68% 45%', transform: [{ scale: pop }] }]}>
        {lienzo(
          <G>
            <Rect x={102} y={18} width={48} height={34} rx={13} fill={palette.white} />
            <Path d="M108 50 L100 62 L120 51 Z" fill={palette.white} />
            <Rect x={111} y={28} width={30} height={5} rx={2.5} fill={palette.oceanTeal} />
            <Rect x={111} y={38} width={20} height={5} rx={2.5} fill={palette.seafoam} />
          </G>,
        )}
      </Animated.View>
      <Animated.View style={[L, { opacity: sonido }]}>
        {lienzo(
          <G stroke={palette.deepOcean} strokeWidth={2.6} fill="none" strokeLinecap="round">
            <Path d="M154 26 q5 8 0 16" />
          </G>,
        )}
      </Animated.View>
    </View>
  );
}

/**
 * DAR VOZ: un globo de diálogo que suena; teclado y frases.
 * Animación: el globo flota, las ondas laten y las teclas se presionan una tras otra.
 */
export function VoiceScene({ width = 160, height = 120 }: { width?: number; height?: number }) {
  const t = useReloj(2400);
  const k = width / 160; // de unidades del dibujo a píxeles
  const L = capa(width, height);
  const lienzo = (children: React.ReactNode) => (
    <Svg width={width} height={height} viewBox="0 0 160 120">
      {children}
    </Svg>
  );
  const flota = t.interpolate(seno(0, -3.5 * k, 1));
  const ondas = t.interpolate(seno(0.3, 1, 2));
  const ondasX = t.interpolate(seno(0, 2.5 * k, 2));
  const tecla = (en: number) => t.interpolate(pulso(en, 0, 3 * k, 0.05));

  return (
    <View style={{ width, height }}>
      <View style={L}>{lienzo(<Circle cx={36} cy={28} r={22} fill={palette.coral} opacity={0.85} />)}</View>
      {/* Globo principal */}
      <Animated.View style={[L, { transform: [{ translateY: flota }] }]}>
        {lienzo(
          <G>
            <Rect x={46} y={20} width={86} height={52} rx={18} fill={palette.white} />
            <Path d="M66 70 L58 86 L80 70 Z" fill={palette.white} />
            <Rect x={60} y={34} width={52} height={7} rx={3.5} fill={palette.oceanTeal} />
            <Rect x={60} y={48} width={36} height={7} rx={3.5} fill={palette.seafoam} />
          </G>,
        )}
      </Animated.View>
      {/* Ondas de sonido */}
      <Animated.View style={[L, { opacity: ondas, transform: [{ translateX: ondasX }] }]}>
        {lienzo(
          <G stroke={palette.deepOcean} strokeWidth={4} fill="none" strokeLinecap="round">
            <Path d="M140 36 q8 10 0 20" />
            <Path d="M148 30 q13 16 0 32" opacity={0.6} />
          </G>,
        )}
      </Animated.View>
      {/* Teclas */}
      <Animated.View style={[L, { transform: [{ translateY: tecla(0.15) }] }]}>{lienzo(<Rect x={20} y={84} width={18} height={14} rx={4} fill={palette.sun} />)}</Animated.View>
      <Animated.View style={[L, { transform: [{ translateY: tecla(0.35) }] }]}>{lienzo(<Rect x={42} y={88} width={18} height={14} rx={4} fill={palette.sandyBeige} />)}</Animated.View>
      <Animated.View style={[L, { transform: [{ translateY: tecla(0.55) }] }]}>{lienzo(<Rect x={102} y={86} width={34} height={14} rx={4} fill={palette.sun} />)}</Animated.View>
    </View>
  );
}
