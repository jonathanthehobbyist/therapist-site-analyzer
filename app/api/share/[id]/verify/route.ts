import { prisma } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { passcode } = await req.json();

  const analysis = await prisma.analysis.findUnique({
    where: { id },
    select: { isPublic: true, sharePasscode: true },
  });

  if (!analysis || !analysis.isPublic) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (!analysis.sharePasscode || analysis.sharePasscode === passcode) {
    const res = NextResponse.json({ ok: true });
    res.cookies.set(`share-${id}`, 'verified', {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });
    return res;
  }

  return NextResponse.json({ error: 'Incorrect passcode' }, { status: 401 });
}
