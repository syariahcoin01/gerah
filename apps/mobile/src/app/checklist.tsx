import { useEffect, useState } from 'react';
import { Card, H2, P, Screen, Toggle } from '../components/ui';
import { cacheGet, cacheSet } from '../lib/storage';

const ITEMS = [
  { id: 'air', label: 'Air minum ≥1 liter per orang per jam tersedia', desc: 'Dingin/sejuk, dekat area kerja' },
  { id: 'teduh', label: 'Tempat teduh dalam jarak ±50 m', desc: 'Terpal/tenda/bangunan berventilasi' },
  { id: 'rotasi', label: 'Rotasi tugas berat sudah dijadwalkan', desc: 'Lihat timeline per jam' },
  { id: 'jadwal', label: 'Kerja berat dipindah ke pagi', desc: 'Mis. pengecoran & angkat beban sebelum 10.00' },
  { id: 'buddy', label: 'Sistem buddy (saling awasi berpasangan)', desc: 'Terutama pekerja baru <7 hari' },
  { id: 'baru', label: 'Pekerja baru mendapat beban bertahap', desc: 'Aklimatisasi minimal 7 hari' },
  { id: 'apd', label: 'Topi/helm berpelindung & baju terang', desc: '' },
  { id: 'darurat', label: 'Rencana darurat & nomor 119 diketahui semua', desc: 'Termasuk lokasi IGD terdekat' },
];

const today = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' });

export default function Checklist() {
  const [done, setDone] = useState<Record<string, boolean>>({});
  const key = `checklist.${today()}`;

  useEffect(() => {
    cacheGet<Record<string, boolean>>(key).then((v) => v && setDone(v));
  }, [key]);

  function set(id: string, v: boolean) {
    const next = { ...done, [id]: v };
    setDone(next);
    cacheSet(key, next);
  }

  const n = ITEMS.filter((i) => done[i.id]).length;
  return (
    <Screen>
      <H2>Checklist hari ini ({n}/{ITEMS.length})</H2>
      <P muted>Mengacu kewajiban pengendalian iklim kerja (Permenaker No. 5/2018). Tersimpan di perangkat ini.</P>
      <Card>
        {ITEMS.map((i) => (
          <Toggle key={i.id} label={i.label} desc={i.desc} value={!!done[i.id]} onChange={(v) => set(i.id, v)} />
        ))}
      </Card>
    </Screen>
  );
}
