"""
devpost.py — Scraper for Devpost global hackathons.
"""

import hashlib
import httpx
from bs4 import BeautifulSoup
from datetime import datetime

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
}

def _make_id(url: str, title: str) -> str:
    return hashlib.md5(f"DEVPOST::{url}::{title}".encode()).hexdigest()

def scrape() -> list[dict]:
    results = []
    # Devpost hackathons page
    url = "https://devpost.com/hackathons"
    
    try:
        with httpx.Client(headers=HEADERS, timeout=30, follow_redirects=True) as client:
            resp = client.get(url)
            if resp.status_code != 200:
                return []
            
            soup = BeautifulSoup(resp.text, "html.parser")
            cards = soup.select(".hackathon-tile")
            print(f"[Devpost] Found {len(cards)} hackathon tiles.")
            
            for card in cards:
                try:
                    title_elem = card.select_one(".title")
                    if not title_elem: continue
                    title = title_elem.text.strip()
                    
                    link_elem = card.select_one("a[href]")
                    link = link_elem["href"] if link_elem else None
                    if link and not link.startswith("http"):
                        link = f"https://devpost.com{link}"
                    
                    # Description and tags
                    description = card.select_one(".tagline").text.strip() if card.select_one(".tagline") else ""
                    
                    # Deadline - Devpost often has a date string like "Ends in 2 days" or "May 30, 2025"
                    # We'll try to find a more structured date if possible
                    date_elem = card.select_one(".submission-period")
                    deadline_str = date_elem.text.strip() if date_elem else None
                    
                    # Location
                    location_elem = card.select_one(".location")
                    location = location_elem.text.strip() if location_elem else "Online"
                    
                    results.append({
                        "externalId": _make_id(link or title, title),
                        "source": "DEVPOST",
                        "type": "HACKATHON",
                        "title": title[:255],
                        "description": description[:2000] or "Global Hackathon on Devpost.",
                        "tags": "Hackathon, Global",
                        "company": "Devpost",
                        "location": location,
                        "stipend": None,
                        "deadline": None, # Complex to parse without regex/headless, but we'll try to refine
                        "registrationLink": link,
                    })
                except Exception:
                    continue
                    
    except Exception as e:
        print(f"[Devpost] Error: {e}")
        
    return results
