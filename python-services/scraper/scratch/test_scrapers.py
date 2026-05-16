
import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from scrapers import devpost, devfolio, hackerearth, hack2skill

def test():
    scrapers = {
        "Devpost": devpost.scrape,
        "Devfolio": devfolio.scrape,
        "HackerEarth": hackerearth.scrape,
        "Hack2Skill": hack2skill.scrape
    }
    
    for name, fn in scrapers.items():
        try:
            print(f"\nTesting {name}...")
            results = fn()
            print(f"[{name}] Fetched {len(results)} items.")
            if results:
                print(f"Sample: {results[0]['title']} ({results[0]['registrationLink']})")
        except Exception as e:
            print(f"[{name}] FAILED: {e}")

if __name__ == "__main__":
    test()
