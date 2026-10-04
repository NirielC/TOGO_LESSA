import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useConversation } from '../core/conversation/ConversationProvider';
import * as stt from '../core/voice/stt';
import { colors, fonts, radius, space, type } from '../theme/tokens';
import { Icon, IconButton } from './ui';

/**
 * LA RESPUESTA DE QUIEN OYE: hablando o escribiendo.
 *   [ 🎤 Escuchar respuesta ............ ] [ ⌨ Escribir ]
 * El micrófono es el cambio de turno: las señas se pausan y lo que se dice
 * aparece en vivo en la pizarra. "Escribir" está SIEMPRE a la vista: no
 * siempre se puede hablar (ruido, biblioteca, una persona que no quiere hablar).
 * Si el micrófono falla o no oyó nada, aparece un aviso que resalta escribir.
 */
export function ListenBar({ label, hint }: { label: string; hint: string }) {
  const conv = useConversation();
  const [text, setText] = useState('');
  const [typing, setTyping] = useState(false);
  const listening = conv.state.turn === 'listener' && conv.voice.active;
  const failed = !!conv.voice.error && !listening;

  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1400, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  // El aviso entra con un pequeño rebote para que se note.
  const pop = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!failed) return;
    pop.setValue(0);
    Animated.spring(pop, { toValue: 1, friction: 5, tension: 120, useNativeDriver: true }).start();
  }, [failed, conv.voice.error, pop]);

  const openTyping = () => {
    conv.clearVoiceError();
    setTyping(true);
  };

  const sendTyped = () => {
    if (text.trim()) conv.ingestListenerText(text);
    setText('');
    setTyping(false);
  };

  if (typing) {
    return (
      <View style={st.wrap}>
        <View style={st.typeRow}>
          <IconButton icon="close" label="Cancelar" onPress={() => setTyping(false)} color={colors.textMuted} />
          <TextInput
            autoFocus
            value={text}
            onChangeText={setText}
            placeholder="Escribe la respuesta"
            placeholderTextColor={colors.textFaint}
            style={st.input}
            returnKeyType="send"
            onSubmitEditing={sendTyped}
          />
          <IconButton icon="send" label="Enviar" onPress={sendTyped} color={colors.onPrimary} bg={colors.primary} size={20} />
        </View>
      </View>
    );
  }

  const ringScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] });
  const ringOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] });
  const popScale = pop.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] });

  return (
    <View style={st.wrap}>
      {failed && (
        <Animated.View style={[st.error, { opacity: pop, transform: [{ scale: popScale }] }]}>
          <View style={st.errorTop}>
            <View style={st.errorIcon}>
              <Icon name="exclamation-thick" size={18} color={colors.onPrimary} />
            </View>
            <Text style={st.errorText}>{conv.voice.error}</Text>
            <IconButton icon="close" label="Cerrar aviso" onPress={conv.clearVoiceError} size={18} color={colors.textMuted} />
          </View>
          <View style={st.errorActions}>
            <Pressable style={st.errorMain} onPress={openTyping} accessibilityRole="button">
              <Icon name="keyboard-outline" size={20} color={colors.onPrimary} />
              <Text style={st.errorMainText}>Escribir la respuesta</Text>
            </Pressable>
            {conv.voice.needsLanguage ? (
              <Pressable style={st.errorBtn} onPress={() => stt.downloadSpanish().catch(() => {})}>
                <Icon name="download" size={16} color={colors.primary} />
                <Text style={st.errorBtnText}>Descargar español</Text>
              </Pressable>
            ) : (
              <Pressable style={st.errorBtn} onPress={() => conv.startVoice()}>
                <Icon name="microphone" size={16} color={colors.primary} />
                <Text style={st.errorBtnText}>Otra vez</Text>
              </Pressable>
            )}
          </View>
        </Animated.View>
      )}
      <View style={st.row}>
        <Pressable
          onPress={() => (listening ? conv.stopVoice() : conv.startVoice())}
          style={({ pressed }) => [st.bar, listening && { backgroundColor: colors.live }, pressed && { opacity: 0.9 }]}
          accessibilityRole="button"
          accessibilityLabel={listening ? 'Terminar de escuchar' : label}
        >
          <View style={st.micBox}>
            {!listening && <Animated.View style={[st.ring, { transform: [{ scale: ringScale }], opacity: ringOpacity }]} />}
            <View style={[st.mic, listening && { backgroundColor: colors.surface }]}>
              <Icon name={listening ? 'stop' : 'microphone'} size={26} color={listening ? colors.live : colors.ink} />
            </View>
          </View>
          <View style={st.texts}>
            <Text style={st.title} numberOfLines={1}>{listening ? 'Escuchando…' : label}</Text>
            <Text style={st.hint} numberOfLines={2}>{listening ? 'Toca para terminar' : hint}</Text>
          </View>
        </Pressable>
        {!listening && (
          <Pressable
            onPress={openTyping}
            style={({ pressed }) => [st.write, failed && st.writeHot, pressed && { opacity: 0.8 }]}
            accessibilityRole="button"
            accessibilityLabel="Escribir la respuesta"
          >
            <Icon name="keyboard-outline" size={24} color={failed ? colors.onPrimary : colors.text} />
            <Text style={[st.writeText, failed && { color: colors.onPrimary }]}>Escribir</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  wrap: { paddingHorizontal: space.md, paddingTop: space.sm, paddingBottom: space.sm, gap: space.sm },
  row: { flexDirection: 'row', gap: space.sm, alignItems: 'stretch' },
  bar: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: colors.ink, borderRadius: radius.pill, padding: 6, paddingRight: space.lg },
  texts: { flexShrink: 1 },
  micBox: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: 56, height: 56, borderRadius: 28, backgroundColor: colors.voice },
  mic: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.voice, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: fonts.title, fontSize: 18, color: colors.onInk },
  hint: { fontFamily: fonts.body, fontSize: 12, lineHeight: 16, color: colors.voice },
  write: { width: 76, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.voice, alignItems: 'center', justifyContent: 'center', gap: 2 },
  writeHot: { backgroundColor: colors.danger, borderColor: colors.danger },
  writeText: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.text },
  typeRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.voice, padding: 4, gap: 4 },
  input: { flex: 1, ...type.body, paddingVertical: 8 },
  error: { backgroundColor: '#FDEDE8', borderRadius: radius.lg, padding: space.md, gap: space.sm, borderWidth: 1.5, borderColor: colors.danger },
  errorTop: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  errorIcon: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center' },
  errorText: { ...type.bodyStrong, fontSize: 14, lineHeight: 19, flex: 1 },
  errorActions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  errorMain: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.danger, borderRadius: radius.pill, paddingHorizontal: space.lg, height: 44 },
  errorMainText: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.onPrimary },
  errorBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.surface, borderRadius: radius.pill, paddingHorizontal: space.md, height: 44 },
  errorBtnText: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.primary },
});
