export const C = {
  bg: '#FFF8EF',
  card: '#FFFFFF',
  ink: '#2A1A0F',
  muted: '#7A6656',
  line: '#EADBC8',
  accent: '#F07A1A',
};

export const LEVELS = [
  { level: 0, label: 'Tidak ada data', su: '—', color: '#9E9E9E' },
  { level: 1, label: 'Aman', su: 'Aman', color: '#2E9E5B' },
  { level: 2, label: 'Waspada', su: 'Ati-ati', color: '#E9B500' },
  { level: 3, label: 'Siaga', su: 'Siaga', color: '#F07A1A' },
  { level: 4, label: 'Bahaya', su: 'Bahaya', color: '#D7263D' },
  { level: 5, label: 'Ekstrem', su: 'Bahaya pisan', color: '#6B2C91' },
];

export const levelInfo = (l: number) => LEVELS[Math.max(0, Math.min(5, l))];
