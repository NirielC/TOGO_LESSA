import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LETTERS, LetterHand, SIGNS, SignAvatar } from '@/components/SignAvatar';
import { Torogoz } from '@/components/Torogoz';
import { Icon, IconButton } from '@/components/ui';
import { goBack } from '@/core/nav';
import { meaningOf } from '@/core/signs/vocabulary';
import { colors, fonts, radius, space, type } from '@/theme/tokens';

/**
 * DICCIONARIO LESSA: cada seña que la app reconoce, con su animación real.
 * Para quien oye: aprender poco a poco. Para quien seña: recordar.
 */
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ¿?¡!,.]/g, '').toLowerCase();

export default function Diccionario() {
  const [tab, setTab] = useState<'senas' | 'letras'>('senas');
  const [q, setQ] = useState('');

  const signs = useMemo(() => SIGNS.filter((s) => norm(meaningOf(s.id).text).includes(norm(q))), [q]);
  const letters = useMemo(() => LETTERS.filter((l) => !q || norm(l.letra) === norm(q)), [q]);

  return (
    <SafeAreaView style={st.safe}>
      <View style={st.head}>
        <IconButton icon="arrow-left" label="Volver" onPress={goBack} />
        <Text style={type.h1}>Diccionario</Text>
      </View>

      <View style={st.hero}>
        <Torogoz state="attentive" size={56} interactive />
        <Text style={[type.small, { flex: 1 }]}>Toca una seña para verla en movimiento. Puedes ponerla lenta o en espejo para copiarla.</Text>
      </View>

      <View style={st.search}>
        <Icon name="magnify" size={20} color={colors.textMuted} />
        <TextInput value={q} onChangeText={setQ} placeholder="Buscar una seña o letra" placeholderTextColor={colors.textFaint} style={st.input} />
        {!!q && <IconButton icon="close" label="Borrar búsqueda" onPress={() => setQ('')} size={18} />}
      </View>

      <View style={st.tabs}>
        {(['senas', 'letras'] as const).map((t) => (
          <Pressable key={t} onPress={() => setTab(t)} style={[st.tab, tab === t && st.tabOn]}>
            <Text style={[st.tabText, tab === t && { color: colors.onInk }]}>{t === 'senas' ? `Señas (${SIGNS.length})` : `Abecedario (${LETTERS.length})`}</Text>
          </Pressable>
        ))}
      </View>

      {tab === 'senas' ? (
        <FlatList
          data={signs}
          keyExtractor={(s) => s.id}
          numColumns={2}
          columnWrapperStyle={{ gap: space.md }}
          contentContainerStyle={st.grid}
          ListEmptyComponent={<Text style={[type.small, { textAlign: 'center' }]}>No encontré esa seña.</Text>}
          renderItem={({ item }) => (
            <Pressable style={({ pressed }) => [st.card, pressed && { transform: [{ scale: 0.97 }] }]} onPress={() => router.push(`/diccionario/${item.id}`)}>
              <View style={st.thumb}>
                <SignAvatar sign={item} size={120} playing={false} />
              </View>
              <Text style={st.cardTitle} numberOfLines={2}>
                {meaningOf(item.id).text}
              </Text>
            </Pressable>
          )}
        />
      ) : letters.length ? (
        <FlatList
          data={letters}
          keyExtractor={(l) => l.letra}
          numColumns={3}
          columnWrapperStyle={{ gap: space.md }}
          contentContainerStyle={st.grid}
          renderItem={({ item }) => (
            <View style={[st.card, { alignItems: 'center' }]}>
              <LetterHand letter={item} size={80} />
              <Text style={st.letter}>{item.letra}</Text>
            </View>
          )}
        />
      ) : (
        <View style={st.soon}>
          <Torogoz state="thinking" size={80} />
          <Text style={[type.h2, { textAlign: 'center' }]}>El abecedario viene pronto</Text>
          <Text style={[type.small, { textAlign: 'center' }]}>Cuando el equipo capture las fotos de cada letra, aparecerán aquí con su forma de mano.</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.md, paddingVertical: space.sm },
  hero: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginHorizontal: space.lg, backgroundColor: '#FCEFD2', borderRadius: radius.lg, padding: space.md },
  search: { flexDirection: 'row', alignItems: 'center', gap: space.sm, margin: space.lg, marginBottom: space.sm, backgroundColor: colors.surface, borderRadius: radius.pill, paddingHorizontal: space.lg, height: 48, borderWidth: 1, borderColor: colors.border },
  input: { flex: 1, ...type.body },
  tabs: { flexDirection: 'row', gap: space.sm, paddingHorizontal: space.lg },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt },
  tabOn: { backgroundColor: colors.ink },
  tabText: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.text },
  grid: { padding: space.lg, gap: space.md },
  card: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.md, gap: space.sm },
  thumb: { alignItems: 'center', backgroundColor: colors.signSoft, borderRadius: radius.md, overflow: 'hidden' },
  cardTitle: { fontFamily: fonts.title, fontSize: 17, color: colors.text, textAlign: 'center' },
  letter: { fontFamily: fonts.title, fontSize: 24, color: colors.text },
  soon: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md, padding: space.xl },
});
