/**
 * Membacakan saran dengan suara (text-to-speech bawaan perangkat, gratis & offline
 * di Android/iOS; di browser memakai Web Speech API).
 * - Memilih suara bahasa Indonesia bila tersedia.
 * - Bahasa Sunda dibacakan dengan suara Indonesia (hampir tidak ada perangkat yang
 *   punya suara Sunda; ejaan Sunda cukup terbaca dengan lafal Indonesia).
 * - Teks dipecah per kalimat agar tidak terpotong di Chrome.
 */
import * as Speech from 'expo-speech';
import { useEffect, useState } from 'react';

let idVoice: string | undefined;
let voiceChecked = false;
let hasIndonesian = false;

async function pickVoice(): Promise<string | undefined> {
  if (voiceChecked) return idVoice;
  voiceChecked = true;
  try {
    const voices = await Promise.race([
      Speech.getAvailableVoicesAsync(),
      new Promise<Speech.Voice[]>((r) => setTimeout(() => r([]), 1500)),
    ]);
    const id = voices.filter((v) => /^(id|in)([-_]|$)/i.test(v.language));
    hasIndonesian = id.length > 0;
    // utamakan suara lokal/berkualitas lebih baik bila ada
    const best = id.find((v) => /enhanced|google|natural/i.test(`${v.name} ${v.quality}`)) ?? id[0];
    idVoice = best?.identifier;
  } catch {
    idVoice = undefined;
  }
  return idVoice;
}

/** Apakah perangkat punya suara bahasa Indonesia (diketahui setelah sekali membaca). */
export const indonesianVoiceAvailable = () => (voiceChecked ? hasIndonesian : undefined);

const hh = (h: string) => String(Number(h));
const MONTHS = {
  Jan: 'Januari', Feb: 'Februari', Mar: 'Maret', Apr: 'April', Mei: 'Mei', Jun: 'Juni', Jul: 'Juli',
  Agu: 'Agustus', Agt: 'Agustus', Sep: 'September', Okt: 'Oktober', Nov: 'November', Des: 'Desember',
};

/** Ubah simbol & singkatan menjadi kata agar enak didengar. */
export function toSpoken(text: string): string {
  return text
    .replace(/\p{Extended_Pictographic}|️|‍/gu, '')            // emoji
    .replace(/(\d{1,2})\.00\s*[–-]\s*(\d{1,2})\.00/g, (_, a, b) => `jam ${hh(a)} sampai jam ${hh(b)}`)
    .replace(/(\d{1,2})\.00\s*WIB/g, (_, a) => `jam ${hh(a)}`)
    .replace(/(\d{1,2})\.00/g, (_, a) => `jam ${hh(a)}`)
    .replace(/\b(pukul|jam)\s+jam\b/gi, 'jam')
    .replace(/\b(\d{1,2}) (Jan|Feb|Mar|Apr|Mei|Jun|Jul|Agu|Agt|Sep|Okt|Nov|Des)\b/g, (_, d, m) =>
      `${d} ${MONTHS[m as keyof typeof MONTHS]}`)
    .replace(/([A-Za-zÀ-ž])\/([A-Za-zÀ-ž])/g, '$1 atau $2')
    .replace(/(\d+)\.(\d+)\s*°\s*C?/g, '$1 koma $2 derajat')
    .replace(/(\d+)\s*°\s*C?/g, '$1 derajat')
    .replace(/(\d+),(\d+)/g, '$1 koma $2')
    .replace(/±\s*/g, 'sekitar ')
    .replace(/≥\s*/g, 'paling sedikit ')
    .replace(/(\d+)\s*ml\b/gi, '$1 mililiter')
    .replace(/(\d+)\s*L\b/g, '$1 liter')
    .replace(/\/orang\/jam/g, ' per orang per jam')
    .replace(/\/jam/g, ' per jam')
    .replace(/(\d+)\s*mnt\b/g, '$1 menit')
    .replace(/(\d+):(\d+) menit/g, '$1 menit kerja, $2 menit istirahat')
    .replace(/\bWBGT\b/g, 'indeks panas')
    .replace(/\bUV\b/g, 'U V')
    .replace(/\bP3K\b/g, 'P 3 K')
    .replace(/\bPJOK\b/g, 'P J O K')
    .replace(/\b119\b/g, 'satu satu sembilan')
    .replace(/[•·]/g, '. ')
    .replace(/\s*&\s*/g, ' dan ')
    .replace(/\s+/g, ' ')
    .trim();
}

let session = 0;

/** Bacakan teks. onDone dipanggil saat selesai atau dihentikan. */
export async function speak(text: string, onDone?: () => void) {
  const my = ++session;
  const finish = () => { if (my === session) onDone?.(); };
  try {
    await Speech.stop();
    const voice = await pickVoice();
    // pecah per kalimat (tanpa lookbehind regex agar aman di semua mesin JS)
    const parts = (toSpoken(text).match(/[^.!?]+[.!?]*/g) ?? []).map((x) => x.trim()).filter((x) => x.length > 1);
    if (!parts.length) return finish();
    parts.forEach((p, i) => {
      const last = i === parts.length - 1;
      Speech.speak(p, {
        language: 'id-ID',
        voice,
        rate: 0.9,
        onDone: last ? finish : undefined,
        onStopped: last ? finish : undefined,
        onError: finish,
      });
    });
  } catch {
    // mesin suara tidak tersedia / gagal: kembalikan tombol ke keadaan semula
    finish();
  }
}

export async function stopSpeaking() {
  session++;
  await Speech.stop();
}

/** Status bicara untuk satu tombol: hanya satu teks yang dibacakan pada satu waktu. */
let activeKey: string | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

export function useSpeaker(key: string) {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);
  useEffect(() => () => { if (activeKey === key) { activeKey = null; Speech.stop(); } }, [key]);
  const speaking = activeKey === key;
  const toggle = (text: string) => {
    if (speaking) {
      activeKey = null; notify(); stopSpeaking();
      return;
    }
    activeKey = key; notify();
    speak(text, () => { if (activeKey === key) { activeKey = null; notify(); } });
  };
  return { speaking, toggle };
}
