import { AUTOR, CONTACTO } from '../sitio.js';

/** El proyecto: de dónde viene Togo, cómo trabaja y contacto. */
export default function Proyecto() {
  return (
    <>
      <section className="banda crema">
        <div className="envoltura dos-columnas">
          <div>
            <span className="antetitulo">El proyecto</span>
            <h1 className="titular">Un torogoz que aprende a señar</h1>
            <p className="entrada">
              Togo nace en El Salvador con una idea sencilla: que una persona sorda y una oyente puedan conversar sin papel ni
              intérprete de por medio en las cosas del día a día. Su nombre y su cara vienen del torogoz, el ave nacional.
            </p>
            <p className="muted">
              Lo crea y lo desarrolla <b>{AUTOR}</b>, junto con todas las personas que le enseñan señas desde esta web.
            </p>
          </div>
          <img className="arte-lateral" src="/togo.png" alt="Togo, el torogoz" />
        </div>
      </section>

      <section className="banda blanca">
        <div className="envoltura">
          <span className="antetitulo">Cómo trabajamos</span>
          <h2 className="titulo-seccion">Lo que no cambia</h2>
          <div className="modos">
            <article className="modo m-sena">
              <h3>Con la comunidad</h3>
              <p>La LESSA la definen quienes la usan. Togo aprende de personas que señan y cada toma se revisa antes de usarse.</p>
            </article>
            <article className="modo m-voz">
              <h3>Privado de verdad</h3>
              <p>La app no envía nada. En la web solo se guardan puntos del cuerpo y las manos, nunca tu imagen.</p>
            </article>
            <article className="modo m-dic">
              <h3>Gratis</h3>
              <p>Sin anuncios ni cobros. Quien colabora puede salir en los créditos y pedir su constancia.</p>
            </article>
          </div>
        </div>
      </section>

      <section className="banda profunda">
        <div className="envoltura dos-columnas">
          <div>
            <span className="antetitulo claro">Contacto</span>
            <h2 className="titulo-seccion claro">¿Escuela, asociación o intérprete?</h2>
            <p>
              Si quieres que tu grupo colabore, presentar Togo en tu institución o probar la app antes que nadie, escríbenos.
            </p>
          </div>
          <div className="contacto">
            <a className="btn grande vivo" href={`mailto:${CONTACTO}`}>Escribir a Togo</a>
            <span className="small">{CONTACTO}</span>
            <a className="small claro" href="#/gracias">Ver a quienes ya colaboran →</a>
          </div>
        </div>
      </section>
    </>
  );
}
