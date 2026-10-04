# Versiones de los modelos

| Carpeta | Qué es | Datos | Persona no vista | En qué APK |
|---|---|---|---|---|
| `v2/` | Modelo original (258 valores, 30 cuadros) | 4000 videos originales | 68–88 % | Alfa 0.3 |
| `v3_con_videos_v2/` | Características v3 (forma de mano, mano dominante) | 4000 videos originales | 81 → 88 % | Alfa 0.4 y `Alfa-0.5-modelo-anterior` |
| `prueba_solo_nuevos/` | Prueba: solo videos nuevos (2 s) | p2 + p3 | 79.7 % (p2 83.2, p3 76.3) | — |
| `prueba_combinado/` | Prueba: nuevos + originales | p2 + p3 + 4000 originales | 84.8 % (p2 82.0, p3 87.6) | — |
| `prueba_abecedario_p2p3/` | Prueba del abecedario (solo el registro) | fotos p2 + p3, clips p3 | — | — |
| `v3_alfa_0.5/` | **Modelo final de Alfa 0.5** (señas + abecedario) | p1 (828 videos) + p2 + p3 + 4000 originales; abecedario p2 + p3 | **85.7 %** (p1 85.9, p2 81.5, p3 89.5) | `Alfa-0.5` |
| `v3/` | Salida del último entrenamiento (hoy = `v3_alfa_0.5`) | — | — | — |
| `mediapipe/` | Detectores de pose y manos (los mismos del teléfono) | — | — | todas |

"Persona no vista" = entrenar sin una persona y medir con ella: es lo más parecido a usar la
app con alguien nuevo. Cada carpeta tiene su `reporte.json` (precisión, matriz de confusión).

Abecedario de `v3_alfa_0.5`: letras estáticas 98.0 %, letras con movimiento (J, Ñ, Z) 97.9 %
(con clips de una sola persona: falta que más gente las grabe).
