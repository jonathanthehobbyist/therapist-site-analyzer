import { prisma } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();

  if (body.action === 'pageview') {
    const pageView = await prisma.sharePageView.create({
      data: {
        analysisId: id,
        sessionId: body.sessionId || '',
        referrer: body.referrer || null,
        deviceType: body.deviceType || 'desktop',
        userAgent: typeof body.userAgent === 'string' ? body.userAgent.slice(0, 256) : null,
      },
    });
    return NextResponse.json({ pageViewId: pageView.id });
  }

  if (body.action === 'end') {
    const { pageViewId, totalDurationMs, sections } = body;
    if (!pageViewId) {
      return NextResponse.json({ error: 'Missing pageViewId' }, { status: 400 });
    }

    await prisma.sharePageView.update({
      where: { id: pageViewId },
      data: {
        endedAt: new Date(),
        totalDurationMs: typeof totalDurationMs === 'number' ? totalDurationMs : null,
      },
    });

    if (Array.isArray(sections) && sections.length > 0) {
      await prisma.shareSectionView.createMany({
        data: sections.map((s: { section: string; durationMs: number; viewOrder: number }) => ({
          pageViewId,
          section: s.section,
          durationMs: s.durationMs,
          viewOrder: s.viewOrder,
        })),
      });
    }

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
