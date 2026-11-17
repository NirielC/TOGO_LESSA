/**
 * CONTRATO DEL MOTOR DE SEÑAS.
 *
 * La UI no sabe quién reconoce: el módulo nativo (cámara + MediaPipe + TFLite
 * en Kotlin) o nada (Expo Go). A JavaScript solo llega lo mínimo:
 * etiqueta, confianza, margen, si hay manos y una pista de calidad. Los puntos
 * de las manos se dibujan del lado nativo, no cruzan el puente.
 */
/**
 * signs/letters: los 3 modelos de antes (señas, letras quietas, letras con movimiento).
 * unico: el modelo único (señas + letras + "nada"), con su top-3 en `top`.
 */
export type EngineMode = 'signs' | 'letters' | 'unico';

/** Una de las opciones del modelo único. kind: seña, letra o "nada". */
export interface EngineCandidate {
  label: string;
  p: number;
  kind: 'sign' | 'letter' | 'none';
}

/** Guía de calidad en vivo. La calcula el motor con los landmarks. */
export type Quality =
  | 'ok' // te veo bien
  | 'no_person' // no hay nadie en cuadro
  | 'no_hands' // persona sí, manos no (en reposo o fuera)
  | 'too_close' // hombros muy anchos en la imagen
  | 'too_far' // hombros muy angostos
  | 'hands_cut' // una mano toca el borde
  | 'low_light';

export interface EnginePrediction {
  type: 'prediction';
  mode: EngineMode;
  label: string;
  confidence: number;
  margin: number;
  handsVisible: boolean;
  /** Movimiento de las muñecas (anchos de hombro por frame, suavizado). */
  motion?: number;
  /** Movimiento de toda la mano, dedos incluidos (misma unidad). Bajo = mano quieta (letra). */
  handMotion?: number;
  /** Solo en modo 'unico': las 3 opciones más probables (ya con la máscara de deletreo). */
  top?: EngineCandidate[];
  ts: number;
}

export interface EngineStatus {
  type: 'status';
  quality: Quality;
  hands: 0 | 1 | 2;
  fps: number;
  /** ms desde que entra el frame hasta que sale la predicción. */
  latencyMs: number;
  /** El teléfono tiene modelo de abecedario instalado. */
  hasLetters?: boolean;
  /** El teléfono usa el modelo único (lessa_unico.tflite) en vez de los 3 modelos. */
  unico?: boolean;
}

export type EngineEvent = EnginePrediction | EngineStatus | { type: 'error'; message: string };

export type EngineAvailability =
  | { available: true }
  | { available: false; reason: 'expo-go' | 'no-module' | 'no-model'; detail?: string };

export const QUALITY_TEXT: Record<Quality, string> = {
  ok: 'Te veo bien',
  no_person: 'Colócate frente a la cámara',
  no_hands: 'Levanta las manos para señar',
  too_close: 'Aléjate un poco',
  too_far: 'Acércate un poco',
  hands_cut: 'Tus manos se salen del cuadro',
  low_light: 'Necesito más luz',
};
