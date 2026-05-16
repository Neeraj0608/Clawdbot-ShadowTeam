"""
db.py — MySQL reader for the chatbot.
Loads ScrapedOpportunity records for RAG context building.
"""

import os
import re
import urllib.parse
import pymysql
import pymysql.cursors
from dotenv import load_dotenv

_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
load_dotenv(os.path.join(_ROOT, ".env"))


def _parse_db_url(url: str) -> dict:
    match = re.match(r"mysql://([^:]+):([^@]+)@([^:/]+):?(\d+)?/(.+)", url)
    if not match:
        raise ValueError(f"Cannot parse DATABASE_URL: {url}")
    user, pw_encoded, host, port, db = match.groups()
    return {
        "host": host,
        "port": int(port or 3306),
        "user": user,
        "password": urllib.parse.unquote(pw_encoded),
        "database": db,
        "charset": "utf8mb4",
        "cursorclass": pymysql.cursors.DictCursor,
    }


def get_connection():
    return pymysql.connect(**_parse_db_url(os.environ["DATABASE_URL"]))


def fetch_all_opportunities(limit: int = 500) -> list[dict]:
    """Fetch all active opportunities for embedding/indexing."""
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, externalId, source, type, title, description,
                       tags, company, location, stipend, deadline, registrationLink
                FROM scraped_opportunities
                WHERE isActive = 1
                ORDER BY updatedAt DESC
                LIMIT %s
                """,
                (limit,),
            )
            return cur.fetchall()
    finally:
        conn.close()


def keyword_search(query: str, limit: int = 10) -> list[dict]:
    """Fast MySQL LIKE search across title, description, tags, company."""
    q = f"%{query}%"
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, source, type, title, description,
                       company, location, stipend, deadline, registrationLink
                FROM scraped_opportunities
                WHERE isActive = 1
                  AND (
                      title       LIKE %s OR
                      description LIKE %s OR
                      tags        LIKE %s OR
                      company     LIKE %s
                  )
                ORDER BY updatedAt DESC
                LIMIT %s
                """,
                (q, q, q, q, limit),
            )
            return cur.fetchall()
    finally:
        conn.close()


def fetch_by_type(opp_type: str, limit: int = 10) -> list[dict]:
    """Fetch opportunities by type."""
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, source, type, title, description,
                       company, location, stipend, deadline, registrationLink
                FROM scraped_opportunities
                WHERE isActive = 1 AND type = %s
                ORDER BY updatedAt DESC
                LIMIT %s
                """,
                (opp_type.upper(), limit),
            )
            return cur.fetchall()
    finally:
        conn.close()


def fetch_grants(limit: int = 10) -> list[dict]:
    """Fetch grant opportunities (for faculty queries)."""
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, source, type, title, description,
                       company, location, stipend, deadline, registrationLink
                FROM scraped_opportunities
                WHERE isActive = 1 AND (type = 'GRANT' OR source = 'GRANT_DB')
                ORDER BY deadline ASC
                LIMIT %s
                """,
                (limit,),
            )
            return cur.fetchall()
    finally:
        conn.close()
def get_student_profile_by_email(email: str) -> dict:
    """Fetch a student's profile data by their email."""
    if not email: return None
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT sp.* 
                FROM student_profiles sp
                JOIN users u ON sp.userId = u.id
                WHERE u.email = %s
                """,
                (email,),
            )
            return cur.fetchone()
    finally:
        conn.close()
