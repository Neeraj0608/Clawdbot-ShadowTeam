import { NextRequest } from 'next/server';
import { errorRes, successRes, authenticate, authorize } from '@/lib/api-helpers';

/**
 * POST /api/scraper/trigger
 *
 * Admin-only endpoint to manually trigger the Python scraper.
 * The scraper service must be running separately.
 * Can also be hit via cron with the SCRAPER_SECRET header.
 */
export async function POST(req: NextRequest) {
  // Allow either admin JWT or a shared secret header (for server-side cron)
  const cronSecret = req.headers.get('x-scraper-secret');
  const isValidCron =
    cronSecret && cronSecret === process.env.SCRAPER_SECRET;

  if (!isValidCron) {
    const user = authenticate(req);
    if (!user) return errorRes('Unauthorized', [], 401);
    if (!authorize(user, 'ADMIN')) return errorRes('Forbidden — ADMIN only', [], 403);
  }

  const scraperUrl = process.env.SCRAPER_SERVICE_URL ?? 'http://localhost:8002';

  try {
    const res = await fetch(`${scraperUrl}/scrape`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(120_000), // 2-min timeout for scraping
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => 'unknown');
      return errorRes(`Scraper returned ${res.status}: ${errText}`, [], 502);
    }

    const data = await res.json().catch(() => ({}));
    return successRes(data, 'Scrape triggered successfully.');
  } catch (err) {
    console.error('[Scraper Trigger] Error:', err);
    return errorRes(
      'Scraper service is offline. Run: python cron_runner.py in the python-services/scraper directory.',
      [],
      503,
    );
  }
}
