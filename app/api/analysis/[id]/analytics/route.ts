import { prisma } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const pageViews = await prisma.sharePageView.findMany({
    where: { analysisId: id },
    include: { sectionViews: true },
    orderBy: { startedAt: 'desc' },
  });

  const totalViews = pageViews.length;
  const completedViews = pageViews.filter((pv) => pv.totalDurationMs !== null);
  const avgDurationMs = completedViews.length > 0
    ? Math.round(completedViews.reduce((sum, pv) => sum + (pv.totalDurationMs || 0), 0) / completedViews.length)
    : null;

  const mobileCount = pageViews.filter((pv) => pv.deviceType === 'mobile').length;
  const desktopCount = pageViews.filter((pv) => pv.deviceType === 'desktop').length;

  // Section breakdown
  const sectionMap = new Map<string, { views: number; totalMs: number }>();
  for (const pv of pageViews) {
    for (const sv of pv.sectionViews) {
      const existing = sectionMap.get(sv.section) || { views: 0, totalMs: 0 };
      existing.views++;
      existing.totalMs += sv.durationMs;
      sectionMap.set(sv.section, existing);
    }
  }
  const sections = Array.from(sectionMap.entries())
    .map(([section, data]) => ({
      section,
      views: data.views,
      avgDurationMs: Math.round(data.totalMs / data.views),
    }))
    .sort((a, b) => b.views - a.views);

  // Top referrers
  const referrerMap = new Map<string, number>();
  for (const pv of pageViews) {
    if (pv.referrer) {
      try {
        const domain = new URL(pv.referrer).hostname;
        referrerMap.set(domain, (referrerMap.get(domain) || 0) + 1);
      } catch {
        referrerMap.set(pv.referrer, (referrerMap.get(pv.referrer) || 0) + 1);
      }
    }
  }
  const referrers = Array.from(referrerMap.entries())
    .map(([domain, count]) => ({ domain, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Recent views
  const recentViews = pageViews.slice(0, 20).map((pv) => ({
    id: pv.id,
    startedAt: pv.startedAt,
    deviceType: pv.deviceType,
    totalDurationMs: pv.totalDurationMs,
    referrer: pv.referrer,
    sectionsViewed: pv.sectionViews.length,
  }));

  return NextResponse.json({
    totalViews,
    avgDurationMs,
    mobileCount,
    desktopCount,
    sections,
    referrers,
    recentViews,
  });
}
