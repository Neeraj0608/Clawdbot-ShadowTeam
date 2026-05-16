import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { successRes, errorRes, authenticate, authorize } from '@/lib/api-helpers';

// DELETE /api/announcements/[id]
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = authenticate(req);
    if (!user) return errorRes('Unauthorized', [], 401);
    if (!authorize(user, 'ADMIN', 'FACULTY')) return errorRes('Forbidden', [], 403);

    const { id } = await params;
    await prisma.announcement.delete({ where: { id: parseInt(id) } });
    return successRes(null, 'Announcement deleted.');
  } catch (err) {
    console.error('Announcement delete error:', err);
    return errorRes('Internal server error', [], 500);
  }
}
