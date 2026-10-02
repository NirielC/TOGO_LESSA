/**
 * VOZ -> TEXTO, offline.
 *
 * Usa el reconocedor del propio Android en modo "en el dispositivo"
 * (requiresOnDeviceRecognition). No manda audio a internet. Depende de que el
 * paquete de español esté descargado en el teléfono: `checkOffline()` lo
 * revisa y `downloadSpanish()` abre la descarga (Android 13+).
 *
 * En Expo Go el módulo nativo no existe: todo devuelve "no disponible" en vez
 * de romper la pantalla.
 */
type Listener = { remove(): void };

export type SttEvent =
  | { type: 'start' }
  | { type: 'partial'; text: string }
  | { type: 'final'; text: string }
  | { type: 'volume'; value: number } // 0..1
  | { type: 'end' }
  | { type: 'error'; code: string; message: string };

// es-US (español de América) es el que más reconocedores soportan; si hay un
// paquete instalado sin conexión, se usa el que exista.
export const STT_LANG = 'es-US';
const FALLBACK_LANGS = ['es-US', 'es-419', 'es-MX', 'es-ES'];

let mod: any | null | undefined;
function native(): any | null {
  if (mod !== undefined) return mod;
  // Se pregunta si el módulo nativo existe ANTES de cargar el paquete: en Expo
  // Go no existe, y cargar el paquete igual dispararía la pantalla roja.
  const { requireOptionalNativeModule } = require('expo');
  mod = requireOptionalNativeModule('ExpoSpeechRecognition') ? require('expo-speech-recognition').ExpoSpeechRecognitionModule : null;
  return mod;
}

export function sttAvailable(): boolean {
  const m = native();
  try {
    return !!m && m.isRecognitionAvailable();
  } catch {
    return false;
  }
}

export interface OfflineCheck {
  onDevice: boolean;
  lang: string | null; // idioma español instalado que se usará
}

let chosenLang = STT_LANG;

export async function checkOffline(): Promise<OfflineCheck> {
  const m = native();
  if (!m) return { onDevice: false, lang: null };
  try {
    const onDevice = m.supportsOnDeviceRecognition();
    const { installedLocales = [] } = await m.getSupportedLocales({});
    const lang =
      FALLBACK_LANGS.find((l) => installedLocales.includes(l)) ??
      installedLocales.find((l: string) => l.startsWith('es')) ??
      null;
    if (lang) chosenLang = lang;
    return { onDevice, lang };
  } catch {
    return { onDevice: false, lang: null };
  }
}

export async function downloadSpanish(): Promise<string> {
  const m = native();
  if (!m) return 'no disponible';
  const r = await m.androidTriggerOfflineModelDownload({ locale: 'es-US' });
  return r.status;
}

export async function requestMicPermission(): Promise<boolean> {
  const m = native();
  if (!m) return false;
  const r = await m.requestPermissionsAsync();
  return !!r.granted;
}

let listeners: Listener[] = [];

export function startListening(onEvent: (e: SttEvent) => void, { onDevice = true }: { onDevice?: boolean } = {}) {
  const m = native();
  if (!m) {
    onEvent({ type: 'error', code: 'unavailable', message: 'Reconocimiento de voz no disponible en Expo Go' });
    return;
  }
  stopListeners();
  listeners = [
    m.addListener('start', () => onEvent({ type: 'start' })),
    m.addListener('end', () => onEvent({ type: 'end' })),
    m.addListener('result', (ev: any) => {
      const text: string = ev.results?.[0]?.transcript ?? '';
      onEvent(ev.isFinal ? { type: 'final', text } : { type: 'partial', text });
    }),
    m.addListener('error', (ev: any) => {
      onEvent({ type: 'error', code: ev.error ?? 'error', message: errorText(ev.error, ev.message) });
    }),
    m.addListener('volumechange', (ev: any) => {
      // Android entrega de -2 a 10; se lleva a 0..1 para la onda.
      onEvent({ type: 'volume', value: Math.max(0, Math.min(1, (ev.value + 2) / 12)) });
    }),
  ];
  m.start({
    lang: chosenLang,
    interimResults: true,
    continuous: false, // una intervención = un mensaje; termina al callar
    // En el dispositivo = sin internet. Si falta el paquete de español, quien
    // llama puede reintentar con onDevice:false (reconocedor con internet).
    requiresOnDeviceRecognition: onDevice,
    addsPunctuation: true,
    volumeChangeEventOptions: { enabled: true, intervalMillis: 120 },
    androidIntentOptions: {
      // Pausa larga antes de cortar: la gente hace pausas al hablar despacio.
      EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS: 1800,
      EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS: 1500,
    },
  });
}

export function stopListening() {
  native()?.stop();
}

export function abortListening() {
  native()?.abort();
  stopListeners();
}

function stopListeners() {
  listeners.forEach((l) => l.remove());
  listeners = [];
}

function errorText(code: string, fallback?: string) {
  switch (code) {
    case 'no-speech':
    case 'speech-timeout':
      return 'No escuché nada. Toca el micrófono e intenta de nuevo.';
    case 'language-not-supported':
      return 'Falta el paquete de español. Descárgalo en Ajustes > Voz a texto.';
    case 'not-allowed':
      return 'Togo necesita permiso para usar el micrófono.';
    case 'network':
      return 'El reconocimiento de voz no está listo en este teléfono. Revisa Ajustes > Voz a texto.';
    default:
      return fallback || 'No se pudo reconocer la voz.';
  }
}
