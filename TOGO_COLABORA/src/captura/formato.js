/**
 * FORMATO DE UNA TOMA (.togo) — lo lee TOGO_DATASET/tools/sincronizar_web.py
 *
 *   gzip(  "TOGO" | uint32 LE largo del encabezado | encabezado JSON (UTF-8) |
 *          n × 258 int16 LE  )
 *
 * Cada cuadro es el vector CRUDO de togo_features.py (pose 33×4 + mano "Left"
 * 21×3 + mano "Right" 21×3), coordenadas tal cual las da MediaPipe, ×10000.
 * Encabezado: { v, sena, ancho, alto, fps, n, dim, escala, t: [ms desde el
 * primer cuadro], origen }. Los tiempos reales permiten volver a muestrear a
 * 20 fps exactos aunque el teléfono haya ido más lento.
 * Unos 12-16 KB por toma de 2 s.
 */
export const DIM = 258;
export const ESCALA = 10000;

export async function codificar(cuadros, tiempos, meta) {
  const n = cuadros.length;
  let enc = new TextEncoder().encode(JSON.stringify({ v: 1, ...meta, n, dim: DIM, escala: ESCALA, t: tiempos }));
  if (enc.length % 2) {
    const e2 = new Uint8Array(enc.length + 1);
    e2.set(enc);
    e2[enc.length] = 0x20; // espacio: JSON sigue válido y los datos quedan alineados
    enc = e2;
  }
  const buf = new ArrayBuffer(8 + enc.length + n * DIM * 2);
  const u8 = new Uint8Array(buf);
  u8.set([0x54, 0x4f, 0x47, 0x4f], 0); // "TOGO"
  const dv = new DataView(buf);
  dv.setUint32(4, enc.length, true);
  u8.set(enc, 8);
  let o = 8 + enc.length;
  for (const c of cuadros) {
    for (let k = 0; k < DIM; k++) {
      const v = Math.max(-32767, Math.min(32767, Math.round(c[k] * ESCALA)));
      dv.setInt16(o, v, true);
      o += 2;
    }
  }
  return comprimir(u8);
}

async function comprimir(u8) {
  if (typeof CompressionStream === 'undefined') return u8; // navegadores viejos: sin comprimir
  const s = new Blob([u8]).stream().pipeThrough(new CompressionStream('gzip'));
  return new Uint8Array(await new Response(s).arrayBuffer());
}

async function descomprimir(u8) {
  if (u8[0] !== 0x1f || u8[1] !== 0x8b) return u8;
  const s = new Blob([u8]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(s).arrayBuffer());
}

/** -> { meta, cuadros: Float32Array[] } */
export async function decodificar(datos) {
  const u8 = await descomprimir(datos instanceof Uint8Array ? datos : new Uint8Array(datos));
  if (String.fromCharCode(...u8.slice(0, 4)) !== 'TOGO') throw new Error('Archivo de toma inválido');
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  const hl = dv.getUint32(4, true);
  const meta = JSON.parse(new TextDecoder().decode(u8.slice(8, 8 + hl)));
  const cuadros = [];
  let o = 8 + hl;
  for (let i = 0; i < meta.n; i++) {
    const c = new Float32Array(DIM);
    for (let k = 0; k < DIM; k++) {
      c[k] = dv.getInt16(o, true) / ESCALA;
      o += 2;
    }
    cuadros.push(c);
  }
  return { meta, cuadros };
}
