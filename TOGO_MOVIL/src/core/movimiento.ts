import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * true si la persona pidió "reducir movimiento" en su teléfono: entonces las
 * animaciones decorativas no se mueven (se muestran quietas, ya en su lugar).
 */
export function useMenosMovimiento() {
  const [menos, setMenos] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then(setMenos)
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setMenos);
    return () => sub.remove();
  }, []);
  return menos;
}
