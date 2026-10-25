"""Level risiko & rekomendasi tindakan per peran.

Ambang adalah HEURISTIK DESAIN, bukan nilai regulasi:
- Kerja ringan/sedang/berat : turunan NAB ISBB Permenaker No. 5/2018 (kolom beban kerja),
                              dipetakan ke siklus kerja 75% / 50% / ≤25% / berhenti.
- Sekolah                   : tabel aktivitas Kementerian Lingkungan Jepang (25/28/31/33).
- Olahraga                  : pedoman Japan Sport Association / JSPO (21/25/28/31).
- Pendamping keluarga       : panduan harian Jepang untuk kelompok sensitif (25/28/31/33).
- Warga umum                : myENV Singapura (<31 / 31–33 / ≥33) + Special Alert Jepang (≥35).
Nilai WBGT Gerah adalah ESTIMASI model (±1–2 °C); kalibrasi ulang saat pilot.

Penyesuaian yang menyangkut data kesehatan (hamil, haid, lansia, penyakit kronis)
TIDAK dihitung di server: aplikasi menerapkannya secara lokal di perangkat.
"""
from __future__ import annotations

from typing import Literal

Workload = Literal["ringan", "sedang", "berat", "sangat_berat"]

LEVELS = [
    {"level": 1, "key": "aman",    "label": "Aman",    "label_su": "Aman",         "color": "#2E9E5B"},
    {"level": 2, "key": "waspada", "label": "Waspada", "label_su": "Ati-ati",      "color": "#E9B500"},
    {"level": 3, "key": "siaga",   "label": "Siaga",   "label_su": "Siaga",        "color": "#F07A1A"},
    {"level": 4, "key": "bahaya",  "label": "Bahaya",  "label_su": "Bahaya",       "color": "#D7263D"},
    {"level": 5, "key": "ekstrem", "label": "Ekstrem", "label_su": "Bahaya pisan", "color": "#6B2C91"},
]

# batas bawah level 2..5 (WBGT °C, di bawah matahari)
THRESHOLDS: dict[str, list[float]] = {
    "kerja_ringan":       [29.5, 31.0, 32.0, 33.0],
    "kerja_sedang":       [28.0, 30.0, 31.5, 33.0],
    "kerja_berat":        [26.5, 28.5, 30.0, 31.5],
    "kerja_sangat_berat": [25.5, 27.5, 29.0, 30.5],
    "sekolah":            [25.0, 28.0, 31.0, 33.0],
    "olahraga":           [21.0, 25.0, 28.0, 31.0],
    "sensitif":           [25.0, 28.0, 31.0, 33.0],
    "umum":               [31.0, 32.0, 33.0, 35.0],
}

# peran → (keluarga tabel, beban kerja default). "kerja" berarti tabel dipilih dari beban kerja.
ROLES: dict[str, dict] = {
    "mandor":     {"group": "kerja",    "table": "kerja",    "workload": "sedang"},
    "tukang":     {"group": "kerja",    "table": "kerja",    "workload": "sedang"},
    "kebersihan": {"group": "kerja",    "table": "kerja",    "workload": "berat"},
    "pedagang":   {"group": "kerja",    "table": "kerja",    "workload": "ringan"},
    "penjaga":    {"group": "kerja",    "table": "kerja",    "workload": "ringan"},
    "guru":       {"group": "sekolah",  "table": "sekolah",  "workload": None},
    "pelajar":    {"group": "sekolah",  "table": "sekolah",  "workload": None},
    "olahraga":   {"group": "sekolah",  "table": "olahraga", "workload": None},
    "keluarga":   {"group": "keluarga", "table": "sensitif", "workload": None},
    "umum":       {"group": "keluarga", "table": "umum",     "workload": None},
}
LEGACY_ROLES = {"pekerja": "tukang"}  # versi lama aplikasi


def normalize_role(role: str | None) -> str:
    role = LEGACY_ROLES.get(role or "", role or "umum")
    return role if role in ROLES else "umum"


def table_for(role: str, workload: str | None = None) -> str:
    meta = ROLES[normalize_role(role)]
    if meta["table"] != "kerja":
        return meta["table"]
    wl = workload or meta["workload"] or "sedang"
    return f"kerja_{wl}" if f"kerja_{wl}" in THRESHOLDS else "kerja_sedang"


def base_level(wbgt_c: float, table: str) -> int:
    lvl = 1
    for i, thr in enumerate(THRESHOLDS[table]):
        if wbgt_c >= thr:
            lvl = i + 2
    return lvl


def level_for(wbgt_c: float | None, role: str = "tukang", workload: str | None = None,
              acclimatized: bool = True) -> int:
    if wbgt_c is None:
        return 0
    role = normalize_role(role)
    lvl = base_level(wbgt_c, table_for(role, workload))
    # aklimatisasi relevan untuk pekerja fisik dan olahraga
    if not acclimatized and (ROLES[role]["group"] == "kerja" or role == "olahraga"):
        lvl += 1
    return max(1, min(5, lvl))


# ------------------------------------------------------------------ saran
WATER_ML = {1: 150, 2: 200, 3: 250, 4: 250, 5: 250}
WORK_REST = {1: (60, 0), 2: (45, 15), 3: (30, 30), 4: (15, 45), 5: (0, 60)}

COMMON = {
    1: "Aktivitas normal. Tetap minum air secara teratur.",
    2: "Minum ±{water} ml tiap 15–20 menit. Pakai topi & baju terang longgar.",
    3: "Minum ±{water} ml tiap 15 menit. Istirahat di tempat teduh secara rutin.",
    4: "Hindari aktivitas berat di bawah matahari. Saling awasi gejala panas.",
    5: "Hentikan aktivitas fisik berat di luar ruangan. Cari tempat teduh/sejuk.",
}
SUNDA = {
    1: "Tiasa biasa. Tetep nginum cai.",
    2: "Nginum cai sagelas unggal 15–20 menit. Anggo topi.",
    3: "Nginum cai unggal 15 menit. Reureuh di nu iuh.",
    4: "Ulah heula pagawean beurat di panonpoe.",
    5: "Ulah heula aktivitas beurat di luar. Milarian tempat nu iuh.",
}

BY_ROLE: dict[str, dict[int, str]] = {
    "mandor": {
        1: "Pastikan air minum & tempat teduh tersedia.",
        2: "Siapkan ≥1 L air/orang/jam. Jadwalkan istirahat 15 menit tiap jam.",
        3: "Rasio kerja berat {work}:{rest} menit. Rotasi tugas, pindahkan pengecoran/angkat beban ke pagi.",
        4: "Kerja berat maks {work} menit/jam. Sistem buddy, cek pekerja baru tiap 30 menit.",
        5: "Hentikan kerja berat luar ruang. Siapkan rencana darurat & kontak 119.",
    },
    "tukang": {
        1: "Bawa botol minum sendiri.",
        2: "Istirahat sejenak di teduh tiap jam.",
        3: "Gantian dengan rekan; jangan tunggu haus untuk minum. Kerja berat {work} mnt : istirahat {rest} mnt.",
        4: "Menggali/mengecor maks {work} menit per jam. Lapor mandor bila pusing, mual, atau kram.",
        5: "Berhenti kerja berat. Bila rekan bingung/pingsan: dinginkan tubuh & hubungi 119.",
    },
    "kebersihan": {
        1: "Bawa botol minum; mulai dari ruas jalan terbuka saat masih pagi.",
        2: "Minum 1 gelas tiap 15–20 menit. Sapu ruas yang teduh lebih dulu.",
        3: "Istirahat ≥15 menit tiap jam di teduh. Dorong gerobak/angkat karung bergantian.",
        4: "Pindahkan pengangkutan berat ke pagi/sore. Kerja berpasangan.",
        5: "Hentikan kerja berat. Kerjakan hanya tugas ringan di tempat teduh.",
    },
    "pedagang": {
        1: "Siapkan payung/terpal dan air minum untuk hari ini.",
        2: "Pasang payung/terpal, siapkan ±2 L air.",
        3: "Geser lapak ke tempat teduh, basahi handuk di leher.",
        4: "Pedagang keliling istirahat pukul 11–15. Perhatikan pembeli lansia & anak.",
        5: "Tutup sementara atau pindah ke dalam pasar/bangunan.",
    },
    "penjaga": {
        1: "Pakai topi; ketahui pos teduh terdekat.",
        2: "Rotasi ke pos teduh tiap jam.",
        3: "Rotasi tiap 30–45 menit. Minum sebelum haus.",
        4: "Bertugas berpasangan, saling cek gejala panas.",
        5: "Kurangi petugas di titik terbuka; minimalkan lama berdiri di aspal.",
    },
    "guru": {
        1: "PJOK & ekskul normal; sediakan waktu minum.",
        2: "PJOK jalan terus dengan jeda minum tiap 15–20 menit; topi wajib.",
        3: "Tanpa olahraga berat/lari jauh. Upacara dipersingkat, peserta di teduh, UKS siaga.",
        4: "PJOK & ekskul fisik dipindah ke dalam ruang. Upacara diganti apel singkat di dalam.",
        5: "Semua kegiatan fisik luar ruang dibatalkan.",
    },
    "pelajar": {
        1: "Bawa botol minum ke sekolah.",
        2: "Bawa botol minum & topi saat upacara atau kegiatan luar.",
        3: "Minta istirahat di teduh tiap 20–30 menit. Lapor guru bila pusing.",
        4: "Jangan ikut latihan fisik berat di luar. Cari guru/pembina bila ada yang lemas.",
        5: "Tidak latihan di luar ruangan hari ini.",
    },
    "olahraga": {
        1: "Latihan normal; tetap bawa minum.",
        2: "Istirahat teratur, minum tiap 15–20 menit.",
        3: "Hindari lari jauh/interval. Pindah latihan ke sebelum 07.00 atau sore.",
        4: "Batalkan latihan berat di luar ruangan.",
        5: "Batalkan semua latihan & acara olahraga luar ruang.",
    },
    "keluarga": {
        1: "Pastikan balita/lansia cukup minum.",
        2: "Cek minum lansia & balita tiap jam; pakaian tipis satu lapis.",
        3: "Jangan tinggalkan siapa pun di mobil parkir. Batasi main di luar.",
        4: "Tunda keluar rumah pukul 11–15. Jaga ruangan tetap berventilasi.",
        5: "Kenali tanda darurat (bingung, kejang, tidak sadar) → segera IGD/119.",
    },
    "umum": {
        1: "Aktivitas luar ruang normal.",
        2: "Cari teduh saat aktivitas lama di luar; bawa minum.",
        3: "Kurangi aktivitas berat; istirahat di tempat teduh.",
        4: "Minimalkan aktivitas luar berkepanjangan, terutama 11–15.",
        5: "Hindari aktivitas luar ruang yang tidak perlu.",
    },
}


def advice(level: int, role: str) -> dict:
    role = normalize_role(role)
    water = WATER_ML.get(level, 200)
    work, rest = WORK_REST.get(level, (45, 15))
    fmt = {"water": water, "work": work, "rest": rest}
    return {
        "umum": COMMON.get(level, "").format(**fmt),
        "peran": BY_ROLE.get(role, BY_ROLE["umum"]).get(level, "").format(**fmt),
        "sunda": SUNDA.get(level, ""),
        "air_ml_per_15mnt": water,
        "kerja_istirahat_menit": {"kerja": work, "istirahat": rest},
    }


def uv_category(uv: float | None) -> dict | None:
    if uv is None:
        return None
    cats = [(3, "Rendah", "#2E9E5B"), (6, "Sedang", "#E9B500"), (8, "Tinggi", "#F07A1A"),
            (11, "Sangat tinggi", "#D7263D"), (99, "Ekstrem", "#6B2C91")]
    for lim, label, color in cats:
        if uv < lim:
            return {"value": round(uv, 1), "label": label, "color": color}
    return None


DISCLAIMER = (
    "Gerah memberikan ESTIMASI risiko panas dari prakiraan cuaca BMKG dan model cuaca "
    "terbuka, bukan pengukuran WBGT di lokasi Anda dan bukan pengganti nasihat medis "
    "atau pengukuran iklim kerja resmi (Permenaker No. 5/2018). Bila ada gejala bingung, "
    "pingsan, kejang, atau kulit panas dan kering: segera dinginkan tubuh dan hubungi 119."
)
