import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { successRes, errorRes, authenticate, authorize } from '@/lib/api-helpers';
import { eventCreateSchema } from '@/lib/validators';
import { uploadFile, getSignedUrl } from '@/lib/minio';

// POST /api/events — faculty/admin
export async function POST(req: NextRequest) {
  try {
    const user = authenticate(req);
    if (!user) return errorRes('Unauthorized', [], 401);
    if (!authorize(user, 'ADMIN', 'FACULTY')) return errorRes('Forbidden', [], 403);

    const formData = await req.formData();
    const title = formData.get('title') as string;
    const description = formData.get('description') as string;
    const date = formData.get('date') as string;
    const mode = formData.get('mode') as string;
    const registrationLink = (formData.get('registrationLink') as string) || '';
    const poster = formData.get('poster') as File | null;

    const parsed = eventCreateSchema.safeParse({ title, description, date, mode, registrationLink });
    if (!parsed.success) return errorRes('Validation failed', parsed.error.issues.map((e: any) => e.message), 400);

    let posterKey: string | null = null;
    if (poster) {
      const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
      if (!allowedMimes.includes(poster.type)) {
        return errorRes('Invalid image format. Only JPEG, PNG, WebP allowed.', [], 400);
      }
      const buffer = Buffer.from(await poster.arrayBuffer());
      posterKey = await uploadFile('events', {
        buffer, originalname: poster.name, mimetype: poster.type, size: buffer.length,
      });
    }

    const event = await prisma.event.create({
      data: {
        title, description, date: new Date(date),
        mode: parsed.data.mode as 'ONLINE' | 'OFFLINE' | 'HYBRID',
        registrationLink: registrationLink || null,
        posterKey, postedById: user.id,
      },
    });

    return successRes(event, 'Event created.', 201);
  } catch (err) {
    console.error('Event create error:', err);
    return errorRes('Internal server error', [], 500);
  }
}

// GET /api/events — public, upcoming events
export async function GET() {
  try {
    const events = await prisma.event.findMany({
      where: { isVisible: true, date: { gte: new Date() } },
      orderBy: { date: 'asc' },
      include: { postedBy: { select: { id: true, name: true } } },
    });

    const withUrls = await Promise.all(
      events.map(async (e) => ({
        ...e,
        posterUrl: e.posterKey ? await getSignedUrl(e.posterKey).catch(() => null) : null,
      }))
    );

    return successRes(withUrls, 'Events retrieved.');
  } catch (err) {
    console.error('Events list error:', err);
    return errorRes('Internal server error', [], 500);
  }
}
