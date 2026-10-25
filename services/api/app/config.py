from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="GERAH_", env_file=".env", extra="ignore")

    database_url: str = "postgresql://gerah:gerah@db:5432/gerah"

    # Sumber data
    bmkg_base: str = "https://api.bmkg.go.id/publik/prakiraan-cuaca"
    openmeteo_base: str = "https://api.open-meteo.com/v1/forecast"
    bmkg_delay_s: float = 1.1          # batas BMKG: 60 req/menit/IP
    bmkg_max_age_min: int = 180        # BMKG update 2x/hari, cukup ambil ulang tiap 3 jam
    ingest_interval_min: int = 60      # siklus worker (Open-Meteo per jam)

    locations_file: str = "/app/locations.json"
    cors_origins: str = "*"

    # Jika API luar tidak bisa dijangkau, isi data sintetis berlabel "demo"
    # (berguna untuk kelas/praktikum). JANGAN aktifkan di produksi.
    demo_fallback: bool = False

    timezone: str = "Asia/Jakarta"


settings = Settings()
