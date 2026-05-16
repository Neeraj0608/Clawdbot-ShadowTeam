import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { authenticate, errorRes, successRes } from '@/lib/api-helpers';

export async function GET(req: NextRequest) {
  try {
    const user = authenticate(req);
    if (!user) return errorRes('Unauthorized', [], 401);

    const now = new Date();

    const hackathons = await prisma.scrapedOpportunity.findMany({
      where: {
        type: 'HACKATHON',
        isActive: true,
        OR: [
          { deadline: null },
          { deadline: { gte: now } }
        ]
      },
      orderBy: { scrapedAt: 'desc' },
      take: 4,
    });

    return successRes(hackathons, 'Successfully fetched hackathons for chat.');
  } catch (error) {
    console.error('Error fetching hackathons for chat:', error);
    return errorRes('Internal server error', [], 500);
  }
}
