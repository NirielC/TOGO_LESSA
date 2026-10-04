import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useSettings } from '../settings';
import type { EngineEvent, Quality } from '../signs/engine';
import { PredictionStabilizer } from '../signs/PredictionStabilizer';
import { meaningOf } from '../signs/vocabulary';
import * as stt from '../voice/stt';
import { speak, stopSpeaking, warmUp } from '../voice/tts';
import { ConversationState, conversationReducer, draftText, initialConversation, Message, Turn } from './reducer';

/**
 * Une el motor de señas, la voz y la conversación. Las pantallas solo leen
 * estado y llaman acciones; ninguna lógica de reconocimiento vive en la UI.
 *
 * Señas y letras llegan juntas del motor. Una letra solo cuenta si en ese
 * momento NO se está formando una seña (el modelo de señas no está seguro):
 * así no hace falta un "modo deletreo" que alguien tenga que activar.
 */

export type Mascot = 'sleeping' | 'attentive' | 'thinking' | 'celebrating' | 'confused' | 'listening';

export interface VoiceUi {
  active: boolean;
  partial: string;
  volume: number;
  error: string | null;
  /** El error se arregla descargando el paquete de español. */
  needsLanguage?: boolean;
}

export interface LiveUi {
  quality: Quality;
  hands: number;
  candidate: string | null; // texto de lo que se está formando
  progress: number;
  fps: number;
  latencyMs: number;
  hasLetters: boolean;
  /** 0..1: cuánto falta para enviar la frase con las manos abajo (0 = nada). */
  sendProgress: number;
  /** Momento de la última seña/letra aceptada (destello en la cámara). */
  lastCommitAt: number;
}

interface Ctx {
  state: ConversationState;
  draft: string;
  live: LiveUi;
  voice: VoiceUi;
  mascot: Mascot;
  cameraOn: boolean;
  setCameraOn: (on: boolean) => void;
  /** Mensaje que se muestra en grande (pizarra). null = cerrada. */
  board: Message | null;
  showBoard: (m: Message | null) => void;
  clearVoiceError: () => void;
  ingest: (e: EngineEvent) => void;
  sendDraft: () => void;
  /** "¿Quisiste decir…?": sí = se dice y entra a la conversación. */
  confirmPending: () => void;
  rejectPending: () => void;
  removePart: (id: string) => void;
  discardDraft: () => void;
  letterBackspace: () => void;
  sayTyped: (text: string, source?: 'typed' | 'phrase') => void;
  ingestListenerText: (text: string) => void;
  repeat: (m: Message) => void;
  startVoice: () => Promise<void>;
  stopVoice: () => void;
  setTurn: (t: Turn) => void;
  clear: () => void;
  save: () => Promise<void>;
}

const C = createContext<Ctx | null>(null);
const SAVED_KEY = 'togo.saved.v1';

export interface SavedConversation {
  id: string;
  startedAt: number;
  savedAt: number;
  messages: Message[];
}

export async function loadSaved(): Promise<SavedConversation[]> {
  try {
    return JSON.parse((await AsyncStorage.getItem(SAVED_KEY)) ?? '[]');
  } catch {
    return [];
  }
}

export async function deleteSaved(id: string) {
  const list = (await loadSaved()).filter((c) => c.id !== id);
  await AsyncStorage.setItem(SAVED_KEY, JSON.stringify(list));
}

const NO_SPEECH = new Set(['no-speech', 'speech-timeout']);
/** Redondea a pasos (menos cambios = menos re-dibujos). */
const step = (x: number, s: number) => Math.round(x / s) * s;

export function ConversationProvider({ children }: { children: React.ReactNode }) {
  const { settings } = useSettings();
  const [state, dispatch] = useReducer(conversationReducer, undefined, () => initialConversation());
  const [cameraOn, setCameraOn] = useState(true);
  const [live, setLive] = useState<LiveUi>({
    quality: 'no_person',
    hands: 0,
    candidate: null,
    progress: 0,
    fps: 0,
    latencyMs: 0,
    hasLetters: false,
    sendProgress: 0,
    lastCommitAt: 0,
  });
  const [voice, setVoice] = useState<VoiceUi>({ active: false, partial: '', volume: 0, error: null });
  const [flash, setFlash] = useState<'celebrating' | 'confused' | null>(null);
  const [board, setBoard] = useState<Message | null>(null);

  // Solo re-dibuja si algo visible cambió: los eventos del motor llegan ~28 veces
  // por segundo y antes cada uno re-dibujaba toda la pantalla (se sentía trabado).
  const patchLive = useCallback((p: Partial<LiveUi>) => {
    setLive((l) => {
      for (const k in p) {
        if (l[k as keyof LiveUi] !== p[k as keyof LiveUi]) return { ...l, ...p };
      }
      return l;
    });
  }, []);

  const signStab = useRef(new PredictionStabilizer(settings.signs));
  const letterStab = useRef(new PredictionStabilizer(settings.letters));
  useEffect(() => signStab.current.setConfig(settings.signs), [settings.signs]);
  useEffect(() => letterStab.current.setConfig(settings.letters), [settings.letters]);

  const stateRef = useRef(state);
  stateRef.current = state;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const lastHandsAt = useRef(0);
  const lowConfSince = useRef(0);
  const lastSign = useRef({ confident: false, at: 0 });
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showFlash = (f: 'celebrating' | 'confused', ms = 900) => {
    setFlash(f);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(null), ms);
  };

  // ---------- Lo nuevo: decirlo en voz alta o mostrarlo en grande ----------
  useEffect(() => warmUp(), []);

  const seenUpTo = useRef(0);
  const startVoiceRef = useRef<() => void>(() => {});
  useEffect(() => {
    const msgs = state.messages;
    for (let i = seenUpTo.current; i < msgs.length; i++) {
      const m = msgs[i];
      if (m.source === 'voice') {
        // Lo que dijo quien habla se abre en la pizarra, en letra grande.
        setBoard(m);
        continue;
      }
      // "Escuchar después de cada frase": el micrófono se abre cuando la voz
      // TERMINA de hablar (antes se abría encima y cortaba la voz).
      const listenAfter = settings.listenAfterSend && i === msgs.length - 1;
      const after = listenAfter ? () => setTimeout(() => startVoiceRef.current(), 300) : undefined;
      // Escrito y frases se dicen siempre (para eso son); las señas según el ajuste.
      if (settings.autoSpeak || m.source !== 'sign') speak(m.text, { rate: settings.speechRate, onDone: after });
      else after?.();
    }
    seenUpTo.current = msgs.length;
  }, [state.messages, settings.autoSpeak, settings.speechRate, settings.listenAfterSend]);

  // ---------- Motor de señas ----------
  const ingest = useCallback((e: EngineEvent) => {
    const s = stateRef.current;
    const cfg = settingsRef.current;
    const now = Date.now();

    if (e.type === 'status') {
      if (e.hands > 0) lastHandsAt.current = now;
      // Manos abajo un rato = la frase terminó. La barra de envío muestra cuánto falta.
      const waiting = s.turn === 'signer' && s.draft.length > 0 && e.hands === 0 && !s.pending;
      const elapsed = now - lastHandsAt.current;
      const sendProgress = waiting ? Math.min(1, elapsed / cfg.finalizeAfterMs) : 0;
      patchLive({ quality: e.quality, hands: e.hands, fps: Math.round(e.fps), latencyMs: step(e.latencyMs, 10), hasLetters: !!e.hasLetters, sendProgress: step(sendProgress, 0.05) });
      if (waiting && elapsed >= cfg.finalizeAfterMs) {
        dispatch({ type: 'finalize', at: now, confirm: cfg.confirmBeforeSpeak });
      }
      return;
    }
    // Turno de quien habla, o esperando "¿Quisiste decir…?": nada cuenta.
    if (e.type !== 'prediction' || s.turn !== 'signer' || s.pending) return;

    if (e.mode === 'signs') {
      const snap = signStab.current.push(
        { label: e.label, confidence: e.confidence, margin: e.margin, handsVisible: e.handsVisible },
        now,
      );
      const isSign = e.label !== cfg.signs.noSignLabel && e.confidence >= cfg.signs.confidenceThreshold;
      lastSign.current = { confident: isSign && e.handsVisible, at: now };
      patchLive({ candidate: snap.candidate ? meaningOf(snap.candidate).text : null, progress: step(snap.progress, 0.05) });

      // "No te entendí": hay manos pero nada pasa el umbral durante 2.5 s.
      if (e.handsVisible && !isSign && snap.state !== 'latched' && snap.state !== 'cooldown') {
        if (!lowConfSince.current) lowConfSince.current = now;
        else if (now - lowConfSince.current > 2500) {
          showFlash('confused', 1500);
          lowConfSince.current = 0;
        }
      } else lowConfSince.current = 0;

      if (snap.committed) {
        dispatch({ type: 'sign', label: snap.committed.label, at: now });
        patchLive({ lastCommitAt: now });
        letterStab.current.reset();
        Haptics.selectionAsync().catch(() => {});
        showFlash('celebrating');
      }
      return;
    }

    // Letras: solo si el modelo de señas no está viendo una seña ahora mismo.
    const signBusy = lastSign.current.confident && now - lastSign.current.at < 600;
    const snap = letterStab.current.push(
      { label: e.label, confidence: e.confidence, margin: e.margin, handsVisible: e.handsVisible && !signBusy },
      now,
    );
    if (!signBusy && snap.candidate) patchLive({ candidate: snap.candidate, progress: step(snap.progress, 0.05) });
    if (snap.committed) {
      lowConfSince.current = 0;
      dispatch({ type: 'letter', letter: snap.committed.label });
      patchLive({ lastCommitAt: now });
      Haptics.selectionAsync().catch(() => {});
      showFlash('celebrating', 500);
    }
  }, [patchLive]);

  // ---------- Voz ----------
  const voiceActive = useRef(false);
  // Guarda lo último que se oyó en la sesión de voz actual. Muchos reconocedores
  // de Android no mandan el resultado "final" (al tocar Terminar, al cortarse por
  // silencio...): antes ese texto se perdía y nunca llegaba a la conversación.
  const commitHeard = useRef<() => void>(() => {});
  const stopVoice = useCallback(() => {
    if (!voiceActive.current) return;
    stt.stopListening();
    // Si el reconocedor no confirma el cierre, se cierra igual.
    setTimeout(() => {
      if (!voiceActive.current) return;
      commitHeard.current();
      stt.abortListening();
      voiceActive.current = false;
      setVoice((v) => ({ ...v, active: false, volume: 0, partial: '' }));
      signStab.current.reset();
      dispatch({ type: 'setTurn', turn: 'signer', at: Date.now() });
    }, 2500);
  }, []);

  const backToSigner = useCallback(() => {
    signStab.current.reset();
    letterStab.current.reset();
    dispatch({ type: 'setTurn', turn: 'signer', at: Date.now() });
  }, []);

  const startVoice = useCallback(async () => {
    stopSpeaking();
    dispatch({ type: 'setTurn', turn: 'listener', at: Date.now() });
    setVoice({ active: true, partial: '', volume: 0, error: null });
    const fail = (error: string, needsLanguage = false) => {
      voiceActive.current = false;
      setVoice({ active: false, partial: '', volume: 0, error, needsLanguage });
      backToSigner();
    };
    if (!stt.sttAvailable()) return fail('La voz a texto funciona en la app instalada. Por ahora, escribe la respuesta.');
    if (!(await stt.requestMicPermission())) return fail('Togo necesita permiso para usar el micrófono.');

    // Primero sin internet; si el teléfono no tiene el español descargado, con
    // internet (si el ajuste lo permite). Así funciona en cualquier teléfono.
    const offline = await stt.checkOffline();
    const allowOnline = settingsRef.current.allowOnlineVoice;
    let onDevice = !!offline.lang || !allowOnline;
    let retried = false;

    // Perro guardián: algunos reconocedores abren el micrófono y nunca avisan
    // que terminaron. Sin texto en 8 s, o 30 s en total, se corta; y si el
    // sistema no confirma el cierre, se limpia el estado igual.
    let heard = false;
    let lastPartial = '';
    let committed = false;
    const commit = (text: string) => {
      if (committed || !text.trim()) return;
      committed = true;
      dispatch({ type: 'voice', text, at: Date.now() });
    };
    commitHeard.current = () => commit(lastPartial);
    const timers: ReturnType<typeof setTimeout>[] = [];
    const clearTimers = () => timers.splice(0).forEach(clearTimeout);
    const forceEnd = (msg: string | null) => {
      clearTimers();
      commit(lastPartial);
      stt.abortListening();
      if (!voiceActive.current) return;
      if (msg) fail(msg);
      else {
        voiceActive.current = false;
        setVoice((v) => ({ ...v, active: false, volume: 0, partial: '' }));
        backToSigner();
      }
    };
    const run = () => {
      voiceActive.current = true;
      heard = false;
      lastPartial = '';
      committed = false;
      clearTimers();
      timers.push(setTimeout(() => !heard && forceEnd('No escuché nada. Toca el micrófono y habla cerca del teléfono.'), 8000));
      timers.push(setTimeout(() => {
        stt.stopListening();
        timers.push(setTimeout(() => forceEnd(null), 2500));
      }, 30000));
      stt.startListening(handle, { onDevice });
    };
    const handle = (ev: stt.SttEvent) => {
      if (ev.type === 'partial' || ev.type === 'final') heard = true;
      if (ev.type === 'end' || ev.type === 'error') clearTimers();
      switch (ev.type) {
        case 'partial':
          if (ev.text.trim()) lastPartial = ev.text;
          setVoice((v) => ({ ...v, partial: ev.text }));
          break;
        case 'volume':
          setVoice((v) => ({ ...v, volume: ev.value }));
          break;
        case 'final':
          commit(ev.text.trim() ? ev.text : lastPartial);
          setVoice((v) => ({ ...v, partial: '' }));
          // Una intervención = un resultado final; si no llega 'end', se cierra igual.
          clearTimers();
          timers.push(setTimeout(() => forceEnd(null), 1500));
          break;
        case 'error': {
          const langProblem = ev.code === 'language-not-supported' || ev.code === 'service-not-allowed' || ev.code === 'network';
          if (langProblem && onDevice && allowOnline && !retried) {
            retried = true; // reintento con el reconocedor con internet
            onDevice = false;
            voiceActive.current = false;
            stt.abortListening();
            setTimeout(run, 150);
            return;
          }
          // Se oyó algo y luego se cortó: vale lo que se alcanzó a oír.
          if (lastPartial.trim()) {
            commit(lastPartial);
            voiceActive.current = false;
            setVoice((v) => ({ ...v, active: false, volume: 0, partial: '' }));
            return backToSigner();
          }
          if (NO_SPEECH.has(ev.code)) return fail('No escuché nada. Toca el micrófono y habla cerca del teléfono.');
          return fail(ev.message, ev.code === 'language-not-supported');
        }
        case 'end':
          if (retried && !voiceActive.current) return; // el reintento sigue su curso
          commit(lastPartial);
          voiceActive.current = false;
          setVoice((v) => ({ ...v, active: false, volume: 0, partial: '' }));
          backToSigner(); // terminó de hablar: vuelve el turno a quien seña
          break;
      }
    };
    run();
  }, [backToSigner]);

  startVoiceRef.current = startVoice;

  const setTurn = useCallback(
    (turn: Turn) => {
      if (turn === 'listener') startVoice();
      else {
        if (voiceActive.current) stt.abortListening();
        voiceActive.current = false;
        setVoice({ active: false, partial: '', volume: 0, error: null });
        backToSigner();
      }
    },
    [startVoice, backToSigner],
  );

  const save = useCallback(async () => {
    const s = stateRef.current;
    if (!s.messages.length) return;
    const list = await loadSaved();
    const entry: SavedConversation = { id: `c_${s.startedAt}`, startedAt: s.startedAt, savedAt: Date.now(), messages: s.messages };
    await AsyncStorage.setItem(SAVED_KEY, JSON.stringify([entry, ...list.filter((c) => c.id !== entry.id)]));
  }, []);

  const mascot: Mascot = useMemo(() => {
    if (state.turn === 'listener' || voice.active) return 'listening';
    if (flash) return flash;
    if (!cameraOn) return 'sleeping';
    if (live.progress > 0) return 'thinking';
    if (live.hands > 0) return 'attentive';
    return live.quality === 'no_person' ? 'sleeping' : 'attentive';
  }, [state.turn, voice.active, flash, cameraOn, live.progress, live.hands, live.quality]);

  const value: Ctx = {
    state,
    draft: draftText(state),
    live,
    voice,
    mascot,
    cameraOn,
    setCameraOn,
    board,
    showBoard: setBoard,
    clearVoiceError: () => setVoice((v) => ({ ...v, error: null, needsLanguage: false })),
    ingest,
    sendDraft: () => dispatch({ type: 'finalize', at: Date.now(), confirm: settings.confirmBeforeSpeak }),
    confirmPending: () => dispatch({ type: 'confirmPending', at: Date.now() }),
    rejectPending: () => {
      signStab.current.reset();
      dispatch({ type: 'rejectPending' });
    },
    removePart: (id) => dispatch({ type: 'removePart', id }),
    discardDraft: () => dispatch({ type: 'discardDraft' }),
    letterBackspace: () => dispatch({ type: 'letterBackspace' }),
    sayTyped: (text, source = 'typed') => dispatch({ type: 'typed', text, at: Date.now(), source }),
    ingestListenerText: (text) => dispatch({ type: 'voice', text, at: Date.now() }),
    repeat: (m) => speak(m.text, { rate: settings.speechRate }),
    startVoice,
    stopVoice,
    setTurn,
    clear: () => dispatch({ type: 'clear', at: Date.now() }),
    save,
  };

  return <C.Provider value={value}>{children}</C.Provider>;
}

export function useConversation() {
  const ctx = useContext(C);
  if (!ctx) throw new Error('useConversation fuera de <ConversationProvider>');
  return ctx;
}
