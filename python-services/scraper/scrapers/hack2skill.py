"""
hack2skill.py — Scraper for Hack2Skill Indian competitions.
"""

import hashlib
import httpx
from bs4 import BeautifulSoup

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
}

def _make_id(url: str, title: str) -> str:
    return hashlib.md5(f"HACK2SKILL::{url}::{title}".encode()).hexdigest()

def scrape() -> list[dict]:
    results = []
    # Hack2Skill competitions page
    url = "https://hack2skill.com/competitions"
    
    try:
        with httpx.Client(headers=HEADERS, timeout=30) as client:
            resp = client.get(url)
            if resp.status_code != 200:
                return []
            
            soup = BeautifulSoup(resp.text, "html.parser")
            cards = soup.select("a[href*='/hackathons/']")
            print(f"[Hack2Skill] Found {len(cards)} potential hackathon links.")
            
            for card in cards:
                try:
                    title = card.text.strip().split('\n')[0]
                    link = card["href"]
                    if not link.startswith("http"):
                        link = f"https://hack2skill.com{link}"
                    
                    results.append({
                        "externalId": _make_id(link or title, title),
                        "source": "HACK2SKILL",
                        "type": "HACKATHON",
                        "title": title[:255],
                        "description": "Indian competition on Hack2Skill.",
                        "tags": "Hackathon, India",
                        "company": "Hack2Skill",
                        "location": "India",
                        "stipend": None,
                        "deadline": None,
                        "registrationLink": link,
                    })
                except Exception:
                    continue
                    
    except Exception as e:
        print(f"[Hack2Skill] Error: {e}")
        
    return results
