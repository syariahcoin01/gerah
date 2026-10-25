/** Kalimat yang dibacakan tombol 🔊 (Indonesia atau Sunda sesuai pengaturan). */
import { Forecast } from './api';
import { roleInfo } from './roles';
import { Settings } from './storage';
import { dayName, DaySummary, heavyAdvice } from './summary';
import { levelInfo } from './theme';

const r1 = (x: number | null | undefined) => (x == null ? null : Math.round(x));

export function nowText(f: Forecast, st: Settings, level: number): string {
  const n = f.sekarang;
  const info = levelInfo(level);
  const tempo = [r1(n.t), r1(n.terasa_seperti)];
  if (st.lang === 'su') {
    return [
      `Résiko panas ayeuna di ${f.lokasi.name}: ${info.su}. Level ${level} tina 5.`,
      tempo[0] != null ? `Suhu ${tempo[0]} derajat, karasa siga ${tempo[1]} derajat.` : '',
      n.saran.sunda,
      level >= 4 ? 'Upami aya nu lieur, kapiuhan, atanapi kejang, telepon 119.' : '',
    ].filter(Boolean).join(' ');
  }
  return [
    `Risiko panas sekarang di ${f.lokasi.name}: ${info.label}. Level ${level} dari 5.`,
    tempo[0] != null ? `Suhu ${tempo[0]} derajat, terasa seperti ${tempo[1]} derajat.` : '',
    n.saran.peran,
    n.saran.umum,
    st.menstruating ? 'Sedang haid: minum air putih lebih sering dan istirahat bila pusing atau lemas.' : '',
    level >= 4 ? 'Bila ada yang bingung, pingsan, atau kejang, segera dinginkan tubuh dan telepon 119.' : '',
  ].filter(Boolean).join(' ');
}

export function tomorrowText(d: DaySummary, st: Settings): string {
  const peak = d.peak;
  const role = roleInfo(st.role);
  if (st.lang === 'su') {
    return [
      `Énjing, ${dayName(d.date)}.`,
      peak ? `Panas pangluhurna ${levelInfo(peak.level).su}, kira-kira jam ${peak.hour}.` : '',
      d.heavyOk.length
        ? `Padamelan beurat langkung saé jam ${d.heavyOk.map((b) => b.from === b.to ? `${b.from}` : `${b.from} dugi ka jam ${b.to}`).join(', sareng jam ')}.`
        : 'Teu aya jam nu aman kanggo padamelan beurat di luar.',
    ].filter(Boolean).join(' ');
  }
  return [
    `Besok, ${dayName(d.date)}.`,
    peak ? `Puncak panas ${levelInfo(peak.level).label}, sekitar jam ${peak.hour}.` : '',
    heavyAdvice(d).replace('Aktivitas berat', role.group === 'kerja' ? 'Kerja berat' : 'Aktivitas berat'),
  ].filter(Boolean).join(' ');
}
