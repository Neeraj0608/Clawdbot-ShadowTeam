"""
main.py — FastAPI chatbot service.
Port: 8001
Handles: /chat, /health
"""

import os
import time
import uuid
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, UploadFile, File, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, field_validator
from dotenv import load_dotenv
import io
import re
import json

from security import is_safe, sanitize
from rag_engine import hybrid_search, index_opportunities
from ollama_client import generate

# Load .env from project root
_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
load_dotenv(os.path.join(_ROOT, ".env"))

# ── WebSocket Manager ─────────────────────────────────────────────────────────
class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[str, WebSocket] = {}

    async def connect(self, ws: WebSocket, client_id: str):
        await ws.accept()
        self.active_connections[client_id] = ws

    def disconnect(self, client_id: str):
        if client_id in self.active_connections:
            del self.active_connections[client_id]

    async def send_personal_message(self, message: str, client_id: str):
        ws = self.active_connections.get(client_id)
        if ws:
            await ws.send_text(message)

manager = ConnectionManager()

# ── Memory Store ──────────────────────────────────────────────────────────────
memory_store: dict[str, list[dict]] = {}

def get_history(session_id: str) -> str:
    history = memory_store.get(session_id, [])
    return "\n".join([f"{m['role'].upper()}: {m['content']}" for m in history[-5:]])

def add_to_history(session_id: str, role: str, content: str):
    if session_id not in memory_store:
        memory_store[session_id] = []
    memory_store[session_id].append({"role": role, "content": content})
    if len(memory_store[session_id]) > 10:
        memory_store[session_id].pop(0)

ALLOWED_ORIGINS = os.getenv("CHATBOT_ALLOWED_ORIGIN", "http://localhost:3000")


# ── Startup: index opportunities into ChromaDB ───────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("[Chatbot] Starting up — indexing opportunities...")
    try:
        index_opportunities()
    except Exception as e:
        print(f"[Chatbot] Initial indexing failed (non-fatal): {e}")
    yield
    print("[Chatbot] Shutting down.")


# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="CoE AI Chatbot",
    version="1.0.0",
    description="RAG-based chatbot for TCET CoE opportunities",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[ALLOWED_ORIGINS, "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["POST", "GET"],
    allow_headers=["Content-Type", "Authorization"],
)


# ── Request / Response Models ─────────────────────────────────────────────────

class ChatRequest(BaseModel):
    message: str
    role: str = "student"
    session_id: str = ""
    user_name: str = ""

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: str) -> str:
        allowed = {"student", "faculty", "industry", "admin"}
        return v.lower() if v.lower() in allowed else "student"

    @field_validator("message")
    @classmethod
    def validate_message(cls, v: str) -> str:
        if len(v) > 800:
            raise ValueError("Message exceeds 800 character limit.")
        return v

    @field_validator("session_id")
    @classmethod
    def sanitize_session_id(cls, v: str) -> str:
        # Accept only alphanumeric + dash/underscore
        import re
        clean = re.sub(r"[^a-zA-Z0-9\-_]", "", v)[:64]
        return clean or str(uuid.uuid4())[:16]


class ChatAction(BaseModel):
    type: str
    payload: dict

class ChatResponse(BaseModel):
    answer: str
    sources: list[str]
    session_id: str
    elapsed_ms: int
    action: ChatAction | None = None


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "coe-chatbot",
        "model": os.getenv("OLLAMA_MODEL", "llama3.2:3b"),
    }
# ── Rule-Based Booking State Machine ──────────────────────────────────────────
booking_states: dict[str, dict] = {}

def handle_booking_flow(session_id: str, message: str) -> dict:
    msg_lower = message.lower()
    
    # Handle cancellation
    if msg_lower in ["cancel", "stop", "nevermind", "quit", "exit"]:
        if session_id in booking_states:
            del booking_states[session_id]
        return {
            "answer": "Booking cancelled. How else can I help you?",
            "action": None
        }

    if session_id not in booking_states:
        booking_states[session_id] = {"facility": None, "date": None, "time_slot": None, "purpose": None}
    
    state = booking_states[session_id]
    
    # Auto-extract purpose from "for <x>" pattern
    if state["purpose"] is None:
        import re as re_module
        purpose_match = re_module.search(r'\bfor\s+(.+)', message, re_module.IGNORECASE)
        if purpose_match:
            purpose_text = purpose_match.group(1).strip()
            # Only use it if it's meaningful (not "me" etc.)
            if len(purpose_text) > 3 and not purpose_text.lower().startswith("me"):
                state["purpose"] = purpose_text
    
    # Simple extraction heuristics
    if state["facility"] is None:
        if "ai lab" in msg_lower: state["facility"] = "AI Lab"
        elif "mac lab" in msg_lower: state["facility"] = "Mac Lab"
        elif "iot lab" in msg_lower: state["facility"] = "IoT Lab"
        elif "research" in msg_lower: state["facility"] = "Research Room"
        
    if state["date"] is None:
        import re
        date_match = re.search(r'\d{4}-\d{2}-\d{2}', msg_lower)
        if date_match: state["date"] = date_match.group(0)
        elif "tomorrow" in msg_lower: 
            from datetime import datetime, timedelta
            state["date"] = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        elif "today" in msg_lower:
            from datetime import datetime
            state["date"] = datetime.now().strftime("%Y-%m-%d")
            
    if state["time_slot"] is None:
        if "09:00" in msg_lower or ("9" in msg_lower and "11" in msg_lower) or "morning" in msg_lower:
            state["time_slot"] = "09:00 - 11:00"
        elif "11:00 - 13:00" in msg_lower or ("11" in msg_lower and "13" in msg_lower):
            state["time_slot"] = "11:00 - 13:00"
        elif "13:00 - 15:00" in msg_lower or ("13" in msg_lower and "15" in msg_lower) or "afternoon" in msg_lower:
            state["time_slot"] = "13:00 - 15:00"
        elif "15:00 - 17:00" in msg_lower or ("15" in msg_lower and "17" in msg_lower):
            state["time_slot"] = "15:00 - 17:00"
        elif "17:00 - 19:00" in msg_lower or ("17" in msg_lower and "19" in msg_lower) or "evening" in msg_lower:
            state["time_slot"] = "17:00 - 19:00"
        
    if state["purpose"] is None and state["time_slot"] is not None and state["date"] is not None and state["facility"] is not None:
        # If everything else is filled, assume the message is the purpose
        if len(message) > 2:
            state["purpose"] = message
            
    # Determine next step
    if state["facility"] is None:
        return {"answer": "Which facility would you like to book?", "action": {"type": "SHOW_OPTIONS", "payload": {"options": ["AI Lab", "Mac Lab", "IoT Lab", "Research Room"]}}}
    
    if state["date"] is None:
        return {"answer": "What date would you like to book? (e.g., Tomorrow, 2026-06-01)", "action": None}
        
    if state["time_slot"] is None:
        return {"answer": "What time slot works best for you?", "action": {"type": "SHOW_OPTIONS", "payload": {"options": ["09:00 - 11:00", "11:00 - 13:00", "13:00 - 15:00", "15:00 - 17:00", "17:00 - 19:00"]}}}
        
    if state["purpose"] is None:
        return {"answer": "Briefly, what is the purpose of this booking? (e.g., Training, Project Work)", "action": None}
        
    # All filled
    final_payload = dict(state)
    del booking_states[session_id] # Clear state
    return {
        "answer": f"Got it! I am sending a request to book the {final_payload['facility']} on {final_payload['date']} at {final_payload['time_slot']} for {final_payload['purpose']}. This is pending approval.",
        "action": {"type": "BOOK_FACILITY", "payload": final_payload}
    }

@app.post("/chat", response_model=ChatResponse)
async def chat(request: Request, body: ChatRequest):
    start = time.time()

    # ── Secondary security check (defense-in-depth) ───────────────────────
    safe, reason = is_safe(body.message)
    if not safe:
        return ChatResponse(
            answer=f"I cannot process that request: {reason}",
            sources=[],
            session_id=body.session_id,
            elapsed_ms=0,
        )

    # ── Sanitize ──────────────────────────────────────────────────────────
    clean_message = sanitize(body.message)

    # ── Semantic Intent Routing ───────────────────────────────────────────
    clean_message_lower = clean_message.lower()
    intent = "RAG_QUERY"
    
    # 1. Booking Intent
    if re.search(r'\b(book|reserve|schedule).*(lab|room|facility)\b', clean_message_lower) or \
       re.search(r'\b(ai lab|mac lab|09:00|11:00|13:00|15:00|17:00)\b', clean_message_lower) or \
       re.search(r'\b(purpose|train|project|research)\b', clean_message_lower) and len(clean_message_lower.split()) < 8:
        intent = "BOOKING"
        
    # 2. ChitChat Intent
    elif clean_message_lower in ["hi", "hello", "hey", "thanks", "ok", "yes", "no"] or len(clean_message_lower) < 3:
        intent = "CHITCHAT"
        
    # 3. Profile Intent
    elif "profile" in clean_message_lower and ("setup" in clean_message_lower or "want" in clean_message_lower):
        intent = "PROFILE_SETUP"

    # ── Memory & Context ──────────────────────────────────────────────────
    history_list = memory_store.get(body.session_id, [])

    # ── Conversational Query Reformulation (0-Latency Concatenation) ──────
    search_query = clean_message
    if intent == "RAG_QUERY" and history_list:
        last_user_msg = next((m["content"] for m in reversed(history_list) if m["role"] == "user"), "")
        if last_user_msg:
            # Context concatenation: Combine last query with current for better semantic matching
            search_query = f"{last_user_msg} {clean_message}"

    # ── RAG: Retrieve relevant opportunities ─────────────────────────────
    try:
        if intent in ["BOOKING", "CHITCHAT", "PROFILE_SETUP"]:
            context_results, sources = [], []
        else:
            context_results, sources = hybrid_search(search_query, role=body.role)
    except Exception as e:
        print(f"[Chat] RAG error: {e}")
        context_results, sources = [], []
    
    # ── Fetch User Profile Context ────────────────────────────────────────
    user_profile_context = ""
    try:
        from db import get_student_profile_by_email
        profile = get_student_profile_by_email(body.user_name) 
        if profile:
            user_profile_context = f"Student Profile: {profile.get('internships')}, {profile.get('projects')}, {profile.get('summary')}"
    except:
        pass

    # ── State Machine Intercept ───────────────────────────────────────────
    if intent == "BOOKING" or body.session_id in booking_states:
        result = handle_booking_flow(body.session_id, clean_message)
        answer = result["answer"]
        
        action_obj = None
        if result["action"]:
            action_obj = ChatAction(**result["action"])
            
        elapsed_ms = int((time.time() - start) * 1000)
        print(f"[Chat] role={body.role} | {elapsed_ms}ms | STATE_MACHINE | q={clean_message[:60]}")
        
        return ChatResponse(
            answer=answer,
            sources=[],
            session_id=body.session_id,
            elapsed_ms=elapsed_ms,
            action=action_obj
        )

    # ── LLM: Generate answer ──────────────────────────────────────────────
    answer = generate(
        user_message=clean_message, # Pass ONLY the clean user message
        role=body.role,
        context_results=context_results,
        history=history_list, # Pass history as a separate list
        profile_context=user_profile_context # Pass profile separately
    )

    # Update Memory
    add_to_history(body.session_id, "user", clean_message)
    add_to_history(body.session_id, "assistant", answer)

    elapsed_ms = int((time.time() - start) * 1000)
    print(
        f"[Chat] role={body.role} | {elapsed_ms}ms | "
        f"ctx={len(context_results)} | q={clean_message[:60]}"
    )

    # ── Action Extraction ────────────────────────────────────────────────
    final_answer = answer
    action = None
    if "[ACTION:" in answer:
        try:
            # Split by the last [ACTION: to handle the most relevant one
            parts = answer.rsplit("[ACTION:", 1)
            if len(parts) > 1:
                # The content is between [ACTION: and the last ]
                content = parts[1].strip()
                if content.endswith("]"):
                    action_json = content[:-1].strip()
                    action_data = json.loads(action_json)
                    action = ChatAction(**action_data)
                    
                    # Clean up the final answer
                    final_answer = parts[0].strip()
                    if not final_answer and action.type == "SHOW_OPTIONS":
                        options = action.payload.get("options", [])
                        if "AI Lab" in options or "Mac Lab" in options:
                            final_answer = "Which facility would you like to book?"
                        elif "09:00 - 11:00" in options:
                            final_answer = "What time slot works best for you?"
                        else:
                            final_answer = "Please select an option:"
        except Exception as e:
            print(f"[Chat] Action extraction failed: {e}")
            # Fallback: just strip the tag if possible
            final_answer = answer.split("[ACTION:")[0].strip()

    return ChatResponse(
        answer=final_answer,
        sources=sources,
        session_id=body.session_id,
        elapsed_ms=elapsed_ms,
        action=action
    )


@app.post("/extract-resume")
async def extract_resume(file: UploadFile = File(...)):
    """Extract skills and info from PDF using a Hybrid approach."""
    try:
        try:
            from pypdf import PdfReader
        except ImportError:
            return {"success": False, "message": "Library 'pypdf' is missing. Please run 'pip install pypdf' on the server."}

        content = await file.read()
        pdf = PdfReader(io.BytesIO(content))
        text = ""
        for page in pdf.pages:
            text += page.extract_text() + "\n"

        if not text.strip():
            return {"success": False, "message": "Could not extract text from PDF."}

        # 1. Rule-Based Extraction (Fast & Reliable)
        emails = re.findall(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', text)
        phones = re.findall(r'[\+\d]?[\d\-\s\(\)]{10,15}', text)
        links = re.findall(r'https?://(?:[-\w.]|(?:%[\da-fA-F]{2}))+', text)
        
        # Skill Keyword Matching
        skill_db = [
            "Python", "Java", "C++", "JavaScript", "React", "Node.js", "Express", "MongoDB", 
            "SQL", "Docker", "Kubernetes", "AWS", "Cloud", "HTML", "CSS", "TypeScript", 
            "Next.js", "Tailwind", "Machine Learning", "AI", "Data Science", "Flask", 
            "Django", "Git", "GitHub", "Linux", "Android", "Flutter", "Firebase"
        ]
        found_skills = [s for s in skill_db if s.lower() in text.lower()]

        # 2. AI Layer (For Deep Extraction)
        extraction_prompt = (
            "You are an expert resume parser. Extract the following from the text into a CLEAN JSON object: "
            "'summary' (3-line professional bio), "
            "'internships' (list of objects with: company, project_name, duration, description, skills), "
            "'projects' (list of objects with: name, description, url), "
            "'languages' (list), "
            "'certifications' (list), "
            "'awards' (list), "
            "'clubs' (list), "
            "'exams' (list), "
            "'employment' (list), "
            "'academic_achievements' (list). "
            "Return ONLY the JSON. No markdown wrappers. "
            f"\n\nRESUME TEXT:\n{text[:3000]}"
        )
        ai_raw = generate(user_message=extraction_prompt, role="student", context_results=[])
        
        # Parse AI JSON
        ai_data = {}
        try:
            clean_ai = ai_raw.strip()
            if "```json" in clean_ai: clean_ai = clean_ai.split("```json")[1].split("```")[0].strip()
            import json as json_lib
            ai_data = json_lib.loads(clean_ai)
        except:
            print(f"[Chat] AI Deep Extraction JSON parse failed")

        return {
            "success": True,
            "data": {
                "skills": ", ".join(list(set(found_skills))),
                "email": emails[0] if emails else "",
                "phone": phones[0] if phones else "",
                "links": links[:3],
                **ai_data
            }
        }
    except Exception as e:
        print(f"[Chat] Hybrid Extraction error: {e}")
        return {"success": False, "message": str(e)}


# ── WebSockets for Push Notifications ──────────────────────────────────────────

class NotifyRequest(BaseModel):
    user_id: str
    message: str

@app.post("/notify")
async def notify_user(request: NotifyRequest):
    await manager.send_personal_message(request.message, request.user_id)
    return {"status": "sent", "user": request.user_id}

@app.websocket("/ws/notifications/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    await manager.connect(websocket, client_id)
    try:
        while True:
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(client_id)

# ── CLI ───────────────────────────────────────────────────────────────────────


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("CHATBOT_PORT", "8001"))
    print(f"[Chatbot] Starting on http://0.0.0.0:{port}")
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)
