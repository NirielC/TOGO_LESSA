import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from '@/components/ui';
import { COLABORA, urlColaborar } from '@/data/app';
import incluidos from '@/data/colaboradores.json';
import { colors, fonts, radius, space, type } from '@/theme/tokens';

/**
 * COLABORADORES: quienes aportaron tomas desde la plataforma web.
 *
 * La lista viene dentro de la app (colaboradores.json, lo escribe
 * TOGO_DATASET/tools/sincronizar_web.py). Si hay internet se pide la lista al
 * día, así un cambio de nombre se ve sin actualizar la app; se guarda para la
 * próxima vez sin conexión. Solo se LEEN nombres públicos: no se envía nada.
 */
const CLAVE = 'togo.colaboradores.v1';

async function pedirEnLinea(): Promise<string[] | null> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 5000);
  try {
    const r = await fetch(`${COLABORA.supabaseUrl}/rest/v1/rpc/colaboradores`, {
      method: 'POST',
      headers: { apikey: COLABORA.supabaseKey, 'Content-Type': 'application/json' },
      body: '{}',
      signal: ctl.signal,
    });
    if (!r.ok) return null;
    const filas = (await r.json()) as { nombre: string }[];
    return filas.map((f) => f.nombre).filter(Boolean);
  } catch {
    return null; // sin internet: se queda la lista guardada
  } finally {
    clearTimeout(t);
  }
}

export function Colaboradores() {
  const [nombres, setNombres] = useState<string[]>((incluidos as { nombres: string[] }).nombres);

  useEffect(() => {
    let vivo = true;
    AsyncStorage.getItem(CLAVE)
      .then((g) => {
        if (vivo && g) setNombres(JSON.parse(g));
      })
      .catch(() => {});
    pedirEnLinea().then((lista) => {
      if (!vivo || !lista) return;
      setNombres(lista);
      AsyncStorage.setItem(CLAVE, JSON.stringify(lista)).catch(() => {});
    });
    return () => {
      vivo = false;
    };
  }, []);

  return (
    <View style={st.wrap}>
      <View style={st.invita}>
        <View style={st.icono}>
          <Icon name="hand-heart-outline" size={24} color={colors.onPrimary} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={st.titulo}>Enséñale más señas a Togo</Text>
          <Text style={type.small}>Graba señas desde tu teléfono en unos minutos. Tu video no sale de tu teléfono.</Text>
        </View>
      </View>
      <Pressable
        onPress={() => Linking.openURL(urlColaborar('app-acerca'))}
        style={({ pressed }) => [st.boton, pressed && { opacity: 0.85 }]}
        accessibilityRole="link"
        accessibilityLabel="Colaborar con Togo (abre la página web)"
      >
        <Icon name="open-in-new" size={18} color={colors.onPrimary} />
        <Text style={st.botonTexto}>Colaborar</Text>
      </Pressable>
      {nombres.length > 0 && (
        <>
          <Text style={st.gracias}>Gracias a quienes ya colaboraron:</Text>
          <View style={st.lista}>
            {nombres.map((n, i) => (
              <View key={`${n}-${i}`} style={st.chip}>
                <Text style={st.chipTexto}>{n}</Text>
              </View>
            ))}
          </View>
        </>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  wrap: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: space.lg, gap: space.md },
  invita: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  icono: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.live, alignItems: 'center', justifyContent: 'center' },
  titulo: { fontFamily: fonts.title, fontSize: 18, color: colors.text },
  boton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm,
    minHeight: 48, borderRadius: radius.pill, backgroundColor: colors.primary,
  },
  botonTexto: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.onPrimary },
  gracias: { ...type.small, marginTop: space.xs },
  lista: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: { backgroundColor: colors.signSoft, borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: 6 },
  chipTexto: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.signInk },
});
