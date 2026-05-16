"""
db.py — MySQL connector for the scraper.
Reads DATABASE_URL from .env (same as Next.js app).
"""

import os
import re
import urllib.parse
import pymysql
import pymysql.cursors
from dotenv import load_dotenv

# Load .env from the project root (two levels up from python-services/scraper/)
_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
load_dotenv(os.path.join(_ROOT, ".env"))


def _parse_db_url(url: str):
    """Parse mysql://user:pass@host:port/dbname into a dict."""
    # Handle percent-encoded characters in password
    match = re.match(
        r"mysql://([^:]+):([^@]+)@([^:/]+):?(\d+)?/(.+)", url
    )
    if not match:
        raise ValueError(f"Cannot parse DATABASE_URL: {url}")
    user, pw_encoded, host, port, db = match.groups()
    password = urllib.parse.unquote(pw_encoded)
    return {
        "host": host,
        "port": int(port or 3306),
        "user": user,
        "password": password,
        "database": db,
        "charset": "utf8mb4",
        "cursorclass": pymysql.cursors.DictCursor,
    }


def get_connection():
    url = os.environ["DATABASE_URL"]
    cfg = _parse_db_url(url)
    return pymysql.connect(**cfg)


def upsert_opportunity(conn, record: dict):
    """
    Insert or update a scraped opportunity.
    Uses externalId as the dedup key.
    """
    sql = """
        INSERT INTO scraped_opportunities
            (externalId, source, type, title, description, tags, company,
             location, stipend, deadline, registrationLink, isActive, isVerified,
             scrapedAt, updatedAt)
        VALUES
            (%(externalId)s, %(source)s, %(type)s, %(title)s, %(description)s,
             %(tags)s, %(company)s, %(location)s, %(stipend)s, %(deadline)s,
             %(registrationLink)s, 1, 0, NOW(), NOW())
        ON DUPLICATE KEY UPDATE
            title            = VALUES(title),
            description      = VALUES(description),
            tags             = VALUES(tags),
            company          = VALUES(company),
            location         = VALUES(location),
            stipend          = VALUES(stipend),
            deadline         = VALUES(deadline),
            registrationLink = VALUES(registrationLink),
            isActive         = 1,
            updatedAt        = NOW()
    """
    with conn.cursor() as cur:
        cur.execute(sql, record)
    conn.commit()


def bulk_upsert(records: list[dict]):
    """Upsert a list of records, returning (inserted, skipped) counts."""
    if not records:
        return 0, 0
    conn = get_connection()
    try:
        inserted = 0
        errors = 0
        for rec in records:
            try:
                upsert_opportunity(conn, rec)
                inserted += 1
            except Exception as e:
                print(f"[DB] Upsert error for {rec.get('externalId')}: {e}")
                errors += 1
        return inserted, errors
    finally:
        conn.close()
