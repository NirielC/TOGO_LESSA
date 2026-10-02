import React, { useRef } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useConversation } from '../core/conversation/ConversationProvider';
import { useSettings } from '../core/settings';
import { KNOWN_LABELS, meaningOf, NO_SIGN_LABEL } from '../core/signs/vocabulary';
import { colors, fonts, radius, space, type } from '../theme/tokens';

/**
 * SOLO DESARROLLO (__DEV__). No es una función de la app: sirve para probar
 * la lógica de conversación en Expo Go antes de tener el motor nativo.
 * Emite exactamente los mismos eventos que emitirá el módulo Kotlin, así que
 * lo que funciona aquí funciona con el modelo real.
 */
const LETTERS = 'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ'.split('');

export function DevInjector({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { ingest } = useConversation();
  const [mode, setMode] = React.useState<'signs' | 'letters'>('signs');
  const { settings } = useSettings();
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const schedule = (fn: () => void, ms: number) => timers.current.push(setTimeout(fn, ms));

  /** Una seña sostenida: manos visibles + N ventanas con la misma etiqueta. */
  const sign = (label: string, m: 'signs' | 'letters', confidence = 0.95) => {
    const n = (m === 'letters' ? settings.letters : settings.signs).stabilityFrames + 1;
    for (let i = 0; i < n; i++) {
      schedule(() => {
        ingest({ type: 'status', quality: 'ok', hands: 1, fps: 20, latencyMs: 40 });
        ingest({ type: 'prediction', mode: m, label, confidence, margin: 0.8, handsVisible: true, ts: Date.now() });
        if (m === 'letters') ingest({ type: 'prediction', mode: 'signs', label: 'si', confidence: 0.3, margin: 0.05, handsVisible: true, ts: Date.now() });
      }, i * 120);
    }
    // Transición breve sin seña: suelta el latch, como pasa entre señas reales.
    for (let i = 0; i < 5; i++) {
      schedule(
        () => ingest({ type: 'prediction', mode: m, label: m === 'letters' ? settings.letters.noSignLabel : NO_SIGN_LABEL, confidence: 0.9, margin: 0.8, handsVisible: true, ts: Date.now() }),
        n * 120 + i * 120,
      );
    }
  };

  const handsDown = () => {
    const total = settings.finalizeAfterMs + 400;
    for (let t = 0; t <= total; t += 150) {
      schedule(() => ingest({ type: 'status', quality: 'no_hands', hands: 0, fps: 20, latencyMs: 40 }), t);
    }
  };

  const noise = () => {
    // Manos en cuadro con predicciones dudosas: no debe entrar nada y el torogoz se confunde.
    for (let i = 0; i < 30; i++) {
      schedule(() => {
        ingest({ type: 'status', quality: 'ok', hands: 1, fps: 20, latencyMs: 40 });
        ingest({ type: 'prediction', mode, label: i % 2 ? 'hola' : 'si', confidence: 0.55, margin: 0.05, handsVisible: true, ts: Date.now() });
      }, i * 120);
    }
  };

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={st.backdrop} onPress={onClose} />
      <View style={st.sheet}>
        <Text style={type.h2}>Simulador (solo desarrollo)</Text>
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <Chip text="Señas" onPress={() => setMode('signs')} strong={mode === 'signs'} />
          <Chip text="Letras" onPress={() => setMode('letters')} strong={mode === 'letters'} />
        </View>
        <ScrollView contentContainerStyle={st.grid}>
          {mode === 'signs'
            ? KNOWN_LABELS.map((l) => <Chip key={l} text={meaningOf(l).text} onPress={() => sign(l, 'signs')} />)
            : LETTERS.map((l) => <Chip key={l} text={l} onPress={() => sign(l, 'letters')} />)}
          <Chip text="✋ Bajar manos (envía)" onPress={handsDown} strong />
          <Chip text="🤷 Ruido / duda" onPress={noise} strong />
        </ScrollView>
      </View>
    </Modal>
  );
}

function Chip({ text, onPress, strong }: { text: string; onPress: () => void; strong?: boolean }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [st.chip, strong && st.chipStrong, pressed && { opacity: 0.6 }]}>
      <Text style={[st.chipText, strong && { color: colors.onPrimary }]}>{text}</Text>
    </Pressable>
  );
}

const st = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.25)' },
  sheet: { backgroundColor: colors.bg, padding: space.xl, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, maxHeight: '60%', gap: space.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, paddingVertical: space.md },
  chip: { paddingHorizontal: space.lg, paddingVertical: space.md, borderRadius: radius.pill, backgroundColor: colors.signSoft },
  chipStrong: { backgroundColor: colors.primary },
  chipText: { fontFamily: fonts.bodyBold, color: colors.signInk },
});
