import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { api, DEMO, mensaje } from '../api.js';
import { useApp } from '../contexto.js';
import { decodificar } from '../captura/formato.js';
import { cuadroAMuneco, EjemploAnimado, Muneco, suavizarToma, useDiccionario } from '../componentes/Muneco.jsx';
import { Aviso, Barra, Cargando, ir, Modal, Opciones, useCarga, useLocal } from '../componentes/ui.jsx';

// El QR (librería aparte) se carga solo al abrir Difusión.
const Difusion = lazy(() => import('./Difusion.jsx'));
const MB = 1024 * 1024;
const TIPOS = [
  ['sena', 'Seña'],
  ['letra', 'Letra quieta'],
  ['letra_mov', 'Letra con movimiento'],
  ['nada', 'Sin seña (negativos)'],
];
const ESTADOS = [
  ['revision', 'Por revisar'],
  ['pendiente', 'Sin sincronizar'],
  ['aceptada', 'Aceptadas'],
  ['rechazada', 'Rechazadas'],
];

export default function Admin({ seccion }) {
  const { perfil } = useApp();
  if (!perfil?.es_admin && !perfil?.es_revisor) return <Aviso tono="error">Esta sección es solo para el equipo de Togo.</Aviso>;
  const secciones = perfil.es_admin
    ? [['resumen', 'Resumen'], ['senas', 'Señas'], ['revision', 'Revisión'], ['personas', 'Personas'], ['difusion', 'Difusión']]
    : [['revision', 'Revisión']];
  const actual = secciones.some(([s]) => s === seccion) ? seccion : secciones[0][0];
  return (
    <>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1 style={{ margin: 0 }}>Panel de Togo</h1>
        {DEMO && <span className="chip sol">Demo: datos de ejemplo</span>}
      </div>
      <div className="space" />
      <div className="admin-nav opciones">
        {secciones.map(([s, t]) => (
          <button key={s} className={actual === s ? 'si' : ''} onClick={() => ir(`#/admin/${s}`)}>{t}</button>
        ))}
      </div>
      {actual === 'resumen' && <Resumen />}
      {actual === 'senas' && <SenasAdmin />}
      {actual === 'revision' && <Revision />}
      {actual === 'personas' && <Personas />}
      {actual === 'difusion' && (
        <Suspense fallback={<Cargando />}>
          <Difusion />
        </Suspense>
      )}
    </>
  );
}

// ================================================================ resumen

function Uso({ nombre, usado, limite }) {
  return (
    <div>
      <div className="row small" style={{ justifyContent: 'space-between' }}>
        <b>{nombre}</b>
        <span className="muted">{(usado / MB).toFixed(1)} MB de {(limite / MB).toFixed(0)} MB</span>
      </div>
      <Barra valor={usado} max={limite} />
    </div>
  );
}

function Resumen() {
  const [datos, error] = useCarga(() => Promise.all([api.resumen(), api.senas(), api.progreso()]), []);
  if (error) return <Aviso tono="error">{mensaje(error)}</Aviso>;
  if (!datos) return <Cargando />;
  const [r, senas, prog] = datos;
  const e = r.por_estado || {};
  const kpis = [
    ['Personas', r.personas, `${r.personas_con_tomas} ya grabaron`],
    ['Tomas', r.tomas, `${r.hoy} en las últimas 24 h`],
    ['Por revisar', e.revision || 0, 'dudosas o de señas nuevas'],
    ['Sin sincronizar', r.sin_descargar, 'corre sincronizar_web.py'],
    ['Aceptadas', e.aceptada || 0, `${e.rechazada || 0} rechazadas`],
    ['Menores', r.menores_sin_confirmar, 'esperando a su tutor'],
  ];
  return (
    <div className="col" style={{ gap: 16 }}>
      <div className="kpis">
        {kpis.map(([t, n, sub]) => (
          <div key={t} className="card">
            <span className="faint">{t}</span>
            <div className="cifra">{Number(n).toLocaleString('es-SV')}</div>
            <span className="faint">{sub}</span>
          </div>
        ))}
      </div>

      {r.por_canal && Object.keys(r.por_canal).length > 0 && (
        <div className="card col">
          <h2>¿Por dónde llegaron?</h2>
          <p className="faint" style={{ margin: 0 }}>Según el código <code>?de=</code> del enlace o QR (ver Difusión).</p>
          {Object.entries(r.por_canal).sort((a, b) => b[1] - a[1]).map(([canal, n]) => (
            <div key={canal}>
              <div className="row small" style={{ justifyContent: 'space-between' }}><b>{canal}</b><span className="muted">{n}</span></div>
              <Barra valor={n} max={r.personas} />
            </div>
          ))}
        </div>
      )}

      <div className="card col">
        <h2>Uso del plan gratis de Supabase</h2>
        <Uso nombre="Archivos (tomas + videos de ejemplo)" usado={r.bytes_tomas + r.bytes_ejemplos} limite={1024 * MB} />
        <Uso nombre="Base de datos" usado={r.bytes_base} limite={500 * MB} />
        <p className="faint" style={{ margin: 0 }}>
          Cada toma pesa unos 15 KB. Para liberar espacio: <code>python tools/sincronizar_web.py --borrar-archivos</code> baja las
          tomas a tu PC y borra los archivos de Supabase ya revisados. La salida de datos (5 GB/mes) la usan sobre todo los videos de
          ejemplo: mantenlos cortos y livianos.
        </p>
      </div>

      <div className="card">
        <h2>Avance por seña</h2>
        <div className="desliza">
          <table className="tabla">
            <thead>
              <tr><th>Seña</th><th>Tomas</th><th>Personas</th><th>Aceptadas</th><th style={{ minWidth: 140 }}>Avance</th></tr>
            </thead>
            <tbody>
              {senas.map((s) => {
                const p = prog[s.id] || { tomas: 0, personas: 0, aceptadas: 0 };
                return (
                  <tr key={s.id}>
                    <td><b>{s.texto}</b> {!s.activa && <span className="chip">inactiva</span>} {s.nueva && <span className="chip sol">nueva</span>}</td>
                    <td>{p.tomas} / {s.meta_tomas}</td>
                    <td>{p.personas} / {s.meta_personas}</td>
                    <td>{p.aceptadas}</td>
                    <td><Barra valor={Number(p.tomas)} max={s.meta_tomas} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ================================================================ señas

const VACIA = { id: '', tipo: 'sena', texto: '', descripcion: '', categoria: '', duracion_s: 2.0, meta_tomas: 400, meta_personas: 30, tope_por_persona: 15, activa: true, nueva: true, orden: 500, video_ejemplo: null };

const slug = (t) =>
  t.toLowerCase().normalize('NFD').replace(/ñ/g, 'n').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40);

function SenasAdmin() {
  const [senas, error, recargar] = useCarga(() => api.senas(), []);
  const [editar, setEditar] = useState(null);
  if (error) return <Aviso tono="error">{mensaje(error)}</Aviso>;
  if (!senas) return <Cargando />;
  return (
    <div className="col">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <p className="muted" style={{ margin: 0 }}>
          Las señas <b>activas</b> se muestran a los voluntarios. Marca como <b>nueva</b> la que el modelo aún no conoce: todas sus tomas
          pasan por revisión.
        </p>
        <button className="btn" onClick={() => setEditar({ ...VACIA })}>+ Nueva seña</button>
      </div>
      <div className="desliza">
        <table className="tabla">
          <thead>
            <tr><th>Orden</th><th>Seña</th><th>Tipo</th><th>Duración</th><th>Meta</th><th>Ejemplo</th><th>Estado</th><th /></tr>
          </thead>
          <tbody>
            {senas.map((s) => (
              <tr key={s.id}>
                <td>{s.orden}</td>
                <td><b>{s.texto}</b><div className="faint">{s.id}</div></td>
                <td>{TIPOS.find((t) => t[0] === s.tipo)?.[1]}</td>
                <td>{Number(s.duracion_s).toFixed(1)} s</td>
                <td className="small">{s.meta_tomas} tomas · {s.meta_personas} pers. · {s.tope_por_persona}/pers.</td>
                <td>{s.video_ejemplo ? <span className="chip ok">video</span> : <span className="faint">—</span>}</td>
                <td>
                  {s.activa ? <span className="chip ok">activa</span> : <span className="chip">inactiva</span>}{' '}
                  {s.nueva && <span className="chip sol">nueva</span>}
                </td>
                <td><button className="btn chico sec" onClick={() => setEditar({ ...s })}>Editar</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editar && (
        <EditorSena
          inicial={editar}
          esNueva={!senas.some((s) => s.id === editar.id) || !editar.id}
          cerrar={(cambio) => {
            setEditar(null);
            if (cambio) recargar();
          }}
        />
      )}
    </div>
  );
}

function EditorSena({ inicial, esNueva: esNuevaAl, cerrar: cerrarModal }) {
  const [s, setS] = useState(inicial);
  const [esNueva, setEsNueva] = useState(esNuevaAl);
  const [cambio, setCambio] = useState(false);
  const cerrar = (c) => cerrarModal(c || cambio);
  const [msg, setMsg] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [borrar, setBorrar] = useState('');
  const dic = useDiccionario();
  const cambiar = (k) => (e) => {
    const v = e.target.type === 'checkbox' ? e.target.checked : e.target.type === 'number' ? Number(e.target.value) : e.target.value;
    setS((x) => ({ ...x, [k]: v, ...(k === 'texto' && esNueva ? { id: slug(v) } : {}) }));
  };

  async function guardar(e) {
    e.preventDefault();
    setOcupado(true);
    setMsg(null);
    try {
      const datos = { ...s, descripcion: s.descripcion?.trim() || null, categoria: s.categoria?.trim() || null };
      setS(await api.guardarSena(datos, esNueva));
      if (esNueva) {
        // Se queda abierta para subir su video de ejemplo.
        setEsNueva(false);
        setCambio(true);
        setMsg(null);
        setOcupado(false);
        return;
      }
      cerrar(true);
    } catch (err) {
      setMsg(mensaje(err));
      setOcupado(false);
    }
  }

  async function video(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (esNueva) return setMsg('Primero guarda la seña y luego sube su video.');
    if (f.size > 15 * MB) return setMsg('El video pesa más de 15 MB. Recórtalo o bájale la calidad (con 720p y 5-10 s basta).');
    setOcupado(true);
    try {
      setS(await api.subirEjemplo(s, f));
      setCambio(true);
      setMsg(null);
    } catch (err) {
      setMsg(mensaje(err));
    } finally {
      setOcupado(false);
    }
  }

  async function eliminar() {
    setOcupado(true);
    try {
      await api.borrarSena(s.id);
      cerrar(true);
    } catch (err) {
      setMsg(mensaje(err));
      setOcupado(false);
    }
  }

  const urlVideo = s.video_ejemplo ? api.urlEjemplo(s.video_ejemplo) : null;
  return (
    <Modal cerrar={() => cerrar(false)}>
      <form className="col" onSubmit={guardar}>
        <h2>{esNueva ? 'Nueva seña' : `Editar: ${inicial.texto}`}</h2>
        <label className="campo">Texto (como se muestra y se dice)<input required value={s.texto} maxLength={60} onChange={cambiar('texto')} /></label>
        <label className="campo">
          Identificador
          <input required value={s.id} pattern="[a-z0-9_]{1,40}" disabled={!esNueva} onChange={cambiar('id')} />
          <span className="ayuda">Minúsculas, números y _. Es el nombre de la carpeta del dataset y de la etiqueta del modelo: no cambia después.</span>
        </label>
        <div className="row">
          <label className="campo grow">Tipo
            <select value={s.tipo} onChange={cambiar('tipo')}>{TIPOS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>
          </label>
          <label className="campo grow">Categoría<input value={s.categoria || ''} onChange={cambiar('categoria')} placeholder="Saludos, Familia…" /></label>
        </div>
        <label className="campo">Cómo se hace (lo leen los voluntarios)<textarea maxLength={600} value={s.descripcion || ''} onChange={cambiar('descripcion')} /></label>
        <div className="row">
          <label className="campo grow">Duración (s)<input type="number" min={0.8} max={5} step={0.1} value={s.duracion_s} onChange={cambiar('duracion_s')} /></label>
          <label className="campo grow">Orden<input type="number" value={s.orden} onChange={cambiar('orden')} /></label>
        </div>
        <div className="row">
          <label className="campo grow">Meta de tomas<input type="number" min={1} value={s.meta_tomas} onChange={cambiar('meta_tomas')} /></label>
          <label className="campo grow">Meta de personas<input type="number" min={1} value={s.meta_personas} onChange={cambiar('meta_personas')} /></label>
          <label className="campo grow">Tope por persona<input type="number" min={1} max={100} value={s.tope_por_persona} onChange={cambiar('tope_por_persona')} /></label>
        </div>
        <label className="check"><input type="checkbox" checked={s.activa} onChange={cambiar('activa')} /><span>Activa (los voluntarios la ven)</span></label>
        <label className="check"><input type="checkbox" checked={s.nueva} onChange={cambiar('nueva')} /><span>Nueva: el modelo aún no la conoce, todas sus tomas van a revisión</span></label>

        <div className="card alt col">
          <b>Ejemplo</b>
          <div className="row" style={{ alignItems: 'flex-start' }}>
            {urlVideo ? <video src={urlVideo} controls muted playsInline style={{ maxWidth: 220, borderRadius: 12 }} /> : <EjemploAnimado sena={s} dic={dic} size={120} />}
            <div className="col grow" style={{ gap: 8 }}>
              <span className="faint">
                {urlVideo ? 'Video de ejemplo cargado.' : dic?.senas?.[s.id] ? 'Usa la animación del diccionario de la app.' : 'Sin ejemplo: sube un video corto (5-10 s, 720p, menos de 15 MB).'}
              </span>
              <input type="file" accept="video/*,image/*" onChange={video} disabled={ocupado} />
              {urlVideo && <button type="button" className="btn chico suave" onClick={async () => setS(await api.quitarEjemplo(s))}>Quitar video</button>}
            </div>
          </div>
        </div>

        <Aviso tono="error">{msg}</Aviso>
        <div className="row">
          <button className="btn" disabled={ocupado || !s.id || !s.texto}>{ocupado ? 'Guardando…' : 'Guardar'}</button>
          <button type="button" className="btn suave" onClick={() => cerrar(false)}>Cancelar</button>
        </div>
        {!esNueva && (
          <details>
            <summary className="faint" style={{ cursor: 'pointer' }}>Borrar seña</summary>
            <p className="small">Borra la seña <b>y todas sus tomas</b> del servidor. Normalmente basta con desactivarla. Escribe <b>{s.id}</b> para confirmar.</p>
            <div className="row">
              <input value={borrar} onChange={(e) => setBorrar(e.target.value)} style={{ maxWidth: 240 }} />
              <button type="button" className="btn peligro chico" disabled={borrar !== s.id || ocupado} onClick={eliminar}>Borrar para siempre</button>
            </div>
          </details>
        )}
      </form>
    </Modal>
  );
}

// ================================================================ revisión

function Revision() {
  const dic = useDiccionario();
  const [senas, , recargarSenas] = useCarga(() => api.senas(), []);
  const [filtro, setFiltro] = useState({ sena: '', estado: 'revision' });
  const [aviso, setAviso] = useState(null);
  const [cola, setCola] = useState(null);
  const [i, setI] = useState(0);
  const [toma, setToma] = useState(null);
  const [nota, setNota] = useState('');
  const [espejo, setEspejo] = useState(true);
  const [error, setError] = useState(null);
  const [vista, setVista] = useLocal('togo_vista_revision', 'cuadricula');

  const cargar = useCallback(() => {
    setCola(null);
    setI(0);
    api.tomas({ sena: filtro.sena || null, estado: filtro.estado, limite: 40 }).then(setCola).catch((e) => setError(mensaje(e)));
  }, [filtro]);
  useEffect(cargar, [cargar]);

  const actual = cola?.filas[i];
  useEffect(() => {
    setToma(null);
    setNota(actual?.nota || '');
    setAviso(null);
    if (!actual) return;
    if (actual.archivo_borrado) return setToma({ borrada: true });
    let vivo = true;
    api
      .bajarToma(actual.archivo)
      .then(decodificar)
      .then(({ meta, cuadros }) => vivo && setToma({ meta, frames: suavizarToma(cuadros.map((c) => cuadroAMuneco(c, meta.ancho, meta.alto))) }))
      .catch((e) => vivo && setToma({ error: mensaje(e) }));
    return () => (vivo = false);
  }, [actual]);

  // Una sola toma buena basta para tener el muñeco de ejemplo de una seña nueva.
  const usarDeEjemplo = async (frames) => {
    const redondo = (v) => (Array.isArray(v) ? v.map(redondo) : typeof v === 'number' ? Math.round(v * 1000) / 1000 : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, redondo(x)])) : v);
    try {
      await api.ejemploMuneco(actual.sena, { fps: Math.round(Number(actual.fps) || 20), frames: redondo(frames) });
      setAviso('Listo: esta toma es ahora el ejemplo de la seña.');
      recargarSenas();
    } catch (e) {
      setAviso(mensaje(e));
    }
  };

  const decidir = useCallback(
    async (estado) => {
      if (!actual) return;
      try {
        await api.revisar(actual.id, estado, nota.trim());
        setI((x) => x + 1);
      } catch (e) {
        setError(mensaje(e));
      }
    },
    [actual, nota],
  );

  useEffect(() => {
    const f = (e) => {
      if (e.target.closest?.('input, textarea, select') || vista !== 'una') return;
      const k = e.key.toLowerCase();
      if (k === 'a') decidir('aceptada');
      else if (k === 'r') decidir('rechazada');
      else if (k === 's' || e.key === 'ArrowRight') setI((x) => x + 1);
      else if (e.key === 'ArrowLeft') setI((x) => Math.max(0, x - 1));
    };
    addEventListener('keydown', f);
    return () => removeEventListener('keydown', f);
  }, [decidir, vista]);

  const sena = senas?.find((s) => s.id === actual?.sena);
  const urlVideo = sena?.video_ejemplo ? api.urlEjemplo(sena.video_ejemplo) : null;

  return (
    <div className="col">
      <div className="row">
        <select value={filtro.estado} onChange={(e) => setFiltro({ ...filtro, estado: e.target.value })} style={{ maxWidth: 220 }}>
          {ESTADOS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
        </select>
        <select value={filtro.sena} onChange={(e) => setFiltro({ ...filtro, sena: e.target.value })} style={{ maxWidth: 260 }}>
          <option value="">Todas las señas</option>
          {senas?.map((s) => <option key={s.id} value={s.id}>{s.texto}</option>)}
        </select>
        <button className="btn chico suave" onClick={cargar}>Actualizar</button>
        <Opciones valor={vista} cambiar={setVista} opciones={[['cuadricula', 'Cuadrícula'], ['una', 'Una por una']]} />
        {cola && vista === 'una' && <span className="faint">{Math.min(i + 1, cola.total)} de {cola.total}</span>}
      </div>
      <Aviso tono="error">{error}</Aviso>
      {vista === 'cuadricula' ? (
        <Cuadricula filtro={filtro} senas={senas} dic={dic} alTerminar={cargar} />
      ) : !cola ? (
        <Cargando />
      ) : !actual ? (
        <div className="card sena center">
          <h2>{i > 0 ? '¡Terminaste esta tanda!' : 'No hay tomas aquí'}</h2>
          {i > 0 && <button className="btn" onClick={cargar}>Cargar más</button>}
        </div>
      ) : (
        <>
          <div className="revision">
            <div className="card col" style={{ alignItems: 'center' }}>
              <span className="faint">La toma · {actual.perfiles?.nombre_publico} (persona {1000 + (actual.perfiles?.numero || 0)})</span>
              {!toma ? <Cargando texto="Bajando la toma…" /> : toma.borrada ? <Aviso>El archivo ya se bajó a la PC y se borró de Supabase.</Aviso> : toma.error ? <Aviso tono="error">{toma.error}</Aviso> : <Muneco frames={toma.frames} size={280} mirror={espejo} pausaFinal={12} />}
              <div className="row">
                <button className="btn chico suave" onClick={() => setEspejo(!espejo)}>{espejo ? 'Ver de frente' : 'Ver como espejo'}</button>
                {toma?.frames && (
                  <button className="btn chico sec" onClick={() => usarDeEjemplo(toma.frames)} title="El muñeco de esta toma será el ejemplo que ven todos al grabar esta seña">
                    Usar de ejemplo
                  </button>
                )}
              </div>
              {aviso && <span className="small muted">{aviso}</span>}
            </div>
            <div className="card col" style={{ alignItems: 'center' }}>
              <span className="faint">Cómo debería verse</span>
              <h2 style={{ margin: 0 }}>{sena?.texto || actual.sena}</h2>
              {urlVideo ? <video src={urlVideo} autoPlay loop muted playsInline style={{ maxWidth: 300, borderRadius: 12 }} /> : <EjemploAnimado sena={sena} dic={dic} size={240} mirror={espejo} />}
              {sena?.descripcion && <p className="small muted center">{sena.descripcion}</p>}
            </div>
          </div>
          <div className="card col">
            <div className="row small">
              <span className="chip">{new Date(actual.creado).toLocaleString('es-SV')}</span>
              <span className="chip">{actual.cuadros} cuadros · {Number(actual.fps).toFixed(0)} fps</span>
              {actual.calidad && <span className="chip">manos {Math.round(actual.calidad.manos * 100)}% · luz {actual.calidad.luz}</span>}
              {actual.modelo_top && (
                <span className="chip sol">Modelo: {actual.modelo_top.map(([e, p]) => `${e} ${Math.round(p * 100)}%`).join(' · ')}</span>
              )}
              {actual.calidad?.avisos?.map((a) => <span key={a} className="chip">{a}</span>)}
            </div>
            <input placeholder="Nota (opcional, la ve el equipo)" value={nota} maxLength={300} onChange={(e) => setNota(e.target.value)} />
            <div className="row">
              <button className="btn ok grande" onClick={() => decidir('aceptada')}>✓ Aceptar <span className="faint" style={{ color: 'inherit' }}>(A)</span></button>
              <button className="btn peligro grande" onClick={() => decidir('rechazada')}>✗ Rechazar <span className="faint" style={{ color: 'inherit' }}>(R)</span></button>
              <button className="btn suave" onClick={() => setI(i + 1)}>Saltar (S)</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Revisión por lotes: hasta 24 tomas a la vez, todas animadas. Vienen marcadas
 * para ACEPTAR; se tocan las que están mal y un solo botón decide todo el lote.
 * (Así trabajan las plataformas de validación colectiva: comparar muchas
 * rápido contra el ejemplo es más fácil que juzgar una sola.)
 */
function Cuadricula({ filtro, senas, dic, alTerminar }) {
  const [lote, setLote] = useState(null);
  const [total, setTotal] = useState(0);
  const [malas, setMalas] = useState(() => new Set());
  const [ocupado, setOcupado] = useState(false);
  const [msg, setMsg] = useState(null);
  const [vuelta, setVuelta] = useState(0);
  const [espejo, setEspejo] = useState(true);

  useEffect(() => {
    let vivo = true;
    setLote(null);
    setMalas(new Set());
    setMsg(null);
    (async () => {
      const { filas, total } = await api.tomas({ sena: filtro.sena || null, estado: filtro.estado, limite: 24 });
      const items = filas.map((t) => ({ t, frames: null, error: null }));
      if (!vivo) return;
      setTotal(total);
      setLote(items);
      for (let k = 0; k < items.length; k += 4) {
        await Promise.all(
          items.slice(k, k + 4).map(async (it) => {
            if (it.t.archivo_borrado) return void (it.error = 'Ya se bajó a la PC');
            try {
              const { meta, cuadros } = await decodificar(await api.bajarToma(it.t.archivo));
              it.frames = suavizarToma(cuadros.map((c) => cuadroAMuneco(c, meta.ancho, meta.alto)));
            } catch (e) {
              it.error = mensaje(e);
            }
          }),
        );
        if (!vivo) return;
        setLote([...items]);
      }
    })().catch((e) => vivo && setMsg(mensaje(e)));
    return () => (vivo = false);
  }, [filtro, vuelta]);

  const alternar = (id) =>
    setMalas((m) => {
      const n = new Set(m);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  async function aplicar() {
    setOcupado(true);
    setMsg(null);
    try {
      for (const it of lote) {
        if (it.error || !it.frames) continue;
        await api.revisar(it.t.id, malas.has(it.t.id) ? 'rechazada' : 'aceptada');
      }
      setVuelta((v) => v + 1);
      alTerminar?.();
    } catch (e) {
      setMsg(mensaje(e));
    } finally {
      setOcupado(false);
    }
  }

  if (!lote) return <Cargando texto="Trayendo tomas…" />;
  if (!lote.length)
    return (
      <div className="card sena center">
        <h2>No hay tomas aquí</h2>
        <p className="muted">Cambia el filtro o vuelve más tarde.</p>
      </div>
    );
  const sena = filtro.sena && senas?.find((s) => s.id === filtro.sena);
  const listas = lote.filter((it) => it.frames || it.error).length;
  const validas = lote.filter((it) => it.frames).length;
  const nMalas = lote.filter((it) => it.frames && malas.has(it.t.id)).length;
  return (
    <div className="col">
      <div className="card sena row" style={{ alignItems: 'center' }}>
        {sena && <EjemploAnimado sena={sena} dic={dic} size={120} mirror={espejo} />}
        <div className="grow">
          <h3 style={{ margin: 0 }}>{sena ? `Así se ve «${sena.texto}»` : 'Varias señas a la vez'}</h3>
          <p className="small" style={{ margin: '4px 0 8px' }}>
            Todas vienen marcadas para <b>aceptar</b>. Toca las que estén mal (otra seña, incompletas, sin manos) y luego el botón de abajo.
            {!sena && ' Consejo: elige una seña en el filtro para comparar contra su ejemplo.'}
          </p>
          <button className="btn chico suave" onClick={() => setEspejo(!espejo)}>{espejo ? 'Ver de frente' : 'Ver como espejo'}</button>
        </div>
        <span className="faint">Mostrando {lote.length} de {total}</span>
      </div>
      <div className="grid chica">
        {lote.map(({ t, frames, error }) => (
          <button
            key={t.id}
            className={`toma-celda ${malas.has(t.id) ? 'mala' : ''}`}
            onClick={() => frames && alternar(t.id)}
            aria-pressed={malas.has(t.id)}
            aria-label={`Toma de ${t.perfiles?.nombre_publico || 'una persona'}: ${malas.has(t.id) ? 'marcada para rechazar' : 'se acepta'}`}
          >
            {malas.has(t.id) && <span className="marca-mala">✗ Rechazar</span>}
            {frames ? <Muneco frames={frames} size={140} mirror={espejo} pausaFinal={10} /> : error ? <span className="faint">{error}</span> : <div className="giro" />}
            <span className="faint">
              {!filtro.sena && <b>{senas?.find((s) => s.id === t.sena)?.texto || t.sena} · </b>}p{1000 + (t.perfiles?.numero || 0)}
              {t.modelo_top?.[0] && ` · modelo: ${t.modelo_top[0][0]}`}
            </span>
          </button>
        ))}
      </div>
      <Aviso tono="error">{msg}</Aviso>
      <div className="controles">
        <button className="btn ok grande" disabled={ocupado || listas < lote.length || !validas} onClick={aplicar}>
          {ocupado ? 'Guardando…' : listas < lote.length ? 'Cargando tomas…' : `Aceptar ${validas - nMalas} · Rechazar ${nMalas}`}
        </button>
      </div>
    </div>
  );
}

// ================================================================ personas

function Personas() {
  const { uid } = useApp();
  const [lista, error, recargar] = useCarga(() => api.personas(), []);
  const [msg, setMsg] = useState(null);
  if (error) return <Aviso tono="error">{mensaje(error)}</Aviso>;
  if (!lista) return <Cargando />;
  const rol = async (p, revisor, admin) => {
    if (admin && !p.es_admin && !confirm(`¿Dar acceso de ADMINISTRADOR a ${p.nombre}? Podrá cambiar señas y ver datos de todas las personas.`)) return;
    try {
      await api.asignarRol(p.id, revisor, admin);
      setMsg(null);
      recargar();
    } catch (e) {
      setMsg(mensaje(e));
    }
  };
  return (
    <div className="col">
      <p className="muted" style={{ margin: 0 }}>
        Los <b>revisores</b> (por ejemplo, intérpretes o personas sordas de confianza) solo ven la sección de revisión. El número de persona
        es el que lleva su carpeta en el dataset (p1001, p1002…).
      </p>
      <Aviso tono="error">{msg}</Aviso>
      <div className="desliza">
        <table className="tabla">
          <thead>
            <tr><th>#</th><th>Persona</th><th>Correo</th><th>Tomas</th><th>Perfil</th><th>Revisor</th><th>Admin</th></tr>
          </thead>
          <tbody>
            {lista.map((p) => (
              <tr key={p.id}>
                <td>p{1000 + p.numero}</td>
                <td>
                  <b>{p.nombre}</b>
                  {p.es_menor && <div>{p.tutor_confirmado ? <span className="chip ok">menor · tutor ✓</span> : <span className="chip sol">menor · sin tutor</span>}</div>}
                </td>
                <td className="small">{p.correo}</td>
                <td className="small">{p.tomas} <span className="faint">({p.aceptadas} ✓ · {p.rechazadas} ✗)</span></td>
                <td className="small">{[p.relacion, p.mano].filter(Boolean).join(' · ') || '—'}</td>
                <td><input type="checkbox" checked={p.es_revisor} onChange={(e) => rol(p, e.target.checked, p.es_admin)} /></td>
                <td><input type="checkbox" checked={p.es_admin} disabled={p.id === uid} onChange={(e) => rol(p, p.es_revisor, e.target.checked)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
