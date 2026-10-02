import { goBack } from '@/core/nav';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Torogoz } from '@/components/Torogoz';
import { ChannelTag, IconButton } from '@/components/ui';
import { deleteSaved, loadSaved, SavedConversation } from '@/core/conversation/ConversationProvider';
import { colors, radius, space, type } from '@/theme/tokens';

/** Conversaciones que se guardaron a propósito (no hay historial automático). */
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
      { text: 'Borrar', style: 'destructive', onPress: async () => { await deleteSaved(c.id); setList(await loadSaved()); } },
    ]);

  return (
    <SafeAreaView style={st.safe}>
      <View style={st.head}>
        <IconButton icon="arrow-left" label="Volver" onPress={() => goBack()} />
        <Text style={type.h1}>Guardadas</Text>
      </View>
      <FlatList
        data={list}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{ padding: space.lg, gap: space.md, flexGrow: 1 }}
        ListEmptyComponent={
          <View style={st.empty}>
            <Torogoz state="sleeping" size={72} />
            <Text style={type.small}>Aún no guardas ninguna conversación.</Text>
          </View>
        }
        renderItem={({ item }) => {
          const d = new Date(item.startedAt);
          const expanded = open === item.id;
          return (
            <Pressable style={st.card} onPress={() => setOpen(expanded ? null : item.id)} onLongPress={() => remove(item)}>
              <Text style={type.bodyStrong}>
                {d.toLocaleDateString('es-SV', { day: 'numeric', month: 'long' })} · {d.toLocaleTimeString('es-SV', { hour: '2-digit', minute: '2-digit' })}
              </Text>
              <Text style={type.small}>{item.messages.length} mensajes · mantén presionado para borrar</Text>
              {expanded &&
                item.messages.map((m) => (
                  <View key={m.id} style={[st.msg, m.source === 'voice' ? st.voice : st.sign]}>
                    <ChannelTag
                      icon={m.source === 'voice' ? 'microphone-outline' : 'hand-back-right-outline'}
                      text={m.source === 'voice' ? 'VOZ' : 'SEÑA'}
                      color={m.source === 'voice' ? colors.voiceInk : colors.signInk}
                    />
                    <Text style={type.body}>{m.text}</Text>
                  </View>
                ))}
            </Pressable>
          );
        }}
      />
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.md, paddingVertical: space.sm },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.lg, gap: space.sm },
  msg: { borderRadius: radius.md, padding: space.md, gap: 4 },
  sign: { backgroundColor: colors.signSoft, marginRight: space.xl },
  voice: { backgroundColor: colors.voiceSoft, marginLeft: space.xl },
});
