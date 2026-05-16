import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { successRes, errorRes, authenticate, authorize } from '@/lib/api-helpers';

// GET /api/admin/users — list all users with optional role/status filter
export async function GET(req: NextRequest) {
  try {
    const user = authenticate(req);
    if (!user) return errorRes('Unauthorized', [], 401);
    if (!authorize(user, 'ADMIN')) return errorRes('Forbidden', [], 403);

    const { searchParams } = new URL(req.url);
    const role = searchParams.get('role');
    const status = searchParams.get('status');

    const where: Record<string, unknown> = {};
    if (role) where.role = role.toUpperCase();
    if (status) where.status = status.toUpperCase();

    const users = await prisma.user.findMany({
      where,
      select: { id: true, name: true, email: true, phone: true, role: true, uid: true, isVerified: true, status: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });

    return successRes(users, 'Users retrieved.');
  } catch (err) {
    console.error('Admin users error:', err);
    return errorRes('Internal server error', [], 500);
  }
}
