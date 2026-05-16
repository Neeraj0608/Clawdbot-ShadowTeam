import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { successRes, errorRes } from '@/lib/api-helpers';
import { resendOtpSchema } from '@/lib/validators';
import { sendOTPEmail, sendLoginOTPEmail } from '@/lib/mailer';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = resendOtpSchema.safeParse(body);
    if (!parsed.success) {
      return errorRes('Validation failed', parsed.error.issues.map((e: any) => e.message), 400);
    }

    const { email } = parsed.data;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return errorRes('No account found with this email.', [], 404);
    }

    // Rate limiting: max 3 OTPs in 15 min
    const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000);
    const recentOtps = await prisma.otp.count({
      where: { email, createdAt: { gte: fifteenMinAgo } },
    });
    if (recentOtps >= 3) {
      return errorRes('Too many OTP requests. Please try again after 15 minutes.', [], 429);
    }

    // Delete old OTPs
    await prisma.otp.deleteMany({ where: { email } });

    // Generate new OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    await prisma.otp.create({ data: { email, code: otp } });

    try {
      if (user.isVerified) {
        await sendLoginOTPEmail(email, otp);
      } else {
        await sendOTPEmail(email, otp);
      }
    } catch (emailErr) {
      console.error('OTP email send failed:', emailErr);
    }

    return successRes(null, 'A new OTP has been sent to your email.');
  } catch (err) {
    console.error('Resend OTP error:', err);
    return errorRes('Internal server error', [], 500);
  }
}
