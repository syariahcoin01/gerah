"""Ingestor: ambil BMKG + Open-Meteo, fusi, hitung HI & WBGT, simpan ke Postgres."""
from __future__ import annotations

import logging
import math
import time
from datetime import datetime, timedelta, timezone

import httpx
import numpy as np
import pandas as pd
from psycopg.types.json import Jsonb

from . import db
from .config import settings
from .heat import heat_index_c, wbgt

log = logging.getLogger("gerah.ingest")
UA = {"User-Agent": "Gerah/0.1 (Prodi SI Universitas Widyatama; edukasi heat stress)"}
OM_VARS = ("temperature_2m,relative_humidity_2m,wind_speed_10m,shortwave_radiation,"
           "uv_index,surface_pressure,cloud_cover")


# ------------------------------------------------------------------ BMKG
def _walk_entries(obj):
    if isinstance(obj, dict):
        if "t" in obj and ("utc_datetime" in obj or "local_datetime" in obj):
            yield obj
        else:
            for v in obj.values():
                yield from _walk_entries(v)
    elif isinstance(obj, list):
        for v in obj:
            yield from _walk_entries(v)


def parse_bmkg(payload: dict) -> pd.DataFrame:
    rows = []
    for e in _walk_entries(payload):
        if e.get("utc_datetime"):
            ts = pd.Timestamp(e["utc_datetime"], tz="UTC")
        else:
            ts = pd.Timestamp(e["local_datetime"]).tz_localize(settings.timezone).tz_convert("UTC")
        rows.append({
            "ts": ts,
            "t": e.get("t"),
            "rh": e.get("hu"),
            "ws": (e.get("ws") or 0) / 3.6 if e.get("ws") is not None else None,  # km/jam → m/s
            "tcc": e.get("tcc"),
            "weather": e.get("weather_desc"),
        })
    if not rows:
        return pd.DataFrame(columns=["t", "rh", "ws", "tcc", "weather"])
    return pd.DataFrame(rows).drop_duplicates("ts").set_index("ts").sort_index()


def bmkg_location(payload: dict) -> dict | None:
    lok = payload.get("lokasi") or {}
    if not lok and isinstance(payload.get("data"), list) and payload["data"]:
        lok = payload["data"][0].get("lokasi") or {}
    try:
        return {"name": lok.get("desa"), "kecamatan": lok.get("kecamatan"),
                "kota": lok.get("kotkab"), "lat": float(lok["lat"]), "lon": float(lok["lon"])}
    except (KeyError, TypeError, ValueError):
        return None


def get_bmkg(client: httpx.Client, conn, adm4: str) -> dict | None:
    """Pakai payload BMKG yang masih segar dari DB; kalau tidak ada, ambil dari API."""
    row = conn.execute(
        """SELECT payload FROM forecast_raw WHERE source='bmkg' AND adm4=%s
           AND fetched_at > now() - make_interval(mins => %s)
           ORDER BY fetched_at DESC LIMIT 1""",
        (adm4, settings.bmkg_max_age_min),
    ).fetchone()
    if row:
        return row["payload"]
    try:
        r = client.get(settings.bmkg_base, params={"adm4": adm4})
        r.raise_for_status()
        payload = r.json()
        conn.execute("INSERT INTO forecast_raw (source, adm4, payload) VALUES ('bmkg', %s, %s)",
                     (adm4, Jsonb(payload)))
        time.sleep(settings.bmkg_delay_s)
        return payload
    except Exception as exc:
        log.warning("BMKG %s gagal: %s", adm4, exc)
        return None


# ------------------------------------------------------------------ Open-Meteo
OM_CHUNK = 50  # lokasi per permintaan, agar URL tidak terlalu panjang


def get_openmeteo(client: httpx.Client, locs: list[dict]) -> list[pd.DataFrame | None]:
    """Ambil Open-Meteo untuk banyak lokasi, dipecah per OM_CHUNK lokasi."""
    out: list[pd.DataFrame | None] = []
    for i in range(0, len(locs), OM_CHUNK):
        out.extend(_openmeteo_chunk(client, locs[i:i + OM_CHUNK]))
    return out


def _openmeteo_chunk(client: httpx.Client, locs: list[dict]) -> list[pd.DataFrame | None]:
    params = {
        "latitude": ",".join(f"{l['lat']:.4f}" for l in locs),
        "longitude": ",".join(f"{l['lon']:.4f}" for l in locs),
        "hourly": OM_VARS, "wind_speed_unit": "ms", "timezone": "GMT", "forecast_days": 3,
    }
    try:
        r = client.get(settings.openmeteo_base, params=params)
        r.raise_for_status()
        data = r.json()
    except Exception as exc:
        log.warning("Open-Meteo gagal (%d lokasi): %s", len(locs), exc)
        return [None] * len(locs)
    data = data if isinstance(data, list) else [data]
    if len(data) != len(locs):
        log.warning("Open-Meteo mengembalikan %d dari %d lokasi", len(data), len(locs))
        return [None] * len(locs)
    out: list[pd.DataFrame | None] = []
    for d in data:
        h = d["hourly"]
        df = pd.DataFrame({
            "t": h["temperature_2m"], "rh": h["relative_humidity_2m"],
            "ws": h["wind_speed_10m"], "ghi": h["shortwave_radiation"],
            "uv": h["uv_index"], "pres": h["surface_pressure"], "cc": h["cloud_cover"],
        }, index=pd.to_datetime(h["time"], utc=True)).astype(float)  # RH dikirim sbg bilangan bulat
        out.append(df)
    return out


# ------------------------------------------------------------------ demo
def demo_frame(lat: float) -> pd.DataFrame:
    """Data sintetis berbentuk siklus harian Bandung (HANYA untuk demo/praktikum)."""
    now = pd.Timestamp.now(tz="UTC").floor("h")
    idx = pd.date_range(now - pd.Timedelta(hours=2), periods=72, freq="h")
    local_h = (idx.tz_convert(settings.timezone).hour + idx.minute / 60).to_numpy()
    day = np.clip(np.sin(np.pi * (local_h - 6) / 12), 0, None)
    peak = np.clip(np.sin(np.pi * (local_h - 7.5) / 12), 0, None)
    return pd.DataFrame({
        "t": 20.5 + 12.0 * peak, "rh": 88 - 38 * peak, "ws": 1.2 + 1.5 * day,
        "ghi": 880 * day, "uv": 11 * day ** 1.3, "pres": 925.0, "cc": 30.0,
        "tcc": np.nan, "weather": ["Cerah" if d > 0 else "Cerah Berawan" for d in day],
    }, index=idx)


# ------------------------------------------------------------------ fusi
def fuse(om: pd.DataFrame | None, bm: pd.DataFrame | None) -> tuple[pd.DataFrame, str]:
    if om is None and (bm is None or bm.empty):
        raise ValueError("tidak ada data")
    if om is None:  # hanya BMKG: perkirakan radiasi kasar dari tutupan awan
        idx = pd.date_range(bm.index.min(), bm.index.max(), freq="h")
        df = bm[["t", "rh", "ws", "tcc"]].astype(float).reindex(bm.index.union(idx)) \
            .interpolate("time").reindex(idx)
        df["weather"] = bm["weather"].reindex(idx, method="ffill")
        lh = df.index.tz_convert(settings.timezone).hour.to_numpy()
        clear = 950 * np.clip(np.sin(np.pi * (lh - 6) / 12), 0, None)
        df["ghi"] = clear * (1 - 0.75 * df["tcc"].fillna(50) / 100)
        df["uv"] = np.nan
        df["pres"] = 925.0
        return df, "bmkg"

    df = om.astype(float)
    src = "openmeteo"
    if bm is not None and not bm.empty:
        num = bm[["t", "rh", "ws", "tcc"]].astype(float)
        merged = num.reindex(num.index.union(df.index)).interpolate("time", limit_area="inside")
        merged = merged.reindex(df.index)
        inside = merged["t"].notna()
        for col in ("t", "rh", "ws"):
            df.loc[inside, col] = merged.loc[inside, col]
        df["tcc"] = merged["tcc"]
        # koreksi radiasi bila BMKG melihat awan jauh lebih tebal dari model
        gap = (df["tcc"] - df["cc"]).clip(lower=0).fillna(0)
        df["ghi"] = df["ghi"] * (1 - 0.75 * gap / 100).clip(0.25, 1)
        df["weather"] = bm["weather"].reindex(df.index, method="ffill")
        src = "bmkg+openmeteo" if inside.any() else "openmeteo"
    else:
        df["tcc"] = np.nan
        df["weather"] = None
    return df, src


def compute_and_store(conn, loc: dict, df: pd.DataFrame, src: str) -> int:
    df = df.dropna(subset=["t", "rh"])
    if df.empty:
        return 0
    ws = df["ws"].fillna(1.0).to_numpy()
    pres = df["pres"].fillna(925.0).to_numpy()
    sun, shade, method = wbgt(df.index, loc["lat"], loc["lon"], df["t"].to_numpy(),
                              df["rh"].to_numpy(), ws, df["ghi"].fillna(0).to_numpy(), pres)

    def f(x):
        return None if x is None or (isinstance(x, float) and math.isnan(x)) else float(x)

    rows = []
    for i, (ts, r) in enumerate(df.iterrows()):
        rows.append((loc["adm4"], ts.to_pydatetime(), f(r.t), f(r.rh), f(ws[i]), f(r.get("tcc")),
                     f(r.get("ghi")), f(r.get("uv")), f(pres[i]), r.get("weather"),
                     f(heat_index_c(r.t, r.rh)), f(sun[i]), f(shade[i]), method, src))
    with conn.cursor() as cur:
        cur.executemany(
            """INSERT INTO forecast_hourly
               (adm4, ts, t, rh, ws, tcc, ghi, uv, pres, weather, hi, wbgt_sun, wbgt_shade, method, src)
               VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
               ON CONFLICT (adm4, ts) DO UPDATE SET
                 t=EXCLUDED.t, rh=EXCLUDED.rh, ws=EXCLUDED.ws, tcc=EXCLUDED.tcc, ghi=EXCLUDED.ghi,
                 uv=EXCLUDED.uv, pres=EXCLUDED.pres, weather=EXCLUDED.weather, hi=EXCLUDED.hi,
                 wbgt_sun=EXCLUDED.wbgt_sun, wbgt_shade=EXCLUDED.wbgt_shade,
                 method=EXCLUDED.method, src=EXCLUDED.src, computed_at=now()""",
            rows,
        )
    return len(rows)


def run_cycle() -> dict:
    stats = {"locations": 0, "rows": 0, "sources": {}}
    with db.get_pool().connection() as conn, httpx.Client(timeout=20, headers=UA) as client:
        locs = conn.execute("SELECT * FROM locations ORDER BY adm4").fetchall()
        bmkg = {}
        for loc in locs:
            payload = get_bmkg(client, conn, loc["adm4"])
            if payload:
                bmkg[loc["adm4"]] = parse_bmkg(payload)
                meta = bmkg_location(payload)
                if meta and meta["name"]:
                    conn.execute(
                        """UPDATE locations SET name=%(name)s, kecamatan=%(kecamatan)s,
                           kota=%(kota)s, lat=%(lat)s, lon=%(lon)s, updated_at=now()
                           WHERE adm4=%(adm4)s""", {**meta, "adm4": loc["adm4"]})
                    loc.update(meta)
        oms = get_openmeteo(client, locs)
        for loc, om in zip(locs, oms):
            try:
                df, src = fuse(om, bmkg.get(loc["adm4"]))
            except ValueError:
                if not settings.demo_fallback:
                    log.error("Tidak ada data untuk %s", loc["adm4"])
                    continue
                df, src = demo_frame(loc["lat"]), "demo"
            n = compute_and_store(conn, loc, df, src)
            stats["locations"] += 1
            stats["rows"] += n
            stats["sources"][loc["adm4"]] = src
        conn.execute("DELETE FROM forecast_hourly WHERE ts < now() - interval '14 days'")
        conn.execute("DELETE FROM forecast_raw WHERE fetched_at < now() - interval '7 days'")
    log.info("Siklus ingest selesai: %s", stats)
    return stats
