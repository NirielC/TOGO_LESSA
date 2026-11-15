import { useCallback, useEffect, useState } from 'react';

export function Cargando({ texto = 'Cargando…' }) {
  return (
    <div className="cargando">
      <div className="giro" />
      <p className="muted" style={{ marginTop: 12 }}>{texto}</p>
    </div>
  );
}

export function Aviso({ tono = '', children }) {
  if (!children) return null;
  return <div className={`aviso ${tono}`} role={tono === 'error' ? 'alert' : 'status'}>{children}</div>;
}

export function Barra({ valor, max = 1, vivo = false }) {
  const pct = Math.max(0, Math.min(100, (valor / (max || 1)) * 100));
  return (
    <div className={`barra ${vivo ? 'vivo' : ''}`} role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <i style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Puntos({ hechas, total, ahora = false }) {
  return (
    <div className="puntos" aria-label={`${hechas} de ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <i key={i} className={i < hechas ? 'lleno' : i === hechas && ahora ? 'ahora' : ''} />
      ))}
    </div>
  );
}

export function Modal({ children, cerrar }) {
  useEffect(() => {
    const f = (e) => e.key === 'Escape' && cerrar?.();
    addEventListener('keydown', f);
    return () => removeEventListener('keydown', f);
  }, [cerrar]);
  return (
    <div className="modal" onClick={(e) => e.target === e.currentTarget && cerrar?.()}>
      <div className="card">{children}</div>
    </div>
  );
}

export function Opciones({ valor, opciones, cambiar }) {
  return (
    <div className="opciones" role="radiogroup">
      {opciones.map(([v, t]) => (
        <button type="button" key={v} role="radio" aria-checked={valor === v} className={valor === v ? 'si' : ''} onClick={() => cambiar(v)}>
          {t}
        </button>
      ))}
    </div>
  );
}

/** Estado guardado en el navegador (preferencias pequeñas). */
export function useLocal(clave, inicial) {
  const [v, setV] = useState(() => {
    try {
      const x = localStorage.getItem(clave);
      return x == null ? inicial : JSON.parse(x);
    } catch {
      return inicial;
    }
  });
  const poner = useCallback(
    (x) => {
      setV(x);
      try {
        localStorage.setItem(clave, JSON.stringify(x));
      } catch {
        /* sin almacenamiento: solo en memoria */
      }
    },
    [clave],
  );
  return [v, poner];
}

/** Carga asíncrona simple: [datos, error, recargar]. */
export function useCarga(fn, deps = []) {
  const [estado, setEstado] = useState({ datos: undefined, error: null });
  const cargar = useCallback(() => {
    let vivo = true;
    fn()
      .then((datos) => vivo && setEstado({ datos, error: null }))
      .catch((error) => vivo && setEstado({ datos: null, error }));
    return () => (vivo = false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(cargar, [cargar]);
  return [estado.datos, estado.error, cargar];
}

export const ir = (ruta) => (location.hash = ruta);

/** Markdown mínimo (títulos, listas, negritas, párrafos) para el acuerdo. */
export function Markdown({ texto }) {
  const bloques = [];
  let lista = null;
  const linea = (s, k) =>
    s.split(/(\*\*[^*]+\*\*)/g).map((p, i) => (p.startsWith('**') ? <b key={`${k}-${i}`}>{p.slice(2, -2)}</b> : p));
  texto.split(/\r?\n/).forEach((l, k) => {
    if (/^\s*[-*] /.test(l)) {
      lista ??= [];
      lista.push(<li key={k}>{linea(l.replace(/^\s*[-*] /, ''), k)}</li>);
      return;
    }
    if (lista) {
      bloques.push(<ul key={`u${k}`}>{lista}</ul>);
      lista = null;
    }
    if (l.startsWith('### ')) bloques.push(<h3 key={k}>{linea(l.slice(4), k)}</h3>);
    else if (l.startsWith('## ')) bloques.push(<h2 key={k}>{linea(l.slice(3), k)}</h2>);
    else if (l.startsWith('# ')) bloques.push(<h1 key={k}>{linea(l.slice(2), k)}</h1>);
    else if (l.startsWith('> ')) bloques.push(<div key={k} className="aviso sol">{linea(l.slice(2), k)}</div>);
    else if (l.trim()) bloques.push(<p key={k}>{linea(l, k)}</p>);
  });
  if (lista) bloques.push(<ul key="u-fin">{lista}</ul>);
  return <div className="legal">{bloques}</div>;
}
