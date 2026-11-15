import { useEffect, useRef, useState } from 'react';

/**
 * El muñeco de Togo (versión web de TOGO_MOVIL/src/components/SignAvatar.tsx).
 * frames: [{ p: [nariz, hombroI, hombroD, codoI, codoD, muñecaI, muñecaD, caderaI, caderaD], l, r }]
 * en anchos de hombro, con el centro de los hombros en (0, 0).
 */
const C = { deep: '#0D2B45', teal: '#1E5A6E', seafoam: '#6BA7A0', sand: '#DCC8AA', cream: '#FBF7EE', coral: '#F08A5D' };
const DEDOS = [[0, 1, 2, 3, 4], [0, 5, 6, 7, 8], [9, 10, 11, 12], [13, 14, 15, 16], [0, 17, 18, 19, 20]];
const PALMA = [0, 5, 9, 13, 17];
const POSE = [0, 11, 12, 13, 14, 15, 16, 23, 24];
const valido = (p) => p && (p[0] !== 0 || p[1] !== 0);

/** Cuadro crudo (258) de una toma -> cuadro del muñeco (misma cuenta que export_diccionario.py). */
export function cuadroAMuneco(c, w, h) {
  const px = (i) => [c[i * 4] * w, c[i * 4 + 1] * h];
  const ls = px(11);
  const rs = px(12);
  const hay = (i) => c[i * 4] !== 0 || c[i * 4 + 1] !== 0;
  const ancho = Math.hypot(ls[0] - rs[0], ls[1] - rs[1]);
  const ok = hay(11) && hay(12) && ancho >= 20;
  const cx = ok ? (ls[0] + rs[0]) / 2 : w / 2;
  const cy = ok ? (ls[1] + rs[1]) / 2 : h / 2;
  const s = ok ? ancho : w * 0.3;
  const n = ([x, y]) => [(x - cx) / s, (y - cy) / s];
  const mano = (ini) => {
    let algo = false;
    const pts = [];
    for (let j = 0; j < 21; j++) {
      const x = c[ini + j * 3];
      const y = c[ini + j * 3 + 1];
      if (x || y) algo = true;
      pts.push(n([x * w, y * h]));
    }
    return algo ? pts : null;
  };
  return { p: POSE.map((i) => (hay(i) ? n(px(i)) : [0, 0])), l: mano(132), r: mano(195), ok };
}

// ------------------------------------------------ limpieza (igual que TOGO_MOVIL/src/core/signs/animacion.ts)
/*
 * En las señas de una mano, el brazo que no seña cuelga casi fuera de la cámara y
 * MediaPipe adivina su codo y su muñeca cuadro a cuadro: se sacude sin parar. Ese
 * brazo se dibuja colgando junto al cuerpo y se quita la mano suelta. El brazo y
 * la mano que sí señan se suavizan un poco ([1, 2, 1] / 4).
 */
const BRAZO = { l: { hombro: 1, codo: 3, muneca: 5 }, r: { hombro: 2, codo: 4, muneca: 6 } };
const CODO_REPOSO = [0.14, 0.72];
const MUNECA_REPOSO = [0.12, 1.38];
const REPOSO = 0.25;

function suavizar(serie, get, esValido) {
  return serie.map((t, i) => {
    if (!t) return null;
    const vecinos = [serie[i - 1], serie[i + 1]].filter(Boolean);
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
      return [x / w, y / w];
    });
  });
}

export function limpiarSena(frames0) {
  const frames = frames0.map((f) => ({ ...f, p: f.p.map((p) => [p[0], p[1]]) }));
  for (const h of ['l', 'r']) {
    const { hombro, codo, muneca } = BRAZO[h];
    const presentes = frames0.filter((f) => f[h]).length;
    if (presentes < frames0.length * REPOSO) {
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
      const brazo = suavizar(frames, (f) => [f.p[codo], f.p[muneca]], valido);
      const mano = suavizar(frames.map((f) => f[h]), (pts) => pts, () => true);
      frames.forEach((f, i) => {
        const [c, m] = brazo[i];
        f.p[codo] = c;
        f.p[muneca] = m;
        f[h] = mano[i];
      });
    }
  }
  return frames;
}

/** Rellena cuadros sin cuerpo con el último bueno (no parpadea). */
// limpiar: para la persona que grabó (se ve más bonito). En revisión NO: hay que ver lo que de verdad se grabó.
export function suavizarToma(frames, limpiar = false) {
  let ultimo = null;
  return (limpiar ? limpiarSena(frames) : frames).map((f) => {
    if (f.ok !== false && valido(f.p[1]) && valido(f.p[2])) ultimo = f.p;
    return { ...f, p: ultimo || f.p };
  });
}

export function Muneco({ frames, fps = 20, size = 220, speed = 1, mirror = false, playing = true, closeUp = false, pausaFinal = 8 }) {
  const [i, setI] = useState(0);
  const n = frames?.length || 0;
  const ultimas = useRef({ l: null, r: null });

  useEffect(() => {
    setI(0);
    ultimas.current = { l: null, r: null };
  }, [frames]);

  useEffect(() => {
    if (!playing || n < 2) return;
    const t = setInterval(() => setI((x) => (x + 1) % (n + pausaFinal)), 1000 / (fps * speed));
    return () => clearInterval(t);
  }, [playing, speed, n, fps, pausaFinal]);

  if (!n) return null;
  const f = frames[Math.min(i, n - 1)];
  const l = f.l ?? ultimas.current.l;
  const r = f.r ?? ultimas.current.r;
  ultimas.current = { l, r };
  const X = (p) => [mirror ? -p[0] : p[0], p[1]];
  const vb = closeUp ? '-2.1 -2.7 4.2 3.9' : '-2.2 -2.1 4.4 4.6';
  return (
    <svg width={size} height={size * (closeUp ? 0.85 : 1.05)} viewBox={vb} role="img" aria-label="Muñeco haciendo la seña">
      <Cuerpo pose={f.p.map(X)} closeUp={closeUp} />
      {l && <Mano pts={l.map(X)} color={C.sand} />}
      {r && <Mano pts={r.map(X)} color="#EAD8BC" />}
    </svg>
  );
}

function Cuerpo({ pose, closeUp }) {
  const [nariz, ls, rs, le, re, lw, rw, lh, rh] = pose;
  const caderaI = valido(lh) ? lh : [ls[0] * 0.8, 2.4];
  const caderaD = valido(rh) ? rh : [rs[0] * 0.8, 2.4];
  const torso = `M${ls[0]} ${ls[1]} L${rs[0]} ${rs[1]} L${caderaD[0]} ${caderaD[1]} L${caderaI[0]} ${caderaI[1]} Z`;
  const cabeza = valido(nariz) ? nariz : [0, -0.9];
  const relleno = closeUp ? C.cream : C.seafoam;
  return (
    <g>
      <path d={torso} fill={relleno} stroke={relleno} strokeWidth={0.35} strokeLinejoin="round" />
      <line x1={0} y1={0} x2={cabeza[0]} y2={cabeza[1] + 0.25} stroke={relleno} strokeWidth={0.28} />
      <circle cx={cabeza[0]} cy={cabeza[1] - 0.05} r={0.42} fill={C.teal} />
      {[[ls, le, lw], [rs, re, rw]].map((b, k) =>
        valido(b[1]) ? (
          <path
            key={k}
            d={`M${b[0][0]} ${b[0][1]} L${b[1][0]} ${b[1][1]}${valido(b[2]) ? ` L${b[2][0]} ${b[2][1]}` : ''}`}
            stroke={C.teal} strokeWidth={0.26} strokeLinecap="round" strokeLinejoin="round" fill="none"
          />
        ) : null,
      )}
    </g>
  );
}

function Mano({ pts: crudo, color, scale = 1.25, w = 0.085 }) {
  const [wx, wy] = crudo[0];
  const pts = crudo.map(([x, y]) => [wx + (x - wx) * scale, wy + (y - wy) * scale]);
  const palma = PALMA.map((k) => `${pts[k][0]} ${pts[k][1]}`).join(' L');
  const cadenas = DEDOS.map((c) => c.map((j, n) => `${n ? 'L' : 'M'}${pts[j][0]} ${pts[j][1]}`).join(' '));
  return (
    <g>
      <path d={`M${palma} Z`} fill={C.deep} stroke={C.deep} strokeWidth={w * 1.9} strokeLinejoin="round" opacity={0.35} />
      {cadenas.map((d, k) => (
        <path key={`e${k}`} d={d} stroke={C.deep} strokeWidth={w * 1.6} strokeLinecap="round" strokeLinejoin="round" fill="none" opacity={0.35} />
      ))}
      <path d={`M${palma} Z`} fill={color} stroke={color} strokeWidth={w * 1.2} strokeLinejoin="round" />
      {cadenas.map((d, k) => (
        <path key={k} d={d} stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      ))}
      {[4, 8, 12, 16, 20].map((j) => (
        <circle key={j} cx={pts[j][0]} cy={pts[j][1]} r={w * 0.55} fill={C.coral} />
      ))}
    </g>
  );
}

/** Mano quieta de una letra (forma relativa a la muñeca). */
export function LetraMano({ mano, size = 120, mirror = false }) {
  const pts = mano.map(([x, y]) => [mirror ? -x : x, y]);
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const pad = 0.4;
  const vb = `${Math.min(...xs) - pad} ${Math.min(...ys) - pad} ${Math.max(...xs) - Math.min(...xs) + pad * 2} ${Math.max(...ys) - Math.min(...ys) + pad * 2}`;
  return (
    <svg width={size} height={size} viewBox={vb} role="img" aria-label="Forma de la mano">
      <Mano pts={pts} color={C.sand} scale={1} w={0.22} />
    </svg>
  );
}

// ------------------------------------------------ diccionario de la app

let dic = null;
/** Animaciones reales de TOGO_MOVIL (public/diccionario.json), se piden una vez. */
export function cargarDiccionario() {
  dic ??= fetch('/diccionario.json')
    .then((r) => r.json())
    .then((d) => ({
      fps: d.fps,
      senas: Object.fromEntries(d.senas.map((s) => [s.id, { ...s, frames: limpiarSena(s.frames) }])),
      letras: Object.fromEntries(d.letras.map((l) => [l.letra, l])),
    }))
    .catch(() => ({ fps: 20, senas: {}, letras: {} }));
  return dic;
}

export function useDiccionario() {
  const [d, setD] = useState(null);
  useEffect(() => {
    cargarDiccionario().then(setD);
  }, []);
  return d;
}

/** Ejemplo animado de una seña de la base (o null si no hay animación). */
/** ¿Hay algo animado que mostrar para esta seña? */
export function tieneAnimado(sena, dic) {
  if (!sena) return false;
  if (sena.ejemplo_muneco?.frames?.length) return true;
  return !!dic && (!!dic.senas[sena.id] || (sena.tipo === 'letra' && !!dic.letras[sena.texto]));
}

export function EjemploAnimado({ sena, dic, size = 220, mirror = false, speed = 1 }) {
  // Primero el ejemplo propio (una toma elegida en el panel); si no, el del diccionario de la app.
  const propio = sena?.ejemplo_muneco;
  if (propio?.frames?.length) return <Muneco frames={propio.frames} fps={propio.fps || 20} size={size} mirror={mirror} speed={speed} />;
  if (!sena || !dic) return null;
  const anim = dic.senas[sena.id];
  if (anim) return <Muneco frames={anim.frames} fps={dic.fps} size={size} mirror={mirror} speed={speed} />;
  if (sena.tipo === 'letra' && dic.letras[sena.texto]) return <LetraMano mano={dic.letras[sena.texto].mano} size={size * 0.7} mirror={mirror} />;
  return null;
}
