"""
rag_engine.py — Hybrid RAG retrieval engine.
Combines MySQL keyword search + ChromaDB semantic vector search.
Uses sentence-transformers (all-MiniLM-L6-v2) — free, runs locally.
"""

import os
import time
import chromadb
from chromadb.config import Settings
from sentence_transformers import SentenceTransformer
from db import fetch_all_opportunities, keyword_search, fetch_grants

# Default to high-precision embedding if on high-end server
EMBED_MODEL = os.getenv("EMBED_MODEL", "all-MiniLM-L6-v2")
CHROMA_PATH = os.path.join(os.path.dirname(__file__), ".chroma_db")
COLLECTION_NAME = "coe_opportunities"
REINDEX_INTERVAL_SECONDS = 4 * 60 * 60   # Re-index every 4 hours

# ── Globals (lazy-loaded) ─────────────────────────────────────────────────────

_embedder: SentenceTransformer | None = None
_chroma_client = None
_collection = None
_last_indexed: float = 0.0


def _get_embedder() -> SentenceTransformer:
    global _embedder
    if _embedder is None:
        print("[RAG] Loading sentence-transformer model...")
        _embedder = SentenceTransformer(EMBED_MODEL)
        print("[RAG] Model loaded.")
    return _embedder


def _get_collection():
    global _chroma_client, _collection
    if _chroma_client is None:
        _chroma_client = chromadb.PersistentClient(
            path=CHROMA_PATH,
            settings=Settings(anonymized_telemetry=False),
        )
        _collection = _chroma_client.get_or_create_collection(
            name=COLLECTION_NAME,
            metadata={"hnsw:space": "cosine"},
        )
    return _collection


def _build_document(opp: dict) -> str:
    """Concatenate fields into a searchable document string."""
    parts = [
        opp.get("title", ""),
        opp.get("type", ""),
        opp.get("source", ""),
        opp.get("company", "") or "",
        opp.get("location", "") or "",
        opp.get("tags", "") or "",
        (opp.get("description", "") or "")[:500],
    ]
    return " | ".join(p for p in parts if p).strip()


def _format_result(opp: dict) -> dict:
    """Format a DB row into a clean result dict for the LLM context."""
    deadline = opp.get("deadline")
    if hasattr(deadline, "strftime"):
        deadline = deadline.strftime("%d %b %Y")
    return {
        "title": opp.get("title", ""),
        "type": opp.get("type", ""),
        "source": opp.get("source", ""),
        "company": opp.get("company") or "N/A",
        "location": opp.get("location") or "N/A",
        "stipend": opp.get("stipend") or "N/A",
        "deadline": deadline or "Not specified",
        "link": opp.get("registrationLink") or "N/A",
        "description": (opp.get("description") or "")[:300],
    }


def index_opportunities():
    """Load opportunities from DB and index them into ChromaDB."""
    global _last_indexed
    print("[RAG] Indexing opportunities into ChromaDB...")
    start = time.time()

    opportunities = fetch_all_opportunities(limit=500)
    if not opportunities:
        print("[RAG] No opportunities to index.")
        return

    embedder = _get_embedder()
    collection = _get_collection()

    docs = [_build_document(o) for o in opportunities]
    ids = [str(o["id"]) for o in opportunities]
    metadatas = [
        {
            "type": o.get("type", ""),
            "source": o.get("source", ""),
            "company": o.get("company") or "",
            "link": o.get("registrationLink") or "",
        }
        for o in opportunities
    ]

    # Embed in batches of 64
    batch_size = 64
    all_embeddings = []
    for i in range(0, len(docs), batch_size):
        batch = docs[i : i + batch_size]
        embs = embedder.encode(batch, show_progress_bar=False).tolist()
        all_embeddings.extend(embs)

    # Upsert into ChromaDB
    collection.upsert(
        ids=ids,
        documents=docs,
        embeddings=all_embeddings,
        metadatas=metadatas,
    )

    _last_indexed = time.time()
    print(f"[RAG] Indexed {len(opportunities)} opportunities in {round(time.time()-start,2)}s")


def _maybe_reindex():
    """Re-index if the interval has elapsed."""
    if time.time() - _last_indexed > REINDEX_INTERVAL_SECONDS:
        index_opportunities()


def semantic_search(query: str, n_results: int = 5) -> list[dict]:
    """Search ChromaDB using semantic vector similarity."""
    _maybe_reindex()
    collection = _get_collection()
    embedder = _get_embedder()

    if collection.count() == 0:
        return []

    query_emb = embedder.encode([query], show_progress_bar=False).tolist()
    results = collection.query(
        query_embeddings=query_emb,
        n_results=min(n_results, collection.count()),
        include=["documents", "metadatas", "distances"],
    )

    hits = []
    for i, doc in enumerate(results["documents"][0]):
        meta = results["metadatas"][0][i]
        distance = results["distances"][0][i]
        if distance < 1.2:   # cosine distance threshold
            hits.append({
                "title": doc.split(" | ")[0] if " | " in doc else doc[:80],
                "type": meta.get("type", ""),
                "source": meta.get("source", ""),
                "company": meta.get("company", ""),
                "link": meta.get("link", ""),
                "description": doc[:300],
                "score": round(1 - distance, 3),
            })
    return hits


def hybrid_search(query: str, role: str = "student") -> tuple[list[dict], list[str]]:
    """
    Optimized Hybrid: strictly Top 3 high-precision results.
    Includes a query refinement layer for better intent matching.
    """
    # ── Query Refinement (Intent Boosting) ──
    # Focus on keywords like 'hostel', 'fees', 'exam' if found
    important_keywords = ["hostel", "fee", "exam", "admission", "form", "deadline"]
    refined_query = query.lower()
    for kw in important_keywords:
        if kw in refined_query:
            refined_query = f"{kw} {refined_query}" # Boost keyword priority

    # For faculty: bias toward grants
    if role == "faculty":
        keyword_hits = fetch_grants(limit=5)
        keyword_formatted = [_format_result(h) for h in keyword_hits]
    else:
        keyword_hits_raw = keyword_search(refined_query, limit=5)
        keyword_formatted = [_format_result(h) for h in keyword_hits_raw]

    # Semantic search (limited results for precision)
    semantic_hits = semantic_search(refined_query, n_results=4)

    # Merge & Deduplicate (Strict Top 3 Limit)
    seen_titles: set[str] = set()
    merged: list[dict] = []

    # Priority 1: Semantic Hits (Contextual Relevance)
    for hit in semantic_hits:
        key = hit["title"].lower()[:60]
        if key not in seen_titles and len(merged) < 3:
            seen_titles.add(key)
            merged.append(hit)

    # Priority 2: Keyword Hits (Exact Matching)
    for hit in keyword_formatted:
        key = hit["title"].lower()[:60]
        if key not in seen_titles and len(merged) < 3:
            seen_titles.add(key)
            merged.append(hit)

    # Collect source labels
    sources = list({h.get("source", "") for h in merged if h.get("source")})

    return merged[:3], sources
