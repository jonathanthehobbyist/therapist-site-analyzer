import { prisma } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  // Mark any analysis stuck in running/pending for >15 min as errored
  const staleThreshold = new Date(Date.now() - 15 * 60 * 1000);
  await prisma.analysis.updateMany({
    where: {
      status: { in: ['running', 'pending'] },
      createdAt: { lt: staleThreshold },
    },
    data: {
      status: 'error',
      error: 'Analysis timed out — it may have encountered an issue. Please try re-running.',
    },
  });

  const analyses = await prisma.analysis.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      createdAt: true,
      siteUrl: true,
      competitorUrl: true,
      keyword: true,
      status: true,
      seoComparisonScore: true,
      seoHygieneScore: true,
      hipaaRiskLevel: true,
      isPublic: true,
      site: { select: { id: true, url: true, label: true } },
      _count: { select: { pageViews: true } },
    },
  });

  return NextResponse.json(analyses.map(a => ({
    ...a,
    shareViews: a._count.pageViews,
    _count: undefined,
  })));
}
