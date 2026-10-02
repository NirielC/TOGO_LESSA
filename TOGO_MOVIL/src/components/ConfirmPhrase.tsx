import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useConversation } from '../core/conversation/ConversationProvider';
import { colors, fonts, radius, space, type } from '../theme/tokens';
import { Torogoz } from './Torogoz';
import { Icon } from './ui';

/**
 * "¿QUISISTE DECIR…?" — la frase reconocida, en grande, antes de decirla.
 *
 * Sirve en los dos escenarios:
 *   - Si el teléfono lo tiene quien oye: lo gira hacia quien seña ("Girar"),
 *     quien seña asiente o niega, y se toca Sí o No.
 *   - Si lo tiene quien seña (cámara frontal): lo ve y lo confirma él mismo.
 * Así quien seña sabe qué se entendió, y una frase mal reconocida no se dice.
 */
export function ConfirmPhrase() {
  const conv = useConversation();
  const [flipped, setFlipped] = useState(false);
  const text = conv.state.pending;
  if (!text) return null;
  const size = text.length > 60 ? 30 : 38;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={conv.rejectPending} statusBarTranslucent>
      <View style={st.backdrop}>
        <View style={st.card}>
          <View style={[st.top, flipped && st.flipped]}>
            <Torogoz state="thinking" size={52} lively={false} />
            <Text style={st.question}>¿Quisiste decir…?</Text>
            <Text style={[st.text, { fontSize: size, lineHeight: size * 1.2 }]}>{text}</Text>
          </View>
          <View style={st.row}>
            <Pressable onPress={conv.rejectPending} style={[st.btn, st.no]} accessibilityRole="button" accessibilityLabel="No, descartar">
              <Icon name="close" size={22} color={colors.text} />
              <Text style={st.noText}>No</Text>
            </Pressable>
            <Pressable onPress={conv.confirmPending} style={[st.btn, st.yes]} accessibilityRole="button" accessibilityLabel="Sí, decirlo en voz alta">
              <Icon name="volume-high" size={22} color={colors.onPrimary} />
              <Text style={st.yesText}>Sí, decirlo</Text>
            </Pressable>
          </View>
          <Pressable onPress={() => setFlipped((f) => !f)} style={st.flip} hitSlop={8}>
            <Icon name="screen-rotation" size={18} color={colors.primary} />
            <Text style={st.flipText}>Girar para que lo lea quien seña</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', padding: space.lg },
  card: { backgroundColor: colors.bg, borderRadius: radius.xl, padding: space.xl, gap: space.lg },
  top: { alignItems: 'center', gap: space.sm },
  flipped: { transform: [{ rotate: '180deg' }] },
  question: { ...type.label, fontSize: 14, color: colors.signInk },
  text: { fontFamily: fonts.title, color: colors.text, textAlign: 'center' },
  row: { flexDirection: 'row', gap: space.md },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 58, borderRadius: radius.pill },
  no: { flex: 1, backgroundColor: colors.surfaceAlt },
  yes: { flex: 2, backgroundColor: colors.primary },
  noText: { fontFamily: fonts.bodyBold, fontSize: 17, color: colors.text },
  yesText: { fontFamily: fonts.bodyBold, fontSize: 17, color: colors.onPrimary },
  flip: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  flipText: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.primary },
});
