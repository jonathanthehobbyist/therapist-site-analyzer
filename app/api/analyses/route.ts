import { prisma } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
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
    },
  });

  return NextResponse.json(analyses);
}
