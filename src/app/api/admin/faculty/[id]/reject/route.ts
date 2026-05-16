import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { successRes, errorRes, authenticate, authorize } from '@/lib/api-helpers';
import { sendFacultyRejectionEmail } from '@/lib/mailer';

// PATCH /api/admin/faculty/[id]/reject
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = authenticate(req);
    if (!user) return errorRes('Unauthorized', [], 401);
    if (!authorize(user, 'ADMIN')) return errorRes('Forbidden', [], 403);

    const { id } = await params;
    const faculty = await prisma.user.findUnique({ where: { id: parseInt(id) } });
    if (!faculty) return errorRes('User not found.', [], 404);
    if (faculty.role !== 'FACULTY') return errorRes('User is not faculty.', [], 400);

    await prisma.user.update({
      where: { id: parseInt(id) },
      data: { status: 'REJECTED' },
    });

    try {
      await sendFacultyRejectionEmail(faculty.email, faculty.name);
    } catch (emailErr) {
      console.error('Faculty rejection email failed:', emailErr);
    }

    return successRes(null, 'Faculty account rejected.');
  } catch (err) {
    console.error('Faculty reject error:', err);
    return errorRes('Internal server error', [], 500);
  }
}
