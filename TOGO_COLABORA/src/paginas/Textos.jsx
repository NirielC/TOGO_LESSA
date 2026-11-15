import { api } from '../api.js';
import { Cargando, Markdown, useCarga } from '../componentes/ui.jsx';
import texto from '../acuerdo.md?raw';

/** Video del acuerdo en LESSA (opcional): poner su dirección en VITE_VIDEO_ACUERDO del archivo .env. */
export const VIDEO_ACUERDO = import.meta.env.VITE_VIDEO_ACUERDO || '';

export function VideoAcuerdo() {
  if (!VIDEO_ACUERDO) return null;
  return (
    <div className="card sena col">
      <b>El acuerdo en LESSA</b>
      <video src={VIDEO_ACUERDO} controls playsInline preload="none" style={{ width: '100%', borderRadius: 12, background: 'var(--deep)' }} />
    </div>
  );
}

export function Acuerdo() {
  return (
    <div className="card col" style={{ maxWidth: 780, margin: '0 auto' }}>
      <VideoAcuerdo />
      <Markdown texto={texto} />
    </div>
  );
}

export function Gracias() {
  const [lista] = useCarga(() => api.colaboradores(), []);
  return (
    <div style={{ maxWidth: 780, margin: '0 auto' }}>
      <h1>Colaboradores</h1>
      <p className="muted">Personas que le enseñan LESSA a Togo con sus tomas. ¡Gracias!</p>
      {!lista ? (
        <Cargando />
      ) : lista.length ? (
        <div className="grid chica">
          {lista.map((c, i) => (
            <div key={i} className="card" style={{ padding: 14 }}>
              <b>{c.nombre}</b>
              <div className="faint">{c.tomas} {Number(c.tomas) === 1 ? 'toma' : 'tomas'}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card sena">
          <p style={{ margin: 0 }}>Todavía no hay nombres aquí. <a href="#/colaborar">¡El tuyo puede ser el primero!</a></p>
        </div>
      )}
    </div>
  );
}
