import { ErrorBoundaryProps, router } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, space, themed, type } from '../theme/tokens';
import { Torogoz } from './Torogoz';
import { Button } from './ui';
import { useTheme } from '../theme/ThemeProvider';

/**
 * Si una pantalla falla, en vez de cerrarse la app se muestra esto: Togo avisa y se
 * puede reintentar o volver al inicio. Se usa como ErrorBoundary en src/app/_layout.tsx.
 */
export function ErrorPantalla({ retry }: ErrorBoundaryProps) {
  useTheme(); // se redibuja con los colores nuevos al cambiar el tema
  return (
    <View style={st.wrap}>
      <Torogoz state="confused" size={120} />
      <Text style={[type.h2, st.centro]}>Algo salió mal en esta pantalla</Text>
      <Text style={[type.body, st.centro]}>No se perdió nada. Puedes intentarlo de nuevo o volver al inicio.</Text>
      <Button label="Intentar de nuevo" icon="refresh" onPress={retry} />
      <Button label="Volver al inicio" variant="soft" icon="home-variant-outline" onPress={() => router.replace('/')} />
    </View>
  );
}

const st = themed(() => StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: space.xl, gap: space.md },
  centro: { textAlign: 'center' },
}));
