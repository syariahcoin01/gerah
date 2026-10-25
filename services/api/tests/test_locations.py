import json
from pathlib import Path

from app import ingest

LOC_FILE = Path(__file__).resolve().parent.parent / "locations.json"


def test_all_bandung_kelurahan_present():
    locs = json.loads(LOC_FILE.read_text())
    codes = [l["adm4"] for l in locs]
    assert len(locs) == 151
    assert len(set(codes)) == 151
    assert len({c[:8] for c in codes}) == 30            # 30 kecamatan
    assert all(c.startswith("32.73.") for c in codes)
    for l in locs:                                       # semua di dalam Kota Bandung
        assert -7.05 < l["lat"] < -6.80 and 107.50 < l["lon"] < 107.80


class _Resp:
    def __init__(self, n):
        self.n = n

    def raise_for_status(self):
        pass

    def json(self):
        hourly = {k: [1, 2] for k in ("temperature_2m", "relative_humidity_2m", "wind_speed_10m",
                                       "shortwave_radiation", "uv_index", "surface_pressure", "cloud_cover")}
        hourly["time"] = ["2026-10-25T00:00", "2026-10-25T01:00"]
        return [{"hourly": hourly} for _ in range(self.n)]


class _Client:
    def __init__(self):
        self.calls = []

    def get(self, url, params):
        n = len(params["latitude"].split(","))
        self.calls.append(n)
        return _Resp(n)


def test_openmeteo_is_chunked():
    locs = [{"lat": -6.9, "lon": 107.6}] * 151
    client = _Client()
    out = ingest.get_openmeteo(client, locs)
    assert client.calls == [50, 50, 50, 1]
    assert len(out) == 151 and all(df is not None for df in out)
