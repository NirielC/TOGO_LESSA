import tabla from '../../data/contexto.json';
import { KNOWN_LABELS, meaningOf } from '../signs/vocabulary';
import type { DraftPart, Message } from './reducer';

/**
 * CAPA DE CONTEXTO ("sentido lógico") — gemela de TOGO_DATASET/togo_contexto.py.
 *
 * El modelo único da sus 3 opciones más probables. Si duda (poca diferencia
 * entre la 1.ª y la 2.ª), se reordenan según lo que tiene sentido en la
 * conversación: después de "Mi nombre es" vienen letras; después de "¿Cómo
 * estás?", "Estoy bien / mal / más o menos". Si el modelo está seguro, o lo más
 * probable es "nada", no se toca nada: el contexto desempata, no inventa.
 *
 * Cada opción se multiplica por (1 + fuerza × apoyo), con el apoyo (0 a 1) de la
 * tabla src/data/contexto.json, y se reparte de nuevo la probabilidad (lo que
 * quedó fuera del top-3 cuenta sin apoyo). Para sumar reglas basta editar la
 * tabla. Si cambias el algoritmo, cámbialo también en togo_contexto.py.
 */

export type CandidateKind = 'sign' | 'letter' | 'none';

export interface Candidate {
  label: string;
  p: number;
  kind: CandidateKind;
}

interface Rule {
  despues_de: string | string[];
  siguen: Record<string, number | undefined>;
}

interface Table {
  margen_duda?: number;
  fuerza?: number;
  no_tocar?: string[];
  reglas?: Rule[];
}

export class ContextLayer {
  readonly doubtMargin: number;
  readonly strength: number;
  private keep: Set<string>;
  private rules: { after: Set<string>; next: Record<string, number | undefined> }[];

  constructor(t: Table) {
    this.doubtMargin = t.margen_duda ?? 0.25;
    this.strength = t.fuerza ?? 1.5;
    this.keep = new Set(t.no_tocar ?? ['nada']);
    this.rules = (t.reglas ?? []).map((r) => ({
      after: new Set(typeof r.despues_de === 'string' ? [r.despues_de] : r.despues_de),
      next: r.siguen,
    }));
  }

  /** 0..1: cuánto espera la tabla esta opción después de `prev`. */
  support(c: Pick<Candidate, 'label' | 'kind'>, prev: string[]): number {
    if (c.kind === 'none' || this.keep.has(c.label)) return 0;
    const group = c.kind === 'letter' ? '@letra' : '@sena';
    let best = 0;
    for (const r of this.rules) {
      if (!prev.some((k) => r.after.has(k))) continue;
      best = Math.max(best, r.next[c.label] ?? 0, r.next[group] ?? 0);
    }
    return Math.min(1, best);
  }

  /** Reordena el top (de mayor a menor) solo si el modelo duda. */
  rerank(top: Candidate[], prev: string[]): { top: Candidate[]; changed: boolean } {
    if (top.length < 2 || top[0].kind === 'none' || this.keep.has(top[0].label) || top[0].p - top[1].p >= this.doubtMargin) {
      return { top, changed: false };
    }
    const sup = top.map((c) => this.support(c, prev));
    if (!sup.some((s) => s > 0)) return { top, changed: false };
    const w = top.map((c, i) => c.p * (1 + this.strength * sup[i]));
    const rest = Math.max(0, 1 - top.reduce((a, c) => a + c.p, 0));
    const total = w.reduce((a, x) => a + x, 0) + rest;
    const next = top.map((c, i) => ({ ...c, p: w[i] / total })).sort((a, b) => b.p - a.p);
    return { top: next, changed: true };
  }
}

export const contexto = new ContextLayer(tabla as Table);

/** ¿Lo de antes pide letras? (después de "Mi nombre es" o deletreando, según la tabla). */
export function expectsLetters(prev: string[]): boolean {
  return contexto.support({ label: '', kind: 'letter' }, prev) >= EXPECTS_LETTERS;
}

/** Apoyo de la tabla a "@letra" desde el cual se considera que se está deletreando. */
const EXPECTS_LETTERS = 0.8;

/** '¿Cómo estás?' -> 'como estas' (igual que normalizar() en Python). */
export function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .join(' ');
}

/**
 * Lo que vino antes, como claves de la tabla:
 *   - frase en curso: la última seña (+ '@sena') o '@letra' si se está deletreando;
 *   - frase vacía tras hablar la persona oyente: lo último que dijo que sea una
 *     seña conocida ("Hola, ¿cómo estás?" -> como_estas) + '@voz';
 *   - si no: '@inicio'.
 */
export function previousKeys(draft: DraftPart[], messages: Message[]): string[] {
  const last = draft[draft.length - 1];
  if (last) return last.kind === 'deletreo' ? ['@letra'] : [last.label, '@sena'];
  const m = messages[messages.length - 1];
  if (m?.source === 'voice') {
    const said = ` ${normalize(m.text)} `;
    let found: { end: number; label: string } | null = null;
    for (const label of KNOWN_LABELS) {
      const t = normalize(meaningOf(label).text);
      const pos = t ? said.lastIndexOf(` ${t} `) : -1;
      if (pos < 0) continue;
      const end = pos + t.length;
      if (!found || end > found.end || (end === found.end && label > found.label)) found = { end, label };
    }
    return found ? [found.label, '@voz'] : ['@voz'];
  }
  return ['@inicio'];
}
