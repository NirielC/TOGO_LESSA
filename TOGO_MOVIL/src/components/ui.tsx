import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, PressableProps, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors, fonts, radius, space, touch, type } from '../theme/tokens';

export type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

export function Icon({ name, size = 22, color = colors.text }: { name: IconName; size?: number; color?: string }) {
  return <MaterialCommunityIcons name={name} size={size} color={color} />;
}

type Variant = 'primary' | 'ink' | 'soft' | 'ghost';

export function Button({
  label,
  icon,
  variant = 'primary',
  style,
  ...rest
}: PressableProps & { label: string; icon?: IconName; variant?: Variant; style?: ViewStyle }) {
  const v = VARIANTS[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [s.btn, { backgroundColor: v.bg, opacity: pressed ? 0.85 : rest.disabled ? 0.5 : 1 }, style]}
      {...rest}
    >
      {icon && <Icon name={icon} size={20} color={v.fg} />}
      <Text style={[s.btnText, { color: v.fg }]}>{label}</Text>
    </Pressable>
  );
}

const VARIANTS: Record<Variant, { bg: string; fg: string }> = {
  primary: { bg: colors.primary, fg: colors.onPrimary },
  ink: { bg: colors.ink, fg: colors.onInk },
  soft: { bg: colors.surfaceAlt, fg: colors.text },
  ghost: { bg: 'transparent', fg: colors.primary },
};

export function IconButton({
  icon,
  label,
  onPress,
  color = colors.text,
  bg = 'transparent',
  size = 22,
}: {
  icon: IconName;
  label: string;
  onPress?: () => void;
  color?: string;
  bg?: string;
  size?: number;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [s.iconBtn, { backgroundColor: bg, opacity: pressed ? 0.7 : 1 }]}
    >
      <Icon name={icon} size={size} color={color} />
    </Pressable>
  );
}

/** Etiqueta de canal: siempre ícono + texto, nunca solo color. */
export function ChannelTag({ icon, text, color }: { icon: IconName; text: string; color: string }) {
  return (
    <View style={s.tag}>
      <Icon name={icon} size={14} color={color} />
      <Text style={[type.label, { color }]}>{text}</Text>
    </View>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[s.card, style]}>{children}</View>;
}

const s = StyleSheet.create({
  btn: {
    minHeight: touch,
    paddingHorizontal: space.xl,
    borderRadius: radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
  btnText: { fontFamily: fonts.bodyBold, fontSize: 16 },
  iconBtn: { width: touch, height: touch, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.lg },
});
