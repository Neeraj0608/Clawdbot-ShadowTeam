"""
grants.py — Scraper for research grant databases.
Scrapes: NSF, data.gov (Indian grants), and MyGov/DST portals.
"""

import hashlib
import httpx
from bs4 import BeautifulSoup
from datetime import datetime


HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}

# (URL, issuing_body, expected_type_hint)
GRANT_SOURCES = [
    (
        "https://www.nsf.gov/funding/opportunities.jsp",
        "NSF",
        "GRANT",
    ),
    (
        "https://dst.gov.in/funding-opportunities",
        "DST India",
        "GRANT",
    ),
    (
        "https://www.aicte-india.org/schemes",
        "AICTE",
        "GRANT",
    ),
]


def _make_id(source: str, title: str) -> str:
    return hashlib.md5(f"GRANT_DB::{source}::{title}".encode()).hexdigest()


def _scrape_grants_page(url: str, issuing_body: str) -> list[dict]:
    results = []
    try:
        with httpx.Client(headers=HEADERS, timeout=25, follow_redirects=True) as client:
            resp = client.get(url)
            resp.raise_for_status()
    except Exception as e:
        print(f"[Grants] HTTP error for {url}: {e}")
        return results

    soup = BeautifulSoup(resp.text, "html.parser")

    # Generic selectors for funding/grant listings
    items = (
        soup.select(".funding-opp") or
        soup.select(".grant-item") or
        soup.select(".scheme-item") or
        soup.select("article") or
        soup.select("li.item") or
        soup.select(".list-item") or
        soup.select("[class*='grant']") or
        soup.select("[class*='scheme']") or
        soup.select("[class*='fund']")
    )

    for item in items[:20]:
        try:
            title_tag = item.select_one("h2, h3, h4, a, .title, [class*='title']")
            if not title_tag:
                continue
            title = title_tag.get_text(strip=True)
            if not title or len(title) < 6:
                continue

            desc_tag = item.select_one("p, .description, .summary, [class*='desc']")
            description = desc_tag.get_text(strip=True) if desc_tag else ""
            if not description:
                description = f"Grant opportunity from {issuing_body}."

            link_tag = item.find("a", href=True)
            link = None
            if link_tag:
                href = link_tag["href"]
                if href.startswith("http"):
                    link = href
                else:
                    from urllib.parse import urljoin
                    link = urljoin(url, href)

            # Look for deadline
            deadline = None
            for date_cls in ["deadline", "date", "closes", "due"]:
                tag = item.select_one(f"[class*='{date_cls}'], time")
                if tag:
                    text = tag.get_text(strip=True)
                    for fmt in ("%B %d, %Y", "%b %d, %Y", "%d/%m/%Y", "%Y-%m-%d"):
                        try:
                            deadline = datetime.strptime(text, fmt).strftime("%Y-%m-%d")
                            break
                        except ValueError:
                            continue
                    if deadline:
                        break

            results.append({
                "externalId": _make_id(issuing_body, title),
                "source": "GRANT_DB",
                "type": "GRANT",
                "title": title[:255],
                "description": description[:2000],
                "tags": issuing_body,
                "company": issuing_body[:255],
                "location": "India",
                "stipend": None,
                "deadline": deadline,
                "registrationLink": link,
            })
        except Exception as e:
            print(f"[Grants] Item parse error: {e}")
            continue

    return results


def scrape() -> list[dict]:
    """Scrape grant opportunities from multiple databases."""
    all_results = []
    for url, issuing_body, _ in GRANT_SOURCES:
        results = _scrape_grants_page(url, issuing_body)
        all_results.extend(results)
        print(f"[Grants] {issuing_body}: {len(results)} items")

    # Deduplicate
    seen = set()
    unique = []
    for r in all_results:
        if r["externalId"] not in seen:
            seen.add(r["externalId"])
            unique.append(r)

    print(f"[Grants] Total unique: {len(unique)}")
    return unique
