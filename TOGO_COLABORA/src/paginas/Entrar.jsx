import { useState } from 'react';
import { api, mensaje } from '../api.js';
import { Aviso, ir, Opciones } from '../componentes/ui.jsx';

const GOOGLE = import.meta.env.VITE_GOOGLE === '1';

export default function Entrar({ volver }) {
  const [modo, setModo] = useState('entrar');
  const [correo, setCorreo] = useState('');
  const [clave, setClave] = useState('');
  const [msg, setMsg] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  async function enviar(e) {
    e.preventDefault();
    setMsg(null);
    setOcupado(true);
    try {
      if (modo === 'recuperar') {
        await api.recuperar(correo.trim());
        setMsg({ tono: 'ok', texto: 'Te enviamos un correo para crear una contraseña nueva.' });
      } else if (modo === 'crear') {
        const r = await api.registrar(correo.trim(), clave);
        if (!r?.session) setMsg({ tono: 'ok', texto: 'Listo. Revisa tu correo y abre el enlace para confirmar tu cuenta.' });
        else ir(volver && !volver.includes('entrar') ? volver : '#/colaborar');
      } else {
        await api.entrar(correo.trim(), clave);
        ir(volver && !volver.includes('entrar') ? volver : '#/colaborar');
      }
    } catch (err) {
      setMsg({ tono: 'error', texto: mensaje(err) });
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div style={{ maxWidth: 440, margin: '0 auto' }}>
      <h1 className="center">{modo === 'crear' ? 'Crea tu cuenta' : modo === 'recuperar' ? 'Recupera tu cuenta' : 'Entra a Togo'}</h1>
      <p className="center muted">Solo necesitas un correo. No pedimos documentos.</p>
      <div className="card col">
        {modo !== 'recuperar' && (
          <Opciones valor={modo} cambiar={setModo} opciones={[['entrar', 'Ya tengo cuenta'], ['crear', 'Soy nuevo']]} />
        )}
        <form className="col" onSubmit={enviar}>
          <label className="campo">
            Correo
            <input type="email" autoComplete="email" required value={correo} onChange={(e) => setCorreo(e.target.value)} />
          </label>
          {modo !== 'recuperar' && (
            <label className="campo">
              Contraseña
              <input
                type="password" required minLength={8}
                autoComplete={modo === 'crear' ? 'new-password' : 'current-password'}
                value={clave} onChange={(e) => setClave(e.target.value)}
              />
              {modo === 'crear' && <span className="ayuda">Al menos 8 caracteres.</span>}
            </label>
          )}
          <Aviso tono={msg?.tono}>{msg?.texto}</Aviso>
          <button className="btn bloque" disabled={ocupado}>
            {ocupado ? 'Un momento…' : modo === 'crear' ? 'Crear cuenta' : modo === 'recuperar' ? 'Enviar correo' : 'Entrar'}
          </button>
        </form>
        {GOOGLE && modo !== 'recuperar' && (
          <button className="btn sec bloque" onClick={() => api.entrarGoogle().catch((e) => setMsg({ tono: 'error', texto: mensaje(e) }))}>
            Continuar con Google
          </button>
        )}
        <div className="center">
          {modo === 'recuperar' ? (
            <button className="link" onClick={() => setModo('entrar')}>Volver</button>
          ) : (
            <button className="link" onClick={() => setModo('recuperar')}>Olvidé mi contraseña</button>
          )}
        </div>
      </div>
      <p className="center faint" style={{ marginTop: 16 }}>
        ¿Solo quieres ver cómo funciona? <a href="#/practica">Prueba sin cuenta</a>
      </p>
    </div>
  );
}
