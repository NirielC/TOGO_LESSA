import React, { useRef, useState } from 'react';
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EasterEgg } from '@/components/EasterEgg';
import { Logo } from '@/components/Logo';
import { Torogoz } from '@/components/Torogoz';
import { Icon, IconButton } from '@/components/ui';
import { goBack } from '@/core/nav';
import { APP_VERSION, APP_YEAR, EQUIPO } from '@/data/equipo';
import { colors, fonts, radius, space, type } from '@/theme/tokens';

/** SOBRE NOSOTROS: qué es Togo, por qué existe y quiénes lo hicimos. */
export default function Nosotros() {
  const [egg, setEgg] = useState(false);
  const taps = useRef({ n: 0, at: 0 });
  // 5 toques seguidos en la versión abren el secreto.
  const tapVersion = () => {
    const now = Date.now();
    taps.current = { n: now - taps.current.at < 900 ? taps.current.n + 1 : 1, at: now };
    if (taps.current.n >= 5) {
      taps.current.n = 0;
      setEgg(true);
    }
  };
  return (
    <SafeAreaView style={st.safe}>
      <View style={st.head}>
        <IconButton icon="arrow-left" label="Volver" onPress={goBack} />
        <Text style={type.h1}>Sobre nosotros</Text>
      </View>
      <ScrollView contentContainerStyle={st.content}>
        <View style={st.hero}>
          <Logo size={40} />
          <Text style={[type.body, { textAlign: 'center' }]}>
            Togo conecta a personas sordas y oyentes en El Salvador: lee la Lengua de Señas Salvadoreña con la cámara, la convierte en voz y muestra en grande
            lo que se dice. Y si alguien no habla, el teléfono habla por esa persona.
          </Text>
        </View>

        <View style={st.togo}>
          <Torogoz state="attentive" size={72} interactive say="¡Hola! Soy Togo, el torogoz del equipo" />
          <Text style={[type.small, { textAlign: 'center' }]}>Tócame y verás. Mantenme presionado para bailar.</Text>
        </View>

        <Text style={st.section}>EQUIPO DE DESARROLLO</Text>
        {EQUIPO.map((m, i) => (
          <View key={m.correo} style={[st.member, i === 0 && st.first]}>
            {m.foto ? (
              <Image source={m.foto} style={st.photo} />
            ) : (
              <View style={[st.photo, { backgroundColor: m.color }]}>
                <Text style={[st.initials, m.color === '#1E5A6E' && { color: colors.onInk }]}>{initials(m.nombre)}</Text>
              </View>
            )}
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={type.bodyStrong}>{m.nombre}</Text>
              <Text style={type.small}>{m.rol}</Text>
              <Pressable onPress={() => Linking.openURL(`mailto:${m.correo}`)} hitSlop={6}>
                <Text style={st.mail}>{m.correo}</Text>
              </Pressable>
            </View>
          </View>
        ))}

        <View style={st.footer}>
          <Icon name="heart-outline" size={18} color={colors.live} />
          <Text style={[type.small, { textAlign: 'center' }]}>Hecho en El Salvador, con mucho cariño.</Text>
          <Pressable onPress={tapVersion} hitSlop={10}>
            <Text style={st.legal}>
              Togo™ · © {APP_YEAR} Equipo Togo · {APP_VERSION}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
      <EasterEgg open={egg} onClose={() => setEgg(false)} />
    </SafeAreaView>
  );
}

function initials(name: string) {
  const parts = name.split(' ');
  return (parts[0][0] + (parts[2]?.[0] ?? parts[1]?.[0] ?? '')).toUpperCase();
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.md, paddingVertical: space.sm },
  content: { padding: space.lg, gap: space.md, paddingBottom: space.xxl },
  hero: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: space.xl, gap: space.md, alignItems: 'center' },
  togo: { alignItems: 'center', gap: space.sm, paddingVertical: space.md },
  section: { ...type.label, marginTop: space.sm },
  member: { flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.md },
  first: { borderWidth: 2, borderColor: colors.sign },
  photo: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  initials: { fontFamily: fonts.title, fontSize: 22, color: colors.text },
  mail: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.primary },
  footer: { alignItems: 'center', gap: space.xs, marginTop: space.lg },
  legal: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.textMuted, textAlign: 'center' },
});
