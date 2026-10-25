import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Text } from 'react-native';
import { Button, Card, Choice, H2, P, Screen, Toggle } from '../components/ui';
import { remindersSupported } from '../lib/reminders';
import { roleInfo } from '../lib/roles';
import { DEFAULTS, loadSettings, saveSettings, Settings, Workload } from '../lib/storage';

const WORKLOADS: { key: Workload; label: string; desc: string }[] = [
  { key: 'ringan', label: 'Ringan', desc: 'Juru parkir, jaga lapak, mengawasi' },
  { key: 'sedang', label: 'Sedang', desc: 'Berjalan sambil membawa barang, PKL keliling' },
  { key: 'berat', label: 'Berat', desc: 'Mencangkul, mengangkat beban, menggergaji' },
  { key: 'sangat_berat', label: 'Sangat berat', desc: 'Menggali intensif, naik tangga membawa beban' },
];

export default function Profil() {
  const [st, setSt] = useState<Settings | null>(null);
  useEffect(() => { loadSettings().then(setSt); }, []);
  if (!st) return <ActivityIndicator style={{ marginTop: 40 }} />;

  const update = async (p: Partial<Settings>) => setSt(await saveSettings(p));
  const info = roleInfo(st.role);

  return (
    <Screen>
      <Card>
        <P>Peran: <Text style={{ fontWeight: '800' }}>{info.icon} {info.label}</Text></P>
        <P muted>{info.desc}</P>
      </Card>
      {info.group === 'kerja' && (
        <>
          <H2>Beban kerja</H2>
          {WORKLOADS.map((w) => (
            <Choice key={w.key} label={w.label} desc={w.desc} selected={st.workload === w.key}
              onPress={() => update({ workload: w.key })} />
          ))}
        </>
      )}
      <Card>
        {info.group === 'kerja' || info.key === 'olahraga' ? (
          <Toggle label="Sudah terbiasa beraktivitas di panas"
            desc="Matikan bila baru <7 hari bekerja/berlatih di luar atau baru kembali dari cuti"
            value={st.acclimatized} onChange={(v) => update({ acclimatized: v })} />
        ) : null}
        <Toggle label="Bahasa Sunda" desc="Tampilkan pesan & P3K dalam bahasa Sunda" value={st.lang === 'su'}
          onChange={(v) => update({ lang: v ? 'su' : 'id' })} />
        <Toggle label="Peringatan H-1 pukul 17.00"
          desc={remindersSupported ? 'Ringkasan besok pukul 17.00 + pengingat 05.30, hanya bila besok Siaga atau lebih' : 'Tersedia di aplikasi Android/iOS'}
          value={st.dayBeforeAlert} onChange={(v) => update({ dayBeforeAlert: v })} />
        <Toggle label="Pengingat minum & peringatan level"
          desc={remindersSupported ? 'Notifikasi lokal jam 07–17 saat panas; tetap jalan tanpa sinyal' : 'Tersedia di aplikasi Android/iOS'}
          value={st.waterReminder} onChange={(v) => update({ waterReminder: v })} />
      </Card>

      {info.healthProfile ? (<>
      <H2>Profil pribadi (opsional)</H2>
      <P muted>
        Disimpan hanya di perangkat ini dan tidak pernah dikirim ke server. Dipakai untuk membuat peringatan
        lebih hati-hati. Bisa dihapus kapan saja.
      </P>
      <Card>
        <Toggle label="Sedang hamil" desc="Level risiko dinaikkan satu tingkat" value={st.pregnant}
          onChange={(v) => update({ pregnant: v })} />
        <Toggle label="Sedang haid" desc="Pengingat minum lebih sering & tips pusing/lemas" value={st.menstruating}
          onChange={(v) => update({ menstruating: v })} />
        <Toggle label="Lansia atau punya penyakit kronis" desc="Jantung, ginjal, diabetes, tekanan darah; level dinaikkan satu tingkat"
          value={st.elderlyOrChronic} onChange={(v) => update({ elderlyOrChronic: v })} />
      </Card>
      <Button title="Hapus profil pribadi" kind="ghost"
        onPress={() => update({ pregnant: false, menstruating: false, elderlyOrChronic: false })} />
      </>) : null}
      <Button title="Ganti peran / lokasi" kind="ghost"
        onPress={async () => { await saveSettings({ ...DEFAULTS, role: undefined, adm4: undefined }); router.replace('/'); }} />
    </Screen>
  );
}
