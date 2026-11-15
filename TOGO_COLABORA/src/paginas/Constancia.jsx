import { api } from '../api.js';
import { useApp } from '../contexto.js';
import { Cargando, useCarga } from '../componentes/ui.jsx';

/**
 * Constancia de colaboración para imprimir o guardar como PDF (Imprimir > Guardar como PDF).
 * Es un agradecimiento del proyecto, no un documento oficial: si una universidad la pide
 * para horas sociales, el proyecto la firma aparte.
 */
export default function Constancia() {
  const { uid, perfil } = useApp();
  const [datos] = useCarga(() => Promise.all([api.misTomas(uid), api.senas()]), [uid]);
  if (!datos) return <Cargando />;
  const [tomas, senas] = datos;
  const validas = tomas.filter((t) => t.estado !== 'rechazada');
  const nombres = [...new Set(validas.map((t) => t.sena))].map((id) => senas.find((s) => s.id === id)?.texto || id);
  const fechas = validas.map((t) => new Date(t.creado)).sort((a, b) => a - b);
  const f = (d) => d.toLocaleDateString('es-SV', { day: 'numeric', month: 'long', year: 'numeric' });

  if (validas.length < 15)
    return (
      <div className="card sena center" style={{ maxWidth: 560, margin: '0 auto' }}>
        <h2>Tu constancia te espera</h2>
        <p>Se activa al completar al menos una seña (15 tomas). Llevas {validas.length}.</p>
        <a className="btn" href="#/colaborar">Seguir colaborando</a>
      </div>
    );

  return (
    <div className="col" style={{ maxWidth: 820, margin: '0 auto' }}>
      <div className="row no-imprimir" style={{ justifyContent: 'space-between' }}>
        <a href="#/cuenta">← Mi cuenta</a>
        <button className="btn" onClick={() => print()}>Imprimir o guardar PDF</button>
      </div>
      <article className="constancia">
        <header className="row" style={{ gap: 14 }}>
          <img src="/togo-128.png" alt="" width="64" height="64" style={{ borderRadius: 16 }} />
          <div>
            <b style={{ font: '600 28px var(--title)' }}>Togo</b>
            <div className="faint">Lengua de Señas Salvadoreña a voz, sin internet</div>
          </div>
        </header>
        <h1>Constancia de colaboración</h1>
        <p className="grande">
          Se agradece a <b>{perfil.nombre_publico}</b> por enseñarle Lengua de Señas Salvadoreña (LESSA) a Togo, aportando{' '}
          <b>{validas.length} tomas</b> de <b>{nombres.length} {nombres.length === 1 ? 'seña' : 'señas'}</b>
          {fechas.length > 0 &&
            (f(fechas[0]) === f(fechas[fechas.length - 1]) ? (
              <> el {f(fechas[0])}</>
            ) : (
              <> entre el {f(fechas[0])} y el {f(fechas[fechas.length - 1])}</>
            ))}
          .
        </p>
        <p>Señas aportadas: {nombres.join(', ')}.</p>
        <p className="muted">
          Cada toma ayuda a que Togo reconozca mejor la LESSA de personas distintas y acerque la comunicación entre personas sordas y oyentes en El Salvador.
        </p>
        <footer className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <span className="faint">Emitida el {f(new Date())} · Persona colaboradora p{1000 + (perfil.numero || 0)}</span>
          <span className="firma">Equipo de Togo</span>
        </footer>
      </article>
    </div>
  );
}
