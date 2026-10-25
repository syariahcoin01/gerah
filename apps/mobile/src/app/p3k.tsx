import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Card, H2, P, Screen, SpeakButton } from '../components/ui';
import { loadSettings } from '../lib/storage';

// Teks Sunda adalah draf: wajib divalidasi penutur asli sebelum rilis.
const STAGES = [
  {
    icon: '😓', color: '#E9B500',
    title: 'Kram & ruam panas', su: 'Keram jeung biang keringet',
    sign: 'Kram otot, kulit gatal kemerahan, banyak berkeringat.',
    signSu: 'Otot keram, kulit ateul beureum, kesang loba.',
    act: 'Berhenti kerja, pindah ke teduh, minum air + elektrolit, regangkan otot perlahan.',
    actSu: 'Eureun heula, ngiuhan, nginum cai jeung oralit.',
  },
  {
    icon: '🥵', color: '#F07A1A',
    title: 'Kelelahan panas', su: 'Cape ku panas',
    sign: 'Pusing, lemas, mual, sakit kepala, kulit dingin-lembap, nadi cepat.',
    signSu: 'Lieur, lungse, seueul, nyeri sirah.',
    act: 'Baringkan di teduh/sejuk, longgarkan pakaian, kompres air dingin, beri minum sedikit-sedikit. Jika tidak membaik dalam 1 jam → ke fasilitas kesehatan.',
    actSu: 'Golerkeun di nu iuh, kompres ku cai tiis, pasihan nginum saeutik-saeutik.',
  },
  {
    icon: '🚨', color: '#D7263D',
    title: 'Sengatan panas (heat stroke) — DARURAT', su: 'Katerap panas — DARURAT',
    sign: 'Bingung/bicara kacau, pingsan, kejang, kulit panas (bisa kering), suhu tubuh sangat tinggi.',
    signSu: 'Linglung, kapiuhan, kejang, kulit panas pisan.',
    act: 'Telepon 119. Segera dinginkan seluruh tubuh: siram/rendam air dingin, kompres es di leher-ketiak-selangkangan, kipasi. Jangan beri minum bila tidak sadar.',
    actSu: 'Telepon 119. Tiiskeun awakna ku cai tiis. Ulah dipasihan nginum upami teu sadar.',
  },
];

export default function P3K() {
  const [su, setSu] = useState(false);
  useEffect(() => { loadSettings().then((s) => setSu(s.lang === 'su')); }, []);

  return (
    <Screen>
      {STAGES.map((st) => (
        <Card key={st.title} style={{ borderLeftWidth: 8, borderLeftColor: st.color }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Text style={{ fontSize: 40 }}>{st.icon}</Text>
            <View style={{ flex: 1 }}>
              <H2>{st.title}</H2>
              {su ? <Text style={{ color: '#7A6656' }}>{st.su}</Text> : null}
            </View>
          </View>
          <P><Text style={{ fontWeight: '700' }}>Tanda: </Text>{st.sign}</P>
          {su ? <P muted>{st.signSu}</P> : null}
          <P><Text style={{ fontWeight: '700' }}>Lakukan: </Text>{st.act}</P>
          {su ? <P muted>{st.actSu}</P> : null}
          <SpeakButton id={`p3k-${st.title}`} label={su ? 'Dangukeun' : 'Dengarkan'}
            text={su ? `${st.su}. ${st.signSu} ${st.actSu}` : `${st.title}. Tanda: ${st.sign} Lakukan: ${st.act}`} />
        </Card>
      ))}
      <Card>
        <P muted>
          Informasi ini untuk pertolongan pertama, bukan diagnosis. Kelompok lebih rentan: ibu hamil, lansia,
          penderita penyakit jantung/ginjal/diabetes, pekerja baru, dan anak-anak. Jangan tinggalkan anak atau
          hewan di dalam kendaraan tertutup.
        </P>
      </Card>
    </Screen>
  );
}
