import React, { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HelpSheet, useFirstTimeHelp } from '@/components/HelpSheet';
import { ListenBar } from '@/components/ListenBar';
import { AssistantStrip, ModeHeader } from '@/components/ModeHeader';
import { QuickPhrases } from '@/components/QuickPhrases';
import { Timeline } from '@/components/Timeline';
import { Icon } from '@/components/ui';
import { useConversation } from '@/core/conversation/ConversationProvider';
import { useSettings } from '@/core/settings';
import { VOICE_TIPS } from '@/data/tips';
import { colors, fonts, palette, radius, space, type } from '@/theme/tokens';

/**
 * DAR VOZ (para quien no habla: persona sorda o con discapacidad del habla).
 * El teléfono habla por ti y te muestra en grande lo que te responden. La otra
 * persona no necesita tener la app.
 *   arriba  escribir y decir
 *   medio   frases rápidas (incluye "Me llamo…" si pusiste tu nombre)
 *   abajo   conversación + escuchar la respuesta
 */
export default function Voz() {
  const conv = useConversation();
  const { settings } = useSettings();
  const [text, setText] = useState('');
  const [editPhrases, setEditPhrases] = useState(false);
  const [help, setHelp] = useFirstTimeHelp('voz');

  const phrases = useMemo(() => {
    const list = [...settings.quickPhrases];
    if (settings.name) list.unshift(`Me llamo ${settings.name}`);
    return list;
  }, [settings.quickPhrases, settings.name]);

  const say = () => {
    if (!text.trim()) return;
    conv.sayTyped(text);
    setText('');
  };

  return (
    <SafeAreaView style={st.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ModeHeader title="Dar voz" accent={palette.lightSky} onHelp={() => setHelp(true)} />
        <AssistantStrip
          mascot={conv.voice.active ? 'listening' : 'attentive'}
          status={conv.voice.active ? 'Escuchando la respuesta' : settings.name ? `${settings.name}, yo hablo por ti` : 'Yo hablo por ti'}
          tips={VOICE_TIPS}
          tone={colors.voiceSoft}
        />

        <View style={st.writeCard}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Escribe lo que quieres decir…"
            placeholderTextColor={colors.textFaint}
            style={st.input}
            multiline
            submitBehavior="submit"
            returnKeyType="send"
            onSubmitEditing={say}
          />
          <View style={st.writeActions}>
            {!!text && (
              <Pressable onPress={() => setText('')} hitSlop={8} accessibilityLabel="Borrar texto">
                <Text style={st.clear}>Borrar</Text>
              </Pressable>
            )}
            <Pressable onPress={say} disabled={!text.trim()} style={[st.sayBtn, !text.trim() && { opacity: 0.4 }]} accessibilityRole="button" accessibilityLabel="Decir en voz alta">
              <Icon name="volume-high" size={22} color={colors.onPrimary} />
              <Text style={st.sayText}>Decir</Text>
            </Pressable>
          </View>
        </View>

        <View style={st.phrasesHead}>
          <Text style={type.label}>FRASES RÁPIDAS</Text>
          <Pressable onPress={() => setEditPhrases(true)} hitSlop={8}>
            <Text style={st.edit}>Editar</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={st.phrases} style={st.phrasesBox} nestedScrollEnabled>
          {phrases.map((p, i) => (
            <Pressable
              key={p}
              onPress={() => conv.sayTyped(p, 'phrase')}
              style={({ pressed }) => [st.phrase, { backgroundColor: PHRASE_COLORS[i % PHRASE_COLORS.length] }, pressed && { transform: [{ scale: 0.96 }] }]}
            >
              <Text style={st.phraseText}>{p}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={{ flex: 1 }}>
          <Timeline perspective="voz" empty={{ title: 'Tu voz, en tu teléfono', text: 'Escribe o toca una frase para decirla. Cuando te respondan, toca "Escuchar respuesta".' }} />
        </View>

        <ListenBar label="Escuchar respuesta" hint="Lo que te digan aparecerá en letra grande" />
        <QuickPhrases open={editPhrases} onClose={() => setEditPhrases(false)} />
        <HelpSheet mode="voz" open={help} onClose={() => setHelp(false)} />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const PHRASE_COLORS = ['#FCEFD2', colors.signSoft, colors.voiceSoft, '#FBE3D8'];

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  writeCard: { marginHorizontal: space.md, backgroundColor: colors.surface, borderRadius: radius.xl, padding: space.md, borderWidth: 2, borderColor: colors.voice, gap: space.sm },
  input: { fontFamily: fonts.bodyBold, fontSize: 22, lineHeight: 30, color: colors.text, minHeight: 84, maxHeight: 160, textAlignVertical: 'top' },
  writeActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: space.lg },
  clear: { fontFamily: fonts.bodyBold, color: colors.textMuted },
  sayBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.primary, borderRadius: radius.pill, paddingHorizontal: space.xl, height: 50 },
  sayText: { fontFamily: fonts.bodyBold, fontSize: 17, color: colors.onPrimary },
  phrasesHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: space.lg, marginTop: space.md },
  edit: { fontFamily: fonts.bodyBold, color: colors.primary, fontSize: 13 },
  phrasesBox: { flexGrow: 0, maxHeight: 176 },
  phrases: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: space.md, paddingVertical: space.sm, gap: space.sm },
  phrase: { borderRadius: radius.lg, paddingHorizontal: space.lg, paddingVertical: space.md },
  phraseText: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.text },
});
