/**
 * Todo lo que la web pide a Supabase pasa por aquí.
 * Con ?demo en la dirección (o sin configuración) funciona sin internet con
 * datos de ejemplo en memoria: sirve para ver la interfaz y para presentar.
 */
import { createClient } from '@supabase/supabase-js';
import { demo } from './demo.js';

const URL_SB = import.meta.env.VITE_SUPABASE_URL;
const KEY = import.meta.env.VITE_SUPABASE_KEY;

export const DEMO = new URLSearchParams(location.search).has('demo') || !URL_SB || !KEY;
export const sb = DEMO ? null : createClient(URL_SB, KEY, {
      // PKCE: los enlaces de correo vuelven con ?code=... y no chocan con las rutas #/ de la web.
      auth: { persistSession: true, detectSessionInUrl: true, flowType: 'pkce' },
    });

export const VERSION_ACUERDO = '2026-11-v1';

/** Error de Supabase -> mensaje para personas. */
export function mensaje(e) {
  const m = `${e?.message || e || ''} ${e?.hint || ''}`;
  const tabla = [
    ['Invalid login credentials', 'Correo o contraseña incorrectos.'],
    ['Email not confirmed', 'Falta confirmar tu correo: revisa tu bandeja de entrada.'],
    ['User already registered', 'Ese correo ya tiene cuenta. Entra con tu contraseña.'],
    ['Password should be', 'La contraseña debe tener al menos 8 caracteres.'],
    ['not authorized', 'Por ahora no podemos enviar correos a esa dirección. Intenta más tarde.'],
    ['Error sending', 'No pudimos enviar el correo. Intenta más tarde.'],
    ['rate limit', 'Demasiados intentos seguidos. Espera unos minutos.'],
    ['tope_alcanzado', 'Ya completaste tus tomas de esta seña. ¡Gracias!'],
    ['limite_diario', 'Llegaste al máximo de tomas de hoy. Sigue mañana.'],
    ['sin_consentimiento', 'Falta aceptar el acuerdo (o la confirmación de tu tutor).'],
    ['sena_inactiva', 'Esta seña ya no está recibiendo tomas.'],
    ['Failed to fetch', 'Sin conexión. Revisa tu internet e intenta de nuevo.'],
    ['NetworkError', 'Sin conexión. Revisa tu internet e intenta de nuevo.'],
    ['no_quitarte_admin', 'No puedes quitarte tu propio acceso de administrador.'],
  ];
  for (const [k, v] of tabla) if (m.toLowerCase().includes(k.toLowerCase())) return v;
  return 'Algo salió mal: ' + (e?.message || e);
}

const ok = ({ data, error }) => {
  if (error) throw error;
  return data;
};

const real = {
  // --------------------------------------------------- sesión
  async sesion() {
    return ok(await sb.auth.getSession()).session;
  },
  alCambiarSesion(fn) {
    return sb.auth.onAuthStateChange((evento, s) => fn(s, evento)).data.subscription;
  },
  async entrar(correo, clave) {
    return ok(await sb.auth.signInWithPassword({ email: correo, password: clave }));
  },
  async registrar(correo, clave) {
    return ok(await sb.auth.signUp({ email: correo, password: clave, options: { emailRedirectTo: location.origin } }));
  },
  async entrarGoogle() {
    return ok(await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin } }));
  },
  async recuperar(correo) {
    return ok(await sb.auth.resetPasswordForEmail(correo, { redirectTo: location.origin }));
  },
  async cambiarClave(clave) {
    return ok(await sb.auth.updateUser({ password: clave }));
  },
  async salir() {
    await sb.auth.signOut();
  },

  // --------------------------------------------------- perfil y acuerdo
  async miPerfil(uid) {
    return ok(await sb.from('perfiles').select('*').eq('id', uid).maybeSingle());
  },
  async crearPerfil(uid, d) {
    return ok(await sb.from('perfiles').insert({ id: uid, ...d }).select().single());
  },
  async editarPerfil(uid, d) {
    return ok(await sb.from('perfiles').update(d).eq('id', uid).select().single());
  },
  /** Foto de perfil (ya recortada en el navegador). Devuelve el perfil actualizado. */
  async subirFoto(uid, blob, anterior) {
    const ruta = `${uid}/foto-${Date.now()}.webp`;
    ok(await sb.storage.from('fotos').upload(ruta, blob, { contentType: blob.type || 'image/webp', upsert: false }));
    if (anterior) await sb.storage.from('fotos').remove([anterior]);
    return real.editarPerfil(uid, { foto: ruta });
  },
  async quitarFoto(uid, ruta) {
    if (ruta) await sb.storage.from('fotos').remove([ruta]);
    return real.editarPerfil(uid, { foto: null });
  },
  async urlFoto(ruta) {
    if (!ruta) return null;
    const r = await sb.storage.from('fotos').createSignedUrl(ruta, 3600);
    return r.data?.signedUrl || null;
  },
  async miAcuerdo(uid) {
    const r = ok(
      await sb.from('consentimientos').select('*').eq('usuario', uid).is('retirado_en', null).order('aceptado_en', { ascending: false }).limit(1),
    );
    return r[0] || null;
  },
  async aceptarAcuerdo(uid, d) {
    return ok(await sb.from('consentimientos').insert({ usuario: uid, version_acuerdo: VERSION_ACUERDO, ...d }).select().single());
  },
  async infoTutor(token) {
    return ok(await sb.rpc('info_tutor', { token }))[0] || null;
  },
  async confirmarTutor(token, nombre) {
    return ok(await sb.rpc('confirmar_tutor', { token, nombre_tutor: nombre }));
  },

  // --------------------------------------------------- señas y tomas
  async senas() {
    return ok(await sb.from('senas').select('*').order('orden').order('texto'));
  },
  async progreso() {
    const r = ok(await sb.rpc('progreso_senas'));
    return Object.fromEntries(r.map((x) => [x.sena, x]));
  },
  async colaboradores() {
    return ok(await sb.rpc('colaboradores'));
  },
  async misTomas(uid) {
    return ok(await sb.from('tomas').select('id, sena, estado, archivo, creado').eq('usuario', uid).order('creado'));
  },
  /** reintento = viene de la cola sin internet: la fila pudo quedar creada en el intento anterior. */
  async subirToma(uid, sena, bytes, meta, id = crypto.randomUUID(), reintento = false) {
    const archivo = `${uid}/${sena}/${id}.togo`;
    const yaEsta = reintento && ok(await sb.from('tomas').select('id').eq('id', id)).length > 0;
    // Primero la fila: la base revisa acuerdo, tope por persona y límite diario
    // ANTES de gastar la subida.
    if (!yaEsta) ok(await sb.from('tomas').insert({ id, usuario: uid, sena, archivo, bytes: bytes.length, ...meta }));
    const { error } = await sb.storage
      .from('tomas')
      .upload(archivo, new Blob([bytes], { type: 'application/octet-stream' }), { contentType: 'application/octet-stream' });
    if (error && !/exists|duplicate/i.test(error.message)) {
      // Sin conexión, la fila se queda: el reintento de la cola sube el archivo.
      if (!/fetch|network|load failed/i.test(error.message)) await sb.from('tomas').delete().eq('id', id);
      throw error;
    }
    return { id, archivo, sena, estado: 'pendiente', creado: new Date().toISOString() };
  },
  async borrarToma(t) {
    await sb.storage.from('tomas').remove([t.archivo]);
    ok(await sb.from('tomas').delete().eq('id', t.id));
  },
  async retirarDatos(uid) {
    const mias = await real.misTomas(uid);
    for (let i = 0; i < mias.length; i += 100) {
      await sb.storage.from('tomas').remove(mias.slice(i, i + 100).map((t) => t.archivo));
    }
    const yo = await real.miPerfil(uid).catch(() => null);
    if (yo?.foto) await sb.storage.from('fotos').remove([yo.foto]);
    ok(await sb.rpc('retirar_mis_datos'));
    await sb.auth.signOut();
  },
  urlEjemplo(ruta) {
    return ruta ? sb.storage.from('ejemplos').getPublicUrl(ruta).data.publicUrl : null;
  },

  // --------------------------------------------------- administración
  async resumen() {
    return ok(await sb.rpc('resumen_admin'));
  },
  async personas() {
    return ok(await sb.rpc('personas_admin'));
  },
  async asignarRol(persona, revisor, admin) {
    return ok(await sb.rpc('asignar_rol', { persona, revisor, admin }));
  },
  async guardarSena(s, nueva) {
    const { id, creado, actualizado, ...resto } = s;
    if (nueva) return ok(await sb.from('senas').insert({ id, ...resto }).select().single());
    return ok(await sb.from('senas').update(resto).eq('id', id).select().single());
  },
  async borrarSena(id) {
    ok(await sb.from('senas').delete().eq('id', id));
  },
  async subirEjemplo(sena, archivo) {
    const ext = (archivo.name.split('.').pop() || 'mp4').toLowerCase();
    const ruta = `${sena.id}/${Date.now()}.${ext}`;
    ok(await sb.storage.from('ejemplos').upload(ruta, archivo, { contentType: archivo.type, upsert: false }));
    if (sena.video_ejemplo) await sb.storage.from('ejemplos').remove([sena.video_ejemplo]);
    return ok(await sb.from('senas').update({ video_ejemplo: ruta }).eq('id', sena.id).select().single());
  },
  async quitarEjemplo(sena) {
    if (sena.video_ejemplo) await sb.storage.from('ejemplos').remove([sena.video_ejemplo]);
    return ok(await sb.from('senas').update({ video_ejemplo: null }).eq('id', sena.id).select().single());
  },
  /** Muñeco de ejemplo desde una sola toma ({ fps, frames }); null lo quita. */
  async ejemploMuneco(senaId, ejemplo) {
    return ok(await sb.from('senas').update({ ejemplo_muneco: ejemplo }).eq('id', senaId).select().single());
  },
  async tomas({ sena, estado, limite = 30, desde = 0 }) {
    let q = sb
      .from('tomas')
      .select('id, sena, estado, archivo, archivo_borrado, cuadros, fps, calidad, modelo_top, nota, creado, usuario, perfiles!tomas_usuario_fkey(nombre_publico, numero)', {
        count: 'exact',
      })
      .order('creado', { ascending: true })
      .range(desde, desde + limite - 1);
    if (sena) q = q.eq('sena', sena);
    if (estado) q = q.eq('estado', estado);
    const { data, error, count } = await q;
    if (error) throw error;
    return { filas: data, total: count };
  },
  async bajarToma(archivo) {
    const blob = ok(await sb.storage.from('tomas').download(archivo));
    return new Uint8Array(await blob.arrayBuffer());
  },
  async revisar(id, estado, nota) {
    return ok(await sb.rpc('revisar_toma', { toma: id, nuevo_estado: estado, comentario: nota || null }));
  },
};

export const api = DEMO ? demo : real;
