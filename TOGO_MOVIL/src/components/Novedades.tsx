import React, { useEffect, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSettings } from '../core/settings';
import { listo } from '../core/tacto';
import { APP_VERSION } from '../data/app';
import { colors, fonts, palette, radius, space, type } from '../theme/tokens';
import { Torogoz } from './Torogoz';
import { Button, Icon, IconName } from './ui';

/** Lo nuevo de esta versión: lo presenta Togo una sola vez (se recuerda en los ajustes). */
const NOVEDADES: { icon: IconName; texto: string; tono: string }[] = [
  { icon: 'hand-heart-outline', texto: 'Enséñale señas a Togo: graba desde tu teléfono en 5 minutos', tono: '#FBE3D8' },
  { icon: 'account-group-outline', texto: 'Colaboradores: los nombres de quienes le enseñan a Togo', tono: colors.signSoft },
  { icon: 'dots-horizontal-circle-outline', texto: 'Arriba hay menos botones: Historial, Guardar y Borrar están en «Más»', tono: '#FCEFD2' },
  { icon: 'gesture-tap-button', texto: 'Mejor lectura de pantalla: los botones se anuncian con TalkBack', tono: colors.voiceSoft },
];

export function Novedades() {
  const { settings, update } = useSettings();
  const [visible, setVisible] = useState(false);

  // Un momento después de abrir: Togo saluda primero y los ajustes ya cargaron.
  useEffect(() => {
    const t = setTimeout(() => setVisible(settings.novedadesVistas !== APP_VERSION), 1100);
    return () => clearTimeout(t);
  }, [settings.novedadesVistas]);

  const cerrar = () => {
    listo();
    setVisible(false);
    update({ novedadesVistas: APP_VERSION });
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={cerrar}>
      <View style={st.fondo}>
        <View style={st.tarjeta}>
          <Torogoz state="celebrating" size={104} say="¡Mira lo nuevo!" />
          <Text style={st.titulo}>Novedades de la {APP_VERSION}</Text>
          <ScrollView style={{ alignSelf: 'stretch' }} contentContainerStyle={{ gap: space.sm }}>
            {NOVEDADES.map((n) => (
              <View key={n.texto} style={st.fila}>
                <View style={[st.icono, { backgroundColor: n.tono }]}>
                  <Icon name={n.icon} size={20} />
                </View>
                <Text style={[type.body, { flex: 1 }]}>{n.texto}</Text>
              </View>
            ))}
          </ScrollView>
          <Button label="¡Vamos!" variant="ink" onPress={cerrar} style={{ alignSelf: 'stretch' }} />
        </View>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: 'rgba(13,43,69,0.45)', justifyContent: 'center', padding: space.lg },
  tarjeta: { backgroundColor: colors.bg, borderRadius: radius.xl, padding: space.lg, gap: space.md, alignItems: 'center', maxHeight: '88%', borderWidth: 3, borderColor: palette.sun },
  titulo: { fontFamily: fonts.title, fontSize: 24, color: colors.text, textAlign: 'center' },
  fila: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  icono: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
