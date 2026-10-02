import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { colors, fonts, palette, radius, space } from '../theme/tokens';

/**
 * Secreto: un héroe de 8 bits levantando la Trifuerza.
 * Se abre tocando 5 veces la versión en "Sobre nosotros".
 */
const PIXELS = [
  '......Y......',
  '.....YYY.....',
  '....YYYYY....',
  '...Y.....Y...',
  '..YYY...YYY..',
  '.YYYYY.YYYYY.',
  '.S...GGG...S.',
  '.G..GGGGG..G.',
  '.G..BSSSB..G.',
  '..G.SDSDS.G..',
  '...GGGGGGG...',
  '....GGYGG....',
  '....GGGGG....',
  '....BB.BB....',
];
const COLORS: Record<string, string> = {
  Y: palette.sun,
  G: '#3E8E5A',
  S: palette.sandyBeige,
  B: '#7A4E2D',
  D: palette.deepOcean,
};

export function EasterEgg({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={st.backdrop} onPress={onClose}>
        <View style={st.card}>
          <Svg width={208} height={224} viewBox="0 0 13 14">
            {PIXELS.flatMap((row, y) =>
              row.split('').map((c, x) => (COLORS[c] ? <Rect key={`${x}-${y}`} x={x} y={y} width={1.02} height={1.02} fill={COLORS[c]} /> : null)),
            )}
          </Svg>
          <Text style={st.title}>¡Obtuviste la Trifuerza!</Text>
          <Text style={st.text}>Un secreto de Elías para quien explora hasta el final. Es peligroso ir solo: lleva a Togo.</Text>
          <Text style={st.close}>Toca para cerrar</Text>
        </View>
      </Pressable>
    </Modal>
  );
}

const st = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(13,43,69,0.85)', alignItems: 'center', justifyContent: 'center', padding: space.xl },
  card: { backgroundColor: '#0B1F33', borderRadius: radius.lg, padding: space.xl, alignItems: 'center', gap: space.md, borderWidth: 3, borderColor: palette.sun },
  title: { fontFamily: fonts.title, fontSize: 22, color: palette.sun, textAlign: 'center' },
  text: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.onInk, textAlign: 'center' },
  close: { fontFamily: fonts.bodyBold, fontSize: 12, color: palette.lightSky },
});
