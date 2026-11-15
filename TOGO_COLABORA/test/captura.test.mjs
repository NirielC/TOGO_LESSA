// Pruebas de la captura (sin navegador ni MediaPipe):  npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { evaluarToma, avisoEnVivo } from '../src/captura/calidad.js';
import { cuadroDesde, HAND_DIM, POSE_DIM } from '../src/captura/cuadro.js';
import { codificar, decodificar, DIM } from '../src/captura/formato.js';

const pt = (x, y, z = 0, visibility = 1) => ({ x, y, z, visibility });
const mano = (x0) => Array.from({ length: 21 }, (_, j) => pt(x0 + j * 0.001, 0.5));

test('formato: codificar y decodificar devuelve lo mismo (precisión 1e-4)', async () => {
  const cuadros = Array.from({ length: 40 }, (_, i) => Float32Array.from({ length: DIM }, (_, k) => Math.sin(i + k) * 0.9));
  const tiempos = cuadros.map((_, i) => i * 50);
  const bytes = await codificar(cuadros, tiempos, { sena: 'hola', ancho: 640, alto: 480, fps: 20, origen: 'web' });
  assert.ok(bytes.length < 25000, `una toma de 2 s debe pesar menos de 25 KB (pesa ${bytes.length})`);
  const { meta, cuadros: vuelta } = await decodificar(bytes);
  assert.equal(meta.sena, 'hola');
  assert.equal(meta.n, 40);
  assert.deepEqual(meta.t, tiempos);
  for (let i = 0; i < 40; i++) for (let k = 0; k < DIM; k++) assert.ok(Math.abs(vuelta[i][k] - cuadros[i][k]) <= 1e-4);
});

test('formato: valores fuera de rango se recortan sin romper', async () => {
  const c = new Float32Array(DIM).fill(9);
  const { cuadros } = await decodificar(await codificar([c], [0], { sena: 'x' }));
  assert.ok(Math.abs(cuadros[0][0] - 3.2767) < 1e-4);
});

test('cuadro: la mano más segura elige su lado; si repiten lado, la otra toma el libre', () => {
  const pose = { landmarks: [Array.from({ length: 33 }, (_, i) => pt(i / 100, 0.2, 0, 0.9))] };
  const manos = { landmarks: [mano(0.3), mano(0.7)], handedness: [[{ score: 0.6, categoryName: 'Left' }], [{ score: 0.9, categoryName: 'Left' }]] };
  const c = cuadroDesde(pose, manos);
  assert.equal(c.length, DIM);
  assert.ok(Math.abs(c[11 * 4] - 0.11) < 1e-6 && Math.abs(c[11 * 4 + 3] - 0.9) < 1e-6, 'pose: x, y, z, visibilidad');
  assert.ok(Math.abs(c[POSE_DIM] - 0.7) < 1e-6, 'la más segura (0.9) va a "Left"');
  assert.ok(Math.abs(c[POSE_DIM + HAND_DIM] - 0.3) < 1e-6, 'la otra pasa a "Right"');
});

test('cuadro: sin detecciones todo queda en cero', () => {
  assert.ok(cuadroDesde({ landmarks: [] }, { landmarks: [] }).every((v) => v === 0));
});

const info = (o = {}) => ({ hombros: 0.3, manos: [[[0.5, 0.5]]], luz: 120, ...o });
const tiempos = (n, paso = 50) => Array.from({ length: n }, (_, i) => i * paso);

test('calidad: una toma normal pasa sin avisos', () => {
  const infos = Array.from({ length: 40 }, (_, i) => info({ manos: [[[0.3 + i * 0.01, 0.5]]] }));
  const r = evaluarToma(infos, tiempos(40), 40, 'sena');
  assert.equal(r.ok, true);
  assert.deepEqual(r.avisos, []);
});

test('calidad: AMABLE — poca luz y lejos solo son sugerencias', () => {
  const infos = Array.from({ length: 40 }, (_, i) => info({ luz: 30, hombros: 0.1, manos: [[[0.3 + i * 0.01, 0.5]]] }));
  const r = evaluarToma(infos, tiempos(40), 40, 'sena');
  assert.equal(r.ok, true);
  assert.equal(r.avisos.length, 2);
});

test('calidad: se descarta sin manos, sin cuerpo o incompleta', () => {
  assert.equal(evaluarToma(Array.from({ length: 40 }, () => info({ manos: [] })), tiempos(40), 40, 'sena').ok, false);
  assert.equal(evaluarToma(Array.from({ length: 40 }, () => info({ hombros: null })), tiempos(40), 40, 'sena').ok, false);
  assert.equal(evaluarToma(Array.from({ length: 10 }, () => info()), tiempos(10), 40, 'sena').ok, false);
  assert.equal(evaluarToma(Array.from({ length: 40 }, () => info()), tiempos(40, 200), 40, 'sena').ok, false, 'a 5 fps no sirve');
});

test('calidad: "Sin seña" no exige manos', () => {
  assert.equal(evaluarToma(Array.from({ length: 40 }, () => info({ manos: [] })), tiempos(40), 40, 'nada').ok, true);
});

test('aviso en vivo: dice lo más útil primero', () => {
  assert.match(avisoEnVivo(info({ hombros: null })).texto, /hombros/);
  assert.match(avisoEnVivo(info({ hombros: 0.8 })).texto, /cerca/);
  assert.equal(avisoEnVivo(info()).tono, 'ok');
});
