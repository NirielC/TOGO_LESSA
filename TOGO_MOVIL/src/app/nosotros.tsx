import React, { useRef, useState } from 'react';
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import { EasterEgg } from '@/components/EasterEgg';
import { Logo } from '@/components/Logo';
import { SIGNS } from '@/components/SignAvatar';
import { Torogoz } from '@/components/Torogoz';
import { Icon, IconButton, IconName } from '@/components/ui';
import { goBack } from '@/core/nav';
import { APP_VERSION, APP_YEAR, EQUIPO } from '@/data/equipo';
import { colors, fonts, palette, radius, space, type } from '@/theme/tokens';

/** SOBRE NOSOTROS: qué es Togo, por qué existe, por qué un torogoz y quiénes lo hicimos. */
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
        {/* Portada */}
        <View style={st.hero}>
          <Waves />
          <Logo size={42} />
          <Text style={st.heroTitle}>Dos idiomas,{'\n'}una conversación</Text>
          <Text style={st.heroText}>
            Togo conecta a personas sordas y oyentes en El Salvador: lee la Lengua de Señas Salvadoreña con la cámara, la convierte en voz y muestra en
            grande lo que se dice. Y si alguien no habla, el teléfono habla por esa persona.
          </Text>
          <View style={st.stats}>
            <Stat icon="hand-back-right-outline" value={`${SIGNS.length || 10}`} label="señas" tone={colors.signSoft} />
            <Stat icon="alphabetical-variant" value="27" label="letras" tone="#FCEFD2" />
            <Stat icon="wifi-off" value="0" label="internet" tone={colors.voiceSoft} />
          </View>
        </View>

        {/* Togo */}
        <View style={st.togoCard}>
          <Torogoz state="attentive" size={92} interactive say="¡Hola! Soy Togo" />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={st.cardTitle}>¿Por qué un torogoz?</Text>
            <Text style={type.small}>
              Es el ave nacional de El Salvador: colorida, curiosa y muy de aquí. Togo te acompaña en cada conversación, te avisa qué está pasando y te da
              consejos. Tócalo, mantenlo presionado… y quién sabe qué más.
            </Text>
          </View>
        </View>

        {/* Qué nos mueve */}
        <View style={st.values}>
          <Value icon="shield-lock-outline" title="Privado" text="Nada sale de tu teléfono: ni imágenes ni voz." />
          <Value icon="account-heart-outline" title="Para las dos personas" text="La otra persona no necesita tener la app." />
          <Value icon="map-marker-radius-outline" title="Hecho aquí" text="Con señas reales grabadas por nuestro equipo." />
        </View>

        <Text style={st.section}>EQUIPO DE DESARROLLO</Text>
        {EQUIPO.map((m, i) => (
          <View key={m.correo} style={[st.member, i === 0 && st.first]}>
            {m.foto ? (
              <Image source={m.foto} style={[st.photo, { borderColor: m.color }]} />
            ) : (
              <View style={[st.photo, { backgroundColor: m.color, borderColor: m.color }]}>
                <Text style={[st.initials, m.color === '#1E5A6E' && { color: colors.onInk }]}>{initials(m.nombre)}</Text>
              </View>
            )}
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={type.bodyStrong}>{m.nombre}</Text>
              <Text style={type.small}>{m.rol}</Text>
              <Pressable onPress={() => Linking.openURL(`mailto:${m.correo}`)} hitSlop={6}>
                <Text style={st.mail} numberOfLines={1}>
                  {m.correo}
                </Text>
              </Pressable>
            </View>
          </View>
        ))}

        <View style={st.footer}>
          <View style={st.made}>
            <Icon name="heart" size={16} color={colors.live} />
            <Text style={st.madeText}>Hecho en El Salvador, con mucho cariño</Text>
          </View>
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

function Stat({ icon, value, label, tone }: { icon: IconName; value: string; label: string; tone: string }) {
  return (
    <View style={[st.stat, { backgroundColor: tone }]}>
      <Icon name={icon} size={18} color={colors.text} />
      <Text style={st.statValue}>{value}</Text>
      <Text style={st.statLabel}>{label}</Text>
    </View>
  );
}

function Value({ icon, title, text }: { icon: IconName; title: string; text: string }) {
  return (
    <View style={st.value}>
      <View style={st.valueIcon}>
        <Icon name={icon} size={20} color={colors.onInk} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={type.bodyStrong}>{title}</Text>
        <Text style={type.small}>{text}</Text>
      </View>
    </View>
  );
}

/** Formas de fondo de la portada. */
function Waves() {
  return (
    <Svg style={StyleSheet.absoluteFill} viewBox="0 0 400 300" preserveAspectRatio="none" pointerEvents="none">
      <Path d="M0 230 C80 200 160 260 240 230 C310 205 360 220 400 210 L400 300 L0 300 Z" fill={palette.seafoam} opacity={0.18} />
      <Path d="M0 260 C90 240 170 290 260 262 C330 242 370 255 400 248 L400 300 L0 300 Z" fill={palette.lightSky} opacity={0.3} />
      <Circle cx={360} cy={40} r={46} fill={palette.sun} opacity={0.22} />
      <Circle cx={30} cy={30} r={10} fill={palette.coral} opacity={0.35} />
    </Svg>
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
  hero: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: space.xl, gap: space.md, alignItems: 'center', overflow: 'hidden' },
  heroTitle: { fontFamily: fonts.title, fontSize: 28, lineHeight: 33, color: colors.text, textAlign: 'center' },
  heroText: { ...type.body, textAlign: 'center' },
  stats: { flexDirection: 'row', gap: space.sm },
  stat: { flex: 1, alignItems: 'center', borderRadius: radius.md, paddingVertical: space.sm, gap: 1 },
  statValue: { fontFamily: fonts.title, fontSize: 24, color: colors.text },
  statLabel: { ...type.small, fontSize: 12 },
  togoCard: { flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: colors.signSoft, borderRadius: radius.xl, padding: space.lg },
  cardTitle: { fontFamily: fonts.title, fontSize: 19, color: colors.text },
  values: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: space.lg, gap: space.md },
  value: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  valueIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  section: { ...type.label, marginTop: space.sm },
  member: { flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.md, borderWidth: 1, borderColor: 'transparent' },
  first: { borderColor: 'rgba(107,167,160,0.55)' },
  photo: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 2 },
  initials: { fontFamily: fonts.title, fontSize: 21, color: colors.text },
  mail: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.primary },
  footer: { alignItems: 'center', gap: space.sm, marginTop: space.lg },
  made: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FBE3D8', borderRadius: radius.pill, paddingHorizontal: space.lg, paddingVertical: 8 },
  madeText: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.text },
  legal: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.textMuted, textAlign: 'center' },
});
