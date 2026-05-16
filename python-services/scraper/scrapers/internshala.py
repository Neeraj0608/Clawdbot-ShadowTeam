"""
internshala.py — Scraper for Internshala internship listings.
Uses HTTP + BeautifulSoup on the public search pages.
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
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://internshala.com/",
}

INTERNSHALA_URLS = [
    "https://internshala.com/internships/computer-science/",
    "https://internshala.com/internships/machine-learning/",
    "https://internshala.com/internships/data-science/",
    "https://internshala.com/internships/artificial-intelligence-ai/",
    "https://internshala.com/internships/python-django/",
]


def _make_id(url: str, title: str) -> str:
    return hashlib.md5(f"INTERNSHALA::{url}::{title}".encode()).hexdigest()


def _scrape_page(url: str) -> list[dict]:
    results = []
    try:
        with httpx.Client(headers=HEADERS, timeout=20, follow_redirects=True) as client:
            resp = client.get(url)
            resp.raise_for_status()
    except Exception as e:
        print(f"[Internshala] HTTP error for {url}: {e}")
        return results

    soup = BeautifulSoup(resp.text, "html.parser")

    # Internshala card containers
    cards = (
        soup.select(".internship_meta") or
        soup.select(".individual_internship") or
        soup.select("[class*='internship']") or
        soup.select(".container-fluid .row .col") or
        soup.select("article")
    )

    for card in cards[:20]:
        try:
            # Title
            title_tag = (
                card.select_one(".profile") or
                card.select_one("h3") or
                card.select_one("h4") or
                card.select_one(".title") or
                card.select_one("a")
            )
            if not title_tag:
                continue
            title = title_tag.get_text(strip=True)
            if not title or len(title) < 4:
                continue

            # Company
            company_tag = (
                card.select_one(".company_name") or
                card.select_one(".company-name") or
                card.select_one("[class*='company']")
            )
            company = company_tag.get_text(strip=True) if company_tag else None

            # Location
            loc_tag = (
                card.select_one(".location_link") or
                card.select_one(".location") or
                card.select_one("[class*='location']")
            )
            location = loc_tag.get_text(strip=True) if loc_tag else "India"

            # Stipend
            stipend_tag = (
                card.select_one(".stipend") or
                card.select_one("[class*='stipend']")
            )
            stipend = stipend_tag.get_text(strip=True) if stipend_tag else None

            # Link
            link_tag = card.find("a", href=True)
            link = None
            if link_tag:
                href = link_tag["href"]
                link = href if href.startswith("http") else "https://internshala.com" + href

            # Tags / skills
            tag_els = card.select(".round_tabs span, .tags span, [class*='skill'], [class*='tag']")
            tags = ", ".join(t.get_text(strip=True) for t in tag_els[:6]) or None

            # Duration
            duration_tag = card.select_one(".item_body, [class*='duration']")
            description = duration_tag.get_text(strip=True) if duration_tag else ""
            if not description:
                description = f"Internship at {company or 'a company'} via Internshala."

            results.append({
                "externalId": _make_id(link or url, title),
                "source": "INTERNSHALA",
                "type": "INTERNSHIP",
                "title": title[:255],
                "description": description[:2000],
                "tags": tags,
                "company": (company or "")[:255] or None,
                "location": location[:255],
                "stipend": (stipend or "")[:100] or None,
                "deadline": None,
                "registrationLink": link,
            })
        except Exception as e:
            print(f"[Internshala] Card parse error: {e}")
            continue

    return results


def scrape() -> list[dict]:
    """Scrape internship listings from Internshala."""
    all_results = []
    for url in INTERNSHALA_URLS:
        results = _scrape_page(url)
        all_results.extend(results)
        print(f"[Internshala] {url}: {len(results)} items")

    # Deduplicate
    seen = set()
    unique = []
    for r in all_results:
        if r["externalId"] not in seen:
            seen.add(r["externalId"])
            unique.append(r)

    print(f"[Internshala] Total unique: {len(unique)}")
    return unique
