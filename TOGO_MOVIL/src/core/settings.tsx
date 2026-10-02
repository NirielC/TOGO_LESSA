import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { StabilizerConfig } from './signs/PredictionStabilizer';
import { NO_SIGN_LABEL } from './signs/vocabulary';

export interface Settings {
  /** Nombre de quien usa el teléfono (opcional). Saluda y arma "Me llamo…". */
  name: string;
  /** Cámara para leer señas: la trasera apunta a quien seña. */
  cameraFacing: 'back' | 'front';
  /** Decir en voz alta cada frase enviada desde señas. */
  autoSpeak: boolean;
  /** Al enviar una frase, pasar el turno a quien habla (micrófono). */
  listenAfterSend: boolean;
  /** Manos bajas durante este tiempo = la frase terminó y se envía. */
  finalizeAfterMs: number;
  showHands: boolean;
  /** Qué ayudas ya se vieron (se abren solas la primera vez). */
  seenHelp: { senas?: boolean; voz?: boolean };
  /** Mostrar "¿Quisiste decir…?" antes de decir una frase en señas. */
  confirmBeforeSpeak: boolean;
  /** Si falta el paquete de español sin conexión, usar el reconocedor con internet. */
  allowOnlineVoice: boolean;
  speechRate: number;
  quickPhrases: string[];
  // --- Avanzado ---
  signs: StabilizerConfig;
  letters: StabilizerConfig;
}

export const DEFAULT_SETTINGS: Settings = {
  name: '',
  cameraFacing: 'back',
  autoSpeak: true,
  listenAfterSend: false,
  finalizeAfterMs: 1200,
  showHands: true,
  confirmBeforeSpeak: true,
  seenHelp: {},
  allowOnlineVoice: true,
  speechRate: 0.95,
  quickPhrases: [
    'Hola, mucho gusto',
    'Soy una persona sorda, me comunico en LESSA',
    'No puedo hablar, uso esta app para comunicarme',
    '¿Puede repetirlo, por favor?',
    'Más despacio, por favor',
    'Un momento, por favor',
    'Gracias',
    '¿Me lo puede escribir?',
    'Necesito ayuda',
  ],
  signs: {
    confidenceThreshold: 0.82,
    minTopMargin: 0.2,
    stabilityFrames: 4, // ventanas seguidas (~0.6 s sostenida)
    cooldownMs: 1000, // pausa tras aceptar una seña
    releaseOnNoSignFrames: 4,
    noSignLabel: NO_SIGN_LABEL,
  },
  letters: {
    confidenceThreshold: 0.75,
    minTopMargin: 0.2,
    stabilityFrames: 5, // una letra debe sostenerse; las transiciones no cuentan
    cooldownMs: 400,
    releaseOnNoSignFrames: 3,
    noSignLabel: '_nada',
  },
};

const KEY = 'togo.settings.v2';
// v1 tenía otros valores de reconocimiento: de ahí solo se rescatan las preferencias personales.
const KEY_V1 = 'togo.settings.v1';
const KEEP_FROM_V1: (keyof Settings)[] = ['name', 'quickPhrases', 'cameraFacing', 'showHands', 'autoSpeak', 'speechRate'];

interface Ctx {
  settings: Settings;
  ready: boolean;
  update: (patch: Partial<Settings>) => void;
  reset: () => void;
}

const SettingsContext = createContext<Ctx | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const raw = await AsyncStorage.getItem(KEY);
      if (raw) return JSON.parse(raw);
      const old = await AsyncStorage.getItem(KEY_V1);
      if (!old) return null;
      const v1 = JSON.parse(old);
      return Object.fromEntries(KEEP_FROM_V1.filter((k) => k in v1).map((k) => [k, v1[k]]));
    })()
      .then((saved) => {
        if (!saved) return;
        // Mezcla con los valores por defecto: un ajuste nuevo no queda undefined.
        setSettings({
          ...DEFAULT_SETTINGS,
          ...saved,
          signs: { ...DEFAULT_SETTINGS.signs, ...saved.signs },
          letters: { ...DEFAULT_SETTINGS.letters, ...saved.letters },
        });
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  const persist = (s: Settings) => AsyncStorage.setItem(KEY, JSON.stringify(s)).catch(() => {});

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      persist(next);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setSettings((prev) => {
      const next = { ...DEFAULT_SETTINGS, name: prev.name, quickPhrases: prev.quickPhrases };
      persist(next);
      return next;
    });
  }, []);

  const value = useMemo(() => ({ settings, ready, update, reset }), [settings, ready, update, reset]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings fuera de <SettingsProvider>');
  return ctx;
}
