from __future__ import annotations

import math
from contextlib import asynccontextmanager
from datetime import datetime, time, timedelta
from typing import Literal
from zoneinfo import ZoneInfo

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from . import db
from .config import settings
from .heat import heat_index_c
from .heatmap import HOURS, build_map
from .risk import (DISCLAIMER, LEVELS, ROLES, THRESHOLDS, advice, level_for, normalize_role,
                   table_for, uv_category)

ATTRIBUTION = [
    {"name": "BMKG (Badan Meteorologi, Klimatologi, dan Geofisika)", "url": "https://data.bmkg.go.id",
     "use": "Prakiraan suhu, kelembapan, angin, tutupan awan"},
    {"name": "Open-Meteo (CC BY 4.0)", "url": "https://open-meteo.com",
     "use": "Radiasi matahari, indeks UV, tekanan udara"},
]


@asynccontextmanager
async def lifespan(app: FastAPI):
    db.init_db()
    yield


app = FastAPI(title="Gerah API", version="0.1.0", root_path="/api", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins.split(","),
                   allow_methods=["GET"], allow_headers=["*"])
app.add_middleware(GZipMiddleware, minimum_size=2000)


def _r(x, n=1):
    return None if x is None or (isinstance(x, float) and math.isnan(x)) else round(float(x), n)


@app.get("/health")
def health():
    with db.get_pool().connection() as conn:
        row = conn.execute("SELECT max(computed_at) AS last FROM forecast_hourly").fetchone()
    return {"status": "ok", "last_ingest": row["last"]}


@app.get("/v1/meta")
def meta():
    return {"levels": LEVELS, "thresholds": THRESHOLDS, "roles": ROLES, "disclaimer": DISCLAIMER,
            "attribution": ATTRIBUTION}


@app.get("/v1/locations")
def locations():
    with db.get_pool().connection() as conn:
        return conn.execute(
            "SELECT adm4, name, kecamatan, kota, lat, lon FROM locations ORDER BY kecamatan, name"
        ).fetchall()


@app.get("/v1/locations/nearest")
def nearest(lat: float, lon: float):
    with db.get_pool().connection() as conn:
        row = conn.execute(
            """SELECT adm4, name, kecamatan, kota, lat, lon,
                      sqrt(power(lat-%s,2)+power((lon-%s)*cos(radians(%s)),2))*111.0 AS km
               FROM locations ORDER BY km LIMIT 1""", (lat, lon, lat)).fetchone()
    if not row:
        raise HTTPException(404, "Belum ada lokasi")
    return row


@app.get("/v1/forecast/{adm4}")
def forecast(
    adm4: str,
    role: str = Query("tukang", description="mandor, tukang, kebersihan, pedagang, penjaga, "
                                             "guru, pelajar, olahraga, keluarga, umum"),
    workload: Literal["ringan", "sedang", "berat", "sangat_berat"] | None = None,
    acclimatized: bool = True,
    hours: int = Query(48, ge=1, le=72),
):
    role = normalize_role(role)
    with db.get_pool().connection() as conn:
        loc = conn.execute("SELECT adm4, name, kecamatan, kota, lat, lon FROM locations WHERE adm4=%s",
                           (adm4,)).fetchone()
        if not loc:
            raise HTTPException(404, "Kelurahan tidak terdaftar")
        rows = conn.execute(
            """SELECT * FROM forecast_hourly WHERE adm4=%s AND ts >= date_trunc('hour', now())
               ORDER BY ts LIMIT %s""", (adm4, hours)).fetchall()
    if not rows:
        raise HTTPException(503, "Data prakiraan belum tersedia, coba lagi nanti")

    timeline = []
    for r in rows:
        lvl = level_for(r["wbgt_sun"], role, workload, acclimatized)
        timeline.append({
            "ts": r["ts"].isoformat(),
            "t": _r(r["t"]), "rh": _r(r["rh"], 0), "ws": _r(r["ws"]),
            "uv": uv_category(r["uv"]) if r["uv"] is not None else None,
            "ghi": _r(r["ghi"], 0), "weather": r["weather"],
            "terasa_seperti": _r(r["hi"]),
            "wbgt_matahari": _r(r["wbgt_sun"]), "wbgt_teduh": _r(r["wbgt_shade"]),
            "level": lvl,
            "level_teduh": level_for(r["wbgt_shade"], role, workload, acclimatized),
        })
    now = timeline[0]
    peak = max(timeline[:24], key=lambda x: (x["level"], x["wbgt_matahari"] or 0))
    return {
        "lokasi": loc,
        "peran": role, "beban_kerja": workload or ROLES[role]["workload"],
        "tabel_ambang": table_for(role, workload), "teraklimatisasi": acclimatized,
        "sekarang": {**now, "saran": advice(now["level"], role)},
        "puncak_24jam": {"ts": peak["ts"], "level": peak["level"], "wbgt_matahari": peak["wbgt_matahari"]},
        "timeline": timeline,
        "metode": rows[0]["method"], "sumber_data": rows[0]["src"],
        "diperbarui": rows[0]["computed_at"].isoformat(),
        "label": "Estimasi model (bukan pengukuran WBGT)",
        "attribution": ATTRIBUTION, "disclaimer": DISCLAIMER,
    }


@app.get("/v1/weekly/{adm4}")
def weekly(adm4: str, role: str = "mandor", workload: str | None = None):
    role = normalize_role(role)
    """Ringkasan 7 hari terakhir: jam kerja (07–17 WIB) per level, untuk laporan mandor."""
    with db.get_pool().connection() as conn:
        rows = conn.execute(
            """SELECT ts, wbgt_sun FROM forecast_hourly WHERE adm4=%s
               AND ts >= now() - interval '7 days' AND ts < now()
               AND extract(hour FROM ts AT TIME ZONE 'Asia/Jakarta') BETWEEN 7 AND 16
               ORDER BY ts""", (adm4,)).fetchall()
    days: dict[str, dict] = {}
    for r in rows:
        d = r["ts"].astimezone(ZoneInfo(settings.timezone)).date().isoformat()
        lvl = level_for(r["wbgt_sun"], role, workload)
        days.setdefault(d, {str(i): 0 for i in range(1, 6)})[str(lvl)] += 1
    return {"adm4": adm4, "hari": days, "catatan": "Jumlah jam kerja (07.00–17.00 WIB) per level"}


@app.get("/v1/map")
def heat_map(
    role: str = "umum",
    workload: Literal["ringan", "sedang", "berat", "sangat_berat"] | None = None,
    acclimatized: bool = True,
):
    """Level panas semua kelurahan per jam 07–17 WIB, hari ini & besok (untuk peta)."""
    role = normalize_role(role)
    tz = ZoneInfo(settings.timezone)
    today = datetime.now(tz).date()
    start = datetime.combine(today, time(0), tz)
    with db.get_pool().connection() as conn:
        adm4s = [r["adm4"] for r in conn.execute("SELECT adm4 FROM locations ORDER BY adm4").fetchall()]
        rows = conn.execute(
            """SELECT adm4, ts, wbgt_sun FROM forecast_hourly
               WHERE ts >= %s AND ts < %s
                 AND extract(hour FROM ts AT TIME ZONE %s) BETWEEN 7 AND 17""",
            (start, start + timedelta(days=2), settings.timezone)).fetchall()
        last = conn.execute("SELECT max(computed_at) AS last FROM forecast_hourly").fetchone()["last"]
    return {
        "peran": role, "beban_kerja": workload or ROLES[role]["workload"],
        "jam": HOURS, "hari": build_map(rows, adm4s, today, settings.timezone, role, workload, acclimatized),
        "diperbarui": last.isoformat() if last else None,
        "label": "Estimasi model WBGT di bawah matahari (bukan pengukuran)",
        "attribution": ATTRIBUTION,
    }


@app.get("/v1/heat-index")
def hi_calc(t: float = Query(..., description="Suhu °C"), rh: float = Query(..., ge=0, le=100)):
    return {"t": t, "rh": rh, "heat_index_c": round(heat_index_c(t, rh), 1),
            "catatan": "Heat index NWS untuk kondisi teduh; di bawah matahari bisa +7,5 °C lebih panas"}
