/**
 * Peta panas Kota Bandung: 151 kelurahan diwarnai sesuai level risiko,
 * dengan pemilih jam 07–17 dan tombol ▶ Putar untuk melihat panas "bergerak" sepanjang hari.
 */
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Path } from 'react-native-svg';
import MAP from '../../assets/map/bandung-kelurahan.json';
import { Button, Card, H2, P, Screen, SpeakButton } from '../components/ui';
import { fetchHeatMap, HeatMap, personalLevel } from '../lib/api';
import { font } from '../lib/fonts';
import { roleInfo } from '../lib/roles';
import { loadSettings, saveSettings, Settings } from '../lib/storage';
import { C, levelInfo, LEVELS } from '../lib/theme';

type Feature = { adm4: string; name: string; kec: string; d: string; c: [number, number] };
const FEATURES = MAP.features as Feature[];
const BY_ID = Object.fromEntries(FEATURES.map((f) => [f.adm4, f]));

const pad = (h: number) => `${String(h).padStart(2, '0')}.00`;

function nowWib() {
  const p = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', hour: 'numeric', hour12: false }).format(new Date());
  return Number(p) % 24;
}

function dayTitle(iso: string) {
  return new Date(`${iso}T12:00:00+07:00`).toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Jakarta',
  });
}

export default function Peta() {
  const [st, setSt] = useState<Settings | null>(null);
  const [m, setM] = useState<HeatMap | null>(null);
  const [stale, setStale] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [day, setDay] = useState(0);
  const [hi, setHi] = useState(6);          // indeks jam (0 = 07.00)
  const [sel, setSel] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    loadSettings().then(async (s) => {
      setSt(s);
      setSel(s.adm4 ?? null);
      const h = nowWib();
      // setelah 17.00 langsung tampilkan besok; sebelumnya tampilkan jam sekarang
      if (h >= 17) { setDay(1); setHi(6); } else setHi(Math.max(0, h - 7));
      try {
        const r = await fetchHeatMap(s);
        setM(r.data); setStale(r.stale);
      } catch {
        setErr('Peta belum bisa dimuat. Periksa sinyal lalu coba lagi.');
      }
    });
    return () => { if (timer.current) clearInterval(timer.current); };
  }, []);

  const hours = m?.jam ?? [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17];
  const d = m?.hari[day];

  const levelOf = (adm4: string, i = hi) => {
    const v = d?.data[adm4];
    return v && st ? personalLevel(v.l[i] ?? 0, st) : 0;
  };
  const wbgtOf = (adm4: string, i = hi) => d?.data[adm4]?.w[i] ?? null;

  // ringkasan per jam: jumlah kelurahan per level & level tertinggi (untuk warna strip jam)
  const perHour = useMemo(() => hours.map((_, i) => {
    const counts = [0, 0, 0, 0, 0, 0];
    FEATURES.forEach((f) => { counts[levelOf(f.adm4, i)]++; });
    const max = counts.reduce((acc, n, l) => (n > 0 ? l : acc), 0);
    return { counts, max };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [m, day, st]);

  const top = useMemo(() => FEATURES
    .map((f) => ({ f, w: wbgtOf(f.adm4), l: levelOf(f.adm4) }))
    .filter((x) => x.w != null)
    .sort((a, b) => (b.w! - a.w!) || a.f.name.localeCompare(b.f.name))
    .slice(0, 5),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [m, day, hi, st]);

  function play() {
    if (timer.current) { clearInterval(timer.current); timer.current = null; setPlaying(false); return; }
    setPlaying(true);
    let i = 0;
    setHi(0);
    timer.current = setInterval(() => {
      i += 1;
      if (i >= hours.length) {
        if (timer.current) clearInterval(timer.current);
        timer.current = null; setPlaying(false); return;
      }
      setHi(i);
    }, 900);
  }

  if (err) return <Screen><Card><P>⚠️ {err}</P></Card></Screen>;
  if (!st || !m || !d) return <ActivityIndicator style={{ marginTop: 40 }} />;

  const su = st.lang === 'su';
  const lbl = (l: number) => (su ? levelInfo(l).su : levelInfo(l).label);
  const counts = perHour[hi].counts;
  const selF = sel ? BY_ID[sel] : null;
  const mine = st.adm4 ? BY_ID[st.adm4] : null;
  const role = roleInfo(st.role);

  const spoken = () => {
    const parts = [`Peta panas Kota Bandung, ${day === 0 ? 'hari ini' : 'besok'} pukul ${pad(hours[hi])}.`];
    const order = [5, 4, 3, 2, 1].filter((l) => counts[l] > 0);
    parts.push(order.map((l) => `${counts[l]} kelurahan ${levelInfo(l).label}`).join(', ') + '.');
    if (top.length) parts.push(`Paling panas: ${top.slice(0, 3).map((x) => x.f.name).join(', ')}.`);
    if (mine) parts.push(`Kelurahan Anda, ${mine.name}: ${levelInfo(levelOf(mine.adm4)).label}.`);
    return parts.join(' ');
  };

  return (
    <Screen>
      <P muted>
        Warna = level risiko di bawah matahari untuk peran {role.label} ({m.beban_kerja.replace('_', ' ')}).
        Ketuk kelurahan untuk detail, atau tekan ▶ Putar untuk melihat panas bergerak dari pagi ke sore.
      </P>

      <View style={st_.row}>
        {m.hari.map((h, i) => (
          <Pressable key={h.tanggal} accessibilityRole="tab" accessibilityState={{ selected: day === i }}
            onPress={() => setDay(i)} style={[st_.tab, day === i && st_.tabOn]}>
            <Text style={[st_.tabText, day === i && { color: '#fff' }]}>{i === 0 ? 'Hari ini' : 'Besok'}</Text>
            <Text style={[st_.tabSub, day === i && { color: 'rgba(255,255,255,0.85)' }]}>{dayTitle(h.tanggal)}</Text>
          </Pressable>
        ))}
      </View>

      <Card style={{ padding: 12, gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
          <Text style={st_.clock} accessibilityLiveRegion="polite">Pukul {pad(hours[hi])} WIB</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable accessibilityRole="button" onPress={play}
              style={({ pressed }) => [st_.play, playing && { backgroundColor: C.ink }, pressed && { opacity: 0.7 }]}>
              <Text style={st_.playText}>{playing ? '⏸ Jeda' : '▶ Putar'}</Text>
            </Pressable>
          </View>
        </View>

        {!d.ada_data ? (
          <P muted>Belum ada data untuk hari ini. Coba pilih “Besok”.</P>
        ) : null}

        <View style={{ width: '100%', aspectRatio: MAP.w / MAP.h }}>
          <Svg width="100%" height="100%" viewBox={`0 0 ${MAP.w} ${MAP.h}`}>
            <G>
              {FEATURES.map((f) => (
                <Path key={f.adm4} d={f.d} fill={levelInfo(levelOf(f.adm4)).color}
                  stroke="#FFFFFF" strokeWidth={1.6} strokeLinejoin="round"
                  onPress={() => setSel(f.adm4)} />
              ))}
            </G>
            {mine && mine.adm4 !== sel ? (
              <Path d={mine.d} fill="none" stroke={C.ink} strokeWidth={3} strokeDasharray="8 5" />
            ) : null}
            {selF ? <Path d={selF.d} fill="none" stroke={C.ink} strokeWidth={5} strokeLinejoin="round" /> : null}
            {mine ? (
              <G>
                <Circle cx={mine.c[0]} cy={mine.c[1]} r={11} fill="#FFFFFF" stroke={C.ink} strokeWidth={3} />
                <Circle cx={mine.c[0]} cy={mine.c[1]} r={4.5} fill={C.ink} />
              </G>
            ) : null}
          </Svg>
        </View>

        {/* pemilih jam: strip warna = level tertinggi di kota pada jam itu */}
        <View style={st_.hours} accessibilityRole="adjustable" accessibilityLabel="Pilih jam">
          {hours.map((h, i) => (
            <Pressable key={h} onPress={() => { if (timer.current) play(); setHi(i); }}
              accessibilityRole="button" accessibilityLabel={`Pukul ${pad(h)}`} accessibilityState={{ selected: i === hi }}
              style={[st_.hour, i === hi && st_.hourOn]}>
              <View style={[st_.hourBar, { backgroundColor: levelInfo(perHour[i].max).color }]} />
              <Text style={[st_.hourText, i === hi && { color: C.ink, ...font('800') }]}>{String(h).padStart(2, '0')}</Text>
            </Pressable>
          ))}
        </View>

        <View style={st_.legend}>
          {LEVELS.slice(1).map((L) => (
            <View key={L.level} style={st_.legendItem}>
              <View style={[st_.swatch, { backgroundColor: L.color }]} />
              <Text style={st_.legendText}>{lbl(L.level)} <Text style={{ ...font('800') }}>{counts[L.level]}</Text></Text>
            </View>
          ))}
          {counts[0] ? (
            <View style={st_.legendItem}>
              <View style={[st_.swatch, { backgroundColor: LEVELS[0].color }]} />
              <Text style={st_.legendText}>Tanpa data {counts[0]}</Text>
            </View>
          ) : null}
        </View>
        <Text style={st_.note}>📍 lingkaran = kelurahan Anda · garis tebal = kelurahan yang dipilih</Text>
        <SpeakButton id="peta" label={su ? 'Dangukeun' : 'Dengarkan'} text={spoken} />
      </Card>

      {selF ? (
        <Card>
          <H2>{selF.name}</H2>
          <P muted>Kec. {selF.kec}{st.adm4 === selF.adm4 ? ' · lokasi Anda' : ''}</P>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 }}>
            <View style={[st_.badge, { backgroundColor: levelInfo(levelOf(selF.adm4)).color }]}>
              <Text style={st_.badgeText}>{lbl(levelOf(selF.adm4))}</Text>
            </View>
            <Text style={st_.legendText}>
              {wbgtOf(selF.adm4) != null ? `WBGT ±${wbgtOf(selF.adm4)!.toFixed(1)}° di bawah matahari` : 'Tidak ada data jam ini'}
            </Text>
          </View>
          <Text style={[st_.note, { marginTop: 8 }]}>Sepanjang hari (07–17):</Text>
          <View style={st_.spark}>
            {hours.map((h, i) => (
              <Pressable key={h} onPress={() => setHi(i)} style={{ flex: 1, alignItems: 'center', gap: 3 }}
                accessibilityLabel={`Pukul ${pad(h)}: ${levelInfo(levelOf(selF.adm4, i)).label}`}>
                <View style={[st_.sparkCell, { backgroundColor: levelInfo(levelOf(selF.adm4, i)).color },
                  i === hi && { borderWidth: 2.5, borderColor: C.ink }]} />
                <Text style={st_.sparkText}>{h}</Text>
              </Pressable>
            ))}
          </View>
          {st.adm4 !== selF.adm4 ? (
            <Button title="📍 Jadikan lokasi saya" kind="ghost" onPress={async () => {
              const s = await saveSettings({ adm4: selF.adm4, locationName: `${selF.name}, ${selF.kec}` });
              setSt(s);
            }} />
          ) : (
            <Button title="Lihat saran untuk lokasi ini" kind="ghost" onPress={() => router.replace('/beranda')} />
          )}
        </Card>
      ) : null}

      {top.length ? (
        <Card>
          <H2>Paling panas pukul {pad(hours[hi])}</H2>
          {top.map((x, i) => (
            <Pressable key={x.f.adm4} onPress={() => setSel(x.f.adm4)} accessibilityRole="button"
              style={({ pressed }) => [st_.topRow, pressed && { opacity: 0.7 }]}>
              <Text style={st_.topNo}>{i + 1}</Text>
              <View style={{ flex: 1 }}>
                <Text style={st_.topName}>{x.f.name}</Text>
                <Text style={st_.note}>Kec. {x.f.kec}</Text>
              </View>
              <Text style={st_.legendText}>±{x.w!.toFixed(1)}°</Text>
              <View style={[st_.badge, { backgroundColor: levelInfo(x.l).color }]}>
                <Text style={st_.badgeText}>{lbl(x.l)}</Text>
              </View>
            </Pressable>
          ))}
        </Card>
      ) : null}

      <Card>
        <P muted>
          {stale ? '⚠️ Data lama (offline). ' : ''}{m.label}. Sumber cuaca: {m.attribution.map((a) => a.name).join('; ')}.
          {m.diperbarui ? ` Diperbarui ${new Date(m.diperbarui).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}.` : ''}
          {' '}{MAP.source}.
        </P>
      </Card>
    </Screen>
  );
}

const st_ = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10 },
  tab: { flex: 1, borderRadius: 18, paddingVertical: 10, paddingHorizontal: 14, backgroundColor: 'rgba(255,255,255,0.9)', borderWidth: 2, borderColor: 'transparent' },
  tabOn: { backgroundColor: C.accent, borderColor: C.accent },
  tabText: { fontSize: 16, color: C.ink, ...font('800') },
  tabSub: { fontSize: 12, color: C.muted, ...font('500') },
  clock: { fontSize: 22, color: C.ink, letterSpacing: -0.3, ...font('800') },
  play: { backgroundColor: C.accent, borderRadius: 999, paddingVertical: 9, paddingHorizontal: 16, minHeight: 40, justifyContent: 'center' },
  playText: { color: '#fff', fontSize: 15, ...font('700') },
  hours: { flexDirection: 'row', gap: 3 },
  hour: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: 6, borderRadius: 10, minHeight: 44, justifyContent: 'center' },
  hourOn: { backgroundColor: '#FFF4DC', borderWidth: 2, borderColor: C.accent },
  hourBar: { width: '70%', height: 8, borderRadius: 4 },
  hourText: { fontSize: 12, color: C.muted, ...font('600') },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  swatch: { width: 14, height: 14, borderRadius: 4 },
  legendText: { fontSize: 13, color: C.ink, ...font('500') },
  note: { fontSize: 12, color: C.muted, ...font('500') },
  badge: { borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10 },
  badgeText: { color: '#fff', fontSize: 13, ...font('700') },
  spark: { flexDirection: 'row', gap: 3 },
  sparkCell: { width: '100%', height: 18, borderRadius: 5 },
  sparkText: { fontSize: 10, color: C.muted, ...font('500') },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: C.line },
  topNo: { width: 22, fontSize: 16, color: C.muted, textAlign: 'center', ...font('800') },
  topName: { fontSize: 15, color: C.ink, ...font('700') },
});
