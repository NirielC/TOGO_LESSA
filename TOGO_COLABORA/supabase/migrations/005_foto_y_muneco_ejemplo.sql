-- 005 · Foto de perfil opcional y muñeco de ejemplo sacado de una sola toma.
--
-- Foto: cada quien sube (o quita) la suya, ya recortada a 256x256 en el navegador.
--   Bucket privado "fotos": solo la persona y los revisores/admin la ven. Los
--   menores no suben foto (la web no lo ofrece y la regla de abajo lo impide).
-- Muñeco de ejemplo: el admin elige una toma buena y sus puntos se guardan en
--   senas.ejemplo_muneco ({ fps, frames }). Así una seña nueva tiene ejemplo
--   animado sin tener que entrenar nada.

alter table public.perfiles add column if not exists foto text;
grant update (foto) on public.perfiles to authenticated;

alter table public.senas add column if not exists ejemplo_muneco jsonb;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('fotos', 'fotos', false, 307200, array['image/webp', 'image/jpeg'])
on conflict (id) do nothing;

create policy fotos_subir on storage.objects for insert to authenticated
  with check (bucket_id = 'fotos'
              and (storage.foldername(name))[1] = (select auth.uid())::text
              and not coalesce((select p.es_menor from public.perfiles p where p.id = (select auth.uid())), true));
create policy fotos_leer on storage.objects for select to authenticated
  using (bucket_id = 'fotos' and ((storage.foldername(name))[1] = (select auth.uid())::text
                                  or (select public.es_revisor())));
create policy fotos_quitar on storage.objects for delete to authenticated
  using (bucket_id = 'fotos' and ((storage.foldername(name))[1] = (select auth.uid())::text
                                  or (select public.es_admin())));
