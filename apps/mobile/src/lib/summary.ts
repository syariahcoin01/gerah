/**
 * Ringkasan harian (jam 07.00–17.00 WIB) untuk kartu "Besok", pesan WhatsApp,
 * dan notifikasi H-1 pukul 17.00. Semua dihitung di perangkat dari timeline.
 */
import { Forecast, personalLevel } from './api';
import { roleInfo, timelineText } from './roles';
import { Settings } from './storage';
import { levelInfo } from './theme';

const TZ = 'Asia/Jakarta';
export const WORK_START = 7;
export const WORK_END = 17;

export const wibDate = (d: string | Date) => new Date(d).toLocaleDateString('sv-SE', { timeZone: TZ });
export const wibHour = (d: string | Date) =>
  Number(new Date(d).toLocaleString('en-GB', { hour: '2-digit', hour12: false, timeZone: TZ })) % 24;
export const dayName = (date: string) =>
  new Date(`${date}T12:00:00+07:00`).toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'short', timeZone: TZ,
  });
export const tomorrowWib = (now = new Date()) => wibDate(new Date(now.getTime() + 24 * 3600_000));
export const todayWib = (now = new Date()) => wibDate(now);

export type Block = { from: number; to: number; level: number };
export type DaySummary = {
  date: string;
  hours: { hour: number; level: number; wbgt: number }[];
  blocks: Block[];
  peak?: { hour: number; level: number };
  heavyOk: Block[]; // rentang jam aman untuk kerja/aktivitas berat (level ≤ 2)
};

export function summarizeDay(f: Forecast, s: Settings, date: string): DaySummary {
  const hours = f.timeline
    .filter((h) => wibDate(h.ts) === date)
    .map((h) => ({ hour: wibHour(h.ts), level: personalLevel(h.level, s), wbgt: h.wbgt_matahari ?? 0 }))
    .filter((h) => h.hour >= WORK_START && h.hour <= WORK_END && h.level > 0)
    .sort((a, b) => a.hour - b.hour);

  const blocks: Block[] = [];
  for (const h of hours) {
    const last = blocks[blocks.length - 1];
    if (last && last.level === h.level && last.to === h.hour - 1) last.to = h.hour;
    else blocks.push({ from: h.hour, to: h.hour, level: h.level });
  }
  // puncak = level tertinggi; bila sama, WBGT tertinggi (sama dengan puncak_24jam di server)
  const peak = hours.reduce<(typeof hours)[number] | undefined>(
    (p, h) => (!p || h.level > p.level || (h.level === p.level && h.wbgt > p.wbgt) ? h : p), undefined);
  // gabungkan jam berurutan dengan level ≤ 2 (Aman/Waspada) menjadi satu rentang
  const heavyOk: Block[] = [];
  for (const h of hours.filter((x) => x.level <= 2)) {
    const last = heavyOk[heavyOk.length - 1];
    if (last && last.to === h.hour - 1) { last.to = h.hour; last.level = Math.max(last.level, h.level); }
    else heavyOk.push({ from: h.hour, to: h.hour, level: h.level });
  }
  return { date, hours, blocks, peak, heavyOk };
}

const hh = (h: number) => `${String(h).padStart(2, '0')}.00`;
export const blockLabel = (b: Block) => (b.from === b.to ? hh(b.from) : `${hh(b.from)}–${hh(b.to)}`);
const DOT = ['⚪', '🟢', '🟡', '🟠', '🔴', '🟣'];

/** Kalimat singkat jam aman untuk aktivitas berat. */
export function heavyAdvice(d: DaySummary): string {
  if (!d.hours.length) return 'Belum ada data untuk hari itu.';
  if (!d.peak || d.peak.level <= 2) return 'Sepanjang hari aman untuk aktivitas berat (tetap minum teratur).';
  if (!d.heavyOk.length) return 'Tidak ada jam yang aman untuk aktivitas berat di luar ruangan.';
  return `Aktivitas berat sebaiknya pukul ${d.heavyOk.map(blockLabel).join(', ')}.`;
}

/** Pesan WhatsApp siap kirim (format tebal/miring WA). */
export function whatsappText(f: Forecast, s: Settings, d: DaySummary, kind: 'hari ini' | 'besok'): string {
  const role = roleInfo(s.role);
  const lines = [
    `☀️ *Info Panas Gerah* — ${kind}, ${dayName(d.date)}`,
    `📍 ${f.lokasi.name}, Kec. ${f.lokasi.kecamatan}`,
  ];
  if (d.peak) lines.push(`Puncak: *${levelInfo(d.peak.level).label}* sekitar pukul ${hh(d.peak.hour)} WIB`);
  lines.push('', `*Jadwal ${hh(WORK_START)}–${hh(WORK_END)}:*`);
  for (const b of d.blocks) {
    const act = timelineText(s.role, b.level);
    lines.push(`${DOT[b.level]} ${blockLabel(b)} ${levelInfo(b.level).label} — ${act}`);
  }
  if (!d.blocks.length) lines.push('(sudah lewat jam kerja)');
  lines.push(
    '',
    `✅ ${heavyAdvice(d)}`,
    '💧 Minum 1 gelas (±250 ml) tiap 15–20 menit, jangan tunggu haus.',
  );
  if (role.group === 'kerja') lines.push('🤝 Kerja berpasangan, saling awasi. Pekerja baru: beban bertahap.');
  lines.push(
    '⚠️ Pusing, mual, bingung, atau kejang → berhenti, dinginkan tubuh, telepon 119.',
    '',
    '_Estimasi dari prakiraan BMKG & Open-Meteo, bukan pengukuran langsung._',
  );
  return lines.join('\n');
}

export const whatsappUrl = (text: string) => `https://wa.me/?text=${encodeURIComponent(text)}`;
