import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ConfirmPhrase } from '@/components/ConfirmPhrase';
import { DraftBar } from '@/components/DraftBar';
import { HelpSheet, useFirstTimeHelp } from '@/components/HelpSheet';
import { ListenBar } from '@/components/ListenBar';
import { AssistantStrip, ModeHeader } from '@/components/ModeHeader';
import { SignCamera } from '@/components/SignCamera';
import { Timeline } from '@/components/Timeline';
import { MASCOT_TEXT } from '@/components/Torogoz';
import { useConversation } from '@/core/conversation/ConversationProvider';
import { QUALITY_TEXT } from '@/core/signs/engine';
import { SIGN_TIPS } from '@/data/tips';
import { colors, palette, space } from '@/theme/tokens';

/**
 * LEER SEÑAS (para quien oye; también sirve con la cámara frontal para quien seña).
 *   arriba  Togo: qué está pasando + consejo
 *           cámara con las manos dibujadas, destello al aceptar una seña
 *   medio   frase en curso -> "¿Quisiste decir…?" -> conversación
 *   abajo   micrófono: lo que dices aparece en grande para quien seña
 */
export default function Senas() {
  const conv = useConversation();
  const [help, setHelp] = useFirstTimeHelp('senas');

  useEffect(() => {
    activateKeepAwakeAsync('senas').catch(() => {});
    return () => {
      deactivateKeepAwake('senas');
    };
  }, []);

  const q = conv.live.quality;
  const status =
    conv.live.sendProgress > 0
      ? 'Manos abajo: terminando la frase'
      : conv.mascot === 'attentive' && q !== 'ok' && q !== 'no_person'
        ? QUALITY_TEXT[q]
        : MASCOT_TEXT[conv.mascot];

  return (
    <SafeAreaView style={st.safe} edges={['top', 'bottom']}>
      <ModeHeader title="Leer señas" accent={palette.seafoam} onHelp={() => setHelp(true)} />
      <AssistantStrip mascot={conv.mascot} status={status} tips={SIGN_TIPS} tone={colors.signSoft} />
      <SignCamera style={st.camera} />
      <DraftBar />
      <View style={{ flex: 1 }}>
        <Timeline
          perspective="senas"
          mascot={false}
          empty={{ title: 'Apunta a quien seña', text: 'Al bajar las manos te pregunto "¿Quisiste decir…?". Para responder, toca el micrófono y habla.' }}
        />
      </View>
      <ListenBar label="Responder hablando" hint="Lo que digas aparecerá en grande para que lo lea" />
      <ConfirmPhrase />
      <HelpSheet mode="senas" open={help} onClose={() => setHelp(false)} />
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  camera: { flex: 1.3, marginHorizontal: space.md },
});
