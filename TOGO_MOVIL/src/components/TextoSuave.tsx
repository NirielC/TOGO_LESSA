import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleProp, TextStyle } from 'react-native';

/**
 * Texto que cambia sin saltos: se desvanece, cambia y vuelve a aparecer subiendo
 * un poquito. Para los consejos que rotan (inicio y tira de Togo): antes cambiaban
 * de golpe y se robaban la atención.
 */
export function TextoSuave({ text, style, numberOfLines }: { text: string; style?: StyleProp<TextStyle>; numberOfLines?: number }) {
  const [shown, setShown] = useState(text);
  const latest = useRef(text);
  const a = useRef(new Animated.Value(1)).current;
  latest.current = text;

  useEffect(() => {
    if (text === shown) return;
    Animated.timing(a, { toValue: 0, duration: 320, easing: Easing.in(Easing.quad), useNativeDriver: true }).start(() => {
      setShown(latest.current);
      Animated.timing(a, { toValue: 1, duration: 520, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  const translateY = a.interpolate({ inputRange: [0, 1], outputRange: [5, 0] });
  return (
    <Animated.Text style={[style, { opacity: a, transform: [{ translateY }] }]} numberOfLines={numberOfLines}>
      {shown}
    </Animated.Text>
  );
}
