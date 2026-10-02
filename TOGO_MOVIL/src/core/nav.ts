import { router } from 'expo-router';

/** Volver; si no hay pantalla detrás (abierta desde un enlace o recarga), ir a la conversación. */
export function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}
