import { NextResponse } from 'next/server';

// GET /api/health — uptime monitor
export async function GET() {
  return NextResponse.json({
    success: true,
    data: { status: 'ok', timestamp: new Date().toISOString() },
    message: 'Server is healthy.',
  });
}
