/**
 * Pose + manos en el navegador, con los MISMOS modelos que la captura en la
 * computadora y el teléfono (pose_landmarker_lite + hand_landmarker, mismo
 * tamaño de archivo). Todo corre en el dispositivo: nunca se envía video.
 *
 * Wasm y modelos vienen de CDN (jsDelivr y Google), no de Vercel.
 */
import { FilesetResolver, HandLandmarker, PoseLandmarker } from '@mediapipe/tasks-vision';
import { DIM } from './formato.js';
import { cuadroDesde, HAND_DIM, POSE_DIM } from './cuadro.js';

export { cuadroDesde };

const WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.3/wasm';
const POSE = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';
const MANOS = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';


let promesa = null;

export function cargarDetector() {
  if (PRUEBA) return detectorDePrueba();
  if (!promesa) {
    promesa = (async () => {
      const fs = await FilesetResolver.forVisionTasks(WASM);
      const crear = (delegate) =>
        Promise.all([
          PoseLandmarker.createFromOptions(fs, {
            baseOptions: { modelAssetPath: POSE, delegate },
            runningMode: 'VIDEO',
            numPoses: 1,
            minPoseDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5,
          }),
          HandLandmarker.createFromOptions(fs, {
            baseOptions: { modelAssetPath: MANOS, delegate },
            runningMode: 'VIDEO',
            numHands: 2,
            minHandDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5,
          }),
        ]);
      let pose, manos;
      try {
        [pose, manos] = await crear('GPU');
      } catch {
        [pose, manos] = await crear('CPU');
      }
      return new Detector(pose, manos);
    })().catch((e) => {
      promesa = null;
      throw e;
    });
  }
  return promesa;
}

class Detector {
  constructor(pose, manos) {
    this.pose = pose;
    this.manos = manos;
    this.ultimo = -1;
    this.lienzo = document.createElement('canvas');
    this.lienzo.width = 32;
    this.lienzo.height = 24;
    this.ctx = this.lienzo.getContext('2d', { willReadFrequently: true });
  }

  /**
   * Un cuadro del <video> -> { cuadro: Float32Array(258) crudo, info }.
   * info = { hombros: ancho de hombros (0-1) o null, manos: [[x,y]×21], luz: 0-255 }
   */
  detectar(video, ahoraMs) {
    const ts = Math.max(Math.round(ahoraMs), this.ultimo + 1);
    this.ultimo = ts;
    const p = this.pose.detectForVideo(video, ts);
    const h = this.manos.detectForVideo(video, ts);
    const cuadro = cuadroDesde(p, h);

    let hombros = null;
    const lm = p.landmarks?.[0];
    if (lm && Math.min(lm[11].visibility ?? 0, lm[12].visibility ?? 0) > 0.5) hombros = Math.abs(lm[11].x - lm[12].x);
    const manos = (h.landmarks || []).map((m) => m.map((q) => [q.x, q.y]));

    this.ctx.drawImage(video, 0, 0, 32, 24);
    const d = this.ctx.getImageData(0, 0, 32, 24).data;
    let s = 0;
    for (let i = 0; i < d.length; i += 4) s += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    return { cuadro, info: { hombros, manos, luz: s / (d.length / 4) } };
  }
}

// ------------------------------------------------ cámara de prueba (?camara=prueba)
// Sin persona frente a la cámara: una "cámara" falsa y un detector que repite la
// grabación real de "hola" del diccionario de la app. Sirve para probar todo el
// flujo (avisos, grabación, revisión, envío) sin encender una cámara.
export const PRUEBA = new URLSearchParams(location.search).get('camara') === 'prueba';

export async function detectorDePrueba() {
  const d = await (await fetch('/diccionario.json')).json();
  const anim = d.senas.find((s) => s.id === 'hola') || d.senas[0];
  const W = 640, H = 480, CX = 320, CY = 210, S = 150;
  const POSE_IDX = [0, 11, 12, 13, 14, 15, 16, 23, 24];
  const crudo = anim.frames.map((f) => {
    const c = new Float32Array(DIM);
    const xy = ([x, y]) => [(x * S + CX) / W, (y * S + CY) / H];
    f.p.forEach((p, k) => {
      if (!p[0] && !p[1]) return;
      const [x, y] = xy(p);
      const i = POSE_IDX[k] * 4;
      c[i] = x; c[i + 1] = y; c[i + 3] = 1;
    });
    [[f.l, POSE_DIM], [f.r, POSE_DIM + HAND_DIM]].forEach(([m, ini]) =>
      m?.forEach((p, j) => {
        const [x, y] = xy(p);
        c[ini + j * 3] = x;
        c[ini + j * 3 + 1] = y;
      }),
    );
    return c;
  });
  return {
    detectar(_video, ahora) {
      // 2 s de seña y 1 s de pausa (manos abajo), en bucle.
      const ciclo = (ahora / 50) % (crudo.length + 20);
      const cuadro = ciclo < crudo.length ? crudo[Math.floor(ciclo)] : new Float32Array(DIM).map((_, i) => (i < POSE_DIM ? crudo[0][i] : 0));
      const manos = [POSE_DIM, POSE_DIM + HAND_DIM]
        .filter((ini) => cuadro[ini] || cuadro[ini + 1])
        .map((ini) => Array.from({ length: 21 }, (_, j) => [cuadro[ini + j * 3], cuadro[ini + j * 3 + 1]]));
      return { cuadro, info: { hombros: Math.abs(cuadro[44] - cuadro[48]), manos, luz: 120 } };
    },
  };
}

function camaraDePrueba(video) {
  const c = document.createElement('canvas');
  c.width = 640;
  c.height = 480;
  const ctx = c.getContext('2d');
  let n = 0;
  const pintar = () => {
    ctx.fillStyle = '#1E5A6E';
    ctx.fillRect(0, 0, 640, 480);
    ctx.fillStyle = '#FBF7EE';
    ctx.font = '600 30px sans-serif';
    ctx.fillText(`Cámara de prueba ${n++ % 10}`, 40, 60);
  };
  pintar();
  const id = setInterval(pintar, 40);
  const stream = c.captureStream(25);
  stream.parar = () => clearInterval(id);
  video.srcObject = stream;
  video.muted = true;
  return video.play().then(() => stream);
}

/** Cámara frontal, lo más cerca posible de 640×480 (lo que usa el dataset). */
export async function abrirCamara(video) {
  if (PRUEBA) return camaraDePrueba(video);
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30 } },
  });
  video.srcObject = stream;
  video.muted = true;
  video.playsInline = true;
  await video.play();
  return stream;
}

export function cerrarCamara(stream) {
  stream?.parar?.();
  stream?.getTracks().forEach((t) => t.stop());
}
