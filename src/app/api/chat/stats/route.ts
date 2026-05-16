import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { authenticate, errorRes, successRes } from '@/lib/api-helpers';

export async function GET(req: NextRequest) {
  try {
    const user = authenticate(req);
    if (!user) return errorRes('Unauthorized', [], 401);

    const now = new Date();

    const [internshipsCount, hackathonsCount] = await Promise.all([
      prisma.scrapedOpportunity.count({
        where: { 
          type: 'INTERNSHIP', 
          isActive: true,
          OR: [
            { deadline: null },
            { deadline: { gte: now } }
          ]
        },
      }),
      prisma.scrapedOpportunity.count({
        where: { 
          type: 'HACKATHON', 
          isActive: true,
          OR: [
            { deadline: null },
            { deadline: { gte: now } }
          ]
        },
      }),
    ]);

    // Profile completion calculation logic is already in /api/profile/check-completion.
    // To keep it simple, we can fetch the user profile here and calculate a rough percentage,
    // or we can just fetch it from the frontend. We will just return the counts here.
    return successRes({ internshipsCount, hackathonsCount }, 'Successfully fetched stats.');
  } catch (error) {
    console.error('Error fetching chat stats:', error);
    return errorRes('Internal server error', [], 500);
  }
}
