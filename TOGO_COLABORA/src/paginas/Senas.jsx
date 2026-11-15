import { useState } from 'react';
import { api, mensaje } from '../api.js';
import { useApp } from '../contexto.js';
import { Aviso, Barra, Cargando, Opciones, Puntos, useCarga, useLocal } from '../componentes/ui.jsx';
import { cola } from '../captura/cola.js';

const GRUPOS = [
  ['senas', 'Señas', (s) => s.tipo === 'sena'],
  ['letras', 'Abecedario', (s) => s.tipo === 'letra' || s.tipo === 'letra_mov'],
  ['especial', 'Especial', (s) => s.tipo === 'nada'],
];

export default function Senas() {
  const { uid, perfil } = useApp();
  const [grupo, setGrupo] = useLocal('togo_grupo', 'senas');
  const [datos, error] = useCarga(() => Promise.all([api.senas(), api.progreso(), api.misTomas(uid).then(async (t) => [...t, ...(await cola.locales(uid))])]), [uid]);
  const [verHechas, setVerHechas] = useState(false);
  const [orden, setOrden] = useLocal('togo_orden', 'necesidad');

  if (error) return <Aviso tono="error">{mensaje(error)}</Aviso>;
  if (!datos) return <Cargando />;
  const [senas, prog, tomas] = datos;
  const mias = {};
  tomas.forEach((t) => t.estado !== 'rechazada' && (mias[t.sena] = (mias[t.sena] || 0) + 1));
  const total = tomas.filter((t) => t.estado !== 'rechazada').length;

  const lista = senas.map((s) => ({
    ...s,
    mias: mias[s.id] || 0,
    global: Number(prog[s.id]?.tomas || 0),
    personas: Number(prog[s.id]?.personas || 0),
  }));
  // La que más falta (y que tú aún no completas) va primero como sugerencia.
  const sugerida = lista
    .filter((s) => s.mias < s.tope_por_persona && s.tipo !== 'nada')
    .sort((a, b) => a.global / a.meta_tomas - b.global / b.meta_tomas || a.orden - b.orden)[0];
  const [, , filtro] = GRUPOS.find((g) => g[0] === grupo) || GRUPOS[0];
  const delGrupo = lista.filter(filtro);
  // Las que más faltan primero: así el dataset queda parejo entre señas.
  const avance = (s) => s.global / s.meta_tomas;
  const pendientes = delGrupo
    .filter((s) => s.mias < s.tope_por_persona)
    .sort((a, b) => (orden === 'necesidad' ? avance(a) - avance(b) || a.orden - b.orden : a.orden - b.orden));
  const hechas = delGrupo.filter((s) => s.mias >= s.tope_por_persona);

  return (
    <div className="col" style={{ gap: 16 }}>
      <div>
        <h1>Hola, {perfil.nombre_publico.split(' ')[0]} 👋</h1>
        <p className="muted" style={{ margin: 0 }}>
          {total ? `Llevas ${total} ${total === 1 ? 'toma' : 'tomas'}. ¡Gracias!` : 'Elige una seña para empezar. Cada una toma unos 5 minutos.'}
        </p>
      </div>

      {sugerida && (
        <a className="card sena row" href={`#/grabar/${sugerida.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="grow">
            <span className="chip ok">Sugerida: es la que más falta</span>
            <h2 style={{ margin: '8px 0 4px' }}>{sugerida.texto}</h2>
            <span className="small muted">{sugerida.mias ? `Vas ${sugerida.mias} de ${sugerida.tope_por_persona}` : `${sugerida.tope_por_persona} tomas · unos 5 minutos`}</span>
          </div>
          <span className="btn">{sugerida.mias ? 'Seguir' : 'Empezar'}</span>
        </a>
      )}

      <div className="tabs opciones">
        {GRUPOS.map(([id, nombre, f]) => (
          <button key={id} className={grupo === id ? 'si' : ''} onClick={() => setGrupo(id)}>
            {nombre} <span className="faint" style={{ color: 'inherit', opacity: 0.7 }}>({lista.filter(f).length})</span>
          </button>
        ))}
      </div>

      <div className="row" style={{ justifyContent: 'flex-end', marginTop: -6 }}>
        <span className="faint">Ordenar:</span>
        <Opciones valor={orden} cambiar={setOrden} opciones={[['necesidad', 'Las que más faltan'], ['normal', 'En orden']]} />
      </div>
      <div className="grid">
        {pendientes.map((s) => <Item key={s.id} s={s} />)}
      </div>
      {!pendientes.length && <Aviso tono="ok">¡Completaste todas las de este grupo! 🎉</Aviso>}
      {hechas.length > 0 && (
        <>
          <button className="link" onClick={() => setVerHechas(!verHechas)}>
            {verHechas ? 'Ocultar' : 'Ver'} las que ya completaste ({hechas.length})
          </button>
          {verHechas && <div className="grid">{hechas.map((s) => <Item key={s.id} s={s} />)}</div>}
        </>
      )}
    </div>
  );
}

function Item({ s }) {
  const hecha = s.mias >= s.tope_por_persona;
  return (
    <button className={`sena-item ${hecha ? 'hecha' : ''}`} onClick={() => (location.hash = `#/grabar/${s.id}`)} disabled={hecha}>
      <div className="ico">
        <b>{s.tipo.startsWith('letra') ? s.texto : s.tipo === 'nada' ? '✋' : s.texto.replace(/[¿¡]/g, '').charAt(0)}</b>
      </div>
      <div className="grow">
        <h3>{s.texto}</h3>
        <Puntos hechas={Math.min(s.mias, s.tope_por_persona)} total={s.tope_por_persona} />
        <div className="faint" style={{ marginTop: 6 }}>
          Entre todos: {s.global}/{s.meta_tomas} · {s.personas} {s.personas === 1 ? 'persona' : 'personas'}
        </div>
        <Barra valor={s.global} max={s.meta_tomas} />
      </div>
    </button>
  );
}
