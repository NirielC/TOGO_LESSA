/**
 * Modo demostración (?demo): misma interfaz que api.js, todo en memoria.
 * Nada sale del navegador. Las tomas grabadas aquí van a la cola de revisión
 * del panel para poder probarlo completo.
 */
const UID = '00000000-0000-4000-8000-000000000001';
const espera = (ms = 150) => new Promise((r) => setTimeout(r, ms));

const BASE = [
  ['hola', 'sena', 'Hola', 'Saludos'],
  ['como_estas', 'sena', '¿Cómo estás?', 'Saludos'],
  ['estoy_bien', 'sena', 'Estoy bien', 'Respuestas'],
  ['estoy_mas_o_menos', 'sena', 'Estoy más o menos', 'Respuestas'],
  ['estoy_mal', 'sena', 'Estoy mal', 'Respuestas'],
  ['mi_nombre_es', 'sena', 'Mi nombre es', 'Presentarse'],
  ['si', 'sena', 'Sí', 'Respuestas'],
  ['a_que_hora_es', 'sena', '¿A qué hora es?', 'Preguntas'],
  ['por_la_tarde', 'sena', 'Por la tarde', 'Respuestas'],
  ['ok_adios', 'sena', 'Ok, adiós', 'Despedidas'],
  ['nada', 'nada', 'Sin seña', 'Especial'],
  ...'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ'.split('').map((l) => [
    'letra_' + (l === 'Ñ' ? 'enie' : l.toLowerCase()),
    'JÑZ'.includes(l) ? 'letra_mov' : 'letra',
    l,
    'Abecedario',
  ]),
];

const db = {
  sesion: null,
  oyentes: new Set(),
  perfil: null,
  acuerdo: null,
  senas: BASE.map(([id, tipo, texto, categoria], i) => ({
    id, tipo, texto, categoria,
    descripcion: tipo === 'letra' ? 'Sostén la forma de la letra y gira un poco la mano mientras graba.' : 'Descripción de ejemplo de cómo se hace la seña.',
    duracion_s: tipo === 'letra' ? 1.5 : 2.0,
    meta_tomas: 400, meta_personas: 30, tope_por_persona: 15,
    video_ejemplo: null, activa: true, nueva: false, orden: (i + 1) * 10,
  })),
  tomas: [],
  archivos: new Map(),
  progreso: { hola: { tomas: 212, personas: 17, aceptadas: 180 }, como_estas: { tomas: 96, personas: 8, aceptadas: 70 }, si: { tomas: 388, personas: 29, aceptadas: 350 } },
};

const avisar = () => db.oyentes.forEach((f) => f(db.sesion));

export const demo = {
  async sesion() { return db.sesion; },
  alCambiarSesion(fn) { db.oyentes.add(fn); return { unsubscribe: () => db.oyentes.delete(fn) }; },
  async entrar(correo) {
    await espera();
    db.sesion = { user: { id: UID, email: correo || 'demo@togo.test' } };
    avisar();
    return db.sesion;
  },
  async registrar(correo) { return demo.entrar(correo); },
  async entrarGoogle() { return demo.entrar('demo@gmail.com'); },
  async recuperar() { await espera(); },
  async cambiarClave() { await espera(); },
  async salir() { db.sesion = null; avisar(); },

  async miPerfil() { await espera(80); return db.perfil; },
  async crearPerfil(uid, d) { db.perfil = { id: uid, numero: 1, es_admin: true, es_revisor: true, ...d }; return db.perfil; },
  async editarPerfil(uid, d) { Object.assign(db.perfil, d); return db.perfil; },
  async subirFoto(uid, blob) { db.perfil.foto = URL.createObjectURL(blob); return db.perfil; },
  async quitarFoto() { db.perfil.foto = null; return db.perfil; },
  async urlFoto(ruta) { return ruta || null; },
  async miAcuerdo() { return db.acuerdo; },
  async aceptarAcuerdo(uid, d) {
    db.acuerdo = { id: 1, usuario: uid, version_acuerdo: 'demo', aceptado_en: new Date().toISOString(), tutor_token: 'demo-token', tutor_confirmado_en: d.es_menor ? null : undefined, ...d };
    return db.acuerdo;
  },
  async infoTutor() { return { nombre: db.perfil?.nombre_publico || 'Ana', tutor: db.acuerdo?.tutor_nombre || null, confirmado: !!db.acuerdo?.tutor_confirmado_en, vigente: true }; },
  async confirmarTutor(_t, nombre) { if (db.acuerdo) Object.assign(db.acuerdo, { tutor_confirmado_en: new Date().toISOString(), tutor_nombre: nombre }); return true; },

  async senas() { await espera(80); return db.senas.slice().sort((a, b) => a.orden - b.orden); },
  async progreso() {
    const p = structuredClone(db.progreso);
    for (const t of db.tomas) {
      p[t.sena] ??= { tomas: 0, personas: 1, aceptadas: 0 };
      p[t.sena].tomas++;
    }
    return p;
  },
  async colaboradores() { return [{ nombre: 'María', tomas: 15 }, { nombre: 'José Luis', tomas: 12 }, { nombre: 'Daniela', tomas: 9 }]; },
  async misTomas() { return db.tomas.slice(); },
  async subirToma(uid, sena, bytes, meta, id = crypto.randomUUID()) {
    await espera(300);
    // ?demo&sinred: simula que no hay conexión (para probar la cola).
    if (new URLSearchParams(location.search).has('sinred') && !window.__togoRed) throw new TypeError('Failed to fetch');
    const s = db.senas.find((x) => x.id === sena);
    if (db.tomas.filter((t) => t.sena === sena && t.estado !== 'rechazada').length >= s.tope_por_persona) throw new Error('tope_alcanzado');
    const archivo = `${uid}/${sena}/${id}.togo`;
    db.archivos.set(archivo, bytes);
    const t = { id, sena, archivo, estado: 'revision', creado: new Date().toISOString(), usuario: uid, perfiles: { nombre_publico: db.perfil?.nombre_publico, numero: 1 }, archivo_borrado: false, ...meta };
    db.tomas.push(t);
    return t;
  },
  async borrarToma(t) { db.tomas = db.tomas.filter((x) => x.id !== t.id); db.archivos.delete(t.archivo); },
  async retirarDatos() { db.tomas = []; db.perfil = null; db.acuerdo = null; await demo.salir(); },
  urlEjemplo(ruta) { return ruta; },

  async resumen() {
    const por = {};
    db.tomas.forEach((t) => (por[t.estado] = (por[t.estado] || 0) + 1));
    return { personas: 31, personas_con_tomas: 24, menores_sin_confirmar: 2, tomas: 696 + db.tomas.length, por_estado: { aceptada: 600, pendiente: 60, revision: 30, rechazada: 6, ...por }, hoy: 41, sin_descargar: 66, bytes_tomas: 10_400_000, bytes_ejemplos: 18_000_000, bytes_base: 9_800_000, retiros: 1 };
  },
  async personas() {
    return [
      { id: UID, numero: 1, nombre: db.perfil?.nombre_publico || 'Tú (demo)', correo: 'demo@togo.test', es_menor: false, tutor_confirmado: false, relacion: 'otra', mano: 'derecha', tomas: db.tomas.length, aceptadas: 0, rechazadas: 0, es_revisor: true, es_admin: true, creado: new Date().toISOString() },
      { id: 'b', numero: 2, nombre: 'María', correo: 'maria@ejemplo.com', es_menor: false, tutor_confirmado: false, relacion: 'sorda', mano: 'derecha', tomas: 150, aceptadas: 140, rechazadas: 2, es_revisor: true, es_admin: false, creado: new Date().toISOString() },
      { id: 'c', numero: 3, nombre: 'Daniela', correo: 'dani@ejemplo.com', es_menor: true, tutor_confirmado: true, relacion: 'estudiante', mano: 'izquierda', tomas: 45, aceptadas: 40, rechazadas: 1, es_revisor: false, es_admin: false, creado: new Date().toISOString() },
    ];
  },
  async asignarRol() { await espera(); },
  async guardarSena(s, nueva) {
    if (nueva) db.senas.push({ ...s });
    else Object.assign(db.senas.find((x) => x.id === s.id), s);
    return s;
  },
  async borrarSena(id) { db.senas = db.senas.filter((s) => s.id !== id); },
  async subirEjemplo(sena, archivo) {
    const s = db.senas.find((x) => x.id === sena.id);
    s.video_ejemplo = URL.createObjectURL(archivo);
    return s;
  },
  async ejemploMuneco(senaId, ejemplo) { const s = db.senas.find((x) => x.id === senaId); s.ejemplo_muneco = ejemplo; return s; },
  async quitarEjemplo(sena) { const s = db.senas.find((x) => x.id === sena.id); s.video_ejemplo = null; return s; },
  async tomas({ sena, estado, limite = 30, desde = 0 }) {
    const f = db.tomas.filter((t) => (!sena || t.sena === sena) && (!estado || t.estado === estado));
    return { filas: f.slice(desde, desde + limite), total: f.length };
  },
  async bajarToma(archivo) { return db.archivos.get(archivo); },
  async revisar(id, estado, nota) { Object.assign(db.tomas.find((t) => t.id === id), { estado, nota }); },
};
