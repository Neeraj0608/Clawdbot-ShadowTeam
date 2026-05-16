/**
 * chat-security.ts
 * Centralized security layer for the AI chatbot.
 * Defends against: prompt injection, jailbreaks, SQL injection,
 * XSS, PII harvesting, and handles per-user rate limiting.
 */

export const CHAT_MAX_CHARS = 800;
export const CHAT_MAX_QUERIES_PER_DAY = 20;

// ---------------------------------------------------------------------------
// Threat patterns — compiled once at module load
// ---------------------------------------------------------------------------

const PROMPT_INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(previous|prior|above|all)\s+(instructions?|prompts?|context)/i,
  /forget\s+(everything|all|previous|prior|above)/i,
  /disregard\s+(all|previous|prior|above|your)/i,
  /you\s+are\s+now\s+(a|an|the)\s+/i,
  /act\s+as\s+(a|an|the)?\s*(different|new|uncensored|evil|hacked)/i,
  /pretend\s+(to\s+be|you\s+are)/i,
  /roleplay\s+as/i,
  /new\s+persona/i,
  /override\s+(system|safety|content)\s+(prompt|filter|policy)/i,
  /\[system\]/i,
  /\{\{system\}\}/i,
  /<<<system>>>/i,
];

const JAILBREAK_PATTERNS: RegExp[] = [
  /\bDAN\b/,           // "Do Anything Now"
  /jailbreak/i,
  /developer\s+mode/i,
  /evil\s+mode/i,
  /unfiltered\s+mode/i,
  /no\s+restrictions/i,
  /bypass\s+(safety|filter|content)/i,
  /grandma\s+trick/i,
  /token\s+smuggling/i,
];

const SQL_INJECTION_PATTERNS: RegExp[] = [
  /'\s*(OR|AND)\s+['"]?\d+['"]?\s*=\s*['"]?\d/i,
  /UNION\s+SELECT/i,
  /DROP\s+TABLE/i,
  /INSERT\s+INTO/i,
  /DELETE\s+FROM/i,
  /UPDATE\s+\w+\s+SET/i,
  /EXEC\s*\(/i,
  /xp_cmdshell/i,
  /--\s*$/, // SQL comment at end
  /;\s*(DROP|DELETE|INSERT|UPDATE|EXEC)/i,
];

const XSS_PATTERNS: RegExp[] = [
  /<script[\s>]/i,
  /javascript\s*:/i,
  /on\w+\s*=/i,         // onerror=, onload=, onclick=, etc.
  /<iframe/i,
  /<object/i,
  /<embed/i,
  /data:\s*text\/html/i,
  /vbscript:/i,
];

const DATA_EXFIL_PATTERNS: RegExp[] = [
  /(show|list|dump|give\s+me|print)\s+(all\s+)?(user|password|email|hash|token|secret|database|table)/i,
  /SELECT\s+\*/i,
  /show\s+tables/i,
  /information_schema/i,
  /(api|jwt|auth|bearer)\s+key/i,
  /env(ironment)?\s+variable/i,
];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export type SecurityCheckResult =
  | { safe: true }
  | { safe: false; reason: string; code: 'TOO_LONG' | 'EMPTY' | 'INJECTION' | 'JAILBREAK' | 'SQL' | 'XSS' | 'EXFIL' };

/**
 * Runs all security checks on the raw user message.
 * Returns {safe: true} or {safe: false, reason, code}.
 */
export function checkMessage(message: unknown): SecurityCheckResult {
  if (typeof message !== 'string' || message.trim().length === 0) {
    return { safe: false, reason: 'Message cannot be empty.', code: 'EMPTY' };
  }

  const trimmed = message.trim();

  if (trimmed.length > CHAT_MAX_CHARS) {
    return {
      safe: false,
      reason: `Message exceeds the ${CHAT_MAX_CHARS}-character limit (${trimmed.length} chars).`,
      code: 'TOO_LONG',
    };
  }

  for (const pattern of PROMPT_INJECTION_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { safe: false, reason: 'Prompt manipulation detected.', code: 'INJECTION' };
    }
  }

  for (const pattern of JAILBREAK_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { safe: false, reason: 'Disallowed query pattern detected.', code: 'JAILBREAK' };
    }
  }

  for (const pattern of SQL_INJECTION_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { safe: false, reason: 'Disallowed query pattern detected.', code: 'SQL' };
    }
  }

  for (const pattern of XSS_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { safe: false, reason: 'Disallowed query pattern detected.', code: 'XSS' };
    }
  }

  for (const pattern of DATA_EXFIL_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { safe: false, reason: 'Disallowed query pattern detected.', code: 'EXFIL' };
    }
  }

  return { safe: true };
}

/**
 * Sanitizes message for safe LLM consumption.
 * Strips HTML tags, trims whitespace, collapses multiple spaces.
 */
export function sanitizeMessage(message: string): string {
  return message
    .replace(/<[^>]*>/g, '')              // strip HTML tags
    .replace(/[^\x20-\x7E\u00A0-\uFFFF]/g, '') // keep printable unicode
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, CHAT_MAX_CHARS);
}

/**
 * Checks if a daily rate-limit window has expired (resets at midnight IST).
 */
export function isWindowExpired(windowStart: Date): boolean {
  const now = new Date();
  // Reset at midnight IST (UTC+5:30)
  const istOffset = 5.5 * 60 * 60 * 1000;
  const nowIST = new Date(now.getTime() + istOffset);
  const windowIST = new Date(windowStart.getTime() + istOffset);

  return (
    nowIST.getUTCFullYear() !== windowIST.getUTCFullYear() ||
    nowIST.getUTCMonth() !== windowIST.getUTCMonth() ||
    nowIST.getUTCDate() !== windowIST.getUTCDate()
  );
}
