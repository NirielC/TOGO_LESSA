/**
 * ESTABILIZADOR: decide cuándo una predicción cruda merece ser una seña.
 *
 * Viene de lessa-app, con una barrera nueva al inicio (manos). El orden importa:
 *   0. Sin manos en cuadro            -> no hay seña, punto. (antes no existía:
 *                                         el modelo siempre elegía algo)
 *   1. Clase "nada"                   -> no hay seña.
 *   2. confianza < umbral             -> ruido.
 *   3. top1 - top2 < margen           -> duda entre dos señas.
 *   4. latch: la misma seña no se repite sin bajar las manos o cambiar de seña.
 *   5. estabilidad: N ventanas seguidas con la misma etiqueta.
 *   6. cooldown tras confirmar.
 */
export type StabilizerState = 'idle' | 'candidate' | 'committed' | 'cooldown' | 'latched';

export interface RawPrediction {
  label: string;
  confidence: number;
  margin: number;
  /** Manos visibles en la ventana. Sin manos no hay seña posible. */
  handsVisible: boolean;
}

export interface StabilizerConfig {
  confidenceThreshold: number;
  minTopMargin: number;
  stabilityFrames: number;
  cooldownMs: number;
  /** Ventanas sin seña necesarias para soltar el latch (permitir repetir). */
  releaseOnNoSignFrames: number;
  noSignLabel: string;
}

export interface Commit {
  label: string;
  confidence: number;
  at: number;
}

export interface StabilizerSnapshot {
  state: StabilizerState;
  committed: Commit | null;
  candidate: string | null;
  progress: number; // 0..1 hacia la confirmación
  confidence: number;
}

export class PredictionStabilizer {
  private state: StabilizerState = 'idle';
  private candidate: string | null = null;
  private streak = 0;
  private noSign = 0;
  private lastLabel: string | null = null;
  private lastAt = 0;

  constructor(private config: StabilizerConfig) {}

  get cfg(): StabilizerConfig {
    return this.config;
  }

  setConfig(config: StabilizerConfig) {
    this.config = config;
  }

  reset() {
    this.state = 'idle';
    this.candidate = null;
    this.streak = 0;
    this.noSign = 0;
    this.lastLabel = null;
    this.lastAt = 0;
  }

  push(p: RawPrediction | null, now = Date.now()): StabilizerSnapshot {
    const c = this.config;

    if (!p || !p.handsVisible || p.label === c.noSignLabel) {
      this.noSign += 1;
      this.clearCandidate();
      if (this.noSign >= c.releaseOnNoSignFrames) {
        this.lastLabel = null;
        this.state = 'idle';
      } else if (this.state !== 'latched') {
        this.state = this.coolingDown(now) ? 'cooldown' : 'idle';
      }
      return this.snap(null, 0);
    }
    this.noSign = 0;

    if (this.coolingDown(now)) {
      this.state = 'cooldown';
      this.clearCandidate();
      return this.snap(null, p.confidence);
    }

    if (p.confidence < c.confidenceThreshold || p.margin < c.minTopMargin) {
      this.clearCandidate();
      this.state = this.lastLabel ? 'latched' : 'idle';
      return this.snap(null, p.confidence);
    }

    if (this.lastLabel && p.label === this.lastLabel) {
      this.state = 'latched';
      this.clearCandidate();
      return this.snap(null, p.confidence);
    }

    if (p.label === this.candidate) this.streak += 1;
    else {
      this.candidate = p.label;
      this.streak = 1;
    }

    if (this.streak >= c.stabilityFrames) {
      const committed = { label: p.label, confidence: p.confidence, at: now };
      this.lastLabel = p.label;
      this.lastAt = now;
      this.clearCandidate();
      this.state = 'committed';
      return { ...this.snap(committed, p.confidence), progress: 1 };
    }
    this.state = 'candidate';
    return this.snap(null, p.confidence);
  }

  private clearCandidate() {
    this.candidate = null;
    this.streak = 0;
  }

  private coolingDown(now: number) {
    return this.lastAt > 0 && now - this.lastAt < this.config.cooldownMs;
  }

  private snap(committed: Commit | null, confidence: number): StabilizerSnapshot {
    return {
      state: this.state,
      committed,
      candidate: this.candidate,
      progress: this.candidate ? Math.min(1, this.streak / this.config.stabilityFrames) : 0,
      confidence,
    };
  }
}
