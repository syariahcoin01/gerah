import { ReactNode } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View, ViewStyle } from 'react-native';
import { font } from '../lib/fonts';
import { C, Mood } from '../lib/theme';
import { Sky } from './sky';

/** Layar standar: langit lembut di belakang, isi dalam kolom selebar maks 560. */
export function Screen({ children, mood = 'soft' }: { children: ReactNode; mood?: Mood }) {
  return (
    <Sky mood={mood}>
      <ScrollView style={{ backgroundColor: 'transparent' }} contentContainerStyle={s.screen}>
        <View style={s.inner}>{children}</View>
      </ScrollView>
    </Sky>
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
      style={({ pressed }) => [s.choice, selected && s.choiceOn, pressed && { opacity: 0.85 }]}>
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

const shadow = Platform.select<ViewStyle>({
  web: { boxShadow: '0 6px 20px rgba(14,42,71,0.10)' } as ViewStyle,
  default: { shadowColor: '#0E2A47', shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 3 },
});

export const s = StyleSheet.create({
  screen: { padding: 16, paddingBottom: 48, alignItems: 'center' },
  inner: { width: '100%', maxWidth: 560, gap: 12 },
  card: { backgroundColor: C.card, borderRadius: 22, padding: 16, gap: 6, ...shadow },
  h1: { fontSize: 28, lineHeight: 34, color: C.ink, letterSpacing: -0.4, ...font('800') },
  h2: { fontSize: 18, lineHeight: 24, color: C.ink, ...font('700') },
  p: { fontSize: 15, lineHeight: 22, color: C.ink, ...font('400') },
  btn: { backgroundColor: C.accent, borderRadius: 999, paddingVertical: 14, paddingHorizontal: 20, alignItems: 'center', ...shadow },
  btnGhost: { backgroundColor: 'rgba(255,255,255,0.9)', borderWidth: 2, borderColor: C.accent },
  btnText: { color: '#fff', fontSize: 16, ...font('700') },
  choice: { borderWidth: 2, borderColor: 'transparent', borderRadius: 18, padding: 14, backgroundColor: C.card, ...shadow },
  choiceOn: { borderColor: C.accent, backgroundColor: '#FFF4DC' },
  choiceLabel: { fontSize: 16, color: C.ink, ...font('700') },
  choiceDesc: { fontSize: 13, lineHeight: 18, color: C.muted, marginTop: 2, ...font('400') },
  toggle: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
});
