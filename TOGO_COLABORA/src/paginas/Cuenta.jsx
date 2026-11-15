import { useEffect, useRef, useState } from 'react';
import { api, mensaje } from '../api.js';
import { useApp } from '../contexto.js';
import { Aviso, Cargando, ir, Modal, Opciones, useCarga } from '../componentes/ui.jsx';
import { MANOS, RELACIONES } from './Unirme.jsx';

/** Recorta al centro y achica a 256x256 (webp, ~15 KB). La foto original nunca sale del equipo. */
async function recortar(archivo) {
  const img = await createImageBitmap(archivo);
  const lado = Math.min(img.width, img.height);
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  c.getContext('2d').drawImage(img, (img.width - lado) / 2, (img.height - lado) / 2, lado, lado, 0, 0, 256, 256);
  const blob = await new Promise((ok) => c.toBlob(ok, 'image/webp', 0.82));
  return blob?.type === 'image/webp' ? blob : new Promise((ok) => c.toBlob(ok, 'image/jpeg', 0.85)); // Safari viejo no hace webp
}

/** Foto de perfil opcional. Solo la ven tú y el equipo; no aparece en los créditos. */
function FotoPerfil({ uid, perfil, setPerfil, avisar }) {
  const [url, setUrl] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const input = useRef(null);
  useEffect(() => {
    let vivo = true;
    api.urlFoto(perfil.foto).then((u) => vivo && setUrl(u)).catch(() => {});
    return () => (vivo = false);
  }, [perfil.foto]);

  if (perfil.es_menor) return null; // por cuidado, los menores no suben foto

  async function elegir(e) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setOcupado(true);
    try {
      setPerfil(await api.subirFoto(uid, await recortar(f), perfil.foto));
    } catch (err) {
      avisar({ tono: 'error', texto: mensaje(err) });
    }
    setOcupado(false);
  }
  async function quitar() {
    setOcupado(true);
    try {
      setPerfil(await api.quitarFoto(uid, perfil.foto));
    } catch (err) {
      avisar({ tono: 'error', texto: mensaje(err) });
    }
    setOcupado(false);
  }

  return (
    <div className="row" style={{ alignItems: 'center', gap: 14 }}>
      <div className="foto-perfil" aria-hidden="true">
        {url ? <img src={url} alt="" /> : <span>{perfil.nombre_publico?.[0]?.toUpperCase() || '🙂'}</span>}
      </div>
      <div className="col" style={{ gap: 6 }}>
        <div className="row">
          <button type="button" className="btn chico sec" disabled={ocupado} onClick={() => input.current?.click()}>
            {ocupado ? 'Guardando…' : perfil.foto ? 'Cambiar foto' : 'Poner foto (opcional)'}
          </button>
          {perfil.foto && <button type="button" className="btn chico suave" disabled={ocupado} onClick={quitar}>Quitar</button>}
        </div>
        <span className="small muted">Solo la ves tú y el equipo de Togo. No sale en los créditos.</span>
      </div>
      <input ref={input} type="file" accept="image/*" hidden onChange={elegir} />
    </div>
  );
}

const ESTADOS = { pendiente: 'Recibidas', aceptada: 'Aceptadas', revision: 'En revisión', rechazada: 'No usadas' };

export default function Cuenta() {
  const { uid, sesion, perfil, acuerdo, setPerfil } = useApp();
  const [nombre, setNombre] = useState(perfil.nombre_publico);
  const [credito, setCredito] = useState(perfil.mostrar_credito);
  const [mano, setMano] = useState(perfil.mano_dominante);
  const [relacion, setRelacion] = useState(perfil.relacion_lessa);
  const [msg, setMsg] = useState(null);
  const [clave, setClave] = useState('');
  const [retirar, setRetirar] = useState(false);
  const [tomas] = useCarga(() => api.misTomas(uid), [uid]);

  async function guardar(e) {
    e.preventDefault();
    try {
      setPerfil(await api.editarPerfil(uid, { nombre_publico: nombre.trim(), mostrar_credito: credito, mano_dominante: mano, relacion_lessa: relacion }));
      setMsg({ tono: 'ok', texto: 'Guardado. Así aparecerás en los créditos.' });
    } catch (err) {
      setMsg({ tono: 'error', texto: mensaje(err) });
    }
  }

  async function cambiarClave(e) {
    e.preventDefault();
    try {
      await api.cambiarClave(clave);
      setClave('');
      setMsg({ tono: 'ok', texto: 'Contraseña cambiada.' });
    } catch (err) {
      setMsg({ tono: 'error', texto: mensaje(err) });
    }
  }

  const conteo = {};
  (tomas || []).forEach((t) => (conteo[t.estado] = (conteo[t.estado] || 0) + 1));

  return (
    <div className="col" style={{ maxWidth: 640, margin: '0 auto', gap: 16 }}>
      <h1>Mi cuenta</h1>
      {location.hash.includes('nueva') && <Aviso tono="sol">Escribe tu contraseña nueva abajo, en "Contraseña".</Aviso>}
      <Aviso tono={msg?.tono}>{msg?.texto}</Aviso>

      <div className="card">
        <h2>Mis tomas</h2>
        {!tomas ? (
          <Cargando />
        ) : tomas.length ? (
          <div className="kpis">
            <div><div className="cifra">{tomas.length}</div><span className="faint">en total</span></div>
            {Object.entries(conteo).map(([k, n]) => (
              <div key={k}><div className="cifra" style={{ fontSize: 24 }}>{n}</div><span className="faint">{ESTADOS[k]}</span></div>
            ))}
          </div>
        ) : (
          <p className="muted">Todavía no has enviado tomas. <a href="#/colaborar">Empieza aquí</a>.</p>
        )}
        {tomas && tomas.filter((t) => t.estado !== 'rechazada').length >= 15 && (
          <a className="btn sec" href="#/constancia" style={{ marginTop: 12 }}>Ver mi constancia de colaboración</a>
        )}
      </div>

      <form className="card col" onSubmit={guardar}>
        <h2>Mi perfil</h2>
        <FotoPerfil uid={uid} perfil={perfil} setPerfil={setPerfil} avisar={setMsg} />
        <label className="campo">
          Nombre para los créditos
          <input value={nombre} maxLength={40} onChange={(e) => setNombre(e.target.value)} />
        </label>
        <label className="check">
          <input type="checkbox" checked={credito} onChange={(e) => setCredito(e.target.checked)} />
          <span>Mostrar mi nombre en "Colaboradores"</span>
        </label>
        <div className="campo"><b>Mano con la que señas más</b><Opciones valor={mano} cambiar={setMano} opciones={MANOS} /></div>
        <div className="campo"><b>Relación con LESSA</b><Opciones valor={relacion} cambiar={setRelacion} opciones={RELACIONES} /></div>
        <button className="btn" disabled={nombre.trim().length < 2}>Guardar</button>
      </form>

      <div className="card col">
        <h2>Acuerdo</h2>
        {acuerdo ? (
          <p className="small" style={{ margin: 0 }}>
            Aceptado el {new Date(acuerdo.aceptado_en).toLocaleDateString('es-SV')} (versión {acuerdo.version_acuerdo}).
            {acuerdo.es_menor && (acuerdo.tutor_confirmado_en ? ` Confirmado por ${acuerdo.tutor_nombre}.` : ' Falta la confirmación de tu tutor.')}
          </p>
        ) : (
          <p className="small">Aún no aceptas el acuerdo. <a href="#/unirme">Hazlo aquí</a>.</p>
        )}
        <a href="#/acuerdo">Leer el acuerdo</a>
      </div>

      <form className="card col" onSubmit={cambiarClave}>
        <h2>Contraseña</h2>
        <p className="small muted" style={{ margin: 0 }}>Cuenta: {sesion?.user?.email}</p>
        <input type="password" minLength={8} placeholder="Contraseña nueva" autoComplete="new-password" value={clave} onChange={(e) => setClave(e.target.value)} />
        <button className="btn sec" disabled={clave.length < 8}>Cambiar contraseña</button>
      </form>

      <div className="row">
        <button className="btn suave" onClick={() => api.salir().then(() => ir('#/'))}>Cerrar sesión</button>
        <button className="link" style={{ color: 'var(--danger)' }} onClick={() => setRetirar(true)}>Retirar mis datos</button>
      </div>
      {retirar && <Retirar cerrar={() => setRetirar(false)} />}
    </div>
  );
}

function Retirar({ cerrar }) {
  const { uid } = useApp();
  const [texto, setTexto] = useState('');
  const [error, setError] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  async function confirmar() {
    setOcupado(true);
    try {
      await api.retirarDatos(uid);
      ir('#/');
    } catch (e) {
      setError(mensaje(e));
      setOcupado(false);
    }
  }
  return (
    <Modal cerrar={cerrar}>
      <h2>Retirar mis datos</h2>
      <p>Se borran tu cuenta, tu perfil y todas tus tomas. Las copias del conjunto de datos se borran en la próxima sincronización y no se usarán en versiones nuevas de Togo.</p>
      <p><b>No se puede deshacer.</b> Escribe <b>RETIRAR</b> para confirmar.</p>
      <input value={texto} onChange={(e) => setTexto(e.target.value)} autoFocus />
      <Aviso tono="error">{error}</Aviso>
      <div className="row" style={{ marginTop: 12 }}>
        <button className="btn peligro" disabled={texto.trim().toUpperCase() !== 'RETIRAR' || ocupado} onClick={confirmar}>
          {ocupado ? 'Borrando…' : 'Retirar mis datos'}
        </button>
        <button className="btn suave" onClick={cerrar}>Cancelar</button>
      </div>
    </Modal>
  );
}
