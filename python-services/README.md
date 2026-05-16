# CoE AI Services — Setup Guide

## Overview

Two Python microservices run alongside the Next.js app:

| Service | Port | Directory | Purpose |
|---|---|---|---|
| Scraper | 8002 | `python-services/scraper/` | Scrapes TCET, Unstop, Internshala, Grants |
| Chatbot | 8001 | `python-services/chatbot/` | RAG-based AI with Ollama + ChromaDB |

---

## Prerequisites

### 1. Python 3.11+
```bash
python --version   # Should be 3.11 or higher
```

### 2. Ollama (for the chatbot)
Download from: https://ollama.com/download

After installing, pull the model (free, ~2GB):
```bash
ollama pull llama3.2:3b
```

### 3. Google Chrome + ChromeDriver (for TCET Selenium scraper)
- Download Chrome: https://www.google.com/chrome/
- ChromeDriver is auto-managed by Selenium 4 — no manual install needed

---

## Step 1 — Apply Database Migrations

Run this in the **Next.js project root**:
```bash
npm run db:migrate
```

This creates the `scraped_opportunities` and `chat_sessions` tables in MySQL.

---

## Step 2 — Set Up the Scraper

```bash
cd python-services/scraper

# Install dependencies
pip install -r requirements.txt

# Test a single scrape run
python main.py

# Start the scheduled cron runner (6 AM daily + every 4 hours)
python cron_runner.py

# OR: Start as HTTP server (for Next.js /api/scraper/trigger)
python main.py --server
```

**Scraper log** is written to `python-services/scraper/scraper.log`

---

## Step 3 — Set Up the Chatbot

```bash
cd python-services/chatbot

# Install dependencies (first time: ~5 min — downloads sentence-transformer model)
pip install -r requirements.txt

# Start Ollama in a separate terminal
ollama run llama3.2:3b

# Start the chatbot service
# Windows:
startup.bat

# Linux/macOS:
chmod +x startup.sh && ./startup.sh

# OR directly:
python main.py
```

---

## Environment Variables

Add these to the **root `.env`** file (already added for you):

```env
CHATBOT_SERVICE_URL="http://localhost:8001"
SCRAPER_SERVICE_URL="http://localhost:8002"
SCRAPER_SECRET="change-me-scraper-secret-32chars"
```

### Optional chatbot overrides (set in `python-services/chatbot/` shell):
```env
OLLAMA_MODEL=llama3.2:3b         # Change to any installed Ollama model
OLLAMA_URL=http://localhost:11434  # Default Ollama URL
CHATBOT_PORT=8001
CHATBOT_ALLOWED_ORIGIN=http://localhost:3000
```

---

## Security Architecture

### 3-Layer Protection:
1. **Next.js `/api/chat`** — JWT auth + rate limit (15/day) + content filter (7 pattern categories)
2. **Python `chatbot/security.py`** — Mirrors same filters (defense-in-depth)
3. **Ollama system prompt** — Hard-coded safety rules that cannot be overridden by users

### What's blocked:
- ❌ Prompt injection (`ignore previous instructions`)
- ❌ Jailbreaks (DAN, developer mode, etc.)
- ❌ SQL injection (`UNION SELECT`, `DROP TABLE`)
- ❌ XSS (`<script>`, `javascript:`)
- ❌ Data exfiltration (`show all users`, `dump database`)
- ❌ Unauthenticated access
- ❌ >15 queries/day per user
- ❌ >800 characters per message

---

## Data Flow

```
6:00 AM daily (cron_runner.py)
  → tcet.py + unstop.py + internshala.py + grants.py
  → Deduplicate by externalId
  → MySQL: scraped_opportunities (upsert)
  → Next.js /opportunities page auto-refreshes (ISR 4h)

User sends chat message
  → Next.js /api/chat (auth + rate-limit + filter)
  → Python chatbot /chat (security + RAG)
    → ChromaDB semantic search + MySQL keyword search
    → Ollama llama3.2:3b generates answer
  → Response returned to ChatWidget
```

---

## Available Ollama Models (all free)

| Model | Size | Quality | Speed |
|---|---|---|---|
| `llama3.2:3b` | 2GB | Good ⭐⭐⭐ | Fast ⚡⚡⚡ |
| `llama3.2:1b` | 1GB | Decent ⭐⭐ | Very fast ⚡⚡⚡⚡ |
| `llama3.1:8b` | 4.7GB | Better ⭐⭐⭐⭐ | Medium ⚡⚡ |
| `mistral:7b` | 4.1GB | Great ⭐⭐⭐⭐ | Medium ⚡⚡ |
| `phi3:mini` | 2.3GB | Good ⭐⭐⭐ | Fast ⚡⚡⚡ |

Change model: set `OLLAMA_MODEL=mistral:7b` in env and run `ollama pull mistral:7b`.

---

## Troubleshooting

| Issue | Fix |
|---|---|
| `Chatbot offline` in UI | Start Ollama: `ollama run llama3.2:3b` + start chatbot: `python main.py` |
| `Scraper service unreachable` | Run `python main.py --server` in scraper directory |
| ChromeDB connection error | Ensure MySQL is running and DATABASE_URL is correct in `.env` |
| `No opportunities found` | Run scraper first: `python main.py` |
| TCET scraper returns 0 results | TCET site may have changed layout; check console output |
| Slow first response | Ollama cold-start + ChromaDB indexing — subsequent queries are faster |
