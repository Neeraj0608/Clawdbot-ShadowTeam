import { NextRequest } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { authenticate, errorRes, successRes } from '@/lib/api-helpers';

const bodySchema = z.object({
  facility: z.string().min(1),
  date: z.string().optional(),
  time_slot: z.string().optional(),
  purpose: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const user = authenticate(req);
    if (!user) return errorRes('Unauthorized', [], 401);

    const body = await req.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return errorRes('Validation failed', parsed.error.issues.map((i) => i.message), 400);
    }

    const { facility, date, time_slot, purpose } = parsed.data;

    // Parse date or default to tomorrow
    let bookingDate: Date;
    if (date) {
      bookingDate = new Date(date);
      if (isNaN(bookingDate.getTime())) {
        bookingDate = new Date();
        bookingDate.setDate(bookingDate.getDate() + 1);
      }
    } else {
      bookingDate = new Date();
      bookingDate.setDate(bookingDate.getDate() + 1);
    }
    
    const booking = await prisma.booking.create({
      data: {
        studentId: user.id,
        purpose: purpose || 'Research / Study',
        date: bookingDate,
        timeSlot: time_slot || '09:00 - 11:00',
        facilities: ['Computers', 'Internet'],
        lab: facility,
        status: 'PENDING', 
      },
    });

    return successRes({ booking }, 'Lab booked successfully.');
  } catch (error) {
    console.error('Error booking lab from chat:', error);
    return errorRes('Internal server error', [], 500);
  }
}
