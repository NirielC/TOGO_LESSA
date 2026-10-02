import { joinPhrase, meaningOf, SignKind } from '../signs/vocabulary';

/**
 * LÓGICA DE LA CONVERSACIÓN (pura, sin React, se puede probar sola).
 *
 * Dos ideas que corrigen lo que fallaba antes:
 *
 * 1. FRASE EN CURSO. Una seña confirmada no es un mensaje: entra a un
 *    borrador visible ("Hola · ¿Cómo estás?"). El borrador se convierte en UN
 *    mensaje cuando quien seña baja las manos un momento o toca Enviar. Así:
 *      - "Hola, ¿cómo estás?" es un mensaje, no dos.
 *      - Se puede quitar una seña mal reconocida ANTES de que se diga en voz alta.
 *      - Una seña repetida seguida dentro de la frase se ignora.
 *
 * DELETREO INTEGRADO. No hay "modo deletreo": las letras confirmadas se juntan
 * en una palabra dentro de la misma frase ("Mi nombre es" + A-N-A -> "Ana").
 * Una seña después de las letras cierra la palabra.
 *
 * CONFIRMACIÓN ("¿Quisiste decir…?"). Con la confirmación activa, la frase
 * terminada queda en `pending` y solo pasa a la conversación (y se dice en voz
 * alta) cuando alguien toca "Sí". Así quien seña ve qué se entendió y una
 * frase mal reconocida no llega a decirse.
 *
 * 2. TURNOS. Hay dos turnos: el de quien seña y el de quien habla. Mientras es
 *    el turno de quien habla, las señas se ignoran por completo (la cámara
 *    sigue viva para no tardar en volver, pero nada entra a la conversación).
 *    El cambio de turno es el botón del micrófono: tocarlo = "te escucho".
 */

export type Turn = 'signer' | 'listener';
export type MessageSource = 'sign' | 'typed' | 'voice' | 'phrase';

export interface Message {
  id: string;
  source: MessageSource;
  text: string;
  at: number;
}

export interface DraftPart {
  id: string;
  label: string; // etiqueta del modelo o '__letters'
  text: string;
  kind: SignKind | 'deletreo';
}

export interface ConversationState {
  turn: Turn;
  messages: Message[];
  draft: DraftPart[];
  /** Frase terminada esperando "¿Quisiste decir…?". */
  pending: string | null;
  startedAt: number;
}

export type Action =
  | { type: 'sign'; label: string; at: number }
  | { type: 'letter'; letter: string }
  | { type: 'letterBackspace' }
  | { type: 'removePart'; id: string }
  | { type: 'finalize'; at: number; confirm?: boolean }
  | { type: 'confirmPending'; at: number }
  | { type: 'rejectPending' }
  | { type: 'discardDraft' }
  | { type: 'setTurn'; turn: Turn; at: number }
  | { type: 'voice'; text: string; at: number }
  | { type: 'typed'; text: string; at: number; source?: 'typed' | 'phrase' }
  | { type: 'clear'; at: number };

let counter = 0;
const id = (p: string) => `${p}_${Date.now().toString(36)}_${(counter++).toString(36)}`;

export const initialConversation = (at = Date.now()): ConversationState => ({
  turn: 'signer',
  messages: [],
  draft: [],
  pending: null,
  startedAt: at,
});

/** Texto que se diría si se enviara el borrador ahora. */
export function draftText(s: Pick<ConversationState, 'draft'>): string {
  return joinPhrase(s.draft);
}

export function conversationReducer(s: ConversationState, a: Action): ConversationState {
  switch (a.type) {
    case 'sign': {
      if (s.turn !== 'signer') return s; // turno de quien habla: no entra nada
      const m = meaningOf(a.label);
      const last = s.draft[s.draft.length - 1];
      if (last && last.label === m.label) return s; // la misma seña seguida no se repite
      return { ...s, draft: [...s.draft, { id: id('p'), label: m.label, text: m.text, kind: m.kind }] };
    }
    case 'letter': {
      if (s.turn !== 'signer') return s;
      const last = s.draft[s.draft.length - 1];
      if (last?.kind === 'deletreo') {
        const word = { ...last, text: last.text + a.letter };
        return { ...s, draft: [...s.draft.slice(0, -1), word] };
      }
      return { ...s, draft: [...s.draft, { id: id('w'), label: '__letters', text: a.letter, kind: 'deletreo' }] };
    }
    case 'letterBackspace': {
      const last = s.draft[s.draft.length - 1];
      if (last?.kind !== 'deletreo') return s;
      const text = last.text.slice(0, -1);
      return { ...s, draft: text ? [...s.draft.slice(0, -1), { ...last, text }] : s.draft.slice(0, -1) };
    }
    case 'removePart':
      return { ...s, draft: s.draft.filter((p) => p.id !== a.id) };
    case 'discardDraft':
      return { ...s, draft: [] };
    case 'finalize':
      return finalize(s, a.at, a.confirm);
    case 'confirmPending':
      if (!s.pending) return s;
      return { ...s, pending: null, messages: [...s.messages, { id: id('m'), source: 'sign', text: s.pending, at: a.at }] };
    case 'rejectPending':
      return { ...s, pending: null };
    case 'setTurn': {
      // Ceder el turno envía lo que estuviera a medias: no se pierde nada.
      const base = a.turn === 'listener' ? finalize(s, a.at) : s;
      return { ...base, turn: a.turn };
    }
    case 'voice': {
      const text = a.text.trim();
      if (!text) return s;
      return { ...s, messages: [...s.messages, { id: id('m'), source: 'voice', text, at: a.at }] };
    }
    case 'typed': {
      const text = a.text.trim();
      if (!text) return s;
      return {
        ...s,
        messages: [...s.messages, { id: id('m'), source: a.source ?? 'typed', text, at: a.at }],
      };
    }
    case 'clear':
      return initialConversation(a.at);
    default:
      return s;
  }
}

function finalize(s: ConversationState, at: number, confirm = false): ConversationState {
  const parts = s.draft.filter((p) => p.text.trim() !== '');
  if (!parts.length) return { ...s, draft: [] };
  const text = joinPhrase(parts);
  if (confirm) return { ...s, draft: [], pending: text };
  return {
    ...s,
    draft: [],
    messages: [...s.messages, { id: id('m'), source: 'sign', text, at }],
  };
}
