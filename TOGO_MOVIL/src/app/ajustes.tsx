import { goBack } from '@/core/nav';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Icon, IconButton } from '@/components/ui';
import { useConversation } from '@/core/conversation/ConversationProvider';
import { useSettings } from '@/core/settings';
import type { StabilizerConfig } from '@/core/signs/PredictionStabilizer';
import { visionAvailability } from '@/core/signs/native';
import * as stt from '@/core/voice/stt';
import { speak } from '@/core/voice/tts';
import { APP_VERSION } from '@/data/app';
import { colors, fonts, radius, space, type } from '@/theme/tokens';

export default function Ajustes() {
  const { settings, update, reset } = useSettings();
  const { live } = useConversation();
  const [advanced, setAdvanced] = useState(false);
  const [voiceInfo, setVoiceInfo] = useState<string | null>(null);
  const engine = visionAvailability();

  const checkVoice = async () => {
    if (!stt.sttAvailable()) return setVoiceInfo('No disponible aquí (Expo Go). Funciona en la app instalada.');
    const r = await stt.checkOffline();
    setVoiceInfo(
      r.lang
        ? `Listo: español instalado (${r.lang}).`
        : r.onDevice
          ? 'Falta descargar el paquete de español.'
          : 'Este teléfono no tiene reconocimiento de voz en el dispositivo.',
    );
  };

  const setSigns = (patch: Partial<StabilizerConfig>) => update({ signs: { ...settings.signs, ...patch } });
  const setLetters = (patch: Partial<StabilizerConfig>) => update({ letters: { ...settings.letters, ...patch } });

  return (
    <SafeAreaView style={st.safe}>
      <View style={st.head}>
        <IconButton icon="arrow-left" label="Volver" onPress={() => goBack()} />
        <Text style={type.h1}>Ajustes</Text>
      </View>
      <ScrollView contentContainerStyle={st.content}>
        <Section title="Tú">
          <View style={st.toggle}>
            <View style={{ flex: 1 }}>
              <Text style={type.bodyStrong}>Tu nombre</Text>
              <Text style={type.small}>Togo te saluda y aparece "Me llamo…" en tus frases</Text>
            </View>
            <TextInput
              value={settings.name}
              onChangeText={(name) => update({ name })}
              placeholder="Opcional"
              placeholderTextColor={colors.textFaint}
              style={st.nameInput}
              maxLength={30}
            />
          </View>
        </Section>

        <Section title="Conversación">
          <Toggle
            label="Preguntar «¿Quisiste decir…?»"
            hint="Muestra la frase reconocida en grande antes de decirla"
            value={settings.confirmBeforeSpeak}
            onChange={(v) => update({ confirmBeforeSpeak: v })}
          />
          <Toggle label="Decir en voz alta cada frase" hint="Al confirmar una frase en señas" value={settings.autoSpeak} onChange={(v) => update({ autoSpeak: v })} />
          <Toggle
            label="Escuchar después de cada frase"
            hint="Al decir tu frase, se activa el micrófono para la respuesta"
            value={settings.listenAfterSend}
            onChange={(v) => update({ listenAfterSend: v })}
          />
          <Stepper
            label="Manos abajo para enviar"
            hint="Cuánto esperar con las manos abajo antes de decir la frase"
            value={settings.finalizeAfterMs}
            min={600}
            max={3000}
            step={100}
            format={(v) => `${(v / 1000).toFixed(1)} s`}
            onChange={(v) => update({ finalizeAfterMs: v })}
          />
          <Stepper label="Velocidad de la voz" value={settings.speechRate} min={0.6} max={1.4} step={0.05} format={(v) => `${v.toFixed(2)}×`} onChange={(v) => update({ speechRate: Number(v.toFixed(2)) })} />
          <Button label="Probar voz" variant="soft" icon="volume-high" onPress={() => speak('Hola, soy Togo. Así sueno.', { rate: settings.speechRate })} />
        </Section>

        <Section title="Cámara">
          <Toggle label="Dibujar las manos" hint="Ayuda a ver si la app está siguiendo las manos" value={settings.showHands} onChange={(v) => update({ showHands: v })} />
          <Toggle
            label="Usar la cámara trasera"
            hint="Apunta a quien seña. Apágalo para usar la frontal"
            value={settings.cameraFacing === 'back'}
            onChange={(v) => update({ cameraFacing: v ? 'back' : 'front' })}
          />
          <Text style={type.small}>
            Reconocimiento: {engine.available ? 'activo en el teléfono' : engine.reason === 'expo-go' ? 'no disponible en Expo Go' : 'módulo no instalado'}
          </Text>
        </Section>

        <Section title="Voz a texto">
          <Text style={type.small}>Usa el reconocedor de voz del teléfono. Sin internet necesita el paquete de español descargado.</Text>
          <Toggle
            label="Usar internet si falta el español"
            hint="Si el paquete no está descargado, reconoce con internet en vez de fallar"
            value={settings.allowOnlineVoice}
            onChange={(v) => update({ allowOnlineVoice: v })}
          />
          <View style={st.row}>
            <Button label="Comprobar" variant="soft" onPress={checkVoice} />
            <Button label="Descargar español" variant="ghost" onPress={async () => setVoiceInfo(`Descarga: ${await stt.downloadSpanish()}`)} />
          </View>
          {voiceInfo && <Text style={type.bodyStrong}>{voiceInfo}</Text>}
        </Section>

        <Section title="Conversaciones">
          <Pressable style={st.link} onPress={() => router.push('/guardadas')}>
            <Icon name="bookmark-multiple-outline" />
            <Text style={[type.body, { flex: 1 }]}>Conversaciones guardadas</Text>
            <Icon name="chevron-right" color={colors.textFaint} />
          </Pressable>
        </Section>

        <Pressable style={st.advToggle} onPress={() => setAdvanced((a) => !a)}>
          <Text style={type.h2}>Avanzado</Text>
          <Icon name={advanced ? 'chevron-up' : 'chevron-down'} />
        </Pressable>
        {advanced && (
          <Section title="Reconocimiento de señas">
            <Text style={type.bodyStrong}>
              Rendimiento: {live.fps ? `${live.fps} fps · ${live.latencyMs} ms por frame` : 'abre Leer señas para medir'}
              {live.hasLetters ? ' · abecedario instalado' : ' · sin abecedario'}
            </Text>
            <Text style={type.small}>Más alto = menos errores pero hay que señar más claro.</Text>
            <Stepper label="Confianza mínima" value={settings.signs.confidenceThreshold} min={0.5} max={0.99} step={0.01} format={pct} onChange={(v) => setSigns({ confidenceThreshold: round2(v) })} />
            <Stepper label="Margen sobre la 2.ª opción" value={settings.signs.minTopMargin} min={0} max={0.6} step={0.05} format={pct} onChange={(v) => setSigns({ minTopMargin: round2(v) })} />
            <Stepper label="Ventanas para confirmar" value={settings.signs.stabilityFrames} min={1} max={10} step={1} format={(v) => `${v}`} onChange={(v) => setSigns({ stabilityFrames: v })} />
            <Stepper label="Pausa tras una seña" value={settings.signs.cooldownMs} min={0} max={3000} step={100} format={(v) => `${(v / 1000).toFixed(1)} s`} onChange={(v) => setSigns({ cooldownMs: v })} />
            <Text style={[type.label, { marginTop: space.md }]}>DELETREO</Text>
            <Stepper label="Confianza mínima" value={settings.letters.confidenceThreshold} min={0.5} max={0.99} step={0.01} format={pct} onChange={(v) => setLetters({ confidenceThreshold: round2(v) })} />
            <Stepper label="Ventanas para confirmar" value={settings.letters.stabilityFrames} min={1} max={12} step={1} format={(v) => `${v}`} onChange={(v) => setLetters({ stabilityFrames: v })} />
            <Button label="Restablecer valores" variant="soft" icon="restore" onPress={reset} />
          </Section>
        )}
        <Text style={[type.small, { textAlign: 'center', marginTop: space.lg }]}>Togo™ · {APP_VERSION} · el torogoz que habla LESSA</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const pct = (v: number) => `${Math.round(v * 100)}%`;
const round2 = (v: number) => Math.round(v * 100) / 100;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={st.section}>
      <Text style={type.label}>{title.toUpperCase()}</Text>
      <View style={st.card}>{children}</View>
    </View>
  );
}

function Toggle({ label, hint, value, onChange }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={st.toggle}>
      <View style={{ flex: 1 }}>
        <Text style={type.bodyStrong}>{label}</Text>
        {hint && <Text style={type.small}>{hint}</Text>}
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.sign, false: colors.border }} thumbColor={value ? colors.primary : colors.surface} />
    </View>
  );
}

function Stepper(p: { label: string; hint?: string; value: number; min: number; max: number; step: number; format: (v: number) => string; onChange: (v: number) => void }) {
  const set = (v: number) => p.onChange(Math.min(p.max, Math.max(p.min, v)));
  return (
    <View style={st.toggle}>
      <View style={{ flex: 1 }}>
        <Text style={type.bodyStrong}>{p.label}</Text>
        {p.hint && <Text style={type.small}>{p.hint}</Text>}
      </View>
      <View style={st.stepper}>
        <IconButton icon="minus" label={`Bajar ${p.label}`} onPress={() => set(p.value - p.step)} size={18} />
        <Text style={st.stepValue}>{p.format(p.value)}</Text>
        <IconButton icon="plus" label={`Subir ${p.label}`} onPress={() => set(p.value + p.step)} size={18} />
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.md, paddingVertical: space.sm },
  content: { padding: space.lg, gap: space.lg, paddingBottom: space.xxl },
  section: { gap: space.sm },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.lg, gap: space.md },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  stepper: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceAlt, borderRadius: radius.pill },
  stepValue: { fontFamily: fonts.bodyBold, fontSize: 14, minWidth: 52, textAlign: 'center', color: colors.text },
  link: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 44 },
  nameInput: { ...type.body, width: 140, backgroundColor: colors.surfaceAlt, borderRadius: radius.pill, paddingHorizontal: space.md, height: 40, textAlign: 'center' },
  advToggle: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: space.xs },
});
