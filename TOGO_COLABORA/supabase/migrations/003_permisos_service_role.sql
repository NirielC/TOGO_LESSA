-- La sincronización (TOGO_DATASET/tools/sincronizar_web.py) usa la clave secreta: rol service_role.
-- Proyecto creado después del 30-may-2026: hay que dar los permisos de forma explícita.
grant usage on schema public to service_role;
grant select, insert, update, delete on all tables in schema public to service_role;
grant execute on all functions in schema public to service_role;
