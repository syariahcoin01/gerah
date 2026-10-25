import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { Forecast, personalLevel } from './api';
import { Settings } from './storage';
import { heavyAdvice, summarizeDay, todayWib, tomorrowWib } from './summary';
import { levelInfo } from './theme';

/**
 * Pengingat minum & peringatan level dijadwalkan sebagai NOTIFIKASI LOKAL
 * dari timeline yang sudah diunduh, sehingga tetap berbunyi walau sinyal
 * hilang di lokasi proyek. Web: tidak didukung (pakai aplikasi Android/iOS).
 */
export const remindersSupported = Platform.OS === 'android' || Platform.OS === 'ios';

if (remindersSupported) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export async function ensurePermission(): Promise<boolean> {
  if (!remindersSupported) return false;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('gerah', {
      name: 'Peringatan panas & pengingat minum',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
  const cur = await Notifications.getPermissionsAsync();
  if (cur.granted) return true;
  const req = await Notifications.requestPermissionsAsync();
  return req.granted;
}

/** Waktu WIB tertentu pada tanggal YYYY-MM-DD, sebagai epoch ms. */
const atWib = (date: string, hour: number, minute = 0) =>
  new Date(`${date}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00+07:00`).getTime();

/**
 * Peringatan H-1 (meniru Heatstroke Alert Jepang): pukul 17.00 untuk besok,
 * dan pengingat pagi pukul 05.30. Hanya dikirim bila besok ada jam Siaga atau lebih,
 * supaya tidak menimbulkan kelelahan notifikasi.
 */
async function scheduleDayBefore(f: Forecast, s: Settings, now: number): Promise<number> {
  const tomorrow = tomorrowWib(new Date(now));
  const d = summarizeDay(f, s, tomorrow);
  if (!d.peak || d.peak.level < 3) return 0;
  const label = levelInfo(d.peak.level).label;
  const body = `Puncak ${label} sekitar pukul ${String(d.peak.hour).padStart(2, '0')}.00. ${heavyAdvice(d)}`;
  let n = 0;
  for (const [when, title] of [
    [atWib(todayWib(new Date(now)), 17), `Gerah besok: ${label} — rencanakan jadwal malam ini`],
    [atWib(tomorrow, 5, 30), `Gerah hari ini: ${label} — cek jadwal istirahat`],
  ] as const) {
    if (when <= now) continue;
    await Notifications.scheduleNotificationAsync({
      content: { title, body },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: when, channelId: 'gerah' },
    });
    n++;
  }
  return n;
}

export async function scheduleFromForecast(f: Forecast, s: Settings): Promise<number> {
  if (!remindersSupported) return 0;
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!s.waterReminder && !s.dayBeforeAlert) return 0;
  if (!(await ensurePermission())) return 0;

  const now = Date.now();
  let count = s.dayBeforeAlert ? await scheduleDayBefore(f, s, now) : 0;
  if (!s.waterReminder) return count;
  let alerted = false;
  for (const h of f.timeline.slice(0, 24)) {
    const start = new Date(h.ts).getTime();
    const hourWib = Number(
      new Date(h.ts).toLocaleString('en-GB', { hour: '2-digit', hour12: false, timeZone: 'Asia/Jakarta' }),
    );
    if (hourWib < 7 || hourWib > 17) continue;
    const lvl = personalLevel(h.level, s);
    const needWater = lvl >= 2 || s.menstruating;

    if (lvl >= 3 && !alerted && start - 15 * 60_000 > now) {
      alerted = true;
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `Gerah: level ${lvl >= 5 ? 'Ekstrem' : lvl === 4 ? 'Bahaya' : 'Siaga'} mulai pukul ${hourWib}.00`,
          body: 'Siapkan air, tempat teduh, dan jadwal istirahat. Buka Gerah untuk sarannya.',
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: start - 15 * 60_000, channelId: 'gerah' },
      });
      count++;
    }
    if (!needWater) continue;
    for (const offset of [0, 30]) {
      const at = start + offset * 60_000;
      if (at <= now) continue;
      await Notifications.scheduleNotificationAsync({
        content: {
          title: s.lang === 'su' ? 'Waktosna nginum cai 💧' : 'Waktunya minum 💧',
          body: s.lang === 'su' ? 'Nginum sagelas cai ayeuna, ulah ngantosan haus.' : 'Minum segelas air sekarang, jangan tunggu haus.',
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId: 'gerah' },
      });
      count++;
      if (count >= 40) return count; // iOS membatasi 64 notifikasi terjadwal
    }
  }
  return count;
}
