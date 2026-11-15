import { useApp } from '../contexto.js';

/** Portada pública: qué es Togo, cómo funciona, por qué y cómo ayudar. */
export default function Portada() {
  const { uid } = useApp();
  return (
    <>
      <section className="banda crema">
        <div className="envoltura portada">
          <div className="portada-texto">
            <span className="antetitulo">Lengua de Señas Salvadoreña · LESSA</span>
            <h1 className="titular">
              Tus manos hablan.
              <br />
              <em>Togo les pone voz.</em>
            </h1>
            <p className="entrada">
              Togo es una app gratuita que traduce LESSA a voz en el teléfono, sin internet. Y lo que se dice en voz alta lo
              muestra en letras grandes, para que la conversación vaya en los dos sentidos.
            </p>
            <div className="row" style={{ marginTop: 22 }}>
              <a className="btn grande" href="#/app">Descargar la app</a>
              <a className="btn sec" href={uid ? '#/colaborar' : '#/colabora'}>Enséñale una seña</a>
            </div>
            <ul className="datos-rapidos">
              <li>Gratis</li>
              <li>Funciona sin internet</li>
              <li>Hecha en El Salvador</li>
            </ul>
          </div>

          <div className="portada-arte" aria-hidden="true">
            <img className="portada-togo" src="/togo.png" alt="" />
            <div className="telefono">
              <div className="telefono-barra"><span /></div>
              <div className="burbuja sena">
                <small>Seña</small>
                Hola, ¿cómo estás?
                <span className="ondas"><i /><i /><i /><i /><i /></span>
              </div>
              <div className="burbuja voz">
                <small>Voz</small>
                ¡Muy bien! ¿Y vos?
              </div>
              <div className="burbuja sena corta">
                <small>Seña</small>
                Mi nombre es A-N-A
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="banda blanca">
        <div className="envoltura">
          <span className="antetitulo">Cómo funciona</span>
          <h2 className="titulo-seccion">Tres modos, una conversación</h2>
          <div className="modos">
            <article className="modo m-sena">
              <b className="modo-num">01</b>
              <h3>Leer señas</h3>
              <p>Apoya el teléfono y haz la seña frente a la cámara. Togo la reconoce y la dice en voz alta.</p>
            </article>
            <article className="modo m-voz">
              <b className="modo-num">02</b>
              <h3>Dar voz</h3>
              <p>Escribe o habla: Togo lo muestra en letras grandes para la persona sorda. Con frases rápidas y urgentes a un toque.</p>
            </article>
            <article className="modo m-dic">
              <b className="modo-num">03</b>
              <h3>Diccionario</h3>
              <p>Cada seña y cada letra con un muñeco animado, en espejo y en cámara lenta. Y la practicas con la cámara.</p>
            </article>
          </div>
        </div>
      </section>

      <section className="banda profunda">
        <div className="envoltura">
          <span className="antetitulo claro">Por qué Togo</span>
          <div className="razones">
            <div>
              <b>Sin internet</b>
              <p>Todo pasa dentro del teléfono: sirve en el bus, en la clínica o donde no hay señal.</p>
            </div>
            <div>
              <b>Tu imagen no se guarda</b>
              <p>Togo solo mira la posición de las manos y el cuerpo. Ningún video sale de tu teléfono.</p>
            </div>
            <div>
              <b>Hecho para LESSA</b>
              <p>No es lengua de señas de otro país traducida: aprende de personas que señan en El Salvador.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="banda menta">
        <div className="envoltura dos-columnas">
          <div>
            <span className="antetitulo">Colabora</span>
            <h2 className="titulo-seccion">Togo aprende de manos reales</h2>
            <p className="entrada">
              Cada persona seña un poco distinto. Por eso Togo necesita ejemplos de muchas personas: sordas, intérpretes,
              familias y estudiantes de LESSA. Con tu teléfono, en unos 5 minutos por seña.
            </p>
            <div className="row">
              <a className="btn" href={uid ? '#/colaborar' : '#/colabora'}>Quiero colaborar</a>
              <a className="btn suave" href="#/practica">Probar sin cuenta</a>
            </div>
          </div>
          <ol className="lista-pasos">
            <li><b>Crea tu cuenta</b> con tu correo y lee el acuerdo.</li>
            <li><b>Mira el ejemplo</b> de la seña.</li>
            <li><b>Grábala</b> unos segundos frente a la cámara.</li>
            <li><b>Listo:</b> tu nombre aparece en los créditos de la app, si quieres.</li>
          </ol>
        </div>
      </section>

      <section className="banda blanca">
        <div className="envoltura estrecha">
          <span className="antetitulo">Preguntas</span>
          <h2 className="titulo-seccion">Lo que más nos preguntan</h2>
          <div className="preguntas">
            <details>
              <summary>¿Cuánto cuesta?</summary>
              <p>Nada. Togo es gratis y no tiene anuncios.</p>
            </details>
            <details>
              <summary>¿Qué señas entiende?</summary>
              <p>
                Empieza con saludos y frases básicas de conversación y el abecedario completo. Cada seña nueva se suma cuando hay
                suficientes ejemplos de personas distintas.
              </p>
            </details>
            <details>
              <summary>¿Funciona en iPhone?</summary>
              <p>La app, por ahora, es solo para Android. La web para colaborar sí funciona en iPhone, Android y computadora.</p>
            </details>
            <details>
              <summary>¿Reemplaza a un intérprete?</summary>
              <p>
                No. Togo ayuda en conversaciones cortas del día a día. Para trámites, salud o justicia, lo correcto es un intérprete
                de LESSA.
              </p>
            </details>
            <details>
              <summary>¿Quién está detrás?</summary>
              <p>
                Un proyecto independiente hecho en El Salvador. Más en <a href="#/proyecto">El proyecto</a>.
              </p>
            </details>
          </div>
        </div>
      </section>
    </>
  );
}
