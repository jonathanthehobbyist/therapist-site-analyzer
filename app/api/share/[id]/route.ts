import { prisma } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const analysis = await prisma.analysis.findUnique({
    where: { id },
    include: { site: true },
  });

  if (!analysis || !analysis.isPublic) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({
    ...analysis,
    seoComparisonData: analysis.seoComparisonData
      ? JSON.parse(analysis.seoComparisonData)
      : null,
    seoHygieneData: analysis.seoHygieneData
      ? JSON.parse(analysis.seoHygieneData)
      : null,
    hipaaData: analysis.hipaaData ? JSON.parse(analysis.hipaaData) : null,
    pagesScraped: analysis.pagesScraped
      ? JSON.parse(analysis.pagesScraped)
      : null,
    keywordData: analysis.keywordData
      ? JSON.parse(analysis.keywordData)
      : null,
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();

  const analysis = await prisma.analysis.update({
    where: { id },
    data: { isPublic: Boolean(body.isPublic) },
  });

  return NextResponse.json({ id: analysis.id, isPublic: analysis.isPublic });
}
