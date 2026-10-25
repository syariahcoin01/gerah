/** Token desain Gerah: langit = pengukur risiko. */
export const C = {
  bg: '#EAF6FF',          // langit pagi (latar layar biasa)
  card: 'rgba(255,255,255,0.92)',
  cardSolid: '#FFFFFF',
  ink: '#0E2A47',         // navy tinta
  muted: '#4F6B86',
  line: 'rgba(14,42,71,0.12)',
  accent: '#FF7A1A',      // jingga matahari (tombol utama)
  sky: '#38B6FF',
  sun: '#FFD23F',
};

/** Plus Jakarta Sans — dimuat di _layout.tsx. */
export const F = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  heavy: 'PlusJakartaSans_800ExtraBold',
};

export const LEVELS = [
  { level: 0, label: 'Tidak ada data', su: '—', color: '#8A9BB0' },
  { level: 1, label: 'Aman', su: 'Aman', color: '#1FA463' },
  { level: 2, label: 'Waspada', su: 'Ati-ati', color: '#E8A800' },
  { level: 3, label: 'Siaga', su: 'Siaga', color: '#FF7A1A' },
  { level: 4, label: 'Bahaya', su: 'Bahaya', color: '#E6334A' },
  { level: 5, label: 'Ekstrem', su: 'Bahaya pisan', color: '#8E2DE2' },
];

export const levelInfo = (l: number) => LEVELS[Math.max(0, Math.min(5, l))];

export type Mood = 'soft' | 'night' | 'rain' | 1 | 2 | 3 | 4 | 5;

/** Gradasi langit (atas → bawah) per suasana. */
export const SKY: Record<string, [string, string, string]> = {
  soft:  ['#BFE6FF', '#E3F4FF', '#F7FBFF'],
  1:     ['#2EA8FF', '#7FD0FF', '#E4F6FF'],   // Aman: biru cerah
  2:     ['#3BA6F5', '#FFD66B', '#FFF4CF'],   // Waspada: biru → keemasan
  3:     ['#FF8A3D', '#FFC266', '#FFEBCC'],   // Siaga: senja jingga
  4:     ['#F2434F', '#FF8F5A', '#FFE0C9'],   // Bahaya: merah membara
  5:     ['#7B2FE0', '#E8435A', '#FFD3B8'],   // Ekstrem: ungu-merah
  night: ['#0A1A4A', '#22407F', '#4E6CB0'],
  rain:  ['#5B7896', '#93AECA', '#DDE8F3'],
};

/** Warna header = warna langit paling atas. */
export const skyTop = (m: Mood) => SKY[String(m)][0];

/** Teks di atas langit gelap harus putih. */
export const skyIsDark = (m: Mood) => m === 'night' || m === 'rain' || m === 4 || m === 5 || m === 3;

/** Ikon cuaca dari deskripsi BMKG. */
export function weatherIcon(desc: string | null | undefined, night = false): string {
  const d = (desc ?? '').toLowerCase();
  if (d.includes('petir')) return '⛈️';
  if (d.includes('hujan')) return '🌧️';
  if (d.includes('kabut') || d.includes('asap')) return '🌫️';
  if (d.includes('cerah berawan')) return night ? '🌙' : '🌤️';
  if (d.includes('berawan')) return '☁️';
  if (d.includes('cerah')) return night ? '🌙' : '☀️';
  return night ? '🌙' : '⛅';
}

export const isRainy = (desc?: string | null) => /hujan|petir/i.test(desc ?? '');
