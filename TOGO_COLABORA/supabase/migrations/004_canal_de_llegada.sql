-- Por qué canal llegó la persona (?de=sticker, ?de=instagram, ?de=academia-x...): mide qué difusión funciona.
-- (resumen_admin() se reemplazó en la base para agregar 'por_canal'; ver la versión aplicada en Supabase.)
alter table public.perfiles add column llego_por text check (llego_por is null or llego_por ~ '^[a-z0-9_-]{1,40}$');
grant insert (llego_por) on public.perfiles to authenticated;
