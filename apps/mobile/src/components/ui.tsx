import { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View, ViewStyle } from 'react-native';
import { C } from '../lib/theme';

export function Screen({ children }: { children: ReactNode }) {
  return (
    <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={s.screen}>
      <View style={s.inner}>{children}</View>
    </ScrollView>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[s.card, style]}>{children}</View>;
}

export const H1 = ({ children }: { children: ReactNode }) => <Text style={s.h1}>{children}</Text>;
export const H2 = ({ children }: { children: ReactNode }) => <Text style={s.h2}>{children}</Text>;
export const P = ({ children, muted }: { children: ReactNode; muted?: boolean }) => (
  <Text style={[s.p, muted && { color: C.muted }]}>{children}</Text>
);

export function Button({ title, onPress, kind = 'primary', disabled }: {
  title: string; onPress: () => void; kind?: 'primary' | 'ghost'; disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [s.btn, kind === 'ghost' && s.btnGhost, (pressed || disabled) && { opacity: 0.6 }]}>
      <Text style={[s.btnText, kind === 'ghost' && { color: C.accent }]}>{title}</Text>
    </Pressable>
  );
}

export function Choice({ label, desc, selected, onPress }: {
  label: string; desc?: string; selected: boolean; onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} accessibilityRole="radio" accessibilityState={{ selected }}
      style={[s.choice, selected && { borderColor: C.accent, backgroundColor: '#FFEBD6' }]}>
      <Text style={s.choiceLabel}>{label}</Text>
      {desc ? <Text style={s.choiceDesc}>{desc}</Text> : null}
    </Pressable>
  );
}

export function Toggle({ label, desc, value, onChange }: {
  label: string; desc?: string; value: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <View style={s.toggle}>
      <View style={{ flex: 1, paddingRight: 12 }}>
        <Text style={s.choiceLabel}>{label}</Text>
        {desc ? <Text style={s.choiceDesc}>{desc}</Text> : null}
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: C.accent }} />
    </View>
  );
}

export const s = StyleSheet.create({
  screen: { padding: 16, paddingBottom: 48, alignItems: 'center' },
  inner: { width: '100%', maxWidth: 560, gap: 12 },
  card: { backgroundColor: C.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.line, gap: 6 },
  h1: { fontSize: 24, fontWeight: '800', color: C.ink },
  h2: { fontSize: 17, fontWeight: '700', color: C.ink },
  p: { fontSize: 15, lineHeight: 21, color: C.ink },
  btn: { backgroundColor: C.accent, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  btnGhost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: C.accent },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  choice: { borderWidth: 2, borderColor: C.line, borderRadius: 14, padding: 14, backgroundColor: C.card },
  choiceLabel: { fontSize: 16, fontWeight: '700', color: C.ink },
  choiceDesc: { fontSize: 13, color: C.muted, marginTop: 2 },
  toggle: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
});
