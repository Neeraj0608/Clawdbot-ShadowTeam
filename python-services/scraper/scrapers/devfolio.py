"""
devfolio.py — Scraper for Devfolio Indian/Web3 hackathons.
"""

import hashlib
import httpx
from datetime import datetime

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "application/json",
}

def _make_id(url: str, title: str) -> str:
    return hashlib.md5(f"DEVFOLIO::{url}::{title}".encode()).hexdigest()

def scrape() -> list[dict]:
    results = []
    # Devfolio uses a GraphQL-like internal API or a simple REST one for browsing
    # We'll use their discover API
    url = "https://api.devfolio.co/api/hackathons?page=1&limit=20&order=newest"
    
    try:
        with httpx.Client(headers=HEADERS, timeout=30) as client:
            resp = client.get(url)
            if resp.status_code != 200:
                return []
            
            data = resp.json()
            hackathons = data.get("hackathons", [])
            print(f"[Devfolio] Found {len(hackathons)} hackathons.")
            
            for hack in hackathons:
                try:
                    title = hack.get("name")
                    slug = hack.get("slug")
                    link = f"https://devfolio.co/hackathons/{slug}" if slug else None
                    
                    description = hack.get("tagline") or ""
                    
                    # Devfolio dates are usually ISO strings
                    end_date = hack.get("ends_at")
                    deadline = None
                    if end_date:
                        deadline = end_date.split('T')[0]
                    
                    results.append({
                        "externalId": _make_id(link or title, title),
                        "source": "DEVFOLIO",
                        "type": "HACKATHON",
                        "title": title[:255],
                        "description": description[:2000] or "Indian/Web3 Hackathon on Devfolio.",
                        "tags": ",".join(hack.get("themes", [])) or "Hackathon, Web3",
                        "company": hack.get("organizer", {}).get("name") or "Devfolio",
                        "location": "Online" if hack.get("is_online") else "India",
                        "stipend": None,
                        "deadline": deadline,
                        "registrationLink": link,
                    })
                except Exception:
                    continue
                    
    except Exception as e:
        print(f"[Devfolio] Error: {e}")
        
    return results
