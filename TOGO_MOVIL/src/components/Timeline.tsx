import React, { useEffect, useRef } from 'react';
import { Animated, Easing, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useConversation } from '../core/conversation/ConversationProvider';
import type { Message } from '../core/conversation/reducer';
import { colors, radius, space, type } from '../theme/tokens';
import { Torogoz } from './Torogoz';
import { ChannelTag, Icon, IconName } from './ui';

/**
 * Línea de tiempo única. Cada canal se distingue por lado, ícono, etiqueta y
 * color a la vez. El lado depende de quién tiene el teléfono:
 *   Leer señas -> quien seña a la izquierda, mi voz (oyente) a la derecha.
 *   Dar voz    -> lo que escribo yo a la derecha, la respuesta a la izquierda.
 * Tocar un mensaje: si es voz, se abre en la pizarra; si no, se repite en voz alta.
 */
type Perspective = 'senas' | 'voz';

const META: Record<Message['source'], { icon: IconName; tag: Record<Perspective, string> }> = {
  sign: { icon: 'hand-back-right-outline', tag: { senas: 'SEÑA', voz: 'SEÑA' } },
  typed: { icon: 'keyboard-outline', tag: { senas: 'ESCRITO', voz: 'YO' } },
  phrase: { icon: 'lightning-bolt-outline', tag: { senas: 'FRASE', voz: 'YO' } },
  voice: { icon: 'microphone-outline', tag: { senas: 'TÚ', voz: 'RESPUESTA' } },
};

export function Timeline({ perspective, empty, mascot = true }: { perspective: Perspective; empty: { title: string; text: string }; mascot?: boolean }) {
  const { state, repeat, showBoard } = useConversation();
  const list = useRef<FlatList<Message>>(null);

  useEffect(() => {
    const t = setTimeout(() => list.current?.scrollToEnd({ animated: true }), 60);
    return () => clearTimeout(t);
  }, [state.messages.length]);

  if (!state.messages.length) {
    return (
      <View style={st.empty}>
        {mascot && <Torogoz state="attentive" size={64} interactive />}
        <Text style={[type.h2, { textAlign: 'center' }]}>{empty.title}</Text>
        <Text style={[type.small, { textAlign: 'center' }]}>{empty.text}</Text>
      </View>
    );
  }

  return (
    <FlatList
      ref={list}
      data={state.messages}
      keyExtractor={(m) => m.id}
      contentContainerStyle={st.list}
      renderItem={({ item }) => (
        <Bubble m={item} perspective={perspective} onPress={() => (item.source === 'voice' ? showBoard(item) : repeat(item))} />
      )}
    />
  );
}

function Bubble({ m, perspective, onPress }: { m: Message; perspective: Perspective; onPress: () => void }) {
  const isVoice = m.source === 'voice';
  const meta = META[m.source];
  // Lado: en Leer señas la voz es "mía" (derecha); en Dar voz lo escrito es mío.
  const right = perspective === 'senas' ? isVoice : !isVoice;
  const time = new Date(m.at).toLocaleTimeString('es-SV', { hour: '2-digit', minute: '2-digit' });
  // Cada mensaje nuevo entra deslizándose desde su lado.
  const enter = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(enter, { toValue: 1, duration: 320, easing: Easing.out(Easing.back(1.4)), useNativeDriver: true }).start();
  }, [enter]);
  const anim = {
    opacity: enter,
    transform: [{ translateX: enter.interpolate({ inputRange: [0, 1], outputRange: [right ? 24 : -24, 0] }) }, { scale: enter.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) }],
  };
  return (
    <Animated.View style={[st.row, right ? st.right : st.left, anim]}>
      <Pressable onPress={onPress} style={({ pressed }) => [st.bubble, isVoice ? st.voice : st.sign, right ? st.tailRight : st.tailLeft, pressed && { opacity: 0.8 }]}>
        <View style={st.head}>
          <ChannelTag icon={meta.icon} text={meta.tag[perspective]} color={isVoice ? colors.voiceInk : colors.signInk} />
          <Text style={st.time}>{time}</Text>
        </View>
        <Text style={isVoice ? type.voiceBig : st.signText}>{m.text}</Text>
        <View style={st.hint}>
          <Icon name={isVoice ? 'arrow-expand' : 'volume-high'} size={15} color={isVoice ? colors.voiceInk : colors.signInk} />
          <Text style={[type.small, { color: isVoice ? colors.voiceInk : colors.signInk, fontSize: 12 }]}>{isVoice ? 'Ver en grande' : 'Repetir'}</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const st = StyleSheet.create({
  list: { padding: space.lg, gap: space.md },
  row: { flexDirection: 'row' },
  left: { justifyContent: 'flex-start', paddingRight: space.xxl },
  right: { justifyContent: 'flex-end', paddingLeft: space.xxl },
  bubble: { borderRadius: radius.lg, padding: space.md, paddingHorizontal: space.lg, gap: 6, maxWidth: '100%' },
  sign: { backgroundColor: colors.signSoft },
  voice: { backgroundColor: colors.voiceSoft },
  tailLeft: { borderTopLeftRadius: 6 },
  tailRight: { borderTopRightRadius: 6 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.lg },
  time: { ...type.small, fontSize: 11, color: colors.textFaint },
  signText: { ...type.bodyStrong, fontSize: 19, lineHeight: 26 },
  hint: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.sm, padding: space.xl },
});
