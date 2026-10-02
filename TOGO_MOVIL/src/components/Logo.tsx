import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts, palette } from '../theme/tokens';

/**
 * Marca TOGO: "TOG" + una "O" con un punto de sol, y debajo lo que
 * une la app: señas, voz y texto. Solo tipografía y la paleta, sin romper el estilo.
 */
export function Logo({ size = 44, tagline = true }: { size?: number; tagline?: boolean }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <View style={st.row}>
        <Text style={[st.word, { fontSize: size, lineHeight: size * 1.15, color: colors.text }]}>TOG</Text>
        <View>
          <View style={[st.sun, { width: size * 0.28, height: size * 0.28, borderRadius: size, top: -size * 0.06, right: -size * 0.12 }]} />
          <Text style={[st.word, { fontSize: size, lineHeight: size * 1.15, color: palette.oceanTeal }]}>O</Text>
        </View>
      </View>
      {tagline && (
        <View style={st.tagRow}>
          {['señas', 'voz', 'texto'].map((t, i) => (
            <View key={t} style={st.tagItem}>
              {i > 0 && <View style={[st.dot, { backgroundColor: [palette.seafoam, palette.lightSky, palette.coral][i] }]} />}
              <Text style={[st.tag, { fontSize: Math.max(11, size * 0.27) }]}>{t}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end' },
  word: { fontFamily: fonts.title, letterSpacing: 3 },
  sun: { position: 'absolute', backgroundColor: palette.sun },
  tagRow: { flexDirection: 'row', alignItems: 'center', marginTop: -2 },
  tagItem: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 5, height: 5, borderRadius: 3, marginHorizontal: 8 },
  tag: { fontFamily: fonts.bodyBold, letterSpacing: 2, color: colors.textMuted, textTransform: 'uppercase' },
});
