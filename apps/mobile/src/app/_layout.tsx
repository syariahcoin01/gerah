import { useFonts } from 'expo-font';
import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Pressable, Text } from 'react-native';
import { font, FONT_MODULES, injectWebFonts } from '../lib/fonts';
import { C, SKY } from '../lib/theme';

/** Tombol kembali yang tetap muncul di web walau riwayat navigasi hilang (mis. setelah refresh). */
function BackToHome() {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Kembali ke beranda"
      onPress={() => (router.canGoBack() ? router.back() : router.replace('/beranda'))}
      style={{ paddingHorizontal: 12, paddingVertical: 6 }}>
      <Text style={{ fontSize: 16, color: C.ink, ...font('700') }}>‹ Beranda</Text>
    </Pressable>
  );
}

export default function RootLayout() {
  const [loaded, error] = useFonts(FONT_MODULES);
  useEffect(() => { injectWebFonts(); }, []);
  // jangan tahan aplikasi bila font gagal dimuat: pakai huruf sistem
  if (!loaded && !error) return null;

  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: SKY.soft[0] },
          headerShadowVisible: false,
          headerTintColor: C.ink,
          headerTitleStyle: { ...font('800'), fontSize: 18 } as any,
          contentStyle: { backgroundColor: SKY.soft[2] },
          headerBackVisible: false,
          headerLeft: () => <BackToHome />,
        }}>
        <Stack.Screen name="index" options={{ title: 'Gerah', headerLeft: () => null }} />
        <Stack.Screen name="beranda" options={{ title: 'Gerah', headerLeft: () => null }} />
        <Stack.Screen name="timeline" options={{ title: 'Timeline per jam' }} />
        <Stack.Screen name="checklist" options={{ title: 'Checklist mandor' }} />
        <Stack.Screen name="p3k" options={{ title: 'Gejala & P3K panas' }} />
        <Stack.Screen name="laporan" options={{ title: 'Laporan mingguan' }} />
        <Stack.Screen name="profil" options={{ title: 'Pengaturan' }} />
      </Stack>
    </>
  );
}
