import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = process.env.MIRROR_USER;
  const password = process.env.MIRROR_PASSWORD;

  return NextResponse.json({
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'unknown',
    mirrorUserConfigured: Boolean(user),
    mirrorPasswordConfigured: Boolean(password),
    mirrorUserLength: user ? user.length : 0,
    mirrorPasswordLength: password ? password.length : 0,
    checkedAt: new Date().toISOString(),
  });
}
