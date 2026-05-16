import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { successRes, errorRes, authenticate } from '@/lib/api-helpers';

// GET /api/bookings/my — student lists own bookings
export async function GET(req: NextRequest) {
  try {
    const user = authenticate(req);
    if (!user) return errorRes('Unauthorized', [], 401);

    const bookings = await prisma.booking.findMany({
      where: { studentId: user.id },
      orderBy: { createdAt: 'desc' },
    });

    return successRes(bookings, 'Bookings retrieved.');
  } catch (err) {
    console.error('My bookings error:', err);
    return errorRes('Internal server error', [], 500);
  }
}
