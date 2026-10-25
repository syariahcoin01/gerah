import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { Card, H2, P, Screen } from '../components/ui';
import { API_URL } from '../lib/api';
import { loadSettings } from '../lib/storage';
import { C, levelInfo } from '../lib/theme';

type Weekly = { hari: Record<string, Record<string, number>> };

export default function Laporan() {
  const [w, setW] = useState<Weekly | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    loadSettings().then(async (s) => {
      const r = await fetch(`${API_URL}/v1/weekly/${s.adm4}?role=mandor&workload=${s.workload}`);
      if (!r.ok) throw new Error();
      setW(await r.json());
    }).catch(() => setErr(true));
  }, []);

  if (err) return <Screen><P>Laporan belum bisa dimuat.</P></Screen>;
  if (!w) return <ActivityIndicator style={{ marginTop: 40 }} />;
  const days = Object.entries(w.hari);

  return (
    <Screen>
      <H2>Jam kerja per level (07.00–17.00 WIB)</H2>
      <P muted>Gunakan untuk mengatur shift minggu depan, mis. mulai lebih pagi pada hari yang banyak jam oranye/merah.</P>
      {days.length === 0 ? <P>Belum ada data 7 hari terakhir.</P> : null}
      {days.map(([d, counts]) => {
        const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
        return (
          <Card key={d}>
            <Text style={{ fontWeight: '700', color: C.ink }}>
              {new Date(d).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short' })}
            </Text>
            <View style={{ flexDirection: 'row', height: 18, borderRadius: 6, overflow: 'hidden' }}>
              {[1, 2, 3, 4, 5].map((l) => counts[String(l)] ? (
                <View key={l} style={{ flex: counts[String(l)] / total, backgroundColor: levelInfo(l).color }} />
              ) : null)}
            </View>
            <Text style={{ color: C.muted, fontSize: 12 }}>
              {[1, 2, 3, 4, 5].filter((l) => counts[String(l)]).map((l) => `${levelInfo(l).label} ${counts[String(l)]} jam`).join(' · ')}
            </Text>
          </Card>
        );
      })}
    </Screen>
  );
}
