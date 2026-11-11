import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts, palette } from '../theme/tokens';
import { LEMA, NOMBRE } from './togoArte';

/**
 * Nombre de Togo: cada letra con su color y su propio ladeo (juguetón, como la
 * mascota), y debajo lo que une la app: señas, voz y texto. Letras y colores salen de
 * togoArte.ts, igual que el logo con insignia (docs/logo-togo.png, tools/iconos.mjs).
 */
export function Logo({ size = 44, tagline = true }: { size?: number; tagline?: boolean }) {
  return (
    <View style={{ alignItems: 'center' }} accessible accessibilityRole="header" accessibilityLabel="Togo: señas, voz y texto">
      <View style={st.row}>
        {NOMBRE.map(({ l, color, giro, baja }, i) => (
          <Text
            key={i}
            style={[st.word, { fontSize: size, lineHeight: size * 1.25, color, transform: [{ rotate: `${giro}deg` }, { translateY: baja * size }] }]}
          >
            {l}
          </Text>
        ))}
      </View>
      {tagline && (
        <View style={[st.tagRow, { marginTop: size * 0.04 }]}>
          {LEMA.map((t, i) => (
            <View key={t} style={st.tagItem}>
              {i > 0 && <View style={[st.dot, { backgroundColor: [palette.seafoam, palette.lightSky, palette.coral][i] }]} />}
              <Text style={[st.tag, { fontSize: Math.max(11, size * 0.26) }]}>{t}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 1 },
  word: { fontFamily: fonts.title },
  tagRow: { flexDirection: 'row', alignItems: 'center' },
  tagItem: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 5, height: 5, borderRadius: 3, marginHorizontal: 8 },
  tag: { fontFamily: fonts.bodyBold, letterSpacing: 2, color: colors.textMuted, textTransform: 'uppercase' },
});
