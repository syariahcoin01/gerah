import { router, Stack, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Sky } from '../components/sky';
import { Button, Card, H2, P, s, SpeakButton } from '../components/ui';
import { nowText, tomorrowText } from '../lib/spoken';
import { fetchForecast, Forecast, hourLabel, personalLevel } from '../lib/api';
import { remindersSupported, scheduleFromForecast } from '../lib/reminders';
import { roleInfo } from '../lib/roles';
import { loadSettings, Settings } from '../lib/storage';
import {
  dayName, heavyAdvice, summarizeDay, todayWib, tomorrowWib, WORK_END, whatsappText, whatsappUrl, wibHour,
} from '../lib/summary';
import { font } from '../lib/fonts';
import { C, isRainy, levelInfo, Mood, skyIsDark, skyTop, weatherIcon } from '../lib/theme';

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
            <Text style={{ color: C.muted, fontSize: 11, fontVariant: ['tabular-nums'], ...font('600') }}>
              {String(h.hour).padStart(2, '0')}
            </Text>
          </View>
        ))}
      </View>
      <Text style={{ color: C.muted, fontSize: 11, textAlign: 'right', ...font('500') }}>jam (WIB)</Text>
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
  const hourNow = now ? wibHour(now.ts) : wibHour(new Date());
  const night = hourNow < 6 || hourNow >= 18;
  const mood: Mood = !now ? 'soft' : night ? 'night' : isRainy(now.weather) ? 'rain' : (Math.max(1, lvl) as Mood);
  const dark = skyIsDark(mood);
  const onSky = dark ? '#FFFFFF' : C.ink;
  const onSkyMuted = dark ? 'rgba(255,255,255,0.85)' : C.muted;
  const textShadow = dark ? { textShadowColor: 'rgba(0,0,0,0.25)', textShadowRadius: 8 } : null;
  const role = roleInfo(st.role);

  return (
    <Sky mood={mood}>
      <Stack.Screen options={{
        headerStyle: { backgroundColor: skyTop(mood) },
        headerTintColor: onSky,
        headerTitleStyle: { ...font('800'), fontSize: 18, color: onSky } as any,
      }} />
      <StatusBar style={dark ? 'light' : 'dark'} />
    <ScrollView style={{ backgroundColor: 'transparent' }} contentContainerStyle={s.screen}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={onSky} />}>
      <View style={s.inner}>
        <View style={[b.pill, { backgroundColor: dark ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.7)' }]}>
          <Text style={[b.pillText, { color: onSky }]} numberOfLines={1}>
            📍 {f?.lokasi.name ?? st.locationName}, {f?.lokasi.kecamatan}   {role.icon} {role.label}
          </Text>
        </View>
        {err ? <Card><P>{err}</P></Card> : null}

        {now && (
          <>
            <View style={b.hero} accessibilityRole="header">
              <Text style={[b.heroSmall, { color: onSkyMuted }, textShadow]}>
                Sekarang, {hourLabel(now.ts)} WIB · {weatherIcon(now.weather, night)} {now.weather ?? ''}
              </Text>
              <Text style={[b.heroLevel, { color: onSky }, textShadow]}>{info.label}</Text>
              <View style={b.heroRow}>
                <View style={[b.levelChip, { backgroundColor: info.color }]}>
                  <Text style={b.levelChipText}>Level {lvl} dari 5{st.lang === 'su' ? ` · ${info.su}` : ''}</Text>
                </View>
                {adjusted ? <Text style={[b.heroSmall, { color: onSkyMuted }]}>disesuaikan profil Anda</Text> : null}
              </View>
              <Text style={[b.heroWbgt, { color: onSky }, textShadow]}>
                WBGT {now.wbgt_matahari ?? '–'}° di bawah matahari, {now.wbgt_teduh ?? '–'}° di teduh
              </Text>
              <View style={{ marginTop: 6 }}>
                <SpeakButton id="sekarang" light={dark} label={st.lang === 'su' ? 'Dangukeun' : 'Dengarkan'}
                  text={() => nowText(f!, st, lvl)} />
              </View>
            </View>

            <Card style={b.metrics}>
              <View style={b.metric}>
                <Text style={b.metricLabel}>Suhu</Text>
                <Text style={b.metricValue}>{now.t ?? '–'}°</Text>
              </View>
              <View style={b.sep} />
              <View style={b.metric}>
                <Text style={b.metricLabel}>Terasa seperti</Text>
                <Text style={b.metricValue}>{now.terasa_seperti ?? '–'}°</Text>
              </View>
              <View style={b.sep} />
              <View style={b.metric}>
                <Text style={b.metricLabel}>Indeks UV</Text>
                <Text style={[b.metricValue, { color: now.uv?.color ?? C.ink }]}>{now.uv?.value ?? '–'}</Text>
                <Text style={b.metricSub}>{now.uv?.label ?? 'tidak tersedia'}</Text>
              </View>
            </Card>

            <Card style={{ borderLeftWidth: 6, borderLeftColor: info.color }}>
              <H2>Yang perlu dilakukan</H2>
              {now.saran.peran ? <P>• {now.saran.peran}</P> : null}
              <P>• {now.saran.umum}</P>
              {st.lang === 'su' ? <P muted>🗣 {now.saran.sunda}</P> : null}
              {st.menstruating ? <P>• Sedang haid: minum air putih lebih sering dan istirahat bila pusing atau lemas.</P> : null}
              {wibHour(new Date()) < WORK_END ? (
                <Button title="📤 Bagikan ke WhatsApp" kind={roleInfo(st.role).teamTools ? 'primary' : 'ghost'}
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
                  <SpeakButton id="besok" label={st.lang === 'su' ? 'Dangukeun' : 'Dengarkan'}
                    text={() => tomorrowText(d, st)} />
                  <Button title="📤 Bagikan jadwal besok" kind="ghost" onPress={() => share('besok')} />
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
            ['/peta', '🗺️ Peta panas kota'],
            ...(roleInfo(st.role).teamTools ? [['/checklist', '✅ Checklist mandor'], ['/laporan', '📊 Laporan mingguan']] : []),
            ['/p3k', '🩺 Gejala & P3K'],
            ['/profil', '⚙️ Pengaturan'],
          ].map(([href, label]) => (
            <Pressable key={href} accessibilityRole="link" onPress={() => router.push(href as any)}
              style={({ pressed }) => [s.choice, { flexGrow: 1, flexBasis: '45%' }, pressed && { opacity: 0.85 }]}>
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
          <Text style={{ color: C.muted, fontSize: 12, textAlign: 'center', ...font('500') }}>
            Dicek pukul {checkedAt.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' })}
            {' · '}data server pukul {hourLabel(f.diperbarui)} WIB (diperbarui tiap jam)
          </Text>
        ) : null}
      </View>
    </ScrollView>
    </Sky>
  );
}

const b = StyleSheet.create({
  pill: { alignSelf: 'flex-start', borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12, maxWidth: '100%' },
  pillText: { fontSize: 13, ...font('600') },
  hero: { paddingTop: 18, paddingBottom: 10, gap: 6 },
  heroSmall: { fontSize: 14, ...font('600') },
  heroLevel: { fontSize: 64, lineHeight: 70, letterSpacing: -1.5, ...font('800') },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  levelChip: { borderRadius: 999, paddingVertical: 4, paddingHorizontal: 12, borderWidth: 2, borderColor: 'rgba(255,255,255,0.9)' },
  levelChipText: { color: '#fff', fontSize: 13, ...font('700') },
  heroWbgt: { fontSize: 16, lineHeight: 22, ...font('600'), marginTop: 4 },
  metrics: { flexDirection: 'row', alignItems: 'stretch', paddingVertical: 14 },
  metric: { flex: 1, alignItems: 'center', gap: 2 },
  sep: { width: 1, backgroundColor: C.line, marginVertical: 4 },
  metricLabel: { fontSize: 12, color: C.muted, textAlign: 'center', ...font('600') },
  metricValue: { fontSize: 28, color: C.ink, ...font('800') },
  metricSub: { fontSize: 11, color: C.muted, ...font('500') },
});
