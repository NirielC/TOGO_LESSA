/**
 * Qué significa cada etiqueta del modelo, en texto para leer y para decir.
 *
 * Las etiquetas vienen de labels.json (el modelo no se edita aquí). Si el
 * modelo trae una etiqueta que no está en esta tabla, se muestra legible
 * igual (guiones bajos -> espacios) en vez de romper.
 */
export type SignKind = 'saludo' | 'pregunta' | 'respuesta' | 'enlace' | 'despedida';

export interface SignMeaning {
  label: string;
  text: string; // como se muestra y se dice
  kind: SignKind;
  /** Para qué se usa (diccionario). */
  uso?: string;
}

/** Etiqueta del modelo que significa "no hay seña" (manos en reposo, gestos sueltos). */
export const NO_SIGN_LABEL = 'nada';

const TABLE: Record<string, Omit<SignMeaning, 'label'>> = {
  hola: { text: 'Hola', kind: 'saludo', uso: 'Para saludar al encontrarse con alguien.' },
  como_estas: { text: '¿Cómo estás?', kind: 'pregunta', uso: 'Para preguntar cómo se siente la otra persona.' },
  estoy_bien: { text: 'Estoy bien', kind: 'respuesta', uso: 'Para responder que te sientes bien.' },
  estoy_mas_o_menos: { text: 'Estoy más o menos', kind: 'respuesta', uso: 'Para responder que no estás ni bien ni mal.' },
  estoy_mal: { text: 'Estoy mal', kind: 'respuesta', uso: 'Para responder que no te sientes bien.' },
  mi_nombre_es: { text: 'Mi nombre es', kind: 'enlace', uso: 'Para presentarte; después se deletrea el nombre.' },
  si: { text: 'Sí', kind: 'respuesta', uso: 'Para afirmar o estar de acuerdo.' },
  a_que_hora_es: { text: '¿A qué hora es?', kind: 'pregunta', uso: 'Para preguntar la hora de una cita o actividad.' },
  por_la_tarde: { text: 'Por la tarde', kind: 'respuesta', uso: 'Para indicar que algo pasa en la tarde.' },
  ok_adios: { text: 'Ok, adiós', kind: 'despedida', uso: 'Para despedirse al terminar la conversación.' },
};

export function meaningOf(label: string): SignMeaning {
  const known = TABLE[label];
  if (known) return { label, ...known };
  const text = label.replace(/_/g, ' ');
  return { label, text: text.charAt(0).toUpperCase() + text.slice(1), kind: 'respuesta' };
}

export const KNOWN_LABELS = Object.keys(TABLE);

/**
 * Une las piezas de una frase en un texto natural:
 *   [Hola] [¿Cómo estás?]           -> "Hola, ¿cómo estás?"
 *   [Mi nombre es] + "ANA"           -> "Mi nombre es Ana"
 *   [Estoy bien] [Ok, adiós]         -> "Estoy bien. Ok, adiós."
 */
export function joinPhrase(parts: { text: string; kind: SignKind | 'deletreo' }[]): string {
  let out = '';
  parts.forEach((p, i) => {
    const prev = parts[i - 1];
    let piece = p.text;
    if (i === 0) {
      out = piece;
      return;
    }
    if (p.kind === 'deletreo') {
      out += ' ' + capitalizeName(piece);
      return;
    }
    if (prev?.kind === 'saludo') {
      // "Hola, ¿cómo estás?": tras un saludo va coma y minúscula.
      out += ', ' + lowerFirst(piece);
      return;
    }
    if (!/[.?!]$/.test(out)) out += '.';
    out += ' ' + piece;
  });
  if (out && !/[.?!]$/.test(out)) out += parts.length > 1 || parts[0]?.kind !== 'saludo' ? '.' : '';
  return out;
}

function lowerFirst(s: string) {
  // Respeta los signos de apertura: "¿Cómo" -> "¿cómo".
  return s.replace(/^([¿¡]?)(\p{L})/u, (_, a, b) => a + b.toLowerCase());
}

export function capitalizeName(s: string) {
  return s
    .toLowerCase()
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
