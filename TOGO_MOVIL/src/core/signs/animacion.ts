/**
 * Datos de la animación de una seña (ver TOGO_DATASET/tools/export_diccionario.py)
 * y su limpieza antes de dibujarla. Sin dependencias de pantalla: se puede probar
 * con Node directamente.
 *
 * Coordenadas en anchos de hombro, con el centro de los hombros en (0, 0).
 */
export type Pt = [number, number];
export interface Frame {
  p: Pt[]; // nariz, hombro I, hombro D, codo I, codo D, muñeca I, muñeca D, cadera I, cadera D
  l: Pt[] | null;
  r: Pt[] | null;
}
export interface SignEntry {
  id: string;
  frames: Frame[];
  pistas: { manos: number; movimiento: string; zona: string };
  grabaciones: number;
}

/*
 * En las señas de una mano, el brazo que no seña cuelga casi fuera de la cámara y
 * MediaPipe adivina su codo y su muñeca cuadro a cuadro: en la grabación ese brazo
 * se sacude sin parar. Ese brazo se dibuja colgando junto al cuerpo (como estaba de
 * verdad) y se quita la mano suelta que aparece en algún cuadro (antes quedaba
 * congelada). El brazo y la mano que sí señan se suavizan un poco ([1, 2, 1] / 4).
 */
const BRAZO = { l: { hombro: 1, codo: 3, muneca: 5 }, r: { hombro: 2, codo: 4, muneca: 6 } } as const;

/** Brazo relajado, en anchos de hombro desde el hombro: un poco hacia afuera y hacia abajo. */
const CODO_REPOSO: Pt = [0.14, 0.72];
const MUNECA_REPOSO: Pt = [0.12, 1.38];

/** Una mano está en reposo si aparece en menos de este tanto de los cuadros. */
const REPOSO = 0.25;

const valido = (p: Pt) => p[0] !== 0 || p[1] !== 0;

/** Promedio [1, 2, 1] con los cuadros vecinos que existan (sin mezclar puntos inválidos). */
function suavizar<T>(serie: (T | null)[], get: (t: T) => Pt[], esValido: (p: Pt) => boolean): (Pt[] | null)[] {
  return serie.map((t, i) => {
    if (!t) return null;
    const vecinos = [serie[i - 1], serie[i + 1]].filter((v): v is T => !!v);
    return get(t).map((p, j) => {
      if (!esValido(p)) return p;
      let x = 2 * p[0];
      let y = 2 * p[1];
      let w = 2;
      for (const v of vecinos) {
        const q = get(v)[j];
        if (esValido(q)) {
          x += q[0];
          y += q[1];
          w += 1;
        }
      }
      return [x / w, y / w] as Pt;
    });
  });
}

export function limpiarSena(s: SignEntry): SignEntry {
  const frames: Frame[] = s.frames.map((f) => ({ p: f.p.map((p) => [p[0], p[1]] as Pt), l: f.l, r: f.r }));
  for (const h of ['l', 'r'] as const) {
    const { hombro, codo, muneca } = BRAZO[h];
    const presentes = s.frames.filter((f) => f[h]).length;
    if (presentes < s.frames.length * REPOSO) {
      // Mano en reposo: brazo colgando desde su hombro (lo sigue si el cuerpo se mueve), sin mano suelta.
      for (const f of frames) {
        const sh = f.p[hombro];
        if (valido(sh)) {
          const afuera = Math.sign(sh[0]) || (h === 'l' ? 1 : -1);
          f.p[codo] = [sh[0] + afuera * CODO_REPOSO[0], sh[1] + CODO_REPOSO[1]];
          f.p[muneca] = [sh[0] + afuera * MUNECA_REPOSO[0], sh[1] + MUNECA_REPOSO[1]];
        }
        f[h] = null;
      }
    } else {
      // Mano que seña: solo quitar el temblor.
      const brazo = suavizar(frames, (f) => [f.p[codo], f.p[muneca]], valido);
      const mano = suavizar(frames.map((f) => f[h]), (pts) => pts, () => true);
      frames.forEach((f, i) => {
        const [c, m] = brazo[i]!;
        f.p[codo] = c;
        f.p[muneca] = m;
        f[h] = mano[i];
      });
    }
  }
  return { ...s, frames };
}
