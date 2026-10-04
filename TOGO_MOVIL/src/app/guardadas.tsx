import { goBack } from '@/core/nav';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Alert, FlatList, LayoutAnimation, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Torogoz } from '@/components/Torogoz';
import { ChannelTag, Icon, IconButton, IconName } from '@/components/ui';
import { deleteSaved, loadSaved, SavedConversation } from '@/core/conversation/ConversationProvider';
import type { Message } from '@/core/conversation/reducer';
import { speak } from '@/core/voice/tts';
import { colors, fonts, radius, space, type } from '@/theme/tokens';

/**
 * CONVERSACIONES GUARDADAS (se guardan a propósito, no hay historial automático).
 * Cada tarjeta muestra de qué se habló; al abrirla, la conversación completa con
 * quién dijo qué. Se puede escuchar un mensaje, compartir todo como texto o borrar.
 */
const SOURCE: Record<Message['source'], { icon: IconName; tag: string; voice: boolean }> = {
  sign: { icon: 'hand-back-right-outline', tag: 'SEÑA', voice: false },
  typed: { icon: 'keyboard-outline', tag: 'ESCRITO', voice: false },
  phrase: { icon: 'lightning-bolt-outline', tag: 'FRASE', voice: false },
  voice: { icon: 'microphone-outline', tag: 'RESPUESTA', voice: true },
};

export default function Guardadas() {
  const [list, setList] = useState<SavedConversation[]>([]);
  const [open, setOpen] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadSaved().then(setList);
    }, []),
  );

  const remove = (c: SavedConversation) =>
    Alert.alert('Borrar conversación', 'No se puede deshacer.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Borrar',
        style: 'destructive',
        onPress: async () => {
          await deleteSaved(c.id);
          LayoutAnimation.easeInEaseOut();
          setList(await loadSaved());
        },
      },
    ]);

  const share = (c: SavedConversation) => {
    const lines = c.messages.map((m) => `${SOURCE[m.source].voice ? '🗣️' : '🤟'} ${m.text}`);
    Share.share({ message: `Conversación Togo · ${fecha(c.startedAt)}\n\n${lines.join('\n')}` }).catch(() => {});
  };

  const toggle = (id: string) => {
    LayoutAnimation.easeInEaseOut();
    setOpen((o) => (o === id ? null : id));
  };

  return (
    <SafeAreaView style={st.safe}>
      <View style={st.head}>
        <IconButton icon="arrow-left" label="Volver" onPress={() => goBack()} />
        <Text style={[type.h1, { flex: 1 }]}>Guardadas</Text>
        {list.length > 0 && <Text style={st.count}>{list.length}</Text>}
      </View>
      <FlatList
        data={list}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{ padding: space.lg, gap: space.md, flexGrow: 1 }}
        ListEmptyComponent={
          <View style={st.empty}>
            <Torogoz state="sleeping" size={84} />
            <Text style={type.h2}>Aún no hay conversaciones</Text>
            <Text style={[type.small, { textAlign: 'center' }]}>En Leer señas o Dar voz, toca «Guardar» arriba y la encontrarás aquí.</Text>
          </View>
        }
        renderItem={({ item }) => {
          const expanded = open === item.id;
          const signs = item.messages.filter((m) => !SOURCE[m.source].voice).length;
          const voices = item.messages.length - signs;
          const preview = item.messages.slice(0, 2).map((m) => m.text).join(' · ');
          return (
            <View style={[st.card, expanded && st.cardOpen]}>
              <Pressable onPress={() => toggle(item.id)} style={st.cardHead} accessibilityRole="button" accessibilityState={{ expanded }}>
                <View style={st.dateBox}>
                  <Text style={st.day}>{new Date(item.startedAt).getDate()}</Text>
                  <Text style={st.month}>{new Date(item.startedAt).toLocaleDateString('es-SV', { month: 'short' }).replace('.', '')}</Text>
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={type.bodyStrong} numberOfLines={expanded ? undefined : 1}>
                    {preview}
                  </Text>
                  <View style={st.meta}>
                    <Text style={st.metaText}>{hora(item.startedAt)}</Text>
                    <Pill icon="hand-back-right-outline" n={signs} tone={colors.signSoft} />
                    <Pill icon="microphone-outline" n={voices} tone={colors.voiceSoft} />
                  </View>
                </View>
                <Icon name={expanded ? 'chevron-up' : 'chevron-down'} color={colors.textFaint} />
              </Pressable>

              {expanded && (
                <>
                  <View style={st.msgs}>
                    {item.messages.map((m) => {
                      const s = SOURCE[m.source];
                      return (
                        <Pressable key={m.id} onPress={() => speak(m.text)} style={[st.msg, s.voice ? st.voice : st.sign]}>
                          <View style={st.msgHead}>
                            <ChannelTag icon={s.icon} text={s.tag} color={s.voice ? colors.voiceInk : colors.signInk} />
                            <Text style={st.metaText}>{hora(m.at)}</Text>
                          </View>
                          <Text style={type.body}>{m.text}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  <View style={st.actions}>
                    <Action icon="share-variant-outline" label="Compartir" onPress={() => share(item)} />
                    <Action icon="delete-outline" label="Borrar" onPress={() => remove(item)} danger />
                  </View>
                  <Text style={[st.metaText, { textAlign: 'center' }]}>Toca un mensaje para escucharlo</Text>
                </>
              )}
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}

function Pill({ icon, n, tone }: { icon: IconName; n: number; tone: string }) {
  if (!n) return null;
  return (
    <View style={[st.pill, { backgroundColor: tone }]}>
      <Icon name={icon} size={12} color={colors.text} />
      <Text style={st.pillText}>{n}</Text>
    </View>
  );
}

function Action({ icon, label, onPress, danger }: { icon: IconName; label: string; onPress: () => void; danger?: boolean }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [st.action, pressed && { opacity: 0.7 }]} accessibilityRole="button">
      <Icon name={icon} size={18} color={danger ? colors.danger : colors.primary} />
      <Text style={[st.actionText, danger && { color: colors.danger }]}>{label}</Text>
    </Pressable>
  );
}

const hora = (t: number) => new Date(t).toLocaleTimeString('es-SV', { hour: '2-digit', minute: '2-digit' });
const fecha = (t: number) => `${new Date(t).toLocaleDateString('es-SV', { day: 'numeric', month: 'long' })}, ${hora(t)}`;

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.md, paddingVertical: space.sm },
  count: { fontFamily: fonts.title, fontSize: 15, color: colors.onInk, backgroundColor: colors.primary, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 2, marginRight: space.sm },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.sm, padding: space.xl },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.md, gap: space.md },
  cardOpen: { borderWidth: 1.5, borderColor: colors.border },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  dateBox: { width: 50, height: 54, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  day: { fontFamily: fonts.title, fontSize: 22, lineHeight: 24, color: colors.text },
  month: { fontFamily: fonts.bodyBold, fontSize: 11, color: colors.textMuted, textTransform: 'uppercase' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  metaText: { ...type.small, fontSize: 12, color: colors.textFaint },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: radius.pill, paddingHorizontal: 7, paddingVertical: 1 },
  pillText: { fontFamily: fonts.bodyBold, fontSize: 11, color: colors.text },
  msgs: { gap: space.sm },
  msg: { borderRadius: radius.md, padding: space.md, gap: 4 },
  msgHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sign: { backgroundColor: colors.signSoft, marginRight: space.xl, borderTopLeftRadius: 6 },
  voice: { backgroundColor: colors.voiceSoft, marginLeft: space.xl, borderTopRightRadius: 6 },
  actions: { flexDirection: 'row', gap: space.sm, justifyContent: 'center' },
  action: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surfaceAlt, borderRadius: radius.pill, paddingHorizontal: space.lg, height: 42 },
  actionText: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.primary },
});
