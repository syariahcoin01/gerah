import json
from datetime import date, datetime, timezone
from pathlib import Path

from app.heatmap import HOURS, build_map

ROOT = Path(__file__).resolve().parents[1]


def _ts(d, hour_wib):
    return datetime(d.year, d.month, d.day, hour_wib - 7, tzinfo=timezone.utc)


def test_build_map_grid_and_levels():
    today = date(2026, 10, 25)
    rows = [
        {"adm4": "A", "ts": _ts(today, 7), "wbgt_sun": 24.04},
        {"adm4": "A", "ts": _ts(today, 13), "wbgt_sun": 33.0},
        {"adm4": "B", "ts": _ts(date(2026, 10, 26), 12), "wbgt_sun": 30.0},
        {"adm4": "A", "ts": _ts(today, 18), "wbgt_sun": 40.0},     # di luar jam 07–17
        {"adm4": "X", "ts": _ts(today, 12), "wbgt_sun": 30.0},     # bukan lokasi terdaftar
    ]
    hari = build_map(rows, ["A", "B"], today, "Asia/Jakarta", "tukang")
    assert [h["tanggal"] for h in hari] == ["2026-10-25", "2026-10-26"]
    a = hari[0]["data"]["A"]
    assert len(a["w"]) == len(HOURS) == 11
    assert a["w"][0] == 24.0 and a["w"][13 - 7] == 33.0
    assert a["l"][1] == 0                      # jam tanpa data
    assert a["l"][13 - 7] > a["l"][0] >= 1     # siang lebih berisiko
    assert hari[1]["data"]["B"]["w"][12 - 7] == 30.0
    assert hari[0]["ada_data"] and hari[1]["ada_data"]


def test_map_asset_covers_all_locations():
    locs = {l["adm4"] for l in json.loads((ROOT / "locations.json").read_text())}
    asset = ROOT.parents[1] / "apps/mobile/assets/map/bandung-kelurahan.json"
    if not asset.exists():   # image API tidak membawa folder aplikasi
        return
    m = json.loads(asset.read_text())
    assert {f["adm4"] for f in m["features"]} == locs
