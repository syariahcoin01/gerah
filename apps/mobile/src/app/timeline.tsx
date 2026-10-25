import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { Card, H2, P, Screen } from '../components/ui';
import { dayLabel, fetchForecast, Forecast, hourLabel, personalLevel } from '../lib/api';
import { timelineText } from '../lib/roles';
import { loadSettings, Settings } from '../lib/storage';
import { C, levelInfo } from '../lib/theme';

export default function Timeline() {
  const [st, setSt] = useState<Settings | null>(null);
  const [f, setF] = useState<Forecast | null>(null);

  useEffect(() => {
    loadSettings().then(async (s) => {
      setSt(s);
      setF((await fetchForecast(s)).data);
    }).catch(() => {});
  }, []);

  if (!st || !f) return <ActivityIndicator style={{ marginTop: 40 }} />;
  let lastDay = '';

  return (
    <Screen>
      <P muted>Batang berwarna = level di bawah matahari. Angka kecil = WBGT teduh. Pindahkan kerja berat ke jam hijau/kuning.</P>
      {f.timeline.map((h) => {
        const lvl = personalLevel(h.level, st);
        const info = levelInfo(lvl);
        const d = dayLabel(h.ts);
        const header = d !== lastDay ? ((lastDay = d), <H2 key={`d${h.ts}`}>{d}</H2>) : null;
        return (
          <View key={h.ts} style={{ gap: 6 }}>
            {header}
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 }}>
              <Text style={{ width: 52, fontWeight: '700', color: C.ink }}>{hourLabel(h.ts)}</Text>
              <View style={{ width: 10, alignSelf: 'stretch', borderRadius: 5, backgroundColor: info.color }} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '800', color: info.color }}>
                  {info.label} · WBGT {h.wbgt_matahari ?? '–'}° <Text style={{ color: C.muted, fontWeight: '400' }}>(teduh {h.wbgt_teduh ?? '–'}°)</Text>
                </Text>
                <Text style={{ color: C.ink }}>{timelineText(st.role, lvl)}</Text>
                <Text style={{ color: C.muted, fontSize: 12 }}>
                  {h.t ?? '–'}°C · RH {h.rh ?? '–'}% · UV {h.uv?.value ?? '–'} {h.weather ? `· ${h.weather}` : ''}
                </Text>
              </View>
            </Card>
          </View>
        );
      })}
    </Screen>
  );
}
