"""
main.py — Scraper orchestrator.
Runs all scrapers, deduplicates, and writes to MySQL.
Can also be triggered via FastAPI for the /api/scraper/trigger Next.js endpoint.
"""

import sys
import time
from datetime import datetime
from scrapers import tcet, internshala, grants, linkedin, devpost, devfolio, hackerearth, hack2skill
from db import bulk_upsert

# Optional: expose as a tiny HTTP server so Next.js can trigger it
from fastapi import FastAPI
import uvicorn

app = FastAPI(title="CoE Scraper Service", version="1.0.0")


TECHNICAL_KEYWORDS = [
    "aiml", "machine learning", "artificial intelligence", "deep learning", 
    "full stack", "fullstack", "frontend", "backend", "software engineering",
    "cloud", "aws", "azure", "gcp", "devops", "computer science", "python",
    "java", "javascript", "react", "node", "django", "data science", "golang",
    "hackathon", "coding", "web3", "blockchain", "software", "development"
]

def filter_technical_opportunities(records: list[dict]) -> list[dict]:
    """Only keep records matching our technical domains."""
    filtered = []
    for r in records:
        # Trusted technical sources - allow all by default
        if r.get("source") in ["DEVFOLIO", "DEVPOST", "HACKEREARTH"]:
            filtered.append(r)
            continue

        tags = r.get("tags") or ""
        tags_str = ",".join(tags) if isinstance(tags, list) else str(tags)
        content = (r.get("title", "") + " " + r.get("description", "") + " " + tags_str).lower()
        if any(kw in content for kw in TECHNICAL_KEYWORDS):
            filtered.append(r)
    return filtered

def run_all_scrapers() -> dict:
    """Execute all scrapers and return a summary."""
    start = time.time()
    print(f"\n{'='*60}")
    print(f"[Scraper] Starting scrape run at {datetime.now().isoformat()}")
    print(f"{'='*60}\n")

    all_records = []
    scraper_stats = {}

    scrapers = {
        "TCET": tcet.scrape,
        "Internshala": internshala.scrape,
        "LinkedIn": linkedin.scrape,
        "Devpost": devpost.scrape,
        "Devfolio": devfolio.scrape,
        "HackerEarth": hackerearth.scrape,
        "Hack2Skill": hack2skill.scrape,
    }

    for name, fn in scrapers.items():
        try:
            print(f"\n[Scraper] Running {name}...")
            records = fn()
            all_records.extend(records)
            scraper_stats[name] = {"fetched": len(records), "error": None}
        except Exception as e:
            print(f"[Scraper] {name} FAILED: {e}")
            scraper_stats[name] = {"fetched": 0, "error": str(e)}

    print(f"\n[Scraper] Total records fetched: {len(all_records)}")

    # Apply technical filter
    all_records = filter_technical_opportunities(all_records)
    print(f"[Scraper] Records after technical filtering: {len(all_records)}")

    # Write to DB
    inserted, errors = bulk_upsert(all_records)
    elapsed = round(time.time() - start, 2)

    summary = {
        "timestamp": datetime.now().isoformat(),
        "total_fetched": len(all_records),
        "inserted_or_updated": inserted,
        "db_errors": errors,
        "elapsed_seconds": elapsed,
        "scrapers": scraper_stats,
    }

    print(f"\n{'='*60}")
    print(f"[Scraper] Done in {elapsed}s — {inserted} upserted, {errors} errors")
    print(f"{'='*60}\n")

    return summary
def run_scheduler():
    """Run the scraper every day at 06:00 AM IST."""
    print(f"[Scraper] Scheduler active. Waiting for 06:00 AM...")
    while True:
        now = datetime.now()
        # Trigger at 06:00 AM
        if now.hour == 6 and now.minute == 0:
            print(f"[Scraper] 06:00 AM reached. Starting daily update...")
            try:
                run_all_scrapers()
            except Exception as e:
                print(f"[Scraper] Scheduled run failed: {e}")
            print(f"[Scraper] Daily update complete. Waiting for tomorrow...")
            time.sleep(61)  # Ensure we don't trigger again in the same minute
        
        time.sleep(30)  # Check every 30 seconds


# ── FastAPI endpoint (called by Next.js /api/scraper/trigger) ──────────────

@app.get("/health")
def health():
    return {"status": "ok", "service": "coe-scraper"}


@app.post("/scrape")
def trigger_scrape():
    """Trigger a full scrape run. Called by Next.js admin endpoint."""
    summary = run_all_scrapers()
    return {"success": True, "data": summary}


# ── CLI entrypoint ────────────────────────────────────────────────────────

if __name__ == "__main__":
    if "--server" in sys.argv:
        # Run as FastAPI HTTP server (for Next.js integration)
        print("[Scraper] Starting as HTTP server on port 8002...")
        uvicorn.run("main:app", host="0.0.0.0", port=8002, reload=False)
    elif "--schedule" in sys.argv:
        # Run the 6 AM scheduler
        run_scheduler()
    else:
        # Run once as a CLI script
        summary = run_all_scrapers()
        sys.exit(0 if summary["db_errors"] == 0 else 1)
