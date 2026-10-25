import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { Button, Card, H2, P, s } from '../components/ui';
import { fetchForecast, Forecast, hourLabel, personalLevel } from '../lib/api';
import { remindersSupported, scheduleFromForecast } from '../lib/reminders';
import { roleInfo } from '../lib/roles';
import { loadSettings, Settings } from '../lib/storage';
import {
  dayName, heavyAdvice, summarizeDay, todayWib, tomorrowWib, WORK_END, whatsappText, whatsappUrl, wibHour,
} from '../lib/summary';
import { C, levelInfo } from '../lib/theme';

const wibDate = (ts: string) => new Date(ts).toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' });
const sameDayWib = (a: string, b: string) => wibDate(a) === wibDate(b);

/** Strip warna per jam 07–17: satu kotak per jam, label jam di bawah setiap kotak. */
function DayStrip({ hours }: { hours: { hour: number; level: number }[] }) {
  if (!hours.length) return null;
  return (
    <View style={{ gap: 4 }}>
      <View style={{ flexDirection: 'row', gap: 2 }}>
        {hours.map((h, i) => (
          <View key={h.hour} style={{ flex: 1, alignItems: 'center', gap: 3 }}>
            <View
              accessibilityLabel={`Pukul ${h.hour}.00: ${levelInfo(h.level).label}`}
              style={{
                alignSelf: 'stretch', height: 16, backgroundColor: levelInfo(h.level).color,
                borderTopLeftRadius: i === 0 ? 8 : 0, borderBottomLeftRadius: i === 0 ? 8 : 0,
                borderTopRightRadius: i === hours.length - 1 ? 8 : 0,
                borderBottomRightRadius: i === hours.length - 1 ? 8 : 0,
              }}
            />
            <Text style={{ color: C.muted, fontSize: 11, fontVariant: ['tabular-nums'] }}>
              {String(h.hour).padStart(2, '0')}
            </Text>
          </View>
        ))}
      </View>
      <Text style={{ color: C.muted, fontSize: 11, textAlign: 'right' }}>jam (WIB)</Text>
    </View>
  );
}

export default function Beranda() {
  const [st, setSt] = useState<Settings | null>(null);
  const [f, setF] = useState<Forecast | null>(null);
  const [stale, setStale] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const settings = await loadSettings();
    setSt(settings);
    if (!settings.adm4) return router.replace('/');
    try {
      const r = await fetchForecast(settings);
      setF(r.data);
      setStale(r.stale);
      setErr(null);
      setCheckedAt(new Date());
      scheduleFromForecast(r.data, settings).catch(() => {});
    } catch {
      setErr('Data belum tersedia. Periksa koneksi lalu tekan Muat ulang.');
      setCheckedAt(new Date());
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  function share(kind: 'hari ini' | 'besok') {
    if (!f || !st) return;
    const date = kind === 'besok' ? tomorrowWib() : todayWib();
    const text = whatsappText(f, st, summarizeDay(f, st, date), kind);
    Linking.openURL(whatsappUrl(text)).catch(() => {});
  }

  if (!st || (!f && !err)) return <ActivityIndicator style={{ marginTop: 40 }} />;

  const now = f?.sekarang;
  const lvl = now ? personalLevel(now.level, st) : 0;
  const info = levelInfo(lvl);
  const adjusted = now && lvl !== now.level;

  return (
    <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={s.screen}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}>
      <View style={s.inner}>
        <Text style={{ color: C.muted }}>
          📍 {f?.lokasi.name ?? st.locationName}, {f?.lokasi.kecamatan} · {roleInfo(st.role).icon} {roleInfo(st.role).label}
        </Text>
        {err ? <Card><P>{err}</P></Card> : null}

        {now && (
          <>
            <View style={{ backgroundColor: info.color, borderRadius: 20, padding: 20, gap: 4 }}>
              <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>
                Risiko panas sekarang ({hourLabel(now.ts)} WIB){st.lang === 'su' ? ` · ${info.su}` : ''}
              </Text>
              <Text style={{ color: '#fff', fontSize: 40, fontWeight: '900' }}>{info.label}</Text>
              <Text style={{ color: '#fff', fontSize: 15 }}>
                WBGT di bawah matahari ≈ {now.wbgt_matahari ?? '–'} °C · di teduh ≈ {now.wbgt_teduh ?? '–'} °C
              </Text>
              {adjusted ? <Text style={{ color: '#fff', fontSize: 13 }}>Disesuaikan dengan profil pribadi Anda</Text> : null}
            </View>

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Card style={{ flex: 1 }}>
                <Text style={{ color: C.muted }}>Suhu</Text>
                <Text style={{ fontSize: 26, fontWeight: '800', color: C.ink }}>{now.t ?? '–'}°</Text>
                <Text style={{ color: C.muted }}>Terasa seperti {now.terasa_seperti ?? '–'}°</Text>
              </Card>
              <Card style={{ flex: 1 }}>
                <Text style={{ color: C.muted }}>Indeks UV</Text>
                <Text style={{ fontSize: 26, fontWeight: '800', color: now.uv?.color ?? C.ink }}>{now.uv?.value ?? '–'}</Text>
                <Text style={{ color: C.muted }}>{now.uv?.label ?? 'tidak tersedia'}</Text>
              </Card>
            </View>

            <Card>
              <H2>Yang perlu dilakukan</H2>
              {now.saran.peran ? <P>• {now.saran.peran}</P> : null}
              <P>• {now.saran.umum}</P>
              {st.lang === 'su' ? <P muted>🗣 {now.saran.sunda}</P> : null}
              {st.menstruating ? <P>• Sedang haid: minum air putih lebih sering dan istirahat bila pusing atau lemas.</P> : null}
              {wibHour(new Date()) < WORK_END ? (
                <Button title="📤 Bagikan jadwal hari ini ke WhatsApp" kind={roleInfo(st.role).teamTools ? 'primary' : 'ghost'}
                  onPress={() => share('hari ini')} />
              ) : null}
            </Card>

            {f!.puncak_24jam.level >= 3 && sameDayWib(f!.puncak_24jam.ts, now.ts) && (
              <Card style={{ borderColor: levelInfo(f!.puncak_24jam.level).color, borderWidth: 2 }}>
                {f!.puncak_24jam.ts === now.ts ? (
                  <P>
                    ⚠️ Saat ini adalah jam terpanas dalam 24 jam ke depan (
                    <Text style={{ fontWeight: '800' }}>{levelInfo(f!.puncak_24jam.level).label}</Text>). Tunda kerja
                    berat sampai level turun; cek Timeline per jam.
                  </P>
                ) : (
                  <P>
                    ⚠️ Puncak 24 jam: <Text style={{ fontWeight: '800' }}>{levelInfo(f!.puncak_24jam.level).label}</Text>{' '}
                    {sameDayWib(f!.puncak_24jam.ts, now.ts) ? 'hari ini' : <Text style={{ fontWeight: '800' }}>besok</Text>}{' '}
                    sekitar pukul {hourLabel(f!.puncak_24jam.ts)} WIB.{' '}
                    {sameDayWib(f!.puncak_24jam.ts, now.ts)
                      ? 'Jadwalkan kerja berat sebelum jam itu.'
                      : 'Rencanakan kerja berat besok di pagi hari, sebelum jam itu.'}
                  </P>
                )}
              </Card>
            )}

            {(() => {
              const d = summarizeDay(f!, st, tomorrowWib());
              if (!d.hours.length) return null;
              return (
                <Card>
                  <H2>📅 Besok, {dayName(d.date)}</H2>
                  <DayStrip hours={d.hours} />
                  {d.peak ? (
                    <P>
                      Puncak: <Text style={{ fontWeight: '800', color: levelInfo(d.peak.level).color }}>
                        {levelInfo(d.peak.level).label}</Text> sekitar pukul {String(d.peak.hour).padStart(2, '0')}.00 WIB.
                    </P>
                  ) : null}
                  <P>✅ {heavyAdvice(d)}</P>
                  <Button title="📤 Bagikan jadwal besok ke WhatsApp" kind="ghost" onPress={() => share('besok')} />
                  <Text style={{ color: C.muted, fontSize: 12 }}>
                    {remindersSupported
                      ? st.dayBeforeAlert ? '🔔 Notifikasi otomatis pukul 17.00 dan 05.30 bila besok Siaga atau lebih.' : '🔕 Notifikasi H-1 dimatikan (Pengaturan).'
                      : '🔔 Notifikasi pukul 17.00 tersedia di aplikasi Android/iOS.'}
                  </Text>
                </Card>
              );
            })()}
          </>
        )}

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {[
            ['/timeline', '🕒 Timeline per jam'],
            ...(roleInfo(st.role).teamTools ? [['/checklist', '✅ Checklist mandor'], ['/laporan', '📊 Laporan mingguan']] : []),
            ['/p3k', '🩺 Gejala & P3K'],
            ['/profil', '⚙️ Pengaturan'],
          ].map(([href, label]) => (
            <Pressable key={href} accessibilityRole="link" onPress={() => router.push(href as any)}
              style={[s.choice, { flexGrow: 1, flexBasis: '45%' }]}>
              <Text style={s.choiceLabel}>{label}</Text>
            </Pressable>
          ))}
        </View>

        {f && (
          <Card>
            <P muted>
              {stale ? '⚠️ Data lama (offline). ' : ''}{f.label}. Metode: {f.metode}. Sumber: {f.attribution.map((a) => a.name).join('; ')}.
              Diperbarui {new Date(f.diperbarui).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}.
              {f.sumber_data === 'demo' ? ' MODE DEMO: data sintetis, bukan prakiraan nyata.' : ''}
            </P>
          </Card>
        )}
        <Button title={loading ? 'Memuat…' : 'Muat ulang'} kind="ghost" onPress={load} disabled={loading} />
        {checkedAt && f ? (
          <Text style={{ color: C.muted, fontSize: 12, textAlign: 'center' }}>
            Dicek pukul {checkedAt.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' })}
            {' · '}data server pukul {hourLabel(f.diperbarui)} WIB (diperbarui tiap jam)
          </Text>
        ) : null}
      </View>
    </ScrollView>
  );
}
