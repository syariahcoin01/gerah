import * as ExpoLocation from 'expo-location';
import { Redirect, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, TextInput } from 'react-native';
import { Button, Card, Choice, H1, H2, P, Screen, Toggle } from '../components/ui';
import { fetchLocations, Location, nearestLocal } from '../lib/api';
import { Group, GROUPS, roleInfo, ROLES } from '../lib/roles';
import { loadSettings, Role, saveSettings, Settings } from '../lib/storage';
import { C } from '../lib/theme';

const MAX_RESULTS = 12;
const norm = (x: string) => x.toLowerCase().replace(/\s+/g, '');

export default function Onboarding() {
  const [st, setSt] = useState<Settings | null>(null);
  const [group, setGroup] = useState<Group | undefined>();
  const [role, setRole] = useState<Role | undefined>();
  const [heavy, setHeavy] = useState(false);
  const [locs, setLocs] = useState<Location[]>([]);
  const [loc, setLoc] = useState<Location | undefined>();
  const [err, setErr] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [q, setQ] = useState('');

  useEffect(() => {
    loadSettings().then(setSt);
    fetchLocations().then(setLocs).catch(() => setErr('Server Gerah belum bisa dihubungi.'));
  }, []);

  if (!st) return <ActivityIndicator style={{ marginTop: 40 }} />;
  if (st.role && st.adm4) return <Redirect href="/beranda" />;

  async function useMyLocation() {
    setLocating(true);
    try {
      const perm = await ExpoLocation.requestForegroundPermissionsAsync();
      if (!perm.granted) throw new Error('izin ditolak');
      const pos = await ExpoLocation.getCurrentPositionAsync({ accuracy: ExpoLocation.Accuracy.Balanced });
      // koordinat dipakai di perangkat saja; server hanya menerima kode kelurahan
      setLoc(nearestLocal(locs, pos.coords.latitude, pos.coords.longitude));
    } catch {
      setErr('Lokasi tidak bisa dibaca. Pilih kelurahan dari daftar.');
    } finally {
      setLocating(false);
    }
  }

  async function finish() {
    if (!role || !loc) return;
    const info = roleInfo(role);
    await saveSettings({
      role,
      workload: info.askHeavy && heavy ? 'berat' : info.workload ?? 'sedang',
      adm4: loc.adm4,
      locationName: `${loc.name}, ${loc.kecamatan}`,
      // pelajar tidak memakai profil kesehatan (data anak = data pribadi spesifik, UU PDP)
      ...(info.healthProfile ? {} : { pregnant: false, menstruating: false, elderlyOrChronic: false }),
    });
    router.replace('/beranda');
  }

  return (
    <Screen>
      <H1>Selamat datang di Gerah</H1>
      <P muted>Penasihat panas untuk kerja dan kegiatan luar ruang di Bandung.</P>

      <H2>1. Anda paling sering di luar untuk…</H2>
      {GROUPS.map((g) => (
        <Choice key={g.key} label={`${g.icon} ${g.label}`} desc={g.desc} selected={group === g.key}
          onPress={() => { setGroup(g.key); if (roleInfo(role).group !== g.key) setRole(undefined); }} />
      ))}

      {group ? (
        <>
          <H2>2. Anda sebagai…</H2>
          {ROLES.filter((r) => r.group === group).map((r) => (
            <Choice key={r.key} label={`${r.icon} ${r.label}`} desc={r.desc} selected={role === r.key}
              onPress={() => setRole(r.key)} />
          ))}
          {role && roleInfo(role).askHeavy ? (
            <Card>
              <Toggle label="Pekerjaan Anda berat?" desc="Mencangkul, menggali, mengecor, angkat karung"
                value={heavy} onChange={setHeavy} />
            </Card>
          ) : null}
        </>
      ) : null}

      <H2>{group ? '3' : '2'}. Lokasi {group === 'kerja' ? 'kerja' : 'kegiatan'}</H2>
      <Button title={locating ? 'Mencari…' : '📍 Pakai lokasi saya'} kind="ghost" onPress={useMyLocation}
        disabled={locating || !locs.length} />
      <TextInput
        value={q}
        onChangeText={setQ}
        placeholder="Cari kelurahan atau kecamatan, mis. Dago / Coblong"
        placeholderTextColor={C.muted}
        autoCorrect={false}
        style={{
          borderWidth: 2, borderColor: C.line, borderRadius: 12, padding: 12,
          fontSize: 16, backgroundColor: C.card, color: C.ink,
        }}
      />
      {loc ? (
        <Choice label={`✔ ${loc.name}`} desc={`Kec. ${loc.kecamatan}, ${loc.kota} — terpilih`} selected
          onPress={() => setLoc(undefined)} />
      ) : null}
      {(() => {
        const key = norm(q);
        if (!key) return <P muted>{locs.length} kelurahan di Kota Bandung. Ketik nama untuk mencari.</P>;
        const hits = locs.filter((l) => norm(l.name).includes(key) || norm(l.kecamatan ?? '').includes(key));
        if (!hits.length) return <P muted>Tidak ditemukan. Coba nama kecamatan.</P>;
        return (
          <>
            {hits.slice(0, MAX_RESULTS).map((l) => (
              <Choice key={l.adm4} label={l.name} desc={`Kec. ${l.kecamatan}`}
                selected={loc?.adm4 === l.adm4} onPress={() => { setLoc(l); setQ(''); }} />
            ))}
            {hits.length > MAX_RESULTS ? (
              <P muted>+{hits.length - MAX_RESULTS} lainnya. Ketik lebih spesifik.</P>
            ) : null}
          </>
        );
      })()}
      {err ? <Text style={{ color: '#D7263D' }}>{err}</Text> : null}

      <Card>
        <P muted>
          Gerah memberi ESTIMASI risiko panas dari prakiraan BMKG dan model cuaca terbuka, bukan pengukuran
          WBGT di lokasi Anda, dan bukan pengganti nasihat medis.
        </P>
      </Card>
      <Button title="Mulai" onPress={finish} disabled={!role || !loc} />
    </Screen>
  );
}
