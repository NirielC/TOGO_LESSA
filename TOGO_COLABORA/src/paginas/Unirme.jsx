import { useState } from 'react';
import { api, mensaje } from '../api.js';
import { useApp } from '../contexto.js';
import { Aviso, ir, Opciones } from '../componentes/ui.jsx';
import { VideoAcuerdo } from './Textos.jsx';

export const RELACIONES = [
  ['sorda', 'Soy persona sorda'],
  ['familiar', 'Familia de persona sorda'],
  ['interprete', 'Intérprete'],
  ['estudiante', 'Estoy aprendiendo LESSA'],
  ['otra', 'Otra'],
];
export const MANOS = [
  ['derecha', 'Derecha'],
  ['izquierda', 'Izquierda'],
  ['ambas', 'Las dos'],
];

/** Perfil + acuerdo, en una sola pantalla. */
export default function Unirme() {
  const { uid, perfil, recargar } = useApp();
  const [nombre, setNombre] = useState(perfil?.nombre_publico || '');
  const [credito, setCredito] = useState(perfil?.mostrar_credito ?? true);
  const [mano, setMano] = useState(perfil?.mano_dominante || null);
  const [relacion, setRelacion] = useState(perfil?.relacion_lessa || null);
  const [menor, setMenor] = useState(perfil?.es_menor ?? null);
  const [tutor, setTutor] = useState('');
  const [tutorCorreo, setTutorCorreo] = useState('');
  const [acepto, setAcepto] = useState(false);
  const [msg, setMsg] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  const listo = nombre.trim().length >= 2 && menor !== null && acepto && (!menor || (tutor.trim().length >= 3 && /\S+@\S+\.\S+/.test(tutorCorreo)));

  async function enviar(e) {
    e.preventDefault();
    if (!listo) return;
    setOcupado(true);
    setMsg(null);
    try {
      const datos = { nombre_publico: nombre.trim(), mostrar_credito: credito, mano_dominante: mano, relacion_lessa: relacion };
      let llego_por = null;
      try {
        llego_por = localStorage.getItem('togo_de');
      } catch {
        /* sin almacenamiento */
      }
      if (!perfil) await api.crearPerfil(uid, { ...datos, es_menor: menor, llego_por });
      else await api.editarPerfil(uid, datos);
      await api.aceptarAcuerdo(uid, menor ? { es_menor: true, tutor_nombre: tutor.trim(), tutor_correo: tutorCorreo.trim() } : { es_menor: false });
      await recargar();
      if (!menor) ir('#/colaborar');
    } catch (err) {
      setMsg(mensaje(err));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <form onSubmit={enviar} style={{ maxWidth: 620, margin: '0 auto' }} className="col">
      <h1>¡Bienvenido a Togo!</h1>
      <p className="muted">Dos pasos rápidos y empiezas a grabar.</p>

      <div className="card col">
        <h2>1. Tu perfil</h2>
        <label className="campo">
          ¿Cómo quieres aparecer en los créditos?
          <input value={nombre} maxLength={40} onChange={(e) => setNombre(e.target.value)} placeholder="Por ejemplo: Ana López" />
          <span className="ayuda">Puede ser tu nombre o un apodo. Lo puedes cambiar después.</span>
        </label>
        <label className="check">
          <input type="checkbox" checked={credito} onChange={(e) => setCredito(e.target.checked)} />
          <span>Mostrar mi nombre en "Colaboradores" de la app Togo</span>
        </label>
        <div className="campo">
          <b>¿Con qué mano señas más? <span className="faint">(opcional)</span></b>
          <Opciones valor={mano} cambiar={setMano} opciones={MANOS} />
        </div>
        <div className="campo">
          <b>Tu relación con LESSA <span className="faint">(opcional)</span></b>
          <Opciones valor={relacion} cambiar={setRelacion} opciones={RELACIONES} />
        </div>
        {!perfil && (
          <div className="campo">
            <b>¿Tienes 18 años o más?</b>
            <Opciones valor={menor} cambiar={setMenor} opciones={[[false, 'Sí, 18 o más'], [true, 'No, soy menor']]} />
          </div>
        )}
        {menor && (
          <div className="card alt col">
            <p className="small" style={{ margin: 0 }}>
              Como eres menor de edad, tu <b>madre, padre o tutor</b> debe confirmar. Te daremos un enlace para que se lo envíes.
            </p>
            <label className="campo">
              Nombre de tu madre, padre o tutor
              <input value={tutor} maxLength={80} onChange={(e) => setTutor(e.target.value)} />
            </label>
            <label className="campo">
              Su correo
              <input type="email" value={tutorCorreo} onChange={(e) => setTutorCorreo(e.target.value)} />
            </label>
          </div>
        )}
      </div>

      <div className="card col">
        <h2>2. El acuerdo, en corto</h2>
        <VideoAcuerdo />
        <ul className="small" style={{ margin: 0, paddingLeft: 20 }}>
          <li><b>Tu video no sale de tu teléfono:</b> solo se envían puntos de tu cuerpo y tus manos.</li>
          <li>Tus tomas se usan para entrenar y mejorar Togo. No se venden ni se usan para publicidad.</li>
          <li>Colaborar es voluntario y gratuito, y <b>no da propiedad</b> sobre Togo.</li>
          <li>Si quieres, tu nombre sale en "Colaboradores".</li>
          <li>Puedes retirar tus datos cuando quieras desde "Mi cuenta".</li>
        </ul>
        <a href="#/acuerdo" target="_blank" rel="noreferrer">Leer el acuerdo completo</a>
        <label className="check">
          <input type="checkbox" checked={acepto} onChange={(e) => setAcepto(e.target.checked)} />
          <span>Leí y acepto el acuerdo de colaboración</span>
        </label>
      </div>

      <Aviso tono="error">{msg}</Aviso>
      <button className="btn grande bloque" disabled={!listo || ocupado}>
        {ocupado ? 'Guardando…' : menor ? 'Continuar' : 'Empezar a colaborar'}
      </button>
    </form>
  );
}

/** Menor esperando la confirmación de su tutor: enlace para compartir. */
export function EsperandoTutor() {
  const { acuerdo, recargar } = useApp();
  const [copiado, setCopiado] = useState(false);
  const enlace = `${location.origin}${location.pathname}#/tutor/${acuerdo.tutor_token}`;
  const texto = `Hola, quiero colaborar con Togo (app de Lengua de Señas Salvadoreña). Como soy menor, necesito tu permiso: ${enlace}`;
  return (
    <div style={{ maxWidth: 560, margin: '0 auto' }} className="col">
      <h1>Falta un paso</h1>
      <p className="muted">
        Envía este enlace a <b>{acuerdo.tutor_nombre}</b>. Cuando lo abra y confirme, podrás empezar a grabar.
      </p>
      <div className="card col">
        <input readOnly value={enlace} onFocus={(e) => e.target.select()} />
        <div className="row">
          <button className="btn" onClick={() => navigator.clipboard?.writeText(enlace).then(() => setCopiado(true))}>
            {copiado ? '¡Copiado!' : 'Copiar enlace'}
          </button>
          <a className="btn sec" href={`https://wa.me/?text=${encodeURIComponent(texto)}`} target="_blank" rel="noreferrer">WhatsApp</a>
          {navigator.share && (
            <button className="btn suave" onClick={() => navigator.share({ title: 'Permiso para Togo', text: texto }).catch(() => {})}>
              Compartir
            </button>
          )}
        </div>
      </div>
      <button className="btn sec" onClick={() => recargar()}>Ya confirmó, revisar de nuevo</button>
    </div>
  );
}
