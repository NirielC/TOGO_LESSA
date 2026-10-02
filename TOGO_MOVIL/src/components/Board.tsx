import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useConversation } from '../core/conversation/ConversationProvider';
import { colors, fonts, radius, space, type } from '../theme/tokens';
import { Torogoz } from './Torogoz';
import { Icon } from './ui';

/**
 * PIZARRA: lo que dijo la persona oyente, a pantalla completa y en letra
 * enorme, para leerlo a un brazo de distancia. "Girar" voltea el texto 180°
 * para quien está sentado enfrente del teléfono.
 *
 * Mientras se escucha, muestra el texto en vivo; al terminar, el texto final.
 */
export function Board() {
  const conv = useConversation();
  const insets = useSafeAreaInsets();
  const [flipped, setFlipped] = useState(false);
  const live = conv.voice.active;
  const text = live ? conv.voice.partial : conv.board?.text ?? '';
  const open = live || !!conv.board;

  const close = () => {
    if (live) conv.stopVoice();
    else conv.showBoard(null);
  };

  const size = text.length > 140 ? 30 : text.length > 70 ? 38 : 48;

  return (
    <Modal visible={open} animationType="fade" onRequestClose={close} statusBarTranslucent>
      <View style={[st.wrap, { paddingTop: insets.top + space.md, paddingBottom: insets.bottom + space.lg }]}>
        <View style={st.top}>
          <Torogoz state={live ? 'listening' : 'attentive'} size={44} />
          <Text style={st.label}>{live ? 'Escuchando…' : 'Te dijeron'}</Text>
        </View>

        <ScrollView contentContainerStyle={st.textBox} style={{ transform: [{ rotate: flipped ? '180deg' : '0deg' }] }}>
          <Text style={[st.text, { fontSize: size, lineHeight: size * 1.22 }, !text && st.placeholder]}>
            {text || (live ? 'Habla cerca del teléfono…' : '')}
          </Text>
        </ScrollView>

        <View style={st.actions}>
          <Pressable onPress={() => setFlipped((f) => !f)} style={st.secondary} accessibilityRole="button" accessibilityLabel="Girar el texto">
            <Icon name="screen-rotation" size={22} color={colors.text} />
            <Text style={st.secondaryText}>Girar</Text>
          </Pressable>
          <Pressable onPress={close} style={[st.primary, live && { backgroundColor: colors.live }]} accessibilityRole="button">
            <Icon name={live ? 'stop' : 'check'} size={22} color={colors.onPrimary} />
            <Text style={st.primaryText}>{live ? 'Terminar' : 'Listo'}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.voiceSoft, paddingHorizontal: space.xl },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  label: { ...type.label, fontSize: 14, color: colors.voiceInk },
  textBox: { flexGrow: 1, justifyContent: 'center', paddingVertical: space.xl },
  text: { fontFamily: fonts.bodyBold, color: colors.text },
  placeholder: { color: colors.textFaint, fontSize: 28 },
  actions: { flexDirection: 'row', gap: space.md },
  secondary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 56, paddingHorizontal: space.xl, borderRadius: radius.pill, backgroundColor: colors.surface },
  secondaryText: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.text },
  primary: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 56, borderRadius: radius.pill, backgroundColor: colors.primary },
  primaryText: { fontFamily: fonts.bodyBold, fontSize: 17, color: colors.onPrimary },
});
