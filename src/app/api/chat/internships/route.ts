import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { authenticate, errorRes, successRes } from '@/lib/api-helpers';

export async function GET(req: NextRequest) {
  try {
    const user = authenticate(req);
    if (!user) return errorRes('Unauthorized', [], 401);

    const now = new Date();

    const internships = await prisma.scrapedOpportunity.findMany({
      where: {
        type: 'INTERNSHIP',
        isActive: true,
        OR: [
          { deadline: null },
          { deadline: { gte: now } }
        ]
      },
      orderBy: { scrapedAt: 'desc' },
      take: 4,
    });

    return successRes(internships, 'Successfully fetched internships for chat.');
  } catch (error) {
    console.error('Error fetching internships for chat:', error);
    return errorRes('Internal server error', [], 500);
  }
}
