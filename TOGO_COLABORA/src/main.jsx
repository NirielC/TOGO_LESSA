import { lazy, StrictMode, Suspense, useCallback, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './estilos.css';
import './sitio.css';
import { api, DEMO } from './api.js';
import { Cargando } from './componentes/ui.jsx';
import { Ctx, useApp } from './contexto.js';
import { cola, procesarCola } from './captura/cola.js';
import Inicio from './paginas/Inicio.jsx';
import Portada from './paginas/Portada.jsx';
import Descargar from './paginas/Descargar.jsx';
import Proyecto from './paginas/Proyecto.jsx';
import { CONTACTO, PESTANAS } from './sitio.js';
import Entrar from './paginas/Entrar.jsx';
import Unirme, { EsperandoTutor } from './paginas/Unirme.jsx';
import Senas from './paginas/Senas.jsx';
import Cuenta from './paginas/Cuenta.jsx';
import Tutor from './paginas/Tutor.jsx';
import Constancia from './paginas/Constancia.jsx';
import { Acuerdo, Gracias } from './paginas/Textos.jsx';

// El panel de administración se descarga solo si alguien entra a él.
const Admin = lazy(() => import('./admin/Admin.jsx'));
// La cámara y MediaPipe, solo al grabar: la portada carga liviana.
const Grabar = lazy(() => import('./paginas/Grabar.jsx'));

function useRuta() {
  const leer = () => (location.hash.replace(/^#\/?/, '') || '').split('?')[0].split('/').map(decodeURIComponent);
  const [ruta, setRuta] = useState(leer);
  useEffect(() => {
    const f = () => {
      setRuta(leer());
      window.scrollTo(0, 0);
    };
    addEventListener('hashchange', f);
    return () => removeEventListener('hashchange', f);
  }, []);
  return ruta;
}

function App() {
  const ruta = useRuta();
  const [sesion, setSesion] = useState(undefined);
  const [perfil, setPerfil] = useState(undefined);
  const [acuerdo, setAcuerdo] = useState(undefined);

  useEffect(() => {
    api.sesion().then(setSesion).catch(() => setSesion(null));
    const sub = api.alCambiarSesion((s, evento) => {
      setSesion(s);
      // Enlace de "olvidé mi contraseña": entra y lleva a escribir una nueva.
      if (evento === 'PASSWORD_RECOVERY') location.hash = '#/cuenta?nueva';
      // Quita el ?code=... de la dirección después de entrar.
      if (location.search.includes('code=')) history.replaceState(null, '', location.pathname + location.hash);
    });
    return () => sub?.unsubscribe?.();
  }, []);

  const uid = sesion?.user?.id;
  const recargar = useCallback(async () => {
    if (!uid) {
      setPerfil(null);
      setAcuerdo(null);
      return;
    }
    const [p, a] = await Promise.all([api.miPerfil(uid), api.miAcuerdo(uid)]);
    setPerfil(p);
    setAcuerdo(a);
  }, [uid]);

  useEffect(() => {
    if (sesion === undefined) return;
    recargar().catch(() => {
      setPerfil(null);
      setAcuerdo(null);
    });
  }, [sesion, recargar]);

  // Tomas guardadas sin internet: se envían solas al volver la conexión.
  const [pendientes, setPendientes] = useState(0);
  useEffect(() => cola.alCambiar(setPendientes), []);
  useEffect(() => {
    if (!uid) return;
    const intentar = () => procesarCola(uid).catch(() => {});
    intentar();
    addEventListener('online', intentar);
    const t = setInterval(() => cola.contar().then((n) => n && intentar()), 30000);
    return () => {
      removeEventListener('online', intentar);
      clearInterval(t);
    };
  }, [uid]);

  const listo = sesion !== undefined && (!uid || perfil !== undefined);
  const ctx = { sesion, uid, perfil, acuerdo, recargar, setPerfil };
  const [pag, ...args] = ruta;
  const enGrabar = pag === 'grabar' || pag === 'practica';
  const publica = PESTANAS.some(([p]) => p === (pag || '')) || !RUTAS.has(pag);

  return (
    <Ctx.Provider value={ctx}>
      <header className="top no-imprimir">
        <a className="marca" href="#/">
          <img src="/togo-128.png" alt="" width="34" height="34" />
          <b>Togo</b>
          <small>Colabora</small>
        </a>
        <nav className="pestanas" aria-label="Secciones">
          {PESTANAS.map(([p, t]) => (
            <a key={p} href={`#/${p}`} aria-current={(pag || '') === p ? 'page' : undefined}>{t}</a>
          ))}
        </nav>
        <nav>
          {DEMO && <span className="chip sol">Demo</span>}
          {uid && pendientes > 0 && (
            <button className="chip sol" style={{ border: 0, cursor: 'pointer' }} title="Se envían solas cuando hay conexión" onClick={() => procesarCola(uid)}>
              ⟳ {pendientes} por enviar
            </button>
          )}
          {perfil?.es_admin || perfil?.es_revisor ? (
            <a className="btn chico suave hide-sm" href="#/admin">Panel</a>
          ) : null}
          {uid ? (
            <a className="btn chico sec" href="#/cuenta">{perfil?.nombre_publico?.split(' ')[0] || 'Mi cuenta'}</a>
          ) : (
            pag !== 'entrar' && <a className="btn chico sec" href="#/entrar">Entrar</a>
          )}
        </nav>
      </header>
      <main className={publica ? 'sitio' : `main ${pag === 'admin' ? 'ancho' : ''}`}>
        {!listo ? (
          <Cargando />
        ) : (
          <Pagina pag={pag} args={args} />
        )}
      </main>
      {!enGrabar && (
        <footer className="pie no-imprimir">
          <div className="envoltura pie-columnas">
            <div>
              <div className="marca"><img src="/togo-128.png" alt="" width="34" height="34" /><b>Togo</b></div>
              <p>Traduce Lengua de Señas Salvadoreña (LESSA) a voz, sin internet. Hecho en El Salvador.</p>
            </div>
            <div>
              <b>Togo</b>
              {PESTANAS.map(([p, t]) => <a key={p} href={`#/${p}`}>{t}</a>)}
            </div>
            <div>
              <b>Colabora</b>
              <a href="#/practica">Probar sin cuenta</a>
              <a href="#/acuerdo">Acuerdo de colaboración</a>
              <a href="#/gracias">Colaboradores</a>
            </div>
            <div>
              <b>Contacto</b>
              <a href={`mailto:${CONTACTO}`}>{CONTACTO}</a>
            </div>
          </div>
        </footer>
      )}
    </Ctx.Provider>
  );
}

/** Rutas que no son del sitio público (tienen su propio ancho y estilo). */
const RUTAS = new Set(['entrar', 'acuerdo', 'gracias', 'tutor', 'practica', 'unirme', 'colaborar', 'grabar', 'constancia', 'cuenta', 'admin']);

function Pagina({ pag, args }) {
  switch (pag) {
    case '':
      return <Portada />;
    case 'app':
      return <Descargar />;
    case 'proyecto':
      return <Proyecto />;
    case 'colabora':
      return <Inicio />;
    case 'entrar':
      return <YaDentro />;
    case 'acuerdo':
      return <Acuerdo />;
    case 'gracias':
      return <Gracias />;
    case 'tutor':
      return <Tutor token={args[0]} />;
    case 'practica':
      return <Suspense fallback={<Cargando />}><Grabar senaId={args[0] || 'hola'} practica /></Suspense>;
    case 'unirme':
      return <Requiere sinAcuerdo><Unirme /></Requiere>;
    case 'colaborar':
      return <Requiere><Senas /></Requiere>;
    case 'grabar':
      return <Requiere><Suspense fallback={<Cargando />}><Grabar senaId={args[0]} /></Suspense></Requiere>;
    case 'constancia':
      return <Requiere sinAcuerdo><Constancia /></Requiere>;
    case 'cuenta':
      return <Requiere sinAcuerdo><Cuenta /></Requiere>;
    case 'admin':
      return (
        <Requiere sinAcuerdo>
          <Suspense fallback={<Cargando texto="Abriendo el panel…" />}>
            <Admin seccion={args[0] || 'resumen'} args={args.slice(1)} />
          </Suspense>
        </Requiere>
      );
    default:
      return <Portada />;
  }
}

function YaDentro() {
  const { uid } = useApp();
  if (!uid) return <Entrar />;
  return <Requiere><Senas /></Requiere>;
}

/** Pide sesión, perfil y acuerdo vigente (y la confirmación del tutor si es menor). */
function Requiere({ children, sinAcuerdo = false }) {
  const { uid, perfil, acuerdo } = useApp();
  if (!uid) return <Entrar volver={location.hash} />;
  if (sinAcuerdo && perfil) return children;
  if (!perfil || !acuerdo) return <Unirme />;
  if (acuerdo.es_menor && !acuerdo.tutor_confirmado_en) return <EsperandoTutor />;
  return children;
}

// Canal por el que llegó (?de=sticker, ?de=instagram…): se guarda la primera vez y va al perfil.
try {
  const de = new URLSearchParams(location.search).get('de');
  if (de && /^[a-z0-9_-]{1,40}$/.test(de) && !localStorage.getItem('togo_de')) localStorage.setItem('togo_de', de);
} catch {
  /* sin almacenamiento */
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
