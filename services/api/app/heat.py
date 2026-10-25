"""Perhitungan indeks panas.

- heat_index_c   : NWS (Steadman + regresi Rothfusz + penyesuaian). Kondisi TEDUH.
- wbgt           : WBGT luar ruang model Liljegren et al. (2008) via paket `pywbgt`,
                   dihitung dua versi: di bawah matahari (radiasi aktual) dan teduh
                   (radiasi = 0). Jika pywbgt gagal dimuat, jatuh ke pendekatan
                   sederhana (Stull wet-bulb + koreksi radiasi) yang LEBIH KASAR.

Semua nilai adalah ESTIMASI dari data prakiraan, bukan pengukuran WBGT.
"""
from __future__ import annotations

import math
from typing import Sequence

import numpy as np


# ---------------------------------------------------------------- heat index
def heat_index_c(t_c: float, rh: float) -> float:
    """Heat index NWS dalam °C. t_c suhu udara °C, rh kelembapan relatif %."""
    if t_c is None or rh is None:
        return float("nan")
    t = t_c * 9 / 5 + 32
    hi = 0.5 * (t + 61.0 + (t - 68.0) * 1.2 + rh * 0.094)
    if (hi + t) / 2 >= 80:
        hi = (-42.379 + 2.04901523 * t + 10.14333127 * rh
              - 0.22475541 * t * rh - 0.00683783 * t * t
              - 0.05481717 * rh * rh + 0.00122874 * t * t * rh
              + 0.00085282 * t * rh * rh - 0.00000199 * t * t * rh * rh)
        if rh < 13 and 80 <= t <= 112:
            hi -= ((13 - rh) / 4) * math.sqrt((17 - abs(t - 95)) / 17)
        elif rh > 85 and 80 <= t <= 87:
            hi += ((rh - 85) / 10) * ((87 - t) / 5)
    return (hi - 32) * 5 / 9


def stull_wetbulb_c(t_c: float, rh: float) -> float:
    """Suhu bola basah psikrometrik (Stull 2011), akurat ±0,3 °C untuk RH 5–99%."""
    return (t_c * math.atan(0.151977 * math.sqrt(rh + 8.313659))
            + math.atan(t_c + rh) - math.atan(rh - 1.676331)
            + 0.00391838 * rh ** 1.5 * math.atan(0.023101 * rh) - 4.686035)


# ---------------------------------------------------------------- WBGT
def _wbgt_simple(t: np.ndarray, rh: np.ndarray, ghi: np.ndarray, ws: np.ndarray):
    """Fallback kasar bila pywbgt tidak ada. Konstanta perlu kalibrasi sensor."""
    tw = np.array([stull_wetbulb_c(a, b) for a, b in zip(t, rh)])
    ws = np.maximum(ws, 0.5)
    dtg = 0.018 * ghi / (1 + 0.8 * np.sqrt(ws))      # kenaikan suhu globe
    dtnwb = 0.0025 * ghi / (1 + 0.5 * np.sqrt(ws))   # pemanasan sumbu basah
    sun = 0.7 * (tw + dtnwb) + 0.2 * (t + dtg) + 0.1 * t
    shade = 0.7 * tw + 0.3 * t
    return sun, shade, "simple"


def wbgt(times_utc, lat: float, lon: float,
         t: Sequence[float], rh: Sequence[float], ws10: Sequence[float],
         ghi: Sequence[float], pres_hpa: Sequence[float]):
    """Kembalikan (wbgt_sun, wbgt_shade, method) sebagai array numpy (°C)."""
    t = np.asarray(t, float)
    rh = np.clip(np.asarray(rh, float), 1, 100)
    ws10 = np.asarray(ws10, float)
    ghi = np.clip(np.nan_to_num(np.asarray(ghi, float)), 0, 1400)
    pres = np.nan_to_num(np.asarray(pres_hpa, float), nan=925.0)
    try:
        import pandas as pd
        from metpy.calc import dewpoint_from_relative_humidity
        from metpy.units import units
        from pywbgt import liljegrenWBGT

        idx = pd.DatetimeIndex(pd.to_datetime(times_utc, utc=True))
        tq = t * units.degC
        td = dewpoint_from_relative_humidity(tq, rh * units.percent)
        common = dict(
            pres=pres * units.hPa, temp_air=tq, temp_dew=td,
            speed=ws10 * units("m/s"), urban=np.array([1]), zspeed=10 * units.m,
        )
        sun = liljegrenWBGT(idx, np.array([lat]), np.array([lon]),
                            solar=ghi * units("W/m**2"), **common)["Twbg"]
        shade = liljegrenWBGT(idx, np.array([lat]), np.array([lon]),
                              solar=np.zeros_like(ghi) * units("W/m**2"), **common)["Twbg"]
        return np.asarray(sun.m, float), np.asarray(shade.m, float), "liljegren"
    except Exception:  # pragma: no cover - jalur cadangan
        return _wbgt_simple(t, rh, ghi, ws10)
