import { useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SignAvatar, useSign } from '@/components/SignAvatar';
import { Torogoz } from '@/components/Torogoz';
import { Icon, IconButton, IconName } from '@/components/ui';
import { goBack } from '@/core/nav';
import { useSettings } from '@/core/settings';
import { meaningOf } from '@/core/signs/vocabulary';
import { speak } from '@/core/voice/tts';
import { colors, fonts, radius, space, type } from '@/theme/tokens';

/** Ficha de una seña: animación real, controles para aprender y pistas medidas. */
export default function SenaDetalle() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const sign = useSign(id ?? '');
  const { settings } = useSettings();
  const [slow, setSlow] = useState(false);
  const [mirror, setMirror] = useState(false);
  const [playing, setPlaying] = useState(true);

  if (!sign) {
    return (
      <SafeAreaView style={st.safe}>
        <IconButton icon="arrow-left" label="Volver" onPress={goBack} />
        <Text style={[type.h2, { textAlign: 'center' }]}>No encontré esa seña</Text>
      </SafeAreaView>
    );
  }
  const m = meaningOf(sign.id);
  const p = sign.pistas;

  return (
    <SafeAreaView style={st.safe}>
      <View style={st.head}>
        <IconButton icon="arrow-left" label="Volver" onPress={goBack} />
        <Text style={[type.h1, { flex: 1 }]} numberOfLines={1}>
          {m.text}
        </Text>
        <IconButton icon="volume-high" label="Escuchar" onPress={() => speak(m.text, { rate: settings.speechRate })} />
      </View>
      <ScrollView contentContainerStyle={st.content}>
        <View style={st.stage}>
          <SignAvatar sign={sign} size={280} speed={slow ? 0.5 : 1} mirror={mirror} playing={playing} />
        </View>

        <View style={st.controls}>
          <Toggle icon={playing ? 'pause' : 'play'} label={playing ? 'Pausa' : 'Ver'} on={false} onPress={() => setPlaying((x) => !x)} />
          <Toggle icon="snail" label="Lento" on={slow} onPress={() => setSlow((x) => !x)} />
          <Toggle icon="mirror" label="Espejo" on={mirror} onPress={() => setMirror((x) => !x)} />
        </View>
        <Text style={[type.small, { textAlign: 'center' }]}>
          {mirror ? 'En espejo: cópiala como si te vieras en un espejo.' : 'Así se ve de frente, como la verías en otra persona.'}
        </Text>

        <View style={st.card}>
          <Text style={type.label}>PARA QUÉ SIRVE</Text>
          <Text style={type.body}>{m.uso ?? 'Seña del vocabulario de Togo.'}</Text>
        </View>

        <View style={st.card}>
          <Text style={type.label}>CÓMO SE HACE</Text>
          <Hint icon="hand-back-right-outline" text={p.manos === 2 ? 'Con las dos manos' : 'Con una mano'} />
          <Hint icon="gesture-swipe" text={`Movimiento ${p.movimiento}`} />
          <Hint icon="human-handsup" text={`A la altura ${p.zona.startsWith('el ') ? `del ${p.zona.slice(3)}` : `de ${p.zona}`}`} />
          <Text style={[type.small, { marginTop: space.xs }]}>
            Medido en {sign.grabaciones} grabaciones reales de esta seña.
          </Text>
        </View>

        <View style={st.tip}>
          <Torogoz state="attentive" size={44} interactive lively={false} />
          <Text style={[type.small, { flex: 1, color: colors.text }]}>Practica en Lento y Espejo, luego pruébala en Leer señas con la cámara frontal.</Text>
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
      <Text style={type.bodyStrong}>{text}</Text>
    </View>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.md, paddingVertical: space.sm },
  content: { padding: space.lg, gap: space.md, paddingBottom: space.xxl },
  stage: { alignItems: 'center', backgroundColor: colors.signSoft, borderRadius: radius.xl, paddingVertical: space.md },
  controls: { flexDirection: 'row', justifyContent: 'center', gap: space.sm },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: space.lg, height: 44, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  toggleOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  toggleText: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.text },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.lg, gap: space.sm },
  hint: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  tip: { flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: '#FCEFD2', borderRadius: radius.lg, padding: space.md },
});
