import { useState } from 'react';
import { api, mensaje } from '../api.js';
import { Aviso, Cargando, Markdown, useCarga } from '../componentes/ui.jsx';
import texto from '../acuerdo.md?raw';

/** Página que abre la madre, el padre o el tutor desde el enlace (sin cuenta). */
export default function Tutor({ token }) {
  const [info, error] = useCarga(() => api.infoTutor(token), [token]);
  const [nombre, setNombre] = useState('');
  const [acepto, setAcepto] = useState(false);
  const [estado, setEstado] = useState(null);

  if (error) return <Aviso tono="error">{mensaje(error)}</Aviso>;
  if (info === undefined) return <Cargando />;
  if (!info || !info.vigente) return <Aviso tono="error">Este enlace no es válido o ya no está vigente.</Aviso>;
  if (info.confirmado || estado === 'ok')
    return (
      <div className="card center" style={{ maxWidth: 520, margin: '0 auto' }}>
        <div style={{ fontSize: 48 }}>✅</div>
        <h1>¡Gracias!</h1>
        <p><b>{info.nombre}</b> ya puede colaborar con Togo. Puede retirar sus datos cuando quiera desde su cuenta.</p>
      </div>
    );

  async function confirmar(e) {
    e.preventDefault();
    try {
      const ok = await api.confirmarTutor(token, nombre.trim());
      setEstado(ok ? 'ok' : 'error');
    } catch (err) {
      setEstado(mensaje(err));
    }
  }

  return (
    <div className="col" style={{ maxWidth: 720, margin: '0 auto', gap: 16 }}>
      <div className="card sena">
        <h1 style={{ marginBottom: 6 }}>{info.nombre} quiere colaborar con Togo</h1>
        <p style={{ margin: 0 }}>
          Togo es una app gratuita que traduce Lengua de Señas Salvadoreña a voz. Para colaborar, una persona menor de edad necesita el
          permiso de su madre, padre o tutor. Por favor lee el acuerdo y, si estás de acuerdo, confírmalo abajo.
        </p>
      </div>
      <div className="card"><Markdown texto={texto} /></div>
      <form className="card col" onSubmit={confirmar}>
        <label className="campo">
          Tu nombre completo
          <input value={nombre} maxLength={80} onChange={(e) => setNombre(e.target.value)} required />
        </label>
        <label className="check">
          <input type="checkbox" checked={acepto} onChange={(e) => setAcepto(e.target.checked)} />
          <span>Soy madre, padre o tutor de {info.nombre}, leí el acuerdo y le doy permiso para colaborar.</span>
        </label>
        {estado && estado !== 'ok' && <Aviso tono="error">{estado === 'error' ? 'No se pudo confirmar. Pide un enlace nuevo.' : estado}</Aviso>}
        <button className="btn grande" disabled={!acepto || nombre.trim().length < 3}>Dar permiso</button>
      </form>
    </div>
  );
}
