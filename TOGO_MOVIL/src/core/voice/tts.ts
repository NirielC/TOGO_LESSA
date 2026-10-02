import * as Speech from 'expo-speech';

/**
 * TEXTO -> VOZ con la voz del sistema.
 *
 * Tres cuidados porque en Android se rompía "de la nada" al reabrir la app:
 *   1. warmUp() al iniciar: el motor de voz de Android tarda en estar listo y
 *      la primera frase se perdía.
 *   2. Solo se llama a stop() si de verdad está hablando: stop() seguido de
 *      speak() puede cancelar la frase nueva.
 *   3. Si falla con la voz elegida, se reintenta sin elegir voz (la del sistema).
 */
let voiceId: string | undefined;
let resolved: Promise<string | undefined> | null = null;

function pickVoice() {
  if (!resolved) {
    resolved = Speech.getAvailableVoicesAsync()
      .then((voices) => {
        const es = voices.filter((v) => v.language?.toLowerCase().startsWith('es'));
        // Preferencia: Latinoamérica/EE. UU. > cualquier español.
        const rank = (l: string) => (/(419|us|mx)/i.test(l) ? 0 : /es-es/i.test(l) ? 1 : 2);
        es.sort((a, b) => rank(a.language) - rank(b.language));
        voiceId = es[0]?.identifier;
        return voiceId;
      })
      .catch(() => undefined);
  }
  return resolved;
}

/** Llamar al abrir la app: prepara el motor y elige la voz. */
export function warmUp() {
  pickVoice();
}

export interface SpeakOptions {
  rate?: number;
  /** Se llama al terminar, al detenerse o si falla: siempre una vez. */
  onDone?: () => void;
}

export async function speak(text: string, { rate = 0.95, onDone }: SpeakOptions = {}) {
  if (!text.trim()) return onDone?.();
  const voice = await pickVoice();
  try {
    if (await Speech.isSpeakingAsync()) {
      Speech.stop();
      await new Promise((r) => setTimeout(r, 80));
    }
  } catch {}

  let finished = false;
  const done = () => {
    if (finished) return;
    finished = true;
    onDone?.();
  };
  const plain = () =>
    Speech.speak(text, { language: 'es-US', rate, onDone: done, onStopped: done, onError: done });

  Speech.speak(text, {
    language: 'es-US',
    voice,
    rate,
    onDone: done,
    onStopped: done,
    onError: () => (voice ? plain() : done()),
  });
}

export function stopSpeaking() {
  Speech.isSpeakingAsync()
    .then((s) => {
      if (s) Speech.stop();
    })
    .catch(() => {});
}
