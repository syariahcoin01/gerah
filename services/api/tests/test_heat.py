import pandas as pd

from app.heat import heat_index_c, wbgt
from app.ingest import parse_bmkg
from app.risk import level_for


def test_heat_index_nws_reference():
    # Tabel NWS: 90 °F & 70 % RH ≈ 106 °F (41,1 °C)
    assert abs(heat_index_c(32.22, 70) - 41.1) < 0.6
    # suhu sejuk: HI ≈ suhu udara
    assert abs(heat_index_c(22, 60) - 22) < 1.0


def test_wbgt_sun_higher_than_shade():
    idx = pd.date_range("2026-10-14 05:00", periods=2, freq="h", tz="UTC")  # 12–13 WIB
    sun, shade, method = wbgt(idx, -6.9, 107.6, [33, 34], [55, 50], [2.0, 1.5], [850, 800], [925, 925])
    assert method == "liljegren"
    assert (sun > shade + 3).all()
    assert 30 < sun[0] < 36


def test_levels():
    assert level_for(26, "pekerja") == 1
    assert level_for(33.5, "pekerja") == 5
    assert level_for(29, "guru") == 3            # tabel sekolah lebih ketat
    assert level_for(29, "pekerja", "berat") == 3  # nama lama tetap didukung
    assert level_for(29, "pekerja", acclimatized=False) == 3


def test_parse_bmkg_nested():
    payload = {"lokasi": {"desa": "Dago", "lat": -6.88, "lon": 107.61},
               "data": [{"lokasi": {}, "cuaca": [[
                   {"utc_datetime": "2026-10-25 03:00:00", "local_datetime": "2026-10-25 10:00:00",
                    "t": 29, "hu": 60, "ws": 7.2, "tcc": 40, "weather_desc": "Cerah Berawan"},
                   {"utc_datetime": "2026-10-25 06:00:00", "local_datetime": "2026-10-25 13:00:00",
                    "t": 31, "hu": 52, "ws": 10.8, "tcc": 60, "weather_desc": "Berawan"}]]}]}
    df = parse_bmkg(payload)
    assert len(df) == 2
    assert abs(df["ws"].iloc[0] - 2.0) < 1e-6
