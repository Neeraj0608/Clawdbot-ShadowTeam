"""
hackerearth.py — Scraper for HackerEarth challenges and hackathons.
"""

import hashlib
import httpx
from bs4 import BeautifulSoup
import json

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
}

def _make_id(url: str, title: str) -> str:
    return hashlib.md5(f"HACKEREARTH::{url}::{title}".encode()).hexdigest()

def scrape() -> list[dict]:
    results = []
    # HackerEarth hackathons page
    url = "https://www.hackerearth.com/challenges/hackathon/"
    
    try:
        with httpx.Client(headers=HEADERS, timeout=30) as client:
            resp = client.get(url)
            if resp.status_code != 200:
                return []
            
            soup = BeautifulSoup(resp.text, "html.parser")
            cards = soup.select(".challenge-card-anchor")
            print(f"[HackerEarth] Found {len(cards)} challenge cards.")
            
            for card in cards:
                try:
                    title_elem = card.select_one(".challenge-name")
                    if not title_elem: continue
                    title = title_elem.text.strip()
                    
                    link = card["href"]
                    if not link.startswith("http"):
                        link = f"https://www.hackerearth.com{link}"
                    
                    # Type/Description
                    challenge_type = card.select_one(".challenge-type").text.strip() if card.select_one(".challenge-type") else "Hackathon"
                    
                    # Date/Deadline
                    date_elem = card.select_one(".date")
                    deadline = None
                    # Parsing HE dates is tricky without regex, we'll keep it simple for now
                    
                    results.append({
                        "externalId": _make_id(link or title, title),
                        "source": "HACKEREARTH",
                        "type": "HACKATHON" if "hackathon" in challenge_type.lower() else "COMPETITION",
                        "title": title[:255],
                        "description": f"{challenge_type} on HackerEarth.",
                        "tags": "Competitive Programming, Hackathon",
                        "company": "HackerEarth",
                        "location": "Online",
                        "stipend": None,
                        "deadline": None,
                        "registrationLink": link,
                    })
                except Exception:
                    continue
                    
    except Exception as e:
        print(f"[HackerEarth] Error: {e}")
        
    return results
