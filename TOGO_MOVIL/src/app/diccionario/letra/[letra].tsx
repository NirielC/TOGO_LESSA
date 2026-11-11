import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LETTERS, LetterHand } from '@/components/SignAvatar';
import { Torogoz } from '@/components/Torogoz';
import { Icon, IconButton, IconName } from '@/components/ui';
import { goBack } from '@/core/nav';
import { useSettings } from '@/core/settings';
import { tocar } from '@/core/tacto';
import { speak } from '@/core/voice/tts';
import { colors, fonts, radius, space, type } from '@/theme/tokens';

/** Ficha de una letra del abecedario: la forma de la mano en grande, en espejo si se quiere, y a la anterior/siguiente. */
export default function LetraDetalle() {
  const { letra } = useLocalSearchParams<{ letra: string }>();
  const { settings } = useSettings();
  const [mirror, setMirror] = useState(false);
  const i = LETTERS.findIndex((l) => l.letra === (letra ?? '').toUpperCase());
  const item = LETTERS[i];

  if (!item) {
    return (
      <SafeAreaView style={st.safe}>
        <IconButton icon="arrow-left" label="Volver" onPress={goBack} />
        <Text style={[type.h2, { textAlign: 'center' }]}>No encontré esa letra</Text>
      </SafeAreaView>
    );
  }

  const ir = (paso: number) => {
    tocar();
    const n = LETTERS[(i + paso + LETTERS.length) % LETTERS.length];
    router.setParams({ letra: n.letra });
  };

  return (
    <SafeAreaView style={st.safe}>
      <View style={st.head}>
        <IconButton icon="arrow-left" label="Volver" onPress={goBack} />
        <Text style={[type.h1, { flex: 1 }]}>Letra {item.letra}</Text>
        <IconButton icon="volume-high" label="Escuchar" onPress={() => speak(item.letra, { rate: settings.speechRate })} />
      </View>
      <ScrollView contentContainerStyle={st.content}>
        <View style={st.stage}>
          <Pressable onPress={() => ir(-1)} style={st.arrow} accessibilityRole="button" accessibilityLabel="Letra anterior" hitSlop={8}>
            <Icon name="chevron-left" size={30} color={colors.text} />
          </Pressable>
          <View style={st.handBox}>
            <LetterHand letter={item} size={210} mirror={mirror} />
            <Text style={st.big}>{item.letra}</Text>
          </View>
          <Pressable onPress={() => ir(1)} style={st.arrow} accessibilityRole="button" accessibilityLabel="Letra siguiente" hitSlop={8}>
            <Icon name="chevron-right" size={30} color={colors.text} />
          </Pressable>
        </View>

        <View style={st.controls}>
          <Toggle icon="mirror" label="Espejo" on={mirror} onPress={() => setMirror((x) => !x)} />
        </View>
        <Text style={[type.small, { textAlign: 'center' }]}>
          {mirror ? 'En espejo: cópiala como si te vieras en un espejo.' : 'Así se ve de frente, como la verías en otra persona.'}
        </Text>

        <View style={st.card}>
          <Text style={type.label}>CÓMO SE HACE</Text>
          <Hint icon="hand-back-right-outline" text="Con una mano" />
          <Hint icon="pause-circle-outline" text="Sin movimiento: forma la letra y quédate quieto" />
          <Text style={[type.small, { marginTop: space.xs }]}>
            Para deletrear una palabra, forma una letra tras otra en Leer señas: «Mi nombre es» + A-N-A → «Mi nombre es Ana».
          </Text>
        </View>

        <View style={st.tip}>
          <Torogoz state="attentive" size={44} interactive lively={false} />
          <Text style={[type.small, { flex: 1, color: colors.text }]}>Usa las flechas para repasar el abecedario completo. J, Ñ y Z se hacen con movimiento.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Toggle({ icon, label, on, onPress }: { icon: IconName; label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[st.toggle, on && st.toggleOn]} accessibilityRole="button" accessibilityState={{ selected: on }}>
      <Icon name={icon} size={20} color={on ? colors.onInk : colors.text} />
      <Text style={[st.toggleText, on && { color: colors.onInk }]}>{label}</Text>
    </Pressable>
  );
}

function Hint({ icon, text }: { icon: IconName; text: string }) {
  return (
    <View style={st.hint}>
      <Icon name={icon} size={20} color={colors.signInk} />
      <Text style={[type.bodyStrong, { flex: 1 }]}>{text}</Text>
    </View>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.md, paddingVertical: space.sm },
  content: { padding: space.lg, gap: space.md, paddingBottom: space.xxl },
  stage: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FCEFD2', borderRadius: radius.xl, paddingVertical: space.lg, paddingHorizontal: space.xs },
  handBox: { alignItems: 'center', gap: space.xs },
  big: { fontFamily: fonts.title, fontSize: 44, lineHeight: 50, color: colors.text },
  arrow: { width: 48, height: 48, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.7)', alignItems: 'center', justifyContent: 'center' },
  controls: { flexDirection: 'row', justifyContent: 'center', gap: space.sm },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: space.lg, height: 44, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  toggleOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  toggleText: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.text },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.lg, gap: space.sm },
  hint: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  tip: { flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: colors.signSoft, borderRadius: radius.lg, padding: space.md },
});
