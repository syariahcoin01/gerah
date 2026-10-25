from __future__ import annotations

import json
import time
from pathlib import Path

import psycopg
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from .config import settings

SCHEMA = """
CREATE TABLE IF NOT EXISTS locations (
    adm4        TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    kecamatan   TEXT,
    kota        TEXT,
    lat         DOUBLE PRECISION NOT NULL,
    lon         DOUBLE PRECISION NOT NULL,
    updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS forecast_raw (
    id          BIGSERIAL PRIMARY KEY,
    source      TEXT NOT NULL,          -- bmkg | openmeteo
    adm4        TEXT NOT NULL,
    fetched_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    payload     JSONB NOT NULL
);
CREATE INDEX IF NOT EXISTS forecast_raw_lookup ON forecast_raw (source, adm4, fetched_at DESC);

CREATE TABLE IF NOT EXISTS forecast_hourly (
    adm4        TEXT NOT NULL REFERENCES locations(adm4) ON DELETE CASCADE,
    ts          TIMESTAMPTZ NOT NULL,
    t           REAL, rh REAL, ws REAL, tcc REAL, ghi REAL, uv REAL, pres REAL,
    weather     TEXT,
    hi          REAL,
    wbgt_sun    REAL,
    wbgt_shade  REAL,
    method      TEXT,
    src         TEXT,                   -- mis. "bmkg+openmeteo" | "openmeteo" | "demo"
    computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (adm4, ts)
);
"""

pool: ConnectionPool | None = None


def get_pool() -> ConnectionPool:
    global pool
    if pool is None:
        pool = ConnectionPool(settings.database_url, min_size=1, max_size=5,
                              kwargs={"row_factory": dict_row}, open=True)
    return pool


def wait_for_db(timeout: int = 60) -> None:
    start = time.time()
    while True:
        try:
            with psycopg.connect(settings.database_url, connect_timeout=3):
                return
        except psycopg.OperationalError:
            if time.time() - start > timeout:
                raise
            time.sleep(2)


def init_db() -> None:
    wait_for_db()
    with get_pool().connection() as conn:
        conn.execute(SCHEMA)
        seed_locations(conn)


def seed_locations(conn) -> None:
    path = Path(settings.locations_file)
    if not path.exists():
        return
    for loc in json.loads(path.read_text()):
        conn.execute(
            """INSERT INTO locations (adm4, name, kecamatan, kota, lat, lon)
               VALUES (%(adm4)s, %(name)s, %(kecamatan)s, %(kota)s, %(lat)s, %(lon)s)
               ON CONFLICT (adm4) DO NOTHING""",
            loc,
        )
