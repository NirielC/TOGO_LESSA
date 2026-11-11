import React, { useEffect, useRef } from 'react';
import { Animated, Easing, ViewStyle } from 'react-native';
import { useMenosMovimiento } from '../core/movimiento';

/** Entrada suave: sube un poco y aparece. Con `delay` se escalonan varias piezas. */
export function Aparecer({ delay = 0, children, style }: { delay?: number; children: React.ReactNode; style?: ViewStyle }) {
  const v = useRef(new Animated.Value(0)).current;
  const menos = useMenosMovimiento();
  useEffect(() => {
    if (menos) {
      v.setValue(1);
      return;
    }
    const a = Animated.timing(v, { toValue: 1, duration: 450, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true });
    a.start();
    return () => a.stop();
  }, [menos, delay, v]);
  const translateY = v.interpolate({ inputRange: [0, 1], outputRange: [22, 0] });
  return <Animated.View style={[style, { opacity: v, transform: [{ translateY }] }]}>{children}</Animated.View>;
}
