import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Mascot, useConversation } from '../core/conversation/ConversationProvider';
import { colors, fonts, radius, space, type } from '../theme/tokens';
import { Torogoz } from './Torogoz';
import { Icon, IconName } from './ui';

/**
 * Encabezado de cada modo, en dos filas:
 *   [Inicio]        Título        [? Ayuda]
 *   Diccionario · Historial · Guardar · Borrar · Ajustes   (ícono + nombre)
 * Con nombre bajo cada ícono nadie tiene que adivinar qué hace.
 * (Android muestra como máximo 3 botones por alerta: todas tienen Cancelar.)
 */
export function ModeHeader({ title, accent, onHelp }: { title: string; accent: string; onHelp: () => void }) {
  const conv = useConversation();
  const has = conv.state.messages.length > 0;

  const save = async () => {
    if (!has) return Alert.alert('Nada que guardar', 'La conversación todavía está vacía.');
    await conv.save();
    Alert.alert('Guardada', 'La encuentras en Historial.');
  };

  const clear = () => {
    if (!has) return;
    Alert.alert('Borrar conversación', '¿Quieres guardarla antes de borrarla?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Guardar y borrar', onPress: async () => { await conv.save(); conv.clear(); } },
      { text: 'Borrar', style: 'destructive', onPress: conv.clear },
    ]);
  };

  return (
    <View style={st.wrap}>
      <View style={st.top}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          style={({ pressed }) => [st.pill, pressed && { opacity: 0.7 }]}
          accessibilityRole="button"
          accessibilityLabel="Volver al inicio"
          hitSlop={6}
        >
          <Icon name="home-variant-outline" size={20} color={colors.text} />
          <Text style={st.pillText}>Inicio</Text>
        </Pressable>
        <View style={st.titleRow}>
          <View style={[st.dot, { backgroundColor: accent }]} />
          <Text style={st.title} numberOfLines={1}>
            {title}
          </Text>
        </View>
        <Pressable onPress={onHelp} style={({ pressed }) => [st.pill, pressed && { opacity: 0.7 }]} accessibilityRole="button" accessibilityLabel="Cómo funciona" hitSlop={6}>
          <Icon name="help-circle-outline" size={20} color={colors.text} />
          <Text style={st.pillText}>Ayuda</Text>
        </Pressable>
      </View>
      <View style={st.tools}>
        <Tool icon="book-open-variant" label="Diccionario" onPress={() => router.push('/diccionario')} />
        <Tool icon="history" label="Historial" onPress={() => router.push('/guardadas')} />
        <Tool icon="bookmark-outline" label="Guardar" onPress={save} />
        <Tool icon="broom" label="Borrar" onPress={clear} dim={!has} />
        <Tool icon="cog-outline" label="Ajustes" onPress={() => router.push('/ajustes')} />
      </View>
    </View>
  );
}

function Tool({ icon, label, onPress, dim }: { icon: IconName; label: string; onPress: () => void; dim?: boolean }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [st.tool, { opacity: dim ? 0.4 : pressed ? 0.6 : 1 }]} accessibilityRole="button" accessibilityLabel={label}>
      <Icon name={icon} size={21} color={colors.text} />
      <Text style={st.toolText}>{label}</Text>
    </Pressable>
  );
}

/** Togo con lo que está pasando y un consejo rotativo. */
export function AssistantStrip({ mascot, status, tips, tone }: { mascot: Mascot; status: string; tips: string[]; tone: string }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => (x + 1) % tips.length), 6500);
    return () => clearInterval(t);
  }, [tips.length]);
  return (
    <View style={[st.strip, { backgroundColor: tone }]}>
      <Torogoz state={mascot} size={46} interactive />
      <View style={st.stripText}>
        <Text style={st.status} numberOfLines={2}>
          {status}
        </Text>
        <Text style={st.tip} numberOfLines={2}>
          {tips[i]}
        </Text>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  wrap: { paddingHorizontal: space.md, paddingTop: space.sm, gap: space.xs },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    height: 38,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pillText: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.text },
  titleRow: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  title: { fontFamily: fonts.title, fontSize: 20, color: colors.text, flexShrink: 1 },
  tools: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: space.xs },
  tool: { alignItems: 'center', minWidth: 56, paddingVertical: 4, gap: 1 },
  toolText: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.textMuted },
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.md,
    marginHorizontal: space.md,
    marginVertical: space.xs,
    paddingVertical: 4,
    paddingHorizontal: space.lg,
    borderRadius: radius.lg,
  },
  stripText: { flexShrink: 1, alignItems: 'center' },
  status: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.text, textAlign: 'center' },
  tip: { ...type.small, textAlign: 'center' },
});
