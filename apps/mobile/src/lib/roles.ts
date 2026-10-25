/**
 * Daftar peran Gerah (selaras dengan ROLES di services/api/app/risk.py).
 * Satu peran utama → satu tabel ambang + beban kerja default + set saran + fitur.
 * Ojek online/kurir sengaja tidak disertakan (di luar cakupan proposal).
 */
export type Role =
  | 'mandor' | 'tukang' | 'kebersihan' | 'pedagang' | 'penjaga'
  | 'guru' | 'pelajar' | 'olahraga'
  | 'keluarga' | 'umum';
export type Group = 'kerja' | 'sekolah' | 'keluarga';
export type Workload = 'ringan' | 'sedang' | 'berat' | 'sangat_berat';
type Family = 'kerja' | 'sekolah' | 'olahraga' | 'keluarga' | 'umum';

export type RoleInfo = {
  key: Role;
  group: Group;
  icon: string;
  label: string;
  desc: string;
  family: Family;
  workload?: Workload;      // beban default (hanya kelompok kerja)
  askHeavy?: boolean;       // tanyakan "pekerjaan Anda berat?" saat onboarding
  teamTools?: boolean;      // checklist & laporan mingguan
  healthProfile: boolean;   // boleh mengisi profil kesehatan opsional
};

export const GROUPS: { key: Group; icon: string; label: string; desc: string }[] = [
  { key: 'kerja', icon: '🔨', label: 'Kerja', desc: 'Bekerja di luar ruangan' },
  { key: 'sekolah', icon: '🎒', label: 'Sekolah & olahraga', desc: 'Upacara, PJOK, ekskul, latihan' },
  { key: 'keluarga', icon: '🏠', label: 'Keluarga & umum', desc: 'Menjaga keluarga, jalan-jalan, wisata' },
];

export const ROLES: RoleInfo[] = [
  { key: 'mandor', group: 'kerja', icon: '👷', label: 'Mandor / pengawas / K3', family: 'kerja',
    desc: 'Jadwal istirahat tim, checklist, laporan mingguan', workload: 'sedang', askHeavy: true,
    teamTools: true, healthProfile: true },
  { key: 'tukang', group: 'kerja', icon: '🧱', label: 'Tukang & pekerja galian', family: 'kerja',
    desc: 'Proyek, renovasi rumah, galian kabel atau pipa', workload: 'sedang', askHeavy: true,
    healthProfile: true },
  { key: 'kebersihan', group: 'kerja', icon: '🧹', label: 'Petugas kebersihan', family: 'kerja',
    desc: 'Penyapu jalan, pengangkut sampah, pemulung', workload: 'berat', healthProfile: true },
  { key: 'pedagang', group: 'kerja', icon: '🛒', label: 'Pedagang & PKL', family: 'kerja',
    desc: 'Lapak pasar, kaki lima, pedagang keliling', workload: 'ringan', healthProfile: true },
  { key: 'penjaga', group: 'kerja', icon: '🚦', label: 'Penjaga jalan & keamanan', family: 'kerja',
    desc: 'Juru parkir, satpam, Dishub, polisi lalu lintas', workload: 'ringan', healthProfile: true },
  { key: 'guru', group: 'sekolah', icon: '🏫', label: 'Guru PJOK / pembina', family: 'sekolah',
    desc: 'Kapan PJOK, upacara, ekskul dipindah atau ditunda', healthProfile: true },
  { key: 'pelajar', group: 'sekolah', icon: '🎒', label: 'Pelajar & mahasiswa', family: 'sekolah',
    desc: 'Upacara, Pramuka, Paskibra, MPLS, ekskul luar', healthProfile: false },
  { key: 'olahraga', group: 'sekolah', icon: '🏃', label: 'Olahraga & komunitas', family: 'olahraga',
    desc: 'Lari, sepeda, sepak bola, CFD Dago', healthProfile: true },
  { key: 'keluarga', group: 'keluarga', icon: '👪', label: 'Pendamping keluarga', family: 'keluarga',
    desc: 'Menjaga balita, lansia, atau ibu hamil', healthProfile: true },
  { key: 'umum', group: 'keluarga', icon: '🚶', label: 'Warga umum & wisatawan', family: 'umum',
    desc: 'Jalan-jalan, wisata, aktivitas luar sesekali', healthProfile: true },
];

const LEGACY: Record<string, Role> = { pekerja: 'tukang' };

export function roleInfo(role?: string): RoleInfo {
  const key = (role && LEGACY[role]) || role;
  return ROLES.find((r) => r.key === key) ?? ROLES.find((r) => r.key === 'umum')!;
}

/** Ringkasan tindakan per jam untuk Timeline. */
const TIMELINE: Record<Family, Record<number, string>> = {
  kerja: {
    1: 'Kerja normal',
    2: 'Istirahat 10–15 mnt/jam',
    3: 'Kerja berat 30 mnt : istirahat 30 mnt',
    4: 'Kerja berat maks 15 mnt/jam',
    5: 'Hentikan kerja berat luar ruang',
  },
  sekolah: {
    1: 'Kegiatan normal',
    2: 'Jeda minum tiap 15–20 mnt',
    3: 'Tanpa olahraga berat; upacara dipersingkat',
    4: 'Kegiatan fisik pindah ke dalam',
    5: 'Batalkan kegiatan fisik luar',
  },
  olahraga: {
    1: 'Latihan normal',
    2: 'Istirahat teratur, minum tiap 15–20 mnt',
    3: 'Hindari lari jauh/interval',
    4: 'Batalkan latihan berat di luar',
    5: 'Batalkan semua latihan luar',
  },
  keluarga: {
    1: 'Aktivitas normal',
    2: 'Cek minum balita/lansia tiap jam',
    3: 'Batasi main di luar; jangan tinggal di mobil',
    4: 'Tunda keluar rumah',
    5: 'Tetap di dalam; waspadai tanda darurat',
  },
  umum: {
    1: 'Aktivitas normal',
    2: 'Cari teduh bila lama di luar',
    3: 'Kurangi aktivitas berat',
    4: 'Minimalkan aktivitas luar',
    5: 'Hindari aktivitas luar',
  },
};

export const timelineText = (role: string | undefined, level: number) =>
  TIMELINE[roleInfo(role).family][level] ?? '';
