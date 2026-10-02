import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useConversation } from '../core/conversation/ConversationProvider';
import { useSettings } from '../core/settings';
import { colors, fonts, radius, space, type } from '../theme/tokens';
import { Icon, IconButton } from './ui';

/**
 * FRASES RÁPIDAS (del plan: reemplazan al historial).
 * Para quien no puede o no quiere hablar en voz alta —persona sorda, persona
 * con discapacidad del habla, o cuando la seña no está en el vocabulario del
 * modelo—: tocar una frase la dice en voz alta y la deja en la conversación.
 * Mantener presionado = quitarla.
 *
 * Es un panel dentro de la conversación, no una pantalla aparte: se abre y se
 * cierra sin navegación, así no puede quedar "atrapado".
 */
export function QuickPhrases({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { settings, update } = useSettings();
  const { sayTyped } = useConversation();
  const [nueva, setNueva] = useState('');
  const insets = useSafeAreaInsets();

  const add = () => {
    const t = nueva.trim();
    if (!t || settings.quickPhrases.includes(t)) return;
    update({ quickPhrases: [...settings.quickPhrases, t] });
    setNueva('');
  };

  const remove = (p: string) =>
    Alert.alert('Quitar frase', `"${p}"`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Quitar', style: 'destructive', onPress: () => update({ quickPhrases: settings.quickPhrases.filter((x) => x !== p) }) },
    ]);

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={st.backdrop} onPress={onClose} accessibilityLabel="Cerrar frases" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={[st.sheet, { paddingBottom: insets.bottom + space.lg }]}>
          <View style={st.grabber} />
          <View style={st.head}>
            <Text style={type.h1}>Frases rápidas</Text>
            <IconButton icon="close" label="Cerrar" onPress={onClose} />
          </View>
          <Text style={type.small}>Toca una frase para decirla en voz alta. Mantén presionado para quitarla.</Text>
          <ScrollView contentContainerStyle={st.list} keyboardShouldPersistTaps="handled">
            {settings.quickPhrases.map((p) => (
              <Pressable
                key={p}
                onPress={() => {
                  sayTyped(p, 'phrase');
                  onClose();
                }}
                onLongPress={() => remove(p)}
                style={({ pressed }) => [st.item, pressed && { backgroundColor: colors.signSoft }]}
              >
                <Text style={st.itemText}>{p}</Text>
                <Icon name="volume-high" size={20} color={colors.primary} />
              </Pressable>
            ))}
          </ScrollView>
          <View style={st.addRow}>
            <TextInput
              value={nueva}
              onChangeText={setNueva}
              placeholder="Agregar una frase"
              placeholderTextColor={colors.textFaint}
              style={st.input}
              onSubmitEditing={add}
              returnKeyType="done"
            />
            <IconButton icon="plus" label="Agregar frase" onPress={add} color={colors.onPrimary} bg={colors.primary} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const st = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.overlay },
  sheet: { backgroundColor: colors.bg, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, paddingHorizontal: space.xl, paddingTop: space.sm, gap: space.sm, maxHeight: 620 },
  grabber: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: colors.sand, marginBottom: space.xs },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  list: { gap: space.sm, paddingVertical: space.sm },
  item: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surface, borderRadius: radius.md, padding: space.lg, gap: space.md },
  itemText: { fontFamily: fonts.bodyBold, fontSize: 17, color: colors.text, flex: 1 },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  input: { flex: 1, ...type.body, backgroundColor: colors.surface, borderRadius: radius.md, paddingHorizontal: space.lg, height: 48, borderWidth: 1, borderColor: colors.border },
});
