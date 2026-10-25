import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Semua preferensi disimpan HANYA di perangkat.
 * Profil kesehatan (hamil, haid, lansia/penyakit kronis) tidak pernah dikirim
 * ke server — sesuai prinsip minimisasi data UU PDP No. 27/2022.
 */
import type { Role, Workload } from './roles';
export type { Role, Workload } from './roles';

export type Settings = {
  role?: Role;
  adm4?: string;
  locationName?: string;
  workload: Workload;
  acclimatized: boolean;
  waterReminder: boolean;
  dayBeforeAlert: boolean; // notifikasi H-1 pukul 17.00 + pagi 05.30 (Android/iOS)
  lang: 'id' | 'su';
  // profil sensitif (opsional, lokal)
  pregnant: boolean;
  menstruating: boolean;
  elderlyOrChronic: boolean;
};

export const DEFAULTS: Settings = {
  workload: 'sedang',
  acclimatized: true,
  waterReminder: false,
  dayBeforeAlert: true,
  lang: 'id',
  pregnant: false,
  menstruating: false,
  elderlyOrChronic: false,
};

const KEY = 'gerah.settings.v1';

export async function loadSettings(): Promise<Settings> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const s = { ...DEFAULTS, ...JSON.parse(raw) };
    if (s.role === 'pekerja') s.role = 'tukang'; // nama peran versi lama
    return s;
  } catch {
    return DEFAULTS;
  }
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = { ...(await loadSettings()), ...patch };
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  } catch {}
  return next;
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(`gerah.cache.${key}`);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export async function cacheSet(key: string, value: unknown) {
  try {
    await AsyncStorage.setItem(`gerah.cache.${key}`, JSON.stringify(value));
  } catch {}
}
