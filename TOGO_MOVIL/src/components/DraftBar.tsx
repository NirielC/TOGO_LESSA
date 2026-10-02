import React, { useEffect, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useConversation } from '../core/conversation/ConversationProvider';
import { colors, fonts, radius, space, type } from '../theme/tokens';
import { Icon, IconButton } from './ui';

/**
 * FRASE EN CURSO. Lo reconocido aún no se ha dicho: se puede corregir.
 *   [Mi nombre es ×] [A N A ⌫]
 *   [¿Cómo estás? ×] ...                 [Decir]
 * Las piezas se acomodan en varias líneas (antes era una fila infinita hacia
 * la derecha y lo anterior se perdía de vista); baja sola a lo último.
 * Las letras deletreadas se juntan solas en una palabra. La pastilla punteada
 * es lo que se está formando ahora, con su barra de progreso.
 */
export function DraftBar() {
  const { state, live, sendDraft, removePart, discardDraft, letterBackspace } = useConversation();
  const scroll = useRef<ScrollView>(null);
  useEffect(() => {
    const t = setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50);
    return () => clearTimeout(t);
  }, [state.draft, live.candidate]);
  if (state.turn !== 'signer') return null;
  const forming = live.candidate;
  if (!state.draft.length && !forming) return null;
  const last = state.draft[state.draft.length - 1];

  return (
    <View style={st.card}>
      <ScrollView ref={scroll} style={st.chipsBox} contentContainerStyle={st.chips} nestedScrollEnabled>
        {state.draft.map((p) =>
          p.kind === 'deletreo' ? (
            <View key={p.id} style={[st.chip, st.word]}>
              <Icon name="alphabetical-variant" size={16} color={colors.text} />
              <Text style={st.letters}>{p.text}</Text>
              {p === last ? (
                <Pressable onPress={letterBackspace} hitSlop={8} accessibilityLabel="Borrar última letra">
                  <Icon name="backspace-outline" size={16} color={colors.text} />
                </Pressable>
              ) : (
                <Pressable onPress={() => removePart(p.id)} hitSlop={8} accessibilityLabel={`Quitar ${p.text}`}>
                  <Icon name="close" size={14} color={colors.text} />
                </Pressable>
              )}
            </View>
          ) : (
            <Pressable key={p.id} onPress={() => removePart(p.id)} accessibilityLabel={`Quitar ${p.text}`} style={st.chip}>
              <Text style={st.chipText}>{p.text}</Text>
              <Icon name="close" size={14} color={colors.signInk} />
            </Pressable>
          ),
        )}
        {forming && (
          <View style={[st.chip, st.forming]}>
            <Text style={[st.chipText, { color: colors.textMuted }]}>{forming}</Text>
            <View style={st.track}>
              <View style={[st.fill, { width: `${Math.round(live.progress * 100)}%` }]} />
            </View>
          </View>
        )}
      </ScrollView>
      {state.draft.length > 0 && (
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
    </View>
  );
}

const st = StyleSheet.create({
  card: { marginHorizontal: space.md, marginTop: space.sm, backgroundColor: colors.surface, borderRadius: radius.lg, paddingVertical: space.sm, borderWidth: 1, borderColor: colors.border },
  chipsBox: { maxHeight: 104 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: space.md, gap: space.sm, alignItems: 'center' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.signSoft, paddingHorizontal: space.md, paddingVertical: 8, borderRadius: radius.pill },
  chipText: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.signInk },
  word: { backgroundColor: '#FCEFD2' },
  letters: { fontFamily: fonts.title, fontSize: 18, letterSpacing: 3, color: colors.text },
  forming: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colors.sign, borderStyle: 'dashed' },
  track: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.signSoft, overflow: 'hidden' },
  fill: { height: 4, backgroundColor: colors.sign },
  actions: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.md, gap: space.xs },
  send: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.primary, paddingHorizontal: space.lg, height: 40, borderRadius: radius.pill },
  sendText: { fontFamily: fonts.bodyBold, color: colors.onPrimary, fontSize: 15 },
});
