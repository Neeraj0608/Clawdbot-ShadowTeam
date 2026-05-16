"""
cron_runner.py — Scheduled scraper runner.
Runs scraper at 6:00 AM daily + every 4 hours.
Start with: python cron_runner.py
"""

import schedule
import time
import logging
from datetime import datetime
from main import run_all_scrapers

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("scraper.log", encoding="utf-8"),
    ],
)
log = logging.getLogger(__name__)


def job():
    log.info("Scheduled scrape starting...")
    try:
        summary = run_all_scrapers()
        log.info(
            f"Scrape complete: {summary['inserted_or_updated']} upserted, "
            f"{summary['db_errors']} errors, {summary['elapsed_seconds']}s"
        )
    except Exception as e:
        log.error(f"Scrape failed: {e}", exc_info=True)


if __name__ == "__main__":
    log.info("CoE Scraper Cron Runner starting...")

    # Run once immediately on startup
    log.info("Running initial scrape...")
    job()

    # Schedule: 6:00 AM daily
    schedule.every().day.at("06:00").do(job)

    # Schedule: every 4 hours starting from 10 AM
    schedule.every(4).hours.do(job)

    log.info("Scheduler active. Next runs:")
    for j in schedule.jobs:
        log.info(f"  {j}")

    while True:
        schedule.run_pending()
        time.sleep(60)   # check every minute
