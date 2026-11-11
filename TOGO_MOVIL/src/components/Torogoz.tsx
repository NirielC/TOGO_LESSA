import * as Haptics from 'expo-haptics';
import React, { useEffect, useId, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, Stop } from 'react-native-svg';
import type { Mascot } from '../core/conversation/ConversationProvider';
import { colors, fonts, palette, radius } from '../theme/tokens';
import { PixelTogo } from './PixelTogo';
import { ALA, cabeza, CUERPO, extras, GRADIENTES, SOMBRA, type Forma } from './togoArte';

/**
 * TOGO, el torogoz gordito (ave nacional de El Salvador). Es el asistente de
 * la app: indica el estado y da consejos.
 *
 *   sleeping     cámara en pausa o nadie en cuadro
 *   attentive    te estoy viendo
 *   thinking     una seña va tomando forma
 *   celebrating  seña aceptada (salta y aletea)
 *   confused     hay manos pero no entendí (ladea la cabeza)
 *   listening    turno de quien habla (ondas de sonido)
 *
 * El dibujo está en togoArte.ts (lo comparten el ícono, la pantalla de carga y el
 * logo). Está hecho en capas (cuerpo, ala, cabeza) para moverse de verdad: respira,
 * parpadea, mira a los lados, aletea por su cuenta y reacciona al tocarlo.
 * Tiene una sombra en el suelo (se achica cuando salta), expresiones que flotan
 * (burbuja de pensamiento, Zzz, ?, destellos, ondas) y, con
 * `greet`, saluda saltando y aleteando al aparecer.
 * Al cambiar de estado da un pequeño rebote; las "zetas", los puntos de pensar
 * y las ondas de escuchar flotan.
 *
 * SECRETO: muy de vez en cuando Togo suelta una pista. Si lo tocas 8 veces
 * seguidas se vuelve de 8 bits un rato (PixelTogo).
 */
export const MASCOT_NAME = 'Togo';

const TAP_LINES = ['¡Hola! Soy Togo', '¡Pío!', 'Seña con calma, te sigo', 'Juntos nos entendemos', '¡Cosquillas no!', 'Aquí estoy para ayudarte'];
/** Pista del secreto: sale muy pocas veces (ver RARE_CHANCE). */
export const SECRET_HINT = 'Psst… si me tocas 8 veces seguidas, viajo a los 80 👾';
export const RARE_CHANCE = 0.06;
const RETRO_TAPS = 8;
const RETRO_MS = 9000;

interface Props {
  state?: Mascot;
  size?: number;
  style?: ViewStyle;
  /** Al tocarlo reacciona y dice algo; manteniéndolo presionado, baila. */
  interactive?: boolean;
  /** Texto fijo en globo (un saludo, un consejo). */
  say?: string | null;
  /** Comportamiento propio (mirar, aletear) cada pocos segundos. */
  lively?: boolean;
  /** Saluda (salta y aletea) al aparecer, por ejemplo al abrir la app. */
  greet?: boolean;
}

export function Torogoz({ state = 'attentive', size = 64, style, interactive = false, say = null, lively = true, greet = false }: Props) {
  const breath = useRef(new Animated.Value(0)).current;
  const hop = useRef(new Animated.Value(0)).current;
  const wing = useRef(new Animated.Value(0)).current;
  const head = useRef(new Animated.Value(0)).current;
  const spin = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(1)).current;
  const float = useRef(new Animated.Value(0)).current;
  const bubbleIn = useRef(new Animated.Value(0)).current;
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const taps = useRef({ n: 0, at: 0 });
  const [retro, setRetro] = useState(false);
  const [blink, setBlink] = useState(false);
  const [bubble, setBubble] = useState<string | null>(null);
  const bubbleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const busy = useRef(false);

  // Respiración.
  useEffect(() => {
    const d = state === 'sleeping' ? 1900 : 1200;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, { toValue: 1, duration: d, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(breath, { toValue: 0, duration: d, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [state, breath]);

  // Lo que flota alrededor (zetas, puntos, ondas).
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(float, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [float]);

  // Rebote breve al cambiar de estado: se nota que reaccionó.
  const firstState = useRef(true);
  useEffect(() => {
    if (firstState.current) {
      firstState.current = false;
      return;
    }
    pop.setValue(0.9);
    Animated.spring(pop, { toValue: 1, friction: 4, tension: 160, useNativeDriver: true }).start();
  }, [state, pop]);

  // Postura de la cabeza según el estado.
  useEffect(() => {
    const target = state === 'listening' ? -1 : state === 'confused' ? 1 : state === 'thinking' ? -0.4 : 0;
    Animated.spring(head, { toValue: target, friction: 5, useNativeDriver: true }).start();
    if (state === 'celebrating') celebrate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  // Parpadeo.
  useEffect(() => {
    if (state === 'sleeping' || state === 'celebrating') return;
    let t: ReturnType<typeof setTimeout>;
    const next = () => {
      t = setTimeout(() => {
        setBlink(true);
        setTimeout(() => setBlink(false), 130);
        next();
      }, 2500 + Math.random() * 2500);
    };
    next();
    return () => clearTimeout(t);
  }, [state]);

  // Vida propia: cada 5–9 s mira a un lado o aletea.
  useEffect(() => {
    if (!lively || state === 'sleeping' || state === 'listening') return;
    let t: ReturnType<typeof setTimeout>;
    const next = () => {
      t = setTimeout(() => {
        if (!busy.current) (Math.random() < 0.5 ? lookAround : flap)();
        next();
      }, 5000 + Math.random() * 4000);
    };
    next();
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lively, state]);

  useEffect(
    () => () => {
      if (bubbleTimer.current) clearTimeout(bubbleTimer.current);
    },
    [],
  );

  // Saludo al aparecer.
  useEffect(() => {
    if (!greet) return;
    const t = setTimeout(() => celebrate(), 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const run = (anim: Animated.CompositeAnimation) => {
    busy.current = true;
    anim.start(() => (busy.current = false));
  };

  function flap(times = 2) {
    const one = [
      Animated.timing(wing, { toValue: 1, duration: 110, useNativeDriver: true }),
      Animated.timing(wing, { toValue: 0, duration: 130, useNativeDriver: true }),
    ];
    run(Animated.sequence(Array.from({ length: times }, () => one).flat()));
  }
  function lookAround() {
    run(
      Animated.sequence([
        Animated.timing(head, { toValue: -1.2, duration: 260, useNativeDriver: true }),
        Animated.delay(350),
        Animated.timing(head, { toValue: 1.2, duration: 380, useNativeDriver: true }),
        Animated.delay(250),
        Animated.spring(head, { toValue: 0, friction: 5, useNativeDriver: true }),
      ]),
    );
  }
  function jump(height = 1) {
    return Animated.sequence([
      Animated.timing(hop, { toValue: height, duration: 170, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.spring(hop, { toValue: 0, friction: 3.5, tension: 120, useNativeDriver: true }),
    ]);
  }
  function celebrate() {
    run(Animated.parallel([jump(1), Animated.sequence([0, 1, 2].map(() => Animated.sequence([
      Animated.timing(wing, { toValue: 1, duration: 90, useNativeDriver: true }),
      Animated.timing(wing, { toValue: 0, duration: 110, useNativeDriver: true }),
    ])))]));
  }
  function twirl() {
    spin.setValue(0);
    run(Animated.parallel([jump(0.8), Animated.timing(spin, { toValue: 1, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: true })]));
  }
  function dance() {
    run(
      Animated.sequence([
        Animated.parallel([jump(0.6), Animated.timing(head, { toValue: 1, duration: 200, useNativeDriver: true })]),
        Animated.parallel([jump(0.6), Animated.timing(head, { toValue: -1, duration: 200, useNativeDriver: true })]),
        Animated.parallel([jump(0.9), Animated.timing(wing, { toValue: 1, duration: 150, useNativeDriver: true })]),
        Animated.parallel([Animated.spring(head, { toValue: 0, useNativeDriver: true }), Animated.timing(wing, { toValue: 0, duration: 150, useNativeDriver: true })]),
      ]),
    );
  }

  const talk = (line: string, ms = 2000) => {
    setBubble(line);
    if (bubbleTimer.current) clearTimeout(bubbleTimer.current);
    bubbleTimer.current = setTimeout(() => setBubble(null), ms);
  };

  const goRetro = () => {
    setRetro(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    talk('¡MODO 8-BIT! Pío pío 👾', 3000);
    setTimeout(() => {
      setRetro(false);
      talk('…¿qué pasó? Me sentí retro', 2500);
    }, RETRO_MS);
  };

  const onPress = () => {
    Haptics.selectionAsync().catch(() => {});
    const now = Date.now();
    taps.current = { n: now - taps.current.at < 700 ? taps.current.n + 1 : 1, at: now };
    if (taps.current.n >= RETRO_TAPS && !retro) {
      taps.current.n = 0;
      jump(1).start();
      return goRetro();
    }
    const r = Math.random();
    if (r < 0.4) celebrate();
    else if (r < 0.7) twirl();
    else lookAround();
    const rare = Math.random() < RARE_CHANCE;
    talk(rare ? SECRET_HINT : TAP_LINES[Math.floor(Math.random() * TAP_LINES.length)], rare ? 3500 : 2000);
  };
  const onLongPress = () => {
    dance();
    talk('¡A bailar! 🎶', 1800);
  };

  const breathe = breath.interpolate({ inputRange: [0, 1], outputRange: [1, state === 'sleeping' ? 1.03 : 1.018] });
  const lift = Animated.add(
    breath.interpolate({ inputRange: [0, 1], outputRange: [0, -size * 0.02] }),
    hop.interpolate({ inputRange: [0, 1], outputRange: [0, -size * 0.2] }),
  );
  const squash = hop.interpolate({ inputRange: [0, 0.15, 1], outputRange: [1, 0.93, 1.05] });
  const spinDeg = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const headDeg = head.interpolate({ inputRange: [-1.2, 1.2], outputRange: ['-14deg', '14deg'] });
  const wingDeg = wing.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-38deg'] });
  const text = bubble ?? say;
  // La sombra se queda en el suelo: cuando salta, se achica y se aclara.
  const shadowScale = hop.interpolate({ inputRange: [0, 1], outputRange: [1, 0.55] });
  const shadowOpacity = hop.interpolate({ inputRange: [0, 1], outputRange: [1, 0.4] });

  // El globo aparece con un pequeño "pop".
  useEffect(() => {
    if (!text) return;
    bubbleIn.setValue(0);
    Animated.spring(bubbleIn, { toValue: 1, friction: 5, tension: 140, useNativeDriver: true }).start();
  }, [text, bubbleIn]);
  const floatY = float.interpolate({ inputRange: [0, 1], outputRange: [0, state === 'sleeping' ? -size * 0.08 : -size * 0.03] });
  const floatOpacity = float.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.45, 1, 0.45] });

  const layer = { position: 'absolute' as const, left: 0, top: 0, width: size, height: size };
  const bird = (
    <Animated.View style={{ width: size, height: size, transform: [{ translateY: lift }, { scaleY: squash }, { scale: breathe }, { scale: pop }, { rotate: spinDeg }] }}>
      {retro ? (
        <PixelTogo size={size} />
      ) : (
      <>
      <View style={layer}>
        <Capa size={size} formas={CUERPO} uid={`${uid}c`} />
      </View>
      <Animated.View style={[layer, { transformOrigin: '47% 50%', transform: [{ rotate: wingDeg }] }]}>
        <Capa size={size} formas={ALA} uid={`${uid}a`} />
      </Animated.View>
      <Animated.View style={[layer, { transformOrigin: '56% 47%', transform: [{ rotate: headDeg }] }]}>
        <Capa size={size} formas={cabeza(state, blink)} uid={`${uid}h`} />
      </Animated.View>
      <Animated.View style={[layer, { opacity: floatOpacity, transform: [{ translateY: floatY }] }]}>
        <Capa size={size} formas={extras(state)} uid={`${uid}x`} />
      </Animated.View>
      </>
      )}
    </Animated.View>
  );

  return (
    <View style={[{ alignItems: 'center' }, style]}>
      {text ? (
        <Animated.View style={[st.bubble, { opacity: bubbleIn, transform: [{ scale: bubbleIn.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }] }]}>
          <Text style={[st.bubbleText, size < 90 && { fontSize: 12 }]}>{text}</Text>
          <View style={st.bubbleTail} />
        </Animated.View>
      ) : null}
      <View style={{ width: size, height: size }}>
        <Animated.View pointerEvents="none" style={[layer, { opacity: shadowOpacity, transformOrigin: '48% 95.5%', transform: [{ scaleX: shadowScale }] }]}>
          <Capa size={size} formas={SOMBRA} uid={`${uid}s`} />
        </Animated.View>
        {interactive ? (
          <Pressable onPress={onPress} onLongPress={onLongPress} accessibilityRole="button" accessibilityLabel={`${MASCOT_NAME}, el asistente`} hitSlop={8}>
            {bird}
          </Pressable>
        ) : (
          bird
        )}
      </View>
    </View>
  );
}

/** Una capa de Togo: las formas de togoArte.ts, con sus degradados. */
function Capa({ size, formas, uid }: { size: number; formas: Forma[]; uid: string }) {
  if (!formas.length) return null;
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        {GRADIENTES.map((g) => (
          <LinearGradient key={g.id} id={`${g.id}${uid}`} x1={g.x1} y1={g.y1} x2={g.x2} y2={g.y2}>
            {g.stops.map(([o, c]) => (
              <Stop key={o} offset={o} stopColor={c} />
            ))}
          </LinearGradient>
        ))}
      </Defs>
      <Formas formas={formas} uid={uid} />
    </Svg>
  );
}

function Formas({ formas, uid }: { formas: Forma[]; uid: string }) {
  return (
    <>
      {formas.map(({ t, hijos, fill, ...p }, i) => {
        const relleno = fill?.startsWith('grad:') ? `url(#${fill.slice(5)}${uid})` : fill;
        if (t === 'g')
          return (
            <G key={i} {...p} fill={relleno}>
              <Formas formas={hijos ?? []} uid={uid} />
            </G>
          );
        if (t === 'circle') return <Circle key={i} {...p} fill={relleno} />;
        if (t === 'ellipse') return <Ellipse key={i} {...p} fill={relleno} />;
        return <Path key={i} {...p} fill={relleno} />;
      })}
    </>
  );
}

export const MASCOT_TEXT: Record<Mascot, string> = {
  sleeping: 'Togo descansa',
  attentive: 'Togo te está viendo',
  thinking: 'Togo está entendiendo…',
  celebrating: '¡Entendido!',
  confused: 'No entendí, repite la seña más despacio',
  listening: 'Togo escucha',
};

const st = StyleSheet.create({
  bubble: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 6,
    maxWidth: 260,
    shadowColor: palette.deepOcean,
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  bubbleText: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.text, textAlign: 'center' },
  bubbleTail: {
    position: 'absolute',
    bottom: -6,
    alignSelf: 'center',
    width: 12,
    height: 12,
    backgroundColor: colors.surface,
    transform: [{ rotate: '45deg' }],
  },
});
