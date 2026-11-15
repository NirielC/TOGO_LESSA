import QRCode from 'qrcode';
import { useEffect, useState } from 'react';

/**
 * QR y enlaces con código de canal (?de=...). Cada academia, afiche o red social
 * lleva su propio código; en Resumen se ve cuántas personas llegaron por cada uno.
 * El plan completo está en docs/difusion/plan-de-difusion.md del repositorio.
 */
const SUGERIDOS = ['sticker', 'afiche', 'instagram', 'facebook', 'tiktok', 'whatsapp', 'historia', 'feria'];
const limpio = (t) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9_-]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

export default function Difusion() {
  const base = `${location.origin}${location.pathname}`.replace(/\/$/, '');
  const [codigo, setCodigo] = useState('academia-');
  const [svg, setSvg] = useState('');
  const [copiado, setCopiado] = useState(false);
  const c = limpio(codigo);
  const enlace = `${base}/?de=${c}`;

  useEffect(() => {
    if (!c) return setSvg('');
    QRCode.toString(enlace, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#0D2B45', light: '#FFFFFF' } }).then(setSvg);
    setCopiado(false);
  }, [enlace, c]);

  async function bajar() {
    const url = await QRCode.toDataURL(enlace, { width: 1200, margin: 2, errorCorrectionLevel: 'M', color: { dark: '#0D2B45', light: '#FFFFFF' } });
    const a = document.createElement('a');
    a.href = url;
    a.download = `togo-qr-${c}.png`;
    a.click();
  }

  const mensaje = `¡Hola! Estamos enseñándole Lengua de Señas Salvadoreña a Togo, una app gratuita que convierte LESSA en voz sin internet. ¿Nos ayudas grabando algunas señas desde tu teléfono? Son unos 5 minutos y tu video nunca sale de tu teléfono: ${enlace}`;

  return (
    <div className="grabar" style={{ gridTemplateColumns: 'minmax(260px, 360px) 1fr' }}>
      <div className="card col" style={{ alignItems: 'center' }}>
        {svg ? <div style={{ width: '100%', maxWidth: 300 }} dangerouslySetInnerHTML={{ __html: svg }} /> : <p className="faint">Escribe un código</p>}
        <button className="btn bloque" onClick={bajar} disabled={!c}>Descargar QR (PNG)</button>
      </div>
      <div className="col">
        <div className="card col">
          <h2>QR y enlace por canal</h2>
          <p className="small muted" style={{ margin: 0 }}>
            Usa un código distinto para cada lugar (una academia, un afiche, una red). En <b>Resumen › ¿Por dónde llegaron?</b> verás cuántas personas
            se unieron por cada uno.
          </p>
          <label className="campo">
            Código del canal
            <input value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="academia-nombre" />
            <span className="ayuda">Minúsculas, números y guiones. Quedará: <b>{c || '…'}</b></span>
          </label>
          <div className="opciones">
            {SUGERIDOS.map((s) => (
              <button key={s} className={c === s ? 'si' : ''} onClick={() => setCodigo(s)}>{s}</button>
            ))}
          </div>
          <input readOnly value={enlace} onFocus={(e) => e.target.select()} />
          <div className="row">
            <button className="btn sec" disabled={!c} onClick={() => navigator.clipboard?.writeText(enlace).then(() => setCopiado(true))}>{copiado ? '¡Copiado!' : 'Copiar enlace'}</button>
            <a className="btn suave" href={`https://wa.me/?text=${encodeURIComponent(mensaje)}`} target="_blank" rel="noreferrer">Compartir por WhatsApp</a>
          </div>
        </div>
        <div className="card alt col">
          <b>Material listo para imprimir y publicar</b>
          <p className="small" style={{ margin: 0 }}>
            En la carpeta <code>docs/difusion/</code> del proyecto: stickers (hoja A4), afiche A4, publicaciones e historia, y el plan de difusión con textos
            para redes, WhatsApp y correos. Si la dirección del sitio cambia, se regeneran con <code>npm run difusion -- --url …</code>.
          </p>
        </div>
      </div>
    </div>
  );
}
