"""
security.py — Secondary security layer for the chatbot.
Defense-in-depth: the Next.js API already filters, but we re-check here.
"""

import re

MAX_CHARS = 800

# Same patterns as the Next.js layer — duplicated intentionally for defense-in-depth
THREAT_PATTERNS: list[tuple[str, re.Pattern]] = [
    ("INJECTION", re.compile(
        r"ignore\s+(previous|prior|above|all)\s+(instructions?|prompts?|context)|"
        r"forget\s+(everything|all|previous|prior)|"
        r"disregard\s+(all|previous|prior|your)|"
        r"you\s+are\s+now\s+(a|an|the)\s+|"
        r"act\s+as\s+(a|an|the)?\s*(different|new|uncensored|evil)|"
        r"pretend\s+(to\s+be|you\s+are)|"
        r"roleplay\s+as|"
        r"new\s+persona|"
        r"override\s+(system|safety|content)\s+(prompt|filter|policy)|"
        r"\[system\]|\{\{system\}\}|<<<system>>>",
        re.IGNORECASE
    )),
    ("JAILBREAK", re.compile(
        r"\bDAN\b|jailbreak|developer\s+mode|evil\s+mode|"
        r"unfiltered\s+mode|no\s+restrictions|"
        r"bypass\s+(safety|filter|content)|grandma\s+trick|token\s+smuggling",
        re.IGNORECASE
    )),
    ("SQL", re.compile(
        r"UNION\s+SELECT|DROP\s+TABLE|INSERT\s+INTO|DELETE\s+FROM|"
        r"UPDATE\s+\w+\s+SET|EXEC\s*\(|xp_cmdshell|"
        r"'\s*(OR|AND)\s+['\"]\d+['\"]?\s*=|"
        r";\s*(DROP|DELETE|INSERT|UPDATE|EXEC)",
        re.IGNORECASE
    )),
    ("XSS", re.compile(
        r"<script[\s>]|javascript\s*:|on\w+\s*=|<iframe|<object|<embed|"
        r"data:\s*text/html|vbscript:",
        re.IGNORECASE
    )),
    ("EXFIL", re.compile(
        r"(show|list|dump|give\s+me|print)\s+(all\s+)?(user|password|email|"
        r"hash|token|secret|database|table)|SELECT\s+\*|show\s+tables|"
        r"information_schema|(api|jwt|auth|bearer)\s+key|"
        r"env(ironment)?\s+variable",
        re.IGNORECASE
    )),
]


def is_safe(message: str) -> tuple[bool, str]:
    """
    Returns (True, "") if message is safe.
    Returns (False, reason) if a threat is detected.
    """
    if not message or not message.strip():
        return False, "Empty message."

    if len(message) > MAX_CHARS:
        return False, f"Message too long ({len(message)} > {MAX_CHARS} chars)."

    for threat_type, pattern in THREAT_PATTERNS:
        if pattern.search(message):
            return False, f"Disallowed content detected ({threat_type})."

    return True, ""


def sanitize(message: str) -> str:
    """Strip HTML and normalize whitespace."""
    clean = re.sub(r"<[^>]+>", "", message)
    clean = re.sub(r"[^\x20-\x7E\u00A0-\uFFFF]", "", clean)
    clean = re.sub(r"\s+", " ", clean).strip()
    return clean[:MAX_CHARS]
