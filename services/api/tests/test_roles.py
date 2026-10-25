import pytest

from app.risk import BY_ROLE, ROLES, THRESHOLDS, advice, level_for, normalize_role, table_for


def test_every_role_has_table_and_advice():
    for role in ROLES:
        assert table_for(role) in THRESHOLDS
        for lvl in range(1, 6):
            a = advice(lvl, role)
            assert a["peran"] and "{" not in a["peran"] and "{" not in a["umum"]
    assert set(BY_ROLE) == set(ROLES)


def test_legacy_and_unknown_roles():
    assert normalize_role("pekerja") == "tukang"
    assert normalize_role("ojol") == "umum"
    assert normalize_role(None) == "umum"


@pytest.mark.parametrize("wbgt,role,expected", [
    # WBGT 27,5: penyapu (berat) sudah Waspada, PKL (ringan) masih Aman
    (27.5, "kebersihan", 2),
    (27.5, "pedagang", 1),
    (27.5, "tukang", 1),
    # WBGT 30,5: sedang = Siaga, berat = Bahaya, ringan = Aman
    (30.5, "tukang", 3),
    (30.5, "kebersihan", 4),
    (30.5, "penjaga", 2),
    # olahraga lebih ketat: 28 sudah Bahaya
    (28.0, "olahraga", 4),
    # sekolah: guru & pelajar memakai tabel yang sama
    (29.0, "guru", 3),
    (29.0, "pelajar", 3),
    # pendamping keluarga 25/28/31/33
    (26.0, "keluarga", 2),
    # warga umum (myENV): 30 Aman, 33 Bahaya, 35 Ekstrem
    (30.0, "umum", 1),
    (33.0, "umum", 4),
    (35.0, "umum", 5),
])
def test_levels_per_role(wbgt, role, expected):
    assert level_for(wbgt, role) == expected


def test_workload_override_and_acclimatization():
    assert level_for(29.0, "tukang", "berat") == 3
    assert level_for(29.0, "tukang", "sedang") == 2
    assert level_for(29.0, "tukang", acclimatized=False) == 3
    # aklimatisasi tidak berlaku untuk warga umum / keluarga
    assert level_for(29.0, "umum", acclimatized=False) == 1
