"""
unstop.py — Scraper for Unstop (hackathons, competitions, internships).
Uses the public Unstop web interface via HTTP + BeautifulSoup.
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
    "Accept-Language": "en-US,en;q=0.5",
}

UNSTOP_URLS = [
    ("https://unstop.com/hackathons", "HACKATHON"),
    ("https://unstop.com/competitions", "COMPETITION"),
    ("https://unstop.com/internships", "INTERNSHIP"),
]


def _make_id(url: str, title: str) -> str:
    return hashlib.md5(f"UNSTOP::{url}::{title}".encode()).hexdigest()


def _parse_deadline(text: str) -> str | None:
    """Try to extract a ISO date string from strings like 'May 30, 2025'."""
    try:
        for fmt in ("%b %d, %Y", "%B %d, %Y", "%d %b %Y", "%d/%m/%Y"):
            try:
                return datetime.strptime(text.strip(), fmt).strftime("%Y-%m-%d")
            except ValueError:
                continue
    except Exception:
        pass
    return None


def _scrape_api(url: str, opp_type: str) -> list[dict]:
    results = []
    # API endpoints often follow a different pattern. For Unstop, we can use their browse API.
    # Note: This is a simplified version of what their frontend calls.
    api_url = f"https://unstop.com/api/public/opportunity/browse?type={opp_type.lower()}&per_page=30"
    
    try:
        with httpx.Client(headers=HEADERS, timeout=20) as client:
            resp = client.get(api_url)
            if resp.status_code != 200:
                return []
            data = resp.json()
            
            # The data structure usually has a 'data' or 'opportunities' key
            opportunities = data.get('data', {}).get('data', [])
            
            for opp in opportunities:
                try:
                    title = opp.get('title')
                    if not title: continue
                    
                    slug = opp.get('public_url') or opp.get('slug')
                    link = f"https://unstop.com/o/{slug}" if slug else None
                    
                    company = opp.get('organisation', {}).get('name')
                    description = opp.get('short_description') or opp.get('seo_description') or ""
                    
                    # Extract deadline
                    reg_end = opp.get('regn_end_date')
                    deadline = None
                    if reg_end:
                        deadline = reg_end.split(' ')[0] # ISO date part
                    
                    results.append({
                        "externalId": _make_id(link or title, title),
                        "source": "UNSTOP",
                        "type": opp_type,
                        "title": title[:255],
                        "description": description[:2000] or f"{opp_type.title()} on Unstop.",
                        "tags": ",".join([t.get('name') for t in opp.get('filters', []) if t.get('name')]) or None,
                        "company": (company or "")[:255] or None,
                        "location": opp.get('location', 'Online'),
                        "stipend": opp.get('stipend_text'),
                        "deadline": deadline,
                        "registrationLink": link,
                    })
                except Exception:
                    continue
    except Exception as e:
        print(f"[Unstop] API error: {e}")
    
    return results

def scrape() -> list[dict]:
    """Scrape hackathons, competitions, and internships from Unstop."""
    all_results = []
    # Map our internal types to Unstop's API types
    types_map = [
        ("hackathons", "HACKATHON"),
        ("competitions", "COMPETITION"),
        ("internships", "INTERNSHIP"),
    ]
    
    for api_type, opp_type in types_map:
        results = _scrape_api(api_type, opp_type)
        all_results.extend(results)
        print(f"[Unstop] {api_type}: {len(results)} items")

    # Deduplicate
    seen = set()
    unique = []
    for r in all_results:
        if r["externalId"] not in seen:
            seen.add(r["externalId"])
            unique.append(r)

    print(f"[Unstop] Total unique: {len(unique)}")
    return unique
