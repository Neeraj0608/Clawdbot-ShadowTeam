import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { successRes, errorRes, authenticate, authorize } from '@/lib/api-helpers';

// GET /api/admin/stats — dashboard stats
export async function GET(req: NextRequest) {
  try {
    const user = authenticate(req);
    if (!user) return errorRes('Unauthorized', [], 401);
    if (!authorize(user, 'ADMIN')) return errorRes('Forbidden', [], 403);

    const [totalStudents, totalFaculty, pendingBookings, confirmedBookings, activeGrants, newsCount] = await Promise.all([
      prisma.user.count({ where: { role: 'STUDENT' } }),
      prisma.user.count({ where: { role: 'FACULTY' } }),
      prisma.booking.count({ where: { status: 'PENDING' } }),
      prisma.booking.count({ where: { status: 'CONFIRMED' } }),
      prisma.grant.count({ where: { isActive: true } }),
      prisma.newsPost.count({ where: { isVisible: true } }),
    ]);

    return successRes({
      totalStudents,
      totalFaculty,
      pendingBookings,
      confirmedBookings,
      activeGrants,
      newsCount,
    }, 'Stats retrieved.');
  } catch (err) {
    console.error('Admin stats error:', err);
    return errorRes('Internal server error', [], 500);
  }
}
