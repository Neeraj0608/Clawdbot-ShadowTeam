import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { authenticate } from '@/lib/api-helpers';
import { successRes, errorRes } from '@/lib/api-helpers';
import {
  checkMessage,
  sanitizeMessage,
  isWindowExpired,
  CHAT_MAX_QUERIES_PER_DAY,
} from '@/lib/chat-security';

const CHATBOT_URL = process.env.CHATBOT_SERVICE_URL ?? 'http://localhost:8001';

// Role-to-context map for chatbot system prompt selection
const ROLE_CONTEXT: Record<string, string> = {
  STUDENT: 'student',
  FACULTY: 'faculty',
  INDUSTRY_PARTNER: 'industry',
  ADMIN: 'admin',
};

/**
 * POST /api/chat
 *
 * Security layers (in order):
 *  1. Authentication  — must be logged in (JWT)
 *  2. Content filter  — prompt injection, jailbreak, SQL, XSS, PII detection
 *  3. Length limit    — max 800 characters
 *  4. Rate limit      — 15 queries per calendar day (IST) per user
 *  5. Proxy           — forward to Python FastAPI chatbot service
 */
export async function POST(req: NextRequest) {
  // ─────────────────────────────────────────────
  // 1. Authentication
  // ─────────────────────────────────────────────
  const user = authenticate(req);
  if (!user) {
    return errorRes('You must be logged in to use the AI assistant.', [], 401);
  }

  // ─────────────────────────────────────────────
  // 2. Parse body
  // ─────────────────────────────────────────────
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorRes('Invalid JSON body.', [], 400);
  }

  const rawMessage = (body as Record<string, unknown>)?.message;
  const sessionId = (body as Record<string, unknown>)?.session_id as string | undefined;

  // ─────────────────────────────────────────────
  // 3. Security: content filter + length check
  // ─────────────────────────────────────────────
  const securityCheck = checkMessage(rawMessage);
  if (!securityCheck.safe) {
    return errorRes(securityCheck.reason, [], 400);
  }

  // ─────────────────────────────────────────────
  // 4. Rate limiting — 15 queries/day per user
  // ─────────────────────────────────────────────
  const now = new Date();

  let chatSession = await prisma.chatSession.findUnique({
    where: { userId: user.id },
  });

  if (!chatSession) {
    // First-time user — create session
    chatSession = await prisma.chatSession.create({
      data: { userId: user.id, queryCount: 0, windowStart: now },
    });
  } else if (isWindowExpired(chatSession.windowStart)) {
    // New calendar day — reset window
    chatSession = await prisma.chatSession.update({
      where: { userId: user.id },
      data: { queryCount: 0, windowStart: now },
    });
  }

  if (chatSession.queryCount >= CHAT_MAX_QUERIES_PER_DAY) {
    return errorRes(
      `Daily limit reached. You can ask up to ${CHAT_MAX_QUERIES_PER_DAY} questions per day. Your quota resets at midnight IST.`,
      [],
      429,
    );
  }

  // ─────────────────────────────────────────────
  // 5. Sanitize and forward to Python chatbot
  // ─────────────────────────────────────────────
  const cleanMessage = sanitizeMessage(rawMessage as string);
  const roleContext = ROLE_CONTEXT[user.role] ?? 'student';

  let chatbotResponse: Response;
  try {
    chatbotResponse = await fetch(`${CHATBOT_URL}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: cleanMessage,
        role: roleContext,
        session_id: sessionId ?? `user-${user.id}`,
        user_name: user.name,
      }),
      // 60-second timeout
      signal: AbortSignal.timeout(60_000),
    });
  } catch (err) {
    console.error('[Chat API] Chatbot service unreachable:', err);
    return errorRes(
      'The AI assistant is currently offline. Please try again later.',
      [],
      503,
    );
  }

  if (!chatbotResponse.ok) {
    const errText = await chatbotResponse.text().catch(() => 'unknown error');
    console.error('[Chat API] Chatbot error:', chatbotResponse.status, errText);
    return errorRes('AI assistant returned an error. Please try again.', [], 502);
  }

  const chatbotData = await chatbotResponse.json().catch(() => null);
  if (!chatbotData || typeof chatbotData.answer !== 'string') {
    return errorRes('AI assistant returned an unexpected response.', [], 502);
  }

  // ─────────────────────────────────────────────
  // 6. Increment query count (after successful response)
  // ─────────────────────────────────────────────
  await prisma.chatSession.update({
    where: { userId: user.id },
    data: { queryCount: { increment: 1 } },
  });

  const remaining = CHAT_MAX_QUERIES_PER_DAY - (chatSession.queryCount + 1);

  return successRes(
    {
      answer: chatbotData.answer,
      sources: chatbotData.sources ?? [],
      action: chatbotData.action,
      queries_remaining: remaining < 0 ? 0 : remaining,
    },
    'OK',
  );
}

/**
 * GET /api/chat/status
 * Returns the current user's remaining queries for the day.
 */
export async function GET(req: NextRequest) {
  const user = authenticate(req);
  if (!user) return errorRes('Unauthorized', [], 401);

  const session = await prisma.chatSession.findUnique({ where: { userId: user.id } });

  if (!session || isWindowExpired(session.windowStart)) {
    return successRes({ queries_remaining: CHAT_MAX_QUERIES_PER_DAY, queries_used: 0 });
  }

  const used = session.queryCount;
  const remaining = Math.max(0, CHAT_MAX_QUERIES_PER_DAY - used);

  return successRes({ queries_remaining: remaining, queries_used: used });
}
