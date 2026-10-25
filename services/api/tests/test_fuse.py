import numpy as np
import pandas as pd

from app.ingest import demo_frame, fuse


def _bmkg_like(om_index):
    idx = om_index[::3]
    return pd.DataFrame({"t": 30.0, "rh": 60.0, "ws": 2.0, "tcc": 90.0, "weather": "Berawan"}, index=idx)


def test_fuse_bmkg_and_openmeteo():
    om = demo_frame(-6.9).drop(columns=["tcc", "weather"])
    bm = _bmkg_like(om.index)
    df, src = fuse(om, bm)
    assert src == "bmkg+openmeteo"
    assert len(df) == len(om)
    # suhu diambil dari BMKG di dalam rentangnya
    assert np.allclose(df["t"].iloc[:len(om) - 3].dropna(), 30.0)
    # awan tebal BMKG menurunkan radiasi model
    assert (df["ghi"] <= om["ghi"] + 1e-9).all()


def test_fuse_integer_columns_from_openmeteo():
    # Open-Meteo mengirim RH sebagai bilangan bulat → kolom int64
    om = demo_frame(-6.9).drop(columns=["tcc", "weather"])
    om["rh"] = om["rh"].round().astype("int64")
    bm = _bmkg_like(om.index)
    bm["rh"] = [61, 89, 97, 99, 70, 93, 80, 97][: len(bm)] + [90] * max(0, len(bm) - 8)
    df, _ = fuse(om, bm)
    assert df["rh"].dtype.kind == "f"


def test_fuse_bmkg_only():
    idx = pd.date_range("2026-10-25 00:00", periods=8, freq="3h", tz="UTC")
    bm = pd.DataFrame({"t": 28.0, "rh": 65.0, "ws": 1.5, "tcc": 50.0, "weather": "Cerah"}, index=idx)
    df, src = fuse(None, bm)
    assert src == "bmkg"
    assert len(df) == 22
    assert df["ghi"].max() > 0
