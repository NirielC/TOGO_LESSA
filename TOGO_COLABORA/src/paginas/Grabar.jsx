import { useEffect, useRef, useState } from 'react';
import { api, mensaje } from '../api.js';
import { useApp } from '../contexto.js';
import { abrirCamara, cargarDetector, cerrarCamara, PRUEBA } from '../captura/detector.js';
import { avisoEnVivo, evaluarToma } from '../captura/calidad.js';
import { codificar } from '../captura/formato.js';
import { cola, esErrorDeRed } from '../captura/cola.js';
import { cuadroAMuneco, EjemploAnimado, Muneco, suavizarToma, tieneAnimado, useDiccionario } from '../componentes/Muneco.jsx';
import { Aviso, Barra, Cargando, ir, Puntos, useLocal } from '../componentes/ui.jsx';

/*
 * GRABAR UNA SEÑA
 *
 *  listo ──(botón)──> cuenta 3-2-1 ──> grabando (duración de la seña) ──> revisar ──> enviar
 *    └──(modo rápido: manos abajo 0.6 s = armado, al subirlas graba sola; envía sola si salió bien)
 *
 * Cada toma se sube al terminarla: se puede pausar o cerrar cuando sea.
 * La primera toma de cada persona es de práctica y no se envía.
 */
const FPS = 20;
const PASO = 1000 / FPS;
const VIVO_MS = 100;           // detección mientras espera (10/s basta para los avisos)
const MANOS_ABAJO_MS = 600;
const NADA_ARRANCA_MS = 2500;  // "Sin seña": arranca sola, no hay que subir las manos
const AUTO_ENVIO_MS = 2500;

export default function Grabar({ senaId, practica = false }) {
  const { uid } = useApp();
  const dic = useDiccionario();
  const [sena, setSena] = useState(null);
  const [mias, setMias] = useState([]);
  const [errorCarga, setErrorCarga] = useState(null);
  const [fase, setFaseEstado] = useState('cargando');
  const faseRef = useRef('cargando');
  const setFase = (f) => {
    faseRef.current = f;
    setFaseEstado(f);
  };
  const [aviso, setAviso] = useState(null);
  const [cuenta, setCuenta] = useState(0);
  const [prog, setProg] = useState(0);
  const [toma, setToma] = useState(null);
  const [errorEnvio, setErrorEnvio] = useState(null);
  const [toast, setToast] = useState(null);
  const [camKey, setCamKey] = useState(0);
  const [rapido, setRapido] = useLocal('togo_rapido', false);
  const [espejo, setEspejo] = useLocal('togo_espejo', false);
  const [lento, setLento] = useState(false);
  const [verVideo, setVerVideo] = useState(false);
  const [practicaHecha, setPracticaHecha] = useLocal('togo_practica_hecha', false);
  const enPractica = practica || !practicaHecha;
  // Guía de 3 pasos la primera vez (la cámara ya corre detrás para que se acomode).
  const [guia, setGuia] = useState(enPractica);

  const videoRef = useRef(null);
  const capaRef = useRef(null);
  const streamRef = useRef(null);
  const detRef = useRef(null);
  const buf = useRef(null);
  const vivo = useRef({ ultimo: 0, abajoDesde: null, armadoDesde: null });
  const rapidoRef = useRef(rapido);
  rapidoRef.current = rapido;
  const senaRef = useRef(null);
  senaRef.current = sena;

  // ------------------------------------------------ datos de la seña
  useEffect(() => {
    let vivo = true;
    Promise.all([api.senas(), uid && !practica ? api.misTomas(uid) : [], uid && !practica ? cola.locales(uid) : []])
      .then(([senas, tomas, locales]) => {
        if (!vivo) return;
        const s = senas.find((x) => x.id === senaId);
        if (!s) throw new Error('Esa seña no existe o ya no recibe tomas.');
        setSena(s);
        setMias([...tomas, ...locales].filter((t) => t.sena === senaId && t.estado !== 'rechazada'));
      })
      .catch((e) => vivo && setErrorCarga(mensaje(e)));
    return () => (vivo = false);
  }, [senaId, uid, practica]);

  // ------------------------------------------------ cámara + MediaPipe
  useEffect(() => {
    if (!sena) return;
    let cancelado = false;
    setFase('cargando');
    (async () => {
      try {
        const [det, stream] = await Promise.all([cargarDetector(), abrirCamara(videoRef.current)]);
        streamRef.current = stream;
        if (cancelado) return cerrarCamara(stream);
        detRef.current = det;
        setFase('listo');
      } catch (e) {
        if (cancelado) return;
        setFase(e?.name === 'NotAllowedError' || e?.name === 'SecurityError' ? 'permiso' : e?.name === 'NotFoundError' ? 'sincamara' : 'error');
        console.error(e);
      }
    })();
    return () => {
      cancelado = true;
      cerrarCamara(streamRef.current);
      streamRef.current = null;
    };
  }, [sena?.id, camKey]);

  // Pantalla encendida mientras graba.
  useEffect(() => {
    let lock = null;
    navigator.wakeLock?.request('screen').then((l) => (lock = l)).catch(() => {});
    return () => lock?.release?.();
  }, []);

  // Si cambia de pestaña a media toma, esa toma no vale.
  useEffect(() => {
    const f = () => {
      if (document.hidden && ['grabando', 'cuenta'].includes(faseRef.current)) {
        setFase('listo');
        setToast({ texto: 'Se canceló la toma porque saliste de la página.' });
      }
    };
    document.addEventListener('visibilitychange', f);
    return () => document.removeEventListener('visibilitychange', f);
  }, []);

  // ------------------------------------------------ bucle de cuadros
  useEffect(() => {
    let raf;
    const bucle = () => {
      raf = requestAnimationFrame(bucle);
      const v = videoRef.current;
      const det = detRef.current;
      const s = senaRef.current;
      if (!det || !v || v.readyState < 2 || !s) return;
      const f = faseRef.current;
      const ahora = performance.now();

      if (f === 'grabando') {
        const b = buf.current;
        if (ahora >= b.next - PASO / 4) {
          const { cuadro, info } = det.detectar(v, ahora);
          b.cuadros.push(cuadro);
          b.tiempos.push(Math.round(ahora - b.t0));
          b.infos.push(info);
          b.next = Math.max(b.next + PASO, ahora + PASO / 2);
          dibujar(info);
          setProg((ahora - b.t0) / (s.duracion_s * 1000));
        }
        if (ahora - b.t0 >= s.duracion_s * 1000) terminar();
        return;
      }
      if (!['listo', 'armado', 'cuenta'].includes(f)) return;
      const vv = vivo.current;
      if (ahora - vv.ultimo < VIVO_MS) return;
      vv.ultimo = ahora;
      const { info } = det.detectar(v, ahora);
      dibujar(info);
      setAviso(avisoEnVivo(info));
      if (!rapidoRef.current || f === 'cuenta') return;
      const manos = info.manos.length > 0;
      if (f === 'listo') {
        if (manos) vv.abajoDesde = null;
        else {
          vv.abajoDesde ??= ahora;
          if (ahora - vv.abajoDesde >= MANOS_ABAJO_MS) {
            vv.armadoDesde = ahora;
            setFase('armado');
          }
        }
      } else if (f === 'armado') {
        if (s.tipo === 'nada' ? ahora - vv.armadoDesde >= NADA_ARRANCA_MS && info.hombros != null : manos) empezar();
      }
    };
    raf = requestAnimationFrame(bucle);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function dibujar(info) {
    const c = capaRef.current;
    const v = videoRef.current;
    if (!c || !v) return;
    if (c.width !== v.videoWidth) {
      c.width = v.videoWidth;
      c.height = v.videoHeight;
    }
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.fillStyle = faseRef.current === 'grabando' ? '#F08A5D' : '#F6C453';
    const r = Math.max(2.5, c.width / 160);
    for (const mano of info.manos) {
      for (const [x, y] of mano) {
        ctx.beginPath();
        ctx.arc(x * c.width, y * c.height, r, 0, 7);
        ctx.fill();
      }
    }
  }

  function limpiarCapa() {
    const c = capaRef.current;
    c?.getContext('2d').clearRect(0, 0, c.width, c.height);
  }

  // ------------------------------------------------ acciones
  function contar() {
    setToast(null);
    setFase('cuenta');
    let n = 3;
    setCuenta(n);
    const t = setInterval(() => {
      if (faseRef.current !== 'cuenta') return clearInterval(t);
      n -= 1;
      if (n <= 0) {
        clearInterval(t);
        empezar();
      } else setCuenta(n);
    }, 700);
  }

  function empezar() {
    const ahora = performance.now();
    buf.current = { cuadros: [], tiempos: [], infos: [], t0: ahora, next: ahora };
    setProg(0);
    setToast(null);
    if (PRUEBA) {
      // Cámara de prueba: los cuadros se generan de una vez (funciona aunque la pestaña esté oculta).
      for (let t = 0; t < senaRef.current.duracion_s * 1000; t += PASO) {
        const { cuadro, info } = detRef.current.detectar(null, 1000 + t);
        buf.current.cuadros.push(cuadro);
        buf.current.tiempos.push(Math.round(t));
        buf.current.infos.push(info);
      }
      return terminar();
    }
    setFase('grabando');
    navigator.vibrate?.(30);
  }

  function terminar() {
    const b = buf.current;
    const s = senaRef.current;
    const v = videoRef.current;
    const ev = evaluarToma(b.infos, b.tiempos, s.duracion_s * FPS, s.tipo);
    const w = v.videoWidth || 640;
    const h = v.videoHeight || 480;
    setToma({ ...b, ev, w, h, muneco: suavizarToma(b.cuadros.map((c) => cuadroAMuneco(c, w, h)), true) });
    setErrorEnvio(null);
    limpiarCapa();
    setFase('revisar');
    navigator.vibrate?.([20, 40, 20]);
  }

  function repetir() {
    setToma(null);
    vivo.current.abajoDesde = null;
    setFase('listo');
  }

  async function enviar() {
    if (faseRef.current !== 'revisar' || !toma?.ev.ok) return;
    if (enPractica) {
      if (!practica) setPracticaHecha(true);
      setToma(null);
      setFase(practica ? 'practicada' : 'listo');
      if (!practica) setToast({ texto: '¡Así se hace! Ahora sí, las que siguen cuentan.' });
      return;
    }
    setFase('enviando');
    try {
      const bytes = await codificar(toma.cuadros, toma.tiempos, { sena: sena.id, ancho: toma.w, alto: toma.h, fps: FPS, origen: 'web' });
      const meta = {
        cuadros: toma.cuadros.length,
        fps: Math.max(1, toma.ev.calidad.fps),
        ancho: toma.w,
        alto: toma.h,
        calidad: toma.ev.calidad,
        origen: 'web',
      };
      const id = crypto.randomUUID();
      let nueva;
      let guardadaLocal = false;
      try {
        nueva = await api.subirToma(uid, sena.id, bytes, meta, id);
      } catch (e) {
        if (!esErrorDeRed(e)) throw e;
        // Sin conexión: se guarda en el teléfono y se envía sola después.
        await cola.agregar({ id, uid, sena: sena.id, bytes, meta, creado: Date.now() });
        nueva = { id, sena: sena.id, estado: 'en_cola', local: true };
        guardadaLocal = true;
      }
      const lista = [...mias, nueva];
      setMias(lista);
      setToma(null);
      if (lista.length >= sena.tope_por_persona) setFase('completa');
      else {
        setFase('listo');
        setToast({
          texto: guardadaLocal
            ? `Sin conexión: la guardé y se enviará sola. ${lista.length} de ${sena.tope_por_persona}`
            : `¡Enviada! ${lista.length} de ${sena.tope_por_persona}`,
          deshacer: nueva,
        });
      }
    } catch (e) {
      setErrorEnvio(mensaje(e));
      setFase('revisar');
      if (String(e?.message).includes('tope_alcanzado')) setFase('completa');
    }
  }

  async function deshacer(t) {
    setToast(null);
    try {
      if (t.local) await cola.quitar(t.id);
      else await api.borrarToma(t);
      setMias((m) => m.filter((x) => x.id !== t.id));
      if (faseRef.current === 'completa') setFase('listo');
      setToast({ texto: 'Listo, se borró esa toma.' });
    } catch (e) {
      setToast({ texto: mensaje(e) });
    }
  }

  function pausar() {
    cerrarCamara(streamRef.current);
    streamRef.current = null;
    limpiarCapa();
    setFase('pausa');
  }

  // Envío automático en modo rápido (se cancela con "Repetir").
  useEffect(() => {
    if (!rapido || fase !== 'revisar' || !toma?.ev.ok || errorEnvio) return;
    const t = setTimeout(enviar, AUTO_ENVIO_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fase, toma, rapido, errorEnvio]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), toast.deshacer ? 7000 : 4500);
    return () => clearTimeout(t);
  }, [toast]);

  // Teclado en computadora: Espacio graba / envía, R repite.
  useEffect(() => {
    const f = (e) => {
      if (e.target.closest?.('input, textarea, select')) return;
      if (e.code === 'Space') {
        e.preventDefault();
        if (faseRef.current === 'listo' || faseRef.current === 'armado') contar();
        else if (faseRef.current === 'revisar') enviar();
      } else if (e.key?.toLowerCase() === 'r' && faseRef.current === 'revisar') repetir();
    };
    addEventListener('keydown', f);
    return () => removeEventListener('keydown', f);
  });

  // ------------------------------------------------ pantalla
  if (errorCarga) return <Aviso tono="error">{errorCarga}</Aviso>;
  if (!sena) return <Cargando />;

  const tope = sena.tope_por_persona;
  const salir = practica ? '#/' : '#/colaborar';
  const urlVideo = sena.video_ejemplo ? api.urlEjemplo(sena.video_ejemplo) : null;
  const animado = tieneAnimado(sena, dic) && <EjemploAnimado sena={sena} dic={dic} size={210} mirror={espejo} speed={lento ? 0.5 : 1} />;
  const listoParaGrabar = fase === 'listo' || fase === 'armado';

  return (
    <div className="grabar">
      <aside className="ejemplo">
        <div className="lienzo">
          {verVideo && urlVideo ? (
            <video src={urlVideo} autoPlay loop muted playsInline controls style={espejo ? { transform: 'scaleX(-1)' } : null} />
          ) : (
            animado || <b style={{ font: '600 72px var(--title)', color: 'var(--sign-ink)' }}>{sena.tipo.startsWith('letra') ? sena.texto : '👐'}</b>
          )}
        </div>
        <div>
          <span className="faint">{sena.categoria}</span>
          <h2 style={{ margin: '2px 0 6px' }}>{sena.texto}</h2>
          {sena.descripcion && <p className="small muted">{sena.descripcion}</p>}
          <div className="row" style={{ gap: 6 }}>
            <button className="btn chico suave" onClick={() => setEspejo(!espejo)}>{espejo ? 'Ver de frente' : 'Ver como espejo'}</button>
            {!verVideo && dic?.senas?.[sena.id] && <button className="btn chico suave" onClick={() => setLento(!lento)}>{lento ? 'Velocidad normal' : 'Más lento'}</button>}
            {urlVideo && <button className="btn chico suave" onClick={() => setVerVideo(!verVideo)}>{verVideo ? 'Ver muñeco' : 'Ver video'}</button>}
          </div>
        </div>
      </aside>

      <section className="col" style={{ gap: 10 }}>
        <div className="row barra-sup" style={{ justifyContent: 'space-between' }}>
          {enPractica ? (
            <span className="chip sol">Práctica (no se envía)</span>
          ) : (
            <div className="row" style={{ gap: 8 }}>
              <Puntos hechas={mias.length} total={tope} ahora={fase !== 'completa'} />
              <b className="small">{mias.length}/{tope}</b>
            </div>
          )}
          <label className="check small" title="Graba sola al subir las manos y envía sola si salió bien">
            <input type="checkbox" checked={rapido} onChange={(e) => setRapido(e.target.checked)} />
            <span>Modo rápido</span>
          </label>
        </div>

        <div className={`camara ${fase === 'grabando' ? 'grabando' : fase === 'armado' ? 'listo' : ['revisar', 'enviando', 'completa', 'practicada'].includes(fase) ? 'clara' : ''}`}>
          <video ref={videoRef} className="espejo" playsInline muted />
          <canvas ref={capaRef} className="capa espejo" />

          {['listo', 'armado', 'cuenta'].includes(fase) && aviso && (
            <div className="estado">
              <span className={`chip ${aviso.tono}`}>{aviso.texto}</span>
            </div>
          )}
          {fase === 'listo' && rapido && (
            <div className="estado" style={{ top: 'auto', bottom: 14 }}>
              <span className="chip">{sena.tipo === 'nada' ? 'Baja las manos para empezar' : 'Baja las manos para prepararte'}</span>
            </div>
          )}
          {fase === 'armado' && (
            <div className="estado" style={{ top: 'auto', bottom: 14 }}>
              <span className="chip ok">{sena.tipo === 'nada' ? 'Empieza en un momento…' : '¡Listo! Sube las manos y haz la seña'}</span>
            </div>
          )}
          {fase === 'cuenta' && <div className="cuenta">{cuenta}</div>}
          {fase === 'grabando' && (
            <>
              <div className="estado"><span className="chip vivo">● Grabando: haz la seña</span></div>
              <div className="prog"><Barra valor={prog} vivo /></div>
            </>
          )}

          {guia && ['listo', 'armado'].includes(fase) && (
            <div className="velo">
              <div className="col" style={{ maxWidth: 340, gap: 10 }}>
                <h2 style={{ margin: 0 }}>Antes de empezar</h2>
                <ol className="guia">
                  <li><b>Apoya el teléfono</b> (en una mesa o contra algo) a un brazo de distancia.</li>
                  <li><b>Que se vean tu cara, tus hombros y tus manos.</b> Los puntitos amarillos te dicen que te veo.</li>
                  <li><b>Toca Grabar</b>: cuenta 3, 2, 1 y haz la seña como la harías normalmente.</li>
                </ol>
                <p className="small" style={{ margin: 0, opacity: 0.85 }}>La primera es de práctica: no se envía.</p>
                <button className="btn grande" onClick={() => setGuia(false)}>¡Entendido!</button>
              </div>
            </div>
          )}
          {fase === 'cargando' && (
            <div className="velo">
              <div className="col" style={{ alignItems: 'center' }}>
                <div className="giro" />
                <h2>Preparando la cámara…</h2>
                <p className="small">La primera vez se descargan unos 28 MB (después queda guardado). Tu video no sale de este dispositivo.</p>
              </div>
            </div>
          )}
          {fase === 'permiso' && (
            <div className="velo">
              <div>
                <h2>Necesito ver tu cámara</h2>
                <p className="small">Toca el candado o el ícono de cámara junto a la dirección de la página y permite la cámara. Tu video no sale de este dispositivo.</p>
                <button className="btn" onClick={() => setCamKey((k) => k + 1)}>Intentar de nuevo</button>
              </div>
            </div>
          )}
          {(fase === 'sincamara' || fase === 'error') && (
            <div className="velo">
              <div>
                <h2>{fase === 'sincamara' ? 'No encontré una cámara' : 'No pude abrir la cámara'}</h2>
                <p className="small">Cierra otras apps que la estén usando (videollamadas) y vuelve a intentar. Si no funciona, prueba con Chrome o Safari actualizados.</p>
                <button className="btn" onClick={() => setCamKey((k) => k + 1)}>Intentar de nuevo</button>
              </div>
            </div>
          )}
          {fase === 'pausa' && (
            <div className="velo">
              <div>
                <h2>En pausa</h2>
                <p className="small">{enPractica ? 'Sigue cuando quieras.' : `Tus ${mias.length} tomas ya están guardadas. Puedes seguir ahora o volver otro día.`}</p>
                <button className="btn grande" onClick={() => setCamKey((k) => k + 1)}>Seguir</button>
              </div>
            </div>
          )}

          {(fase === 'revisar' || fase === 'enviando') && toma && (
            <div className="revisar">
              <Muneco frames={toma.muneco} size={Math.min(250, innerWidth * 0.6)} mirror pausaFinal={10} />
              {toma.ev.ok ? (
                <>
                  <h2 style={{ margin: 0 }}>{enPractica ? '¡Así se hace!' : '¿Quedó bien?'}</h2>
                  {toma.ev.avisos.map((a) => <span key={a} className="chip sol">{a}</span>)}
                  {rapido && !errorEnvio && fase === 'revisar' && <span className="faint">Se envía sola en un momento…</span>}
                </>
              ) : (
                <>
                  <h2 style={{ margin: 0 }}>Repitamos esta</h2>
                  <p className="center small">{toma.ev.motivo}</p>
                </>
              )}
              <Aviso tono="error">{errorEnvio}</Aviso>
            </div>
          )}
          {fase === 'completa' && (
            <div className="revisar celebra">
              <div className="cifra">{tope}/{tope}</div>
              <h2>¡Completaste {sena.texto}!</h2>
              <p className="muted">Gracias: tus tomas ayudan a que Togo entienda a más personas.</p>
            </div>
          )}
          {fase === 'practicada' && (
            <div className="revisar celebra">
              <h2>¡Así de fácil!</h2>
              <p className="muted">Crea tu cuenta para que tus tomas ayuden a entrenar a Togo.</p>
              <a className="btn grande" href="#/colaborar">Crear mi cuenta</a>
            </div>
          )}
        </div>
      </section>

      <div className="controles">
        {fase === 'revisar' || fase === 'enviando' ? (
          <>
            <div className="lado">
              <button className="btn sec" onClick={repetir} disabled={fase === 'enviando'}>↺ Repetir</button>
            </div>
            {toma?.ev.ok && (
              <div className="lado">
                <button className="btn ok grande" onClick={enviar} disabled={fase === 'enviando'}>
                  {fase === 'enviando' ? 'Enviando…' : enPractica ? 'Seguir' : '✓ Enviar'}
                </button>
              </div>
            )}
          </>
        ) : fase === 'completa' ? (
          <>
            <a className="btn" href="#/colaborar">Elegir otra seña</a>
          </>
        ) : (
          <>
            <div className="lado">
              {fase === 'pausa' ? (
                <a className="btn suave" href={salir}>Salir</a>
              ) : (
                <button className="btn suave" onClick={pausar} disabled={!listoParaGrabar}>❚❚ Pausa</button>
              )}
            </div>
            <button
              className={`rec ${fase === 'grabando' ? 'parar' : ''}`}
              onClick={fase === 'cuenta' ? () => setFase('listo') : () => (setGuia(false), contar())}
              disabled={!listoParaGrabar && fase !== 'cuenta'}
              aria-label={fase === 'cuenta' ? 'Cancelar' : 'Grabar'}
            >
              {fase === 'cuenta' ? 'Cancelar' : fase === 'grabando' ? '' : 'Grabar'}
            </button>
            <div className="lado">
              <button className="btn suave" onClick={() => ir(salir)}>Salir</button>
            </div>
          </>
        )}
      </div>

      {toast && (
        <div className="toast" role="status">
          <span>{toast.texto}</span>
          {toast.deshacer && <button className="link" onClick={() => deshacer(toast.deshacer)}>Deshacer</button>}
          <button className="link" aria-label="Cerrar" onClick={() => setToast(null)}>✕</button>
        </div>
      )}
    </div>
  );
}
