import React, { createContext, useContext } from 'react';
import { useColorScheme } from 'react-native';
import { useSettings } from '../core/settings';
import { applyTheme, ThemeName } from './tokens';

/**
 * Elige el tema (ajuste "Apariencia": automático, claro u oscuro) y lo aplica
 * ANTES de dibujar a los hijos. Cada pantalla llama a useTheme(): así, al
 * cambiar el tema, se vuelve a dibujar con los colores nuevos.
 */
const ThemeContext = createContext<ThemeName>('light');

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { settings } = useSettings();
  const system = useColorScheme();
  const name: ThemeName =
    settings.theme === 'dark' || (settings.theme !== 'light' && system === 'dark') ? 'dark' : 'light';
  applyTheme(name); // no hace nada si ya era ese
  return <ThemeContext.Provider value={name}>{children}</ThemeContext.Provider>;
}

/** El tema actual; llamarlo en una pantalla hace que se redibuje al cambiarlo. */
export const useTheme = () => useContext(ThemeContext);
