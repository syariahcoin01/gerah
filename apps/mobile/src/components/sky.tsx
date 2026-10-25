/**
 * Latar langit Gerah. Warna mengikuti level risiko; matahari makin besar dan
 * makin menyala saat level naik. Semua hiasan dibuat dari View (tanpa gambar)
 * agar ringan di HP murah, dan tidak menangkap sentuhan (pointerEvents none).
 */
import { LinearGradient } from 'expo-linear-gradient';
import { ReactNode, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View, ViewStyle } from 'react-native';
import { Mood, SKY } from '../lib/theme';

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduced).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => sub?.remove?.();
  }, []);
  return reduced;
}

function Sun({ level }: { level: number }) {
  // level 1 → kecil & lembut; level 5 → besar & menyala
  const size = 70 + level * 16;
  const glow = 0.25 + level * 0.08;
  const core = level >= 4 ? '#FFB703' : '#FFD23F';
  return (
    <View pointerEvents="none" style={[st.sunWrap, { width: size * 2.2, height: size * 2.2, top: -size * 0.15, right: -size * 0.55 }]}>
      <View style={[st.disc, { width: size * 2.2, height: size * 2.2, backgroundColor: `rgba(255,236,150,${glow * 0.5})` }]} />
      <View style={[st.disc, { width: size * 1.6, height: size * 1.6, backgroundColor: `rgba(255,220,90,${glow})` }]} />
      <View style={[st.disc, { width: size, height: size, backgroundColor: core }]} />
    </View>
  );
}

function Moon() {
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 36, right: 34 }}>
      <View style={[st.disc, { width: 64, height: 64, backgroundColor: '#FFF6D8' }]} />
      <View style={[st.disc, { width: 64, height: 64, backgroundColor: '#14295F', left: 18, top: -8 }]} />
    </View>
  );
}

const STARS = [[12, 8], [28, 22], [46, 6], [64, 30], [8, 40], [36, 46], [72, 14], [56, 52], [20, 62], [84, 44]];
function Stars() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {STARS.map(([x, y], i) => (
        <View key={i} style={{
          position: 'absolute', left: `${x}%`, top: `${y}%` as any, width: i % 3 ? 2 : 3, height: i % 3 ? 2 : 3,
          borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.85)',
        }} />
      ))}
    </View>
  );
}

function Cloud({ top, scale, opacity, duration, delay, reduced, tint = '#FFFFFF' }: {
  top: number; scale: number; opacity: number; duration: number; delay: number; reduced: boolean; tint?: string;
}) {
  const x = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduced) return;
    const anim = Animated.loop(Animated.sequence([
      Animated.delay(delay),
      Animated.timing(x, { toValue: 1, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(x, { toValue: 0, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    anim.start();
    return () => anim.stop();
  }, [reduced, x, duration, delay]);
  const translateX = x.interpolate({ inputRange: [0, 1], outputRange: [0, -30 * scale] });
  const w = 120 * scale;
  return (
    <Animated.View pointerEvents="none" style={{ position: 'absolute', top, right: `${4 + delay / 400}%` as any, opacity, transform: [{ translateX }] }}>
      <View style={{ width: w, height: w * 0.42 }}>
        <View style={[st.puff, { backgroundColor: tint, width: w * 0.45, height: w * 0.45, left: w * 0.12, top: w * 0.02 }]} />
        <View style={[st.puff, { backgroundColor: tint, width: w * 0.55, height: w * 0.55, left: w * 0.36, top: -w * 0.1 }]} />
        <View style={[st.puff, { backgroundColor: tint, width: w, height: w * 0.26, left: 0, top: w * 0.18, borderRadius: w }]} />
      </View>
    </Animated.View>
  );
}

const DROPS = Array.from({ length: 22 }, (_, i) => [(i * 37) % 100, (i * 53) % 70 + 10]);
function Rain() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {DROPS.map(([x, y], i) => (
        <View key={i} style={{
          position: 'absolute', left: `${x}%`, top: `${y}%` as any, width: 2, height: 14, borderRadius: 1,
          backgroundColor: 'rgba(255,255,255,0.55)', transform: [{ rotate: '14deg' }],
        }} />
      ))}
    </View>
  );
}

/** Latar langit penuh. mood: level 1–5, 'night', 'rain', atau 'soft' (layar biasa). */
export function Sky({ mood, children, style }: { mood: Mood; children?: ReactNode; style?: ViewStyle }) {
  const reduced = useReducedMotion();
  const colors = SKY[String(mood)];
  const level = typeof mood === 'number' ? mood : 0;
  return (
    <View style={[{ flex: 1, overflow: 'hidden' }, style]}>
      <LinearGradient colors={colors} locations={[0, 0.45, 1]} style={StyleSheet.absoluteFill} />
      {mood === 'night' ? <><Stars /><Moon /></> : null}
      {level > 0 ? <Sun level={level} /> : null}
      {mood === 'soft' ? <Sun level={1} /> : null}
      {mood === 'rain' ? (
        <>
          <Cloud top={150} scale={1.1} opacity={0.85} duration={9000} delay={0} reduced={reduced} tint="#E6EDF5" />
          <Cloud top={240} scale={0.75} opacity={0.7} duration={11000} delay={1500} reduced={reduced} tint="#D3DEEA" />
          <Rain />
        </>
      ) : (
        <>
          <Cloud top={150} scale={level >= 4 ? 0.7 : 0.95} opacity={level >= 4 ? 0.45 : 0.8} duration={12000} delay={0} reduced={reduced} />
          <Cloud top={235} scale={0.6} opacity={mood === 'night' ? 0.2 : 0.6} duration={15000} delay={3000} reduced={reduced} />
        </>
      )}
      {children}
    </View>
  );
}

const st = StyleSheet.create({
  sunWrap: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  disc: { position: 'absolute', borderRadius: 999 },
  puff: { position: 'absolute', borderRadius: 999 },
});
