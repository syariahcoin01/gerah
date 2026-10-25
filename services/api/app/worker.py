"""Worker terjadwal: jalankan siklus ingest saat start lalu tiap N menit."""
import logging

from apscheduler.schedulers.blocking import BlockingScheduler

from . import db
from .config import settings
from .ingest import run_cycle

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")


def safe_cycle():
    try:
        run_cycle()
    except Exception:
        logging.exception("Siklus ingest gagal")


def main():
    db.init_db()
    safe_cycle()
    sched = BlockingScheduler(timezone=settings.timezone)
    sched.add_job(safe_cycle, "interval", minutes=settings.ingest_interval_min,
                  max_instances=1, coalesce=True)
    logging.info("Worker aktif, interval %s menit", settings.ingest_interval_min)
    sched.start()


if __name__ == "__main__":
    main()
