import { prisma } from '@/lib/db';
import { checkRateLimit } from '@/lib/rate-limit';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const body = await req.json();

  // Honeypot — bots fill this invisible field
  if (body.company) {
    return NextResponse.json({ ok: true }); // silent success to avoid tipping off bots
  }

  const { siteUrl, email } = body;

  // Validate URL
  if (!siteUrl || typeof siteUrl !== 'string') {
    return NextResponse.json({ error: 'Website URL is required' }, { status: 400 });
  }
  try {
    const url = new URL(siteUrl.startsWith('http') ? siteUrl : `https://${siteUrl}`);
    if (!url.hostname.includes('.')) throw new Error();
  } catch {
    return NextResponse.json({ error: 'Please enter a valid website URL' }, { status: 400 });
  }

  // Validate email
  if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Please enter a valid email address' }, { status: 400 });
  }

  // Rate limit by IP
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const { allowed } = checkRateLimit(ip);
  if (!allowed) {
    return NextResponse.json({ error: 'Too many submissions. Please try again later.' }, { status: 429 });
  }

  // Normalize URL
  const normalizedUrl = siteUrl.startsWith('http') ? siteUrl : `https://${siteUrl}`;

  await prisma.intakeSubmission.create({
    data: {
      siteUrl: normalizedUrl,
      email: email.trim().toLowerCase(),
      ipAddress: ip,
    },
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
