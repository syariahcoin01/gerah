/**
 * Plus Jakarta Sans untuk seluruh aplikasi.
 * - Android/iOS: tiap ketebalan adalah keluarga font tersendiri (PlusJakartaSans_700Bold, dst.).
 * - Web: semua ketebalan didaftarkan sebagai satu keluarga 'Plus Jakarta Sans' lewat @font-face,
 *   lalu dipasang global sehingga teks bawaan React Native Web ikut memakainya.
 */
import {
  PlusJakartaSans_400Regular, PlusJakartaSans_500Medium, PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold, PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { Asset } from 'expo-asset';
import { Platform, TextStyle } from 'react-native';

export const FONT_MODULES = {
  PlusJakartaSans_400Regular, PlusJakartaSans_500Medium, PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold, PlusJakartaSans_800ExtraBold,
};

const BY_WEIGHT: Record<string, keyof typeof FONT_MODULES> = {
  '400': 'PlusJakartaSans_400Regular',
  '500': 'PlusJakartaSans_500Medium',
  '600': 'PlusJakartaSans_600SemiBold',
  '700': 'PlusJakartaSans_700Bold',
  '800': 'PlusJakartaSans_800ExtraBold',
  '900': 'PlusJakartaSans_800ExtraBold',
};

/** Gaya huruf untuk ketebalan tertentu, aman di web maupun native. */
export function font(weight: '400' | '500' | '600' | '700' | '800' | '900' = '400'): TextStyle {
  if (Platform.OS === 'web') return { fontFamily: 'Plus Jakarta Sans', fontWeight: weight };
  return { fontFamily: BY_WEIGHT[weight] };
}

let injected = false;
export function injectWebFonts() {
  if (Platform.OS !== 'web' || injected || typeof document === 'undefined') return;
  injected = true;
  const faces = Object.entries(BY_WEIGHT)
    .filter(([w]) => w !== '900')
    .map(([w, name]) => {
      const uri = Asset.fromModule(FONT_MODULES[name]).uri;
      return `@font-face{font-family:'Plus Jakarta Sans';font-weight:${w};font-display:swap;src:url('${uri}') format('truetype');}`;
    })
    .join('\n');
  const style = document.createElement('style');
  style.setAttribute('data-gerah-fonts', '');
  style.textContent = `${faces}
#root, #root *, input, button { font-family: 'Plus Jakarta Sans', system-ui, -apple-system, 'Segoe UI', sans-serif; }`;
  document.head.appendChild(style);
}
