# 🎓 TCET Centre of Excellence Portal

> An AI-powered smart campus platform for Thakur College of Engineering and Technology — built with Next.js, Python, RAG, and WebSockets.

[![Next.js](https://img.shields.io/badge/Next.js-16.2-black?logo=next.js)](https://nextjs.org/)
[![Python](https://img.shields.io/badge/Python-3.12-blue?logo=python)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-green?logo=fastapi)](https://fastapi.tiangolo.com/)
[![Prisma](https://img.shields.io/badge/Prisma-5.22-2D3748?logo=prisma)](https://prisma.io/)
[![License](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)

---

## 📸 Overview

The **CoE Portal** is a full-stack, production-grade campus management system serving **Students, Faculty, Industry Partners, and Admins**. It is powered by **Veda** — an on-device AI assistant backed by RAG (Retrieval-Augmented Generation) — and features real-time WebSocket notifications, voice input, and an intelligent facility booking engine.

---

## ✨ Key Features

### 🤖 Veda — AI Assistant
| Feature | Description |
|---|---|
| **RAG-Based Q&A** | Answers questions about jobs, hackathons & internships using ChromaDB + `all-MiniLM-L6-v2` |
| **Semantic Intent Routing** | Skips vector search for simple commands, making responses **3x faster** |
| **Conversational Memory** | Remembers your last 5 messages for context-aware follow-ups |
| **0-Latency Query Reformulation** | Concatenates past queries to handle multi-turn follow-ups without LLM delay |
| **ATS Resume Grader** | Ask *"Am I a fit for X role?"* → get a score, missing skills & feedback |
| **Voice Input (STT)** | Click the mic and speak — message auto-sends when you stop |
| **Text-to-Speech (TTS)** | Veda reads all responses aloud with a premium voice |
| **WebSocket Push Notifications** | Real-time booking approval alerts without page refresh |
| **PDF Resume Extraction** | Upload resume → AI extracts skills, experience, certifications |
| **Daily Query Limits** | Rate-limited to 20 queries/day per user to prevent abuse |

### 📅 Facility Booking (Rule-Based State Machine)
- Conversational, step-by-step guided booking (no form required)
- Natural language parsing — *"Book AI Lab tomorrow for ML project"* fills multiple fields at once
- Clickable time slot and facility bubbles in chat
- Admin approval workflow with email confirmation + QR ticket

### 🚀 Innovation Platform
- **Open Problems Track** — Students apply with profiles; faculty review & select
- **Hackathon Track** — Team registration, 2-stage screening/judging, leaderboard, shortlisting tickets
- **Rubric-Based Scoring** — Innovation, Technical, Impact, UX, Execution, Presentation, Feasibility

### 💼 Industry Internships
- Industry partners post internship problems
- Bulk CSV export of applications
- Internship workspace with task assignments, group chat, meetings & document sharing

### 👤 Student Profile (Naukri-style)
- Skills, education, experience, certifications, projects, awards
- Profile completion tracker
- Resume auto-fill for job/internship applications

### 📰 Content Management
- News, Grants, Events, Announcements with WYSIWYG editing
- Hero slide carousel management (Admin only)
- Google Analytics 4 instrumentation on all key user actions

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                       Browser Client                        │
└────────────────────────┬─────────────────────┬─────────────┘
                         │                     │
               ┌─────────▼──────┐   ┌──────────▼──────────┐
               │   Next.js 16   │   │  WebSocket (ws://)  │
               │   App Router   │   │  Booking Approvals  │
               └─────────┬──────┘   └──────────┬──────────┘
                         │                     │
          ┌──────────────▼──────────────────────▼──────────┐
          │          FastAPI (Python 3.12 | Port 8001)      │
          │   ┌──────────────────────────────────────────┐  │
          │   │  Semantic Router → State Machine / LLM   │  │
          │   │  RAG Engine (ChromaDB + MiniLM)          │  │
          │   │  Ollama (Llama 3.1:8b) — Local & Private │  │
          │   └──────────────────────────────────────────┘  │
          └──────────────────────┬──────────────────────────┘
                                 │
           ┌─────────────────────┼──────────────────────┐
           │                     │                      │
   ┌───────▼──────┐    ┌─────────▼──────┐    ┌─────────▼──────┐
   │  MySQL via   │    │  MinIO Object  │    │  Nodemailer    │
   │  Prisma ORM  │    │  Store (S3)    │    │  (SMTP Email)  │
   └──────────────┘    └────────────────┘    └────────────────┘
```

---

## 🧑‍💻 Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 16, React 19, TypeScript, Tailwind CSS v4 |
| **Backend API** | Next.js Route Handlers |
| **AI Service** | FastAPI, Ollama (Llama 3.1:8b), ChromaDB, Sentence-Transformers |
| **Database** | MySQL + Prisma ORM |
| **Auth** | JWT (access + refresh) in httpOnly cookies |
| **Storage** | MinIO (S3-compatible) |
| **Email** | Nodemailer + DB-backed email job queue |
| **Real-time** | WebSockets (FastAPI native) |
| **Analytics** | Google Analytics 4 |
| **Validation** | Zod (TypeScript) + Pydantic (Python) |

---

## 🗂️ Project Structure

```
CoE-Main/
├── src/
│   ├── app/                  # Next.js App Router pages
│   │   ├── api/              # All REST API route handlers
│   │   ├── (auth)/           # Login, Register pages
│   │   ├── dashboard/        # Role-based dashboards
│   │   ├── facility-booking/ # Booking management UI
│   │   ├── innovation/       # Hackathons & Open Problems
│   │   └── admin/            # Admin panel
│   ├── components/
│   │   └── ChatWidget.tsx    # Veda AI chatbot (voice, STT, TTS, WebSocket)
│   └── lib/                  # Auth helpers, mailer, Prisma, etc.
│
├── python-services/
│   ├── chatbot/
│   │   ├── main.py           # FastAPI app + State Machine + WebSocket server
│   │   ├── ollama_client.py  # LLM prompt + response handling
│   │   ├── rag_engine.py     # ChromaDB indexing + hybrid search
│   │   └── security.py       # Prompt injection detection
│   └── scraper/
│       └── main.py           # LinkedIn / Unstop opportunity scraper
│
├── prisma/
│   └── schema.prisma         # Full database schema
├── .env.docker.example       # Environment variable template
└── docker-compose.yml        # Full stack Docker setup
```

---

## ⚙️ Local Development Setup

### Prerequisites
- Node.js 20+
- Python 3.12+
- MySQL 8+
- [Ollama](https://ollama.com/) with `llama3.1:8b` pulled
- MinIO (or any S3-compatible store)

### 1. Clone & Install

```bash
git clone https://github.com/your-username/coe-platform.git
cd coe-platform
npm install
```

### 2. Configure Environment

```bash
cp .env.docker.example .env
# Fill in your DATABASE_URL, JWT secrets, MinIO, SMTP credentials
```

### 3. Setup Database

```bash
npx prisma migrate deploy
npx prisma generate
```

### 4. Start Frontend

```bash
npm run dev
# Runs on http://localhost:3000
```

### 5. Start AI Service

```bash
cd python-services/chatbot
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8001 --workers 1
# Runs on http://localhost:8001
```

### 6. Pull the LLM (first time only)

```bash
ollama pull llama3.1:8b
```

---

## 🔑 Environment Variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | MySQL connection string |
| `JWT_SECRET` | Access token secret |
| `JWT_REFRESH_SECRET` | Refresh token secret |
| `MINIO_ENDPOINT` | MinIO server URL |
| `MINIO_ACCESS_KEY` | MinIO access key |
| `MINIO_SECRET_KEY` | MinIO secret key |
| `SMTP_HOST` | Email server host |
| `SMTP_USER` | Email username |
| `SMTP_PASS` | Email password |
| `OLLAMA_URL` | Ollama API URL (default: `http://127.0.0.1:11434`) |
| `OLLAMA_MODEL` | Model name (default: `llama3.1:8b`) |
| `CHATBOT_ALLOWED_ORIGIN` | CORS origin for chatbot (default: `http://localhost:3000`) |
| `NEXT_PUBLIC_GA_ID` | Google Analytics 4 Measurement ID |

> ⚠️ Never commit your `.env` file. It is excluded by `.gitignore`.

---

## 🐳 Docker Deployment

```bash
docker-compose up --build
```

The compose file starts the Next.js app, MySQL, and MinIO together.

---

## 🎤 Testing Veda — AI Chatbot

| What to test | What to say |
|---|---|
| Speed (Semantic Routing) | `"Book a lab"` — watch terminal show `STATE_MACHINE` instantly |
| Multi-turn context | Ask `"Find ML hackathons"`, follow up with `"Which are online?"` |
| Natural booking | `"Book AI Lab tomorrow for ML project"` — fills 3 fields at once |
| Resume grader | `"Am I a good fit for the Full Stack Developer role?"` |
| Voice input | Click 🎤 mic icon, speak, message auto-sends |
| Push notifications | Admin approves a booking → Veda pops open and announces it |

---

## 👥 Roles & Access

| Feature | Student | Faculty | Admin |
|---|---|---|---|
| Veda AI chatbot | ✅ | ✅ | ✅ |
| Facility booking | ✅ | ❌ | ✅ |
| Apply to open problems | ✅ | ❌ | ❌ |
| Register for hackathon | ✅ | ❌ | ❌ |
| Create news/events/grants | ❌ | ✅ | ✅ |
| Review applications | ❌ | ✅ | ✅ |
| Approve bookings | ❌ | ❌ | ✅ |
| Manage users | ❌ | ❌ | ✅ |
| View admin stats | ❌ | ❌ | ✅ |

---

## 📊 Analytics

Google Analytics 4 is instrumented on:
- User registration & login
- Facility bookings created
- Innovation applications submitted
- Hackathon team registrations
- Homepage engagement & hero slide views

---

## 🔒 Security

- **JWT** access + refresh tokens stored in `httpOnly` cookies (XSS-safe)
- **OTP verification** for new account registration and password reset
- **RBAC** enforced on every API route handler
- **Prompt injection detection** on all chatbot inputs
- **Input sanitization** before reaching the LLM
- **Rate limiting** — 20 chat queries per user per day

---

## 📄 License

MIT License © 2026 TCET Centre of Excellence

---

<p align="center">Built with ❤️ at TCET for students, by students.</p>
