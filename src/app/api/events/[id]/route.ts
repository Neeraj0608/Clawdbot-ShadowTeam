import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { successRes, errorRes, authenticate, authorize } from '@/lib/api-helpers';
import { eventUpdateSchema } from '@/lib/validators';
import { deleteFile } from '@/lib/minio';

// PATCH /api/events/[id]
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = authenticate(req);
    if (!user) return errorRes('Unauthorized', [], 401);
    if (!authorize(user, 'ADMIN', 'FACULTY')) return errorRes('Forbidden', [], 403);

    const { id } = await params;
    const body = await req.json();
    const parsed = eventUpdateSchema.safeParse(body);
    if (!parsed.success) return errorRes('Validation failed', parsed.error.issues.map((e: any) => e.message), 400);

    const updateData: Record<string, unknown> = { ...parsed.data };
    if (updateData.date) updateData.date = new Date(updateData.date as string);

    const event = await prisma.event.update({ where: { id: parseInt(id) }, data: updateData });
    return successRes(event, 'Event updated.');
  } catch (err) {
    console.error('Event update error:', err);
    return errorRes('Internal server error', [], 500);
  }
}

// DELETE /api/events/[id]
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = authenticate(req);
    if (!user) return errorRes('Unauthorized', [], 401);
    if (!authorize(user, 'ADMIN', 'FACULTY')) return errorRes('Forbidden', [], 403);

    const { id } = await params;
    const event = await prisma.event.findUnique({ where: { id: parseInt(id) } });
    if (!event) return errorRes('Event not found.', [], 404);

    if (event.posterKey) {
      try { await deleteFile(event.posterKey); } catch { /* ignore */ }
    }

    await prisma.event.delete({ where: { id: parseInt(id) } });
    return successRes(null, 'Event deleted.');
  } catch (err) {
    console.error('Event delete error:', err);
    return errorRes('Internal server error', [], 500);
  }
}
