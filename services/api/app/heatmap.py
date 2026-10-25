"""Data peta panas: level per kelurahan per jam (07–17 WIB) untuk hari ini dan besok."""
from __future__ import annotations

from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from .risk import level_for

HOURS = list(range(7, 18))   # 07.00 … 17.00 WIB


def build_map(rows, adm4s: list[str], today: date, tz: str, role: str,
              workload: str | None = None, acclimatized: bool = True) -> list[dict]:
    """rows: iterable dict {adm4, ts (aware), wbgt_sun}. Hasil: dua hari, tiap kelurahan
    berisi larik WBGT (1 desimal) dan level sepanjang HOURS; jam tanpa data → null / 0."""
    zone = ZoneInfo(tz)
    days = [today, today + timedelta(days=1)]
    idx = {d: i for i, d in enumerate(days)}
    grid = [{a: [None] * len(HOURS) for a in adm4s} for _ in days]
    for r in rows:
        local: datetime = r["ts"].astimezone(zone)
        di = idx.get(local.date())
        if di is None or local.hour not in HOURS or r["adm4"] not in grid[di]:
            continue
        w = r["wbgt_sun"]
        grid[di][r["adm4"]][local.hour - HOURS[0]] = None if w is None else round(float(w), 1)
    out = []
    for d, g in zip(days, grid):
        data = {a: {"w": ws, "l": [level_for(w, role, workload, acclimatized) for w in ws]}
                for a, ws in g.items()}
        has = any(w is not None for v in g.values() for w in v)
        out.append({"tanggal": d.isoformat(), "ada_data": has, "data": data})
    return out
