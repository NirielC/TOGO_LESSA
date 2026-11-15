-- =====================================================================
-- TOGO COLABORA · esquema de la plataforma de colaboración
--
-- Tablas: perfiles, consentimientos, senas, tomas, retiros.
-- Los puntos de cada toma van en Storage (bucket "tomas"), no en la base.
-- Proyecto creado después del 30-may-2026: PostgREST necesita GRANT explícitos.
-- =====================================================================

-- ------------------------------------------------------------ utilidades

create or replace function public.tocar_actualizado() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.actualizado := now();
  return new;
end $$;

-- ------------------------------------------------------------ perfiles

create table public.perfiles (
  id uuid primary key references auth.users(id) on delete cascade,
  -- Número de persona en el dataset (los archivos se llaman p<1000+numero>_...).
  numero integer generated always as identity unique,
  nombre_publico text not null check (char_length(btrim(nombre_publico)) between 2 and 40),
  mostrar_credito boolean not null default true,
  mano_dominante text check (mano_dominante in ('derecha', 'izquierda', 'ambas')),
  relacion_lessa text check (relacion_lessa in ('sorda', 'familiar', 'interprete', 'estudiante', 'otra')),
  es_menor boolean not null default false,
  es_admin boolean not null default false,
  es_revisor boolean not null default false,
  creado timestamptz not null default now(),
  actualizado timestamptz not null default now()
);

create trigger perfiles_actualizado before update on public.perfiles
for each row execute function public.tocar_actualizado();

create or replace function public.es_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select p.es_admin from public.perfiles p where p.id = auth.uid()), false)
$$;

create or replace function public.es_revisor() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select p.es_admin or p.es_revisor from public.perfiles p where p.id = auth.uid()), false)
$$;

-- ------------------------------------------------------------ consentimientos

create table public.consentimientos (
  id bigint generated always as identity primary key,
  usuario uuid not null references public.perfiles(id) on delete cascade,
  version_acuerdo text not null,
  aceptado_en timestamptz not null default now(),
  es_menor boolean not null,
  tutor_nombre text check (tutor_nombre is null or char_length(tutor_nombre) <= 80),
  tutor_correo text check (tutor_correo is null or tutor_correo ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  -- Enlace que confirma el tutor (sin correo automático por ahora: se comparte a mano).
  tutor_token uuid not null default gen_random_uuid() unique,
  tutor_confirmado_en timestamptz,
  retirado_en timestamptz,
  check (not es_menor or (tutor_nombre is not null and tutor_correo is not null))
);
create index consentimientos_usuario on public.consentimientos(usuario);

-- ¿Puede grabar? Acuerdo vigente y, si es menor, confirmado por su tutor.
create or replace function public.puede_grabar(u uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.consentimientos c
    where c.usuario = u and c.retirado_en is null
      and (not c.es_menor or c.tutor_confirmado_en is not null)
  )
$$;

-- ------------------------------------------------------------ señas

create table public.senas (
  id text primary key check (id ~ '^[a-z0-9_]{1,40}$'),
  tipo text not null default 'sena' check (tipo in ('sena', 'letra', 'letra_mov', 'nada')),
  texto text not null check (char_length(texto) between 1 and 60),
  descripcion text check (descripcion is null or char_length(descripcion) <= 600),
  categoria text,
  -- Duración de la toma: cada seña la suya (el entrenamiento la ajusta a la ventana del modelo).
  duracion_s numeric(3, 1) not null default 2.0 check (duracion_s between 0.8 and 5.0),
  meta_tomas integer not null default 400 check (meta_tomas > 0),
  meta_personas integer not null default 30 check (meta_personas > 0),
  tope_por_persona integer not null default 15 check (tope_por_persona between 1 and 100),
  video_ejemplo text,             -- ruta en el bucket "ejemplos"
  activa boolean not null default true,
  -- Seña que el modelo todavía no conoce: todas sus tomas pasan por revisión.
  nueva boolean not null default false,
  orden integer not null default 100,
  creado timestamptz not null default now(),
  actualizado timestamptz not null default now()
);

create trigger senas_actualizado before update on public.senas
for each row execute function public.tocar_actualizado();

-- ------------------------------------------------------------ tomas

create table public.tomas (
  id uuid primary key default gen_random_uuid(),
  usuario uuid not null default auth.uid() references public.perfiles(id) on delete cascade,
  sena text not null references public.senas(id) on update cascade on delete cascade,
  archivo text not null unique,   -- <usuario>/<sena>/<id>.togo en el bucket "tomas"
  bytes integer check (bytes is null or bytes between 1 and 262144),
  cuadros integer not null check (cuadros between 5 and 200),
  fps real not null check (fps > 0 and fps <= 60),
  ancho integer check (ancho between 16 and 8192),
  alto integer check (alto between 16 and 8192),
  calidad jsonb,                  -- {manos, cuerpo, mov, luz, avisos: [...]}
  origen text not null default 'web' check (origen in ('web', 'app')),
  estado text not null default 'pendiente' check (estado in ('pendiente', 'aceptada', 'revision', 'rechazada')),
  modelo_top jsonb,               -- [[etiqueta, prob], ...] lo pone la sincronización
  revisado_por uuid references public.perfiles(id) on delete set null,
  revisado_en timestamptz,
  nota text check (nota is null or char_length(nota) <= 300),
  descargada_en timestamptz,
  archivo_borrado boolean not null default false,
  creado timestamptz not null default now()
);
create index tomas_sena_estado on public.tomas(sena, estado);
create index tomas_usuario_sena on public.tomas(usuario, sena);
create index tomas_sin_descargar on public.tomas(creado) where descargada_en is null;
create index tomas_revisado_por on public.tomas(revisado_por);

-- Reglas al subir una toma (lo que el cliente no puede decidir).
create or replace function public.antes_de_toma() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  s public.senas%rowtype;
  n integer;
begin
  select * into s from public.senas where id = new.sena;
  if not found or not s.activa then
    raise exception 'sena_inactiva' using hint = 'Esta seña ya no está recibiendo tomas.';
  end if;
  if not public.puede_grabar(new.usuario) then
    raise exception 'sin_consentimiento' using hint = 'Falta aceptar el acuerdo (o la confirmación del tutor).';
  end if;
  if split_part(new.archivo, '/', 1) <> new.usuario::text then
    raise exception 'archivo_ajeno';
  end if;
  select count(*) into n from public.tomas
   where usuario = new.usuario and sena = new.sena and estado <> 'rechazada';
  if n >= s.tope_por_persona then
    raise exception 'tope_alcanzado' using hint = 'Ya completaste tus tomas de esta seña. ¡Gracias!';
  end if;
  select count(*) into n from public.tomas
   where usuario = new.usuario and creado > now() - interval '1 day';
  if n >= 400 then
    raise exception 'limite_diario' using hint = 'Llegaste al máximo de hoy. Sigue mañana.';
  end if;
  new.estado := case when s.nueva then 'revision' else 'pendiente' end;
  new.modelo_top := null;
  new.revisado_por := null;
  new.revisado_en := null;
  new.nota := null;
  new.descargada_en := null;
  new.archivo_borrado := false;
  new.creado := now();
  return new;
end $$;

create trigger tomas_reglas before insert on public.tomas
for each row execute function public.antes_de_toma();

-- ------------------------------------------------------------ retiros

-- Quien retira sus datos: solo su número de persona, para que la sincronización
-- borre también las copias locales del dataset. Sin datos personales.
create table public.retiros (
  numero integer primary key,
  retirado_en timestamptz not null default now()
);

-- ------------------------------------------------------------ RLS

alter table public.perfiles enable row level security;
alter table public.consentimientos enable row level security;
alter table public.senas enable row level security;
alter table public.tomas enable row level security;
alter table public.retiros enable row level security;

create policy perfiles_ver on public.perfiles for select to authenticated
  using (id = (select auth.uid()) or (select public.es_revisor()));
create policy perfiles_crear on public.perfiles for insert to authenticated
  with check (id = (select auth.uid()));
create policy perfiles_editar on public.perfiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy consent_ver on public.consentimientos for select to authenticated
  using (usuario = (select auth.uid()) or (select public.es_admin()));
create policy consent_crear on public.consentimientos for insert to authenticated
  with check (usuario = (select auth.uid()));

create policy senas_ver on public.senas for select to anon, authenticated
  using (activa or (select public.es_admin()));
create policy senas_crear on public.senas for insert to authenticated
  with check ((select public.es_admin()));
create policy senas_editar on public.senas for update to authenticated
  using ((select public.es_admin())) with check ((select public.es_admin()));
create policy senas_borrar on public.senas for delete to authenticated
  using ((select public.es_admin()));

create policy tomas_ver on public.tomas for select to authenticated
  using (usuario = (select auth.uid()) or (select public.es_revisor()));
create policy tomas_crear on public.tomas for insert to authenticated
  with check (usuario = (select auth.uid()));
create policy tomas_borrar on public.tomas for delete to authenticated
  using (usuario = (select auth.uid()) or (select public.es_admin()));

create policy retiros_ver on public.retiros for select to authenticated
  using ((select public.es_admin()));

-- ------------------------------------------------------------ GRANT

grant usage on schema public to anon, authenticated;

grant select on public.senas to anon, authenticated;
grant insert, update, delete on public.senas to authenticated;

grant select on public.perfiles to authenticated;
grant insert (id, nombre_publico, mostrar_credito, mano_dominante, relacion_lessa, es_menor)
  on public.perfiles to authenticated;
grant update (nombre_publico, mostrar_credito, mano_dominante, relacion_lessa)
  on public.perfiles to authenticated;

grant select (id, usuario, version_acuerdo, aceptado_en, es_menor, tutor_nombre, tutor_correo,
              tutor_token, tutor_confirmado_en, retirado_en)
  on public.consentimientos to authenticated;
grant insert (usuario, version_acuerdo, es_menor, tutor_nombre, tutor_correo)
  on public.consentimientos to authenticated;

grant select, delete on public.tomas to authenticated;
grant insert (id, usuario, sena, archivo, bytes, cuadros, fps, ancho, alto, calidad, origen)
  on public.tomas to authenticated;

grant select on public.retiros to authenticated;

-- ------------------------------------------------------------ funciones públicas

-- Avance por seña (para todos: la portada muestra cuánto falta).
create or replace function public.progreso_senas()
returns table (sena text, tomas bigint, personas bigint, aceptadas bigint)
language sql stable security definer set search_path = '' as $$
  select t.sena, count(*), count(distinct t.usuario), count(*) filter (where t.estado = 'aceptada')
  from public.tomas t where t.estado <> 'rechazada'
  group by t.sena
$$;

-- Créditos: nombre público de quien aportó al menos una toma válida y lo permite.
create or replace function public.colaboradores()
returns table (nombre text, tomas bigint)
language sql stable security definer set search_path = '' as $$
  select p.nombre_publico, count(t.id)
  from public.perfiles p join public.tomas t on t.usuario = p.id and t.estado <> 'rechazada'
  where p.mostrar_credito and public.puede_grabar(p.id)
  group by p.id, p.nombre_publico
  order by min(t.creado)
$$;

-- Tutor: ver a quién autoriza y confirmar (desde el enlace, sin cuenta).
create or replace function public.info_tutor(token uuid)
returns table (nombre text, tutor text, confirmado boolean, vigente boolean)
language sql stable security definer set search_path = '' as $$
  select p.nombre_publico, c.tutor_nombre, c.tutor_confirmado_en is not null, c.retirado_en is null
  from public.consentimientos c join public.perfiles p on p.id = c.usuario
  where c.tutor_token = token and c.es_menor
$$;

create or replace function public.confirmar_tutor(token uuid, nombre_tutor text)
returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if char_length(btrim(coalesce(nombre_tutor, ''))) < 3 then
    raise exception 'nombre_tutor' using hint = 'Escribe tu nombre completo.';
  end if;
  update public.consentimientos
     set tutor_confirmado_en = now(), tutor_nombre = left(btrim(nombre_tutor), 80)
   where tutor_token = token and es_menor and retirado_en is null;
  return found;
end $$;

-- Retirar mis datos: borra la cuenta, sus tomas y su perfil (las tomas en Storage
-- las borra la página antes de llamar aquí) y deja el número para limpiar el dataset.
create or replace function public.retirar_mis_datos() returns void
language plpgsql security definer set search_path = '' as $$
declare
  n integer;
begin
  select numero into n from public.perfiles where id = auth.uid();
  if n is not null then
    insert into public.retiros (numero) values (n) on conflict do nothing;
  end if;
  delete from auth.users where id = auth.uid();
end $$;

-- ------------------------------------------------------------ administración

create or replace function public.revisar_toma(toma uuid, nuevo_estado text, comentario text default null)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.es_revisor() then raise exception 'solo_revisores'; end if;
  if nuevo_estado not in ('aceptada', 'rechazada', 'revision', 'pendiente') then
    raise exception 'estado_invalido';
  end if;
  update public.tomas
     set estado = nuevo_estado, revisado_por = auth.uid(), revisado_en = now(),
         nota = left(comentario, 300)
   where id = toma;
end $$;

create or replace function public.asignar_rol(persona uuid, revisor boolean, admin boolean)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.es_admin() then raise exception 'solo_admin'; end if;
  if persona = auth.uid() and not admin then
    raise exception 'no_quitarte_admin' using hint = 'No puedes quitarte tu propio acceso de administrador.';
  end if;
  update public.perfiles set es_revisor = revisor, es_admin = admin where id = persona;
end $$;

create or replace function public.resumen_admin() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  r jsonb;
begin
  if not public.es_admin() then raise exception 'solo_admin'; end if;
  select jsonb_build_object(
    'personas', (select count(*) from public.perfiles),
    'personas_con_tomas', (select count(distinct usuario) from public.tomas),
    'menores_sin_confirmar', (select count(*) from public.consentimientos
                               where es_menor and tutor_confirmado_en is null and retirado_en is null),
    'tomas', (select count(*) from public.tomas),
    'por_estado', (select coalesce(jsonb_object_agg(estado, n), '{}') from
                     (select estado, count(*) n from public.tomas group by estado) e),
    'hoy', (select count(*) from public.tomas where creado > now() - interval '1 day'),
    'sin_descargar', (select count(*) from public.tomas where descargada_en is null),
    'bytes_tomas', (select coalesce(sum((o.metadata ->> 'size')::bigint), 0)
                      from storage.objects o where o.bucket_id = 'tomas'),
    'bytes_ejemplos', (select coalesce(sum((o.metadata ->> 'size')::bigint), 0)
                         from storage.objects o where o.bucket_id = 'ejemplos'),
    'bytes_base', pg_database_size(current_database()),
    'retiros', (select count(*) from public.retiros)
  ) into r;
  return r;
end $$;

create or replace function public.personas_admin()
returns table (id uuid, numero integer, nombre text, correo text, es_menor boolean,
               tutor_confirmado boolean, relacion text, mano text, tomas bigint, aceptadas bigint,
               rechazadas bigint, es_revisor boolean, es_admin boolean, creado timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.es_admin() then raise exception 'solo_admin'; end if;
  return query
  select p.id, p.numero, p.nombre_publico, u.email::text, p.es_menor,
         exists (select 1 from public.consentimientos c where c.usuario = p.id and c.tutor_confirmado_en is not null),
         p.relacion_lessa, p.mano_dominante,
         count(t.id), count(t.id) filter (where t.estado = 'aceptada'),
         count(t.id) filter (where t.estado = 'rechazada'),
         p.es_revisor, p.es_admin, p.creado
  from public.perfiles p
  join auth.users u on u.id = p.id
  left join public.tomas t on t.usuario = p.id
  group by p.id, u.email
  order by p.numero;
end $$;

-- Funciones: nadie las ejecuta salvo a quien se le da permiso.
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.progreso_senas() to anon, authenticated;
grant execute on function public.colaboradores() to anon, authenticated;
grant execute on function public.info_tutor(uuid) to anon, authenticated;
grant execute on function public.confirmar_tutor(uuid, text) to anon, authenticated;
grant execute on function public.es_admin() to anon, authenticated;
grant execute on function public.es_revisor() to anon, authenticated;
grant execute on function public.puede_grabar(uuid) to authenticated;
grant execute on function public.retirar_mis_datos() to authenticated;
grant execute on function public.revisar_toma(uuid, text, text) to authenticated;
grant execute on function public.asignar_rol(uuid, boolean, boolean) to authenticated;
grant execute on function public.resumen_admin() to authenticated;
grant execute on function public.personas_admin() to authenticated;

-- ------------------------------------------------------------ Storage

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('tomas', 'tomas', false, 262144, array['application/octet-stream']),
  ('ejemplos', 'ejemplos', true, 15728640,
   array['video/mp4', 'video/webm', 'video/quicktime', 'image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do nothing;

create policy tomas_subir on storage.objects for insert to authenticated
  with check (bucket_id = 'tomas' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy tomas_leer on storage.objects for select to authenticated
  using (bucket_id = 'tomas' and ((storage.foldername(name))[1] = (select auth.uid())::text
                                  or (select public.es_revisor())));
create policy tomas_quitar on storage.objects for delete to authenticated
  using (bucket_id = 'tomas' and ((storage.foldername(name))[1] = (select auth.uid())::text
                                  or (select public.es_admin())));

create policy ejemplos_subir on storage.objects for insert to authenticated
  with check (bucket_id = 'ejemplos' and (select public.es_admin()));
create policy ejemplos_cambiar on storage.objects for update to authenticated
  using (bucket_id = 'ejemplos' and (select public.es_admin()));
create policy ejemplos_quitar on storage.objects for delete to authenticated
  using (bucket_id = 'ejemplos' and (select public.es_admin()));
-- (El bucket "ejemplos" es público para leer: los videos de ejemplo no necesitan cuenta.)
