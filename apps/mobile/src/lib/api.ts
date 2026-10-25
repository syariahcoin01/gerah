import { Platform } from 'react-native';
import { cacheGet, cacheSet, Settings } from './storage';

// Web dilayani di domain yang sama dengan API (reverse proxy) → cukup '/api'.
// Untuk Android/iOS isi EXPO_PUBLIC_API_URL, mis. https://gerah.contoh.ac.id/api
export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ??
  (Platform.OS === 'web' ? '/api' : 'http://10.0.2.2:8080/api');

export type Hour = {
  ts: string;
  t: number | null;
  rh: number | null;
  ws: number | null;
  uv: { value: number; label: string; color: string } | null;
  weather: string | null;
  terasa_seperti: number | null;
  wbgt_matahari: number | null;
  wbgt_teduh: number | null;
  level: number;
  level_teduh: number;
};

export type Forecast = {
  lokasi: { adm4: string; name: string; kecamatan: string; kota: string };
  sekarang: Hour & {
    saran: {
      umum: string;
      peran: string;
      sunda: string;
      air_ml_per_15mnt: number;
      kerja_istirahat_menit: { kerja: number; istirahat: number };
    };
  };
  puncak_24jam: { ts: string; level: number; wbgt_matahari: number };
  timeline: Hour[];
  sumber_data: string;
  metode: string;
  diperbarui: string;
  label: string;
  disclaimer: string;
  attribution: { name: string; url: string; use: string }[];
};

export type Location = { adm4: string; name: string; kecamatan: string; kota: string; lat: number; lon: number };

async function getJSON<T>(path: string): Promise<T> {
  const r = await fetch(`${API_URL}${path}`);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json() as Promise<T>;
}

export const fetchLocations = () => getJSON<Location[]>('/v1/locations');

/** Ambil prakiraan; bila gagal (sinyal hilang), pakai cache terakhir. */
export async function fetchForecast(s: Settings): Promise<{ data: Forecast; stale: boolean }> {
  const q = new URLSearchParams({
    role: s.role ?? 'umum',
    workload: s.workload,
    acclimatized: String(s.acclimatized),
    hours: '48',
  });
  const key = `forecast.${s.adm4}.${q.toString()}`;
  try {
    const data = await getJSON<Forecast>(`/v1/forecast/${s.adm4}?${q}`);
    await cacheSet(key, data);
    return { data, stale: false };
  } catch (e) {
    const cached = await cacheGet<Forecast>(key);
    if (cached) return { data: cached, stale: true };
    throw e;
  }
}

export type HeatMapDay = {
  tanggal: string;
  ada_data: boolean;
  data: Record<string, { w: (number | null)[]; l: number[] }>;
};
export type HeatMap = {
  peran: string;
  beban_kerja: string;
  jam: number[];
  hari: HeatMapDay[];
  diperbarui: string | null;
  label: string;
  attribution: { name: string; url: string; use: string }[];
};

/** Level semua kelurahan per jam (07–17) hari ini & besok; cache untuk offline. */
export async function fetchHeatMap(s: Settings): Promise<{ data: HeatMap; stale: boolean }> {
  const q = new URLSearchParams({ role: s.role ?? 'umum', workload: s.workload, acclimatized: String(s.acclimatized) });
  const key = `map.${q.toString()}`;
  try {
    const data = await getJSON<HeatMap>(`/v1/map?${q}`);
    await cacheSet(key, data);
    return { data, stale: false };
  } catch (e) {
    const cached = await cacheGet<HeatMap>(key);
    if (cached) return { data: cached, stale: true };
    throw e;
  }
}

/** Penyesuaian pribadi — dihitung di perangkat, tidak dikirim ke server. */
export function personalLevel(level: number, s: Settings): number {
  if (!level) return 0;
  let l = level;
  if (s.pregnant || s.elderlyOrChronic) l += 1;
  return Math.max(1, Math.min(5, l));
}

export function nearestLocal(locs: Location[], lat: number, lon: number): Location | undefined {
  let best: Location | undefined;
  let bestD = Infinity;
  for (const l of locs) {
    const d = (l.lat - lat) ** 2 + ((l.lon - lon) * Math.cos((lat * Math.PI) / 180)) ** 2;
    if (d < bestD) {
      bestD = d;
      best = l;
    }
  }
  return best;
}

export const hourLabel = (ts: string) =>
  new Date(ts).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' });

export const dayLabel = (ts: string) =>
  new Date(ts).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Jakarta' });
