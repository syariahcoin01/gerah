import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, Text } from 'react-native';
import { C } from '../lib/theme';

/** Tombol kembali yang tetap muncul di web walau riwayat navigasi hilang (mis. setelah refresh). */
function BackToHome() {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Kembali ke beranda"
      onPress={() => (router.canGoBack() ? router.back() : router.replace('/beranda'))}
      style={{ paddingHorizontal: 12, paddingVertical: 6 }}>
      <Text style={{ fontSize: 16, fontWeight: '700', color: C.accent }}>‹ Beranda</Text>
    </Pressable>
  );
}

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: C.bg },
          headerTintColor: C.ink,
          headerTitleStyle: { fontWeight: '800' },
          contentStyle: { backgroundColor: C.bg },
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
