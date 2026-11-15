import { api } from '../api.js';
import { useApp } from '../contexto.js';
import { Muneco, useDiccionario } from '../componentes/Muneco.jsx';
import { Barra, useCarga } from '../componentes/ui.jsx';

export default function Inicio() {
  const { uid } = useApp();
  const dic = useDiccionario();
  const [datos] = useCarga(() => Promise.all([api.senas(), api.progreso()]), []);
  const [senas, prog] = datos || [[], {}];
  const total = Object.values(prog).reduce((s, p) => s + Number(p.tomas), 0);
  const meta = senas.reduce((s, x) => s + x.meta_tomas, 0);
  const destacadas = senas
    .filter((s) => s.tipo === 'sena')
    .map((s) => ({ ...s, n: Number(prog[s.id]?.tomas || 0) }))
    .slice(0, 6);

  return (
    <>
      <section className="hero">
        <div>
          <h1>Enséñale LESSA a Togo</h1>
          <p className="muted" style={{ fontSize: 18 }}>
            Togo es una app gratuita que convierte la Lengua de Señas Salvadoreña en voz, sin internet. Para entender a más
            personas necesita aprender de muchas manos distintas: <b>las tuyas</b>.
          </p>
          <div className="row" style={{ marginTop: 18 }}>
            <a className="btn grande" href="#/colaborar">{uid ? 'Seguir colaborando' : 'Quiero colaborar'}</a>
            <a className="btn sec" href="#/practica">Probar sin cuenta</a>
          </div>
        </div>
        <div className="muneco-hero">
          {dic?.senas?.hola ? <Muneco frames={dic.senas.hola.frames} fps={dic.fps} size={260} /> : <div style={{ height: 273 }} />}
        </div>
      </section>

      <div className="space" />
      <div className="pasos">
        <div>
          <h3>Crea tu cuenta</h3>
          <p className="muted small">Con tu correo. Lees y aceptas el acuerdo de colaboración.</p>
        </div>
        <div>
          <h3>Mira y graba</h3>
          <p className="muted small">El muñeco te muestra la seña. Tú la haces frente a la cámara un par de segundos.</p>
        </div>
        <div>
          <h3>15 tomas por seña</h3>
          <p className="muted small">Unos 5 minutos. Puedes pausar y seguir otro día: cada toma se guarda al instante.</p>
        </div>
      </div>

      <div className="space" />
      <div className="card sena row" style={{ alignItems: 'flex-start' }}>
        <div style={{ fontSize: 34 }} aria-hidden>🔒</div>
        <div className="grow">
          <h3>Tu video nunca sale de tu teléfono</h3>
          <p className="small" style={{ margin: 0 }}>
            Tu navegador calcula la posición de tu cuerpo y tus manos, y solo se envían esos puntos. No se guarda tu imagen ni tu
            cara. Funciona en Android, iPhone y computadora.
          </p>
        </div>
      </div>

      {datos && (
        <>
          <div className="space" />
          <div className="card">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <h2 style={{ margin: 0 }}>Cómo vamos</h2>
              <span className="muted small">
                <b className="cifra" style={{ fontSize: 26 }}>{total.toLocaleString('es-SV')}</b> de {meta.toLocaleString('es-SV')} tomas
              </span>
            </div>
            <div className="space" />
            <div className="col">
              {destacadas.map((s) => (
                <div key={s.id}>
                  <div className="row small" style={{ justifyContent: 'space-between' }}>
                    <b>{s.texto}</b>
                    <span className="muted">{s.n} / {s.meta_tomas}</span>
                  </div>
                  <Barra valor={s.n} max={s.meta_tomas} />
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );
}
