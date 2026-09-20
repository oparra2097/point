import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { radius, space, type as t, usePalette } from './theme';

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const p = usePalette();
  return (
    <View
      style={[
        { backgroundColor: p.surface, borderColor: p.border, borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.lg, padding: space.lg },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  const p = usePalette();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.md }}>
      <Text style={[t.heading, { color: p.text }]}>{title}</Text>
      {action}
    </View>
  );
}

export function Chip({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'positive' | 'warning' | 'accent' }) {
  const p = usePalette();
  const bg = { neutral: p.surfaceAlt, positive: `${p.positive}22`, warning: `${p.warning}22`, accent: `${p.accent}22` }[tone];
  const fg = { neutral: p.textMuted, positive: p.positive, warning: p.warning, accent: p.accent }[tone];
  return (
    <View style={{ backgroundColor: bg, paddingHorizontal: space.sm, paddingVertical: 3, borderRadius: radius.sm }}>
      <Text style={[t.caption, { color: fg, fontWeight: '600' }]}>{label}</Text>
    </View>
  );
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  disabled,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
  disabled?: boolean;
}) {
  const p = usePalette();
  const primary = variant === 'primary';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: space.sm,
        backgroundColor: primary ? p.accent : p.surfaceAlt,
        paddingVertical: space.md,
        paddingHorizontal: space.lg,
        borderRadius: radius.md,
        opacity: disabled ? 0.45 : pressed ? 0.8 : 1,
      })}
    >
      {icon ? <MaterialCommunityIcons name={icon} size={18} color={primary ? p.accentText : p.text} /> : null}
      <Text style={[t.label, { color: primary ? p.accentText : p.text, fontWeight: '600' }]}>{label}</Text>
    </Pressable>
  );
}

export function Empty({ icon, title, body }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; title: string; body: string }) {
  const p = usePalette();
  return (
    <View style={{ alignItems: 'center', paddingVertical: space.xxl, gap: space.sm }}>
      <MaterialCommunityIcons name={icon} size={40} color={p.textFaint} />
      <Text style={[t.heading, { color: p.text, marginTop: space.sm }]}>{title}</Text>
      <Text style={[t.body, { color: p.textMuted, textAlign: 'center', maxWidth: 280 }]}>{body}</Text>
    </View>
  );
}
