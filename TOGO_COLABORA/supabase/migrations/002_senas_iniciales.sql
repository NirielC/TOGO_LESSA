-- Señas con las que arranca la plataforma: las 10 del modelo actual, la clase
-- "nada" (manos sin señar) y el abecedario. Todo se edita luego desde el panel.
insert into public.senas (id, tipo, texto, descripcion, categoria, duracion_s, orden) values
  ('hola',              'sena', 'Hola',              'Para saludar al encontrarse con alguien.',          'Saludos',    2.0, 10),
  ('como_estas',        'sena', '¿Cómo estás?',      'Para preguntar cómo se siente la otra persona.',    'Saludos',    2.0, 20),
  ('estoy_bien',        'sena', 'Estoy bien',        'Para responder que te sientes bien.',               'Respuestas', 2.0, 30),
  ('estoy_mas_o_menos', 'sena', 'Estoy más o menos', 'Para responder que no estás ni bien ni mal.',       'Respuestas', 2.0, 40),
  ('estoy_mal',         'sena', 'Estoy mal',         'Para responder que no te sientes bien.',            'Respuestas', 2.0, 50),
  ('mi_nombre_es',      'sena', 'Mi nombre es',      'Para presentarte; después se deletrea el nombre.',  'Presentarse',2.0, 60),
  ('si',                'sena', 'Sí',                'Para afirmar o estar de acuerdo.',                  'Respuestas', 2.0, 70),
  ('a_que_hora_es',     'sena', '¿A qué hora es?',   'Para preguntar la hora de una cita o actividad.',   'Preguntas',  2.0, 80),
  ('por_la_tarde',      'sena', 'Por la tarde',      'Para indicar que algo pasa en la tarde.',           'Respuestas', 2.0, 90),
  ('ok_adios',          'sena', 'Ok, adiós',         'Para despedirse al terminar la conversación.',      'Despedidas', 2.0, 100),
  ('nada',              'nada', 'Sin seña',          'Mueve las manos como lo harías sin señar: rascarte, acomodarte el pelo, dejarlas en reposo. Le enseña a Togo cuándo NO estás señando.', 'Especial', 2.0, 900)
on conflict (id) do nothing;

insert into public.senas (id, tipo, texto, descripcion, categoria, duracion_s, orden)
select 'letra_' || case l when 'Ñ' then 'enie' else lower(l) end,
       case when l in ('J', 'Ñ', 'Z') then 'letra_mov' else 'letra' end,
       l,
       case when l in ('J', 'Ñ', 'Z') then 'Letra con movimiento: haz el trazo completo.'
            else 'Sostén la forma de la letra y gira un poco la mano mientras graba: así Togo la aprende desde varios ángulos.' end,
       'Abecedario',
       case when l in ('J', 'Ñ', 'Z') then 2.0 else 1.5 end,
       200 + ord
from unnest(array['A','B','C','D','E','F','G','H','I','J','K','L','M','N','Ñ','O','P','Q','R','S','T','U','V','W','X','Y','Z'])
     with ordinality as x(l, ord)
on conflict (id) do nothing;
