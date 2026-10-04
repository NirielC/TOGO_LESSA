import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useConversation } from '../core/conversation/ConversationProvider';
import type { DraftPart } from '../core/conversation/reducer';
import { colors, fonts, radius, space, type } from '../theme/tokens';
import { Icon, IconButton } from './ui';

/**
 * FRASE EN CURSO, como un subtítulo que se va escribiendo:
 *   Hola · ¿Cómo estás? · Mi nombre es · ANA⌫ · (formándose…)
 * Antes cada seña era una pastilla: con muchas señas seguidas las primeras se
 * salían del cuadro. Ahora todo es texto que se acomoda en líneas, cabe mucho
 * más y la letra se achica sola si la frase crece. Tocar una parte la quita.
 * Lo que se acaba de agregar se ilumina un momento.
 */
export function DraftBar() {
  const { state, live, sendDraft, removePart, discardDraft, letterBackspace } = useConversation();
  const scroll = useRef<ScrollView>(null);
  const glow = useRef(new Animated.Value(0)).current;
  const count = state.draft.length;

  useEffect(() => {
    const t = setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50);
    return () => clearTimeout(t);
  }, [state.draft, live.candidate]);

  useEffect(() => {
    if (!count) return;
    glow.setValue(1);
    Animated.timing(glow, { toValue: 0, duration: 900, useNativeDriver: false }).start();
  }, [count, glow]);

  if (state.turn !== 'signer') return null;
  const forming = live.candidate;
  if (!count && !forming) return null;

  const total = state.draft.reduce((n, p) => n + p.text.length, 0);
  const size = total > 90 ? 15 : total > 50 ? 17 : 20;
  const last = state.draft[count - 1];
  const bg = glow.interpolate({ inputRange: [0, 1], outputRange: [colors.surface, '#FDF3D6'] });

  return (
    <Animated.View style={[st.card, { backgroundColor: bg }]}>
      <View style={st.head}>
        <Icon name="hand-back-right-outline" size={14} color={colors.signInk} />
        <Text style={st.label}>{count ? `FRASE EN CURSO · ${count} ${count === 1 ? 'PARTE' : 'PARTES'}` : 'ENTENDIENDO…'}</Text>
        {count > 0 && <Text style={st.tapHint}>toca una parte para quitarla</Text>}
      </View>
      <ScrollView ref={scroll} style={st.textBox} nestedScrollEnabled>
        <Text style={[st.sentence, { fontSize: size, lineHeight: size * 1.45 }]}>
          {state.draft.map((p, i) => (
            <Part key={p.id} p={p} first={i === 0} isLast={p === last} onRemove={() => removePart(p.id)} onBackspace={letterBackspace} />
          ))}
          {forming ? (
            <Text style={st.forming}>
              {count ? '  ·  ' : ''}
              {forming}…
            </Text>
          ) : null}
        </Text>
      </ScrollView>
      {forming ? (
        <View style={st.track}>
          <View style={[st.fill, { width: `${Math.round(live.progress * 100)}%` }]} />
        </View>
      ) : null}
      {count > 0 && (
        <View style={st.actions}>
          <Text style={[type.small, { flex: 1 }]} numberOfLines={1}>
            Baja las manos para decirlo
          </Text>
          <IconButton icon="delete-outline" label="Descartar frase" onPress={discardDraft} color={colors.textMuted} />
          <Pressable onPress={sendDraft} style={st.send} accessibilityRole="button" accessibilityLabel="Decir ahora">
            <Text style={st.sendText}>Decir</Text>
            <Icon name="volume-high" size={18} color={colors.onPrimary} />
          </Pressable>
        </View>
      )}
    </Animated.View>
  );
}

function Part({ p, first, isLast, onRemove, onBackspace }: { p: DraftPart; first: boolean; isLast: boolean; onRemove: () => void; onBackspace: () => void }) {
  const spelled = p.kind === 'deletreo';
  return (
    <Text>
      {!first && <Text style={st.sep}>{'  ·  '}</Text>}
      <Text
        onPress={spelled && isLast ? onBackspace : onRemove}
        style={[st.part, spelled && st.spelled, isLast && st.newest]}
        accessibilityRole="button"
        accessibilityLabel={spelled && isLast ? 'Borrar última letra' : `Quitar ${p.text}`}
      >
        {spelled ? p.text.toUpperCase() : p.text}
        <Text style={st.x}>{spelled && isLast ? ' ⌫' : ' ×'}</Text>
      </Text>
    </Text>
  );
}

const st = StyleSheet.create({
  card: { marginHorizontal: space.md, marginTop: space.sm, borderRadius: radius.lg, paddingTop: space.sm, paddingBottom: space.xs, borderWidth: 1.5, borderColor: colors.sign },
  head: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: space.md },
  label: { ...type.label, fontSize: 11, color: colors.signInk },
  tapHint: { ...type.small, fontSize: 11, flex: 1, textAlign: 'right', color: colors.textFaint },
  textBox: { maxHeight: 128, paddingHorizontal: space.md, marginTop: 2 },
  sentence: { fontFamily: fonts.bodyBold, color: colors.text },
  part: { color: colors.text },
  spelled: { fontFamily: fonts.title, letterSpacing: 2, color: '#8A5A12' },
  newest: { color: colors.signInk, textDecorationLine: 'underline', textDecorationColor: colors.sign },
  x: { fontFamily: fonts.body, color: colors.textFaint, fontSize: 14 },
  sep: { color: colors.sign },
  forming: { fontFamily: fonts.bodyMedium, color: colors.textFaint, fontStyle: 'italic' },
  track: { height: 4, borderRadius: 2, backgroundColor: colors.signSoft, overflow: 'hidden', marginHorizontal: space.md, marginTop: 4 },
  fill: { height: 4, backgroundColor: colors.sign },
  actions: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.md, gap: space.xs },
  send: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.primary, paddingHorizontal: space.lg, height: 40, borderRadius: radius.pill },
  sendText: { fontFamily: fonts.bodyBold, color: colors.onPrimary, fontSize: 15 },
});
