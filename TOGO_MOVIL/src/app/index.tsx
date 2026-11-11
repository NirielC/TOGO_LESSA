import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import { Aparecer } from '@/components/Aparecer';
import { SignsScene, VoiceScene } from '@/components/Illustrations';
import { Logo } from '@/components/Logo';
import { MASCOT_NAME, RARE_CHANCE, SECRET_HINT, Torogoz } from '@/components/Torogoz';
import { Icon, IconButton, IconName } from '@/components/ui';
import { useSettings } from '@/core/settings';
import { tocar } from '@/core/tacto';
import { APP_VERSION, APP_YEAR } from '@/data/app';
import { HOME_TIPS } from '@/data/tips';
import { colors, fonts, palette, radius, space, type } from '@/theme/tokens';

/**
 * INICIO: dos maneras de conversar, según quién tiene el teléfono, y debajo
 * lo que siempre está a mano (diccionario, conversaciones, sobre Togo).
 */
export default function Inicio() {
  const { settings, update } = useSettings();
  const [name, setName] = useState(settings.name);
  const [editing, setEditing] = useState(!settings.name);
  const [tip, setTip] = useState(0);
  const [rare, setRare] = useState(false);

  useEffect(() => {
    const t = setInterval(() => {
      setTip((x) => (x + 1) % HOME_TIPS.length);
      setRare(Math.random() < RARE_CHANCE); // la pista del secreto de Togo, muy de vez en cuando
    }, 5000);
    return () => clearInterval(t);
  }, []);

  const saveName = () => {
    update({ name: name.trim() });
    setEditing(!name.trim());
  };

  const hello = settings.name ? `¡Hola, ${settings.name}!` : `¡Hola! Soy ${MASCOT_NAME}`;

  return (
    <SafeAreaView style={st.safe}>
      <Backdrop />
      <ScrollView contentContainerStyle={st.content} keyboardShouldPersistTaps="handled">
        <View style={st.topBar}>
          <View style={{ width: 48 }} />
          <Logo size={46} />
          <IconButton icon="cog-outline" label="Ajustes" onPress={() => router.push('/ajustes')} bg={colors.surface} />
        </View>

        <View style={st.hero}>
          <Torogoz state="attentive" size={124} interactive say={hello} greet />
          <OfflineBadge />
          <Text style={[st.tip, rare && { color: '#8A5A12' }]}>{rare ? SECRET_HINT : HOME_TIPS[tip]}</Text>
          <Text style={st.question}>¿Cómo vamos a conversar?</Text>
          {editing ? (
            <TextInput
              value={name}
              onChangeText={setName}
              onSubmitEditing={saveName}
              onBlur={saveName}
              placeholder="¿Cómo te llamas? (opcional)"
              placeholderTextColor={colors.textFaint}
              style={st.nameInput}
              returnKeyType="done"
              maxLength={30}
            />
          ) : (
            <Pressable onPress={() => setEditing(true)} hitSlop={8}>
              <Text style={st.changeName}>No soy {settings.name} · cambiar nombre</Text>
            </Pressable>
          )}
        </View>

        <Aparecer delay={150}>
          <ModeCard
            title="Leer señas"
            who="Para quien oye"
            text="Apunta la cámara a quien seña: te pregunto si entendí bien y lo digo en voz alta. Responde hablando y lo leerá en grande."
            bg={palette.seafoam}
            scene={<SignsScene width={140} height={105} />}
            icon="hand-back-right"
            onPress={() => router.push('/senas')}
          />
        </Aparecer>
        <Aparecer delay={260}>
          <ModeCard
            title="Dar voz"
            who="Para quien no habla"
            text="Escribe o toca una frase y el teléfono la dice en voz alta. La respuesta te llega en letra grande."
            bg={palette.lightSky}
            scene={<VoiceScene width={140} height={105} />}
            icon="account-voice"
            onPress={() => router.push('/voz')}
          />
        </Aparecer>

        <Aparecer delay={370} style={st.links}>
          <Row icon="book-open-variant" title="Diccionario LESSA" text="Aprende y repasa cada seña" tone="#FCEFD2" onPress={() => router.push('/diccionario')} />
          <Row icon="history" title="Conversaciones guardadas" text="Vuelve a leer lo que hablaron" tone={colors.voiceSoft} onPress={() => router.push('/guardadas')} />
          <Row icon="information-outline" title="Sobre Togo" text="Qué es, quién la hizo y por qué un torogoz" tone={colors.signSoft} onPress={() => router.push('/acerca')} />
        </Aparecer>

        <View style={st.footer}>
          <Text style={st.legal}>
            Togo™ · © {APP_YEAR} · {APP_VERSION}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/** "¡No necesitas internet!": lo que hace distinta a Togo, bien a la vista. */
function OfflineBadge() {
  const wobble = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(2600),
        Animated.timing(wobble, { toValue: 1, duration: 140, easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(wobble, { toValue: -1, duration: 160, easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(wobble, { toValue: 0.6, duration: 140, easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(wobble, { toValue: 0, duration: 140, easing: Easing.linear, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [wobble]);
  const rotate = wobble.interpolate({ inputRange: [-1, 1], outputRange: ['-4deg', '4deg'] });
  return (
    <Animated.View style={[st.offline, { transform: [{ rotate }] }]}>
      <View style={st.offlineIcon}>
        <Icon name="wifi-off" size={16} color={colors.onInk} />
      </View>
      <Text style={st.offlineText}>¡No necesitas internet!</Text>
    </Animated.View>
  );
}

function ModeCard(p: { title: string; who: string; text: string; bg: string; scene: React.ReactNode; icon: IconName; onPress: () => void }) {
  return (
    <Pressable
      onPress={() => {
        tocar();
        p.onPress();
      }}
      style={({ pressed }) => [st.card, { backgroundColor: p.bg, transform: [{ scale: pressed ? 0.98 : 1 }] }]}
      accessibilityRole="button"
      accessibilityLabel={`${p.title}. ${p.who}`}
    >
      <View style={st.cardTop}>
        <View style={{ flex: 1, gap: 4 }}>
          <View style={st.whoPill}>
            <Icon name={p.icon} size={14} color={colors.text} />
            <Text style={st.who}>{p.who.toUpperCase()}</Text>
          </View>
          <Text style={st.cardTitle}>{p.title}</Text>
        </View>
        {p.scene}
      </View>
      <Text style={st.cardText}>{p.text}</Text>
      <View style={st.go}>
        <Text style={st.goText}>Empezar</Text>
        <Icon name="arrow-right" size={18} color={colors.onInk} />
      </View>
    </Pressable>
  );
}

function Row({ icon, title, text, tone, onPress }: { icon: IconName; title: string; text: string; tone: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [st.row, pressed && { opacity: 0.85 }]}>
      <View style={[st.rowIcon, { backgroundColor: tone }]}>
        <Icon name={icon} size={22} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={type.bodyStrong}>{title}</Text>
        <Text style={type.small}>{text}</Text>
      </View>
      <Icon name="chevron-right" color={colors.textFaint} />
    </Pressable>
  );
}

/** Fondo: dos formas suaves de color, sin ruido. */
function Backdrop() {
  return (
    <Svg style={StyleSheet.absoluteFill} viewBox="0 0 400 800" preserveAspectRatio="xMidYMin slice" pointerEvents="none">
      <Path d="M260 -40 C360 -20 440 60 420 160 C400 240 300 230 250 170 C200 110 170 -60 260 -40 Z" fill={palette.sun} opacity={0.3} />
      <Path d="M-60 140 C0 100 90 140 80 220 C70 290 -20 300 -60 260 Z" fill={palette.coral} opacity={0.15} />
      <Circle cx={40} cy={70} r={7} fill={palette.lightSky} />
    </Svg>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.lg, gap: space.lg, paddingBottom: space.xxl },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  hero: { alignItems: 'center', gap: space.sm },
  tip: { ...type.small, textAlign: 'center', fontFamily: fonts.bodyBold, color: colors.signInk, minHeight: 18 },
  question: { ...type.h1, textAlign: 'center' },
  nameInput: { ...type.body, alignSelf: 'stretch', marginHorizontal: space.xl, textAlign: 'center', backgroundColor: colors.surface, borderRadius: radius.pill, height: 46, borderWidth: 1, borderColor: colors.border, paddingHorizontal: space.lg },
  changeName: { ...type.small, textDecorationLine: 'underline', textAlign: 'center' },
  card: { borderRadius: radius.xl, padding: space.lg, gap: space.sm, overflow: 'hidden' },
  cardTop: { flexDirection: 'row', alignItems: 'center' },
  sceneSigns: { backgroundColor: 'rgba(255,255,255,0.35)', borderRadius: radius.lg, overflow: 'hidden' },
  whoPill: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.55)', borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  who: { fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 0.6, color: colors.text },
  cardTitle: { fontFamily: fonts.title, fontSize: 30, lineHeight: 36, color: colors.text },
  cardText: { fontFamily: fonts.bodyMedium, fontSize: 15, lineHeight: 21, color: colors.text },
  go: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: colors.ink, borderRadius: radius.pill, paddingHorizontal: space.lg, height: 40, marginTop: space.xs },
  goText: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.onInk },
  links: { gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.md },
  rowIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  footer: { alignItems: 'center', gap: space.md, marginTop: space.sm },
  offline: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: palette.sun, borderRadius: radius.pill, paddingLeft: 5, paddingRight: space.lg, paddingVertical: 5, marginTop: 2, borderWidth: 2, borderColor: colors.ink },
  offlineIcon: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  offlineText: { fontFamily: fonts.title, fontSize: 17, color: colors.ink },
  legal: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.textMuted },
});
