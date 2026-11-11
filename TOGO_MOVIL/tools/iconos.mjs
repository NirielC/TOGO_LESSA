// Genera el ícono de la app, el ícono adaptable de Android (fondo, figura y
// monocromático), la pantalla de carga, el favicon y el logo con insignia, a partir
// del dibujo de Togo en src/components/togoArte.ts (el mismo que usa la app).
// Usa Google Chrome sin ventana; no instala nada.
//
//   node tools/iconos.mjs            (desde TOGO_MOVIL: escribe en assets/ y docs/logo-togo.png)
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const aqui = dirname(fileURLToPath(import.meta.url));
const assets = join(aqui, '..', 'assets');
const docs = join(aqui, '..', '..', 'docs');
const fuentes = join(aqui, '..', '..', 'TOGO_PANTALLA', 'fuentes');
const temporal = mkdtempSync(join(tmpdir(), 'togo-iconos-'));
const A = await import(pathToFileURL(join(aqui, '..', 'src', 'components', 'togoArte.ts')).href);

const C = { oceanTeal: '#1E5A6E', seafoam: '#6BA7A0', coral: '#F08A5D', cream: '#FBF7EE', cielo: '#CFE3EE', arena: '#E8CF98', gris: '#4E6577' };
let n = 0;
const sfx = () => `_${++n}`;

// Togo colocado por el centro de su cabeza (hx, hy) con escala k.
const CABEZA = [57.5, 34];
const ave = (hx, hy, k, formas, s) =>
  `<g transform="translate(${hx - CABEZA[0] * k} ${hy - CABEZA[1] * k}) scale(${k})">${A.formasSvg(formas, s)}</g>`;

// Silueta para el monocromático: todo negro y el ojo calado (Android usa solo la transparencia).
const negro = (formas) =>
  formas.map((f) => ({
    ...f,
    fill: f.fill && f.fill !== 'none' ? '#000' : f.fill,
    stroke: f.stroke ? '#000' : f.stroke,
    opacity: undefined,
    strokeOpacity: undefined,
    hijos: f.hijos ? negro(f.hijos) : undefined,
  }));
const limpio = (formas) => JSON.parse(JSON.stringify(formas)); // quita los undefined
const silueta = (hx, hy, k, s) => `
  <g transform="translate(${hx - CABEZA[0] * k} ${hy - CABEZA[1] * k}) scale(${k})">
    <mask id="ojo${s}" maskUnits="userSpaceOnUse" x="-50" y="-50" width="200" height="200">
      <rect x="-50" y="-50" width="200" height="200" fill="#fff"/>
      <g transform="rotate(-6 56 46)"><circle cx="63.5" cy="34.8" r="5.6" fill="#000"/><circle cx="64.7" cy="35" r="3.5" fill="#fff"/></g>
    </mask>
    <g mask="url(#ojo${s})">${A.formasSvg(limpio(negro(A.togoCompleto())), s)}</g>
  </g>`;

// Fondo del ícono: arena con luz y circulitos arriba a la derecha (cielo, crema, salvia, coral).
// e < 1 acerca los adornos al centro (ícono adaptable: solo se ve el 66 % central).
const fondo = (S, s, e = 1) => {
  const p = (x) => S / 2 + (x - 0.5) * S * e;
  return `
  <defs><radialGradient id="luz${s}" cx="0.35" cy="0.35" r="0.85"><stop offset="0" stop-color="#F3E3BC"/><stop offset="1" stop-color="#E2C88C"/></radialGradient></defs>
  <rect width="${S}" height="${S}" fill="url(#luz${s})"/>
  <circle cx="${p(0.9)}" cy="${p(0.1)}" r="${S * 0.24 * e}" fill="${C.cielo}"/>
  <circle cx="${p(0.66)}" cy="${p(0.11)}" r="${S * 0.075 * e}" fill="${C.cream}"/>
  <circle cx="${p(0.93)}" cy="${p(0.43)}" r="${S * 0.04 * e}" fill="${C.seafoam}"/>
  <circle cx="${p(0.56)}" cy="${p(0.22)}" r="${S * 0.022 * e}" fill="${C.coral}"/>`;
};

// Retrato: cabeza grande abajo a la izquierda, el pico hacia la derecha, los hombros cortados.
const lugarRetrato = (S, e = 1) => [S / 2 + (0.4 - 0.5) * S * e, S / 2 + (0.53 - 0.5) * S * e, 13.5 * (S / 1024) * e];
const retrato = (S, s, e = 1) => {
  const [x, y, k] = lugarRetrato(S, e);
  return ave(x, y, k, A.togoCompleto(), s);
};

// "Togo" con cada letra en su color (como en la app) y el lema debajo, separado de la g.
const ANCHO = { T: 0.52, o: 0.54, g: 0.54 };
const nombre = (x, y, fs, { lema = true, centro = false } = {}) => {
  const total = A.NOMBRE.reduce((a, { l }) => a + ANCHO[l] * fs + fs * 0.04, 0);
  let cx = centro ? x - total / 2 : x;
  const letras = A.NOMBRE.map(({ l, color, giro, baja }) => {
    const t = `<text x="${cx}" y="${y + baja * fs}" font-family="Fredoka" font-weight="600" font-size="${fs}" fill="${color}" transform="rotate(${giro} ${cx + fs * 0.25} ${y - fs * 0.35})">${l}</text>`;
    cx += ANCHO[l] * fs + fs * 0.04;
    return t;
  }).join('');
  if (!lema) return letras;
  return `${letras}<text x="${centro ? x : x + fs * 0.06}" y="${y + fs * 0.62}" ${centro ? 'text-anchor="middle"' : ''} font-family="Nunito" font-weight="700" font-size="${fs * 0.2}" fill="${C.gris}" letter-spacing="${fs * 0.036}">${A.LEMA.map((t) => t.toUpperCase()).join(' · ')}</text>`;
};

const ASSETS = {
  // Ícono "clásico" (iOS, web y Android antiguo).
  'icon.png': [assets, 1024, 1024, (W, H, s) => fondo(W, s) + retrato(W, s)],
  // Ícono adaptable: el teléfono recorta en círculo/gota y solo se ve el 66 % central;
  // el retrato se encoge a esa zona (lo que sobra se corta solo, como en el ícono normal).
  'android-icon-background.png': [assets, 1024, 1024, (W, H, s) => fondo(W, s, 0.667)],
  'android-icon-foreground.png': [assets, 1024, 1024, (W, H, s) => retrato(W, s, 0.667)],
  // Pantalla de carga: Togo entero y su nombre, sobre el crema de app.json. En Android 12+
  // el sistema recorta esta imagen en un círculo (66 % central): todo va dentro de él.
  'splash-icon.png': [assets, 1024, 1024, (W, H, s) => ave(W / 2 + 7.5 * 3.9, 260 + (CABEZA[1] - 15) * 3.9, 3.9, A.togoCompleto(), s) + nombre(W / 2, 708, 118, { lema: false, centro: true })],
  'favicon.png': [assets, 48, 48, (W, H, s) => fondo(W, s) + retrato(W, s)],
  // Logo con insignia: README, pantalla del monitor, presentaciones.
  'logo-togo.png': [docs, 1200, 440, (W, H, s) => `
    <clipPath id="c${s}"><circle cx="210" cy="220" r="180"/></clipPath>
    <circle cx="210" cy="220" r="180" fill="${C.arena}"/>
    <g clip-path="url(#c${s})">
      <circle cx="330" cy="88" r="72" fill="${C.cielo}"/>
      <circle cx="252" cy="66" r="20" fill="${C.cream}"/>
      ${ave(175, 215, 6.6, A.togoCompleto(), s)}
    </g>
    <circle cx="210" cy="220" r="180" fill="none" stroke="${C.oceanTeal}" stroke-width="9"/>
    ${nombre(440, 262, 230)}`],
};

// Pantalla del monitor: el Togo de TOGO_PANTALLA/index.html, con las clases que anima su CSS
// (respira, ala, cabeza, parpado). Se reemplaza lo que está entre las marcas togo:inicio/fin.
const pantalla = join(aqui, '..', '..', 'TOGO_PANTALLA', 'index.html');
{
  const svg = `<!-- togo:inicio (lo genera TOGO_MOVIL/tools/iconos.mjs desde togoArte.ts) -->
      <svg id="togo-svg" viewBox="0 0 100 100">${A.defsSvg('_p')}
        <g class="respira">${A.formasSvg(A.CUERPO, '_p')}
          <g class="ala">${A.formasSvg(A.ALA, '_p')}</g>
          <g class="cabeza">${A.formasSvg(A.cabeza('attentive', false, false), '_p')}<g transform="rotate(-6 56 46)"><g class="parpado">${A.formasSvg(A.ojo('attentive'), '_p')}</g></g></g>
        </g>
      </svg>
      <!-- togo:fin -->`;
  const html = readFileSync(pantalla, 'utf8');
  const a = html.indexOf('<!-- togo:inicio');
  const b = html.indexOf('<!-- togo:fin -->') + '<!-- togo:fin -->'.length;
  if (a < 0 || b < a) throw new Error('No encontré las marcas togo:inicio/fin en la pantalla del monitor');
  let nuevo = html.slice(0, a) + svg + html.slice(b);
  // Togo en 8 bits (secreto de la pantalla): mismos píxeles que la app.
  nuevo = nuevo
    .replace(/const PIX = \[[^\]]*\];/, `const PIX = ${JSON.stringify(A.PIXEL_A)};`)
    .replace(/const PC = \{[^}]*\};/, `const PC = ${JSON.stringify(A.PIXEL_COLOR)};`);
  if (!nuevo.includes(JSON.stringify(A.PIXEL_A))) throw new Error('No pude poner el Togo de 8 bits en la pantalla del monitor');
  writeFileSync(pantalla, nuevo);
  console.log('listo', 'TOGO_PANTALLA/index.html (Togo)');
}

const CSS = `@font-face { font-family: Fredoka; font-weight: 600; src: url('${pathToFileURL(join(fuentes, 'Fredoka_600SemiBold.ttf')).href}'); }
  @font-face { font-family: Nunito; font-weight: 700; src: url('${pathToFileURL(join(fuentes, 'Nunito_700Bold.ttf')).href}'); }
  html, body { margin: 0; background: transparent; } svg { display: block; }`;

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PUERTO = 9334;
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PUERTO}`, `--user-data-dir=${join(temporal, 'perfil')}`, '--no-first-run', '--allow-file-access-from-files', 'about:blank'], { stdio: 'ignore' });
try {
  let paginas;
  for (let i = 0; i < 50 && !paginas; i++) {
    try { paginas = await (await fetch(`http://127.0.0.1:${PUERTO}/json/list`)).json(); } catch { await espera(200); }
  }
  const ws = new WebSocket(paginas.find((t) => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  let id = 0;
  const pend = new Map();
  ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
  const cdp = (method, params = {}) => new Promise((r) => { const k = ++id; pend.set(k, r); ws.send(JSON.stringify({ id: k, method, params })); });

  await cdp('Page.enable');
  await cdp('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } });
  for (const [archivoPng, [carpeta, W, H, dibujar]] of Object.entries(ASSETS)) {
    const s = sfx();
    const html = `<!doctype html><meta charset="utf-8"><style>${CSS}</style>
      <svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${A.defsSvg(s)}${dibujar(W, H, s)}</svg>
      <script>document.fonts.ready.then(() => { document.title = 'listo'; });</script>`;
    const archivo = join(temporal, `${archivoPng}.html`);
    writeFileSync(archivo, html);
    await cdp('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
    await cdp('Page.navigate', { url: pathToFileURL(archivo).href });
    for (let i = 0; i < 40; i++) {
      const r = await cdp('Runtime.evaluate', { expression: 'document.title' });
      if (r.result?.result?.value === 'listo') break;
      await espera(100);
    }
    await espera(150);
    const r = await cdp('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: W, height: H, scale: 1 } });
    writeFileSync(join(carpeta, archivoPng), Buffer.from(r.result.data, 'base64'));
    console.log('listo', archivoPng, `${W}x${H}`);
  }
  ws.close();
} finally {
  chrome.kill();
  await espera(500);
  rmSync(temporal, { recursive: true, force: true });
}
