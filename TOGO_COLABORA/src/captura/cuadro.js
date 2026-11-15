/**
 * Resultado de MediaPipe -> vector crudo de 258 valores (sin dependencias: se prueba con Node).
 */
import { DIM } from './formato.js';

export const POSE_DIM = 33 * 4;
export const HAND_DIM = 21 * 3;

/** Igual que frame_from_results() en TOGO_DATASET/togo_features.py. */
export function cuadroDesde(poseRes, manosRes) {
  const out = new Float32Array(DIM);
  const lm = poseRes?.landmarks?.[0];
  if (lm) {
    lm.forEach((q, i) => {
      out[i * 4] = q.x;
      out[i * 4 + 1] = q.y;
      out[i * 4 + 2] = q.z;
      out[i * 4 + 3] = q.visibility ?? 0;
    });
  }
  const marcas = manosRes?.landmarks || [];
  const lados = manosRes?.handedness || manosRes?.handednesses || [];
  // La mano más segura reclama su lado primero; si las dos dicen el mismo lado,
  // la segunda toma el libre.
  const manos = marcas
    .map((m, i) => ({ m, score: lados[i]?.[0]?.score ?? 0, lado: lados[i]?.[0]?.categoryName ?? 'Right' }))
    .sort((a, b) => b.score - a.score);
  const tomado = new Set();
  for (const { m, lado } of manos) {
    const slot = !tomado.has(lado) ? lado : lado === 'Left' ? 'Right' : 'Left';
    if (tomado.has(slot)) continue;
    tomado.add(slot);
    const ini = slot === 'Left' ? POSE_DIM : POSE_DIM + HAND_DIM;
    m.forEach((q, j) => {
      out[ini + j * 3] = q.x;
      out[ini + j * 3 + 1] = q.y;
      out[ini + j * 3 + 2] = q.z;
    });
  }
  return out;
}
