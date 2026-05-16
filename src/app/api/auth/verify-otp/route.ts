import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { successRes, errorRes, useSecureCookies } from '@/lib/api-helpers';
import { otpVerifySchema } from '@/lib/validators';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS,
  SHARED_TOKEN_TTL_SECONDS,
  generateAccessToken,
  generateRefreshToken,
  generateSharedToken,
  TokenPayload,
} from '@/lib/jwt';
import { buildSharedTokenPayload, getSharedCookieOptions, SHARED_COOKIE_NAME } from '@/lib/shared-auth';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = otpVerifySchema.safeParse(body);
    if (!parsed.success) {
      return errorRes('Validation failed', parsed.error.issues.map((e: any) => e.message), 400);
    }

    const { email, otp } = parsed.data;

    // Find OTP record
    const otpRecord = await prisma.otp.findFirst({
      where: { email, code: otp },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpRecord) {
      return errorRes('Invalid or expired OTP.', [], 400);
    }

    // Check 10-minute TTL
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    if (otpRecord.createdAt < tenMinutesAgo) {
      await prisma.otp.delete({ where: { id: otpRecord.id } });
      return errorRes('OTP expired. Please request a new one.', [], 400);
    }

    // Mark user as verified and fetch user data for token payload
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return errorRes('User not found.', [], 404);
    }

    if (!user.isVerified) {
      await prisma.user.update({
        where: { id: user.id },
        data: { isVerified: true },
      });
    }

    // Delete all OTPs for this email
    await prisma.otp.deleteMany({ where: { email } });

    // Generate JWT tokens
    const payload: TokenPayload = {
      id: user.id,
      role: user.role,
      name: user.name,
      email: user.email,
      industryId: user.industryId,
      ...(user.uid && { uid: user.uid }),
    };

    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);
    const sharedToken = generateSharedToken(buildSharedTokenPayload(user));
    const secureCookies = useSecureCookies();
    const sharedCookieOptions = getSharedCookieOptions();

    const response = NextResponse.json({
      success: true,
      message: 'OTP verified successfully.',
      data: {
        accessToken,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          uid: user.uid,
          industryId: user.industryId,
        },
      },
    });

    response.cookies.set('accessToken', accessToken, {
      httpOnly: true,
      secure: secureCookies,
      sameSite: 'lax',
      maxAge: ACCESS_TOKEN_TTL_SECONDS,
      path: '/',
    });

    response.cookies.set('refreshToken', refreshToken, {
      httpOnly: true,
      secure: secureCookies,
      sameSite: 'lax',
      maxAge: REFRESH_TOKEN_TTL_SECONDS,
      path: '/',
    });

    response.cookies.set(SHARED_COOKIE_NAME, sharedToken, {
      ...sharedCookieOptions,
      maxAge: SHARED_TOKEN_TTL_SECONDS,
    });

    return response;
  } catch (err) {
    console.error('OTP verify error:', err);
    return errorRes('Internal server error', [], 500);
  }
}
