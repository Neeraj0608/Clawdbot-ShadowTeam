import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { successRes, errorRes, authenticate, authorize } from '@/lib/api-helpers';
import { announcementCreateSchema } from '@/lib/validators';

// POST /api/announcements — faculty/admin
export async function POST(req: NextRequest) {
  try {
    const user = authenticate(req);
    if (!user) return errorRes('Unauthorized', [], 401);
    if (!authorize(user, 'ADMIN', 'FACULTY')) return errorRes('Forbidden', [], 403);

    const body = await req.json();
    const parsed = announcementCreateSchema.safeParse(body);
    if (!parsed.success) return errorRes('Validation failed', parsed.error.issues.map((e: any) => e.message), 400);

    const announcement = await prisma.announcement.create({
      data: {
        text: parsed.data.text,
        link: parsed.data.link || null,
        expiresAt: new Date(parsed.data.expiresAt),
        createdById: user.id,
      },
    });

    return successRes(announcement, 'Announcement created.', 201);
  } catch (err) {
    console.error('Announcement create error:', err);
    return errorRes('Internal server error', [], 500);
  }
}

// GET /api/announcements — public, non-expired
export async function GET() {
  try {
    const announcements = await prisma.announcement.findMany({
      where: { expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });

    return successRes(announcements, 'Announcements retrieved.');
  } catch (err) {
    console.error('Announcements list error:', err);
    return errorRes('Internal server error', [], 500);
  }
}
