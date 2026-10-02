import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useConversation } from '../core/conversation/ConversationProvider';
import * as stt from '../core/voice/stt';
import { colors, fonts, radius, space, type } from '../theme/tokens';
import { Icon, IconButton } from './ui';

/**
 * EL MICRÓFONO = CAMBIO DE TURNO.
 * Tocarlo: las señas se pausan y lo que se dice aparece en vivo en la pizarra
 * (letra enorme). Al callar, queda en la conversación y vuelve el turno.
 * Si algo falla, el aviso se queda visible con una salida concreta:
 * descargar el español o escribir la respuesta.
 */
export function ListenBar({ label, hint }: { label: string; hint: string }) {
  const conv = useConversation();
  const [text, setText] = useState('');
  const [typing, setTyping] = useState(false);
  const listening = conv.state.turn === 'listener' && conv.voice.active;

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

  const sendTyped = () => {
    if (text.trim()) conv.ingestListenerText(text);
    setText('');
    setTyping(false);
    conv.clearVoiceError();
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

  return (
    <View style={st.wrap}>
      {conv.voice.error && !listening && (
        <View style={st.error}>
          <Icon name="alert-circle-outline" size={20} color={colors.danger} />
          <Text style={[type.small, { flex: 1, color: colors.text }]}>{conv.voice.error}</Text>
          <IconButton icon="close" label="Cerrar aviso" onPress={conv.clearVoiceError} size={18} color={colors.textMuted} />
          <View style={st.errorActions}>
            {conv.voice.needsLanguage && (
              <Pressable style={st.errorBtn} onPress={() => stt.downloadSpanish().catch(() => {})}>
                <Icon name="download" size={16} color={colors.primary} />
                <Text style={st.errorBtnText}>Descargar español</Text>
              </Pressable>
            )}
            <Pressable style={st.errorBtn} onPress={() => setTyping(true)}>
              <Icon name="keyboard-outline" size={16} color={colors.primary} />
              <Text style={st.errorBtnText}>Escribir respuesta</Text>
            </Pressable>
          </View>
        </View>
      )}
      <Pressable
        onPress={() => (listening ? conv.stopVoice() : conv.startVoice())}
        onLongPress={() => setTyping(true)}
        style={({ pressed }) => [st.bar, listening && { backgroundColor: colors.live }, pressed && { opacity: 0.9 }]}
        accessibilityRole="button"
        accessibilityLabel={listening ? 'Terminar de escuchar' : label}
        accessibilityHint="Mantén presionado para escribir la respuesta"
      >
        <View style={st.micBox}>
          {!listening && <Animated.View style={[st.ring, { transform: [{ scale: ringScale }], opacity: ringOpacity }]} />}
          <View style={[st.mic, listening && { backgroundColor: colors.surface }]}>
            <Icon name={listening ? 'stop' : 'microphone'} size={28} color={listening ? colors.live : colors.ink} />
          </View>
        </View>
        <View style={st.texts}>
          <Text style={st.title}>{listening ? 'Escuchando…' : label}</Text>
          <Text style={st.hint} numberOfLines={2}>{listening ? 'Toca para terminar' : hint}</Text>
        </View>
      </Pressable>
    </View>
  );
}

const st = StyleSheet.create({
  wrap: { paddingHorizontal: space.md, paddingTop: space.sm, paddingBottom: space.sm, gap: space.sm },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.md, backgroundColor: colors.ink, borderRadius: radius.pill, padding: space.sm, paddingRight: space.xl },
  texts: { flexShrink: 1, alignItems: 'center' },
  micBox: { width: 60, height: 60, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: 60, height: 60, borderRadius: 30, backgroundColor: colors.voice },
  mic: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.voice, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: fonts.title, fontSize: 19, color: colors.onInk, textAlign: 'center' },
  hint: { fontFamily: fonts.body, fontSize: 13, color: colors.voice, textAlign: 'center' },
  typeRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.voice, padding: 4, gap: 4 },
  input: { flex: 1, ...type.body, paddingVertical: 8 },
  error: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm, backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.md, borderWidth: 1, borderColor: colors.border },
  errorActions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, width: '100%' },
  errorBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.surfaceAlt, borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: 8 },
  errorBtnText: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.primary },
});
