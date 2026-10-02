import { Fredoka_500Medium, Fredoka_600SemiBold } from '@expo-google-fonts/fredoka';
import { Nunito_400Regular, Nunito_600SemiBold, Nunito_700Bold } from '@expo-google-fonts/nunito';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ConversationProvider } from '@/core/conversation/ConversationProvider';
import { Board } from '@/components/Board';
import { SettingsProvider, useSettings } from '@/core/settings';
import { colors } from '@/theme/tokens';

SplashScreen.preventAutoHideAsync().catch(() => {});

// El inicio siempre queda en la base de la pila: "volver" nunca se queda sin destino.
export const unstable_settings = { initialRouteName: 'index' };

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Fredoka_500Medium, Fredoka_600SemiBold, Nunito_400Regular, Nunito_600SemiBold, Nunito_700Bold });
  return (
    <SafeAreaProvider>
      <SettingsProvider>
        <Gate fontsLoaded={fontsLoaded}>
          <ConversationProvider>
            <StatusBar style="dark" />
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg }, animation: 'slide_from_right' }} />
            <Board />
          </ConversationProvider>
        </Gate>
      </SettingsProvider>
    </SafeAreaProvider>
  );
}

/** No pinta nada hasta tener fuentes y ajustes: evita un parpadeo con la letra del sistema. */
function Gate({ fontsLoaded, children }: { fontsLoaded: boolean; children: React.ReactNode }) {
  const { ready } = useSettings();
  const ok = fontsLoaded && ready;
  useEffect(() => {
    if (ok) SplashScreen.hideAsync().catch(() => {});
  }, [ok]);
  return ok ? <>{children}</> : null;
}
