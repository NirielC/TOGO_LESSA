import * as Haptics from 'expo-haptics';

/**
 * Vibraciones cortas para que los botones principales se sientan al tocarlos.
 * Si el teléfono no vibra (o en la web), no pasa nada.
 */

/** Toque leve: Empezar, Decir, frases rápidas, herramientas. */
export function tocar() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

/** Confirmación: algo quedó hecho (por ejemplo, la conversación se guardó). */
export function listo() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}
