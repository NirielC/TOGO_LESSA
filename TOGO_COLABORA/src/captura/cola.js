/**
 * COLA DE ENVÍO SIN INTERNET
 *
 * Si al enviar una toma no hay conexión (o se cae a medias), la toma se guarda
 * en el propio teléfono (IndexedDB) y se reenvía sola: al volver la conexión,
 * al abrir la página otra vez o cada 30 s. La persona no pierde nada ni tiene
 * que repetir. Solo se guardan los puntos comprimidos (~15 KB por toma).
 */
import { api } from '../api.js';

const BD = 'togo-colabora';
const ALMACEN = 'pendientes';
const oyentes = new Set();

function abrir() {
  return new Promise((ok, mal) => {
    const r = indexedDB.open(BD, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(ALMACEN, { keyPath: 'id' });
    r.onsuccess = () => ok(r.result);
    r.onerror = () => mal(r.error);
  });
}

async function operar(modo, fn) {
  const bd = await abrir();
  return new Promise((ok, mal) => {
    const t = bd.transaction(ALMACEN, modo);
    const pedido = fn(t.objectStore(ALMACEN));
    t.oncomplete = () => {
      bd.close();
      ok(pedido?.result);
    };
    t.onerror = () => mal(t.error);
  });
}

const avisar = () => cola.contar().then((n) => oyentes.forEach((f) => f(n))).catch(() => {});

export const cola = {
  /** item: { id, uid, sena, bytes: Uint8Array, meta, creado } */
  async agregar(item) {
    await operar('readwrite', (s) => s.put({ ...item, intentos: 0 }));
    avisar();
  },
  async quitar(id) {
    await operar('readwrite', (s) => s.delete(id));
    avisar();
  },
  async todas() {
    try {
      return (await operar('readonly', (s) => s.getAll())) || [];
    } catch {
      return []; // sin IndexedDB (navegación privada vieja): no hay cola
    }
  },
  async contar() {
    return (await cola.todas()).length;
  },
  /** Las tomas aún no enviadas, con la forma de misTomas(). */
  async locales(uid) {
    return (await cola.todas())
      .filter((x) => x.uid === uid)
      .map((x) => ({ id: x.id, sena: x.sena, estado: 'en_cola', archivo: `${x.uid}/${x.sena}/${x.id}.togo`, local: true }));
  },
  alCambiar(fn) {
    oyentes.add(fn);
    avisar();
    return () => oyentes.delete(fn);
  },
};

/** ¿El error es por falta de conexión (vale la pena reintentar)? */
export function esErrorDeRed(e) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  const m = `${e?.name || ''} ${e?.message || e || ''} ${e?.originalError?.message || ''}`;
  return e instanceof TypeError || /failed to fetch|networkerror|load failed|network request failed|fetch failed|timeout|aborted/i.test(m);
}

const DEFINITIVOS = /tope_alcanzado|sin_consentimiento|sena_inactiva|limite_diario|archivo_ajeno/;
let enCurso = false;

/** Intenta enviar lo pendiente de esta persona. Devuelve cuántas se enviaron. */
export async function procesarCola(uid) {
  if (enCurso || !uid) return 0;
  enCurso = true;
  let enviadas = 0;
  try {
    for (const item of await cola.todas()) {
      if (item.uid !== uid) continue;
      try {
        await api.subirToma(uid, item.sena, item.bytes, item.meta, item.id, true);
        await cola.quitar(item.id);
        enviadas++;
      } catch (e) {
        if (esErrorDeRed(e)) break; // sigue sin conexión: se intenta más tarde
        if (DEFINITIVOS.test(`${e?.message} ${e?.hint}`) || (item.intentos || 0) >= 5) {
          console.warn('Toma descartada de la cola:', e?.message);
          await cola.quitar(item.id);
        } else {
          await operar('readwrite', (s) => s.put({ ...item, intentos: (item.intentos || 0) + 1 }));
        }
      }
    }
  } finally {
    enCurso = false;
  }
  return enviadas;
}
