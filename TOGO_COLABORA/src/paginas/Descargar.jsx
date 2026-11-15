import { APK_PESO, APK_URL, APK_VERSION, CONTACTO } from '../sitio.js';

/** La app: descarga del APK y cómo instalarlo (todavía no está en Play Store). */
export default function Descargar() {
  return (
    <>
      <section className="banda crema">
        <div className="envoltura dos-columnas">
          <div>
            <span className="antetitulo">La app · Android</span>
            <h1 className="titular">Togo en tu teléfono</h1>
            <p className="entrada">
              Descárgala directo desde aquí mientras llega a Google Play. Es gratis, no pide cuenta y funciona sin internet.
            </p>
            {APK_URL ? (
              <div className="row">
                <a className="btn grande" href={APK_URL} rel="noopener">Descargar Togo</a>
                <span className="muted small">{APK_VERSION} · {APK_PESO}</span>
              </div>
            ) : (
              <div className="aviso sol">
                El enlace de descarga estará aquí muy pronto. Si quieres probarla antes, escríbenos a{' '}
                <a href={`mailto:${CONTACTO}?subject=Quiero%20probar%20Togo`}>{CONTACTO}</a>.
              </div>
            )}
          </div>
          <img className="arte-lateral" src="/togo.png" alt="Togo, el torogoz" />
        </div>
      </section>

      <section className="banda blanca">
        <div className="envoltura estrecha">
          <span className="antetitulo">Instalación</span>
          <h2 className="titulo-seccion">Cómo instalarla, paso a paso</h2>
          <p className="muted">
            Como todavía no viene de la tienda, Android pide un par de permisos extra. Es normal y solo se hace una vez.
          </p>
          <ol className="instalar">
            <li>
              <b>Descarga el archivo.</b> Toca «Descargar Togo». Si el navegador pregunta si quieres conservar el archivo, toca
              «Descargar de todas formas».
            </li>
            <li>
              <b>Ábrelo.</b> Toca la notificación de descarga, o búscalo en la app «Archivos» › «Descargas» (el archivo termina en
              <code>.apk</code>).
            </li>
            <li>
              <b>Permite la instalación.</b> Android te llevará a «Instalar apps desconocidas»: activa el permiso para tu navegador
              (Chrome, por ejemplo) y regresa.
            </li>
            <li>
              <b>Si aparece Play Protect</b> con «App no reconocida», toca «Más detalles» › «Instalar de todas formas». Sale porque
              Togo aún no está en la tienda.
            </li>
            <li>
              <b>Abre Togo</b> y dale permiso a la cámara (para leer señas) y al micrófono (para Dar voz).
            </li>
          </ol>
        </div>
      </section>

      <section className="banda menta">
        <div className="envoltura tres-columnas">
          <div>
            <h3>¿Y la Play Store?</h3>
            <p className="small">
              Está en camino. Antes de publicar, Google pide que un grupo la pruebe durante dos semanas. Si quieres ser parte,
              escríbenos.
            </p>
          </div>
          <div>
            <h3>¿iPhone?</h3>
            <p className="small">Por ahora solo Android. Pero desde un iPhone sí puedes colaborar grabando señas en esta web.</p>
          </div>
          <div>
            <h3>¿Es seguro?</h3>
            <p className="small">
              Togo no pide cuenta, no tiene anuncios y no envía nada: la cámara se procesa dentro del teléfono.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
