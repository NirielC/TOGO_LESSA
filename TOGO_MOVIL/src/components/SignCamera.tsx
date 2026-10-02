import { CameraView, useCameraPermissions } from 'expo-camera';
import { useIsFocused } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useConversation } from '../core/conversation/ConversationProvider';
import { useSettings } from '../core/settings';
import { QUALITY_TEXT } from '../core/signs/engine';
import { getVisionView } from '../core/signs/native';
import { colors, fonts, radius, space, type } from '../theme/tokens';
import { DevInjector } from './DevInjector';
import { Torogoz } from './Torogoz';
import { Button, Icon, IconButton } from './ui';

/**
 * La cámara de Leer señas. Por defecto la TRASERA: quien oye apunta el
 * teléfono hacia quien seña. Muestra:
 *   - la imagen con las manos dibujadas por el motor nativo,
 *   - la guía de calidad en vivo ("Aléjate un poco"),
 *   - el turno: si habla quien oye, se atenúa y dice por qué.
 */
export function SignCamera({ style }: { style?: object }) {
  const conv = useConversation();
  const { settings, update } = useSettings();
  const [permission, requestPermission] = useCameraPermissions();
  const [devOpen, setDevOpen] = useState(false);
  const focused = useIsFocused();
  const Vision = getVisionView();
  const listening = conv.state.turn === 'listener';
  const active = conv.cameraOn && focused && !!permission?.granted;
  const facing = settings.cameraFacing;

  let body: React.ReactNode = null;
  if (permission && !permission.granted) {
    body = (
      <View style={st.center}>
        <Icon name="camera-outline" size={34} color={colors.onInk} />
        <Text style={st.centerText}>Para leer las señas, Togo necesita la cámara. Las imágenes no se guardan ni salen del teléfono.</Text>
        <Button label="Permitir cámara" variant="primary" onPress={requestPermission} />
      </View>
    );
  } else if (!conv.cameraOn) {
    body = (
      <View style={st.center}>
        <Torogoz state="sleeping" size={64} />
        <Text style={st.centerText}>Cámara en pausa</Text>
        <Button label="Encender" variant="primary" icon="camera-outline" onPress={() => conv.setCameraOn(true)} />
      </View>
    );
  } else if (permission?.granted && Vision) {
    body = (
      <Vision
        style={StyleSheet.absoluteFill}
        active={active}
        facing={facing}
        letters
        showHands={settings.showHands}
        onPrediction={(e) => conv.ingest(e.nativeEvent)}
        onStatus={(e) => conv.ingest(e.nativeEvent)}
        onEngineError={(e) => conv.ingest({ type: 'error', message: e.nativeEvent.message })}
      />
    );
  } else if (permission?.granted && active) {
    body = <CameraView style={StyleSheet.absoluteFill} facing={facing} />;
  }

  const ok = conv.live.quality === 'ok';

  // Destello del borde cada vez que se acepta una seña o letra.
  const glow = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!conv.live.lastCommitAt) return;
    glow.setValue(1);
    Animated.timing(glow, { toValue: 0, duration: 700, useNativeDriver: false }).start();
  }, [conv.live.lastCommitAt, glow]);
  const borderColor = glow.interpolate({ inputRange: [0, 1], outputRange: [colors.sign, colors.celebrate] });
  const borderWidth = glow.interpolate({ inputRange: [0, 1], outputRange: [3, 7] });
  const chip = listening ? 'En pausa' : !Vision ? 'Vista previa: el reconocimiento está en la app instalada' : QUALITY_TEXT[conv.live.quality];

  return (
    <Pressable style={[st.card, style]} onLongPress={__DEV__ ? () => setDevOpen(true) : undefined} delayLongPress={600}>
      {body}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, st.frame, { borderColor, borderWidth }]} />

      {conv.live.sendProgress > 0 && !listening && (
        <View style={st.sending} pointerEvents="none">
          <Text style={st.sendingText}>Manos abajo: terminando la frase…</Text>
          <View style={st.sendTrack}>
            <View style={[st.sendFill, { width: `${Math.round(conv.live.sendProgress * 100)}%` }]} />
          </View>
        </View>
      )}

      {permission?.granted && conv.cameraOn && (
        <View style={st.topRow} pointerEvents="none">
          <View style={st.chip}>
            <View style={[st.dot, { backgroundColor: listening ? colors.voice : Vision && ok ? colors.live : colors.sand }]} />
            <Text style={st.chipText} numberOfLines={1}>{chip}</Text>
          </View>
        </View>
      )}

      {listening && (
        <View style={[st.pause, !permission?.granted && { backgroundColor: colors.ink }]} pointerEvents="none">
          <Torogoz state="listening" size={56} />
          <Text style={st.pauseTitle}>Te escucho</Text>
          <Text style={st.pauseText}>Las señas se pausan mientras hablas</Text>
        </View>
      )}

      {permission?.granted && (
        <View style={st.corner}>
          <IconButton
            icon="camera-flip-outline"
            label="Cambiar de cámara"
            onPress={() => update({ cameraFacing: facing === 'back' ? 'front' : 'back' })}
            color={colors.onInk}
            bg="rgba(13,43,69,0.55)"
            size={20}
          />
          <IconButton
            icon={conv.cameraOn ? 'pause' : 'play'}
            label={conv.cameraOn ? 'Pausar cámara' : 'Encender cámara'}
            onPress={() => conv.setCameraOn(!conv.cameraOn)}
            color={colors.onInk}
            bg="rgba(13,43,69,0.55)"
            size={20}
          />
        </View>
      )}

      {__DEV__ && <DevInjector open={devOpen} onClose={() => setDevOpen(false)} />}
      {__DEV__ && !Vision && (
        <Text style={st.devHint} pointerEvents="none">
          Mantén presionado para simular señas
        </Text>
      )}
    </Pressable>
  );
}

const st = StyleSheet.create({
  card: { backgroundColor: colors.ink, borderRadius: radius.xl, overflow: 'hidden' },
  frame: { borderRadius: radius.xl },
  sending: { position: 'absolute', left: space.md, right: space.md, bottom: space.md, backgroundColor: 'rgba(13,43,69,0.75)', borderRadius: radius.md, padding: space.sm, gap: 6 },
  sendingText: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.onInk, textAlign: 'center' },
  sendTrack: { height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.2)', overflow: 'hidden' },
  sendFill: { height: 6, backgroundColor: colors.celebrate },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md, padding: space.xl },
  centerText: { ...type.body, color: colors.onInk, textAlign: 'center' },
  topRow: { position: 'absolute', top: space.md, left: space.md, right: 110, flexDirection: 'row' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(13,43,69,0.65)',
    paddingHorizontal: space.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    maxWidth: '100%',
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  chipText: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.onInk, flexShrink: 1 },
  corner: { position: 'absolute', top: 4, right: 4, flexDirection: 'row' },
  pause: { ...StyleSheet.absoluteFill, backgroundColor: colors.overlay, alignItems: 'center', justifyContent: 'center', gap: 6, padding: space.xl },
  pauseTitle: { fontFamily: fonts.title, fontSize: 22, color: colors.onInk },
  pauseText: { ...type.small, color: colors.voice, textAlign: 'center' },
  devHint: { position: 'absolute', bottom: 8, alignSelf: 'center', ...type.small, color: colors.sand, fontSize: 11 },
});
