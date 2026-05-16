import httpx
from bs4 import BeautifulSoup
from datetime import datetime

def scrape() -> list[dict]:
    """Scrape public LinkedIn job listings (guest access)."""
    results = []
    # Search for Tech/Data Internships in India
    url = "https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=Artificial%20Intelligence%20Machine%20Learning%20Data%20Science%20Computer%20Internship&location=India&start=0"
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }

    try:
        resp = httpx.get(url, headers=headers, timeout=15)
        if resp.status_code != 200:
            return []
        
        soup = BeautifulSoup(resp.text, 'html.parser')
        job_cards = soup.find_all('li')

        for card in job_cards:
            try:
                title_tag = card.find('h3', class_='base-search-card__title')
                company_tag = card.find('h4', class_='base-search-card__subtitle')
                location_tag = card.find('span', class_='job-search-card__location')
                link_tag = card.find('a', class_='base-card__full-link')

                if title_tag and link_tag:
                    title = title_tag.get_text(strip=True)
                    company = company_tag.get_text(strip=True) if company_tag else "Unknown"
                    location = location_tag.get_text(strip=True) if location_tag else "Remote/India"
                    link = link_tag['href'].split('?')[0] # Clean URL
                    
                    # Generate a unique externalId based on LinkedIn's job ID in the URL
                    job_id = link.split('-')[-1] if '-' in link else link
                    
                    results.append({
                        "title": title,
                        "company": company,
                        "location": location,
                        "description": f"Software Internship at {company}",
                        "type": "INTERNSHIP",
                        "source": "LINKEDIN",
                        "externalId": f"linkedin-{job_id}",
                        "registrationLink": link,
                        "scrapedAt": datetime.now(),
                        "deadline": None,
                        "stipend": "See link",
                        "tags": "Software,LinkedIn"
                    })
            except Exception:
                continue
    except Exception as e:
        print(f"[LinkedIn Scraper] Error: {e}")
    
    return results
