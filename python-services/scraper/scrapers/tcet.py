"""
tcet.py — Scraper for https://tcetcercd.in/
Uses Selenium for JavaScript-rendered content.
"""

import hashlib
import time
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException


def _build_driver():
    opts = Options()
    opts.add_argument("--headless")
    opts.add_argument("--no-sandbox")
    opts.add_argument("--disable-dev-shm-usage")
    opts.add_argument("--disable-gpu")
    opts.add_argument("--window-size=1280,800")
    opts.add_argument(
        "user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    )
    return webdriver.Chrome(options=opts)


def _make_id(title: str, source: str = "TCET") -> str:
    return hashlib.md5(f"{source}::{title}".encode()).hexdigest()


def scrape() -> list[dict]:
    """Scrape opportunities from tcetcercd.in."""
    results = []
    driver = _build_driver()
    try:
        driver.get("https://tcetcercd.in/")
        WebDriverWait(driver, 15).until(
            EC.presence_of_element_located((By.TAG_NAME, "body"))
        )
        time.sleep(3)  # Allow JS to render

        # ── Strategy 1: look for common opportunity card patterns ──
        card_selectors = [
            ".opportunity-card", ".event-card", ".internship-card",
            "[class*='opportunity']", "[class*='internship']",
            "[class*='hackathon']", "article", ".card",
        ]

        cards = []
        for sel in card_selectors:
            try:
                found = driver.find_elements(By.CSS_SELECTOR, sel)
                if found:
                    cards = found[:20]  # cap at 20 per page
                    break
            except Exception:
                continue

        for card in cards:
            try:
                title_el = card.find_element(By.CSS_SELECTOR, "h1,h2,h3,h4,h5,a")
                title = title_el.text.strip()
                if not title or len(title) < 4:
                    continue

                description = ""
                for sel in ["p", ".description", ".content", ".body"]:
                    try:
                        description = card.find_element(By.CSS_SELECTOR, sel).text.strip()
                        if description:
                            break
                    except NoSuchElementException:
                        pass

                link = None
                try:
                    anchor = card.find_element(By.TAG_NAME, "a")
                    link = anchor.get_attribute("href")
                    if link and not link.startswith("http"):
                        link = "https://tcetcercd.in" + link
                except NoSuchElementException:
                    pass

                # Guess type from title/description
                text = (title + " " + description).lower()
                opp_type = "INTERNSHIP"
                if any(w in text for w in ["hackathon", "hack", "competition"]):
                    opp_type = "HACKATHON"
                elif any(w in text for w in ["workshop", "seminar", "training"]):
                    opp_type = "WORKSHOP"
                elif any(w in text for w in ["grant", "fund", "scholarship"]):
                    opp_type = "GRANT"
                elif any(w in text for w in ["placement", "job", "recruit"]):
                    opp_type = "PLACEMENT"

                results.append({
                    "externalId": _make_id(title),
                    "source": "TCET",
                    "type": opp_type,
                    "title": title[:255],
                    "description": description[:2000] or "No description available.",
                    "tags": None,
                    "company": "TCET",
                    "location": "Mumbai",
                    "stipend": None,
                    "deadline": None,
                    "registrationLink": link,
                })
            except Exception as e:
                print(f"[TCET] Card parse error: {e}")
                continue

        # ── Strategy 2: Fallback — scrape news/announcements section ──
        if not results:
            try:
                news_items = driver.find_elements(
                    By.CSS_SELECTOR, "li, .news-item, .announcement"
                )[:15]
                for item in news_items:
                    text = item.text.strip()
                    if len(text) > 20:
                        results.append({
                            "externalId": _make_id(text[:100]),
                            "source": "TCET",
                            "type": "INTERNSHIP",
                            "title": text[:255],
                            "description": text[:2000],
                            "tags": None,
                            "company": "TCET",
                            "location": "Mumbai",
                            "stipend": None,
                            "deadline": None,
                            "registrationLink": "https://tcetcercd.in/",
                        })
            except Exception as e:
                print(f"[TCET] Fallback error: {e}")

    except TimeoutException:
        print("[TCET] Page load timed out.")
    except Exception as e:
        print(f"[TCET] Scrape error: {e}")
    finally:
        driver.quit()

    print(f"[TCET] Found {len(results)} opportunities.")
    return results
