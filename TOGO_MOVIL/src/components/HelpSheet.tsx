import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSettings } from '../core/settings';
import { speak } from '../core/voice/tts';
import { colors, fonts, radius, space, type } from '../theme/tokens';
import { Torogoz } from './Torogoz';
import { Icon, IconName } from './ui';

/**
 * AYUDA DE CADA MODO, con Togo explicando. Dos partes, porque en una
 * conversación hay dos personas y no damos por hecho que ambas tengan la app:
 *   - "Para ti": quien tiene el teléfono.
 *   - "Para la otra persona": se puede girar para mostrársela, y en Dar voz
 *     también decirla en voz alta (quien oye puede no saber leer señas).
 */
type Mode = 'senas' | 'voz';
interface Part {
  tab: string;
  hello: string;
  steps: { icon: IconName; text: string }[];
  /** Se puede mostrar/decir a la otra persona. */
  shareable?: boolean;
  /** Texto que se dice en voz alta (solo si la otra persona oye). */
  spoken?: string;
}

const CONTENT: Record<Mode, Part[]> = {
  senas: [
    {
      tab: 'Para quien seña',
      hello: '¡Hola! Soy Togo y voy a leer tus señas.',
      steps: [
        { icon: 'speedometer-slow', text: 'Por favor, haz las señas un poco despacio.' },
        { icon: 'hand-back-right-outline', text: 'Que se vean tus hombros y tus manos.' },
        { icon: 'arrow-down-bold-outline', text: 'Cuando termines, baja los brazos por completo o escóndelos detrás.' },
        { icon: 'check-decagram-outline', text: 'Te mostraré lo que entendí para que me confirmes si es lo que querías decir.' },
      ],
      shareable: true,
    },
    {
      tab: 'Para ti',
      hello: '¡Hola! Así conversamos con señas:',
      steps: [
        { icon: 'camera-outline', text: 'Apunta la cámara a quien seña. Muéstrale la parte «Para quien seña» (botón Girar).' },
        { icon: 'message-question-outline', text: 'Al bajar las manos aparece «¿Quisiste decir…?». Gíralo para que lo vea y toca Sí o No.' },
        { icon: 'volume-high', text: 'Con «Sí», lo digo en voz alta y queda en la conversación.' },
        { icon: 'microphone-outline', text: 'Para responder, toca el micrófono y habla: lo leerá en letra grande.' },
      ],
    },
  ],
  voz: [
    {
      tab: 'Para ti',
      hello: '¡Hola! Yo hablo por ti.',
      steps: [
        { icon: 'keyboard-outline', text: 'Escribe lo que quieres decir y toca «Decir».' },
        { icon: 'lightning-bolt-outline', text: 'O toca una frase rápida. Puedes agregar las tuyas en «Editar».' },
        { icon: 'microphone-outline', text: 'Cuando te respondan, toca «Escuchar respuesta» y acerca el teléfono.' },
        { icon: 'format-size', text: 'La respuesta aparece en letra grande. «Girar» la voltea para quien está enfrente.' },
      ],
    },
    {
      tab: 'Para la otra persona',
      hello: 'Hola, me comunico con esta app.',
      steps: [
        { icon: 'account-voice', text: 'El teléfono dice en voz alta lo que escribo.' },
        { icon: 'microphone-outline', text: 'Para responderme, habla cerca del teléfono y despacio.' },
        { icon: 'format-size', text: 'Yo leeré lo que digas en la pantalla. ¡Gracias por tu paciencia!' },
      ],
      shareable: true,
      spoken:
        'Hola, me comunico con esta aplicación. El teléfono dice en voz alta lo que escribo. Para responderme, habla cerca del teléfono y despacio: yo leeré lo que digas en la pantalla. Gracias por tu paciencia.',
    },
  ],
};

export function HelpSheet({ mode, open, onClose }: { mode: Mode; open: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { settings } = useSettings();
  const [tab, setTab] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const parts = CONTENT[mode];
  const p = parts[tab];

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={st.backdrop} onPress={onClose} accessibilityLabel="Cerrar ayuda" />
      <View style={[st.sheet, { paddingBottom: insets.bottom + space.lg }]}>
        <View style={st.grabber} />
        <View style={st.tabs}>
          {parts.map((x, i) => (
            <Pressable key={x.tab} onPress={() => { setTab(i); setFlipped(false); }} style={[st.tab, tab === i && st.tabOn]}>
              <Text style={[st.tabText, tab === i && { color: colors.onInk }]}>{x.tab}</Text>
            </Pressable>
          ))}
        </View>

        <ScrollView contentContainerStyle={[st.body, flipped && st.flipped]}>
          <Torogoz state="attentive" size={84} interactive lively={false} say={p.hello} />
          {p.steps.map((s, i) => (
            <View key={i} style={st.step}>
              <View style={st.stepIcon}>
                <Icon name={s.icon} size={22} color={colors.signInk} />
              </View>
              <Text style={[st.stepText, p.shareable && { fontSize: 18, lineHeight: 25 }]}>{s.text}</Text>
            </View>
          ))}
        </ScrollView>

        <View style={st.actions}>
          {p.shareable && (
            <Pressable onPress={() => setFlipped((f) => !f)} style={st.secondary}>
              <Icon name="screen-rotation" size={18} color={colors.text} />
              <Text style={st.secondaryText}>Girar</Text>
            </Pressable>
          )}
          {p.spoken && (
            <Pressable onPress={() => speak(p.spoken!, { rate: settings.speechRate })} style={st.secondary}>
              <Icon name="volume-high" size={18} color={colors.text} />
              <Text style={st.secondaryText}>Decirlo</Text>
            </Pressable>
          )}
          <Pressable onPress={onClose} style={st.primary}>
            <Text style={st.primaryText}>¡Entendido!</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

/** Abre la ayuda sola la primera vez que se entra a un modo. */
export function useFirstTimeHelp(mode: Mode): [boolean, (v: boolean) => void] {
  const { settings, update } = useSettings();
  const seen = settings.seenHelp?.[mode] ?? false;
  const [open, setOpen] = useState(!seen);
  const set = (v: boolean) => {
    setOpen(v);
    if (!v && !seen) update({ seenHelp: { ...settings.seenHelp, [mode]: true } });
  };
  return [open, set];
}

const st = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.overlay },
  sheet: { backgroundColor: colors.bg, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, paddingHorizontal: space.xl, paddingTop: space.sm, gap: space.md, maxHeight: '88%' },
  grabber: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: colors.sand },
  tabs: { flexDirection: 'row', gap: space.sm },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt },
  tabOn: { backgroundColor: colors.ink },
  tabText: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.text },
  body: { alignItems: 'stretch', gap: space.md, paddingVertical: space.sm },
  flipped: { transform: [{ rotate: '180deg' }] },
  step: { flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.md },
  stepIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.signSoft, alignItems: 'center', justifyContent: 'center' },
  stepText: { ...type.body, flex: 1 },
  actions: { flexDirection: 'row', gap: space.sm },
  secondary: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: space.lg, height: 50, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  secondaryText: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.text },
  primary: { flex: 1, alignItems: 'center', justifyContent: 'center', height: 50, borderRadius: radius.pill, backgroundColor: colors.primary },
  primaryText: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.onPrimary },
});
