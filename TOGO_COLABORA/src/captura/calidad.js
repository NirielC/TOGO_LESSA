/**
 * Revisión de una toma: AMABLE a propósito.
 *
 * Solo se descarta lo que de verdad no sirve (sin manos, sin cuerpo, incompleta).
 * Luz, distancia, manos cortadas o poco movimiento son SUGERENCIAS: la toma se
 * envía igual, porque la variedad de condiciones también enseña al modelo.
 * Basado en evaluar() de TOGO_DATASET/tools/capture_videos.py.
 */
const MIN_LUZ = 55;
const HOMBROS = [0.16, 0.6];

const cortada = (manos, m = 0.02) =>
  manos.some((h) => h.some(([x, y]) => x < m || x > 1 - m || y < m || y > 1 - m));

/** Aviso en vivo, mientras la persona se acomoda (uno a la vez, el más útil). */
export function avisoEnVivo(info) {
  if (!info) return null;
  if (info.luz < 8) return { tono: 'mal', texto: 'La imagen está negra: ¿la cámara está tapada?' };
  if (info.hombros == null) return { tono: 'sol', texto: 'Que se vean tu cara y tus hombros' };
  if (info.hombros > HOMBROS[1]) return { tono: 'sol', texto: 'Estás muy cerca: aléjate un poco' };
  if (info.hombros < HOMBROS[0]) return { tono: 'sol', texto: 'Estás lejos: acércate un poco' };
  if (info.luz < MIN_LUZ) return { tono: 'sol', texto: 'Un poco más de luz ayudaría' };
  if (info.manos.length && cortada(info.manos)) return { tono: 'sol', texto: 'Tus manos tocan el borde' };
  return { tono: 'ok', texto: 'Te veo bien ✓' };
}

/**
 * infos: [{hombros, manos, luz}] por cuadro; esperado: cuadros que debía tener.
 * -> { ok, motivo, avisos: [texto], calidad: {...} }
 */
export function evaluarToma(infos, tiempos, esperado, tipo) {
  const n = infos.length;
  const dur = n > 1 ? (tiempos[n - 1] - tiempos[0]) / 1000 : 0;
  const fps = dur > 0 ? (n - 1) / dur : 0;
  const cuerpo = n ? infos.filter((c) => c.hombros != null).length / n : 0;
  const conManos = n ? infos.filter((c) => c.manos.length).length / n : 0;
  const nManos = infos.filter((c) => c.manos.length).length;
  const cort = nManos ? infos.filter((c) => c.manos.length && cortada(c.manos)).length / nManos : 0;
  const luz = n ? infos.reduce((s, c) => s + c.luz, 0) / n : 0;
  const anchos = infos.map((c) => c.hombros).filter((x) => x != null).sort((a, b) => a - b);
  const ancho = anchos.length ? anchos[anchos.length >> 1] : 0.3;
  const munecas = infos.flatMap((c) => c.manos.map((h) => h[0]));
  let mov = 0;
  if (munecas.length > 2) {
    const xs = munecas.map((p) => p[0]);
    const ys = munecas.map((p) => p[1]);
    mov = (Math.max(...xs) - Math.min(...xs) + Math.max(...ys) - Math.min(...ys)) / Math.max(ancho, 0.05);
  }
  const calidad = {
    cuerpo: +cuerpo.toFixed(2),
    manos: +conManos.toFixed(2),
    cortadas: +cort.toFixed(2),
    mov: +mov.toFixed(2),
    luz: Math.round(luz),
    hombros: +ancho.toFixed(3),
    fps: +fps.toFixed(1),
  };

  const nada = tipo === 'nada';
  // --- lo único que descarta
  if (n < esperado * 0.6 || fps < 8)
    return { ok: false, motivo: 'La toma quedó incompleta. Deja la página abierta mientras grabas y vuelve a intentar.', avisos: [], calidad };
  if (cuerpo < 0.3)
    return { ok: false, motivo: 'No vimos tu cuerpo. Que se vean tu cara y tus hombros, y repite.', avisos: [], calidad };
  if (!nada && conManos < 0.3)
    return { ok: false, motivo: 'Casi no vimos tus manos. Haz la seña frente a la cámara y repite.', avisos: [], calidad };

  // --- sugerencias (la toma vale igual)
  const avisos = [];
  if (luz < MIN_LUZ) avisos.push('La próxima, un poco más de luz frente a ti.');
  if (ancho > HOMBROS[1]) avisos.push('Estabas muy cerca: aléjate un poco.');
  else if (ancho < HOMBROS[0]) avisos.push('Estabas lejos: acércate un poco.');
  if (!nada && conManos < 0.7) avisos.push('A ratos no vimos tus manos.');
  if (!nada && cort > 0.25) avisos.push('Tus manos se salieron un poco del cuadro.');
  if (!nada && tipo !== 'letra' && mov < 0.2) avisos.push('Haz el movimiento completo de la seña.');
  if (fps < 15) avisos.push('Tu teléfono fue algo lento: cierra otras apps si puedes.');
  calidad.avisos = avisos;
  return { ok: true, motivo: null, avisos, calidad };
}
