/**
 * GENERADOR DE MATERIAL DE DIFUSIÓN (imágenes listas para imprimir y publicar)
 *
 *   npm run difusion                                   # con la dirección por defecto
 *   npm run difusion -- --url https://otra.direccion  # si el sitio queda en otra dirección
 *   npm run difusion -- --fuentes C:/ruta/a/fuentes    # carpeta con Fredoka y Nunito (.ttf)
 *
 * Sale en docs/difusion/ (y la vista previa para redes en public/og.png).
 * Cada QR lleva su código ?de=... para saber en el panel qué canal funcionó.
 * Todo se dibuja como SVG con los colores y letras de Togo y se convierte a PNG.
 */
import { Resvg } from '@resvg/resvg-js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import QRCode from 'qrcode';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.resolve(AQUI, '..');
const REPO = path.resolve(WEB, '..');
const SALIDA = path.join(REPO, 'docs', 'difusion');
const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > 0 ? process.argv[i + 1] : d;
};
const URL_SITIO = arg('url', 'https://togo-colabora.vercel.app').replace(/\/$/, '');
const URL_CORTA = URL_SITIO.replace(/^https?:\/\//, '');

const C = { deep: '#0D2B45', teal: '#1E5A6E', seafoam: '#6BA7A0', sky: '#B7D4E6', sand: '#DCC8AA', cream: '#FBF7EE', coral: '#F08A5D', sun: '#F6C453', signSoft: '#E3F0EE', signInk: '#2F6B64', white: '#FFFFFF' };

// ------------------------------------------------ fuentes
function buscarFuentes() {
  const candidatos = [
    arg('fuentes'),
    path.join(REPO, 'TOGO_PANTALLA', 'fuentes'),
    path.join(REPO, 'TOGO_MOVIL', 'node_modules', '@expo-google-fonts', 'fredoka', '600SemiBold'),
    path.join(REPO, 'TOGO_MOVIL', 'node_modules', '@expo-google-fonts', 'nunito', '700Bold'),
    path.join(REPO, 'TOGO_MOVIL', 'node_modules', '@expo-google-fonts', 'nunito', '800ExtraBold'),
  ].filter(Boolean);
  const ttf = candidatos.filter((d) => fs.existsSync(d)).flatMap((d) => fs.readdirSync(d).filter((f) => f.endsWith('.ttf')).map((f) => path.join(d, f)));
  if (!ttf.some((f) => /Fredoka/i.test(f))) console.warn('Aviso: no encontré Fredoka/Nunito (.ttf). Usa --fuentes <carpeta>. Se usarán letras del sistema.');
  return ttf;
}
const FUENTES = buscarFuentes();

function png(svg, archivo, ancho) {
  const r = new Resvg(svg, {
    fitTo: ancho ? { mode: 'width', value: ancho } : { mode: 'original' },
    font: { fontFiles: FUENTES, loadSystemFonts: FUENTES.length === 0, defaultFontFamily: 'Nunito' },
  });
  fs.mkdirSync(path.dirname(archivo), { recursive: true });
  fs.writeFileSync(archivo, r.render().asPng());
  console.log('  ', path.relative(REPO, archivo));
}

// ------------------------------------------------ piezas
const LOGO = `data:image/png;base64,${fs.readFileSync(path.join(WEB, 'public', 'togo.png')).toString('base64')}`;
const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const titulo = (x, y, t, tam, color = C.deep, ancla = 'start') =>
  `<text x="${x}" y="${y}" font-family="Fredoka" font-weight="600" font-size="${tam}" fill="${color}" text-anchor="${ancla}">${esc(t)}</text>`;
const texto = (x, y, t, tam, color = C.deep, peso = 700, ancla = 'start') =>
  `<text x="${x}" y="${y}" font-family="Nunito" font-weight="${peso}" font-size="${tam}" fill="${color}" text-anchor="${ancla}">${esc(t)}</text>`;
const lineas = (x, y, ts, tam, alto, color, peso, ancla) => ts.map((t, i) => texto(x, y + i * alto, t, tam, color, peso, ancla)).join('');

async function qr(x, y, lado, de, fondo = C.white) {
  const s = await QRCode.toString(`${URL_SITIO}/?de=${de}`, { type: 'svg', margin: 0, errorCorrectionLevel: 'M', color: { dark: C.deep, light: '#00000000' } });
  const pad = lado * 0.07;
  return `<rect x="${x - pad}" y="${y - pad}" width="${lado + 2 * pad}" height="${lado + 2 * pad}" rx="${pad * 1.4}" fill="${fondo}"/>` +
    s.replace(/<\?xml[^>]*>/, '').replace('<svg ', `<svg x="${x}" y="${y}" width="${lado}" height="${lado}" `);
}

// El muñeco de Togo haciendo "hola" (un cuadro real del diccionario de la app).
function muneco(cx, cy, escala, cuadro = 22, sena = 'hola') {
  const d = JSON.parse(fs.readFileSync(path.join(WEB, 'public', 'diccionario.json'), 'utf8'));
  const f = (d.senas.find((s) => s.id === sena) || d.senas[0]).frames[cuadro];
  const P = (p) => [cx + p[0] * escala, cy + p[1] * escala];
  const [nariz, ls, rs, le, re, lw, rw, lh, rh] = f.p.map(P);
  const ok = (p, q) => q[0] !== 0 || q[1] !== 0;
  const cadI = ok(lh, f.p[7]) ? lh : P([f.p[1][0] * 0.8, 2.4]);
  const cadD = ok(rh, f.p[8]) ? rh : P([f.p[2][0] * 0.8, 2.4]);
  const w = escala;
  let s = `<path d="M${ls} L${rs} L${cadD} L${cadI} Z" fill="${C.seafoam}" stroke="${C.seafoam}" stroke-width="${0.35 * w}" stroke-linejoin="round"/>`;
  s += `<line x1="${cx}" y1="${cy}" x2="${nariz[0]}" y2="${nariz[1] + 0.25 * w}" stroke="${C.seafoam}" stroke-width="${0.28 * w}"/>`;
  s += `<circle cx="${nariz[0]}" cy="${nariz[1] - 0.05 * w}" r="${0.42 * w}" fill="${C.teal}"/>`;
  for (const [a, b, c, crudo] of [[ls, le, lw, f.p[3]], [rs, re, rw, f.p[4]]]) {
    if (crudo[0] || crudo[1]) s += `<path d="M${a} L${b} L${c}" stroke="${C.teal}" stroke-width="${0.26 * w}" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`;
  }
  const DEDOS = [[0, 1, 2, 3, 4], [0, 5, 6, 7, 8], [9, 10, 11, 12], [13, 14, 15, 16], [0, 17, 18, 19, 20]];
  for (const [mano, color] of [[f.l, C.sand], [f.r, '#EAD8BC']]) {
    if (!mano) continue;
    const m0 = P(mano[0]);
    const pts = mano.map((q) => { const p = P(q); return [m0[0] + (p[0] - m0[0]) * 1.25, m0[1] + (p[1] - m0[1]) * 1.25]; });
    const palma = [0, 5, 9, 13, 17].map((k) => pts[k].join(' ')).join(' L');
    const g = 0.085 * w;
    s += `<path d="M${palma} Z" fill="${C.deep}" opacity="0.35" stroke="${C.deep}" stroke-width="${g * 1.9}" stroke-linejoin="round"/>`;
    for (const c of DEDOS) s += `<path d="${c.map((j, n) => `${n ? 'L' : 'M'}${pts[j].join(' ')}`).join(' ')}" stroke="${C.deep}" opacity="0.35" stroke-width="${g * 1.6}" stroke-linecap="round" fill="none"/>`;
    s += `<path d="M${palma} Z" fill="${color}" stroke="${color}" stroke-width="${g * 1.2}" stroke-linejoin="round"/>`;
    for (const c of DEDOS) s += `<path d="${c.map((j, n) => `${n ? 'L' : 'M'}${pts[j].join(' ')}`).join(' ')}" stroke="${color}" stroke-width="${g}" stroke-linecap="round" fill="none"/>`;
    for (const j of [4, 8, 12, 16, 20]) s += `<circle cx="${pts[j][0]}" cy="${pts[j][1]}" r="${g * 0.55}" fill="${C.coral}"/>`;
  }
  return `<g>${s}</g>`;
}

const marca = (x, y, tam) =>
  `<image href="${LOGO}" x="${x}" y="${y}" width="${tam}" height="${tam}" clip-path="inset(0 round ${tam * 0.22}px)"/>` +
  titulo(x + tam * 1.18, y + tam * 0.72, 'Togo', tam * 0.62);

const svg = (w, h, cuerpo, fondo = C.cream) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="${fondo}"/>${cuerpo}</svg>`;

// ------------------------------------------------ piezas finales
async function main() {
  console.log(`Generando material para ${URL_SITIO}`);

  // Ícono chico para la página (el de 1024 px pesa 275 KB: no hace falta en cada visita).
  for (const n of [128, 180]) png(svg(1024, 1024, `<image href="${LOGO}" width="1024" height="1024"/>`), path.join(WEB, 'public', `togo-${n}.png`), n);

  // 1. Vista previa al compartir el enlace (WhatsApp, Facebook, X): 1200×630.
  png(
    svg(1200, 630,
      `<circle cx="960" cy="330" r="270" fill="${C.signSoft}"/>` + muneco(960, 330, 120) +
      marca(70, 60, 74) +
      titulo(70, 285, 'Enséñale LESSA', 76) + titulo(70, 370, 'a Togo', 76, C.teal) +
      lineas(72, 440, ['Graba señas desde tu teléfono en 5 minutos.', 'Tu video nunca sale de tu teléfono.'], 30, 44, '#4E6577', 700) +
      `<rect x="70" y="520" width="${URL_CORTA.length * 14.2 + 60}" height="58" rx="29" fill="${C.teal}"/>` + texto(100, 559, URL_CORTA, 26, C.white, 800)),
    path.join(WEB, 'public', 'og.png'),
  );

  // 2. Sticker (cuadrado redondeado, 5-6 cm): mascota + QR.
  const sticker = async (de) =>
    svg(1200, 1200,
      `<rect x="20" y="20" width="1160" height="1160" rx="150" fill="${C.cream}" stroke="${C.teal}" stroke-width="16"/>` +
      `<image href="${LOGO}" x="90" y="80" width="240" height="240" clip-path="inset(0 round 54px)"/>` +
      titulo(370, 190, '¿Sabes LESSA?', 92) + titulo(370, 300, 'Enséñale a Togo', 92, C.teal) +
      (await qr(330, 400, 540, de)) +
      `<rect x="150" y="1020" width="900" height="100" rx="50" fill="${C.coral}"/>` +
      texto(600, 1088, 'Escanea y graba en 5 minutos', 52, C.white, 800, 'middle'),
      'transparent');
  png(await sticker('sticker'), path.join(SALIDA, 'sticker.png'), 1200);

  // Hoja A4 a 300 dpi con 12 stickers de 6 × 6 cm (para imprenta o papel adhesivo).
  const mm = 300 / 25.4;
  const lado = 60 * mm;
  const s1 = (await sticker('sticker')).replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
  let hoja = '';
  for (let f = 0; f < 4; f++)
    for (let c = 0; c < 3; c++) {
      const x = 15 * mm + c * (lado + 6 * mm);
      const y = 18 * mm + f * (lado + 6 * mm);
      hoja += `<g transform="translate(${x} ${y}) scale(${lado / 1200})">${s1}</g>`;
    }
  png(svg(Math.round(210 * mm), Math.round(297 * mm), hoja + texto(105 * mm, 290 * mm, 'Corta por el borde · 12 stickers de 6 × 6 cm · QR con ?de=sticker', 30, '#8496A3', 700, 'middle'), C.white), path.join(SALIDA, 'stickers-hoja-A4.png'));

  // 3. Afiche A4 (academias, universidades, murales): 2480 × 3508.
  png(
    svg(2480, 3508,
      `<rect width="2480" height="1500" fill="${C.signSoft}"/>` + muneco(1240, 820, 380) +
      marca(160, 140, 190) +
      titulo(1240, 1780, 'Enséñale LESSA a Togo', 200, C.deep, 'middle') +
      lineas(1240, 1960, ['Togo es una app gratuita que convierte la Lengua de Señas', 'Salvadoreña en voz, sin internet. Para entender a más personas,', 'necesita aprender de muchas manos distintas: las tuyas.'], 70, 100, '#4E6577', 700, 'middle') +
      [['1', 'Escanea el código'], ['2', 'Mira el ejemplo y graba'], ['3', '15 tomas, unos 5 minutos']]
        .map(([n, t], i) => `<circle cx="${300 + i * 0}" cy="${2430 + i * 170}" r="60" fill="${C.sun}"/>` + titulo(300, 2455 + i * 170, n, 80, C.deep, 'middle') + texto(400, 2455 + i * 170, t, 76, C.deep, 800))
        .join('') +
      (await qr(1640, 2320, 640, 'afiche')) +
      `<rect x="160" y="3060" width="2160" height="300" rx="70" fill="${C.teal}"/>` +
      texto(1240, 3190, 'Tu video nunca sale de tu teléfono: solo se envían puntos.', 64, C.white, 800, 'middle') +
      texto(1240, 3290, URL_CORTA, 64, C.sun, 800, 'middle')),
    path.join(SALIDA, 'afiche-A4.png'),
  );

  // 4. Publicaciones cuadradas (Instagram, Facebook) 1080 × 1080.
  const posts = [
    ['¿Sabes LESSA?', 'Enséñale a Togo.', ['Graba señas desde tu teléfono', 'en unos 5 minutos.'], C.signSoft, 'hola', 22],
    ['Tu video', 'no sale de tu teléfono.', ['Tu navegador ve tus manos y solo', 'envía puntos. Nada de imágenes.'], '#E8F1F8', 'como_estas', 20],
    ['Cada mano', 'cuenta.', ['Zurdas, diestras, jóvenes, mayores:', 'Togo aprende de manos distintas.'], '#FDF1D3', 'estoy_bien', 22],
    ['15 tomas.', '5 minutos.', ['Mira el ejemplo, grábate', 'y listo. Puedes pausar cuando quieras.'], C.signSoft, 'si', 18],
  ];
  for (const [i, [t1, t2, sub, fondo, sena, cuadro]] of posts.entries()) {
    png(
      svg(1080, 1080,
        `<rect width="1080" height="1080" fill="${fondo}"/>` + `<circle cx="790" cy="560" r="250" fill="${C.cream}"/>` + muneco(790, 560, 110, cuadro, sena) +
        marca(70, 64, 76) +
        titulo(70, 300, t1, 84) + titulo(70, 395, t2, 84, C.teal) +
        lineas(72, 880, sub, 38, 52, '#4E6577', 700) +
        `<rect x="70" y="960" width="${URL_CORTA.length * 17 + 64}" height="64" rx="32" fill="${C.teal}"/>` + texto(102, 1003, URL_CORTA, 31, C.white, 800)),
      path.join(SALIDA, `post-${i + 1}.png`),
    );
  }

  // 5. Historia (Instagram/WhatsApp) 1080 × 1920 con QR.
  png(
    svg(1080, 1920,
      `<rect width="1080" height="1100" fill="${C.signSoft}"/>` + muneco(540, 640, 200) + marca(70, 90, 90) +
      titulo(540, 1250, 'Ayúdanos a llegar a', 74, C.deep, 'middle') + titulo(540, 1345, '30 personas por seña', 74, C.teal, 'middle') +
      (await qr(390, 1430, 300, 'historia')) +
      texto(540, 1840, URL_CORTA, 40, C.deep, 800, 'middle')),
    path.join(SALIDA, 'historia.png'),
  );
  console.log('Listo.');
}

main();
